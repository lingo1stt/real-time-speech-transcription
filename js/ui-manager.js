import { escapeHtml } from './utils.js';

export class UIManager {
    constructor() {
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

    bindFontSizeChange(callback) {
        this.fontSize.addEventListener('input', (e) => {
            const size = e.target.value;
            this.transcript.style.fontSize = `${size}px`;
            this.fontSizeValue.textContent = `${size}px`;
            callback?.(size);
        });
    }

    bindStart(callback) {
        this.startBtn.addEventListener('click', callback);
    }

    bindStop(callback) {
        this.stopBtn.addEventListener('click', callback);
    }

    bindClear(callback) {
        this.clearBtn.addEventListener('click', callback);
    }

    bindLanguageChange(callback) {
        this.languageSelect.addEventListener('change', callback);
    }

    bindAddFiller(callback) {
        this.addFillerBtn.addEventListener('click', callback);
        this.newFillerInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                callback();
            }
        });
    }

    bindResetFiller(callback) {
        this.resetFillerBtn.addEventListener('click', callback);
    }

    getLanguage() {
        return this.languageSelect.value;
    }

    getNewFillerInput() {
        return this.newFillerInput.value;
    }

    clearNewFillerInput() {
        this.newFillerInput.value = '';
    }

    showBrowserWarning() {
        this.browserWarning.style.display = 'block';
    }

    updateTranscript(fullTranscript, interimTranscript) {
        if (!fullTranscript && !interimTranscript) {
            this.transcript.innerHTML = '點擊「開始錄音」開始語音轉文字...';
            this.wordCount.textContent = '0';
            return;
        }

        this.transcript.innerHTML =
            `<span class="final-text">${escapeHtml(fullTranscript)}</span>` +
            `<span class="interim-text">${escapeHtml(interimTranscript)}</span>`;

        const wordCount = (fullTranscript + interimTranscript).trim().length;
        this.wordCount.textContent = wordCount;
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

    setListeningState(isListening) {
        this.startBtn.disabled = isListening;
        this.stopBtn.disabled = !isListening;
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        setTimeout(() => this.hideError(), 5000);
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    renderFillerList(words, onRemove) {
        if (!words.length) {
            this.fillerList.innerHTML = '<div class="no-fillers">目前沒有偵測詞</div>';
            return;
        }

        this.fillerList.innerHTML = words.map(word => `
            <div class="filler-chip">
                <span>${escapeHtml(word)}</span>
                <button class="btn-remove-filler" data-word="${escapeHtml(word)}" title="刪除">✕</button>
            </div>
        `).join('');

        this.fillerList.querySelectorAll('.btn-remove-filler').forEach(btn => {
            btn.addEventListener('click', () => {
                const word = btn.getAttribute('data-word');
                onRemove(word);
            });
        });
    }

    renderFillerTable(summary, totalWords) {
        this.totalFillers.textContent = summary.totalFillerCount;
        this.fillerRate.textContent = `${summary.rate}%`;

        if (summary.sortedFillers.length === 0) {
            this.fillerTableBody.innerHTML = `
                <tr>
                    <td colspan="3" class="no-fillers">
                        <div class="no-fillers-icon">🎉</div>
                        <div>太好了！目前沒有檢測到冗言贅字</div>
                    </td>
                </tr>
            `;
            return;
        }

        this.fillerTableBody.innerHTML = summary.sortedFillers.map(([word, count]) => {
            const percentage = totalWords > 0 ? ((count / totalWords) * 100).toFixed(1) : '0';
            return `
                <tr>
                    <td><span class="filler-word">${escapeHtml(word)}</span></td>
                    <td><span class="filler-count">${count}</span></td>
                    <td><span class="filler-percentage">${percentage}%</span></td>
                </tr>
            `;
        }).join('');
    }
}
