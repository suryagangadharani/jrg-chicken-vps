// Web Audio API Synthesizer & Sound Manager for JRG Chicken Notifications

export type SoundType = "loud_alert" | "normal_alert" | "success" | "warning";

const SETTINGS_KEY = "jrg_sound_settings_v1";

interface SoundSettings {
  soundEnabled: boolean;
  volume: number; // 0.0 to 1.0 (default 0.8)
}

function getStoredSettings(): SoundSettings {
  if (typeof window === "undefined") return { soundEnabled: true, volume: 0.8 };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { soundEnabled: true, volume: 0.8 };
}

export function saveSoundSettings(settings: Partial<SoundSettings>) {
  if (typeof window === "undefined") return;
  const current = getStoredSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

export function getSoundSettings(): SoundSettings {
  return getStoredSettings();
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private currentInterval: number | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isLocked(): boolean {
    if (typeof window === "undefined") return false;
    const ctx = this.getAudioContext();
    return !ctx || ctx.state === "suspended";
  }

  public unlock(): boolean {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      return ctx.state === "running";
    }
    return true;
  }

  public stop() {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
  }

  public play(type: SoundType = "normal_alert") {
    const settings = getStoredSettings();
    if (!settings.soundEnabled || settings.volume <= 0) return;

    this.stop();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.value = settings.volume;
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case "loud_alert": {
        // Loud repeating chime for NEW_ORDER & NEW_DELIVERY_ORDER
        const playChime = () => {
          const t = ctx.currentTime;
          [880, 1320].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const startTime = t + i * 0.18;
            g.gain.setValueAtTime(0.0001, startTime);
            g.gain.exponentialRampToValueAtTime(0.5 * settings.volume, startTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);
            osc.connect(g);
            g.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.35);
          });
        };

        playChime();
        this.currentInterval = window.setInterval(playChime, 1500) as unknown as number;
        setTimeout(() => this.stop(), 20000); // Auto stop after 20s
        break;
      }

      case "normal_alert": {
        // Dual note soft ping for confirmed & out_for_delivery
        [523.25, 659.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          const startTime = now + i * 0.12;
          g.gain.setValueAtTime(0.0001, startTime);
          g.gain.exponentialRampToValueAtTime(0.3 * settings.volume, startTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.3);
        });
        break;
      }

      case "success": {
        // Ascending major triad chime (C - E - G) for DELIVERED
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.value = freq;
          const startTime = now + i * 0.1;
          g.gain.setValueAtTime(0.0001, startTime);
          g.gain.exponentialRampToValueAtTime(0.35 * settings.volume, startTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.4);
        });
        break;
      }

      case "warning": {
        // Low double pulse for CANCELLED
        [440, 349.23].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.value = freq;
          const startTime = now + i * 0.15;
          g.gain.setValueAtTime(0.0001, startTime);
          g.gain.exponentialRampToValueAtTime(0.25 * settings.volume, startTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.25);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + 0.3);
        });
        break;
      }
    }
  }
}

export const notificationSounds = new SoundEngine();
