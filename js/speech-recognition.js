export class AudioCaptureManager {
    constructor({
        onStart,
        onStop,
        onChunk,
        onError
    } = {}) {
        this.onStart = onStart;
        this.onStop = onStop;
        this.onChunk = onChunk;
        this.onError = onError;

        this.mediaRecorder = null;
        this.stream = null;
        this.isRecording = false;
        this.chunkIntervalMs = 4000;
        this.chunkSequence = 0;
        this.mimeType = '';
    }

    isSupported() {
        return window.isSecureContext &&
            typeof navigator.mediaDevices?.getUserMedia === 'function' &&
            typeof window.MediaRecorder !== 'undefined';
    }

    init() {
        return this.isSupported();
    }

    getRecordingState() {
        return this.isRecording;
    }

    getChunkIntervalMs() {
        return this.chunkIntervalMs;
    }

    async start() {
        if (this.isRecording) {
            return;
        }

        if (!this.isSupported()) {
            throw new Error('目前環境不支援錄音。請使用 HTTPS 或 localhost，並確認瀏覽器支援 MediaRecorder。');
        }

        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this.mimeType = this.getPreferredMimeType();
            const options = this.mimeType ? { mimeType: this.mimeType } : undefined;

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.mediaRecorder.addEventListener('dataavailable', (event) => {
                if (!event.data || event.data.size === 0) {
                    return;
                }

                this.chunkSequence += 1;
                this.onChunk?.({
                    chunkId: this.chunkSequence,
                    blob: event.data,
                    mimeType: event.data.type || this.mimeType || 'audio/webm',
                    durationMs: this.chunkIntervalMs
                });
            });

            this.mediaRecorder.addEventListener('stop', () => {
                this.cleanupStream();
                this.isRecording = false;
                this.onStop?.();
            });

            this.mediaRecorder.addEventListener('error', (event) => {
                this.handleFatalError(event.error?.message || '錄音時發生錯誤。');
            });

            this.mediaRecorder.start(this.chunkIntervalMs);
            this.isRecording = true;
            this.chunkSequence = 0;
            this.onStart?.({
                mimeType: this.mimeType || 'audio/webm',
                chunkIntervalMs: this.chunkIntervalMs
            });
        } catch (error) {
            this.cleanupStream();
            throw this.normalizeStartError(error);
        }
    }

    stop() {
        if (!this.mediaRecorder) {
            return;
        }

        if (this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        } else {
            this.cleanupStream();
            this.isRecording = false;
            this.onStop?.();
        }

        this.mediaRecorder = null;
    }

    getPreferredMimeType() {
        const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus'
        ];

        return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
    }

    normalizeStartError(error) {
        switch (error?.name) {
            case 'NotAllowedError':
            case 'PermissionDeniedError':
                return new Error('麥克風權限被拒絕，請允許瀏覽器存取麥克風。');
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                return new Error('找不到可用的麥克風裝置。');
            case 'NotReadableError':
            case 'TrackStartError':
                return new Error('麥克風目前無法使用，可能被其他程式占用。');
            default:
                return new Error(error?.message || '無法啟動錄音。');
        }
    }

    handleFatalError(message) {
        this.stop();
        this.onError?.(message);
    }

    cleanupStream() {
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }
    }
}
