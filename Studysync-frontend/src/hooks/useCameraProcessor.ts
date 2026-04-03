import { useEffect, useRef, useState } from "react";
import CameraProcessor from "../lib/CameraProcessor";
import * as faceDetection from "@tensorflow-models/face-detection";
import { MLProcessor } from "../types/ai.types";
import { unRegisterStream } from "../lib/MediaRegistry";

const useCameraProcessor = (frameRate = 3) => {
    useEffect(() => {
        return () => {
            unRegisterStream("CameraProcessor-stream");
        };
    }, []);
    const [modelReady, setModelReady] = useState(false);
    const [faces, setFaces] = useState<faceDetection.Face[]>([]);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const internalVideoRef = useRef<HTMLVideoElement>(document.createElement("video"));
    const cameraProcessorRef = useRef<CameraProcessor | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const modelReadyRef = useRef(false);

    useEffect(() => {
        const initializeCamera = async () => {
            if (cameraProcessorRef.current) {
                cameraProcessorRef.current.stopCapturing();
            }

            cameraProcessorRef.current = new CameraProcessor(frameRate);

            // Use the internal hidden video for AI processing
            const video = internalVideoRef.current;
            video.muted = true;
            video.playsInline = true;
            video.style.display = "none";
            document.body.appendChild(video); // Must be in DOM to play and process frames reliably

            await cameraProcessorRef.current.initialize(video);
            await video.play().catch(console.error); // Ensure it's playing for the AI loop
            
            // Expose the stream to the UI
            if (video.srcObject instanceof MediaStream) {
                setStream(video.srcObject);
            }

            setTimeout(() => {
                cameraProcessorRef.current?.startCapturing();
            }, 500);
        };

        initializeCamera();

        return () => {
            cameraProcessorRef.current?.stopCapturing();
            if (internalVideoRef.current.parentNode) {
                document.body.removeChild(internalVideoRef.current);
            }
        };
    }, [frameRate]);

    useEffect(() => {
        if (!cameraProcessorRef.current) return;

        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
            setModelReady(false);
            modelReadyRef.current = false;
            setFaces([]);
        }

        // Use the worker in src/workers
        workerRef.current = new Worker(new URL("../workers/FaceDetectorWorker.ts", import.meta.url), { type: "module" });

        workerRef.current.onmessage = (event) => {
            if (event.data.type === "MODEL_READY") {
                setModelReady(true);
                modelReadyRef.current = true;
            } else if (event.data.type === "DETECTION_RESULT") {
                setFaces(event.data.faces);
            } else if (event.data.type === "ERROR") {
                console.error("Worker Error:", event.data.message);
            }
        };

        workerRef.current.postMessage({ type: "INIT" });

        const processWithML: MLProcessor = (image) => {
            if (!workerRef.current || !modelReadyRef.current) return;

            try {
                workerRef.current.postMessage({ type: "DETECT_FACES", image }, [image]);
            } catch (error) {
                console.error("Error processing image:", error);
            }
        };

        cameraProcessorRef.current.addMLProcessor(processWithML);

        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
            modelReadyRef.current = false;
        };
    }, []);

    return { modelReady, faces, stream, internalVideoRef };
};

export default useCameraProcessor;
