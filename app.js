class SpeechToTextTool {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.restartTimer = null;

        this.defaultFillerWords = [
            '然後', '那個', '嗯', '啊', '呃', '對',
            '就', '應該', '大概',
            '就是說', '怎麼說', '怎麼講', '什麼', '之類的',
            '那', '這樣', '這樣子', '那樣'
        ];

        this.fillerWords = [...this.defaultFillerWords];
        this.fillerCounts = {};

        this.initElements();
        this.checkBrowserSupport();
        this.initEventListeners();
        this.setupRecognition();
        this.renderFillerList();
        this.updateFillerTable();
    }

    initElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.transcript = document.getElementById('transcript');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.languageSelect = document.getElementById('languageSelect');
        this.fontSize = document.getElementById('fontSize');
        this.fontSizeValue = document.getElementById('fontSizeValue');
        this.wordCount = document.getElementById('wordCount');
        this.browserWarning = document.getElementById('browserWarning');
        this.errorMessage = document.getElementById('errorMessage');
        this.fillerTableBody = document.getElementById('fillerTableBody');
        this.totalFillers = document.getElementById('totalFillers');
        this.fillerRate = document.getElementById('fillerRate');

        this.newFillerInput = document.getElementById('newFillerInput');
        this.addFillerBtn = document.getElementById('addFillerBtn');
        this.resetFillerBtn = document.getElementById('resetFillerBtn');
        this.fillerList = document.getElementById('fillerList');
    }

    checkBrowserSupport() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.browserWarning.style.display = 'block';
            this.startBtn.disabled = true;
            return false;
        }
        return true;
    }

    initEventListeners() {
        this.startBtn.addEventListener('click', () => this.startListening());
        this.stopBtn.addEventListener('click', () => this.stopListening());
        this.clearBtn.addEventListener('click', () => this.clearTranscript());

        this.fontSize.addEventListener('input', (e) => {
            const size = e.target.value;
            this.transcript.style.fontSize = size + 'px';
            this.fontSizeValue.textContent = size + 'px';
        });

        this.languageSelect.addEventListener('change', () => {
            if (this.isListening) {
                this.stopListening();
                setTimeout(() => this.startListening(), 100);
            }
        });

        this.addFillerBtn.addEventListener('click', () => this.addCustomFiller());

        this.newFillerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addCustomFiller();
            }
        });

        this.resetFillerBtn.addEventListener('click', () => this.resetFillerList());
    }

    setupRecognition() {
        if (!this.checkBrowserSupport()) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();

        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateStatus('listening', '正在聆聽...');
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.hideError();
        };

        this.recognition.onresult = (event) => {
            this.interimTranscript = '';
            let newFinalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    newFinalTranscript += transcript + ' ';
                } else {
                    this.interimTranscript += transcript;
                }
            }

            if (newFinalTranscript) {
                this.finalTranscript += newFinalTranscript;
                this.analyzeFillers(newFinalTranscript);
            }

            this.updateTranscript();
            this.updateFillerTable();
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                this.restartTimer = setTimeout(() => {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        console.log('重新啟動識別失敗:', e);
                        this.handleError('重新連接失敗，請手動重新開始');
                    }
                }, 100);
            }
        };

        this.recognition.onerror = (event) => {
            let errorMsg = '發生錯誤：';

            switch (event.error) {
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
                    errorMsg += event.error;
            }

            this.handleError(errorMsg);
        };
    }

    escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    analyzeFillers(text) {
        this.fillerWords.forEach(filler => {
            const escapedFiller = this.escapeRegex(filler);
            const regex = new RegExp(escapedFiller, 'g');
            const matches = text.match(regex);

            if (matches) {
                this.fillerCounts[filler] = (this.fillerCounts[filler] || 0) + matches.length;
            }
        });
    }

    renderFillerList() {
        if (!this.fillerWords.length) {
            this.fillerList.innerHTML = '<div class="no-fillers">目前沒有偵測詞</div>';
            return;
        }

        this.fillerList.innerHTML = this.fillerWords.map(word => `
            <div class="filler-chip">
                <span>${this.escapeHtml(word)}</span>
                <button class="btn-remove-filler" data-word="${this.escapeHtml(word)}" title="刪除">✕</button>
            </div>
        `).join('');

        this.fillerList.querySelectorAll('.btn-remove-filler').forEach(btn => {
            btn.addEventListener('click', () => {
                const word = btn.getAttribute('data-word');
                this.removeFiller(word);
            });
        });
    }

    addCustomFiller() {
        const newWord = this.newFillerInput.value.trim();
        if (!newWord) return;

        if (this.fillerWords.includes(newWord)) {
            this.showError('這個詞已經在清單中');
            return;
        }

        this.fillerWords.push(newWord);
        this.newFillerInput.value = '';
        this.renderFillerList();
        this.recalculateFillerCounts();
    }

    removeFiller(word) {
        this.fillerWords = this.fillerWords.filter(item => item !== word);
        delete this.fillerCounts[word];
        this.renderFillerList();
        this.recalculateFillerCounts();
    }

    resetFillerList() {
        this.fillerWords = [...this.defaultFillerWords];
        this.renderFillerList();
        this.recalculateFillerCounts();
        this.showError('已重設為預設冗詞清單');
    }

    recalculateFillerCounts() {
        this.fillerCounts = {};

        if (this.finalTranscript.trim()) {
            this.analyzeFillers(this.finalTranscript);
        }

        this.updateFillerTable();
    }

    updateFillerTable() {
        const sortedFillers = Object.entries(this.fillerCounts)
            .sort((a, b) => b[1] - a[1])
            .filter(([_, count]) => count > 0);

        const totalWords = this.finalTranscript.trim().length;
        const totalFillerCount = sortedFillers.reduce((sum, [_, count]) => sum + count, 0);

        this.totalFillers.textContent = totalFillerCount;
        const rate = totalWords > 0 ? ((totalFillerCount / totalWords) * 100).toFixed(1) : 0;
        this.fillerRate.textContent = rate + '%';

        if (sortedFillers.length === 0) {
            this.fillerTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="no-fillers">
                        <div class="no-fillers-icon">🎉</div>
                        <div>太好了！目前沒有檢測到冗言贅字</div>
                    </td>
                </tr>
            `;
        } else {
            this.fillerTableBody.innerHTML = sortedFillers.map(([word, count]) => {
                const percentage = totalWords > 0 ? ((count / totalWords) * 100).toFixed(1) : 0;
                return `
                    <tr>
                        <td><span class="filler-word">${this.escapeHtml(word)}</span></td>
                        <td><span class="filler-count">${count}</span></td>
                        <td><span class="filler-percentage">${percentage}%</span></td>
                    </tr>
                `;
            }).join('');
        }
    }

    startListening() {
        if (!this.recognition) {
            this.handleError('語音識別不可用');
            return;
        }

        try {
            this.recognition.lang = this.languageSelect.value;
            this.recognition.start();
        } catch (e) {
            this.handleError('無法啟動語音識別：' + e.message);
        }
    }

    stopListening() {
        this.isListening = false;

        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        if (this.recognition) {
            this.recognition.stop();
        }

        this.updateStatus('stopped', '已停止');
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }

    clearTranscript() {
        this.finalTranscript = '';
        this.interimTranscript = '';
        this.fillerCounts = {};
        this.updateTranscript();
        this.updateFillerTable();
    }

    updateTranscript() {
        const fullTranscript = this.finalTranscript;
        const interimText = this.interimTranscript;

        if (!fullTranscript && !interimText) {
            this.transcript.innerHTML = '點擊「開始錄音」開始語音轉文字...';
            this.wordCount.textContent = '0';
        } else {
            this.transcript.innerHTML =
                `<span class="final-text">${this.escapeHtml(fullTranscript)}</span>` +
                `<span class="interim-text">${this.escapeHtml(interimText)}</span>`;

            const wordCount = (fullTranscript + interimText).trim().length;
            this.wordCount.textContent = wordCount;
        }
    }

    updateStatus(status, text) {
        const indicator = this.statusIndicator;
        const pulse = indicator.querySelector('.pulse');
        const span = indicator.querySelector('span');

        if (status === 'listening') {
            indicator.className = 'status-indicator status-listening';
            pulse.style.background = '#4caf50';
            pulse.style.animation = 'pulse 1.5s infinite';
        } else {
            indicator.className = 'status-indicator status-stopped';
            pulse.style.background = '#666';
            pulse.style.animation = 'none';
        }

        span.textContent = text;
    }

    handleError(message) {
        this.stopListening();
        this.showError(message);
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        setTimeout(() => this.hideError(), 5000);
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SpeechToTextTool();
});
