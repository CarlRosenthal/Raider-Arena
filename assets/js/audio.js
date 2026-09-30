// Web Audio effects. Audio starts only after an operator gesture.
let engineSound = null;
const soundVoices = new Set();
function unlockAudio() {
  if (!sound) return false;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    return true;
  } catch {
    return false;
  }
}
function tone(freq, duration = 0.08, delay = 0, type = "sine", volume = 0.035) {
  if (!sound || !audio) return;
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  const at = audio.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(freq, at);
  gain.gain.setValueAtTime(0, audio.currentTime);
  gain.gain.setValueAtTime(0.001, at);
  gain.gain.linearRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  soundVoices.add(oscillator);
  oscillator.onended = () => {
    soundVoices.delete(oscillator);
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}
function ping(freq = 600, duration = 0.08) {
  if (unlockAudio()) tone(freq, duration);
}
function celebrate(won = true) {
  if (!sound || !audio) return;
  if (!won) {
    tone(330, 0.2);
    tone(220, 0.35, 0.18);
    return;
  }
  // Short rising stadium-style fanfare, ending on a major chord.
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(f, i === 3 ? 0.65 : 0.18, i * 0.14, "triangle", 0.075);
    tone(f / 2, 0.2, i * 0.14, "triangle", 0.035);
  });
  [523.25, 659.25, 783.99].forEach((f) =>
    tone(f, 0.75, 0.65, "triangle", 0.045),
  );
}
function stopEngine() {
  if (!engineSound) return;
  for (const voice of engineSound.voices) {
    voice.stop();
    voice.disconnect();
  }
  engineSound.gain.disconnect();
  engineSound.filter.disconnect();
  engineSound = null;
}
function stopSounds() {
  stopEngine();
  for (const voice of soundVoices) {
    try {
      voice.stop();
    } catch {}
  }
  soundVoices.clear();
}
function updateEngineSound() {
  if (!sound || !audio || paused || game !== "race" || phase !== "racing") {
    stopEngine();
    return;
  }
  if (!engineSound) {
    const gain = audio.createGain(),
      filter = audio.createBiquadFilter();
    gain.gain.value = 0.025;
    filter.type = "lowpass";
    filter.frequency.value = 650;
    filter.connect(gain);
    gain.connect(audio.destination);
    const voices = [0, 1, 2].map(() => {
      const voice = audio.createOscillator();
      voice.type = "sawtooth";
      voice.connect(filter);
      voice.start();
      return voice;
    });
    engineSound = { voices, gain, filter };
  }
  const progress = clamp(elapsed / race.duration);
  engineSound.voices.forEach((voice, i) => {
    const rev =
      58 + i * 17 + progress * 85 + 14 * Math.sin(elapsed * 0.006 + i * 2);
    voice.frequency.setTargetAtTime(rev, audio.currentTime, 0.06);
  });
}
