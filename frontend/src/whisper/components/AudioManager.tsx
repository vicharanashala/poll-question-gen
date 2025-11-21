import React, { JSX, useEffect, useState, useRef } from "react";
import axios, { AxiosResponse } from "axios";
import Modal from "./modal/Modal";
import { UrlInput } from "./modal/UrlInput";
import AudioPlayer from "./AudioPlayer";
import Constants from "../../utils/Constants";
import { Transcriber } from "../../hooks/useTranscriber";
import AudioRecorder from "./AudioRecorder";
import api from "@/lib/api/api";
import { useGGMLStreaming } from "../../hooks/useGGMLStreaming";
//import { t } from "node_modules/framer-motion/dist/types.d-D0HXPxHm";

// List of supported languages:
// https://help.openai.com/en/articles/7031512-whisper-api-faq
// https://github.com/openai/whisper/blob/248b6cb124225dd263bb9bd32d060b6517e067f8/whisper/tokenizer.py#L79
/*
const LANGUAGES = {
    en: "english",
    zh: "chinese",
    de: "german",
    es: "spanish/castilian",
    ru: "russian",
    ko: "korean",
    fr: "french",
    ja: "japanese",
    pt: "portuguese",
    tr: "turkish",
    pl: "polish",
    ca: "catalan/valencian",
    nl: "dutch/flemish",
    ar: "arabic",
    sv: "swedish",
    it: "italian",
    id: "indonesian",
    hi: "hindi",
    fi: "finnish",
    vi: "vietnamese",
    he: "hebrew",
    uk: "ukrainian",
    el: "greek",
    ms: "malay",
    cs: "czech",
    ro: "romanian/moldavian/moldovan",
    da: "danish",
    hu: "hungarian",
    ta: "tamil",
    no: "norwegian",
    th: "thai",
    ur: "urdu",
    hr: "croatian",
    bg: "bulgarian",
    lt: "lithuanian",
    la: "latin",
    mi: "maori",
    ml: "malayalam",
    cy: "welsh",
    sk: "slovak",
    te: "telugu",
    fa: "persian",
    lv: "latvian",
    bn: "bengali",
    sr: "serbian",
    az: "azerbaijani",
    sl: "slovenian",
    kn: "kannada",
    et: "estonian",
    mk: "macedonian",
    br: "breton",
    eu: "basque",
    is: "icelandic",
    hy: "armenian",
    ne: "nepali",
    mn: "mongolian",
    bs: "bosnian",
    kk: "kazakh",
    sq: "albanian",
    sw: "swahili",
    gl: "galician",
    mr: "marathi",
    pa: "punjabi/panjabi",
    si: "sinhala/sinhalese",
    km: "khmer",
    sn: "shona",
    yo: "yoruba",
    so: "somali",
    af: "afrikaans",
    oc: "occitan",
    ka: "georgian",
    be: "belarusian",
    tg: "tajik",
    sd: "sindhi",
    gu: "gujarati",
    am: "amharic",
    yi: "yiddish",
    lo: "lao",
    uz: "uzbek",
    fo: "faroese",
    ht: "haitian creole/haitian",
    ps: "pashto/pushto",
    tk: "turkmen",
    nn: "nynorsk",
    mt: "maltese",
    sa: "sanskrit",
    lb: "luxembourgish/letzeburgesch",
    my: "myanmar/burmese",
    bo: "tibetan",
    tl: "tagalog",
    mg: "malagasy",
    as: "assamese",
    tt: "tatar",
    haw: "hawaiian",
    ln: "lingala",
    ha: "hausa",
    ba: "bashkir",
    jw: "javanese",
    su: "sundanese",
};
*/
export enum AudioSource {
    URL = "URL",
    FILE = "FILE",
    RECORDING = "RECORDING",
}

export function AudioManager(props: {
    transcriber: Transcriber;
    enableLiveTranscription?: boolean;
    onLiveRecordingStart?: () => void;  
    onLiveRecordingStop?: () => void;
    onVoiceActivityChange?: (active: boolean) => void;
}) {
    const [progress, setProgress] = useState<number | undefined>(undefined);
    const [audioData, setAudioData] = useState<
        | {
            buffer: AudioBuffer;
            url: string;
            source: AudioSource;
            mimeType: string;
        }
        | undefined
    >(undefined);
    const [audioDownloadUrl, setAudioDownloadUrl] = useState<
        string | undefined
    >(undefined);
    const [isLiveRecording, setIsLiveRecording] = useState(false);

    const isAudioLoading = progress !== undefined;
    const [isProcessing, setIsProcessing] = useState(false);

    const resetAudio = () => {
        setAudioData(undefined);
        setAudioDownloadUrl(undefined);
        setIsLiveRecording(false);
    };

    const setAudioFromDownload = async (
        data: ArrayBuffer,
        mimeType: string,
    ) => {
        const audioCTX = new AudioContext({
            sampleRate: Constants.SAMPLING_RATE,
        });
        const blobUrl = URL.createObjectURL(
            new Blob([data], { type: "audio/*" }),
        );
        const decoded = await audioCTX.decodeAudioData(data);
        setAudioData({
            buffer: decoded,
            url: blobUrl,
            source: AudioSource.URL,
            mimeType: mimeType,
        });
        setIsProcessing(true);
        props.transcriber.start(decoded);
    };

    const setAudioFromRecording = async (data: Blob) => {
        resetAudio();
        setProgress(0);
        const blobUrl = URL.createObjectURL(data);
        const fileReader = new FileReader();
        fileReader.onprogress = (event) => {
            setProgress(event.loaded / event.total || 0);
        };
        fileReader.onloadend = async () => {
            const audioCTX = new AudioContext({
                sampleRate: Constants.SAMPLING_RATE,
            });
            const arrayBuffer = fileReader.result as ArrayBuffer;
            const decoded = await audioCTX.decodeAudioData(arrayBuffer);
            setProgress(undefined);
            setAudioData({
                buffer: decoded,
                url: blobUrl,
                source: AudioSource.RECORDING,
                mimeType: data.type,
            });
            if (!props.enableLiveTranscription) {
                setIsProcessing(true);
                props.transcriber.start(decoded);
            }
        };
        fileReader.readAsArrayBuffer(data);
    };

    // Handle live audio streaming during recording
    const handleLiveAudioStream = (audioBuffer: AudioBuffer) => {
        setIsLiveRecording(true);
        // Just send the audio buffer - streaming is already started in startRecording
        props.transcriber.start(audioBuffer);
    };

    const downloadAudioFromUrl = async (
        requestAbortController: AbortController,
    ) => {
        if (audioDownloadUrl) {
            try {
                setAudioData(undefined);
                setProgress(0);
                const { data, headers } = (await axios.get(audioDownloadUrl, {
                    signal: requestAbortController.signal,
                    responseType: "arraybuffer",
                    onDownloadProgress(progressEvent) {
                        setProgress(progressEvent.progress || 0);
                    },
                })) as {
                    data: ArrayBuffer;
                    headers: { "content-type": string };
                };

                let mimeType = headers["content-type"];
                if (!mimeType || mimeType === "audio/wave") {
                    mimeType = "audio/wav";
                }
                setAudioFromDownload(data, mimeType);
            } catch (error) {
                console.log("Request failed or aborted", error);
            } finally {
                setProgress(undefined);
            }
        }
    };

    function isYouTubeUrl(url: string): boolean {
        return url.includes("youtube.com") || url.includes("youtu.be");
    }

    const handleYouTubeUrl = async (youtubeUrl: string) => {
        try {
            setAudioData(undefined);
            setProgress(0);

            const response: AxiosResponse<ArrayBuffer> = await api.get<ArrayBuffer>(
                `/livequizzes/rooms/youtube-audio`,
                {
                    params: { url: youtubeUrl },
                    responseType: "arraybuffer",
                    onDownloadProgress(progressEvent) {
                        setProgress(progressEvent.progress || 0);
                    },
                }
            );
            const data = response.data;
            // console.log("YouTube audio data received:", data);
            setProgress(undefined);
            setAudioFromDownload(data, "audio/mp3");
        } catch (err) {
            console.error("Failed to fetch YouTube audio:", err);
            setProgress(undefined);
        }
    };

    // When URL changes, download audio
    useEffect(() => {
        if (audioDownloadUrl) {
            const requestAbortController = new AbortController();
            downloadAudioFromUrl(requestAbortController);
            return () => {
                requestAbortController.abort();
            };
        }
    }, [audioDownloadUrl]);

    useEffect(() => {
        if (!props.transcriber.output?.isBusy) {
            setIsProcessing(false);
        }
    }, [props.transcriber.output?.isBusy]);

    // If live transcription is enabled, show inline streaming UI instead of modal
    if (props.enableLiveTranscription) {
        return (
            <div className="flex flex-col items-center justify-start w-full max-w-2xl mx-auto mt-6 space-y-4 px-4">
                <div className="w-full rounded-lg bg-white dark:bg-slate-800 shadow-md ring-1 ring-slate-300 dark:ring-slate-700 p-4 space-y-4">
                    <div className="flex flex-wrap justify-center items-center gap-4">
                        <FileTile
                            icon={<FolderIcon />}
                            text={"From file"}
                            onFileUpdate={(decoded, blobUrl, mimeType) => {
                                props.transcriber.onInputChange();
                                setAudioData({
                                    buffer: decoded,
                                    url: blobUrl,
                                    source: AudioSource.FILE,
                                    mimeType: mimeType,
                                });
                                setIsProcessing(true);
                                props.transcriber.start(decoded);
                            }}
                        />
                        {navigator.mediaDevices && (
                            <div className="flex flex-col items-center">
                                <InlineStreamingRecorder
                                    onAudioStream={handleLiveAudioStream}
                                    enableLiveTranscription={props.enableLiveTranscription}
                                    onRecordingStart={props.onLiveRecordingStart}
                                    onRecordingStop={props.onLiveRecordingStop}
                                    onVoiceActivityChange={props.onVoiceActivityChange}
                                    transcriber={props.transcriber}
                                />
                            </div>
                        )}
                    </div>
                    {<AudioDataBar progress={isAudioLoading ? progress : +!!audioData} />}
                </div>

                {audioData && (
                    <div className="w-full max-w-xl">
                        <AudioPlayer
                            audioUrl={audioData.url}
                            mimeType={audioData.mimeType}
                        />
                    </div>
                )}

                {(isProcessing || isLiveRecording) && (
                    <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 mt-2">
                        <svg
                            className="animate-spin h-4 w-4 text-purple-600 dark:text-purple-400"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            ></circle>
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v8z"
                            ></path>
                        </svg>
                        <span>
                            {isLiveRecording
                                ? "Live transcription in progress..."
                                : "Processing audio..."}
                        </span>
                    </div>
                )}
            </div>
        );
    }

    // Fallback to modal-based UI when live transcription is disabled
    return (
        <div className="flex flex-col items-center justify-start w-full max-w-2xl mx-auto mt-6 space-y-4 px-4">
            <div className="w-full rounded-lg bg-white dark:bg-slate-800 shadow-md ring-1 ring-slate-300 dark:ring-slate-700 p-4 space-y-4">
                <div className="flex flex-wrap justify-center items-center gap-4">
                    {/* <UrlTile
                        icon={<AnchorIcon />}
                        text={"From URL"}
                        onUrlUpdate={async (e) => {
                            props.transcriber.onInputChange();
                            if (isYouTubeUrl(e)) {
                                await handleYouTubeUrl(e);
                            } else {
                                setAudioDownloadUrl(e);
                            }
                        }}
                    /> */}
                    <FileTile
                        icon={<FolderIcon />}
                        text={"From file"}
                        onFileUpdate={(decoded, blobUrl, mimeType) => {
                            props.transcriber.onInputChange();
                            setAudioData({
                                buffer: decoded,
                                url: blobUrl,
                                source: AudioSource.FILE,
                                mimeType: mimeType,
                            });
                            setIsProcessing(true);
                            props.transcriber.start(decoded);
                        }}
                    />
                    {navigator.mediaDevices && (
                        <RecordTile
                            icon={<MicrophoneIcon />}
                            text={"Record"}
                            setAudioData={(e) => {
                                props.transcriber.onInputChange();
                                setAudioFromRecording(e);
                            }}
                            onAudioStream={
                                props.enableLiveTranscription
                                    ? handleLiveAudioStream
                                    : undefined
                            }
                            enableLiveTranscription={props.enableLiveTranscription}
                            onRecordingStart={props.onLiveRecordingStart}
                            onRecordingStop={props.onLiveRecordingStop}
                        />
                    )}
                </div>

                {<AudioDataBar progress={isAudioLoading ? progress : +!!audioData} />}
            </div>

            {audioData && (
                <div className="w-full max-w-xl">
                    <AudioPlayer
                        audioUrl={audioData.url}
                        mimeType={audioData.mimeType}
                    />
                </div>
            )}

            {(isProcessing || isLiveRecording) && (
                <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 mt-2">
                    <svg
                        className="animate-spin h-4 w-4 text-purple-600 dark:text-purple-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                        ></path>
                    </svg>
                    <span>
                        {isLiveRecording
                            ? "Live transcription in progress..."
                            : "Processing audio..."}
                    </span>
                </div>
            )}
        </div>
    );
}

function AudioDataBar(props: { progress: number }) {
    return <ProgressBar progress={`${Math.round(props.progress * 100)}%`} />;
}

function ProgressBar(props: { progress: string }) {
    return (
        <div className='w-full bg-gray-200 rounded-full h-1 dark:bg-gray-700'>
            <div
                className='bg-blue-600 h-1 rounded-full transition-all duration-100'
                style={{ width: props.progress }}
            ></div>
        </div>
    );
}

function UrlTile(props: {
    icon: JSX.Element;
    text: string;
    onUrlUpdate: (url: string) => void;
}) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <Tile icon={props.icon} text={props.text} onClick={() => setShowModal(true)} />
            <UrlModal
                show={showModal}
                onSubmit={(url) => {
                    props.onUrlUpdate(url);
                    setShowModal(false);
                }}
                onClose={() => setShowModal(false)}
            />
        </>
    );
}

function UrlModal(props: {
    show: boolean;
    onSubmit: (url: string) => void;
    onClose: () => void;
}) {
    const [url, setUrl] = useState(Constants.DEFAULT_AUDIO_URL);

    return (
        <Modal
            show={props.show}
            title={"From URL"}
            content={
                <>
                    {"Enter the URL of the audio file you want to load."}
                    <UrlInput onChange={(e) => setUrl(e.target.value)} value={url} />
                </>
            }
            onClose={props.onClose}
            submitText={"Load"}
            onSubmit={() => props.onSubmit(url)}
        />
    );
}

function FileTile(props: {
    icon: JSX.Element;
    text: string;
    onFileUpdate: (decoded: AudioBuffer, blobUrl: string, mimeType: string) => void;
}) {
    let elem = document.createElement("input");
    elem.type = "file";
    elem.oninput = (event) => {
        let files = (event.target as HTMLInputElement).files;
        if (!files) return;

        const urlObj = URL.createObjectURL(files[0]);
        const mimeType = files[0].type;

        const reader = new FileReader();
        reader.addEventListener("load", async (e) => {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) return;

            const audioCTX = new AudioContext({
                sampleRate: Constants.SAMPLING_RATE,
            });

            const decoded = await audioCTX.decodeAudioData(arrayBuffer);
            props.onFileUpdate(decoded, urlObj, mimeType);
        });
        reader.readAsArrayBuffer(files[0]);
        elem.value = "";
    };

    return <Tile icon={props.icon} text={props.text} onClick={() => elem.click()} />;
}

function RecordTile(props: {
    icon: JSX.Element;
    text: string;
    setAudioData: (data: Blob) => void;
    onAudioStream?: (audioBuffer: AudioBuffer) => void;
    enableLiveTranscription?: boolean;
    onRecordingStart?: () => void;
    onRecordingStop?: () => void;
}) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <Tile icon={props.icon} text={props.text} onClick={() => setShowModal(true)} />
            <RecordModal
                show={showModal}
                onSubmit={(data) => {
                    if (data) {
                        props.setAudioData(data);
                        setShowModal(false);
                    }
                }}
                onClose={() => setShowModal(false)}
                onAudioStream={props.onAudioStream}
                enableLiveTranscription={props.enableLiveTranscription}
                onRecordingStart={props.onRecordingStart}
                onRecordingStop={props.onRecordingStop}
            />
        </>
    );
}

function RecordModal(props: {
    show: boolean;
    onSubmit: (data: Blob | undefined) => void;
    onClose: () => void;
    onAudioStream?: (audioBuffer: AudioBuffer) => void;
    enableLiveTranscription?: boolean;
    onRecordingStart?: () => void;
    onRecordingStop?: () => void;
}) {
    const [audioBlob, setAudioBlob] = useState<Blob>();

    return (
        <Modal
            show={props.show}
            title={"From Recording"}
            content={
                <>
                    {"Record audio using your microphone"}
                    <AudioRecorder
                        onRecordingComplete={setAudioBlob}
                        onAudioStream={props.onAudioStream}
                        enableLiveTranscription={props.enableLiveTranscription}
                        // onRecordingStart={props.onRecordingStart}
                        // onRecordingStop={props.onRecordingStop}  
                    />
                </>
            }
            onClose={() => {
                props.onClose();
                setAudioBlob(undefined);
            }}
            submitText={"Load"}
            submitEnabled={audioBlob !== undefined}
            onSubmit={() => {
                props.onSubmit(audioBlob);
                setAudioBlob(undefined);
            }}
        />
    );
}

function Tile(props: { icon: JSX.Element; text?: string; onClick?: () => void }) {
    return (
        <button
            onClick={props.onClick}
            className='flex items-center justify-center rounded-lg p-2 bg-blue text-slate-500 dark:hover:text-gray-200 hover:text-gray-800 dark:hover:bg-gray-700  hover:bg-gray-100 transition-all duration-200'
        >
            <div className='w-7 h-7'>{props.icon}</div>
            {props.text && (
                <div className='ml-2 break-text text-center text-md w-30'>
                    {props.text}
                </div>
            )}
        </button>
    );
}

function AnchorIcon() {
    return (
        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244' />
        </svg>
    );
}

function FolderIcon() {
    return (
        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='1.5' stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776' />
        </svg>
    );
}

function MicrophoneIcon() {
    return (
        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z' />
        </svg>
    );
}

// Inline streaming recorder component for live transcription
function InlineStreamingRecorder(props: {
    onAudioStream?: (audioBuffer: AudioBuffer) => void;
    enableLiveTranscription?: boolean;
    onRecordingStart?: () => void;
    onRecordingStop?: () => void;
    onVoiceActivityChange?: (active: boolean) => void;
    transcriber: Transcriber;
}) {
    const [recording, setRecording] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const animationFrameRef = useRef<number>(0);
    const [frequencyData, setFrequencyData] = useState<number[]>([]);
    const isRecordingRef = useRef(false);
    const voiceActivityRef = useRef(false);
    const streamingStartedRef = useRef(false);
    const frequencyDataRef = useRef<number[]>([]);
    
    // Use GGML streaming hook when transcriberType is "ggml"
    // StreamTranscriber spawns its own internal worker, so we use it directly on main thread
    const isGGML = props.transcriber.transcriberType === "ggml";
    const ggmlStreaming = useGGMLStreaming(
        (segment) => {
            // Handle segment from StreamTranscriber (same format as app.js)
            const segmentData = segment.segment || segment;
            const text = segmentData.text || segment.text || '';
            const timestamps = segmentData.timestamps || segment.timestamps || {};
            
            if (text) {
                // Convert to transcriber format
                // Handle timestamps - they might be strings or numbers
                const fromTime = timestamps && 'from' in timestamps
                    ? (typeof timestamps.from === 'string' ? parseFloat(timestamps.from) : timestamps.from || 0)
                    : 0;
                const toTime = timestamps && 'to' in timestamps
                    ? (typeof timestamps.to === 'string' ? parseFloat(timestamps.to) : timestamps.to || null)
                    : null;
                
                const chunks = [{
                    text: text.trim(),
                    timestamp: [fromTime, toTime] as [number, number | null]
                }];
                
                // For GGML, update transcript directly (not via start() which expects AudioBuffer)
                // Use updateTranscript method instead
                if (props.transcriber.updateTranscript) {
                    props.transcriber.updateTranscript(text.trim(), chunks);
                } else {
                    // Fallback: update transcript state directly if method doesn't exist
                    console.warn('[InlineStreamingRecorder] updateTranscript method not available, using fallback');
                }
            }
        },
        (loaded, total) => {
            // Progress callback for model download
            const progress = loaded / total;
            console.log('[InlineStreamingRecorder] Model download progress:', (progress * 100).toFixed(2) + '%');
        }
    );
    
    // Only log renders when state actually changes to reduce noise
    const prevRecordingRef = useRef(recording);
    if (prevRecordingRef.current !== recording) {
        console.log('[InlineStreamingRecorder] Recording state changed:', prevRecordingRef.current, '->', recording);
        prevRecordingRef.current = recording;
    }

    const startRecording = async () => {
        console.log('[InlineStreamingRecorder] startRecording called, current state:', {
            isRecording: isRecordingRef.current,
            recording,
            streamingStarted: streamingStartedRef.current,
            hasStream: !!streamRef.current
        });
        
        try {
            if (!streamRef.current) {
                console.log('[InlineStreamingRecorder] Requesting microphone access...');
                streamRef.current = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        sampleRate: 16000,
                        echoCancellation: true,
                        noiseSuppression: true
                    }
                });
                console.log('[InlineStreamingRecorder] Microphone access granted');
            }

            console.log('[InlineStreamingRecorder] Creating AudioContext...');
            audioContextRef.current = new AudioContext({
                sampleRate: Constants.SAMPLING_RATE,
            });
            
            // Resume audio context (required by browsers after user interaction)
            if (audioContextRef.current.state === 'suspended') {
                console.log('[InlineStreamingRecorder] Resuming suspended audio context...');
                await audioContextRef.current.resume();
                console.log('[InlineStreamingRecorder] Audio context resumed, state:', audioContextRef.current.state);
            }
            
            const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
            
            // Create analyser for waveform visualization (always needed)
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            analyserRef.current.smoothingTimeConstant = 0.8;
            source.connect(analyserRef.current);

            // For GGML: StreamTranscriber handles audio internally via AudioWorklet
            // DO NOT create ScriptProcessor - it interferes with StreamTranscriber's internal audio handling
            // For non-GGML: Create ScriptProcessor to send chunks to worker
            if (!isGGML) {
                console.log('[InlineStreamingRecorder] Creating ScriptProcessor for non-GGML...');
                processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
                let chunkCount = 0;
                processorRef.current.onaudioprocess = (e: AudioProcessingEvent) => {
                    chunkCount++;
                    if (chunkCount === 1 || chunkCount % 50 === 0) {
                        console.log('[InlineStreamingRecorder] onaudioprocess called #', chunkCount);
                    }
                    
                    if (isRecordingRef.current && props.onAudioStream) {
                        // Send chunks to worker for non-GGML transcription
                        try {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const audioBuffer = audioContextRef.current!.createBuffer(
                                1,
                                inputData.length,
                                Constants.SAMPLING_RATE
                            );
                            audioBuffer.getChannelData(0).set(inputData);
                            props.onAudioStream(audioBuffer);
                        } catch (error) {
                            console.error('[InlineStreamingRecorder] Error processing audio chunk:', error);
                        }
                    }
                };
                source.connect(processorRef.current);
                processorRef.current.connect(audioContextRef.current.destination);
                console.log('[InlineStreamingRecorder] ScriptProcessor connected for non-GGML');
            } else {
                console.log('[InlineStreamingRecorder] Skipping ScriptProcessor for GGML - StreamTranscriber handles audio internally');
            }

            isRecordingRef.current = true;
            setRecording(true);
            console.log('[InlineStreamingRecorder] Recording state set to true');
            
            // For GGML, use StreamTranscriber directly (spawns its own internal worker)
            if (isGGML && !streamingStartedRef.current && streamRef.current) {
                console.log('[InlineStreamingRecorder] Starting GGML streaming with StreamTranscriber');
                try {
                    // Initialize if needed
                    const modelName = props.transcriber.model || "tiny.en";
                    const initialized = await ggmlStreaming.initStreamTranscriber(modelName);
                    if (!initialized) {
                        throw new Error('Failed to initialize StreamTranscriber');
                    }
                    
                    // Start streaming with MediaStream directly (like app.js)
                    await ggmlStreaming.startStreaming(streamRef.current, {
                        lang: "en",
                        suppress_non_speech: true,
                        max_tokens: 16,
                        preRecordsMs: 200,
                        maxRecordMs: 5000,
                        minSilenceMs: 500,
                        onVoiceActivity: (active: boolean) => {
                            voiceActivityRef.current = active;
                            props.onVoiceActivityChange?.(active);
                        }
                    });
                    
                    streamingStartedRef.current = true;
                    console.log('[InlineStreamingRecorder] GGML streaming started successfully');
                } catch (error) {
                    console.error('[InlineStreamingRecorder] Error starting GGML streaming:', error);
                    isRecordingRef.current = false;
                    setRecording(false);
                    return;
                }
            } else if (!isGGML) {
                // For non-GGML, use the old chunk-based approach
                if (!streamingStartedRef.current) {
                    console.log('[InlineStreamingRecorder] Starting non-GGML streaming mode');
                    props.transcriber.startStreaming();
                    streamingStartedRef.current = true;
                }
            }
            
            props.onRecordingStart?.();
            
            // Start waveform visualization
            console.log('[InlineStreamingRecorder] Starting waveform visualization');
            updateAudioLevel();
            console.log('[InlineStreamingRecorder] startRecording completed successfully');
        } catch (error) {
            console.error("[InlineStreamingRecorder] Error accessing microphone:", error);
            isRecordingRef.current = false;
            setRecording(false);
        }
    };

    const stopRecording = async () => {
        console.log('[InlineStreamingRecorder] stopRecording called, stack trace:', new Error().stack);
        isRecordingRef.current = false;
        voiceActivityRef.current = false;
        props.onVoiceActivityChange?.(false);
        
        // Stop streaming
        if (streamingStartedRef.current) {
            if (isGGML) {
                console.log('[InlineStreamingRecorder] Stopping GGML streaming');
                await ggmlStreaming.stopStreaming();
            } else {
                console.log('[InlineStreamingRecorder] Stopping non-GGML streaming mode');
                props.transcriber.stopStreaming();
            }
            streamingStartedRef.current = false;
        }
        
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            streamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = 0;
        }
        analyserRef.current = null;
        setRecording(false);
        setFrequencyData([]);
        props.onRecordingStop?.();
        console.log('[InlineStreamingRecorder] stopRecording completed');
    };

    const updateAudioLevel = () => {
        if (!analyserRef.current || !isRecordingRef.current) {
            if (!analyserRef.current) {
                console.log('[InlineStreamingRecorder] updateAudioLevel: no analyser');
            }
            if (!isRecordingRef.current) {
                console.log('[InlineStreamingRecorder] updateAudioLevel: not recording, stopping animation');
            }
            return;
        }
        
        // Use time domain data for waveform visualization (better for showing audio levels)
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);
        
        // Calculate RMS (Root Mean Square) for overall volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / bufferLength);
        
        // Detect voice activity (threshold can be adjusted)
        const voiceThreshold = 0.02; // Adjust this value to be more/less sensitive
        const hasVoice = rms > voiceThreshold;
        
        // Update voice activity if it changed
        if (hasVoice !== voiceActivityRef.current) {
            voiceActivityRef.current = hasVoice;
            props.onVoiceActivityChange?.(hasVoice);
        }
        
        // Create frequency visualization data from time domain
        const bars = 20;
        const step = Math.floor(bufferLength / bars);
        const frequencies = [];
        for (let i = 0; i < bars; i++) {
            const index = i * step;
            const value = Math.abs((dataArray[index] - 128) / 128);
            // Amplify the visualization
            frequencies.push(Math.min(value * 3, 1));
        }
        
        // Update frequency data ref to avoid unnecessary re-renders
        frequencyDataRef.current = frequencies;
        
        // Only update state if there's significant change to reduce re-renders
        const hasSignificantAudio = rms > 0.01;
        const currentData = hasSignificantAudio ? frequencies : new Array(bars).fill(0.1);
        
        // Only update state if data actually changed (simple comparison)
        const dataChanged = currentData.length !== frequencyData.length || 
            currentData.some((val, i) => Math.abs(val - (frequencyData[i] || 0)) > 0.05);
        
        if (dataChanged) {
            setFrequencyData(currentData);
        }

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    const handleToggle = () => {
        console.log('[InlineStreamingRecorder] handleToggle called, recording:', recording);
        if (recording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg bg-purple-50/50 dark:bg-purple-900/20">
            <button
                onClick={handleToggle}
                className={`h-20 w-20 rounded-full flex items-center justify-center 
                    bg-gradient-to-r from-purple-500 to-blue-500 text-white 
                    hover:from-purple-600 hover:to-blue-600 shadow-lg 
                    ${recording && "animate-pulse"} transition-all`}
            >
                {recording ? (
                    <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                ) : (
                    <MicrophoneIcon />
                )}
            </button>

            {/* Waveform visualization */}
            {recording && (
                <div className="flex items-end gap-1 h-12 w-full max-w-md justify-center">
                    {frequencyData.length > 0 ? (
                        frequencyData.map((level, index) => {
                            const height = Math.max(level * 100, 5); // Minimum 5% height
                            return (
                                <div
                                    key={index}
                                    className="bg-gradient-to-t from-blue-500 to-purple-500 rounded-full w-2 transition-all duration-100"
                                    style={{
                                        height: `${height}%`,
                                        opacity: Math.max(0.4, level),
                                        minHeight: '4px',
                                    }}
                                />
                            );
                        })
                    ) : (
                        Array.from({ length: 20 }).map((_, index) => (
                            <div
                                key={index}
                                className="bg-gradient-to-t from-blue-400/40 to-purple-400/40 rounded-full w-2"
                                style={{ height: "8%", minHeight: '4px' }}
                            />
                        ))
                    )}
                </div>
            )}

            {!recording && (
                <p className="text-sm text-muted-foreground">Tap mic to start recording</p>
            )}
        </div>
    );
}

