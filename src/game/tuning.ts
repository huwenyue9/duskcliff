import type { DiffId, Tune } from "@/game/types";

export const TUNING: Record<DiffId, Tune> = {
  easy: {
    run: 280,
    accelG: 2600,
    accelA: 1700,
    friction: 2200,
    gravUp: 1280,
    gravDown: 2150,
    jump: -530,
    djump: -470,
    coyote: 0.14,
    buffer: 0.14,
    terminal: 740,
    mover: 0.72,
  },
  normal: {
    run: 305,
    accelG: 2800,
    accelA: 1550,
    friction: 2400,
    gravUp: 1520,
    gravDown: 2550,
    jump: -545,
    djump: -485,
    coyote: 0.1,
    buffer: 0.12,
    terminal: 800,
    mover: 1,
  },
  hard: {
    run: 335,
    accelG: 3000,
    accelA: 1450,
    friction: 2600,
    gravUp: 1720,
    gravDown: 2950,
    jump: -555,
    djump: -495,
    coyote: 0.072,
    buffer: 0.09,
    terminal: 880,
    mover: 1.42,
  },
};

export const PLAYER_HW = 13;
export const PLAYER_HH = 52;
export const STEP = 1 / 60;
