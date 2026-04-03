/**
 * Simple media stream registry to track and safely stop streams
 * preventing "camera already in use" errors.
 */
const mediaRegistry: Map<string, MediaStream> = new Map();

export const registerStream = (id: string, stream: MediaStream) => {
    mediaRegistry.set(id, stream);
};

export const unRegisterStream = (id: string) => {
    const stream = mediaRegistry.get(id);
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        mediaRegistry.delete(id);
    }
};

export const clearAllStreams = () => {
    mediaRegistry.forEach((_stream, id) => unRegisterStream(id));
};
