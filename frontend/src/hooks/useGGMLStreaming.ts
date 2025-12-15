// High-level wrapper for GGML StreamTranscriber, matching app.js pattern
// StreamTranscriber spawns its own internal Web Worker for WASM computation
// So we can safely use it on the main thread without blocking UI
import { useRef, useState, useCallback } from "react";

interface StreamTranscriberSegment {
    segment?: {
        text: string;
        timestamps: { from: number; to: number };
    };
    text?: string;
    timestamps?: { from: number; to: number };
    result?: {
        language?: string;
    };
}

export interface UseGGMLStreamingReturn {
    streamTranscriber: any | null;
    isReady: boolean;
    streamStatus: string;
    voiceActivity: boolean;
    initStreamTranscriber: (modelName: string) => Promise<boolean>;
    startStreaming: (audioStream: MediaStream, options?: {
        lang?: string;
        suppress_non_speech?: boolean;
        max_tokens?: number;
        preRecordsMs?: number;
        maxRecordMs?: number;
        minSilenceMs?: number;
        onVoiceActivity?: (active: boolean) => void;
    }) => Promise<void>;
    stopStreaming: () => Promise<void>;
}

const DB_NAME = "TranscriberDB";
const DB_VERSION = 1;
const STORE_NAME = "models";

// IndexedDB helpers (same as app.js)
async function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

async function getModelFromIndexedDB(modelName: string): Promise<Uint8Array | null> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(modelName);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

async function saveModelToIndexedDB(modelName: string, modelData: Uint8Array): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(modelData, modelName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function downloadModel(
    url: string,
    onProgress?: (loaded: number, total: number) => void
): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download model: ${response.statusText}`);
    }

    const contentLength = response.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        if (onProgress && total) {
            onProgress(loaded, total);
        }
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    return result;
}

function getModelUrl(modelName: string): string {
    const modelMap: Record<string, string> = {
        "tiny": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
        "tiny.en": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
        "base": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
        "base.en": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
        "small": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
        "small.en": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
    };

    return modelMap[modelName] || modelMap["tiny.en"];
}

async function getOrDownloadModel(
    modelName: string,
    onProgress?: (loaded: number, total: number) => void
): Promise<Uint8Array> {
    // Check cache
    const cachedModel = await getModelFromIndexedDB(modelName);
    if (cachedModel) {
        if (onProgress) {
            onProgress(cachedModel.length, cachedModel.length);
        }
        return cachedModel;
    }

    // Download
    const modelUrl = getModelUrl(modelName);
    const modelData = await downloadModel(modelUrl, onProgress);

    // Save to cache
    await saveModelToIndexedDB(modelName, modelData);

    return modelData;
}

export function useGGMLStreaming(
    onSegmentCallback: (segment: StreamTranscriberSegment) => void,
    onProgressCallback?: (loaded: number, total: number) => void
): UseGGMLStreamingReturn {
    const streamTranscriberRef = useRef<any | null>(null);
    const currentModelNameRef = useRef<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [streamStatus, setStreamStatus] = useState<string>("");
    const [voiceActivity, setVoiceActivity] = useState(false);

    const initStreamTranscriber = useCallback(async (modelName: string): Promise<boolean> => {
        try {
            if (streamTranscriberRef.current && currentModelNameRef.current === modelName) {
                return true;
            }

            // Clean up old transcriber if model changed
            if (streamTranscriberRef.current && currentModelNameRef.current !== modelName) {
                try {
                    await streamTranscriberRef.current.stop();
                } catch (e) {
                    // Ignore stop errors
                }
                streamTranscriberRef.current = null;
            }


            // Get or download model
            const modelData = await getOrDownloadModel(modelName, onProgressCallback);

            // Import libraries
            const { StreamTranscriber } = await import("@transcribe/transcriber");

            // const StreamTranscriber = (await import(
            //     new URL(
            //         "/node_modules/@transcribe/transcriber/src/StreamTranscriber.js",
            //         import.meta.url
            //     ).href
            // )).StreamTranscriber;
            const createModule = (await import("@transcribe/shout")).default;

            // Wrap createModule to inject locateFile for production builds
            const createModuleWrapper = (moduleObj: any) => {
                if (!moduleObj) moduleObj = {};
                moduleObj.locateFile = (path: string, scriptDirectory: string) => {
                    console.log(`[GGML] locateFile called for: ${path}, scriptDir: ${scriptDirectory}`);
                    // In production, assets are in /assets/ but worker/wasm might be in /
                    // Force worker and wasm to be loaded from root if they are there
                    if (path.endsWith('worker.mjs') || path.endsWith('worker.js')) {
                        console.log(`[GGML] Redirecting worker to /${path}`);
                        return `/${path}`;
                    }
                    if (path.endsWith('.wasm')) {
                        console.log(`[GGML] Redirecting wasm to /${path}`);
                        return `/${path}`;
                    }
                    return scriptDirectory + path;
                };
                return createModule(moduleObj);
            };

            // Create blob URL from model data
            const modelBlob = new Blob([modelData as BlobPart], { type: "application/octet-stream" });
            const modelUrl = URL.createObjectURL(modelBlob);

            console.log("[GGML] Initializing StreamTranscriber...");
            // Create StreamTranscriber instance (same pattern as app.js)
            // This spawns its own internal Web Worker for WASM computation
            // Specify audioWorkletPath so it can find the worklet scripts
            // Use absolute path for worklets to avoid relative path issues in production
            const workletPath = new URL("/audio-worklets", window.location.origin).href;
            console.log(`[GGML] Using audioWorkletPath: ${workletPath}`);

            streamTranscriberRef.current = new StreamTranscriber({
                createModule: createModuleWrapper,
                model: modelUrl,
                // @ts-ignore - The library expects audioWorkletsPath (plural) despite TS types saying otherwise
                audioWorkletsPath: workletPath, // Path to worklet scripts in public directory
                onReady: () => {
                    console.log("[GGML] StreamTranscriber ready");
                    setIsReady(true);
                },
                onStreamStatus: (status: string) => {
                    console.log(`[GGML] Stream status: ${status}`);
                    setStreamStatus(status);
                },
                onSegment: (segment: any) => {
                    // Convert to our format
                    const convertedSegment: StreamTranscriberSegment = {
                        segment: segment.segment || {
                            text: segment.text || '',
                            timestamps: {
                                from: typeof segment.timestamps?.from === 'string'
                                    ? parseFloat(segment.timestamps.from)
                                    : (segment.timestamps?.from || 0),
                                to: typeof segment.timestamps?.to === 'string'
                                    ? parseFloat(segment.timestamps.to)
                                    : (segment.timestamps?.to || null)
                            }
                        },
                        text: segment.text || segment.segment?.text,
                        timestamps: segment.timestamps || segment.segment?.timestamps,
                        result: segment.result
                    };
                    onSegmentCallback(convertedSegment);
                }
            });

            // Initialize
            await streamTranscriberRef.current.init();
            console.log("[GGML] StreamTranscriber initialized");
            currentModelNameRef.current = modelName;
            return true;
        } catch (error) {
            console.error("[GGML] Initialization error:", error);
            setIsReady(false);
            return false;
        }
    }, [onProgressCallback]);

    const startStreaming = useCallback(async (
        audioStream: MediaStream,
        options: {
            lang?: string;
            suppress_non_speech?: boolean;
            max_tokens?: number;
            preRecordsMs?: number;
            maxRecordMs?: number;
            minSilenceMs?: number;
            onVoiceActivity?: (active: boolean) => void;
        } = {}
    ): Promise<void> => {
        if (!streamTranscriberRef.current) {
            throw new Error("StreamTranscriber not initialized");
        }

        const defaultOptions = {
            lang: "en",
            suppress_non_speech: true,
            max_tokens: 16,
            preRecordsMs: 200,
            maxRecordMs: 5000,
            minSilenceMs: 500,
            ...options
        };


        // Start the transcriber (same pattern as app.js)
        console.log("[GGML] Starting stream...");
        try {
            await streamTranscriberRef.current.start({
                lang: defaultOptions.lang,
                suppress_non_speech: defaultOptions.suppress_non_speech,
                max_tokens: defaultOptions.max_tokens
            });
            console.log("[GGML] Stream started successfully");
        } catch (e) {
            console.error("[GGML] Error starting stream:", e);
            throw e;
        }

        // Transcribe the stream (same pattern as app.js)
        // This internally extracts audio from MediaStream and sends to worker
        await streamTranscriberRef.current.transcribe(audioStream, {
            preRecordsMs: defaultOptions.preRecordsMs,
            maxRecordMs: defaultOptions.maxRecordMs,
            minSilenceMs: defaultOptions.minSilenceMs,
            onVoiceActivity: (active: boolean) => {
                setVoiceActivity(active);
                if (defaultOptions.onVoiceActivity) {
                    defaultOptions.onVoiceActivity(active);
                }
            }
        });

    }, []);

    const stopStreaming = useCallback(async (): Promise<void> => {
        if (streamTranscriberRef.current) {
            try {
                await streamTranscriberRef.current.stop();
            } catch (error) {
                // Error stopping stream
            }
        }
        setStreamStatus("stopped");
        setVoiceActivity(false);
    }, []);

    return {
        streamTranscriber: streamTranscriberRef.current,
        isReady,
        streamStatus,
        voiceActivity,
        initStreamTranscriber,
        startStreaming,
        stopStreaming
    };
}
