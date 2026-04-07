/** Repeating chime until stopped or `ALARM_MAX_DURATION_MS` elapses. */

const ALARM_MAX_DURATION_MS = 30_000;
const CHIME_INTERVAL_MS = 2_000;

export type BlockEndAlarmHandle = { stop: () => void };

function playChime(ctx: AudioContext): void {
  const base = ctx.currentTime;
  const freqs = [880, 660];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = base + i * 0.1;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.012, start + 0.32);
    osc.start(start);
    osc.stop(start + 0.34);
  });
}

/**
 * Starts reminder chimes (every ~2s) for up to 30s. Call `stop()` to end early.
 * Uses Web Audio; may fail silently if autoplay is blocked until user interaction.
 */
export function startBlockEndAlarm(onEnd?: () => void): BlockEndAlarmHandle {
  let stopped = false;
  const ctx = new AudioContext();

  const tick = () => {
    if (stopped) return;
    ctx.resume().then(() => playChime(ctx)).catch(() => {});
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
  const intervalId = setInterval(tick, CHIME_INTERVAL_MS);
  const timeoutId = setTimeout(cleanup, ALARM_MAX_DURATION_MS);

  return {
    stop: cleanup,
  };
}
