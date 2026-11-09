import type { GameEvent } from "@/game/types";

export class Sfx {
  ctx: AudioContext | null = null;
  muted = false;

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  play(ev: GameEvent) {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    if (ev === "jump") this.blip(ctx, 420, 640, 0.09, "square", 0.045);
    else if (ev === "djump") this.blip(ctx, 560, 920, 0.12, "square", 0.05);
    else if (ev === "land") this.blip(ctx, 160, 70, 0.06, "sine", 0.04);
    else if (ev === "coin") {
      this.blip(ctx, 880, 1320, 0.1, "triangle", 0.05);
    } else if (ev === "hurt") this.blip(ctx, 220, 60, 0.28, "sawtooth", 0.05);
    else if (ev === "checkpoint") {
      this.blip(ctx, 523, 659, 0.12, "triangle", 0.05);
      window.setTimeout(() => this.blip(ctx, 784, 988, 0.16, "triangle", 0.045), 90);
    } else if (ev === "win") {
      [523, 659, 784, 1046].forEach((f, i) => {
        window.setTimeout(() => this.blip(ctx, f, f * 1.02, 0.18, "triangle", 0.05), i * 110);
      });
    }
  }

  blip(
    ctx: AudioContext,
    from: number,
    to: number,
    dur: number,
    type: OscillatorType,
    gain: number,
  ) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}
