import { useEffect, useRef, useState } from "react";
import XenovaWorkerUrl from "../whisper/worker.js?worker&url";
import GgmlWorkerUrl from "../whisper/worker-ggml.js?worker&url";

export type WorkerType = "xenova" | "ggml";

export function useWorker(
    messageEventHandler: (event: MessageEvent) => void,
    workerType: WorkerType = "xenova"
): Worker | null {
    const handlerRef = useRef(messageEventHandler);
    const workerRef = useRef<Worker | null>(null);
    const [worker, setWorker] = useState<Worker | null>(null);

    // Keep handler always fresh
    useEffect(() => {
        handlerRef.current = messageEventHandler;
    }, [messageEventHandler]);

    // Create or recreate worker when type changes
    useEffect(() => {
        // Kill old worker
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }

        // Create new worker
        const newWorker = createWorker(workerType, (event) => {
            handlerRef.current(event);
        });

        workerRef.current = newWorker;
        setWorker(newWorker);

        return () => {
            newWorker.terminate();
        };
    }, [workerType]);

    return worker;
}

// --- Worker factory ---

function createWorker(type: WorkerType, handler: (e: MessageEvent) => void): Worker {
    let worker: Worker;

    if (type === "ggml") {
        // Try classic first, then module
        try {
            worker = new Worker(GgmlWorkerUrl, { type: "classic" });
        } catch {
            worker = new Worker(GgmlWorkerUrl, { type: "module" });
        }
    } else {
        worker = new Worker(new URL("../whisper/worker.js", import.meta.url), {
            type: "module",
        });
    }

    worker.addEventListener("message", handler);
    worker.addEventListener("error", () => {});
    worker.addEventListener("messageerror", () => {});

    return worker;
}
