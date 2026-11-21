import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  PLAYER_MAX_HP,
  createInitialSimulationState,
  stepSimulation,
  type GamePhase,
  type GameSimulationState,
  type PlayerInputState,
} from '../engine/gameRules';
import { GameAudioSynth } from '../engine/gameAudio';
import { ParticlePool } from '../engine/particlePool';
import {
  computeCameraTransform,
  renderVaultSentinelFrame,
} from './VaultSentinelRenderer';

const BEST_SCORE_STORAGE_KEY = 'vaultflow_sentinel_best_score_v1';

interface HudSnapshot {
  readonly phase: GamePhase;
  readonly score: number;
  readonly bestScore: number;
  readonly wave: number;
  readonly hp: number;
  readonly combo: number;
}

interface VaultSentinelGameProps {
  readonly autostart?: boolean;
  readonly onExit: () => void;
}

function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(Math.floor(score)));
  } catch {
    // Ignore storage quota errors
  }
}

/** Custom SVG Vitality Socket with distinct Full / Empty silhouette states. */
const ShieldSocketIcon: React.FC<{ readonly filled: boolean }> = ({ filled }) => (
  <svg
    viewBox="0 0 24 24"
    className="w-6 h-6"
    aria-hidden="true"
  >
    <path
      d="M12 2.5L4.5 5.8V11.7C4.5 16.6 7.7 20.6 12 22C16.3 20.6 19.5 16.6 19.5 11.7V5.8L12 2.5Z"
      fill={filled ? '#38BDF8' : 'rgba(15, 23, 42, 0.72)'}
      stroke={filled ? '#E0F2FE' : '#334155'}
      strokeWidth={1.75}
    />
    {filled && (
      <path
        d="M12 6.2L8.2 8V11.5C8.2 14.2 9.8 16.5 12 17.5C14.2 16.5 15.8 14.2 15.8 11.5V8L12 6.2Z"
        fill="#0EA5E9"
      />
    )}
  </svg>
);

export const VaultSentinelGame: React.FC<VaultSentinelGameProps> = ({
  autostart = false,
  onExit,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const simRef = useRef<GameSimulationState>(
    createInitialSimulationState(autostart ? 'playing' : 'title'),
  );
  const particlesRef = useRef<ParticlePool>(new ParticlePool());
  const audioRef = useRef<GameAudioSynth>(new GameAudioSynth());
  const bestScoreRef = useRef<number>(loadBestScore());

  const heldKeysRef = useRef<Set<string>>(new Set());
  const mouseDownRef = useRef<boolean>(false);
  const dashQueuedRef = useRef<boolean>(false);
  const aimWorldRef = useRef<{ x: number; y: number }>({
    x: ARENA_CENTER_X + 120,
    y: ARENA_CENTER_Y,
  });
  const viewportRef = useRef<{ width: number; height: number }>({
    width: 1280,
    height: 760,
  });

  const [muted, setMuted] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    phase: autostart ? 'playing' : 'title',
    score: 0,
    bestScore: bestScoreRef.current,
    wave: 1,
    hp: PLAYER_MAX_HP,
    combo: 0,
  }));

  const syncHudSnapshot = useCallback(() => {
    const s = simRef.current;
    if (s.score > bestScoreRef.current) {
      bestScoreRef.current = s.score;
      saveBestScore(s.score);
    }
    setHud((prev) => {
      if (
        prev.phase === s.phase &&
        prev.score === s.score &&
        prev.bestScore === bestScoreRef.current &&
        prev.wave === s.wave &&
        prev.hp === s.player.hp &&
        prev.combo === s.combo
      ) {
        return prev;
      }
      return {
        phase: s.phase,
        score: s.score,
        bestScore: bestScoreRef.current,
        wave: s.wave,
        hp: s.player.hp,
        combo: s.combo,
      };
    });
  }, []);

  // Mirror state machine to document.body.dataset.state for testability & lifecycle hygiene
  useEffect(() => {
    const mappedState = hud.phase === 'ko' ? 'playing' : hud.phase;
    document.body.dataset.state = mappedState;
    return () => {
      delete document.body.dataset.state;
    };
  }, [hud.phase]);

  const startNewRun = useCallback(() => {
    audioRef.current.unlock();
    heldKeysRef.current.clear();
    mouseDownRef.current = false;
    dashQueuedRef.current = false;
    particlesRef.current.clear();
    simRef.current = createInitialSimulationState('playing', Date.now() & 0x7fffffff);
    particlesRef.current.spawnRing(ARENA_CENTER_X, ARENA_CENTER_Y, '#6366F1', 160, 0.4);
    syncHudSnapshot();
  }, [syncHudSnapshot]);

  const togglePause = useCallback(() => {
    const s = simRef.current;
    if (s.phase === 'playing') {
      s.phase = 'paused';
      heldKeysRef.current.clear();
      mouseDownRef.current = false;
      syncHudSnapshot();
    } else if (s.phase === 'paused') {
      audioRef.current.unlock();
      s.phase = 'playing';
      syncHudSnapshot();
    }
  }, [syncHudSnapshot]);

  const toggleMute = useCallback(() => {
    audioRef.current.unlock();
    const nextMuted = audioRef.current.toggleMute();
    setMuted(nextMuted);
  }, []);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = computeCameraTransform(rect.width, rect.height);
    if (cam.scale <= 0) return;
    aimWorldRef.current = {
      x: (sx - cam.offsetX) / cam.scale,
      y: (sy - cam.offsetY) / cam.scale,
    };
  }, []);

  // Keyboard, focus-loss, and visibility handlers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const phase = simRef.current.phase;

      if (
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }

      if (phase === 'title' && (code === 'Enter' || code === 'Space')) {
        startNewRun();
        return;
      }

      if (phase === 'gameover' && (code === 'Enter' || code === 'Space')) {
        startNewRun();
        return;
      }

      if (code === 'Escape' || code === 'KeyP') {
        if (phase === 'playing' || phase === 'paused') {
          togglePause();
        }
        return;
      }

      if (code === 'KeyM') {
        toggleMute();
        return;
      }

      if (code === 'KeyR' && (phase === 'playing' || phase === 'paused')) {
        startNewRun();
        return;
      }

      if (phase === 'paused' && code === 'Enter') {
        togglePause();
        return;
      }

      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        if (!e.repeat) {
          dashQueuedRef.current = true;
        }
      }

      heldKeysRef.current.add(code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.code);
    };

    const clearInputsAndPauseIfNeeded = () => {
      heldKeysRef.current.clear();
      mouseDownRef.current = false;
      if (simRef.current.phase === 'playing') {
        simRef.current.phase = 'paused';
        syncHudSnapshot();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearInputsAndPauseIfNeeded();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputsAndPauseIfNeeded);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputsAndPauseIfNeeded);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [startNewRun, toggleMute, togglePause, syncHudSnapshot]);

  // Isolated Canvas ResizeObserver + 60fps requestAnimationFrame simulation loop
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(320, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      viewportRef.current = { width, height };
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(container);

    let rafId = 0;
    let lastTime = performance.now();
    let afterimageTimer = 0;
    let ambientSparkTimer = 0;

    const frame = (now: number) => {
      const rawDt = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
      const clampedDt = Math.min(rawDt, 0.05);

      const keys = heldKeysRef.current;
      const moveX =
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
        (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const moveY =
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) -
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);

      const input: PlayerInputState = {
        moveX,
        moveY,
        aimX: aimWorldRef.current.x,
        aimY: aimWorldRef.current.y,
        firing: mouseDownRef.current || keys.has('Space'),
        dashRequested: dashQueuedRef.current,
      };
      dashQueuedRef.current = false;

      const sim = simRef.current;
      const particles = particlesRef.current;
      const audio = audioRef.current;

      const events = stepSimulation(sim, input, clampedDt);

      // Process emitted combat events into particles & procedural audio
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        switch (ev.type) {
          case 'shoot':
            audio.playShoot();
            particles.spawnBurst(ev.x, ev.y, '#38BDF8', 3, 95);
            break;
          case 'dash':
            audio.playDash();
            particles.spawnRing(ev.x, ev.y, '#38BDF8', 54, 0.25);
            break;
          case 'enemyHit':
            audio.playEnemyHit();
            particles.spawnBurst(ev.x, ev.y, ev.color, 5, 130);
            break;
          case 'enemyKill':
            audio.playEnemyKill(ev.archetype === 'charger');
            particles.spawnBurst(
              ev.x,
              ev.y,
              ev.color,
              ev.archetype === 'charger' ? 22 : 12,
              ev.archetype === 'charger' ? 250 : 190,
            );
            particles.spawnRing(
              ev.x,
              ev.y,
              ev.color,
              ev.archetype === 'charger' ? 88 : 54,
              0.32,
            );
            break;
          case 'telegraph':
            audio.playTelegraph(ev.archetype);
            break;
          case 'playerHit':
            audio.playPlayerHit();
            particles.spawnBurst(ev.x, ev.y, '#F43F5E', 24, 260);
            particles.spawnRing(ev.x, ev.y, '#F43F5E', 175, 0.36);
            break;
          case 'waveClear':
            audio.playWaveClear();
            particles.spawnRing(ARENA_CENTER_X, ARENA_CENTER_Y, '#6366F1', 320, 0.55);
            break;
          case 'gameOver':
            audio.playGameOver();
            particles.spawnBurst(ev.x, ev.y, '#38BDF8', 30, 290);
            break;
        }
      }

      // Dash afterimages & living attract-mode sparks
      if (sim.phase === 'playing' && sim.player.dashTimer > 0) {
        afterimageTimer -= clampedDt;
        if (afterimageTimer <= 0) {
          particles.spawnAfterimage(sim.player.x, sim.player.y, sim.player.aimAngle);
          afterimageTimer = 0.025;
        }
      }
      if (sim.phase === 'title') {
        ambientSparkTimer -= clampedDt;
        if (ambientSparkTimer <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r = 120 + Math.random() * 195;
          particles.spawnBurst(
            ARENA_CENTER_X + Math.cos(a) * r,
            ARENA_CENTER_Y + Math.sin(a) * r,
            Math.random() > 0.5 ? '#6366F1' : '#38BDF8',
            2,
            35,
          );
          ambientSparkTimer = 0.24;
        }
      }

      if (sim.phase !== 'paused') {
        particles.update(clampedDt);
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        renderVaultSentinelFrame(
          ctx,
          viewportRef.current.width,
          viewportRef.current.height,
          sim,
          particles,
          aimWorldRef.current.x,
          aimWorldRef.current.y,
        );
      }

      syncHudSnapshot();
      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [syncHudSnapshot]);

  const comboMultiplier = Math.min(5, 1 + Math.floor(Math.max(0, hud.combo - 1) / 3));

  return (
    <div
      className="fixed inset-0 z-40 bg-[#060911] text-[#F8FAFC] select-none overflow-hidden"
      data-testid="vault-sentinel-shell"
    >
      {/* Isolated Full-Viewport Canvas Layer */}
      <div ref={containerRef} className="w-full h-full relative">
        <canvas
          ref={canvasRef}
          className="block w-full h-full cursor-crosshair touch-none"
          onPointerMove={(e) => screenToWorld(e.clientX, e.clientY)}
          onPointerDown={(e) => {
            audioRef.current.unlock();
            screenToWorld(e.clientX, e.clientY);
            if (simRef.current.phase !== 'playing') return;
            if (e.button === 2) {
              dashQueuedRef.current = true;
            } else {
              mouseDownRef.current = true;
            }
          }}
          onPointerUp={() => {
            mouseDownRef.current = false;
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* TITLE SCREEN OVERLAY (No HUD, Live Animated Canvas Behind) */}
      {hud.phase === 'title' && (
        <div className="pointer-events-none fixed inset-0 flex flex-col justify-between p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onExit}
              className="pointer-events-auto min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#0F172A]/85 border border-[#334155] hover:border-[#6366F1] text-xs font-semibold text-[#CBD5E1] hover:text-white transition-colors cursor-pointer"
            >
              ← Back to VaultFlow
            </button>
            {hud.bestScore > 0 && (
              <div className="font-mono tabular-nums text-xs font-semibold tracking-wider text-[#94A3B8]">
                BEST {hud.bestScore.toLocaleString()}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center text-center my-auto px-4">
            {/* Custom Inline SVG Title Lockup */}
            <svg
              viewBox="0 0 460 116"
              className="w-full max-w-[440px] h-auto mb-6"
              role="img"
              aria-label="Vault Sentinel"
            >
              <defs>
                <linearGradient id="vsTitleGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F8FAFC" />
                  <stop offset="55%" stopColor="#38BDF8" />
                  <stop offset="100%" stopColor="#818CF8" />
                </linearGradient>
              </defs>
              <polygon
                points="230,6 250,18 250,41 230,53 210,41 210,18"
                fill="rgba(99, 102, 241, 0.22)"
                stroke="#38BDF8"
                strokeWidth="2.2"
              />
              <polygon
                points="230,17 240,29 230,41 220,29"
                fill="#38BDF8"
              />
              <text
                x="230"
                y="92"
                textAnchor="middle"
                fill="url(#vsTitleGrad)"
                fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
                fontWeight="800"
                fontSize="40"
                letterSpacing="6"
              >
                VAULT SENTINEL
              </text>
              <line
                x1="110"
                y1="106"
                x2="350"
                y2="106"
                stroke="rgba(56, 189, 248, 0.4)"
                strokeWidth="1.5"
              />
            </svg>

            <button
              type="button"
              data-start="true"
              onClick={startNewRun}
              className="pointer-events-auto min-w-[200px] h-13 px-9 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] active:scale-[0.98] text-sm font-extrabold tracking-[0.18em] uppercase text-white shadow-[0_0_28px_rgba(99,102,241,0.45)] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#38BDF8]"
            >
              Play
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs font-medium tracking-wide text-[#94A3B8]">
              WASD Move · Mouse Aim &amp; Fire · Shift Dash · Esc Pause
            </p>
          </div>
        </div>
      )}

      {/* ACTIVE PLAYING HUD (Zero backdrop-filter, pointer-events: none wrapper, >= 85% unobstructed) */}
      {(hud.phase === 'playing' || hud.phase === 'ko') && (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 p-4 sm:p-5 flex items-start justify-between gap-4"
          data-testid="game-hud"
        >
          {/* Top-Left: Vitality Sockets + Wave */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1" aria-label={`Shield integrity ${hud.hp} of ${PLAYER_MAX_HP}`}>
              {Array.from({ length: PLAYER_MAX_HP }).map((_, idx) => (
                <ShieldSocketIcon key={idx} filled={idx < hud.hp} />
              ))}
            </div>
            <div className="h-4 w-px bg-[#232D42]" aria-hidden="true" />
            <div className="font-mono tabular-nums text-xs font-bold tracking-widest text-[#94A3B8]">
              WAVE <span className="text-[#F8FAFC]">{String(hud.wave).padStart(2, '0')}</span>
            </div>
          </div>

          {/* Top-Center: Score & Active Combo */}
          <div className="flex flex-col items-center">
            <div
              data-testid="hud-score"
              className="font-mono tabular-nums text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F8FAFC] leading-none"
            >
              {hud.score.toLocaleString()}
            </div>
            {comboMultiplier > 1 && (
              <div className="mt-1 font-mono tabular-nums text-[11px] font-bold tracking-widest text-[#38BDF8]">
                x{comboMultiplier} COMBO
              </div>
            )}
          </div>

          {/* Top-Right: Compact Square Utility Icon Buttons (No text clutter, tabIndex -1) */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title={muted ? 'Unmute [M]' : 'Mute [M]'}
              onClick={(e) => {
                toggleMute();
                e.currentTarget.blur();
              }}
              className="w-9 h-9 rounded-lg bg-[#0B101B] border border-[#232D42] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {muted ? (
                  <path d="M22 9l-6 6M16 9l6 6" />
                ) : (
                  <path d="M15.5 8.5a5 5 0 010 7M19 5a9 9 0 010 14" />
                )}
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause game"
              title="Pause [P]"
              onClick={(e) => {
                togglePause();
                e.currentTarget.blur();
              }}
              className="w-9 h-9 rounded-lg bg-[#0B101B] border border-[#232D42] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            </button>

            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart run"
              title="Restart [R]"
              onClick={(e) => {
                startNewRun();
                e.currentTarget.blur();
              }}
              className="w-9 h-9 rounded-lg bg-[#0B101B] border border-[#232D42] hover:border-[#38BDF8] text-[#CBD5E1] hover:text-white flex items-center justify-center cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* PAUSED MODAL */}
      {hud.phase === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Game paused"
          className="fixed inset-0 bg-[#060911]/75 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-xs rounded-2xl bg-[#111623] border border-[#232D42] p-6 text-center space-y-5 shadow-2xl">
            <h2 className="text-xl font-extrabold tracking-widest uppercase text-[#F8FAFC]">
              Paused
            </h2>
            <div className="flex justify-center gap-6 font-mono tabular-nums text-xs text-[#94A3B8]">
              <div>
                <p className="text-[10px] uppercase tracking-wider">Score</p>
                <p className="text-base font-bold text-[#F8FAFC] mt-0.5">
                  {hud.score.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider">Wave</p>
                <p className="text-base font-bold text-[#38BDF8] mt-0.5">{hud.wave}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={togglePause}
                className="w-full h-11 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-sm font-bold text-white cursor-pointer"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={startNewRun}
                className="w-full h-10 rounded-xl bg-[#1A2234] border border-[#232D42] hover:border-[#38BDF8] text-xs font-semibold text-[#F8FAFC] cursor-pointer"
              >
                Restart Run
              </button>
              <button
                type="button"
                onClick={onExit}
                className="w-full h-10 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] cursor-pointer"
              >
                Exit to VaultFlow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {hud.phase === 'gameover' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Game over"
          className="fixed inset-0 bg-[#060911]/80 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#111623] border border-[#232D42] p-6 text-center space-y-5 shadow-2xl">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F43F5E]">
                Vault Breached
              </p>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#F8FAFC] mt-1">
                Run Complete
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#0B101B] border border-[#232D42] p-3.5 font-mono tabular-nums">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">Score</p>
                <p className="text-lg font-extrabold text-[#F8FAFC] mt-0.5">
                  {hud.score.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">Best</p>
                <p className="text-lg font-extrabold text-[#38BDF8] mt-0.5">
                  {hud.bestScore.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">Wave</p>
                <p className="text-lg font-extrabold text-[#818CF8] mt-0.5">{hud.wave}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                data-start="true"
                onClick={startNewRun}
                className="w-full h-11 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-sm font-bold tracking-wide text-white cursor-pointer"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={onExit}
                className="w-full h-10 rounded-xl bg-[#1A2234] border border-[#232D42] hover:border-[#94A3B8] text-xs font-semibold text-[#CBD5E1] hover:text-white cursor-pointer"
              >
                Back to VaultFlow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
