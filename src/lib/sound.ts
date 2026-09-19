/**
 * Generador de sonido de confirmación sutil mediante Web Audio API
 * No requiere archivos externos de audio, funciona offline y en todos los navegadores modernos.
 */
export function playPaymentSuccessChime(): void {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Reanudar contexto si el navegador lo suspendió por directivas de autoplay
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    // Acorde cristalino ascendente de tres tonos armoniosos (Do5 -> Mi5 -> Sol5)
    // Frecuencias: 523.25 Hz, 659.25 Hz, 783.99 Hz
    const notes = [523.25, 659.25, 783.99];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      // Envolvente de volumen suave: ataque rápido y decaimiento exponencial natural
      gain.gain.setValueAtTime(0, now + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.09 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.7);
    });
  } catch (err) {
    console.warn("[Sound Chime Warning]: No se pudo reproducir el sonido:", err);
  }
}
