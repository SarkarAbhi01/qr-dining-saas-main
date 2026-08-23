// Synthesizes short alert tones with the Web Audio API instead of
// depending on an external mp3 asset — no network fetch, no licensing
// concerns, and it fires instantly with zero load time. Different event
// types get a distinct little "melody" so staff can tell them apart by
// ear without looking at the screen (new order vs. table calling vs.
// payment ready), the way a real KDS bump bar or POS bell would.

let audioCtx = null;
function getContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  // Browsers suspend the context until a user gesture unlocks it; resume
  // defensively so the first alert after page load isn't silently dropped.
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(ctx, { frequency, startTime, duration, gain = 0.2 }) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequency, startTime);

  // Quick attack, gentle release — avoids a harsh click at the edges.
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gainNode).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

const PATTERNS = {
  // New order hitting the kitchen — bright double-tap, like a bump bar.
  newOrder: [
    { frequency: 880, offset: 0, duration: 0.12 },
    { frequency: 1108, offset: 0.13, duration: 0.16 },
  ],
  // Order ready to serve — a calmer two-note "ding-dong".
  orderReady: [
    { frequency: 988, offset: 0, duration: 0.18 },
    { frequency: 740, offset: 0.2, duration: 0.22 },
  ],
  // Customer call (Call Waiter / Request Bill) — three quick chimes,
  // slightly more urgent so it stands out from routine updates.
  call: [
    { frequency: 1046, offset: 0, duration: 0.1 },
    { frequency: 1046, offset: 0.14, duration: 0.1 },
    { frequency: 1046, offset: 0.28, duration: 0.14 },
  ],
  // Payment ready for collection — a lower, single confident tone.
  payment: [{ frequency: 660, offset: 0, duration: 0.28 }],
};

const STORAGE_KEY = 'qr-dining-sound-enabled';

export function isSoundEnabled() {
  if (typeof window === 'undefined') return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === 'true';
}

export function setSoundEnabled(enabled) {
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
}

/**
 * Plays a short synthesized alert. `kind` is one of:
 * 'newOrder' | 'orderReady' | 'call' | 'payment'
 */
export function playNotificationSound(kind = 'newOrder') {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;

  const pattern = PATTERNS[kind] || PATTERNS.newOrder;
  const now = ctx.currentTime;
  pattern.forEach((note) => {
    playTone(ctx, { frequency: note.frequency, startTime: now + note.offset, duration: note.duration });
  });
}
