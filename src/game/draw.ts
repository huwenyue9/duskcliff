import type { Level, Platform } from "@/game/types";
import type { Player } from "@/game/sim";

export type Crop = { sx: number; sy: number; sw: number; sh: number };

export type Art = {
  sky: HTMLImageElement;
  mountains: HTMLImageElement;
  idle: HTMLImageElement;
  run: HTMLImageElement;
  jump: HTMLImageElement;
  coin: HTMLImageElement;
  spike: HTMLImageElement;
  flag: HTMLImageElement;
  checkpoint: HTMLImageElement;
  platform: HTMLImageElement;
  tiles: Crop[] | null;
};

export type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
};

export type Cam = { x: number; y: number };

const FEET = 0.93;

export function loadArt(): Art {
  const image = (src: string) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    return img;
  };
  const platform = image("/game/platform.png");
  const art: Art = {
    sky: image("/game/bg-sky.jpg"),
    mountains: image("/game/bg-mountains.png"),
    idle: image("/game/hero-idle.png"),
    run: image("/game/hero-run.png"),
    jump: image("/game/hero-jump.png"),
    coin: image("/game/coin.png"),
    spike: image("/game/spike.png"),
    flag: image("/game/flag.png"),
    checkpoint: image("/game/checkpoint.png"),
    platform,
    tiles: null,
  };
  platform.onload = () => {
    art.tiles = measureTiles(platform);
  };
  return art;
}

function measureTiles(img: HTMLImageElement): Crop[] | null {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.drawImage(img, 0, 0);
  const { data, width, height } = g.getImageData(0, 0, img.width, img.height);
  const fw = width / 3;
  const rects: Crop[] = [];
  for (let i = 0; i < 3; i++) {
    let minX = fw;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < fw; x++) {
        const a = data[(y * width + (i * fw + x)) * 4 + 3] ?? 0;
        if (a < 24) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX <= minX) return null;
    rects.push({ sx: i * fw + minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 });
  }
  return rects;
}

export function followCamera(
  cam: Cam,
  p: Player,
  viewW: number,
  viewH: number,
  level: Level,
  dt: number,
  raised: boolean,
  snap: boolean,
) {
  const look = p.facing * 90;
  const tx = p.x - viewW * 0.46 + look;
  const ty = p.y - viewH * (raised ? 0.5 : 0.64);
  if (snap) {
    cam.x = tx;
    cam.y = ty;
  } else {
    const k = 1 - Math.exp(-7 * dt);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }
  if (level.worldW <= viewW) cam.x = (level.worldW - viewW) / 2;
  else cam.x = clamp(cam.x, 0, level.worldW - viewW);
  if (level.worldH <= viewH) cam.y = (level.worldH - viewH) / 2;
  else cam.y = clamp(cam.y, 0, level.worldH - viewH);
  cam.x = Math.round(cam.x);
  cam.y = Math.round(cam.y);
}

export function paint(opts: {
  ctx: CanvasRenderingContext2D;
  art: Art;
  level: Level;
  player: Player;
  coins: boolean[];
  cp: number;
  cam: Cam;
  clock: number;
  shake: number;
  viewW: number;
  viewH: number;
  motes: Mote[];
  blink: boolean;
}) {
  const { ctx, art, level, player, coins, cp, cam, clock, viewW, viewH, motes } = opts;
  const sx = opts.shake > 0 ? Math.sin(clock * 48) * opts.shake * 7 : 0;
  const sy = opts.shake > 0 ? Math.cos(clock * 37) * opts.shake * 4 : 0;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = "#12101c";
  ctx.fillRect(-20, -20, viewW + 40, viewH + 40);
  drawCover(ctx, art.sky, -cam.x * 0.08, 0, viewW, viewH, 1.05);
  drawCover(ctx, art.mountains, -cam.x * 0.28, viewH * 0.08, viewW, viewH, 1.2);

  const haze = ctx.createLinearGradient(0, viewH * 0.45, 0, viewH);
  haze.addColorStop(0, "rgba(18,16,28,0)");
  haze.addColorStop(1, "rgba(18,16,28,0.45)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, viewW, viewH);

  const plats = level.plats.slice().sort((a, b) => a.y - b.y);
  for (const pl of plats) drawPlatform(ctx, art, pl, cam);

  for (const s of level.spikes) {
    const tile = 56;
    for (let x = s.x; x < s.x + s.w - 8; x += tile - 8) {
      drawProp(ctx, art.spike, x - cam.x, s.surface - cam.y, Math.min(tile, s.x + s.w - x), 50, 0.95, false);
    }
  }

  level.coins.forEach((c, i) => {
    if (coins[i]) return;
    const bob = Math.sin(clock * 3 + i) * 5;
    const frame = Math.floor(clock * 8 + i) % 4;
    drawSheet(ctx, art.coin, 2, 2, frame, c.x - cam.x - 18, c.y - cam.y - 18 + bob, 36, 36, false);
  });

  level.checks.forEach((c, i) => {
    const on = i <= cp;
    ctx.save();
    ctx.filter = on ? "brightness(1.08)" : "brightness(0.62) saturate(0.7)";
    drawProp(ctx, art.checkpoint, c.x - cam.x - 28, c.y - cam.y, 56, 104, 0.95, false);
    ctx.restore();
    if (on) {
      ctx.fillStyle = "rgba(232,163,23,0.28)";
      ctx.beginPath();
      ctx.ellipse(c.x - cam.x, c.y - cam.y - 78, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const flap = Math.sin(clock * 4) * 0.04;
  ctx.save();
  ctx.translate(level.flag.x - cam.x, level.flag.y - cam.y);
  ctx.rotate(flap);
  drawProp(ctx, art.flag, -30, 0, 64, 140, 0.95, false);
  ctx.restore();

  if (!(opts.blink && Math.floor(clock * 14) % 2 === 0)) {
    drawPlayer(ctx, art, player, cam, clock);
  }

  for (const m of motes) {
    const a = Math.max(0, m.life / m.max);
    ctx.globalAlpha = a;
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(m.x - cam.x, m.y - cam.y, m.r * a, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const vig = ctx.createRadialGradient(viewW * 0.5, viewH * 0.45, viewW * 0.25, viewW * 0.5, viewH * 0.5, viewW * 0.72);
  vig.addColorStop(0, "rgba(18,16,28,0)");
  vig.addColorStop(1, "rgba(18,16,28,0.38)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, art: Art, p: Player, cam: Cam, clock: number) {
  const size = 104;
  let sheet = art.idle;
  let frame = Math.floor(clock * 5) % 4;
  if (!p.grounded) {
    sheet = art.jump;
    frame = p.vy < -180 ? 1 : p.vy < 90 ? 2 : 3;
  } else if (Math.abs(p.vx) > 36) {
    sheet = art.run;
    frame = Math.floor(clock * 10) % 4;
  }
  const x = p.x - cam.x - size / 2;
  const y = p.y - cam.y - FEET * size;
  ctx.fillStyle = "rgba(18,16,28,0.28)";
  ctx.beginPath();
  ctx.ellipse(p.x - cam.x, p.y - cam.y + 2, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  drawSheet(ctx, sheet, 2, 2, frame, x, y, size, size, p.facing < 0);
}

function drawPlatform(ctx: CanvasRenderingContext2D, art: Art, pl: Platform, cam: Cam) {
  const x = pl.x - cam.x;
  const y = pl.y - cam.y;
  if (pl.kind === "solid" && pl.h > 40) {
    ctx.fillStyle = "#241c18";
    ctx.fillRect(x, y + 10, pl.w, pl.h);
    ctx.fillStyle = "#1a1614";
    ctx.fillRect(x, y + pl.h - 8, pl.w, 8);
  }
  const stoneH = pl.kind === "solid" && pl.h > 70 ? 62 : 48;
  const tiles = art.tiles;
  if (!tiles || !ready(art.platform)) {
    ctx.fillStyle = pl.kind === "oneway" ? "#3f9d6e" : "#4d4638";
    roundRect(ctx, x, y, pl.w, pl.kind === "oneway" ? 14 : 28, 8);
    ctx.fill();
    return;
  }
  const left = tiles[0]!;
  const mid = tiles[1]!;
  const right = tiles[2]!;
  const scale = stoneH / left.sh;
  let capL = left.sw * scale;
  let capR = right.sw * scale;
  if (capL + capR > pl.w) {
    const k = pl.w / (capL + capR);
    capL *= k;
    capR *= k;
  }
  ctx.drawImage(art.platform, left.sx, left.sy, left.sw, left.sh, x, y, capL, stoneH);
  ctx.drawImage(art.platform, right.sx, right.sy, right.sw, right.sh, x + pl.w - capR, y, capR, stoneH);
  const midW = Math.max(8, mid.sw * (stoneH / mid.sh));
  let cursor = x + capL - 1;
  const end = x + pl.w - capR + 1;
  let guard = 0;
  while (cursor < end - 1 && guard < 80) {
    const dw = Math.min(midW, end - cursor);
    if (dw < 1) break;
    const sw = Math.max(1, mid.sw * (dw / midW));
    ctx.drawImage(art.platform, mid.sx, mid.sy, sw, mid.sh, cursor, y, dw, stoneH);
    cursor += Math.max(1, dw - 1);
    guard += 1;
  }
  if (pl.kind === "mover") {
    ctx.fillStyle = "#e8a317";
    ctx.fillRect(x + 10, y + stoneH - 6, Math.max(12, pl.w - 20), 3);
  }
}

function drawSheet(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cols: number,
  rows: number,
  frame: number,
  x: number,
  y: number,
  w: number,
  h: number,
  flip: boolean,
) {
  if (!ready(img)) {
    ctx.fillStyle = "#e8a317";
    roundRect(ctx, x + w * 0.28, y + h * 0.2, w * 0.44, h * 0.7, 8);
    ctx.fill();
    return;
  }
  const fw = img.width / cols;
  const fh = img.height / rows;
  const c = frame % cols;
  const r = Math.floor(frame / cols);
  ctx.save();
  if (flip) {
    ctx.translate(x + w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + w / 2), 0);
  }
  ctx.drawImage(img, c * fw, r * fh, fw, fh, x, y, w, h);
  ctx.restore();
}

function drawProp(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  footY: number,
  w: number,
  h: number,
  foot: number,
  flip: boolean,
) {
  const y = footY - h * foot;
  if (!ready(img)) {
    ctx.fillStyle = "#e8a317";
    ctx.fillRect(x + w * 0.4, y, 4, h * foot);
    return;
  }
  ctx.save();
  if (flip) {
    ctx.translate(x + w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + w / 2), 0);
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  shift: number,
  yBias: number,
  viewW: number,
  viewH: number,
  zoom: number,
) {
  if (!ready(img)) return;
  const scale = Math.max(viewW / img.width, viewH / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  let x = (shift % dw) - dw;
  const y = Math.min(0, viewH - dh) + yBias;
  while (x < viewW) {
    ctx.drawImage(img, x, y, dw, dh);
    x += dw - 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function ready(img: HTMLImageElement) {
  return img.complete && img.naturalWidth > 0;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
