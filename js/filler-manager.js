import { escapeRegex } from './utils.js';

export class FillerManager {
    constructor() {
        this.defaultFillerWords = [
            '然後', '那個', '嗯', '啊', '呃', '對',
            '就', '應該', '大概',
            '就是說', '怎麼說', '怎麼講', '什麼', '之類的',
            '那', '這樣', '這樣子', '那樣'
        ];

        this.fillerWords = [...this.defaultFillerWords];
        this.fillerCounts = {};
    }

    getWords() {
        return [...this.fillerWords];
    }

    getCounts() {
        return { ...this.fillerCounts };
    }

    addWord(word) {
        const newWord = word.trim();
        if (!newWord) {
            return { success: false, message: '請輸入詞語' };
        }

        if (this.fillerWords.includes(newWord)) {
            return { success: false, message: '這個詞已經在清單中' };
        }

        this.fillerWords.push(newWord);
        return { success: true };
    }

    removeWord(word) {
        this.fillerWords = this.fillerWords.filter(item => item !== word);
        delete this.fillerCounts[word];
    }

    resetWords() {
        this.fillerWords = [...this.defaultFillerWords];
        this.fillerCounts = {};
    }

    clearCounts() {
        this.fillerCounts = {};
    }

    analyzeText(text) {
        this.fillerWords.forEach(filler => {
            const escaped = escapeRegex(filler);
            const regex = new RegExp(escaped, 'g');
            const matches = text.match(regex);

            if (matches) {
                this.fillerCounts[filler] = (this.fillerCounts[filler] || 0) + matches.length;
            }
        });
    }

    recalculateFromTranscript(fullTranscript) {
        this.clearCounts();
        if (fullTranscript.trim()) {
            this.analyzeText(fullTranscript);
        }
    }

    getSortedFillers() {
        return Object.entries(this.fillerCounts)
            .sort((a, b) => b[1] - a[1])
            .filter(([_, count]) => count > 0);
    }

    getSummary(totalWords) {
        const sortedFillers = this.getSortedFillers();
        const totalFillerCount = sortedFillers.reduce((sum, [_, count]) => sum + count, 0);
        const rate = totalWords > 0 ? ((totalFillerCount / totalWords) * 100).toFixed(1) : '0';

        return {
            totalFillerCount,
            rate,
            sortedFillers
        };
    }
}
