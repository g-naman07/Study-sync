import { Face } from "@tensorflow-models/face-detection";

export interface BlurDetectionProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    setIsBlur: (isBlur: string) => void;
    isActive: boolean;
}

export type MLProcessor = (image: ImageBitmap) => void;

export interface SpeechDetectorProps {
    setIsSpeaking: (isSpeaking: string, volume?: number) => void;
    isActive: boolean;
}

export interface FaceDetectorsProps {
    setIsFocused: (isFocused: boolean) => void;
    faces: Face[];
    isActive: boolean;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
    onRecognitionResult?: (result: any) => void;
    onDebugInfoUpdate?: (info: any) => void;
}

export interface FaceRecognition {
  id: string;
  name: string;
}

export interface FaceRecognitionDebugInfo {
  score: number;
  [key: string]: any;
}
