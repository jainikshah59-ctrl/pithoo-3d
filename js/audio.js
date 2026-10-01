/* Pithoo 3D — tiny WebAudio synth for game SFX. No audio files needed. */
(function () {
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem("pt_muted") === "1"; } catch (e) {}

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  function noise(dur, vol, lowpass, delay) {
    if (!ensure()) return;
    try {
      const t = ctx.currentTime + (delay || 0);
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = lowpass || 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
    } catch (e) {}
  }

  const sfx = {
    unlock() { ensure(); if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {}); },
    click()  { tone(620, 0.07, "triangle", 0.18); },
    whoosh() { noise(0.28, 0.22, 1800); tone(300, 0.25, "sine", 0.1, 900); },
    // stones clattering: burst + a few staggered knocks
    clatter(n) {
      noise(0.16, 0.3, 2600);
      const hits = Math.min(n || 3, 6);
      for (let i = 0; i < hits; i++) {
        tone(900 + Math.random() * 700, 0.05, "square", 0.1, 300, i * 0.045);
      }
      tone(140, 0.18, "sine", 0.25, 60);
    },
    bounce() { tone(240, 0.07, "sine", 0.12, 140); },
    pickup() { tone(520, 0.08, "triangle", 0.2, 780); },
    place()  { tone(180, 0.12, "sine", 0.3, 90); tone(880, 0.06, "triangle", 0.14, 660, 0.05); },
    thud()   { noise(0.2, 0.35, 500); tone(110, 0.25, "sine", 0.3, 45); },
    whistle(){ tone(2100, 0.16, "sine", 0.2); tone(2600, 0.28, "sine", 0.2, 2400, 0.18); },
    cheer()  {
      noise(0.9, 0.18, 4000);
      [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.14, "triangle", 0.18, null, i * 0.11));
    },
    lose()   { tone(300, 0.4, "sawtooth", 0.18, 90); tone(200, 0.5, "sawtooth", 0.15, 70, 0.25); },
    pro()    { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.22), i * 85)); }
  };

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem("pt_muted", muted ? "1" : "0"); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 0.5;
  }
  function isMuted() { return muted; }

  PT.audio = { sfx, setMuted, isMuted, unlock: sfx.unlock };
})();
