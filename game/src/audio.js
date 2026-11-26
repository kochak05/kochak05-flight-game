// audio.js — procedural sound, no audio files: engine hum, wind, chimes.
// One job: turn flight state into sound. Silent until the player gestures.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let started = false;

  function start() {
    if (started) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      ctx = new AudioContext();
      started = true;

      // Engine: a sawtooth plus a sub sine, through a low-pass filter.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sine';
      engineOsc2.frequency.value = 28;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();

      // Wind: looped noise through a band-pass, louder with speed.
      const len = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSource = ctx.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 600;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0.0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      windSource.start();
    } catch (err) {
      started = false;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + when);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + when + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + when);
      osc.stop(ctx.currentTime + when + dur + 0.05);
    } catch (err) {
      /* sound is optional */
    }
  }

  return {
    start,
    update(plane, flying) {
      if (!ctx || !started) return;
      try {
        if (ctx.state === 'suspended') ctx.resume();
        const throttle = plane ? plane.throttle : 0;
        const speed = plane ? plane.speed : 0;
        const hum = 42 + throttle * 55 + speed * 0.12;
        engineOsc.frequency.setTargetAtTime(hum, ctx.currentTime, 0.1);
        engineOsc2.frequency.setTargetAtTime(hum / 2, ctx.currentTime, 0.1);
        engineFilter.frequency.setTargetAtTime(240 + throttle * 900, ctx.currentTime, 0.1);
        engineGain.gain.setTargetAtTime(flying ? 0.045 + throttle * 0.05 : 0.0, ctx.currentTime, 0.15);
        windGain.gain.setTargetAtTime(flying ? Math.min(0.06, speed * 0.00045) : 0.0, ctx.currentTime, 0.2);
        windFilter.frequency.setTargetAtTime(400 + speed * 6, ctx.currentTime, 0.2);
      } catch (err) {
        /* sound is optional */
      }
    },
    ring() {
      tone(880, 0.18, 'sine', 0.16);
      tone(1318, 0.3, 'sine', 0.14, 0.09);
    },
    warning() {
      tone(660, 0.12, 'square', 0.06);
      tone(660, 0.12, 'square', 0.06, 0.18);
    },
    touchdown() {
      tone(70, 0.35, 'sine', 0.3);
      tone(140, 0.2, 'sine', 0.15, 0.05);
    },
    crash() {
      if (!ctx) return;
      try {
        const len = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const gain = ctx.createGain();
        gain.gain.value = 0.25;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
      } catch (err) {
        /* sound is optional */
      }
      tone(55, 0.6, 'sine', 0.25);
    },
  };
}
