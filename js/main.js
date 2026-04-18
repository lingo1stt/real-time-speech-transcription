import { UIManager } from './ui-manager.js';
import { FillerManager } from './filler-manager.js';
import { AudioCaptureManager } from './speech-recognition.js';
import { TranscriptionClient } from './transcription-client.js';

class SpeechToTextApp {
    constructor() {
        this.ui = new UIManager();
        this.fillerManager = new FillerManager();
        this.transcriptionClient = new TranscriptionClient();

        this.finalTranscript = '';
        this.interimTranscript = '';
        this.recordedChunkCount = 0;
        this.totalRecordedMs = 0;
        this.sessionId = '';

        this.audioCapture = new AudioCaptureManager({
            onStart: ({ chunkIntervalMs }) => {
                this.sessionId = this.createSessionId();
                this.recordedChunkCount = 0;
                this.totalRecordedMs = 0;
                this.ui.updateStatus('listening', `Recording and uploading ${Math.round(chunkIntervalMs / 1000)}s chunks`);
                this.ui.setListeningState(true);
                this.ui.hideError();
                this.interimTranscript = 'Capturing audio and sending chunks to /transcribe-chunk...';
                this.renderTranscript();
            },
            onStop: () => {
                this.ui.updateStatus('stopped', 'Recording stopped');
                this.ui.setListeningState(false);
                if (!this.finalTranscript) {
                    this.interimTranscript = 'Recording stopped. If the backend is running, uploaded chunks will continue finishing in order.';
                    this.renderTranscript();
                }
            },
            onChunk: async (chunk) => {
                this.recordedChunkCount += 1;
                this.totalRecordedMs += chunk.durationMs;
                this.interimTranscript = `Uploading chunk ${chunk.chunkId}. Recorded ${this.recordedChunkCount} chunks / ${(this.totalRecordedMs / 1000).toFixed(0)}s.`;
                this.renderTranscript();

                try {
                    const result = await this.transcriptionClient.enqueue({
                        sessionId: this.sessionId,
                        chunkId: chunk.chunkId,
                        chunk: chunk.blob,
                        language: this.ui.getLanguage(),
                        mimeType: chunk.mimeType,
                        startMs: chunk.startMs,
                        endMs: chunk.endMs,
                        durationMs: chunk.durationMs
                    });

                    this.applyTranscriptionResult(result);
                } catch (error) {
                    this.handleError(error.message);
                }
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
            this.ui.showBrowserWarning('Recording requires HTTPS or localhost plus a browser that supports MediaRecorder.');
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
                this.interimTranscript = 'Language updated. New chunks will be uploaded with the new language value.';
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
            this.ui.showError('Filler list has been reset.');
        });
    }

    exportTranscriptAsTxt() {
        const content = this.finalTranscript.trim();
        if (!content) {
            this.ui.showError('There is no transcript to export yet.');
            return;
        }

        const now = new Date();
        const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
        const fileContent = `Speech transcript export
Exported at: ${now.toLocaleString('zh-TW')}
Language: ${this.ui.getLanguage()}
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
        this.recordedChunkCount = 0;
        this.totalRecordedMs = 0;
        this.sessionId = '';
        this.fillerManager.clearCounts();
        this.renderTranscript();
        this.renderFillerAnalysis();
    }

    applyTranscriptionResult(result) {
        if (result.appendText) {
            this.finalTranscript += result.appendText;
            this.fillerManager.analyzeText(result.appendText);
        }

        const queueCount = this.transcriptionClient.getPendingCount();
        this.interimTranscript = result.text || `Chunk ${result.chunkId} uploaded. Pending uploads: ${queueCount}.`;
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

    createSessionId() {
        if (typeof crypto?.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    handleError(message) {
        if (this.audioCapture.getRecordingState()) {
            this.audioCapture.stop();
        } else {
            this.ui.updateStatus('stopped', 'Recording stopped');
            this.ui.setListeningState(false);
        }

        this.ui.showError(message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SpeechToTextApp();
});
