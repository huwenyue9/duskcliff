import type { DiffId, Level, Platform, Spike, Coin, Mark } from "@/game/types";

const WORLD_H = 1120;
const DEATH_Y = 1040;
const THICK = 460;

type Draft = {
  plats: Platform[];
  spikes: Spike[];
  coins: Coin[];
  checks: Mark[];
  n: number;
};

function draft(): Draft {
  return { plats: [], spikes: [], coins: [], checks: [], n: 1 };
}

function solid(d: Draft, x: number, y: number, w: number, h = THICK) {
  d.plats.push(box(d, "solid", x, y, w, h, "x", 0, 3, 0));
}

function thin(d: Draft, x: number, y: number, w: number) {
  d.plats.push(box(d, "oneway", x, y, w, 20, "x", 0, 3, 0));
}

function mover(
  d: Draft,
  x: number,
  y: number,
  w: number,
  axis: "x" | "y",
  amp: number,
  period: number,
  phase = 0,
) {
  d.plats.push(box(d, "mover", x, y, w, 22, axis, amp, period, phase));
}

function box(
  d: Draft,
  kind: Platform["kind"],
  x: number,
  y: number,
  w: number,
  h: number,
  axis: "x" | "y",
  amp: number,
  period: number,
  phase: number,
): Platform {
  return {
    id: d.n++,
    kind,
    x,
    y,
    w,
    h,
    prevX: x,
    prevY: y,
    x0: x,
    y0: y,
    axis,
    amp,
    period,
    phase,
  };
}

function coin(d: Draft, x: number, y: number) {
  d.coins.push({ x, y });
}

function arc(d: Draft, xs: number[], y: number, lift = 0) {
  xs.forEach((x, i) => {
    const mid = (xs.length - 1) / 2;
    coin(d, x, y - Math.abs(i - mid) * 0 - lift * (1 - Math.abs(i - mid) / (mid || 1)));
  });
}

export const DIFFS: { id: DiffId; name: string; epithet: string; blurb: string }[] = [
  {
    id: "easy",
    name: "晨雾栈道",
    epithet: "轻松",
    blurb: "石台更宽、移动更慢，适合先把二段跳摸熟。",
  },
  {
    id: "normal",
    name: "暮色断崖",
    epithet: "标准",
    blurb: "节奏正好。主路有一处必须二段跳才能上去。",
  },
  {
    id: "hard",
    name: "夜风绝壁",
    epithet: "挑战",
    blurb: "平台更窄、石台更快，两处断阶都要二段跳。",
  },
];

export function makeLevel(id: DiffId): Level {
  if (id === "easy") return easy();
  if (id === "hard") return hard();
  return normal();
}

function finish(
  id: DiffId,
  d: Draft,
  spawn: Mark,
  flag: Mark,
  worldW: number,
): Level {
  const meta = DIFFS.find((x) => x.id === id)!;
  return {
    id,
    name: meta.name,
    epithet: meta.epithet,
    blurb: meta.blurb,
    worldW,
    worldH: WORLD_H,
    deathY: DEATH_Y,
    spawn,
    plats: d.plats,
    spikes: d.spikes,
    coins: d.coins,
    checks: d.checks,
    flag,
  };
}

/** Comfortable first cliff. Every main-path step is a single jump. */
function easy(): Level {
  const G = 760;
  const d = draft();
  solid(d, 0, G, 980);
  arc(d, [240, 380, 520], G - 70, 36);
  mover(d, 1060, G, 220, "x", 90, 4.8, 0.4);
  coin(d, 1180, G - 150);
  solid(d, 1500, G, 920);
  d.checks.push({ x: 1580, y: G });
  thin(d, 1760, G - 128, 240);
  coin(d, 1840, G - 188);
  coin(d, 1940, G - 188);
  d.spikes.push({ x: 2140, w: 100, surface: G });
  coin(d, 2320, G - 80);
  mover(d, 2540, G - 10, 200, "y", 80, 3.8, 1);
  coin(d, 2640, G - 160);
  solid(d, 2840, G, 840);
  d.checks.push({ x: 2920, y: G });
  d.spikes.push({ x: 3280, w: 80, surface: G });
  d.spikes.push({ x: 3480, w: 80, surface: G });
  coin(d, 3400, G - 90);
  solid(d, 3780, G - 78, 190, 80);
  coin(d, 3860, G - 140);
  solid(d, 4040, G - 156, 180, 80);
  coin(d, 4120, G - 220);
  thin(d, 4280, G - 226, 200);
  coin(d, 4360, G - 290);
  mover(d, 4540, G - 226, 180, "x", 46, 4.2, 0);
  solid(d, 4760, G - 300, 860);
  d.checks.push({ x: 4840, y: G - 300 });
  coin(d, 5080, G - 370);
  coin(d, 5220, G - 390);
  coin(d, 5360, G - 370);
  d.spikes.push({ x: 5160, w: 70, surface: G - 300 });
  return finish("easy", d, { x: 160, y: G }, { x: 5420, y: G - 300 }, 5750);
}

/** Standard ridge. The climb onto the shrine needs a second jump. */
function normal(): Level {
  const G = 780;
  const d = draft();
  solid(d, 0, G, 860);
  arc(d, [220, 360, 500], G - 64, 40);
  mover(d, 960, G, 190, "x", 80, 3.3, 0.2);
  coin(d, 1080, G - 150);
  solid(d, 1380, G, 780);
  d.checks.push({ x: 1460, y: G });
  thin(d, 1620, G - 136, 200);
  coin(d, 1700, G - 200);
  coin(d, 1780, G - 200);
  d.spikes.push({ x: 1900, w: 100, surface: G });
  d.spikes.push({ x: 2080, w: 60, surface: G });
  mover(d, 2300, G + 10, 170, "y", 110, 2.7, 0.6);
  coin(d, 2380, G - 170);
  solid(d, 2680, G, 560);
  d.checks.push({ x: 2760, y: G });
  // Required double-jump shelf: 124px above the road.
  solid(d, 3340, G - 124, 200, 90);
  coin(d, 3420, G - 190);
  solid(d, 3620, G - 200, 170, 80);
  coin(d, 3700, G - 270);
  mover(d, 3860, G - 200, 160, "x", 70, 2.6, 1.2);
  solid(d, 4200, G - 270, 220, 80);
  d.spikes.push({ x: 4240, w: 70, surface: G - 270 });
  thin(d, 4480, G - 340, 180);
  coin(d, 4560, G - 410);
  mover(d, 4720, G - 280, 160, "y", 70, 2.5, 0);
  solid(d, 5000, G - 340, 820);
  d.checks.push({ x: 5080, y: G - 340 });
  coin(d, 5300, G - 420);
  coin(d, 5460, G - 450);
  coin(d, 5600, G - 420);
  d.spikes.push({ x: 5380, w: 80, surface: G - 340 });
  return finish("normal", d, { x: 150, y: G }, { x: 5620, y: G - 340 }, 5920);
}

/** Narrow holds, fast stones, two shelves only a second jump can reach. */
function hard(): Level {
  const G = 800;
  const d = draft();
  solid(d, 0, G, 720);
  arc(d, [200, 320, 440], G - 60, 48);
  mover(d, 800, G, 150, "x", 70, 2.15, 0);
  coin(d, 900, G - 160);
  solid(d, 1140, G, 520);
  d.checks.push({ x: 1220, y: G });
  d.spikes.push({ x: 1380, w: 90, surface: G });
  d.spikes.push({ x: 1560, w: 70, surface: G });
  // First required double jump.
  solid(d, 1760, G - 112, 150, 80);
  coin(d, 1820, G - 180);
  mover(d, 1980, G - 112, 140, "y", 120, 2.05, 0.8);
  coin(d, 2040, G - 250);
  solid(d, 2300, G - 40, 420);
  d.spikes.push({ x: 2460, w: 100, surface: G - 40 });
  thin(d, 2140, G - 200, 150);
  coin(d, 2200, G - 270);
  d.checks.push({ x: 2360, y: G - 40 });
  mover(d, 2820, G - 40, 130, "x", 90, 1.85, 0.3);
  // Second required double jump, off the moving stone's high line.
  solid(d, 3180, G - 148, 150, 70);
  coin(d, 3240, G - 214);
  solid(d, 3400, G - 216, 150, 70);
  coin(d, 3460, G - 286);
  thin(d, 3620, G - 280, 150);
  coin(d, 3680, G - 348);
  mover(d, 3840, G - 250, 140, "y", 70, 2.1, 1.1);
  solid(d, 4080, G - 300, 720);
  d.checks.push({ x: 4180, y: G - 300 });
  d.spikes.push({ x: 4360, w: 64, surface: G - 300 });
  coin(d, 4520, G - 380);
  coin(d, 4620, G - 410);
  return finish("hard", d, { x: 140, y: G }, { x: 4660, y: G - 300 }, 5000);
}
