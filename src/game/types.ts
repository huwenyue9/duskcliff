export type DiffId = "easy" | "normal" | "hard";

export type PlatKind = "solid" | "oneway" | "mover";

export type Platform = {
  id: number;
  kind: PlatKind;
  x: number;
  y: number;
  w: number;
  h: number;
  prevX: number;
  prevY: number;
  x0: number;
  y0: number;
  axis: "x" | "y";
  amp: number;
  period: number;
  phase: number;
};

export type Spike = { x: number; w: number; surface: number };

export type Coin = { x: number; y: number };

export type Mark = { x: number; y: number };

export type Level = {
  id: DiffId;
  name: string;
  epithet: string;
  blurb: string;
  worldW: number;
  worldH: number;
  deathY: number;
  spawn: Mark;
  plats: Platform[];
  spikes: Spike[];
  coins: Coin[];
  checks: Mark[];
  flag: Mark;
};

export type Tune = {
  run: number;
  accelG: number;
  accelA: number;
  friction: number;
  gravUp: number;
  gravDown: number;
  jump: number;
  djump: number;
  coyote: number;
  buffer: number;
  terminal: number;
  mover: number;
};

export type Phase = "title" | "play" | "paused" | "dead" | "win";

export type GameEvent =
  | "jump"
  | "djump"
  | "land"
  | "coin"
  | "hurt"
  | "checkpoint"
  | "win";
