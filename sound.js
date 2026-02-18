
class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.isMuted = false;
        this.initialized = false;

        // Music State
        this.isPlayingMusic = false;
        this.nextNoteTime = 0;
        this.noteIndex = 0;
        this.tempo = 100;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.timerID = null;

        // Melodies (Array of frequencies or note names)
        // Keep it simple
        this.noteFreqs = {
            'C3': 130.81, 'D#3': 155.56, 'F3': 174.61, 'G3': 196.00, 'A#3': 233.08,
            'C4': 261.63, 'E4': 329.63, 'G4': 392.00, 'B4': 493.88, 'C5': 523.25
        };

        this.melodyClicker = ['C4', 'E4', 'G4', 'B4', 'C4', 'G4', 'E4', 'C5'];
        this.melodyRunner = ['C3', 'C3', 'G3', 'A#3', 'C3', 'D#3', 'G3', 'F3'];

        this.currentMode = 'clicker';
    }

    init() {
        if (this.initialized) {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    console.log('Audio Context Resumed');
                }).catch(e => console.error(e));
            }
            return;
        }

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            this.initialized = true;
            console.log('SoundManager Initialized');

            // Unlock audio on iOS/Browsers
            this.unlockAudio();

        } catch (e) {
            console.error('Audio Init Failed:', e);
            this.showError('Audio Init Failed');
        }
    }

    unlockAudio() {
        const unlock = () => {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    // Remove listeners once resumed
                    document.removeEventListener('touchstart', unlock);
                    document.removeEventListener('click', unlock);
                    document.removeEventListener('keydown', unlock);
                });
            }
        };

        document.addEventListener('touchstart', unlock);
        document.addEventListener('click', unlock);
        document.addEventListener('keydown', unlock);
    }

    showError(msg) {
        if (window.showError) window.showError(msg); // If main.js exposed it
        else console.error(msg);
    }

    // --- Actions ---

    toggleMute() {
        this.isMuted = !this.isMuted;

        if (this.ctx) {
            if (this.isMuted) {
                this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
            } else {
                this.ctx.resume();
                this.masterGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            }
        }
        return this.isMuted;
    }

    playClick() {
        if (!this.initialized || this.isMuted) {
            // Try init if generic interaction happened
            if (!this.initialized) this.init();
            return;
        }

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.connect(g);
        g.connect(this.masterGain);

        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.1);

        g.gain.setValueAtTime(0.3, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.start(t);
        osc.stop(t + 0.1);
    }

    playJump() {
        if (!this.initialized || this.isMuted) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'square';
        osc.connect(g);
        g.connect(this.masterGain);

        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(600, t + 0.2);

        g.gain.setValueAtTime(0.2, t);
        g.gain.linearRampToValueAtTime(0.01, t + 0.2);

        osc.start(t);
        osc.stop(t + 0.2);
    }

    // --- Music ---

    setMode(mode) {
        this.currentMode = mode;
        this.tempo = (mode === 'runner') ? 150 : 100;
    }

    toggleMusic(shouldPlay) {
        // Ensure init
        this.init();

        if (shouldPlay) {
            if (!this.isPlayingMusic) {
                this.isPlayingMusic = true;
                this.noteIndex = 0;
                this.nextNoteTime = this.ctx.currentTime + 0.1;
                this.scheduler();
            }
        } else {
            this.isPlayingMusic = false;
            // Clear timeout normally logic handles it by checking flag
            if (this.timerID) clearTimeout(this.timerID);
        }
    }

    scheduler() {
        if (!this.isPlayingMusic) return;

        // Scheduler loop
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            if (!this.isMuted) {
                this.scheduleNote(this.noteIndex, this.nextNoteTime);
            }
            this.nextNote();
        }

        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        // 1/4th notes
        this.nextNoteTime += 0.25 * secondsPerBeat;

        this.noteIndex++;
        // Reset check handled in scheduleNote usually or here
        // Simple modulo in scheduleNote is enough
    }

    scheduleNote(beatIndex, time) {
        const melody = (this.currentMode === 'runner') ? this.melodyRunner : this.melodyClicker;
        const noteName = melody[beatIndex % melody.length];

        if (noteName) {
            this.playTone(noteName, time, 0.1);
        }

        // Beat marker (Kick) every 4 steps (1 beat)
        if (beatIndex % 4 === 0) {
            this.playBass(time);
        }
    }

    playTone(noteName, time, duration) {
        const freq = this.noteFreqs[noteName] || 440;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        osc.connect(g);
        g.connect(this.masterGain);

        g.gain.setValueAtTime(0.1, time);
        g.gain.linearRampToValueAtTime(0.01, time + duration);

        osc.start(time);
        osc.stop(time + duration);
    }

    playBass(time) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();

        osc.connect(g);
        g.connect(this.masterGain);

        osc.frequency.setValueAtTime(120, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        g.gain.setValueAtTime(0.3, time);
        g.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.start(time);
        osc.stop(time + 0.5);
    }
}

window.soundManager = new SoundManager();
