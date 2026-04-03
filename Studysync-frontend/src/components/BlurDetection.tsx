import React, { useEffect, useRef } from "react";
import { BlurDetectionProps } from "../types/ai.types";

// Add the isActive prop to your interface
interface ExtendedBlurProps extends BlurDetectionProps {
    isActive: boolean;
}

const BlurDetection: React.FC<ExtendedBlurProps> = ({ videoRef, setIsBlur, isActive }) => {
    const workerRef = useRef<Worker | null>(null);

    // 1. Worker Setup
    useEffect(() => {
        workerRef.current = new Worker(new URL("../workers/BlurDetectorWorker.ts", import.meta.url), {
            type: "module",
        });

        workerRef.current.onmessage = (event) => {
            const { isBlurry } = event.data;
            if (isActive) {
                setIsBlur(isBlurry ? "Yes" : "No");
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, [setIsBlur, isActive]);

    // 2. Frame Capture Logic
    useEffect(() => {
        // CRITICAL FIX: If isActive is false, do not start the interval!
        if (!videoRef.current || !isActive) {
            return;
        }

        const captureFrame = () => {
            const video = videoRef.current;
            if (!video || video.readyState !== 4) return;

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            if (ctx) {
                try {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    workerRef.current?.postMessage(imageData);
                } catch (error) {
                    console.warn("Failed to capture frame:", error);
                }
            }
        };

        // This interval will now automatically be cleared when isActive becomes false
        const interval = setInterval(captureFrame, 500);
        return () => clearInterval(interval);
    }, [videoRef, isActive]);

    return null;
};

export default BlurDetection;