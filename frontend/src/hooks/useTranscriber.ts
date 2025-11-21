import { useCallback, useMemo, useState, useRef } from "react";
import { useWorker, WorkerType } from "./useWorker";
import Constants from "../utils/Constants";

interface ProgressItem {
    file: string;
    loaded: number;
    progress: number;
    total: number;
    name: string;
    status: string;
}

interface TranscriberUpdateData {
    data: [
        string,
        { chunks: { text: string; timestamp: [number, number | null] }[] },
    ];
    text: string;
}

interface TranscriberCompleteData {
    data: {
        text: string;
        chunks: { text: string; timestamp: [number, number | null] }[];
    };
}

export interface TranscriberData {
    isBusy: boolean;
    text: string;
    chunks: { text: string; timestamp: [number, number | null] }[];
}

export interface Transcriber {
    onInputChange: () => void;
    isBusy: boolean;
    isModelLoading: boolean;
    progressItems: ProgressItem[];
    start: (audioData: AudioBuffer | undefined) => void;
    updateTranscript: (text: string, chunks: { text: string; timestamp: [number, number | null] }[]) => void;
    startStreaming: () => void;
    stopStreaming: () => void;
    output?: TranscriberData;
    model: string;
    setModel: (model: string) => void;
    multilingual: boolean;
    setMultilingual: (model: boolean) => void;
    quantized: boolean;
    setQuantized: (model: boolean) => void;
    subtask: string;
    setSubtask: (subtask: string) => void;
    language?: string;
    setLanguage: (language: string) => void;
    isLiveMode: boolean;
    accumulatedChunks: { text: string; timestamp: [number, number | null] }[];
    transcriberType: WorkerType;
    setTranscriberType: (type: WorkerType) => void;
    streamStatus: string;
    voiceActivity: boolean;
}

export function useTranscriber(): Transcriber {
    const [transcript, setTranscript] = useState<TranscriberData | undefined>(
        undefined,
    );
    const [isBusy, setIsBusy] = useState(false);
    const [isModelLoading, setIsModelLoading] = useState(false);

    const [progressItems, setProgressItems] = useState<ProgressItem[]>([]);

    // State for live transcription mode
    const [isLiveMode, setIsLiveMode] = useState(false);
    const [accumulatedChunks, setAccumulatedChunks] = useState<
        { text: string; timestamp: [number, number | null] }[]
    >([]);
    const accumulatedTextRef = useRef<string>("");
    const [transcriberType, setTranscriberTypeState] = useState<WorkerType>("xenova");
    const [streamStatus, setStreamStatus] = useState<string>("");
    const [voiceActivity, setVoiceActivity] = useState<boolean>(false);
    const isStreamingRef = useRef(false);
    const transcriberTypeRef = useRef<WorkerType>(transcriberType);
    
    // Update ref when transcriberType changes
    transcriberTypeRef.current = transcriberType;
    
    // Wrapper to log transcriberType changes
    const setTranscriberType = useCallback((type: WorkerType) => {
        console.log('[useTranscriber] setTranscriberType called, changing from', transcriberTypeRef.current, 'to', type);
        setTranscriberTypeState(type);
    }, []);

    const webWorker = useWorker((event) => {
        const message = event.data;
        console.log('[useTranscriber] Message received from worker:', message);
        
        // Update the state with the result
        switch (message.status) {
            case "pong":
                // Test response from worker
                console.log('[useTranscriber] Worker ping response received:', message.data);
                break;
            case "debug":
                // Log debug messages from worker to console
                console.log(message.data?.message || message.data);
                break;
            case "stream_status":
                // Update stream status (waiting, processing, etc.)
                setStreamStatus(message.data?.status || "");
                break;
            case "voice_activity":
                // Update voice activity indicator
                setVoiceActivity(message.data?.active || false);
                break;
            case "stream_stopped":
                setStreamStatus("stopped");
                setIsLiveMode(false);
                isStreamingRef.current = false;
                break;
            case "stream_started":
                console.log('[useTranscriber] Stream started, setting isStreamingRef to true');
                isStreamingRef.current = true;
                setIsLiveMode(true);
                setStreamStatus("waiting");
                break;
            case "progress":
                // Model file progress: update one of the progress items.
                setProgressItems((prev) =>
                    prev.map((item) => {
                        if (item.file === message.file) {
                            return { ...item, progress: message.progress };
                        }
                        return item;
                    }),
                );
                break;
            case "update":
                // Received partial update
                // console.log("update", message);
                // eslint-disable-next-line no-case-declarations
                const updateMessage = message as TranscriberUpdateData;

                // NEW: In live mode, accumulate chunks
                if (isLiveMode) {
                    const newChunks = updateMessage.data[1].chunks;
                    setAccumulatedChunks((prev) => {
                        // Filter out duplicates based on text and timestamp
                        const existingTexts = new Set(prev.map(c => c.text));
                        const uniqueNewChunks = newChunks.filter(
                            chunk => !existingTexts.has(chunk.text)
                        );
                        return [...prev, ...uniqueNewChunks];
                    });

                    // Update accumulated text
                    accumulatedTextRef.current = updateMessage.data[0];
                }

                setTranscript({
                    isBusy: true,
                    text: updateMessage.data[0],
                    chunks: updateMessage.data[1].chunks,
                });
                break;
            case "complete":
                // Received complete transcript
                // console.log("complete", message);
                // eslint-disable-next-line no-case-declarations
                const completeMessage = message as TranscriberCompleteData;

                // NEW: In live mode, merge with accumulated chunks
                if (isLiveMode) {
                    const finalChunks = completeMessage.data.chunks;
                    setAccumulatedChunks((prev) => {
                        // Merge accumulated chunks with final chunks
                        const allChunks = [...prev, ...finalChunks];

                        // Remove duplicates based on text content
                        const uniqueChunks = allChunks.filter((chunk, index, self) =>
                            index === self.findIndex(c => c.text === chunk.text)
                        );

                        return uniqueChunks;
                    });

                    // Build complete text from all chunks
                    const completeText = accumulatedChunks
                        .concat(finalChunks)
                        .map(c => c.text)
                        .join(' ')
                        .trim();

                    setTranscript({
                        isBusy: false,
                        text: completeText || completeMessage.data.text,
                        chunks: accumulatedChunks.length > 0
                            ? [...accumulatedChunks, ...finalChunks]
                            : completeMessage.data.chunks,
                    });
                } else {
                    setTranscript({
                        isBusy: false,
                        text: completeMessage.data.text,
                        chunks: completeMessage.data.chunks,
                    });
                }

                setIsBusy(false);
                break;

            case "initiate":
                // Model file start load: add a new progress item to the list.
                setIsModelLoading(true);
                setProgressItems((prev) => [...prev, message]);
                break;
            case "ready":
                setIsModelLoading(false);
                break;
            case "error":
                setIsBusy(false);
                setIsLiveMode(false);
                alert(
                    `${message.data.message} This is most likely because you are using Safari on an M1/M2 Mac. Please try again from Chrome, Firefox, or Edge.\n\nIf this is not the case, please file a bug report.`,
                );
                break;
            case "done":
                // Model file loaded: remove the progress item from the list.
                setProgressItems((prev) =>
                    prev.filter((item) => item.file !== message.file),
                );
                break;

            default:
                // initiate/download/done
                break;
        }
    }, transcriberType);

    const [model, setModel] = useState<string>(Constants.DEFAULT_MODEL);
    const [subtask, setSubtask] = useState<string>(Constants.DEFAULT_SUBTASK);
    const [quantized, setQuantized] = useState<boolean>(
        Constants.DEFAULT_QUANTIZED,
    );
    const [multilingual, setMultilingual] = useState<boolean>(
        Constants.DEFAULT_MULTILINGUAL,
    );
    const [language, setLanguage] = useState<string>(
        Constants.DEFAULT_LANGUAGE,
    );

    const onInputChange = useCallback(() => {
        setTranscript(undefined);
        setIsLiveMode(false);
        setAccumulatedChunks([]);
        accumulatedTextRef.current = "";
        setStreamStatus("");
        setVoiceActivity(false);
        isStreamingRef.current = false;
    }, []);

    const startStreaming = useCallback(() => {
        if (transcriberType === "ggml") {
            console.log('[useTranscriber] Starting GGML streaming mode');
            console.log('[useTranscriber] webWorker:', webWorker);
            console.log('[useTranscriber] webWorker.constructor.name:', webWorker.constructor.name);
            isStreamingRef.current = true; // Set immediately to avoid race condition
            setIsLiveMode(true);
            setStreamStatus("waiting");
            const message = {
                action: "start_stream",
                model: model || "tiny.en",
                options: {
                    lang: "en",
                    suppress_non_speech: true,
                    max_tokens: 16
                }
            };
            console.log('[useTranscriber] Sending start_stream message:', message);
            try {
                webWorker.postMessage(message);
                console.log('[useTranscriber] start_stream message sent successfully');
            } catch (error) {
                console.error('[useTranscriber] Error sending start_stream message:', error);
            }
        }
    }, [webWorker, model, transcriberType]);

    const stopStreaming = useCallback(() => {
        if (transcriberType === "ggml") {
            console.log('[useTranscriber] Stopping GGML streaming mode');
            isStreamingRef.current = false; // Set immediately
            setIsLiveMode(false);
            setStreamStatus("stopped");
            webWorker.postMessage({
                action: "stop_stream"
            });
        }
    }, [webWorker, transcriberType]);

    const postRequest = useCallback(
        async (audioData: AudioBuffer | undefined) => {
            // GGML StreamTranscriber does not send AudioBuffer - it sends text segments directly
            // Skip audio processing if data is not an AudioBuffer
            if (!audioData) {
                return;
            }
            
            // Check if audioData is actually an AudioBuffer
            if (!(audioData instanceof AudioBuffer)) {
                console.warn('[useTranscriber] Received non-AudioBuffer data (likely GGML segment), skipping audio processing');
                return;
            }
            
            let audio;
            if (audioData.numberOfChannels === 2) {
                const SCALING_FACTOR = Math.sqrt(2);

                let left = audioData.getChannelData(0);
                let right = audioData.getChannelData(1);

                audio = new Float32Array(left.length);
                for (let i = 0; i < audioData.length; ++i) {
                    audio[i] = SCALING_FACTOR * (left[i] + right[i]) / 2;
                }
            } else {
                // If the audio is not stereo, we can just use the first channel:
                audio = audioData.getChannelData(0);
            }

                // For GGML streaming mode, send chunks instead of full transcription
                if (transcriberType === "ggml" && isStreamingRef.current) {
                    // Send streaming chunk
                    // Convert Float32Array to regular array for postMessage (Float32Array may not transfer correctly)
                    const audioArray = Array.from(audio);
                    // Only log occasionally to reduce spam
                    if (Math.random() < 0.01) { // Log ~1% of chunks
                        console.log('[useTranscriber] Sending streaming chunk, length:', audio.length);
                    }
                    const message = {
                        action: "stream_chunk",
                        audio: audioArray, // Send as regular array
                        model: model,
                    };
                    try {
                        webWorker.postMessage(message);
                    } catch (error) {
                        console.error('[useTranscriber] Error sending stream_chunk message:', error);
                    }
                } else {
                    // Regular transcription mode
                    // NEW: Detect if we're already transcribing (live mode)
                    if (isBusy) {
                        setIsLiveMode(true);
                    } else {
                        setTranscript(undefined);
                        setIsLiveMode(false);
                        setAccumulatedChunks([]);
                        accumulatedTextRef.current = "";
                    }

                    setIsBusy(true);

                    webWorker.postMessage({
                        audio,
                        model,
                        multilingual,
                        quantized,
                        subtask: multilingual ? subtask : null,
                        language:
                            multilingual && language !== "auto" ? language : null,
                    });
                }
        },
        [webWorker, model, multilingual, quantized, subtask, language, isBusy, transcriberType, isStreamingRef],
    );

    // Method to update transcript directly (for GGML streaming segments)
    const updateTranscript = useCallback((text: string, chunks: { text: string; timestamp: [number, number | null] }[]) => {
        console.log('[useTranscriber] updateTranscript called with:', { text, chunksCount: chunks.length });
        
        // Update accumulated chunks in live mode
        if (isLiveMode) {
            setAccumulatedChunks((prev) => {
                // Filter out duplicates based on text
                const existingTexts = new Set(prev.map(c => c.text));
                const uniqueNewChunks = chunks.filter(
                    chunk => !existingTexts.has(chunk.text)
                );
                return [...prev, ...uniqueNewChunks];
            });
            accumulatedTextRef.current = text;
        }
        
        // Update transcript
        setTranscript({
            isBusy: false,
            text: text,
            chunks: chunks,
        });
    }, [isLiveMode]);

    const transcriber = useMemo(() => {
        return {
            onInputChange,
            isBusy,
            isModelLoading,
            progressItems,
            start: postRequest,
            updateTranscript,
            startStreaming,
            stopStreaming,
            output: transcript,
            model,
            setModel,
            multilingual,
            setMultilingual,
            quantized,
            setQuantized,
            subtask,
            setSubtask,
            language,
            setLanguage,
            isLiveMode,
            accumulatedChunks,
            transcriberType,
            setTranscriberType,
            streamStatus,
            voiceActivity,
        };
    }, [
        onInputChange,
        isBusy,
        isModelLoading,
        progressItems,
        postRequest,
        updateTranscript,
        startStreaming,
        stopStreaming,
        transcript,
        model,
        multilingual,
        quantized,
        subtask,
        language,
        isLiveMode,
        accumulatedChunks,
        transcriberType,
        streamStatus,
        voiceActivity,
    ]);

    return transcriber;
}