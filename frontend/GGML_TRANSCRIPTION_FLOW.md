# GGML Transcription Code Flow

This document explains the complete code flow for GGML (Whisper.cpp) transcription using StreamTranscriber.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MAIN THREAD (React)                       │
│                                                              │
│  TeacherPollRoom → AudioManager → useGGMLStreaming          │
│                                                              │
│  • UI Components                                             │
│  • MediaStream Capture                                       │
│  • StreamTranscriber API (High-level)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ MediaStream
                            ▼
┌─────────────────────────────────────────────────────────────┐
│         StreamTranscriber (Internal Architecture)           │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  AudioWorklet (Main Thread)                        │    │
│  │  • vad.js - Voice Activity Detection              │    │
│  │  • buffer.js - Audio Buffering                    │    │
│  │  • Extracts PCM from MediaStream                  │    │
│  └────────────────────────────────────────────────────┘    │
│                            │                                 │
│                            │ Float32Array (PCM)              │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Internal Web Worker (Spawned by StreamTranscriber)│    │
│  │  • Loads WASM (shout.wasm.js)                      │    │
│  │  • Runs GGML Whisper.cpp                           │    │
│  │  • Token decoding                                   │    │
│  │  • Spectrogram processing                          │    │
│  └────────────────────────────────────────────────────┘    │
│                            │                                 │
│                            │ Transcription Segments          │
│                            ▼                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Callbacks (Main Thread)                            │    │
│  │  • onSegment(text, timestamps)                      │    │
│  │  • onStreamStatus(status)                           │    │
│  │  • onVoiceActivity(active)                          │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Detailed Code Flow

### 1. Initial Setup (User Selects GGML)

**File:** `TeacherPollRoom.tsx`

```typescript
// User selects "GGML" from dropdown
<Select onValueChange={(value) => {
    if (value === "ggml") {
        setUseWhisper(false);
        setUseWhisperGGML(true);
        transcriber.setTranscriberType("ggml");
    }
}}>
```

**Flow:**
- Sets `useWhisperGGML = true`
- Sets `transcriberType = "ggml"`
- Enables `enableLiveTranscription` prop in AudioManager

---

### 2. AudioManager Initialization

**File:** `AudioManager.tsx` → `InlineStreamingRecorder`

```typescript
// Detects GGML mode
const isGGML = props.transcriber.transcriberType === "ggml";

// Initializes useGGMLStreaming hook
const ggmlStreaming = useGGMLStreaming(
    (segment) => {
        // Callback when transcription segment is received
        // Converts segment format and updates transcript
    },
    (loaded, total) => {
        // Progress callback for model download
    }
);
```

**Flow:**
- Creates `useGGMLStreaming` hook instance
- Sets up segment callback handler
- Sets up progress callback for model download

---

### 3. User Clicks Mic Button → startRecording()

**File:** `AudioManager.tsx` → `InlineStreamingRecorder.startRecording()`

```typescript
const startRecording = async () => {
    // Step 1: Request microphone access
    streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, ... }
    });
    
    // Step 2: Create AudioContext for waveform visualization
    audioContextRef.current = new AudioContext({ sampleRate: 16000 });
    
    // Step 3: Create analyser for waveform (visual only)
    analyserRef.current = audioContextRef.current.createAnalyser();
    source.connect(analyserRef.current);
    
    // Step 4: For GGML - NO ScriptProcessor (StreamTranscriber handles audio)
    // For non-GGML - Create ScriptProcessor to send chunks to worker
    
    // Step 5: Initialize and start GGML streaming
    if (isGGML && streamRef.current) {
        const modelName = props.transcriber.model || "tiny.en";
        
        // Initialize StreamTranscriber
        await ggmlStreaming.initStreamTranscriber(modelName);
        
        // Start streaming with MediaStream
        await ggmlStreaming.startStreaming(streamRef.current, {
            lang: "en",
            suppress_non_speech: true,
            max_tokens: 16,
            preRecordsMs: 200,
            maxRecordMs: 5000,
            minSilenceMs: 500,
            onVoiceActivity: (active) => { ... }
        });
    }
};
```

**Flow:**
1. Requests microphone → `MediaStream`
2. Creates `AudioContext` for visualization
3. Skips `ScriptProcessor` for GGML (StreamTranscriber handles audio internally)
4. Calls `initStreamTranscriber()` to load model
5. Calls `startStreaming()` with `MediaStream`

---

### 4. Model Initialization

**File:** `useGGMLStreaming.ts` → `initStreamTranscriber()`

```typescript
const initStreamTranscriber = async (modelName: string) => {
    // Step 1: Check IndexedDB cache
    const cachedModel = await getModelFromIndexedDB(modelName);
    
    if (!cachedModel) {
        // Step 2: Download model from HuggingFace
        const modelUrl = `https://huggingface.co/.../ggml-${modelName}.bin`;
        const modelData = await downloadModel(modelUrl, onProgress);
        
        // Step 3: Save to IndexedDB cache
        await saveModelToIndexedDB(modelName, modelData);
    }
    
    // Step 4: Import StreamTranscriber library
    const { StreamTranscriber } = await import("@transcribe/transcriber");
    const createModule = (await import("@transcribe/shout")).default;
    
    // Step 5: Create blob URL from model data
    const modelBlob = new Blob([modelData], { type: "application/octet-stream" });
    const modelUrl = URL.createObjectURL(modelBlob);
    
    // Step 6: Create StreamTranscriber instance
    streamTranscriberRef.current = new StreamTranscriber({
        createModule,           // WASM module creator
        model: modelUrl,        // Model blob URL
        audioWorkletPath: "/audio-worklets",  // Path to worklet scripts
        onReady: () => { setIsReady(true); },
        onStreamStatus: (status) => { setStreamStatus(status); },
        onSegment: (segment) => { onSegmentCallback(segment); }
    });
    
    // Step 7: Initialize (loads WASM, worklets, model)
    await streamTranscriberRef.current.init();
};
```

**Flow:**
1. **Cache Check:** Checks IndexedDB for cached model
2. **Download:** If not cached, downloads from HuggingFace with progress tracking
3. **Cache Save:** Saves downloaded model to IndexedDB
4. **Library Import:** Dynamically imports `@transcribe/transcriber` and `@transcribe/shout`
5. **Blob Creation:** Creates blob URL from model binary data
6. **Instance Creation:** Creates `StreamTranscriber` with callbacks
7. **Initialization:** Calls `init()` which:
   - Loads WASM module (`shout.wasm.js`)
   - Loads AudioWorklet scripts (`vad.js`, `buffer.js`)
   - Loads GGML model into WASM memory
   - Spawns internal Web Worker for computation

---

### 5. StreamTranscriber.init() Internal Flow

**Library:** `@transcribe/transcriber` → `StreamTranscriber.js`

```javascript
async init() {
    // Step 1: Create AudioContext for streaming
    this._streamAudioContext = new AudioContext({ sampleRate: 16000 });
    
    // Step 2: Load AudioWorklet scripts
    await this._streamAudioContext.audioWorklet.addModule(
        this.getAudioWorkletPath("vad.js")    // Voice Activity Detection
    );
    await this._streamAudioContext.audioWorklet.addModule(
        this.getAudioWorkletPath("buffer.js")  // Audio Buffering
    );
    
    // Step 3: Initialize WASM module (shout.wasm.js)
    // This spawns an internal Web Worker
    
    // Step 4: Load GGML model into WASM memory
    
    // Step 5: Call onReady callback
    this._onReady();
}
```

**Flow:**
1. Creates `AudioContext` for audio processing
2. Loads AudioWorklet processors:
   - `vad.js` - Detects voice activity
   - `buffer.js` - Buffers audio chunks
3. Initializes WASM module (spawns internal worker)
4. Loads model into WASM memory
5. Fires `onReady` callback

---

### 6. Starting Stream Transcription

**File:** `useGGMLStreaming.ts` → `startStreaming()`

```typescript
const startStreaming = async (audioStream: MediaStream, options) => {
    // Step 1: Start StreamTranscriber with options
    await streamTranscriberRef.current.start({
        lang: "en",
        suppress_non_speech: true,
        max_tokens: 16
    });
    
    // Step 2: Begin transcribing the MediaStream
    await streamTranscriberRef.current.transcribe(audioStream, {
        preRecordsMs: 200,      // Keep 200ms before speech
        maxRecordMs: 5000,      // Max 5 seconds per chunk
        minSilenceMs: 500,      // Wait 500ms of silence
        onVoiceActivity: (active) => {
            setVoiceActivity(active);
            onVoiceActivity?.(active);
        }
    });
};
```

**Flow:**
1. Calls `streamTranscriber.start()` with language/options
2. Calls `streamTranscriber.transcribe(mediaStream, options)`
3. StreamTranscriber internally:
   - Creates AudioWorklet nodes
   - Connects MediaStream to AudioWorklet
   - Extracts PCM audio data
   - Sends to internal worker for processing

---

### 7. Audio Processing (Internal to StreamTranscriber)

**Library:** `@transcribe/transcriber` → Internal AudioWorklet Processing

```
MediaStream
    │
    ▼
AudioWorklet (vad.js)
    │ • Detects voice activity
    │ • Filters silence
    │
    ▼
AudioWorklet (buffer.js)
    │ • Buffers audio chunks
    │ • Converts to Float32Array (PCM)
    │
    ▼
Internal Web Worker
    │ • Receives PCM data
    │ • Processes with WASM (GGML)
    │ • Runs Whisper.cpp inference
    │ • Decodes tokens to text
    │
    ▼
onSegment Callback (Main Thread)
    │ • Receives { text, timestamps, result }
    │
    ▼
useGGMLStreaming.onSegmentCallback
```

**Flow:**
1. **AudioWorklet (vad.js):** Detects voice activity, filters silence
2. **AudioWorklet (buffer.js):** Buffers audio, converts to PCM (Float32Array)
3. **Internal Worker:** Receives PCM, processes with WASM/GGML
4. **Whisper.cpp:** Runs inference, generates tokens
5. **Decoding:** Converts tokens to text with timestamps
6. **Callback:** Fires `onSegment` with transcription result

---

### 8. Receiving Transcription Segments

**File:** `useGGMLStreaming.ts` → `onSegment` callback

```typescript
onSegment: (segment: any) => {
    // Convert segment format
    const convertedSegment = {
        segment: {
            text: segment.text,
            timestamps: {
                from: parseFloat(segment.timestamps.from),
                to: parseFloat(segment.timestamps.to)
            }
        },
        result: segment.result
    };
    
    // Call user-provided callback
    onSegmentCallback(convertedSegment);
}
```

**Flow:**
- Receives segment from StreamTranscriber
- Converts format (handles string/number timestamps)
- Calls `onSegmentCallback` (provided by AudioManager)

---

### 9. Updating UI with Transcription

**File:** `AudioManager.tsx` → Segment handler

```typescript
const ggmlStreaming = useGGMLStreaming(
    (segment) => {
        const segmentData = segment.segment || segment;
        const text = segmentData.text || segment.text || '';
        const timestamps = segmentData.timestamps || segment.timestamps || {};
        
        // Convert to chunks format
        const chunks = [{
            text: text.trim(),
            timestamp: [fromTime, toTime]
        }];
        
        // Update transcript (NOT via start() which expects AudioBuffer)
        props.transcriber.updateTranscript(text.trim(), chunks);
    }
);
```

**File:** `useTranscriber.ts` → `updateTranscript()`

```typescript
const updateTranscript = (text: string, chunks) => {
    // Update accumulated chunks in live mode
    if (isLiveMode) {
        setAccumulatedChunks((prev) => [...prev, ...uniqueNewChunks]);
        accumulatedTextRef.current = text;
    }
    
    // Update transcript state
    setTranscript({
        isBusy: false,
        text: text,
        chunks: chunks
    });
};
```

**Flow:**
1. Segment received → Extract text and timestamps
2. Convert to chunks format
3. Call `transcriber.updateTranscript()` (NOT `start()`)
4. Updates `transcript` state in `useTranscriber`
5. React re-renders → UI shows transcription

---

### 10. Stopping Transcription

**File:** `AudioManager.tsx` → `stopRecording()`

```typescript
const stopRecording = async () => {
    if (isGGML && streamingStartedRef.current) {
        // Stop StreamTranscriber
        await ggmlStreaming.stopStreaming();
    }
    
    // Stop MediaStream tracks
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Cleanup AudioContext
    if (audioContextRef.current) {
        await audioContextRef.current.close();
    }
};
```

**File:** `useGGMLStreaming.ts` → `stopStreaming()`

```typescript
const stopStreaming = async () => {
    if (streamTranscriberRef.current) {
        await streamTranscriberRef.current.stop();
    }
    setStreamStatus("stopped");
    setVoiceActivity(false);
};
```

**Flow:**
1. Calls `streamTranscriber.stop()`
2. Stops AudioWorklet processing
3. Stops MediaStream tracks
4. Cleans up AudioContext
5. Updates UI state

---

## Key Differences: GGML vs Xenova

| Aspect | GGML (StreamTranscriber) | Xenova (Worker-based) |
|--------|-------------------------|----------------------|
| **Audio Capture** | AudioWorklet (internal) | ScriptProcessor (manual) |
| **Audio Processing** | Internal Worker (spawned by library) | External Worker (our worker.js) |
| **Data Format** | MediaStream → Direct | AudioBuffer → Float32Array → Worker |
| **Transcription Output** | Text segments with timestamps | Full text + chunks |
| **UI Updates** | `updateTranscript()` | `start()` with AudioBuffer |
| **Model Loading** | IndexedDB + Blob URL | Worker handles download |
| **Voice Activity** | Built-in (AudioWorklet vad.js) | Manual RMS calculation |

---

## File Structure

```
frontend/
├── src/
│   ├── pages/teacher/
│   │   └── TeacherPollRoom.tsx          # UI, selects GGML mode
│   ├── whisper/components/
│   │   └── AudioManager.tsx              # Audio capture, calls useGGMLStreaming
│   ├── hooks/
│   │   ├── useGGMLStreaming.ts           # High-level StreamTranscriber wrapper
│   │   └── useTranscriber.ts             # Transcript state management
│   └── hooks/
│       └── useWorker.ts                  # NOT used for GGML (StreamTranscriber has own worker)
├── public/
│   ├── audio-worklets/                   # AudioWorklet scripts
│   │   ├── vad.js                        # Voice Activity Detection
│   │   ├── buffer.js                     # Audio Buffering
│   │   └── fft.js                        # FFT for VAD
│   └── shout.wasm.js                     # WASM module (loaded by library)
└── vite.config.ts                        # Vite config (COEP/COOP headers)
```

---

## Important Notes

1. **No ScriptProcessor for GGML:** StreamTranscriber handles audio internally via AudioWorklet
2. **No External Worker:** StreamTranscriber spawns its own internal worker
3. **MediaStream Direct:** Pass MediaStream directly, not AudioBuffer chunks
4. **updateTranscript() not start():** GGML segments use `updateTranscript()`, not `start(AudioBuffer)`
5. **Worklet Files Required:** Must be in `/public/audio-worklets/` with correct names
6. **COEP/COOP Headers:** Required for SharedArrayBuffer (WASM needs it)
7. **Model Caching:** Models are cached in IndexedDB for faster subsequent loads

---

## Debugging Tips

1. **Check worklet loading:** Network tab → Filter "audio-worklets" → Should see 200 OK
2. **Check model download:** Console → Look for "Downloading model" logs
3. **Check segments:** Console → Look for "[useGGMLStreaming] New segment"
4. **Check voice activity:** Console → Look for "[useGGMLStreaming] Voice activity: true/false"
5. **Check stream status:** Console → Look for "[useGGMLStreaming] Stream status: waiting/processing"

---

## Common Issues

1. **"Unable to load a worklet's module"**
   - Check worklet files exist in `/public/audio-worklets/`
   - Check COEP/COOP headers in vite.config.ts
   - Check worklet files are served with correct MIME type

2. **"getChannelData is not a function"**
   - GGML doesn't send AudioBuffer - use `updateTranscript()` not `start()`

3. **No transcription appearing**
   - Check segments are being received (console logs)
   - Check `updateTranscript()` is being called
   - Check transcript state is updating

4. **Model not loading**
   - Check IndexedDB is accessible
   - Check network for model download
   - Check model URL is correct

