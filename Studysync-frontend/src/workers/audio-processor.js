// public/audio-processor.js

class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Check if we have audio data
    if (input && input.length > 0) {
      const channelData = input[0];
      
      // Send the Float32Array data back to the main thread
      this.port.postMessage({ audioData: channelData });
    }
    
    // Return true to keep the processor alive
    return true; 
  }
}

registerProcessor('audio-processor', AudioProcessor);