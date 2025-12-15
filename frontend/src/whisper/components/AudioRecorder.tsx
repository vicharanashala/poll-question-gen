import { useState, useEffect, useRef } from "react";

import { formatAudioTimestamp } from "../../utils/AudioUtils";
import { webmFixDuration } from "../../utils/BlobFix";
import Constants from "../../utils/Constants";

function getMimeType() {
    const types = [
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
        "audio/wav",
        "audio/aac",
    ];
    for (let i = 0; i < types.length; i++) {
        if (MediaRecorder.isTypeSupported(types[i])) {
            return types[i];
        }
    }
    return undefined;
}

export default function AudioRecorder(props: {
    onRecordingComplete: (blob: Blob) => void;
    onAudioStream?: (audioBuffer: AudioBuffer) => void;
    enableLiveTranscription?: boolean;
    transcribeModel?:string;
}) {
    const [recording, setRecording] = useState(false);
    const [duration, setDuration] = useState(0);
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

    const streamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // For live transcription
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamChunksRef = useRef<Float32Array[]>([]);
    const allStreamChunksRef = useRef<Float32Array[]>([]); // Store all chunks for final processing
    const startRecording = async () => {
        // Reset recording (if any)
        setRecordedBlob(null);
        allStreamChunksRef.current = []; // Reset all chunks

        let startTime = Date.now();

        try {
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });
            }

            // Set up live audio processing if enabled
            if (props.enableLiveTranscription && props.onAudioStream) {
                audioContextRef.current = new AudioContext({
                    sampleRate: Constants.SAMPLING_RATE,
                });
                const source = audioContextRef.current.createMediaStreamSource(streamRef.current);

                // Use ScriptProcessorNode for capturing audio chunks
                const bufferSize = 4096;
                processorRef.current = audioContextRef.current.createScriptProcessor(
                    bufferSize,
                    1,
                    1
                );

                processorRef.current.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const chunk = new Float32Array(inputData);
                    streamChunksRef.current.push(chunk);
                    allStreamChunksRef.current.push(chunk); // Store in all chunks

                    // Process every 3 seconds of audio
                    const totalSamples = streamChunksRef.current.reduce(
                        (sum, arr) => sum + arr.length,
                        0
                    );
                    const samplesFor3Seconds = Constants.SAMPLING_RATE * 3;

                    if (totalSamples >= samplesFor3Seconds) {
                        processStreamChunks();
                    }
                };

                source.connect(processorRef.current);
                processorRef.current.connect(audioContextRef.current.destination);
            }

            const mimeType = getMimeType();
            const mediaRecorder = new MediaRecorder(streamRef.current, {
                mimeType,
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.addEventListener("dataavailable", async (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
                if (mediaRecorder.state === "inactive") {
                    const duration = Date.now() - startTime;

                    // Received a stop event
                    let blob = new Blob(chunksRef.current, { type: mimeType });

                    if (mimeType === "audio/webm") {
                        blob = await webmFixDuration(blob, duration, blob.type);
                    }

                    setRecordedBlob(blob);
                    props.onRecordingComplete(blob);

                    chunksRef.current = [];
                }
            });
            mediaRecorder.start();
            setRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
    };

    const processStreamChunks = async () => {
        if (!props.onAudioStream || streamChunksRef.current.length === 0) return;

        // Combine all chunks into one Float32Array
        const totalLength = streamChunksRef.current.reduce(
            (sum, arr) => sum + arr.length,
            0
        );
        const combinedArray = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of streamChunksRef.current) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
        }
        // Create AudioBuffer from combined array
        const audioBuffer = audioContextRef.current!.createBuffer(
            1,
            combinedArray.length,
            Constants.SAMPLING_RATE
        );
        audioBuffer.getChannelData(0).set(combinedArray);
        // Send to transcriber
        props.onAudioStream(audioBuffer);
        // Clear processed chunks but keep last 0.5 seconds for continuity
        const samplesToKeep = Constants.SAMPLING_RATE * 0.5;
        const keepFrom = Math.max(0, combinedArray.length - samplesToKeep);
        const keepChunk = combinedArray.slice(keepFrom);
        streamChunksRef.current = [keepChunk];
    };

    const processFinalChunks = async () => {
        if (!props.onAudioStream || allStreamChunksRef.current.length === 0) return;
        // Combine ALL chunks (entire recording)
        const totalLength = allStreamChunksRef.current.reduce(
            (sum, arr) => sum + arr.length,
            0
        );
        const combinedArray = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of allStreamChunksRef.current) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
        }
        // Create AudioBuffer from the entire recording
        const audioBuffer = audioContextRef.current!.createBuffer(
            1,
            combinedArray.length,
            Constants.SAMPLING_RATE
        );
        audioBuffer.getChannelData(0).set(combinedArray);
        // Send complete audio to transcriber for final processing
        if(props.transcribeModel!="external-api")
        {
            props.onAudioStream(audioBuffer);
        }
       
    };
    const processRemainingChunks = async () => {
        if (!props.onAudioStream || streamChunksRef.current.length === 0) return;
        
        // Only process the remaining unprocessed audio
        const totalLength = streamChunksRef.current.reduce(
            (sum, arr) => sum + arr.length,
            0
        );
        
        // If there's nothing substantial to process, skip it
        if (totalLength < Constants.SAMPLING_RATE * 0.5) {
            console.log("Remaining audio too short, skipping final transcription");
            return;
        }
        
        const combinedArray = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of streamChunksRef.current) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
        }
        
        // Create AudioBuffer from the remaining audio only
        const audioBuffer = audioContextRef.current!.createBuffer(
            1,
            combinedArray.length,
            Constants.SAMPLING_RATE
        );
        audioBuffer.getChannelData(0).set(combinedArray);
        
        // Send only the remaining portion to transcriber
        if (!props.transcribeModel) {
            props.onAudioStream(audioBuffer);
        }
    };

    const stopRecording = async() => {
        if (
            mediaRecorderRef.current &&
            mediaRecorderRef.current.state === "recording"
        ) {
            mediaRecorderRef.current.stop();
            setDuration(0);
            setRecording(false);
            // Process any remaining chunks before cleanup
            if (props.enableLiveTranscription) {
               // await processFinalChunks();
                await processRemainingChunks();
            }
            // Clean up audio processing
            if (processorRef.current) {
                processorRef.current.disconnect();
                processorRef.current = null;
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
                audioContextRef.current = null;
            }
            streamChunksRef.current = [];
            allStreamChunksRef.current = []; // Clear all chunks
        }
    };

    useEffect(() => {
        if (recording) {
            const timer = setInterval(() => {
                setDuration((prevDuration) => prevDuration + 1);
            }, 1000);

            return () => {
                clearInterval(timer);
            };
        }
    }, [recording]);

    const handleToggleRecording = () => {
        if (recording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <div className='flex flex-col justify-center items-center'>
            <button
                type='button'
                className={`m-2 inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all duration-200 ${recording
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-green-500 hover:bg-green-600"
                    }`}
                onClick={handleToggleRecording}
            >
                {recording
                    ? `Stop Recording (${formatAudioTimestamp(duration)})`
                    : "Start Recording"}
            </button>
            {props.enableLiveTranscription && recording && (
                <div className="text-xs text-purple-600 dark:text-purple-400 animate-pulse">
                    Live transcription active...
                </div>
            )}

            {recordedBlob && (
                <audio className='w-full' ref={audioRef} controls>
                    <source
                        src={URL.createObjectURL(recordedBlob)}
                        type={recordedBlob.type}
                    />
                </audio>
            )}
        </div>
    );
}
