import React, { useEffect, useRef } from "react";
import { Face, Keypoint } from "@tensorflow-models/face-detection";
import { FaceDetectorsProps } from "../types/ai.types";

const isLookingAway = (face: Face): boolean => {
    if (!face || face.keypoints.length < 6) return false;

    const rightEye = face.keypoints.find((p: Keypoint) => p.name === "rightEye");
    const leftEye = face.keypoints.find((p: Keypoint) => p.name === "leftEye");
    const noseTip = face.keypoints.find((p: Keypoint) => p.name === "noseTip");
    const rightEar = face.keypoints.find((p: Keypoint) => p.name === "rightEarTragion");
    const leftEar = face.keypoints.find((p: Keypoint) => p.name === "leftEarTragion");

    if (!rightEye || !leftEye || !noseTip || !face.box) return false;

    const faceWidth = face.box.width;
    const faceHeight = face.box.height;
    
    // Logic from original code for focus detection
    const eyeDistance = Math.abs(leftEye.x - rightEye.x) / faceWidth / Math.pow(faceHeight, 0.1) * 1.7;
    const noseToLeftEye = Math.abs(noseTip.x - leftEye.x);
    const noseToRightEye = Math.abs(noseTip.x - rightEye.x);
    const noseRatio = Math.min(noseToLeftEye, noseToRightEye) / Math.max(noseToLeftEye, noseToRightEye) * Math.pow(faceHeight, 0.2) / Math.pow(200, 0.2);
    
    let earVisibilityRatio = 0;
    if (!rightEar || !leftEar) earVisibilityRatio = 1;
    else {
        const rightEarDist = Math.abs(rightEar.x - rightEye.x);
        const leftEarDist = Math.abs(leftEar.x - leftEye.x);
        earVisibilityRatio = Math.min(rightEarDist, leftEarDist) / Math.max(rightEarDist, leftEarDist) * Math.pow(faceHeight, 0.3) / Math.pow(200, 0.3);
    }

    // Use relaxed limits so subtle natural head movement does not count as "looking away".
    if (eyeDistance < 0.30) return true;
    if (noseRatio < 0.38) return true;
    if (earVisibilityRatio < 0.36) return true;

    return false;
};

const FaceDetectors: React.FC<FaceDetectorsProps> = ({ setIsFocused, faces, isActive }) => {
    const awayFramesRef = useRef(0);
    const focusedFramesRef = useRef(0);

    useEffect(() => {
        if (!isActive) {
            awayFramesRef.current = 0;
            focusedFramesRef.current = 0;
            return;
        }

        if (faces.length === 0) {
            awayFramesRef.current = 0;
            focusedFramesRef.current = 0;
            setIsFocused(false);
            return;
        }

        // Check if the primary face is looking away.
        const mainFace = faces[0];
        const lookingAway = isLookingAway(mainFace);

        // Temporal smoothing: require sustained away frames before pausing.
        if (lookingAway) {
            awayFramesRef.current += 1;
            focusedFramesRef.current = 0;
            if (awayFramesRef.current >= 4) {
                setIsFocused(false);
            }
        } else {
            focusedFramesRef.current += 1;
            awayFramesRef.current = 0;
            if (focusedFramesRef.current >= 2) {
                setIsFocused(true);
            }
        }
        
    }, [faces, isActive, setIsFocused]);

    return null;
};

export default FaceDetectors;
