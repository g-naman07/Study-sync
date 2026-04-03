import React, { useEffect, useRef } from "react";
import { AudioClassifier, FilesetResolver } from "@mediapipe/tasks-audio";
import { SpeechDetectorProps } from "../types/ai.types";
import { registerStream, unRegisterStream } from "../lib/MediaRegistry";

const SpeechDetector: React.FC<SpeechDetectorProps> = ({ setIsSpeaking, isActive }) => {
    const classifierRef = useRef<AudioClassifier | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const workletUrlRef = useRef<string | null>(null);
    const speechStreakRef = useRef(0);
    const silenceStreakRef = useRef(0);
    const speakingStateRef = useRef(false);
    const noiseFloorRef = useRef(0);
    
    const MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite";

    useEffect(() => {
        const loadModel = async () => {
            try {
                if (classifierRef.current) {
                    await startMicrophone();
                    return;
                }

                const filesetResolver = await FilesetResolver.forAudioTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@0.10.0/wasm"
                );

                classifierRef.current = await AudioClassifier.createFromOptions(filesetResolver, {
                    baseOptions: { modelAssetPath: MODEL_PATH },
                });

                startMicrophone();
            } catch (error) {
                console.error("Error loading audio model:", error);
            }
        };

        if (isActive) {
           loadModel();
        } else {
            stopMicrophone();
            setIsSpeaking("No", 0);
        }

        return () => {
            stopMicrophone();
            unRegisterStream("SpeechDetector-audio-stream");
        };
    }, [isActive, setIsSpeaking]);

    const startMicrophone = async () => {
        if (audioCtxRef.current) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            registerStream("SpeechDetector-audio-stream", stream);
            
            audioCtxRef.current = new AudioContext({ sampleRate: 16000 });
            
            // 🌟 UPGRADED BLOB TRICK (The Accumulator) 🌟
            const workletCode = `
                class AudioProcessor extends AudioWorkletProcessor {
                    constructor() {
                        super();
                        this.bufferSize = 4096; // ~256ms of audio
                        this.buffer = new Float32Array(this.bufferSize);
                        this.bytesWritten = 0;
                    }

                    process(inputs, outputs, parameters) {
                        const input = inputs[0];
                        if (input && input.length > 0) {
                            const channelData = input[0];
                            
                            // Accumulate the tiny 128-sample chunks into our larger buffer
                            for (let i = 0; i < channelData.length; i++) {
                                this.buffer[this.bytesWritten++] = channelData[i];
                                
                                // Once full, send to React and reset!
                                if (this.bytesWritten >= this.bufferSize) {
                                    this.port.postMessage({ audioData: this.buffer });
                                    this.buffer = new Float32Array(this.bufferSize);
                                    this.bytesWritten = 0;
                                }
                            }
                        }
                        return true; 
                    }
                }
                registerProcessor('audio-processor', AudioProcessor);
            `;

            const blob = new Blob([workletCode], { type: 'application/javascript' });
            const workletUrl = URL.createObjectURL(blob);
            workletUrlRef.current = workletUrl;
            
            await audioCtxRef.current.audioWorklet.addModule(workletUrl);
            
            sourceRef.current = audioCtxRef.current.createMediaStreamSource(stream);
            workletNodeRef.current = new AudioWorkletNode(audioCtxRef.current, "audio-processor");

            workletNodeRef.current.port.onmessage = (event) => {
                if (!classifierRef.current || !isActive) return;

                // REMOVED THE THROTTLE! The worklet now naturally throttles itself to ~256ms
                const audioData = event.data.audioData;
                
                let sum = 0;
                for (let i = 0; i < audioData.length; i++) {
                    sum += audioData[i] * audioData[i];
                }
                const rms = Math.sqrt(sum / audioData.length);
                const volume = Math.min(100, Math.floor(rms * 500)); 

                processAudio(audioData, volume);
            };

            sourceRef.current.connect(workletNodeRef.current);
            workletNodeRef.current.connect(audioCtxRef.current.destination);
        } catch (error) {
            console.error("Error accessing microphone:", error);
        }
    };
    const processAudio = (audioData: Float32Array, volume: number) => {
        if (!classifierRef.current || !isActive) return;

        try {
            const results = classifierRef.current.classify(audioData, 16000);
            const categories = results[0]?.classifications[0]?.categories;
            const speechCategory = categories?.find((category) => {
                const label = category.categoryName.toLowerCase();
                return (
                    label.includes("speech") ||
                    label.includes("conversation") ||
                    label.includes("narration") ||
                    label.includes("talk")
                );
            });
            const speechScore = speechCategory?.score ?? 0;

            if (noiseFloorRef.current === 0) {
                noiseFloorRef.current = volume;
            }

            const relativeVolume = Math.max(0, volume - noiseFloorRef.current);

            const speechSignal =
                (speechScore > 0.38 && relativeVolume > 4) ||
                (speechScore > 0.25 && relativeVolume > 8);
            const silenceSignal = speechScore < 0.18 && relativeVolume < 2;

            if (speechSignal) {
                speechStreakRef.current += 1;
                silenceStreakRef.current = 0;
            } else if (silenceSignal) {
                silenceStreakRef.current += 1;
                speechStreakRef.current = 0;

                // Learn ambient noise only during confirmed silence.
                noiseFloorRef.current = noiseFloorRef.current * 0.92 + volume * 0.08;
            }

            // Debounce transitions to avoid sticky false positives.
            if (!speakingStateRef.current && speechStreakRef.current >= 2) {
                speakingStateRef.current = true;
            }
            if (speakingStateRef.current && silenceStreakRef.current >= 3) {
                speakingStateRef.current = false;
            }

            setIsSpeaking(speakingStateRef.current ? "Yes" : "No", volume);
            
        } catch (error) {
            console.error("Error processing audio:", error);
        }
    };
    const stopMicrophone = () => {
        if (workletNodeRef.current) {
            workletNodeRef.current.disconnect();
            workletNodeRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (audioCtxRef.current) {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
        }
        if (workletUrlRef.current) {
            URL.revokeObjectURL(workletUrlRef.current);
            workletUrlRef.current = null;
        }
        speechStreakRef.current = 0;
        silenceStreakRef.current = 0;
        speakingStateRef.current = false;
        noiseFloorRef.current = 0;
    };

    return null;
};

export default SpeechDetector;
