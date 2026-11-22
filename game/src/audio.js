// Procedural WebAudio sounds. No-ops without a browser AudioContext.
export class SoundBank {
  constructor() {
    this.ctx = null; this.engineOsc = null; this.engineGain = null; this.sirenOsc = null; this.sirenGain = null;
    try {
      if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    } catch (e) { this.ctx = null; }
  }
  _tone(freq, dur, type, vol, slide) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(vol || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* ignore */ }
  }
  _noise(dur, vol) {
    if (!this.ctx) return;
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const g = this.ctx.createGain(); g.gain.value = vol || 0.15;
      src.connect(g); g.connect(this.ctx.destination); src.start();
    } catch (e) { /* ignore */ }
  }
  play(name) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    switch (name) {
      case 'shot': this._noise(0.12, 0.25); this._tone(160, 0.1, 'square', 0.12, 60); break;
      case 'punch': this._noise(0.07, 0.18); this._tone(90, 0.08, 'sine', 0.15, 50); break;
      case 'cash': this._tone(880, 0.08, 'square', 0.07); setTimeout(() => this._tone(1320, 0.12, 'square', 0.07), 70); break;
      case 'crash': this._noise(0.25, 0.3); this._tone(70, 0.25, 'sawtooth', 0.15, 40); break;
      case 'door': this._tone(220, 0.07, 'sine', 0.1, 140); break;
      case 'sting': [523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.1), i * 110)); break;
      case 'fail': this._tone(300, 0.4, 'sawtooth', 0.1, 110); break;
    }
  }
  update(world) {
    if (!this.ctx) return;
    try {
      // engine hum follows speed
      if (world.player.car && !this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator(); this.engineGain = this.ctx.createGain();
        this.engineOsc.type = 'sawtooth'; this.engineGain.gain.value = 0.02;
        this.engineOsc.connect(this.engineGain); this.engineGain.connect(this.ctx.destination); this.engineOsc.start();
      }
      if (this.engineOsc) {
        if (world.player.car) this.engineOsc.frequency.value = 55 + Math.abs(world.player.car.speed) * 0.45;
        else { this.engineOsc.stop(); this.engineOsc = null; }
      }
      // siren while wanted
      if (world.wanted > 0 && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator(); this.sirenGain = this.ctx.createGain();
        this.sirenOsc.type = 'triangle'; this.sirenGain.gain.value = 0.015;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.ctx.destination); this.sirenOsc.start();
      }
      if (this.sirenOsc) {
        if (world.wanted > 0) this.sirenOsc.frequency.value = 700 + Math.sin(world.time * 6) * 220;
        else { this.sirenOsc.stop(); this.sirenOsc = null; }
      }
    } catch (e) { /* ignore */ }
  }
}
