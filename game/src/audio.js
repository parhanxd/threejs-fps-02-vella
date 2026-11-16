// SALTDOWN — audio: every sound synthesised with WebAudio (oscillators + filtered noise),
// no assets to load, fully offline. Short envelopes so bursts stay clean.
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
  }

  resume() { if (this.ctx) this.ctx.resume(); }

  noiseBuffer(dur) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.ceil(rate * dur), rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  shot(kind = 'rifle', gain = 1) {
    this.ensure();
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.12);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'sniper' ? 900 : kind === 'pistol' ? 1600 : 2200;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(filter).connect(env).connect(this.master);
    src.start(t);
    // body thump
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(kind === 'sniper' ? 90 : 140, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.5 * gain, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(og).connect(this.master);
    osc.start(t); osc.stop(t + 0.1);
  }

  hitmarker(head) {
    this.ensure();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = head ? 1320 : 880;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.07);
  }

  reload() {
    this.ensure();
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.05);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  beepPlant() {
    this.ensure();
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1046;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.1, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.12);
      osc.connect(g).connect(this.master);
      osc.start(t + i * 0.18); osc.stop(t + i * 0.18 + 0.13);
    }
  }

  roundEnd() {
    this.ensure();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(330, t + 0.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + 0.5);
  }

  explosion(x, z) {
    this.ensure();
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.7);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(60, t + 0.6);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
}
