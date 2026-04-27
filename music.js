/**
 * Procedural chiptune music generator using Web Audio API.
 * Generates an exciting, upbeat looping track.
 */
class MusicPlayer {
    constructor(audioCtx, outputNode) {
        this.audioCtx = audioCtx;
        this.masterGain = audioCtx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(outputNode || audioCtx.destination);
        this.playing = false;
        this.scheduledSources = [];
        this.loopTimer = null;

        // Musical constants
        this.BPM = 140;
        this.beatDuration = 60 / this.BPM;
        this.barDuration = this.beatDuration * 4;

        // Scale: C minor pentatonic for exciting feel
        this.scale = [262, 311, 349, 392, 466, 523, 622, 698, 784, 932, 1047];

        // Bass notes (C minor progression)
        this.bassProgression = [
            [131, 131, 156, 156],  // Cm - Eb
            [175, 175, 196, 196],  // F  - G
            [131, 131, 196, 196],  // Cm - G
            [156, 156, 175, 175],  // Eb - F
        ];

        // Melody patterns (scale indices)
        this.melodyPatterns = [
            [4, -1, 5, -1, 6, -1, 5, 4],
            [6, 7, 6, 5, 4, -1, 3, -1],
            [3, 4, 5, 6, 7, 6, 5, 4],
            [7, -1, 6, 5, 4, 3, 4, -1],
        ];
    }

    start() {
        if (this.playing) return;
        this.playing = true;

        // Resume audio context if suspended (browser autoplay policy)
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.currentBar = 0;
        this.scheduleLoop();
    }

    stop() {
        this.playing = false;
        if (this.loopTimer) {
            clearTimeout(this.loopTimer);
            this.loopTimer = null;
        }
        // Stop all scheduled sources
        this.scheduledSources.forEach(src => {
            try { src.stop(); } catch (e) {}
        });
        this.scheduledSources = [];
    }

    scheduleLoop() {
        if (!this.playing) return;

        const now = this.audioCtx.currentTime + 0.05; // Small lookahead
        const barIdx = this.currentBar % 4;

        this.scheduleBass(now, barIdx);
        this.scheduleMelody(now, barIdx);
        this.scheduleDrums(now);
        this.scheduleArpeggio(now, barIdx);

        this.currentBar++;

        // Schedule next bar
        this.loopTimer = setTimeout(() => {
            this.scheduleLoop();
        }, this.barDuration * 1000 - 50);
    }

    createOsc(type, freq, startTime, duration, volume = 0.15) {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(startTime);
        osc.stop(startTime + duration);
        this.scheduledSources.push(osc);
        return osc;
    }

    createNoise(startTime, duration, volume = 0.05) {
        const bufferSize = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(startTime);
        noise.stop(startTime + duration);
        this.scheduledSources.push(noise);
    }

    scheduleBass(startTime, barIdx) {
        const notes = this.bassProgression[barIdx];
        for (let i = 0; i < 4; i++) {
            const t = startTime + i * this.beatDuration;
            this.createOsc('sawtooth', notes[i], t, this.beatDuration * 0.8, 0.12);
        }
    }

    scheduleMelody(startTime, barIdx) {
        const pattern = this.melodyPatterns[barIdx];
        const eighthNote = this.beatDuration / 2;
        for (let i = 0; i < 8; i++) {
            const noteIdx = pattern[i];
            if (noteIdx === -1) continue; // rest
            const t = startTime + i * eighthNote;
            this.createOsc('square', this.scale[noteIdx], t, eighthNote * 0.7, 0.08);
        }
    }

    scheduleDrums(startTime) {
        for (let i = 0; i < 4; i++) {
            const t = startTime + i * this.beatDuration;
            // Kick on every beat
            this.createOsc('sine', 80, t, 0.15, 0.2);
            // Hi-hat on every eighth note
            this.createNoise(t, 0.05, 0.04);
            this.createNoise(t + this.beatDuration / 2, 0.05, 0.03);
            // Snare on beats 2 and 4
            if (i === 1 || i === 3) {
                this.createNoise(t, 0.12, 0.08);
                this.createOsc('triangle', 180, t, 0.1, 0.1);
            }
        }
    }

    scheduleArpeggio(startTime, barIdx) {
        const sixteenth = this.beatDuration / 4;
        const baseIdx = barIdx % 2 === 0 ? 0 : 2;
        const arpNotes = [
            this.scale[baseIdx],
            this.scale[baseIdx + 2],
            this.scale[baseIdx + 4],
            this.scale[baseIdx + 2],
        ];
        for (let i = 0; i < 16; i++) {
            const t = startTime + i * sixteenth;
            this.createOsc('triangle', arpNotes[i % 4], t, sixteenth * 0.6, 0.04);
        }
    }

    setVolume(vol) {
        this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
}
