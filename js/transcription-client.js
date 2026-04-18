export class TranscriptionClient {
    constructor({
        endpoint = '/transcribe-chunk'
    } = {}) {
        this.endpoint = endpoint;
        this.queue = [];
        this.isUploading = false;
    }

    enqueue(payload) {
        return new Promise((resolve, reject) => {
            this.queue.push({ payload, resolve, reject });
            this.flushQueue();
        });
    }

    getPendingCount() {
        return this.queue.length + (this.isUploading ? 1 : 0);
    }

    async flushQueue() {
        if (this.isUploading) {
            return;
        }

        const next = this.queue.shift();
        if (!next) {
            return;
        }

        this.isUploading = true;

        try {
            const result = await this.uploadChunk(next.payload);
            next.resolve(result);
        } catch (error) {
            next.reject(error);
        } finally {
            this.isUploading = false;
            if (this.queue.length > 0) {
                this.flushQueue();
            }
        }
    }

    async uploadChunk({
        sessionId,
        chunkId,
        chunk,
        language,
        mimeType,
        startMs,
        endMs,
        durationMs
    }) {
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        formData.append('chunkId', String(chunkId));
        formData.append('language', language);
        formData.append('mimeType', mimeType);
        formData.append('chunkStartMs', String(startMs));
        formData.append('chunkEndMs', String(endMs));
        formData.append('chunkDurationMs', String(durationMs));
        formData.append('audio', chunk, this.buildFilename(chunkId, mimeType));

        const response = await fetch(this.endpoint, {
            method: 'POST',
            body: formData
        });

        let data = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            throw new Error(data?.error?.message || `Chunk upload failed with status ${response.status}.`);
        }

        this.validateResponse(data);
        return data;
    }

    buildFilename(chunkId, mimeType) {
        const extension = this.getExtension(mimeType);
        return `chunk-${chunkId}.${extension}`;
    }

    getExtension(mimeType) {
        if (mimeType.includes('mp4')) {
            return 'mp4';
        }

        if (mimeType.includes('ogg')) {
            return 'ogg';
        }

        return 'webm';
    }

    validateResponse(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('The transcription API returned an invalid JSON response.');
        }

        if (typeof data.chunkId !== 'number') {
            throw new Error('The transcription API response is missing "chunkId".');
        }

        if (typeof data.text !== 'string') {
            throw new Error('The transcription API response is missing "text".');
        }

        if (typeof data.appendText !== 'string') {
            throw new Error('The transcription API response is missing "appendText".');
        }
    }
}
