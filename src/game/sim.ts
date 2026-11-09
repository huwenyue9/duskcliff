import { makeLevel } from "@/game/levels";
import { PLAYER_HH, PLAYER_HW, STEP, TUNING } from "@/game/tuning";
import type { DiffId, GameEvent, Level, Phase, Platform, Tune } from "@/game/types";

export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  groundId: number | null;
  groundKind: Platform["kind"] | null;
  coyote: number;
  jumpBuf: number;
  air: number;
  drop: number;
  invuln: number;
  jumpCut: boolean;
};

type Snap = {
  x: number;
  y: number;
  cp: number;
  coins: boolean[];
};

export class Session {
  phase: Phase = "title";
  diff: DiffId = "normal";
  level: Level = makeLevel("normal");
  tune: Tune = TUNING.normal;
  player: Player = this.freshPlayer(this.level.spawn.x, this.level.spawn.y);
  coins: boolean[] = [];
  cp = -1;
  snap: Snap = { x: 0, y: 0, cp: -1, coins: [] };
  time = 0;
  keys = new Set<string>();
  acc = 0;
  clock = 0;
  prevJump = false;
  prevDown = false;
  shake = 0;

  freshPlayer(x: number, y: number): Player {
    return {
      x,
      y,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: false,
      groundId: null,
      groundKind: null,
      coyote: 0,
      jumpBuf: 0,
      air: 1,
      drop: 0,
      invuln: 0,
      jumpCut: false,
    };
  }

  start(diff: DiffId) {
    this.diff = diff;
    this.tune = TUNING[diff];
    this.level = makeLevel(diff);
    this.coins = this.level.coins.map(() => false);
    this.cp = -1;
    this.time = 0;
    this.acc = 0;
    this.snap = {
      x: this.level.spawn.x,
      y: this.level.spawn.y,
      cp: -1,
      coins: this.coins.slice(),
    };
    this.player = this.freshPlayer(this.level.spawn.x, this.level.spawn.y);
    this.phase = "play";
    this.settle();
  }

  restart() {
    this.start(this.diff);
  }

  respawn() {
    this.player = this.freshPlayer(this.snap.x, this.snap.y);
    this.player.invuln = 1.05;
    this.coins = this.snap.coins.slice();
    this.cp = this.snap.cp;
    this.phase = "play";
    this.settle();
  }

  /** Snap onto a surface if we spawned inside the top few pixels. */
  settle() {
    this.resolveY(this.player.y);
    if (this.player.grounded) this.player.vy = 0;
  }

  tick(frameDt: number): GameEvent[] {
    this.clock += frameDt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - frameDt * 18);
    if (this.phase !== "play") return [];
    this.acc += Math.min(frameDt, 0.05);
    const events: GameEvent[] = [];
    const jumpDown = this.heldJump();
    const down = this.heldDown();
    const pressed = jumpDown && !this.prevJump;
    const downPressed = down && !this.prevDown;
    this.prevJump = jumpDown;
    this.prevDown = down;
    if (pressed) this.player.jumpBuf = this.tune.buffer;
    let n = 0;
    while (this.acc >= STEP && n < 6) {
      events.push(...this.step(STEP, pressed && n === 0, down, downPressed && n === 0));
      this.acc -= STEP;
      n++;
    }
    return events;
  }

  heldJump() {
    return this.keys.has("Space") || this.keys.has("KeyW") || this.keys.has("ArrowUp");
  }

  heldDown() {
    return this.keys.has("KeyS") || this.keys.has("ArrowDown");
  }

  dir() {
    let d = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) d -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) d += 1;
    return d;
  }

  step(dt: number, jumpEdge: boolean, down: boolean, downEdge: boolean): GameEvent[] {
    const events: GameEvent[] = [];
    const p = this.player;
    const tune = this.tune;
    this.time += dt;
    p.invuln = Math.max(0, p.invuln - dt);
    p.drop = Math.max(0, p.drop - dt);
    p.jumpBuf = Math.max(0, p.jumpBuf - dt);

    this.movePlatforms(dt);

    if (p.groundId != null) {
      const m = this.level.plats.find((pl) => pl.id === p.groundId && pl.kind === "mover");
      if (m) {
        p.x += m.x - m.prevX;
        p.y += m.y - m.prevY;
      }
    }

    const dir = this.dir();
    const wasGround = p.grounded;
    const accel = p.grounded ? tune.accelG : tune.accelA;
    if (dir !== 0) {
      p.vx += dir * accel * dt;
      p.facing = dir < 0 ? -1 : 1;
    } else {
      const fr = (p.grounded ? tune.friction : tune.friction * 0.22) * dt;
      if (Math.abs(p.vx) <= fr) p.vx = 0;
      else p.vx -= Math.sign(p.vx) * fr;
    }
    p.vx = clamp(p.vx, -tune.run, tune.run);

    const rising = p.vy < 0;
    p.vy = Math.min(tune.terminal, p.vy + (rising ? tune.gravUp : tune.gravDown) * (Math.abs(p.vy) < 70 ? 0.55 : 1) * dt);

    const wantDrop =
      (downEdge || (down && jumpEdge)) &&
      p.grounded &&
      (p.groundKind === "oneway" || p.groundKind === "mover");
    if (wantDrop) {
      p.drop = 0.24;
      p.grounded = false;
      p.groundId = null;
      p.groundKind = null;
      p.coyote = 0;
      p.jumpBuf = 0;
      p.vy = Math.max(p.vy, 80);
    } else if (p.jumpBuf > 0 && (p.grounded || p.coyote > 0)) {
      p.vy = tune.jump;
      p.grounded = false;
      p.groundId = null;
      p.coyote = 0;
      p.jumpBuf = 0;
      p.air = 1;
      p.jumpCut = true;
      events.push("jump");
    } else if (p.jumpBuf > 0 && jumpEdge && p.air > 0 && !p.grounded) {
      p.vy = tune.djump;
      p.air = 0;
      p.jumpBuf = 0;
      p.jumpCut = true;
      events.push("djump");
    } else if (!this.heldJump() && p.jumpCut && p.vy < 0) {
      p.vy *= 0.5;
      p.jumpCut = false;
    }

    const prevX = p.x;
    p.x += p.vx * dt;
    p.x = clamp(p.x, PLAYER_HW, this.level.worldW - PLAYER_HW);
    this.resolveX(prevX);

    const prevY = p.y;
    p.y += p.vy * dt;
    p.grounded = false;
    p.groundId = null;
    p.groundKind = null;
    this.resolveY(prevY);
    if (p.grounded) {
      p.coyote = tune.coyote;
      p.air = 1;
      if (!wasGround) events.push("land");
    } else if (!wasGround) {
      p.coyote = Math.max(0, p.coyote - dt);
    }

    if (p.y > this.level.deathY) {
      events.push("hurt");
      this.phase = "dead";
      this.shake = 1;
      return events;
    }

    if (p.invuln <= 0) {
      for (const s of this.level.spikes) {
        const top = s.surface - 28;
        if (p.x + PLAYER_HW - 6 > s.x + 4 && p.x - PLAYER_HW + 6 < s.x + s.w - 4 && p.y > top && p.y - PLAYER_HH < s.surface - 2) {
          events.push("hurt");
          this.phase = "dead";
          this.shake = 1;
          return events;
        }
      }
    }

    this.level.coins.forEach((c, i) => {
      if (this.coins[i]) return;
      const cx = p.x;
      const cy = p.y - PLAYER_HH * 0.55;
      if ((c.x - cx) ** 2 + (c.y - cy) ** 2 < 30 ** 2) {
        this.coins[i] = true;
        events.push("coin");
      }
    });

    for (let i = 0; i < this.level.checks.length; i++) {
      if (i <= this.cp) continue;
      const c = this.level.checks[i];
      if (Math.hypot(p.x - c.x, p.y - PLAYER_HH * 0.4 - (c.y - 40)) < 52) {
        this.cp = i;
        this.snap = { x: c.x, y: c.y, cp: i, coins: this.coins.slice() };
        events.push("checkpoint");
        break;
      }
    }

    const f = this.level.flag;
    if (p.x > f.x - 28 && p.x < f.x + 42 && p.y > f.y - 150 && p.y < f.y + 18) {
      this.phase = "win";
      events.push("win");
    }

    return events;
  }

  movePlatforms(dt: number) {
    const speed = this.tune.mover;
    for (const pl of this.level.plats) {
      pl.prevX = pl.x;
      pl.prevY = pl.y;
      if (pl.kind !== "mover") continue;
      const period = Math.max(0.8, pl.period / speed);
      const ang = (this.time / period) * Math.PI * 2 + pl.phase;
      const s = Math.sin(ang);
      pl.x = pl.x0 + (pl.axis === "x" ? pl.amp * s : 0);
      pl.y = pl.y0 + (pl.axis === "y" ? pl.amp * s : 0);
      void dt;
    }
  }

  resolveX(prevX: number) {
    const p = this.player;
    for (const s of this.level.plats) {
      if (s.kind !== "solid") continue;
      const top = s.y + 12;
      const bot = s.y + s.h - 8;
      if (p.y <= top || p.y - PLAYER_HH >= bot) continue;
      if (p.x + PLAYER_HW <= s.x || p.x - PLAYER_HW >= s.x + s.w) continue;
      if (p.x >= prevX) p.x = s.x - PLAYER_HW;
      else p.x = s.x + s.w + PLAYER_HW;
      p.vx = 0;
    }
  }

  resolveY(prevY: number) {
    const p = this.player;
    if (p.vy < 0) {
      for (const s of this.level.plats) {
        if (s.kind !== "solid") continue;
        const bottom = s.y + s.h;
        if (p.x + PLAYER_HW - 8 <= s.x || p.x - PLAYER_HW + 8 >= s.x + s.w) continue;
        if (prevY - PLAYER_HH >= bottom - 4 && p.y - PLAYER_HH <= bottom) {
          p.y = bottom + PLAYER_HH;
          p.vy = 0;
          p.jumpCut = false;
        }
      }
    }

    let best: Platform | null = null;
    for (const s of this.level.plats) {
      const ride = s.kind === "oneway" || s.kind === "mover";
      if (ride && p.drop > 0) continue;
      if (p.x + PLAYER_HW - 5 <= s.x || p.x - PLAYER_HW + 5 >= s.x + s.w) continue;
      const prevTop = s.prevY;
      if (prevY > prevTop + 14) continue;
      if (p.y < s.y) continue;
      if (p.vy < -20 && !ride) continue;
      if (!best || s.y < best.y) best = s;
    }
    if (best && p.vy >= -20) {
      p.y = best.y;
      p.vy = 0;
      p.grounded = true;
      p.groundId = best.id;
      p.groundKind = best.kind;
      p.jumpCut = false;
    }
  }

  coinCount() {
    return this.coins.reduce((n, t) => n + (t ? 1 : 0), 0);
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
