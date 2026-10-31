let audio: AudioContext | null = null;

/** Browsers only allow sound after a tap, so this runs when a set is ticked. */
export function prepareAlertSound(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    // Sound isn't available here. The on-screen message still appears.
  }
}

function beep(context: AudioContext, startsAt: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.25, startsAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startsAt + 0.25);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + 0.25);
}

/** Vibrates where supported (not on iPhone) and plays two short beeps. */
export function playRestAlert(): void {
  navigator.vibrate?.([200, 100, 200]);
  if (!audio) return;
  try {
    beep(audio, audio.currentTime);
    beep(audio, audio.currentTime + 0.35);
  } catch {
    // Sound isn't available here. The on-screen message still appears.
  }
}
