import { useState, useEffect, useRef } from "react";
// Import workers using Vite's ?worker&url syntax - this ensures Vite bundles them correctly
// ?worker&url returns a string URL that can be used with new Worker()
import XenovaWorkerUrl from "../whisper/worker.js?worker&url";
import GgmlWorkerUrl from "../whisper/worker-ggml.js?worker&url";

export interface MessageEventHandler {
    (event: MessageEvent): void;
}

export type WorkerType = "xenova" | "ggml";

export function useWorker(messageEventHandler: MessageEventHandler, workerType: WorkerType = "xenova"): Worker {
    const workerRef = useRef<Worker | null>(null);
    const [worker, setWorker] = useState<Worker>(() => {
        // Create initial worker synchronously
        try {
            return createWorker(messageEventHandler, workerType);
        } catch (error) {
            // Return a dummy worker that will be replaced
            const dummy = new Worker('data:text/javascript,', { type: "classic" });
            dummy.terminate();
            return dummy;
        }
    });
    const previousTypeRef = useRef<WorkerType>(workerType);

    useEffect(() => {
        // Recreate worker if type changed
        if (previousTypeRef.current !== workerType) {
            // Terminate old worker
            if (workerRef.current) {
                workerRef.current.terminate();
            }
            
            // Create new worker
            try {
                const newWorker = createWorker(messageEventHandler, workerType);
                workerRef.current = newWorker;
                setWorker(newWorker);
                previousTypeRef.current = workerType;
            } catch (error) {
                // Failed to create new worker
            }
        }
    }, [workerType, messageEventHandler]);

    useEffect(() => {
        workerRef.current = worker;
        return () => {
            // Cleanup: terminate worker on unmount
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, [worker]);

    return worker;
}

function createWorker(messageEventHandler: MessageEventHandler, workerType: WorkerType): Worker {
    let worker: Worker;
    
    if (workerType === "ggml") {
        // Use Vite's bundled GGML worker
        try {
            worker = new Worker(GgmlWorkerUrl, {
                type: "classic", // GGML worker doesn't need ES modules
            });
        } catch (error) {
            // Fallback: try with module type
            try {
                worker = new Worker(GgmlWorkerUrl, {
                    type: "module",
                });
            } catch (error2) {
                throw error2;
            }
        }
    } else {
        // Use Vite's bundled Xenova worker
        try {
            worker = new Worker(XenovaWorkerUrl, {
                type: "module",
            });
        } catch (error) {
            throw error;
        }
    }
    
    // Add error handler to catch worker loading/execution errors
    worker.addEventListener("error", (event) => {
        // Error handler (no logging)
    });
    
    // Add messageerror handler for message parsing errors
    worker.addEventListener("messageerror", (event) => {
        // Message error handler (no logging)
    });
    
    // Listen for messages from the Web Worker
    worker.addEventListener("message", (event) => {
        messageEventHandler(event);
    });
    
    // Send a test message to verify worker is responding
    setTimeout(() => {
        try {
            worker.postMessage({ action: 'ping', test: true });
        } catch (error) {
            // Error sending test ping
        }
    }, 100);
    
    return worker;
}