'use client';

// Browser autoplay policy AudioContext'i 'suspended' state'inde yaratır.
// İlk kullanıcı etkileşimine kadar resume edilemez. Burada modül-singleton
// olarak tutuyoruz; armNotificationSound() bir kullanıcı gesture handler'ı
// içinden çağrılmalı, sonra playNewOrderBeep() istediği zaman çalar.

let audioContext: AudioContext | null = null;
let armed = false;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

/**
 * Kullanıcı gesture'ına bağlı: bir click/keydown handler'ından çağrılmalı.
 * AudioContext suspended ise resume eder. Bir kez başarılı olunca tekrar
 * çalıştırılması no-op.
 */
export function armNotificationSound(): void {
  if (armed) return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  armed = true;
}

export function isNotificationSoundArmed(): boolean {
  return armed;
}

/**
 * Kısa, dikkat çekici ama agresif olmayan iki-tonlu "ding". Asset yok —
 * tamamen WebAudio oscillator'ları ile sentezleniyor. Context running
 * değilse sessizce çıkar; armNotificationSound() çağrılmamışsa hiç
 * duyulmaz (tarayıcı politikası).
 */
export function playNewOrderBeep(): void {
  const ctx = getContext();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  gain.connect(ctx.destination);

  // E5 → A5: kısa friendly chime.
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now);
  osc1.connect(gain);
  osc1.start(now);
  osc1.stop(now + 0.18);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(880, now + 0.14);
  osc2.connect(gain);
  osc2.start(now + 0.14);
  osc2.stop(now + 0.55);
}
