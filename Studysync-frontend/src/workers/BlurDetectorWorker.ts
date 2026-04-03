// Smart Camera Quality Analyzer Worker

self.onmessage = (event) => {
    const { data, width, height } = event.data;

    const totalPixels = width * height;
    const validPixels = (width - 2) * (height - 2);

    const grayscale = new Float32Array(totalPixels);

    let brightnessSum = 0;

    // Convert to grayscale + compute brightness
    for (let i = 0, j = 0; i < totalPixels; i++, j += 4) {
        const gray =
            0.299 * data[j] +
            0.587 * data[j + 1] +
            0.114 * data[j + 2];

        grayscale[i] = gray;
        brightnessSum += gray;
    }

    const avgBrightness = brightnessSum / totalPixels;

    // Compute Laplacian variance (blur detection)
    let sum = 0;
    let sumSq = 0;

    for (let y = 1; y < height - 1; y++) {
        let row = y * width;

        for (let x = 1; x < width - 1; x++) {
            const i = row + x;

            const val =
                grayscale[i - width] +
                grayscale[i - 1] +
                grayscale[i + 1] +
                grayscale[i + width] -
                4 * grayscale[i];

            sum += val;
            sumSq += val * val;
        }
    }

    const mean = sum / validPixels;
    const variance = (sumSq / validPixels) - (mean * mean);

    // Contrast calculation (standard deviation of grayscale)
    let contrastSumSq = 0;
    for (let i = 0; i < totalPixels; i++) {
        const diff = grayscale[i] - avgBrightness;
        contrastSumSq += diff * diff;
    }
    const contrast = Math.sqrt(contrastSumSq / totalPixels);

    // -------------------------
    // 🧠 Intelligent Classification
    // -------------------------

    let blurLevel;
    if (variance < 20) {
        blurLevel = "high";
    } else if (variance < 50) {
        blurLevel = "medium";
    } else {
        blurLevel = "low";
    }

    let lighting = "good";
    if (avgBrightness < 40) lighting = "dark";
    else if (avgBrightness > 220) lighting = "overexposed";

    let contrastLevel = "good";
    if (contrast < 20) contrastLevel = "low";

    // Final decision (robust logic)
    const isBlurry = blurLevel === "high";

    self.postMessage({
        isBlurry,
        blurLevel,        // high | medium | low
        variance,

        brightness: avgBrightness,
        lighting,         // good | dark | overexposed

        contrast,
        contrastLevel     // good | low
    });
};