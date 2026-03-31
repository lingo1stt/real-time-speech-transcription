import { UIManager } from './ui-manager.js';
import { FillerManager } from './filler-manager.js';
import { SpeechRecognitionManager } from './speech-recognition.js';

class SpeechToTextApp {
    constructor() {
        this.ui = new UIManager();
        this.fillerManager = new FillerManager();

        this.finalTranscript = '';
        this.interimTranscript = '';

        this.speech = new SpeechRecognitionManager({
            onStart: () => {
                this.ui.updateStatus('listening', '正在聆聽...');
                this.ui.setListeningState(true);
                this.ui.hideError();
            },
            onResult: ({ newFinalTranscript, interimTranscript }) => {
                this.interimTranscript = interimTranscript;

                if (newFinalTranscript) {
                    this.finalTranscript += newFinalTranscript;
                    this.fillerManager.analyzeText(newFinalTranscript);
                }

                this.renderTranscript();
                this.renderFillerAnalysis();
            },
            onReconnectAttempt: ({ attempt, maxAttempts, delay }) => {
                const seconds = (delay / 1000).toFixed(delay >= 1000 ? 1 : 0);
                this.ui.updateStatus('listening', `連線中斷，${seconds} 秒後重試（${attempt}/${maxAttempts}）`);
            },
            onEndRestartFail: (message) => {
                this.handleError(message);
            },
            onError: (message) => {
                this.handleError(message);
            }
        });

        this.init();
    }

    init() {
        const supported = this.speech.init();
        if (!supported) {
            this.ui.showBrowserWarning();
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
            if (this.speech.getListeningState()) {
                this.stopListening();
                setTimeout(() => this.startListening(), 100);
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
            this.ui.showError('已重設為預設冗詞清單');
        });
    }
    
    exportTranscriptAsTxt() {
        const content = this.finalTranscript.trim();
        if (!content) {
            this.ui.showError('目前沒有可匯出的文字內容');
            return;
        }
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        const fileContent =`即時語音轉文字匯出檔 匯出時間：${now.toLocaleString('zh-TW')}語言：${this.ui.getLanguage()}
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
    
    startListening() {
        try {
            this.speech.start(this.ui.getLanguage());
        } catch (e) {
            this.handleError(`無法啟動語音識別：${e.message}`);
        }
    }

    stopListening() {
        this.speech.stop();
        this.ui.updateStatus('stopped', '已停止');
        this.ui.setListeningState(false);
    }

    clearTranscript() {
        this.finalTranscript = '';
        this.interimTranscript = '';
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
        this.stopListening();
        this.ui.showError(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SpeechToTextApp();
});
