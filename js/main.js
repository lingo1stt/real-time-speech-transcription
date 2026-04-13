import { UIManager } from './ui-manager.js';
import { FillerManager } from './filler-manager.js';
import { AudioCaptureManager } from './speech-recognition.js';

class SpeechToTextApp {
    constructor() {
        this.ui = new UIManager();
        this.fillerManager = new FillerManager();

        this.finalTranscript = '';
        this.interimTranscript = '';
        this.pendingChunks = [];
        this.totalRecordedMs = 0;

        this.audioCapture = new AudioCaptureManager({
            onStart: ({ chunkIntervalMs }) => {
                this.ui.updateStatus('listening', `錄音中，每 ${Math.round(chunkIntervalMs / 1000)} 秒切一段`);
                this.ui.setListeningState(true);
                this.ui.hideError();
                this.interimTranscript = '正在擷取音訊片段，等待後端轉錄服務串接。';
                this.renderTranscript();
            },
            onStop: () => {
                this.ui.updateStatus('stopped', '已停止錄音');
                this.ui.setListeningState(false);
                if (!this.finalTranscript) {
                    this.interimTranscript = '錄音已停止。下一步可把 chunk 上傳到後端轉錄 API。';
                    this.renderTranscript();
                }
            },
            onChunk: (chunk) => {
                this.pendingChunks.push(chunk);
                this.totalRecordedMs += chunk.durationMs;
                this.interimTranscript = `已擷取 ${this.pendingChunks.length} 段音訊，累計 ${(this.totalRecordedMs / 1000).toFixed(0)} 秒，等待後端轉錄。`;
                this.renderTranscript();
            },
            onError: (message) => {
                this.handleError(message);
            }
        });

        this.init();
    }

    init() {
        const supported = this.audioCapture.init();
        if (!supported) {
            this.ui.showBrowserWarning('目前裝置無法直接錄音。請使用支援 MediaRecorder 的瀏覽器，並透過 HTTPS 或 localhost 開啟此頁面。');
            this.ui.setListeningState(false);
            this.ui.startBtn.disabled = true;
        }

        this.bindEvents();
        this.renderTranscript();
        this.renderFillerList();
        this.renderFillerAnalysis();
    }

    bindEvents() {
        this.ui.bindStart(() => this.startListening());
        this.ui.bindStop(() => this.stopListening());
        this.ui.bindClear(() => this.clearTranscript());
        this.ui.bindExportTxt(() => this.exportTranscriptAsTxt());

        this.ui.bindLanguageChange(() => {
            if (this.audioCapture.getRecordingState()) {
                this.interimTranscript = '語言設定已更新。錄音 chunk 會帶著新設定送往未來的轉錄服務。';
                this.renderTranscript();
            }
        });

        this.ui.bindFontSizeChange(() => {});

        this.ui.bindAddFiller(() => {
            const result = this.fillerManager.addWord(this.ui.getNewFillerInput());

            if (!result.success) {
                this.ui.showError(result.message);
                return;
            }

            this.ui.clearNewFillerInput();
            this.fillerManager.recalculateFromTranscript(this.finalTranscript);
            this.renderFillerList();
            this.renderFillerAnalysis();
        });

        this.ui.bindResetFiller(() => {
            this.fillerManager.resetWords();
            this.fillerManager.recalculateFromTranscript(this.finalTranscript);
            this.renderFillerList();
            this.renderFillerAnalysis();
            this.ui.showError('已重設贅詞清單');
        });
    }

    exportTranscriptAsTxt() {
        const content = this.finalTranscript.trim();
        if (!content) {
            this.ui.showError('目前還沒有可匯出的轉錄文字。');
            return;
        }

        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        const fileContent = `語音轉錄匯出
匯出時間: ${now.toLocaleString('zh-TW')}
語言: ${this.ui.getLanguage()}
====================
${content}
`;

        const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript_${timestamp}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async startListening() {
        try {
            await this.audioCapture.start();
        } catch (error) {
            this.handleError(error.message);
        }
    }

    stopListening() {
        this.audioCapture.stop();
    }

    clearTranscript() {
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.pendingChunks = [];
        this.totalRecordedMs = 0;
        this.fillerManager.clearCounts();
        this.renderTranscript();
        this.renderFillerAnalysis();
    }

    renderTranscript() {
        this.ui.updateTranscript(this.finalTranscript, this.interimTranscript);
    }

    renderFillerList() {
        this.ui.renderFillerList(this.fillerManager.getWords(), (word) => {
            this.fillerManager.removeWord(word);
            this.fillerManager.recalculateFromTranscript(this.finalTranscript);
            this.renderFillerList();
            this.renderFillerAnalysis();
        });
    }

    renderFillerAnalysis() {
        const totalWords = this.finalTranscript.trim().length;
        const summary = this.fillerManager.getSummary(totalWords);
        this.ui.renderFillerTable(summary, totalWords);
    }

    handleError(message) {
        if (this.audioCapture.getRecordingState()) {
            this.audioCapture.stop();
        } else {
            this.ui.updateStatus('stopped', '已停止錄音');
            this.ui.setListeningState(false);
        }

        this.ui.showError(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SpeechToTextApp();
});
