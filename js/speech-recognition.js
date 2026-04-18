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
        this.recordingStartedAt = 0;
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

    async start() {
        if (this.isRecording) {
            return;
        }

        if (!this.isSupported()) {
            throw new Error('Recording is unavailable. Open this page over HTTPS or localhost in a browser with MediaRecorder support.');
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
                const chunkEndMs = Date.now() - this.recordingStartedAt;
                const chunkStartMs = Math.max(0, chunkEndMs - this.chunkIntervalMs);

                this.onChunk?.({
                    chunkId: this.chunkSequence,
                    blob: event.data,
                    mimeType: event.data.type || this.mimeType || 'audio/webm',
                    durationMs: this.chunkIntervalMs,
                    startMs: chunkStartMs,
                    endMs: chunkEndMs
                });
            });

            this.mediaRecorder.addEventListener('stop', () => {
                this.cleanupStream();
                this.isRecording = false;
                this.onStop?.();
            });

            this.mediaRecorder.addEventListener('error', (event) => {
                this.handleFatalError(event.error?.message || 'A recording error occurred.');
            });

            this.chunkSequence = 0;
            this.recordingStartedAt = Date.now();
            this.mediaRecorder.start(this.chunkIntervalMs);
            this.isRecording = true;

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
                return new Error('Microphone permission was denied. Allow microphone access in your browser and phone settings.');
            case 'NotFoundError':
            case 'DevicesNotFoundError':
                return new Error('No microphone was found on this device.');
            case 'NotReadableError':
            case 'TrackStartError':
                return new Error('The microphone is currently unavailable, possibly because another app is using it.');
            default:
                return new Error(error?.message || 'Unable to start recording.');
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
