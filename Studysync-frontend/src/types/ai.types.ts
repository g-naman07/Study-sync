import { Face } from "@tensorflow-models/face-detection";

export interface BlurDetectionProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    setIsBlur: (isBlur: string) => void;
}

export type MLProcessor = (image: ImageBitmap) => void;

export interface SpeechDetectorProps {
    setIsSpeaking: (isSpeaking: string, volume?: number) => void;
}

export interface FaceDetectorsProps {
    setIsFocused: (isFocused: boolean) => void;
    faces: Face[];
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
