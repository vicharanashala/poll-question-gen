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
            console.error('[useWorker] Failed to create initial worker:', error);
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
            console.log('[useWorker] Worker type changed:', previousTypeRef.current, '->', workerType);
            // Terminate old worker
            if (workerRef.current) {
                console.log('[useWorker] Terminating old worker');
                workerRef.current.terminate();
            }
            
            // Create new worker
            try {
                const newWorker = createWorker(messageEventHandler, workerType);
                workerRef.current = newWorker;
                setWorker(newWorker);
                previousTypeRef.current = workerType;
                console.log('[useWorker] New worker created and set');
            } catch (error) {
                console.error('[useWorker] Failed to create new worker:', error);
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
        console.log('[useWorker] Creating GGML worker using Vite ?worker import');
        console.log('[useWorker] GgmlWorkerUrl:', GgmlWorkerUrl);
        try {
            worker = new Worker(GgmlWorkerUrl, {
                type: "classic", // GGML worker doesn't need ES modules
            });
            console.log('[useWorker] ✅ GGML Worker created successfully (classic)');
        } catch (error) {
            console.error('[useWorker] ❌ GGML Worker creation failed (classic):', error);
            // Fallback: try with module type
            try {
                worker = new Worker(GgmlWorkerUrl, {
                    type: "module",
                });
                console.log('[useWorker] ✅ GGML Worker created successfully (module)');
            } catch (error2) {
                console.error('[useWorker] ❌ GGML Worker creation failed (module):', error2);
                throw error2;
            }
        }
    } else {
        // Use Vite's bundled Xenova worker
        console.log('[useWorker] Creating Xenova worker using Vite ?worker import');
        console.log('[useWorker] XenovaWorkerUrl:', XenovaWorkerUrl);
        try {
            worker = new Worker(XenovaWorkerUrl, {
                type: "module",
            });
            console.log('[useWorker] ✅ Xenova Worker created successfully (module)');
        } catch (error) {
            console.error('[useWorker] ❌ Xenova Worker creation failed:', error);
            throw error;
        }
    }
    
    // Add error handler to catch worker loading/execution errors
    worker.addEventListener("error", (event) => {
        console.error('[useWorker] ⚠️ WORKER ERROR DETECTED:', event);
        console.error('[useWorker] Event type:', event.type);
        console.error('[useWorker] Event target:', event.target);
        console.error('[useWorker] Event currentTarget:', event.currentTarget);
        console.error('[useWorker] Error message:', event.message);
        console.error('[useWorker] Error filename:', event.filename);
        console.error('[useWorker] Error lineno:', event.lineno);
        console.error('[useWorker] Error colno:', event.colno);
        console.error('[useWorker] Error error:', event.error);
        console.error('[useWorker] Error stack:', event.error?.stack);
        
        // Try to get error from different properties
        const errorEvent = event as ErrorEvent;
        if (errorEvent.error) {
            console.error('[useWorker] ErrorEvent.error:', errorEvent.error);
            console.error('[useWorker] ErrorEvent.error.name:', errorEvent.error.name);
            console.error('[useWorker] ErrorEvent.error.message:', errorEvent.error.message);
            console.error('[useWorker] ErrorEvent.error.stack:', errorEvent.error.stack);
        }
        
        // Log all event properties
        console.error('[useWorker] All event properties:', Object.keys(event));
        for (const key in event) {
            try {
                console.error(`[useWorker] event.${key}:`, (event as any)[key]);
            } catch (e) {
                // Ignore errors accessing properties
            }
        }
    });
    
    // Add messageerror handler for message parsing errors
    worker.addEventListener("messageerror", (event) => {
        console.error('[useWorker] Worker messageerror:', event);
        console.error('[useWorker] Messageerror data:', event.data);
    });
    
    // Listen for messages from the Web Worker
    worker.addEventListener("message", (event) => {
        console.log('[useWorker] Message received from worker:', event.data);
        messageEventHandler(event);
    });
    
    // Send a test message to verify worker is responding
    setTimeout(() => {
        console.log('[useWorker] Sending test ping to worker...');
        try {
            worker.postMessage({ action: 'ping', test: true });
        } catch (error) {
            console.error('[useWorker] Error sending test ping:', error);
        }
    }, 100);
    
    console.log('[useWorker] Worker created successfully, worker object:', worker);
    return worker;
}