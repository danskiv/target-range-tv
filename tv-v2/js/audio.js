/* ==========================================================================
   Range Shooter v2 — Audio (Hybrid)
   --------------------------------------------------------------------------
   Web Audio API procedural SFX (laser, hit, explosion, reload, countdown)
   + Speech Synthesis English announcer ("Three… Two… One… FIRE!",
   "Bullseye!", "Combo x3!", "Time's up!").
   Never blocks the render frame — all nodes are fire-and-forget.
   ========================================================================== */

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.muted = false;
        this.masterGain = null;
        this.noiseBuffer = null;
        this.announcerEnabled = true;
    }

    init() {
        if (!this.initialized) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            this.ctx = new AudioCtx();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.85;
            this.masterGain.connect(this.ctx.destination);
            this._buildNoiseBuffer();
            this.initialized = true;
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    setMuted(m) {
        this.muted = !!m;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : 0.85;
        }
    }

    _buildNoiseBuffer() {
        const len = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.noiseBuffer = buffer;
    }

    _tone(freq, dur, type = 'sine', vol = 0.5, freqEnd = null, when = 0) {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime + when;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + dur);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + dur + 0.02);
    }

    _noise(dur, filterFreq, type = 'lowpass', vol = 0.5, when = 0, freqEnd = null) {
        if (!this.ctx || this.muted || !this.noiseBuffer) return;
        const now = this.ctx.currentTime + when;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.setValueAtTime(filterFreq, now);
        if (freqEnd) filter.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + dur);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        src.start(now);
        src.stop(now + dur + 0.02);
    }

    /* ---------------- SFX ---------------- */

    playFire() {
        // Laser-ish pew: descending square + noise snap
        this._tone(880, 0.09, 'square', 0.28, 220);
        this._noise(0.08, 4000, 'highpass', 0.22, 0, 400);
    }

    playHit() {
        this._tone(420, 0.09, 'triangle', 0.4, 140);
    }

    playBullseye() {
        this._tone(1318, 0.18, 'sine', 0.35);
        this._tone(1760, 0.25, 'sine', 0.3, null, 0.08);
    }

    playExplosion() {
        this._noise(0.5, 900, 'lowpass', 0.7, 0, 60);
        this._tone(110, 0.4, 'sine', 0.5, 40);
    }

    playEnergyBlast() {
        this._tone(220, 0.3, 'sawtooth', 0.3, 880);
        this._noise(0.3, 3000, 'bandpass', 0.3, 0, 200);
    }

    playPenalty() {
        this._tone(160, 0.35, 'sawtooth', 0.45, 110);
        this._tone(120, 0.4, 'sawtooth', 0.4, 90, 0.15);
    }

    playReload() {
        this._tone(600, 0.05, 'sine', 0.3, 400);
        this._tone(900, 0.07, 'triangle', 0.35, 700, 0.12);
    }

    playDryFire() {
        this._tone(300, 0.04, 'square', 0.18, 150);
    }

    playCountdownTick() {
        this._tone(660, 0.08, 'sine', 0.3);
    }

    playStartHorn() {
        this._tone(440, 0.4, 'sawtooth', 0.35, 660);
        this._tone(880, 0.5, 'sawtooth', 0.3, 1100, 0.05);
    }

    playGameOver() {
        this._tone(660, 0.25, 'sine', 0.35, 440);
        this._tone(440, 0.3, 'sine', 0.3, 330, 0.2);
        this._tone(330, 0.6, 'sine', 0.3, 220, 0.4);
    }

    playWaveStart() {
        this._tone(520, 0.15, 'triangle', 0.35, 780);
        this._tone(780, 0.2, 'triangle', 0.3, 1040, 0.12);
    }

    /* ---------------- English announcer (Speech Synthesis) ---------------- */

    _announce(text, rate = 1.05) {
        if (!this.announcerEnabled) return;
        if (!('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'en-US';
            u.rate = rate;
            u.pitch = 1.0;
            u.volume = 0.9;
            // Prefer a premium English voice when available.
            const voices = window.speechSynthesis.getVoices();
            const preferred = voices.find((v) => /en[-_](US|GB)/i.test(v.lang) && /(natural|premium|google|microsoft|neural)/i.test(v.name));
            const anyEn = preferred || voices.find((v) => /^en/i.test(v.lang));
            if (anyEn) u.voice = anyEn;
            window.speechSynthesis.speak(u);
        } catch (e) {
            /* speech is best-effort — never crash the game */
        }
    }

    announceCountdown(n) {
        if (n === 3) this._announce('Three');
        else if (n === 2) this._announce('Two');
        else if (n === 1) this._announce('One');
    }

    announceFire() {
        this._announce('Fire!', 1.2);
    }

    announceBullseye() {
        this._announce('Bullseye!', 1.15);
    }

    announceCombo(mult) {
        this._announce(`Combo times ${mult}!`, 1.1);
    }

    announceWave(wave) {
        this._announce(`Wave ${wave}`, 1.05);
    }

    announceTimesUp() {
        this._announce("Time's up!", 1.05);
    }

    announceCalibReady() {
        this._announce('Calibration. Aim and fire at the target.', 0.95);
    }

    announceCalibDone() {
        this._announce('Calibration complete.', 1.0);
    }
}

window.audioEngine = new AudioEngine();
