import { useEffect, useRef, useState, type ReactNode } from "react";
import { Coins, Flag, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Sfx } from "@/game/audio";
import { followCamera, loadArt, paint, type Art, type Cam, type Mote } from "@/game/draw";
import { DIFFS, makeLevel } from "@/game/levels";
import { Session, type Player } from "@/game/sim";
import type { DiffId, Level, Phase } from "@/game/types";

const STORE = "duskcliff-records-v1";
const MUTE = "duskcliff-mute";

let bound: Session | null = null;

type Best = { time: number; coins: number };
type Book = Partial<Record<DiffId, Best>>;

function loadBook(): Book {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Book) : {};
  } catch {
    return {};
  }
}

function saveBest(id: DiffId, time: number, coins: number) {
  const book = loadBook();
  const prev = book[id];
  book[id] = {
    time: prev ? Math.min(prev.time, time) : time,
    coins: prev ? Math.max(prev.coins, coins) : coins,
  };
  localStorage.setItem(STORE, JSON.stringify(book));
  return book;
}

function formatTime(t: number) {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function viewSize(cssW: number, cssH: number) {
  const aspect = cssW / Math.max(1, cssH);
  let viewW = 540 * aspect;
  let viewH = 540;
  if (viewW < 500) {
    viewW = 500;
    viewH = 500 / aspect;
  } else if (viewW > 1180) {
    viewW = 1180;
    viewH = 1180 / aspect;
  }
  return { viewW, viewH };
}

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-amber px-4 py-3 font-semibold text-ink";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-ink-2 px-4 py-3 text-cream";

export function DuskGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const snapRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("title");
  const [picked, setPicked] = useState<DiffId>("normal");
  const [book, setBook] = useState<Book>({});
  const [muted, setMuted] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const coinRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLParagraphElement>(null);
  const lampRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const session = new Session();
    sessionRef.current = session;
    bound = session;
    const art: Art = loadArt();
    const sfx = new Sfx();
    sfxRef.current = sfx;
    const attract = makeLevel("easy");
    const cam: Cam = { x: 0, y: 0 };
    const motes: Mote[] = [];
    let clock = 0;
    let reduce = false;
    try {
      setBook(loadBook());
      setShowRecords(true);
      const saved = localStorage.getItem(MUTE) === "1";
      sfx.muted = saved;
      setMuted(saved);
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* ignore private storage */
    }

    const ghost = (): Player => ({
      x: attract.spawn.x,
      y: attract.spawn.y,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      groundId: null,
      groundKind: "solid",
      coyote: 0,
      jumpBuf: 0,
      air: 1,
      drop: 0,
      invuln: 0,
      jumpCut: false,
    });

    const burst = (x: number, y: number, color: string, n: number, up = 80) => {
      for (let i = 0; i < n; i++) {
        motes.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 160,
          vy: -Math.random() * up,
          life: 0.35 + Math.random() * 0.3,
          max: 0.65,
          r: 2 + Math.random() * 2.5,
          color,
        });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      sfx.unlock();
      if (e.code === "Escape") {
        if (session.phase === "play") {
          session.phase = "paused";
          setPhase("paused");
        } else if (session.phase === "paused") {
          session.phase = "play";
          setPhase("play");
        }
        return;
      }
      if ((e.code === "Enter" || e.code === "KeyR") && (session.phase === "dead" || session.phase === "win")) {
        if (e.code === "KeyR" || session.phase === "win") session.restart();
        else session.respawn();
        snapRef.current = true;
        setPhase("play");
        return;
      }
      session.keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => session.keys.delete(e.code);
    const clear = () => session.keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);

    window.__controlsTest = {
      getYaw: () => (session.player.facing > 0 ? 0 : Math.PI),
      getSpeed: () => Math.abs(session.player.vx),
      getX: () => session.player.x,
      getY: () => session.player.y,
      setKeys: (codes: string[]) => {
        session.keys.clear();
        for (const code of codes) session.keys.add(code);
      },
      phase: () => session.phase,
    };

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      const { viewW, viewH } = viewSize(cssW, cssH);
      ctx.setTransform((cssW / viewW) * dpr, 0, 0, (cssH / viewH) * dpr, 0, 0);
      const raised = window.matchMedia("(pointer: coarse)").matches || cssW < 800;

      let level: Level = attract;
      let player = ghost();
      let coins: boolean[] = attract.coins.map(() => false);
      let cp = -1;
      if (session.phase === "title") {
        drift(attract, clock);
        cam.x = 20;
        cam.y = attract.spawn.y - viewH * 0.66;
        if (attract.worldH > viewH) cam.y = Math.max(0, Math.min(cam.y, attract.worldH - viewH));
        if (attract.worldW > viewW) cam.x = Math.max(0, Math.min(cam.x, attract.worldW - viewW));
      } else {
        const events = session.tick(dt);
        for (const ev of events) {
          sfx.play(ev);
          if (ev === "coin") burst(session.player.x, session.player.y - 30, "#e8a317", 8, 120);
          if (ev === "land") burst(session.player.x, session.player.y, "#c9c0b2", 4, 40);
          if (ev === "djump") burst(session.player.x, session.player.y, "#f3c56b", 6, 20);
          if (ev === "hurt") burst(session.player.x, session.player.y - 20, "#e25b4a", 12, 160);
          if (ev === "win") {
            setBook(saveBest(session.diff, session.time, session.coinCount()));
            setPhase("win");
            setPicked(session.diff);
          }
          if (ev === "hurt") setPhase("dead");
        }
        level = session.level;
        player = session.player;
        coins = session.coins;
        cp = session.cp;
        followCamera(cam, player, viewW, viewH, level, dt, raised, snapRef.current);
        snapRef.current = false;
        if (coinRef.current) coinRef.current.textContent = `${session.coinCount()} / ${level.coins.length}`;
        if (timeRef.current) timeRef.current.textContent = formatTime(session.time);
        if (lampRef.current) lampRef.current.textContent = cp < 0 ? "起点" : `灯笼 ${cp + 1}`;
      }

      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i]!;
        m.life -= dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.vy += 280 * dt;
        if (m.life <= 0) motes.splice(i, 1);
      }

      paint({
        ctx,
        art,
        level,
        player,
        coins,
        cp,
        cam,
        clock,
        shake: reduce ? 0 : session.shake,
        viewW,
        viewH,
        motes,
        blink: session.phase === "play" && session.player.invuln > 0,
      });
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      delete window.__controlsTest;
      bound = null;
    };
  }, []);

  const begin = (id: DiffId) => {
    const session = sessionRef.current;
    if (!session) return;
    session.start(id);
    snapRef.current = true;
    setPicked(id);
    setPhase("play");
  };

  const resume = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.phase = "play";
    setPhase("play");
  };

  const respawn = () => {
    sessionRef.current?.respawn();
    snapRef.current = true;
    setPhase("play");
  };

  const restart = () => {
    sessionRef.current?.restart();
    snapRef.current = true;
    setPhase("play");
  };

  const backToTitle = () => {
    const session = sessionRef.current;
    if (!session) return;
    session.phase = "title";
    session.keys.clear();
    setPhase("title");
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (sfxRef.current) sfxRef.current.muted = next;
      try {
        localStorage.setItem(MUTE, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const levelName = DIFFS.find((d) => d.id === picked)?.name ?? "";

  return (
    <main className="relative h-dvh overflow-hidden bg-ink text-cream select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-hidden />

      {phase !== "title" && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4 md:p-6">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-ink/80 px-4 py-2 backdrop-blur-md">
            <Coins className="size-5 text-amber" aria-hidden />
            <span ref={coinRef} className="font-display text-lg tracking-wide">
              0 / 0
            </span>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="rounded-2xl border border-line bg-ink/80 px-4 py-2 text-center backdrop-blur-md">
              <p ref={lampRef} className="text-xs tracking-widest text-cream-dim">
                起点
              </p>
              <p ref={timeRef} className="font-display text-lg">
                0:00
              </p>
            </div>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-2xl border border-line bg-ink/80 text-cream backdrop-blur-md"
              onClick={toggleMute}
              aria-label={muted ? "打开声音" : "关闭声音"}
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            {phase === "play" && (
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-2xl border border-line bg-ink/80 backdrop-blur-md"
                onClick={() => {
                  const session = sessionRef.current;
                  if (!session) return;
                  session.phase = "paused";
                  setPhase("paused");
                }}
                aria-label="暂停"
              >
                <Pause className="size-5" />
              </button>
            )}
          </div>
        </header>
      )}

      {phase === "title" && (
        <div className="absolute inset-0 z-20 flex items-end p-4 md:items-center md:p-10">
          <section className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-ink/85 p-6 shadow-lg backdrop-blur-md md:p-8">
            <p className="text-xs tracking-[0.28em] text-amber">黄昏信使</p>
            <h1 className="font-display mt-2 text-5xl text-cream">暮崖跃台</h1>
            <p className="mt-3 text-sm leading-relaxed text-cream-dim">
              把这封信送到崖顶的旗帜。石台会移动，尖刺会伤人，点亮的灯笼是你的检查点。
            </p>
            <div className="mt-5 grid gap-3">
              {DIFFS.map((d) => {
                const best = showRecords ? book[d.id] : undefined;
                const tone =
                  d.id === "easy" ? "border-moss/60" : d.id === "hard" ? "border-coral/60" : "border-amber/60";
                return (
                  <button
                    key={d.id}
                    type="button"
                    data-difficulty={d.id}
                    onClick={() => begin(d.id)}
                    className={`rounded-2xl border ${tone} bg-ink-2 px-4 py-3 text-left`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-display text-2xl">{d.name}</span>
                      <span className="text-xs tracking-widest text-cream-dim">{d.epithet}</span>
                    </span>
                    <span className="mt-1 block text-sm text-cream-dim">{d.blurb}</span>
                    {best && (
                      <span className="mt-2 block text-xs text-amber-2">
                        最佳 {formatTime(best.time)} · 金币 {best.coins}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <ul className="mt-5 space-y-1 text-sm text-cream-dim">
              <li>A / D 或方向键奔跑，空格、W、↑ 跳跃</li>
              <li>滞空时再跳一次，便是二段跳；按住跳得更高</li>
              <li>站在薄台上按 S 或 ↓ 可以穿下去</li>
            </ul>
          </section>
        </div>
      )}

      {phase === "paused" && (
        <Overlay kicker="暂停" title="崖风停了一停" body="准备好了就继续跑。灯笼和金币都还在。">
          <button type="button" className={primaryBtn} onClick={resume}>
            继续攀登
          </button>
          <button type="button" className={ghostBtn} onClick={restart}>
            重开本关
          </button>
          <button type="button" className={ghostBtn} onClick={backToTitle}>
            返回选关
          </button>
        </Overlay>
      )}

      {phase === "dead" && (
        <Overlay
          kicker="跌落"
          title="信使滑下了暮崖"
          body="金币会回到上一个灯笼。可以从那里重新出发，或把这一关整个重来。"
        >
          <button type="button" className={primaryBtn} onClick={respawn}>
            从灯笼处继续
          </button>
          <button type="button" className={ghostBtn} onClick={restart}>
            <RotateCcw className="size-4" />
            重开本关
          </button>
          <button type="button" className={ghostBtn} onClick={backToTitle}>
            返回选关
          </button>
        </Overlay>
      )}

      {phase === "win" && (
        <Overlay
          kicker="送达"
          title="旗帜接住了这封信"
          body={`${levelName} · ${formatTime(sessionRef.current?.time ?? 0)} · 金币 ${sessionRef.current?.coinCount() ?? 0} / ${sessionRef.current?.level.coins.length ?? 0}`}
        >
          <button type="button" className={primaryBtn} onClick={restart}>
            <Flag className="size-4" />
            再攀一次
          </button>
          <button type="button" className={ghostBtn} onClick={backToTitle}>
            换一条崖路
          </button>
        </Overlay>
      )}

      <div
        className={`touch-pad pointer-events-none absolute inset-x-0 bottom-0 z-30 items-end justify-between gap-3 p-4 ${phase === "play" ? "is-live" : ""}`}
      >
        <div className="pointer-events-auto flex gap-3">
          <Hold code="ArrowLeft" label="向左">
            ←
          </Hold>
          <Hold code="ArrowRight" label="向右">
            →
          </Hold>
        </div>
        <div className="pointer-events-auto flex gap-3">
          <Hold code="ArrowDown" label="穿过薄台">
            下
          </Hold>
          <Hold code="Space" label="跳跃">
            跳
          </Hold>
        </div>
      </div>
    </main>
  );
}

function Hold({ code, label, children }: { code: string; label: string; children: string }) {
  const press = (down: boolean) => {
    const keys = bound?.keys;
    if (!keys) return;
    if (down) keys.add(code);
    else keys.delete(code);
  };
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-14 min-w-14 items-center justify-center rounded-2xl border border-line bg-ink/80 px-4 font-display text-xl text-cream"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        press(true);
      }}
      onPointerUp={() => press(false)}
      onPointerCancel={() => press(false)}
      onLostPointerCapture={() => press(false)}
    >
      {children}
    </button>
  );
}

function Overlay({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-2xl border border-line bg-ink/90 p-6 text-center shadow-lg backdrop-blur-md">
        <p className="text-xs tracking-[0.28em] text-amber">{kicker}</p>
        <h2 className="font-display mt-2 text-4xl">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-cream-dim">{body}</p>
        <div className="mt-5 flex flex-col gap-2">{children}</div>
      </section>
    </div>
  );
}

function drift(level: Level, time: number) {
  for (const pl of level.plats) {
    if (pl.kind !== "mover") continue;
    const ang = (time / pl.period) * Math.PI * 2 + pl.phase;
    const s = Math.sin(ang);
    pl.x = pl.x0 + (pl.axis === "x" ? pl.amp * s : 0);
    pl.y = pl.y0 + (pl.axis === "y" ? pl.amp * s : 0);
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getY: () => number;
      setKeys: (codes: string[]) => void;
      phase: () => Phase;
    };
  }
}
