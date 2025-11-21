/* eslint-disable camelcase */
// GGML Whisper Worker using @transcribe/transcriber

// CRITICAL: Send a message IMMEDIATELY when the script loads
// This must be the FIRST executable line
try {
    self.postMessage({ status: "debug", data: { message: "[GGML Worker] 🚀 SCRIPT LOADED - FIRST MESSAGE" } });
} catch (e) {
    // If this fails, the worker context is broken
}

// Helper function to send debug logs to main thread
function debugLog(...args) {
    const message = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
    
    // Log in worker (may not be visible) - keep one console.log for worker console
    if (typeof console !== 'undefined' && console.log) {
        console.log('[GGML Worker]', ...args);
    }
    
    // Send to main thread so it's visible in console
    self.postMessage({
        status: "debug",
        data: { message: `[GGML Worker] ${message}` },
    });
}

// Immediately send a message to verify worker is executing
// This should be the FIRST thing that runs when the worker loads
// Use a simpler approach that doesn't rely on IIFE
try {
    if (typeof self === 'undefined') {
        throw new Error('self is undefined - not in a worker context');
    }
    if (typeof self.postMessage === 'undefined') {
        throw new Error('postMessage is undefined');
    }
    
    // Send initial message
    self.postMessage({
        status: "debug",
        data: { message: "[GGML Worker] ✅ Worker script executing! Timestamp: " + Date.now() },
    });
    
    // Also log to console (visible in worker console)
    if (typeof console !== 'undefined' && console.log) {
        console.log('[GGML Worker] ✅ Initial postMessage sent successfully');
    }
} catch (error) {
    // Try to send error via postMessage
    try {
        if (typeof self !== 'undefined' && self.postMessage) {
            self.postMessage({
                status: "error",
                data: { message: `[GGML Worker] Initialization error: ${error.message}` },
            });
        }
    } catch (e) {
        // If even that fails, we can't communicate
    }
    // Log to console if available
    if (typeof console !== 'undefined' && console.error) {
        console.error('[GGML Worker] ❌ Error during initialization:', error);
    }
}

// Wrap initialization in try-catch to catch any errors
try {
    // Direct console.log to verify worker is loading (visible in worker console)
    console.log('[GGML Worker] Worker script loaded and initialized');
    console.log('[GGML Worker] Worker location:', self.location.href);
    console.log('[GGML Worker] Worker type:', typeof Worker !== 'undefined' ? 'Worker available' : 'Worker not available');
    console.log('[GGML Worker] self type:', typeof self);
    console.log('[GGML Worker] self.location:', self.location);

    debugLog('Worker script loaded and initialized');
    debugLog('Worker location:', self.location.href);
} catch (error) {
    console.error('[GGML Worker] Error during initialization:', error);
    console.error('[GGML Worker] Error stack:', error.stack);
    self.postMessage({
        status: "error",
        data: { message: `[GGML Worker] Initialization error: ${error.message}` },
    });
}

const DB_NAME = "TranscriberDB";
const DB_VERSION = 1;
const STORE_NAME = "models";

let db = null;
let transcriber = null;
let streamTranscriber = null;
let currentModelName = null;
let isStreaming = false;
let streamingChunks = [];
let streamingInterval = null;

// IndexedDB Functions
function openDatabase() {
    debugLog('Opening IndexedDB:', DB_NAME);
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            debugLog('IndexedDB open error:', request.error);
            reject(request.error);
        };
        request.onsuccess = () => {
            debugLog('IndexedDB opened successfully');
            resolve(request.result);
        };
        
        request.onupgradeneeded = (event) => {
            debugLog('IndexedDB upgrade needed');
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
                debugLog('Created object store:', STORE_NAME);
            }
        };
    });
}

async function getModelFromIndexedDB(modelName) {
    debugLog('Getting model from IndexedDB:', modelName);
    if (!db) {
        db = await openDatabase();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(modelName);
        
        request.onsuccess = () => {
            const result = request.result;
            if (result) {
                debugLog('Model found in cache, size:', result.length, 'bytes');
            } else {
                debugLog('Model not found in cache');
            }
            resolve(result);
        };
        request.onerror = () => {
            debugLog('Error getting model from IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

async function saveModelToIndexedDB(modelName, modelData) {
    debugLog('Saving model to IndexedDB:', modelName, 'size:', modelData.length, 'bytes');
    if (!db) {
        db = await openDatabase();
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(modelData, modelName);
        
        request.onsuccess = () => {
            debugLog('Model saved to IndexedDB successfully');
            resolve();
        };
        request.onerror = () => {
            debugLog('Error saving model to IndexedDB:', request.error);
            reject(request.error);
        };
    });
}

async function downloadModel(url, onProgress) {
    debugLog('Starting model download from:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
        console.error('[GGML Worker] Download failed:', response.statusText);
        debugLog('Download failed:', response.statusText);
        throw new Error(`Failed to download model: ${response.statusText}`);
    }
    
    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    debugLog('Model size:', total, 'bytes (', (total / 1024 / 1024).toFixed(2), 'MB)');
    let loaded = 0;
    
    const reader = response.body.getReader();
    const chunks = [];
    
    while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
            debugLog('Download complete, total chunks:', chunks.length);
            break;
        }
        
        chunks.push(value);
        loaded += value.length;
        
        if (onProgress && total) {
            const percent = (loaded / total * 100).toFixed(2);
            debugLog('Download progress:', percent + '%', `(${(loaded / 1024 / 1024).toFixed(2)}MB / ${(total / 1024 / 1024).toFixed(2)}MB)`);
            onProgress(loaded, total);
        }
    }
    
    // Combine chunks into single Uint8Array
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    debugLog('Combining chunks, total length:', totalLength);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    
    debugLog('Model download and assembly complete');
    return result;
}

// Get model URL based on model name
function getModelUrl(modelName) {
    // Default to tiny.en model
    const defaultModel = "ggml-tiny.en.bin";
    const defaultUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin";
    
    // Map model names to URLs (you can extend this)
    const modelMap = {
        "tiny": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
        "tiny.en": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
        "base": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
        "base.en": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin",
        "small": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
        "small.en": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin",
    };
    
    return modelMap[modelName] || defaultUrl;
}

async function getOrDownloadModel(modelName) {
    debugLog('getOrDownloadModel called for:', modelName);
    try {
        // Check if model exists in IndexedDB
        debugLog('Checking cache for model:', modelName);
        const cachedModel = await getModelFromIndexedDB(modelName);
        
        if (cachedModel) {
            debugLog('Using cached model');
            self.postMessage({
                status: "progress",
                file: modelName,
                loaded: cachedModel.length,
                total: cachedModel.length,
                progress: 1,
                name: modelName,
            });
            return cachedModel;
        }
        
        // Download model if not cached
        const modelUrl = getModelUrl(modelName);
        debugLog('Model not cached, downloading from:', modelUrl);
        
        self.postMessage({
            status: "initiate",
            file: modelName,
            name: modelName,
        });
        
        const modelData = await downloadModel(modelUrl, (loaded, total) => {
            const percent = loaded / total;
            debugLog('Download progress update:', (percent * 100).toFixed(2) + '%');
            self.postMessage({
                status: "progress",
                file: modelName,
                loaded: loaded,
                total: total,
                progress: percent,
                name: modelName,
            });
        });
        
        // Save to IndexedDB
        debugLog('Saving downloaded model to cache');
        await saveModelToIndexedDB(modelName, modelData);
        
        self.postMessage({
            status: "done",
            file: modelName,
        });
        
        debugLog('Model ready:', modelName);
        return modelData;
    } catch (error) {
        debugLog('Error in getOrDownloadModel:', error);
        self.postMessage({
            status: "error",
            data: { message: error.message },
        });
        throw error;
    }
}

// Convert Float32Array audio to WAV format
function audioToWav(audioData, sampleRate = 16000) {
    debugLog('audioToWav called');
    debugLog('Audio data length:', audioData.length, 'samples');
    debugLog('Sample rate:', sampleRate, 'Hz');
    debugLog('Duration:', (audioData.length / sampleRate).toFixed(2), 'seconds');
    
    const length = audioData.length;
    const numberOfChannels = 1;
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;
    
    debugLog('WAV buffer size:', bufferSize, 'bytes');
    
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    debugLog('Writing WAV header...');
    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bytesPerSample * 8, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);
    
    // Convert audio data
    debugLog('Converting audio samples to 16-bit PCM...');
    let offset = 44;
    for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, audioData[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
    }
    
    debugLog('WAV conversion complete, buffer size:', arrayBuffer.byteLength);
    return arrayBuffer;
}

// Initialize transcriber (for file transcription)
async function initTranscriber(modelName) {
    debugLog('initTranscriber called for model:', modelName);
    try {
        if (transcriber && currentModelName === modelName) {
            debugLog('Transcriber already initialized with model:', modelName);
            return transcriber; // Already initialized with this model
        }
        
        // Clean up old transcriber if model changed
        if (transcriber && currentModelName !== modelName) {
            debugLog('Model changed, cleaning up old transcriber');
            // Note: FileTranscriber doesn't have a dispose method, but we can set it to null
            transcriber = null;
        }
        
        // Get or download model
        debugLog('Getting/downloading model:', modelName);
        const modelData = await getOrDownloadModel(modelName);
        
        // Import the library
        debugLog('Importing @transcribe/transcriber and @transcribe/shout');
        const { FileTranscriber } = await import("@transcribe/transcriber");
        const createModule = (await import("@transcribe/shout")).default;
        debugLog('Libraries imported successfully');
        
        // Create a blob URL from the model data
        debugLog('Creating blob URL from model data');
        const modelBlob = new Blob([modelData], { type: 'application/octet-stream' });
        const modelUrl = URL.createObjectURL(modelBlob);
        debugLog('Model blob URL created:', modelUrl.substring(0, 50) + '...');

        // Create transcriber instance
        debugLog('Creating FileTranscriber instance');
        transcriber = new FileTranscriber({
            createModule,
            model: modelUrl
        });
        debugLog('FileTranscriber instance created');

        // Initialize
        debugLog('Initializing transcriber...');
        await transcriber.init();
        debugLog('Transcriber initialized successfully');
        
        currentModelName = modelName;
        
        self.postMessage({
            status: "ready",
        });
        
        return transcriber;
    } catch (error) {
        debugLog('Transcriber initialization failed:', error);
        debugLog('Error stack:', error.stack);
        self.postMessage({
            status: "error",
            data: { message: `Transcriber initialization failed: ${error.message}` },
        });
        throw error;
    }
}

// Initialize stream transcriber (for live streaming)
async function initStreamTranscriber(modelName) {
    debugLog('initStreamTranscriber called for model:', modelName);
    try {
        if (streamTranscriber && currentModelName === modelName) {
            debugLog('StreamTranscriber already initialized with model:', modelName);
            return streamTranscriber;
        }
        
        // Clean up old stream transcriber if model changed
        if (streamTranscriber && currentModelName !== modelName) {
            debugLog('Model changed, cleaning up old stream transcriber');
            streamTranscriber = null;
        }
        
        // Get or download model
        debugLog('Getting/downloading model for streaming:', modelName);
        const modelData = await getOrDownloadModel(modelName);
        
        // Import the library
        debugLog('Importing StreamTranscriber from @transcribe/transcriber');
        const { StreamTranscriber } = await import("@transcribe/transcriber");
        const createModule = (await import("@transcribe/shout")).default;
        debugLog('StreamTranscriber imported successfully');
        
        // Create a blob URL from the model data
        debugLog('Creating blob URL from model data for streaming');
        const modelBlob = new Blob([modelData], { type: 'application/octet-stream' });
        const modelUrl = URL.createObjectURL(modelBlob);
        debugLog('Model blob URL created for streaming');

        // Create stream transcriber instance with callbacks
        debugLog('Creating StreamTranscriber instance with callbacks');
        streamTranscriber = new StreamTranscriber({
            createModule,
            model: modelUrl,
            onReady: () => {
                debugLog('StreamTranscriber ready callback fired');
                self.postMessage({
                    status: "ready",
                });
            },
            onStreamStatus: (status) => {
                debugLog('Stream status update:', status);
                self.postMessage({
                    status: "stream_status",
                    data: { status: status },
                });
            },
            onSegment: (segment) => {
                debugLog('New segment received:', segment);
                debugLog('Segment type:', typeof segment);
                debugLog('Segment keys:', segment ? Object.keys(segment) : 'null');
                debugLog('Segment text:', segment?.text);
                debugLog('Full segment object:', JSON.stringify(segment, null, 2));
                
                // Extract segment data
                const segmentData = segment.segment || segment;
                const result = segment.result || {};
                const text = segmentData.text || segment.text || '';
                const timestamps = segmentData.timestamps || segment.timestamps || {};
                
                debugLog('Extracted segment data:', {
                    text,
                    timestamps,
                    language: result.language
                });
                
                // Convert to chunks format
                const chunks = [];
                if (text) {
                    const startTime = parseFloat(timestamps.from) || 0;
                    const endTime = parseFloat(timestamps.to) || null;
                    
                    chunks.push({
                        text: text.trim(),
                        timestamp: [startTime, endTime]
                    });
                }
                
                // Send streaming update
                const fullText = chunks.map(c => c.text).join(' ');
                debugLog('Sending streaming update, text:', fullText);
                
                self.postMessage({
                    status: "update",
                    task: "automatic-speech-recognition",
                    data: [
                        fullText,
                        { chunks: chunks }
                    ],
                });
            }
        });
        debugLog('StreamTranscriber instance created');

        // Initialize
        debugLog('Initializing StreamTranscriber...');
        await streamTranscriber.init();
        debugLog('StreamTranscriber initialized successfully');
        
        currentModelName = modelName;
        
        return streamTranscriber;
    } catch (error) {
        debugLog('StreamTranscriber initialization failed:', error);
        debugLog('Error stack:', error.stack);
        self.postMessage({
            status: "error",
            data: { message: `StreamTranscriber initialization failed: ${error.message}` },
        });
        throw error;
    }
}

// Transcribe audio (file-based, non-streaming)
async function transcribe(audioData, modelName) {
    debugLog('transcribe called, audioData length:', audioData.length, 'samples');
    try {
        // Initialize transcriber if needed
        if (!transcriber || currentModelName !== modelName) {
            debugLog('Initializing transcriber for file transcription');
            await initTranscriber(modelName);
        }
        
        // Convert Float32Array to WAV
        debugLog('Converting audio to WAV format');
        const wavData = audioToWav(audioData, 16000);
        debugLog('WAV data size:', wavData.byteLength, 'bytes');
        const wavBlob = new Blob([wavData], { type: 'audio/wav' });
        const fileURL = URL.createObjectURL(wavBlob);
        debugLog('WAV blob URL created:', fileURL.substring(0, 50) + '...');
        
        // Perform transcription
        debugLog('Starting transcription...');
        const transcriptionResult = await transcriber.transcribe(fileURL);
        debugLog('Transcription complete, result:', transcriptionResult);
        debugLog('Transcription segments:', transcriptionResult.transcription?.length || 0);
        
        // Clean up
        URL.revokeObjectURL(fileURL);
        debugLog('Blob URL revoked');
        
        // Convert GGML format to expected format
        const chunks = [];
        let fullText = "";
        
        if (transcriptionResult.transcription && transcriptionResult.transcription.length > 0) {
            debugLog('Processing', transcriptionResult.transcription.length, 'segments');
            transcriptionResult.transcription.forEach((segment, index) => {
                const text = segment.text.trim();
                if (text) {
                    fullText += (fullText ? " " : "") + text;
                    
                    // Convert timestamps
                    const startTime = parseFloat(segment.timestamps.from) || 0;
                    const endTime = parseFloat(segment.timestamps.to) || null;
                    
                    chunks.push({
                        text: text,
                        timestamp: [startTime, endTime]
                    });
                    
                    debugLog('Segment', index + 1, ':', text.substring(0, 50) + '...', `[${startTime}s - ${endTime}s]`);
                }
            });
        }
        
        debugLog('Transcription result - Full text length:', fullText.length, 'chunks:', chunks.length);
        return {
            text: fullText,
            chunks: chunks
        };
    } catch (error) {
        debugLog('Transcription error:', error);
        debugLog('Error stack:', error.stack);
        self.postMessage({
            status: "error",
            data: { message: `Transcription failed: ${error.message}` },
        });
        throw error;
    }
}

// Start streaming transcription (chunk-based)
async function startStreaming(modelName, options = {}) {
    debugLog('startStreaming called');
    debugLog('Model:', modelName);
    debugLog('Options:', options);
    
    try {
        // Initialize transcriber if needed
        if (!transcriber || currentModelName !== modelName) {
            debugLog('Initializing transcriber for streaming');
            await initTranscriber(modelName);
        }
        
        if (!transcriber) {
            throw new Error('Transcriber not initialized');
        }
        
        isStreaming = true;
        streamingChunks = [];
        debugLog('Starting chunk-based stream transcription...');
        
        // Process accumulated chunks every 2 seconds
        streamingInterval = setInterval(async () => {
            debugLog('Streaming interval tick, chunks:', streamingChunks.length, 'isStreaming:', isStreaming);
            if (streamingChunks.length > 0 && isStreaming) {
                // Calculate total duration
                const totalSamples = streamingChunks.reduce((sum, chunk) => sum + chunk.length, 0);
                const duration = totalSamples / 16000;
                debugLog('Total accumulated audio:', duration.toFixed(2), 'seconds');
                
                // Process if we have at least 1.5 seconds of audio
                if (duration >= 1.5) {
                    await processStreamingChunks(modelName);
                } else {
                    debugLog('Not enough audio yet, waiting for more chunks...');
                }
            } else {
                debugLog('Skipping processing - no chunks or not streaming');
            }
        }, 2000); // Process every 2 seconds
        
        self.postMessage({
            status: "stream_started",
        });
        
    } catch (error) {
        debugLog('Stream start error:', error);
        debugLog('Error stack:', error.stack);
        isStreaming = false;
        self.postMessage({
            status: "error",
            data: { message: `Stream start failed: ${error.message}` },
        });
        throw error;
    }
}

// Add audio chunk to streaming buffer
function addStreamingChunk(audioData) {
    if (isStreaming) {
        if (!audioData || audioData.length === 0) {
            debugLog('WARNING: Received empty audio chunk');
            return;
        }
        
        // Convert array back to Float32Array if needed
        const float32Audio = audioData instanceof Float32Array 
            ? audioData 
            : new Float32Array(audioData);
        
        streamingChunks.push(float32Audio);
        const totalSamples = streamingChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const duration = totalSamples / 16000;
        debugLog('Added streaming chunk, total chunks:', streamingChunks.length, 'total duration:', duration.toFixed(2), 's', 'chunk type:', audioData.constructor.name);
        
        // Keep only last 5 seconds of audio (to prevent memory buildup)
        const SAMPLING_RATE = 16000; // Default sampling rate
        const maxSamples = SAMPLING_RATE * 5;
        let totalSamplesCheck = 0;
        for (let i = streamingChunks.length - 1; i >= 0; i--) {
            totalSamplesCheck += streamingChunks[i].length;
            if (totalSamplesCheck > maxSamples) {
                streamingChunks = streamingChunks.slice(i + 1);
                debugLog('Trimmed streaming chunks, kept last 5 seconds');
                break;
            }
        }
    } else {
        debugLog('WARNING: Received stream_chunk but isStreaming is false!');
    }
}

// Process accumulated streaming chunks
async function processStreamingChunks(modelName) {
    if (streamingChunks.length === 0 || !isStreaming) return;
    
    try {
        debugLog('Processing streaming chunks:', streamingChunks.length);
        
        // Combine chunks
        const totalLength = streamingChunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedAudio = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of streamingChunks) {
            combinedAudio.set(chunk, offset);
            offset += chunk.length;
        }
        
        debugLog('Combined audio length:', totalLength, 'samples, duration:', (totalLength / 16000).toFixed(2), 's');
        
        // Transcribe the accumulated audio
        const result = await transcribe(combinedAudio, modelName);
        
        debugLog('Streaming transcription result:', result.text);
        
        // Send streaming update
        self.postMessage({
            status: "update",
            task: "automatic-speech-recognition",
            data: [
                result.text,
                { chunks: result.chunks }
            ],
        });
        
        // Clear processed chunks but keep last 0.5 seconds for continuity
        const samplesToKeep = 16000 * 0.5; // 0.5 seconds
        if (combinedAudio.length > samplesToKeep) {
            const keepFrom = combinedAudio.length - samplesToKeep;
            streamingChunks = [combinedAudio.slice(keepFrom)];
        } else {
            streamingChunks = [];
        }
        
    } catch (error) {
        debugLog('Error processing streaming chunks:', error);
    }
}

// Stop streaming transcription
async function stopStreaming() {
    debugLog('stopStreaming called');
    try {
        if (streamingInterval) {
            clearInterval(streamingInterval);
            streamingInterval = null;
        }
        
        // Process any remaining chunks
        if (streamingChunks.length > 0 && transcriber) {
            const modelName = currentModelName || "tiny.en";
            await processStreamingChunks(modelName);
        }
        
        isStreaming = false;
        streamingChunks = [];
        
        self.postMessage({
            status: "stream_stopped",
        });
    } catch (error) {
        debugLog('Stream stop error:', error);
        self.postMessage({
            status: "error",
            data: { message: `Stream stop failed: ${error.message}` },
        });
    }
}

// Listen for messages from main thread
self.addEventListener("message", async (event) => {
    try {
        const message = event.data;
        
        // Handle test ping - respond immediately without any processing
        if (message && message.action === 'ping') {
            console.log('[GGML Worker] Ping received, responding with pong');
            self.postMessage({ status: 'pong', data: { message: 'Worker is alive!', timestamp: Date.now() } });
            return;
        }
    
        // Direct console.log for immediate visibility
        console.log('[GGML Worker] Message received from main thread:', message);
        console.log('[GGML Worker] Message type/action:', message.action || 'transcribe');
        
        debugLog('Message received from main thread:', message);
        debugLog('Message type/action:', message.action || 'transcribe');
        debugLog('Full message data:', JSON.stringify(message, null, 2));
        // Determine model name (default to tiny.en)
        const modelName = message.model || "tiny.en";
        debugLog('Using model:', modelName);
        
        // Handle different message types
        if (message.action === 'start_stream') {
            console.log('[GGML Worker] start_stream action received');
            debugLog('Starting stream transcription');
            await startStreaming(modelName, message.options || {});
        } else if (message.action === 'stop_stream') {
            debugLog('Stopping stream transcription');
            await stopStreaming();
        } else if (message.action === 'stream_chunk') {
            // Add audio chunk to streaming buffer
            console.log('[GGML Worker] stream_chunk received, length:', message.audio?.length, 'isStreaming:', isStreaming);
            debugLog('Received streaming chunk, length:', message.audio?.length, 'isStreaming:', isStreaming);
            if (!isStreaming) {
                console.log('[GGML Worker] WARNING: Received stream_chunk but isStreaming is false! Starting stream...');
                debugLog('WARNING: Received stream_chunk but isStreaming is false! Starting stream...');
                await startStreaming(modelName);
            }
            addStreamingChunk(message.audio);
        } else {
            // Default: file-based transcription
            debugLog('Starting file-based transcription');
            debugLog('Audio data type:', typeof message.audio);
            debugLog('Audio data length:', message.audio?.length);
            
            // Transcribe audio
            const result = await transcribe(message.audio, modelName);
            debugLog('Transcription result ready, sending to main thread');
            
            // Send update message (for partial results)
            debugLog('Sending update message');
            self.postMessage({
                status: "update",
                task: "automatic-speech-recognition",
                data: [
                    result.text,
                    { chunks: result.chunks }
                ],
            });
            
            // Send complete message
            debugLog('Sending complete message');
            self.postMessage({
                status: "complete",
                task: "automatic-speech-recognition",
                data: {
                    text: result.text,
                    chunks: result.chunks
                },
            });
            debugLog('Transcription complete, all messages sent');
        }
    } catch (error) {
        console.error('[GGML Worker] Error processing message:', error);
        console.error('[GGML Worker] Error stack:', error.stack);
        debugLog('Error processing message:', error);
        debugLog('Error stack:', error.stack);
        self.postMessage({
            status: "error",
            task: "automatic-speech-recognition",
            data: { message: error.message },
        });
    }
});

// Add error handler for uncaught errors
self.addEventListener('error', (event) => {
    console.error('[GGML Worker] Uncaught error:', event.error);
    console.error('[GGML Worker] Error message:', event.message);
    console.error('[GGML Worker] Error filename:', event.filename);
    console.error('[GGML Worker] Error lineno:', event.lineno);
});

// Add error handler for unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
    console.error('[GGML Worker] Unhandled promise rejection:', event.reason);
});
