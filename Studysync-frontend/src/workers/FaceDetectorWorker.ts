import * as faceDetection from "@tensorflow-models/face-detection";
import "@tensorflow/tfjs-backend-cpu";
import * as tf from "@tensorflow/tfjs-core";

let detector: faceDetection.FaceDetector | null = null;

async function initDetector() {
    await tf.setBackend('cpu');
    await tf.ready();
    const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
    const detectorConfig: faceDetection.MediaPipeFaceDetectorTfjsModelConfig = {
        runtime: "tfjs",
    };
    detector = await faceDetection.createDetector(model, detectorConfig);
    self.postMessage({ type: "MODEL_READY" });
}

self.onmessage = async (event) => {
    const { type, image } = event.data;

    if (type === "INIT") {
        await initDetector();
    } else if (type === "DETECT_FACES") {
        if (!detector) return;
        
        try {
            const faces = await detector.estimateFaces(image, {
                flipHorizontal: false,
            });
            self.postMessage({ type: "DETECTION_RESULT", faces });
        } catch (error) {
            self.postMessage({ type: "ERROR", message: (error as Error).message });
        } finally {
            // Memory management: free the image bitmap if necessary
            if (image.close) image.close();
        }
    }
};
