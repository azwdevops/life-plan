/** Repeating chime until stopped or `maxDurationMs` elapses. */

const ALARM_MAX_DURATION_MS = 30_000;
const CHIME_INTERVAL_MS = 2_000;
export const COUNTDOWN_ALARM_MAX_DURATION_MS = 60_000;
const COUNTDOWN_CHIME_INTERVAL_MS = 3_800;

export type BlockEndAlarmHandle = { stop: () => void };

type AlarmOptions = {
  maxDurationMs: number;
  intervalMs: number;
  play: (ctx: AudioContext, index: number) => void;
};

function playChime(ctx: AudioContext): void {
  const base = ctx.currentTime;
  const freqs = [880, 660];
  const peakGain = 0.3;
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = base + i * 0.1;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.012, start + 0.32);
    osc.start(start);
    osc.stop(start + 0.34);
  });
}

/** Metallic swizz call typical of Kenyan village/golden weavers. */
function playWeaverSwizz(
  ctx: AudioContext,
  destination: AudioNode,
  start: number,
  carrierHz: number,
  duration: number,
  gainPeak: number
): void {
  const carrier = ctx.createOscillator();
  const flutter = ctx.createOscillator();
  const flutterDepth = ctx.createGain();
  const band = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  carrier.type = "sawtooth";
  carrier.frequency.value = carrierHz;
  flutter.type = "sine";
  flutter.frequency.value = 32;
  flutterDepth.gain.value = carrierHz * 0.11;
  flutter.connect(flutterDepth);
  flutterDepth.connect(carrier.frequency);

  band.type = "bandpass";
  band.frequency.value = 2900;
  band.Q.value = 3.2;

  carrier.connect(band);
  band.connect(gain);
  gain.connect(destination);

  const end = start + duration;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.006);
  gain.gain.setValueAtTime(gainPeak * 0.85, start + duration * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.001, end);

  carrier.start(start);
  flutter.start(start);
  carrier.stop(end + 0.02);
  flutter.stop(end + 0.02);
}

/** Sweet descending whistle after the swizz sequence. */
function playWeaverWhistle(
  ctx: AudioContext,
  destination: AudioNode,
  start: number,
  fromHz: number,
  toHz: number,
  duration: number,
  gainPeak: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(fromHz, start);
  osc.frequency.exponentialRampToValueAtTime(Math.max(600, toHz), start + duration);
  osc.connect(gain);
  gain.connect(destination);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

/** Short wheezing chatter at the end of a weaver phrase. */
function playWeaverChatter(
  ctx: AudioContext,
  destination: AudioNode,
  start: number,
  bursts: number
): void {
  for (let i = 0; i < bursts; i += 1) {
    const t = start + i * 0.07;
    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let s = 0; s < bufferSize; s += 1) {
      data[s] = (Math.random() * 2 - 1) * (1 - s / bufferSize);
    }
    const src = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buffer;
    bp.type = "bandpass";
    bp.frequency.value = 3600 + i * 180;
    bp.Q.value = 4;
    src.connect(bp);
    bp.connect(gain);
    gain.connect(destination);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.38, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    src.start(t);
    src.stop(t + 0.05);
  }
}

/** Kenyan weaver-style phrase: swizz bursts, whistle drop, chatter tail. */
function playKenyanWeaverSong(ctx: AudioContext, phraseIndex: number): void {
  const base = ctx.currentTime;
  const variant = phraseIndex % 3;

  const boost = ctx.createGain();
  boost.gain.value = 1.85;
  boost.connect(ctx.destination);

  const presence = ctx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 3000;
  presence.Q.value = 0.8;
  presence.gain.value = 5;
  presence.connect(boost);

  const hiPass = ctx.createBiquadFilter();
  hiPass.type = "highpass";
  hiPass.frequency.value = 850;
  hiPass.connect(presence);

  const swizzSets: Array<{ delay: number; hz: number; dur: number; gain: number }> =
    variant === 0
      ? [
          { delay: 0, hz: 2100, dur: 0.09, gain: 0.68 },
          { delay: 0.11, hz: 2350, dur: 0.08, gain: 0.64 },
          { delay: 0.21, hz: 2600, dur: 0.1, gain: 0.62 },
        ]
      : variant === 1
        ? [
            { delay: 0, hz: 1950, dur: 0.1, gain: 0.66 },
            { delay: 0.13, hz: 2200, dur: 0.09, gain: 0.63 },
            { delay: 0.24, hz: 2480, dur: 0.11, gain: 0.6 },
            { delay: 0.38, hz: 2700, dur: 0.08, gain: 0.58 },
          ]
        : [
            { delay: 0, hz: 2300, dur: 0.08, gain: 0.65 },
            { delay: 0.1, hz: 2550, dur: 0.09, gain: 0.62 },
            { delay: 0.2, hz: 2800, dur: 0.1, gain: 0.6 },
          ];

  for (const swizz of swizzSets) {
    playWeaverSwizz(ctx, hiPass, base + swizz.delay, swizz.hz, swizz.dur, swizz.gain);
  }

  const whistleStart = base + swizzSets[swizzSets.length - 1].delay + 0.28;
  playWeaverWhistle(
    ctx,
    hiPass,
    whistleStart,
    variant === 1 ? 4200 : 3900,
    variant === 2 ? 2400 : 2600,
    0.22,
    0.5
  );

  playWeaverChatter(ctx, hiPass, whistleStart + 0.18, variant === 0 ? 3 : 4);

  const replyStart = base + 0.95;
  playWeaverSwizz(ctx, hiPass, replyStart, 2050, 0.085, 0.44);
  playWeaverSwizz(ctx, hiPass, replyStart + 0.12, 2280, 0.08, 0.42);
  playWeaverWhistle(ctx, hiPass, replyStart + 0.26, 3600, 2800, 0.16, 0.4);
}

function startAlarm(
  options: AlarmOptions,
  onEnd?: () => void
): BlockEndAlarmHandle {
  let stopped = false;
  let chimeIndex = 0;
  const ctx = new AudioContext();

  const tick = () => {
    if (stopped) return;
    const index = chimeIndex;
    chimeIndex += 1;
    ctx
      .resume()
      .then(() => options.play(ctx, index))
      .catch(() => {});
  };

  function cleanup() {
    if (stopped) return;
    stopped = true;
    clearInterval(intervalId);
    clearTimeout(timeoutId);
    ctx.close().catch(() => {});
    onEnd?.();
  }

  tick();
  const intervalId = setInterval(tick, options.intervalMs);
  const timeoutId = setTimeout(cleanup, options.maxDurationMs);

  return {
    stop: cleanup,
  };
}

/**
 * Starts reminder chimes (every ~2s) for up to 30s. Call `stop()` to end early.
 * Uses Web Audio; may fail silently if autoplay is blocked until user interaction.
 */
export function startBlockEndAlarm(onEnd?: () => void): BlockEndAlarmHandle {
  return startAlarm(
    {
      maxDurationMs: ALARM_MAX_DURATION_MS,
      intervalMs: CHIME_INTERVAL_MS,
      play: (ctx, _index) => playChime(ctx),
    },
    onEnd
  );
}

/** Kenyan weaver bird song for up to 60s when a countdown finishes. */
export function startCountdownEndAlarm(onEnd?: () => void): BlockEndAlarmHandle {
  return startAlarm(
    {
      maxDurationMs: COUNTDOWN_ALARM_MAX_DURATION_MS,
      intervalMs: COUNTDOWN_CHIME_INTERVAL_MS,
      play: (ctx, index) => playKenyanWeaverSong(ctx, index),
    },
    onEnd
  );
}
