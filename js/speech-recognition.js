export class SpeechRecognitionManager {
    constructor({ onStart, onResult, onEndRestartFail, onError, onReconnectAttempt } = {}) {
        this.recognition = null;
        this.isListening = false;
        this.restartTimer = null;
        this.restartAttempts = 0;
        this.baseRestartDelay = 300;
        this.maxRestartDelay = 5000;
        this.maxRestartAttempts = 8;
        this.shouldRestart = false;

        this.onStart = onStart;
        this.onResult = onResult;
        this.onEndRestartFail = onEndRestartFail;
        this.onError = onError;
        this.onReconnectAttempt = onReconnectAttempt;
    }

    isSupported() {
        return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    }

    init() {
        if (!this.isSupported()) return false;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.shouldRestart = true;
            this.restartAttempts = 0;
            this.onStart?.();
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let newFinalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    newFinalTranscript += `${transcript} `;
                } else {
                    interimTranscript += transcript;
                }
            }

            this.onResult?.({
                newFinalTranscript,
                interimTranscript
            });
        };

        this.recognition.onend = () => {
            if (this.shouldRestart) {
                this.scheduleRestart();
            }
        };

        this.recognition.onerror = (event) => {
            const error = event.error;

            if (error === 'not-allowed' || error === 'service-not-allowed' || error === 'audio-capture') {
                this.shouldRestart = false;
            }

            let errorMsg = '發生錯誤：';

            switch (error) {
                case 'no-speech':
                    errorMsg += '未檢測到語音，請確認麥克風正常工作';
                    break;
                case 'audio-capture':
                    errorMsg += '無法存取麥克風，請檢查權限設定';
                    break;
                case 'not-allowed':
                    errorMsg += '麥克風權限被拒絕，請允許網站存取麥克風';
                    break;
                case 'network':
                    errorMsg += '網路連接問題，請檢查網路狀態';
                    break;
                case 'service-not-allowed':
                    errorMsg += '語音識別服務不可用';
                    break;
                default:
                    errorMsg += error;
            }

            if (!this.shouldRestart) {
                this.onError?.(errorMsg);
            }
        };

        return true;
    }

    scheduleRestart() {
        if (!this.recognition || !this.shouldRestart) return;

        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        if (this.restartAttempts >= this.maxRestartAttempts) {
            this.shouldRestart = false;
            this.isListening = false;
            this.onEndRestartFail?.('語音中斷多次，請手動重新開始');
            return;
        }

        const delay = Math.min(
            this.baseRestartDelay * (2 ** this.restartAttempts),
            this.maxRestartDelay
        );

        this.onReconnectAttempt?.({
            attempt: this.restartAttempts + 1,
            maxAttempts: this.maxRestartAttempts,
            delay
        });

        this.restartAttempts += 1;
        this.restartTimer = setTimeout(() => {
            try {
                this.recognition.start();
            } catch (e) {
                this.scheduleRestart();
            }
        }, delay);
    }

    start(language) {
        if (!this.recognition) {
            throw new Error('語音識別尚未初始化');
        }

        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        this.shouldRestart = true;
        this.restartAttempts = 0;
        this.recognition.lang = language;
        this.recognition.start();
    }

    stop() {
        this.isListening = false;
        this.shouldRestart = false;
        this.restartAttempts = 0;

        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        if (this.recognition) {
            this.recognition.stop();
        }
    }

    getListeningState() {
        return this.isListening;
    }
}
