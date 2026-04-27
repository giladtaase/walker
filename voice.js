/**
 * Hebrew voice recognition using Web Speech API.
 * Commands: ימינה (right), שמאלה (left), למעלה (up), למטה (down)
 */
class VoiceController {
    constructor(onCommand) {
        this.onCommand = onCommand;
        this.recognition = null;
        this.isListening = false;
        this.supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        this.lastInterimCommand = null;

        if (this.supported) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'he-IL';
            this.recognition.continuous = true;
            this.recognition.interimResults = true;  // React faster to speech
            this.recognition.maxAlternatives = 5;

            this.recognition.onresult = (event) => this.handleResult(event);
            this.recognition.onerror = (event) => this.handleError(event);
            this.recognition.onend = () => this.handleEnd();
        }
    }

    start() {
        if (!this.supported) {
            alert('הדפדפן לא תומך בזיהוי קולי. נסה Chrome.');
            return false;
        }
        try {
            this.recognition.start();
            this.isListening = true;
            return true;
        } catch (e) {
            return false;
        }
    }

    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    handleResult(event) {
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];

            // Check all alternatives (both interim and final)
            for (let j = 0; j < result.length; j++) {
                const transcript = result[j].transcript.trim();
                console.log(`[Voice] ${result.isFinal ? 'FINAL' : 'interim'}[${j}]: "${transcript}"`);

                // Parse the LAST command from the transcript
                // (API sometimes concatenates: "למטה ימינה" → we want "ימינה")
                const direction = this.parseLastCommand(transcript);
                if (direction) {
                    if (!result.isFinal) {
                        if (this.lastInterimCommand !== direction) {
                            this.lastInterimCommand = direction;
                            this.onCommand(direction, transcript);
                        }
                    } else {
                        this.lastInterimCommand = null;
                        this.onCommand(direction, transcript);
                    }
                    return;
                }
            }

            // Final result with no match — show what was heard
            if (result.isFinal) {
                this.lastInterimCommand = null;
                const heard = result[0].transcript.trim();
                this.onCommand(null, heard);
            }
        }
    }

    /**
     * Find the LAST recognized command in a transcript.
     * Handles concatenated results like "למטה ימינה" → returns 'right'.
     */
    parseLastCommand(text) {
        const normalized = text
            .replace(/[\u0591-\u05C7]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const words = normalized.split(' ');
        let lastDir = null;

        // Scan all words, keep the last matching command
        for (const word of words) {
            const dir = this.matchWord(word);
            if (dir) lastDir = dir;
        }

        // If no word-level match, try the full text as exact match
        if (!lastDir) {
            lastDir = this.exactMatch(normalized);
        }

        return lastDir;
    }

    /**
     * Match a single word — exact then fuzzy.
     */
    matchWord(word) {
        return this.exactMatchWord(word) || this.fuzzyMatch(word);
    }

    exactMatchWord(word) {
        // Stop
        if (/^(עצור|עצרי|סטופ|תעצור|סטאפ|סטוף)$/.test(word)) return 'stop';
        // Right
        if (/^(ימינה|ימין|לימין|ימנה)$/.test(word)) return 'right';
        // Left
        if (/^(שמאלה|שמאל|לשמאל)$/.test(word)) return 'left';
        // Up
        if (/^(למעלה|מעלה)$/.test(word)) return 'up';
        // Down
        if (/^(למטה|מטה)$/.test(word)) return 'down';
        return null;
    }

    exactMatch(text) {
        // Substring match on full text (for partial interim results)
        if (/עצור|עצרי|סטופ|תעצור|סטאפ|סטוף/.test(text)) return 'stop';
        if (/ימינה|ימין|לימין|ימנה/.test(text)) return 'right';
        if (/שמאל/.test(text)) return 'left';
        if (/מעל/.test(text)) return 'up';
        if (/מט/.test(text)) return 'down';
        return null;
    }

    fuzzyMatch(word) {
        if (word.length < 3) return null;  // Avoid matching tiny fragments like "ימ"

        // command → [target words, max allowed distance]
        const commands = [
            { dir: 'stop',  words: ['עצור', 'עצרי', 'סטופ'], maxDist: 2 },
            { dir: 'right', words: ['ימינה', 'ימין'], maxDist: 2 },
            { dir: 'left',  words: ['שמאלה', 'שמאל'], maxDist: 2 },
            { dir: 'up',    words: ['למעלה', 'מעלה'], maxDist: 2 },
            { dir: 'down',  words: ['למטה', 'מטה'], maxDist: 2 },
        ];

        let bestDir = null;
        let bestDist = Infinity;

        for (const cmd of commands) {
            for (const target of cmd.words) {
                const dist = this.levenshtein(word, target);
                if (dist <= cmd.maxDist && dist < bestDist) {
                    bestDist = dist;
                    bestDir = cmd.dir;
                }
            }
        }

        if (bestDir) {
            console.log(`[Voice] Fuzzy matched "${word}" → ${bestDir} (distance: ${bestDist})`);
        }
        return bestDir;
    }

    levenshtein(a, b) {
        const m = a.length, n = b.length;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                dp[i][j] = Math.min(
                    dp[i - 1][j] + 1,      // deletion
                    dp[i][j - 1] + 1,      // insertion
                    dp[i - 1][j - 1] + cost // substitution
                );
            }
        }
        return dp[m][n];
    }

    handleError(event) {
        if (event.error === 'no-speech') return; // Ignore silence
        if (event.error === 'aborted') return;
        console.warn('Speech recognition error:', event.error);
    }

    handleEnd() {
        // Auto-restart if still supposed to be listening
        if (this.isListening) {
            try {
                this.recognition.start();
            } catch (e) {
                this.isListening = false;
            }
        }
    }
}
