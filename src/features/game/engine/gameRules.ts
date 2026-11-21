export type GamePhase = 'title' | 'playing' | 'paused' | 'ko' | 'gameover';

export type EnemyArchetype = 'swarmer' | 'sniper' | 'charger';

export type EnemyAIState = 'approach' | 'orbit' | 'windup' | 'lunge' | 'recover';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  radius: number;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  dashCooldown: number;
  dashTimer: number;
  dashDirX: number;
  dashDirY: number;
  invulnTimer: number;
  hitFlashTimer: number;
  squashX: number;
  squashY: number;
}

export interface EnemyEntity {
  id: number;
  archetype: EnemyArchetype;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  aiState: EnemyAIState;
  stateTimer: number;
  windupDuration: number;
  targetX: number;
  targetY: number;
  phaseOffset: number;
  hitFlashTimer: number;
  hasAttackToken: boolean;
}

export interface ProjectileEntity {
  id: number;
  owner: 'player' | 'enemy';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  color: string;
}

export interface PlayerInputState {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  firing: boolean;
  dashRequested: boolean;
}

export interface WaveConfig {
  readonly wave: number;
  readonly totalSpawns: number;
  readonly spawnInterval: number;
  readonly speedMultiplier: number;
  readonly maxAttackTokens: number;
  readonly swarmerThreshold: number;
  readonly sniperThreshold: number;
}

export type GameEvent =
  | { type: 'shoot'; x: number; y: number; angle: number }
  | { type: 'dash'; x: number; y: number; angle: number }
  | { type: 'enemyHit'; x: number; y: number; color: string }
  | { type: 'enemyKill'; x: number; y: number; color: string; archetype: EnemyArchetype; points: number }
  | { type: 'telegraph'; x: number; y: number; archetype: 'sniper' | 'charger' }
  | { type: 'enemyShoot'; x: number; y: number }
  | { type: 'playerHit'; x: number; y: number }
  | { type: 'waveClear'; wave: number }
  | { type: 'gameOver'; x: number; y: number };

export interface GameSimulationState {
  phase: GamePhase;
  elapsed: number;
  score: number;
  combo: number;
  comboTimer: number;
  wave: number;
  waveSpawned: number;
  waveBannerTimer: number;
  spawnTimer: number;
  hitstopTimer: number;
  trauma: number;
  koTimer: number;
  nextEntityId: number;
  rngState: number;
  player: PlayerState;
  enemies: EnemyEntity[];
  projectiles: ProjectileEntity[];
}

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 760;
export const ARENA_CENTER_X = WORLD_WIDTH / 2;
export const ARENA_CENTER_Y = WORLD_HEIGHT / 2;
export const ARENA_RADIUS = 330;

export const MAX_DT = 0.05;
export const PLAYER_MAX_HP = 3;
export const PLAYER_SPEED = 325;
export const PLAYER_DASH_SPEED = 860;
export const PLAYER_DASH_DURATION = 0.14;
export const PLAYER_DASH_COOLDOWN = 0.95;
export const PLAYER_FIRE_INTERVAL = 0.15;
export const PLAYER_INVULN_DURATION = 1.15;
export const KO_DURATION = 0.35;

/** Deterministic PRNG (Mulberry32 step) so simulation & tests stay reproducible. */
export function nextRandom(state: GameSimulationState): number {
  let t = (state.rngState + 0x6d2b79f5) | 0;
  state.rngState = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Multi-knob wave difficulty ramp. */
export function getWaveConfig(wave: number): WaveConfig {
  const safeWave = Math.max(1, Math.floor(wave));
  const totalSpawns = 5 + safeWave * 3;
  const spawnInterval = Math.max(0.42, 1.32 - (safeWave - 1) * 0.1);
  const speedMultiplier = Math.min(1.85, 1 + (safeWave - 1) * 0.085);
  const maxAttackTokens = Math.min(4, 1 + Math.floor((safeWave + 1) / 2));

  // Wave 1: Swarmers + Snipers. Wave 2+: introduces Chargers and gradually increases elite share.
  const swarmerThreshold = safeWave === 1 ? 0.72 : Math.max(0.38, 0.62 - (safeWave - 2) * 0.05);
  const sniperThreshold = safeWave === 1 ? 1.0 : Math.min(0.84, swarmerThreshold + 0.28);

  return {
    wave: safeWave,
    totalSpawns,
    spawnInterval,
    speedMultiplier,
    maxAttackTokens,
    swarmerThreshold,
    sniperThreshold,
  };
}

export function pickArchetype(wave: number, roll: number): EnemyArchetype {
  const cfg = getWaveConfig(wave);
  if (roll < cfg.swarmerThreshold) return 'swarmer';
  if (roll < cfg.sniperThreshold) return 'sniper';
  return 'charger';
}

export function countActiveAttackTokens(enemies: readonly EnemyEntity[]): number {
  let count = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (enemies[i].hasAttackToken) count++;
  }
  return count;
}

export function canClaimAttackToken(
  enemies: readonly EnemyEntity[],
  maxTokens: number,
): boolean {
  return countActiveAttackTokens(enemies) < maxTokens;
}

export function getArchetypeColor(archetype: EnemyArchetype): string {
  switch (archetype) {
    case 'swarmer':
      return '#F43F5E';
    case 'sniper':
      return '#F59E0B';
    case 'charger':
      return '#818CF8';
  }
}

export function computeScoreGain(archetype: EnemyArchetype, combo: number): number {
  const base = archetype === 'charger' ? 250 : archetype === 'sniper' ? 180 : 100;
  const multiplier = Math.min(5, 1 + Math.floor(Math.max(0, combo - 1) / 3));
  return base * multiplier;
}

export function createEnemy(
  id: number,
  archetype: EnemyArchetype,
  wave: number,
  spawnAngle: number,
): EnemyEntity {
  const cfg = getWaveConfig(wave);
  const spawnDist = ARENA_RADIUS + 34;
  const x = ARENA_CENTER_X + Math.cos(spawnAngle) * spawnDist;
  const y = ARENA_CENTER_Y + Math.sin(spawnAngle) * spawnDist;

  if (archetype === 'sniper') {
    return {
      id,
      archetype,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: spawnAngle + Math.PI,
      radius: 17,
      hp: 2 + Math.floor((wave - 1) / 4),
      maxHp: 2 + Math.floor((wave - 1) / 4),
      speed: 138 * cfg.speedMultiplier,
      aiState: 'orbit',
      stateTimer: 1.0,
      windupDuration: 0.65,
      targetX: ARENA_CENTER_X,
      targetY: ARENA_CENTER_Y,
      phaseOffset: (id * 1.7) % (Math.PI * 2),
      hitFlashTimer: 0,
      hasAttackToken: false,
    };
  }

  if (archetype === 'charger') {
    const hp = 4 + Math.floor((wave - 1) / 3);
    return {
      id,
      archetype,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: spawnAngle + Math.PI,
      radius: 22,
      hp,
      maxHp: hp,
      speed: 122 * cfg.speedMultiplier,
      aiState: 'approach',
      stateTimer: 0.85,
      windupDuration: 0.55,
      targetX: ARENA_CENTER_X,
      targetY: ARENA_CENTER_Y,
      phaseOffset: (id * 2.1) % (Math.PI * 2),
      hitFlashTimer: 0,
      hasAttackToken: false,
    };
  }

  return {
    id,
    archetype: 'swarmer',
    x,
    y,
    vx: 0,
    vy: 0,
    angle: spawnAngle + Math.PI,
    radius: 14,
    hp: 1 + Math.floor((wave - 1) / 5),
    maxHp: 1 + Math.floor((wave - 1) / 5),
    speed: 172 * cfg.speedMultiplier,
    aiState: 'approach',
    stateTimer: 0,
    windupDuration: 0,
    targetX: ARENA_CENTER_X,
    targetY: ARENA_CENTER_Y,
    phaseOffset: (id * 1.37) % (Math.PI * 2),
    hitFlashTimer: 0,
    hasAttackToken: false,
  };
}

export function createInitialSimulationState(
  phase: GamePhase = 'title',
  seed = 133742,
): GameSimulationState {
  return {
    phase,
    elapsed: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    wave: 1,
    waveSpawned: 0,
    waveBannerTimer: phase === 'playing' ? 1.4 : 0,
    spawnTimer: 0.45,
    hitstopTimer: 0,
    trauma: 0,
    koTimer: 0,
    nextEntityId: 1,
    rngState: seed,
    player: {
      x: ARENA_CENTER_X,
      y: ARENA_CENTER_Y,
      vx: 0,
      vy: 0,
      aimAngle: -Math.PI / 2,
      radius: 16,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      fireCooldown: 0,
      dashCooldown: 0,
      dashTimer: 0,
      dashDirX: 0,
      dashDirY: -1,
      invulnTimer: 0,
      hitFlashTimer: 0,
      squashX: 1,
      squashY: 1,
    },
    enemies: [],
    projectiles: [],
  };
}

/** Applies damage to the player; returns whether damage landed and whether KO began. */
export function applyPlayerDamage(state: GameSimulationState): {
  damaged: boolean;
  enteredKo: boolean;
} {
  if (state.phase !== 'playing') {
    return { damaged: false, enteredKo: false };
  }
  const p = state.player;
  if (p.invulnTimer > 0 || p.dashTimer > 0) {
    return { damaged: false, enteredKo: false };
  }

  p.hp = Math.max(0, p.hp - 1);
  p.invulnTimer = PLAYER_INVULN_DURATION;
  p.hitFlashTimer = 0.14;
  state.combo = 0;
  state.comboTimer = 0;
  state.hitstopTimer = 0.065;
  state.trauma = Math.min(1, state.trauma + 0.85);

  if (p.hp <= 0) {
    state.phase = 'ko';
    state.koTimer = KO_DURATION;
    state.hitstopTimer = 0.075;
    return { damaged: true, enteredKo: true };
  }

  // Defensive radial pulse pushes close threats back on non-lethal hit
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 170) {
      e.x += (dx / dist) * 62;
      e.y += (dy / dist) * 62;
      if (e.aiState === 'windup' || e.aiState === 'lunge') {
        e.aiState = 'recover';
        e.stateTimer = 0.7;
        e.hasAttackToken = false;
      }
    }
  }

  return { damaged: true, enteredKo: false };
}

function clampToArena(x: number, y: number, margin: number): Vec2 {
  const dx = x - ARENA_CENTER_X;
  const dy = y - ARENA_CENTER_Y;
  const dist = Math.hypot(dx, dy);
  const maxR = ARENA_RADIUS - margin;
  if (dist <= maxR || dist === 0) {
    return { x, y };
  }
  const scale = maxR / dist;
  return {
    x: ARENA_CENTER_X + dx * scale,
    y: ARENA_CENTER_Y + dy * scale,
  };
}

/** Main decoupled fixed/clamped-dt simulation step. Mutates state in place for zero per-frame allocations. */
export function stepSimulation(
  state: GameSimulationState,
  input: PlayerInputState,
  rawDt: number,
): GameEvent[] {
  const events: GameEvent[] = [];
  const dt = Math.min(Math.max(rawDt, 0), MAX_DT);

  // Title attract scene: gentle living orbital motion, invulnerable
  if (state.phase === 'title') {
    state.elapsed += dt;
    state.player.x = ARENA_CENTER_X + Math.cos(state.elapsed * 0.75) * 44;
    state.player.y = ARENA_CENTER_Y + Math.sin(state.elapsed * 0.75) * 26;
    state.player.aimAngle = state.elapsed * 0.9;
    return events;
  }

  if (state.phase === 'paused' || state.phase === 'gameover') {
    return events;
  }

  // Always decay trauma smoothly even during hitstop/KO
  state.trauma = Math.max(0, state.trauma - dt * 1.9);

  if (state.hitstopTimer > 0) {
    state.hitstopTimer = Math.max(0, state.hitstopTimer - dt);
    return events;
  }

  if (state.phase === 'ko') {
    state.koTimer -= dt;
    state.elapsed += dt;
    if (state.koTimer <= 0) {
      state.phase = 'gameover';
      events.push({ type: 'gameOver', x: state.player.x, y: state.player.y });
    }
    return events;
  }

  // Active playing state
  state.elapsed += dt;
  if (state.waveBannerTimer > 0) {
    state.waveBannerTimer = Math.max(0, state.waveBannerTimer - dt);
  }
  if (state.combo > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      state.comboTimer = 0;
    }
  }

  const p = state.player;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.invulnTimer = Math.max(0, p.invulnTimer - dt);
  p.hitFlashTimer = Math.max(0, p.hitFlashTimer - dt);

  // Relax squash & stretch smoothly back to 1
  p.squashX += (1 - p.squashX) * Math.min(1, dt * 14);
  p.squashY += (1 - p.squashY) * Math.min(1, dt * 14);

  // Aim vector
  p.aimAngle = Math.atan2(input.aimY - p.y, input.aimX - p.x);

  // Normalize movement vector
  let mx = input.moveX;
  let my = input.moveY;
  const mLen = Math.hypot(mx, my);
  if (mLen > 1) {
    mx /= mLen;
    my /= mLen;
  }

  // Trigger Phase Dash
  if (input.dashRequested && p.dashCooldown <= 0 && p.dashTimer <= 0) {
    const dirX = mLen > 0.1 ? mx : Math.cos(p.aimAngle);
    const dirY = mLen > 0.1 ? my : Math.sin(p.aimAngle);
    p.dashDirX = dirX;
    p.dashDirY = dirY;
    p.dashTimer = PLAYER_DASH_DURATION;
    p.dashCooldown = PLAYER_DASH_COOLDOWN;
    p.squashX = 1.42;
    p.squashY = 0.68;
    events.push({ type: 'dash', x: p.x, y: p.y, angle: Math.atan2(dirY, dirX) });
  }

  // Move player
  if (p.dashTimer > 0) {
    p.dashTimer = Math.max(0, p.dashTimer - dt);
    p.vx = p.dashDirX * PLAYER_DASH_SPEED;
    p.vy = p.dashDirY * PLAYER_DASH_SPEED;
  } else {
    const targetVx = mx * PLAYER_SPEED;
    const targetVy = my * PLAYER_SPEED;
    const accel = mLen > 0.05 ? 16 : 12;
    p.vx += (targetVx - p.vx) * Math.min(1, dt * accel);
    p.vy += (targetVy - p.vy) * Math.min(1, dt * accel);
  }

  const nextPos = clampToArena(p.x + p.vx * dt, p.y + p.vy * dt, p.radius + 6);
  p.x = nextPos.x;
  p.y = nextPos.y;

  // Player primary fire
  if (input.firing && p.fireCooldown <= 0) {
    p.fireCooldown = PLAYER_FIRE_INTERVAL;
    const spread = (nextRandom(state) - 0.5) * 0.055;
    const shotAngle = p.aimAngle + spread;
    const muzzleX = p.x + Math.cos(shotAngle) * 20;
    const muzzleY = p.y + Math.sin(shotAngle) * 20;
    state.projectiles.push({
      id: state.nextEntityId++,
      owner: 'player',
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(shotAngle) * 760,
      vy: Math.sin(shotAngle) * 760,
      radius: 5,
      life: 0.95,
      color: '#38BDF8',
    });
    // Crisp recoil feel
    p.vx -= Math.cos(shotAngle) * 26;
    p.vy -= Math.sin(shotAngle) * 26;
    p.squashX = 0.86;
    p.squashY = 1.16;
    events.push({ type: 'shoot', x: muzzleX, y: muzzleY, angle: shotAngle });
  }

  // Wave spawner
  const waveCfg = getWaveConfig(state.wave);
  if (state.waveSpawned < waveCfg.totalSpawns) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const archetype = pickArchetype(state.wave, nextRandom(state));
      const spawnAngle = nextRandom(state) * Math.PI * 2;
      state.enemies.push(
        createEnemy(state.nextEntityId++, archetype, state.wave, spawnAngle),
      );
      state.waveSpawned++;
      state.spawnTimer = waveCfg.spawnInterval;
    }
  } else if (state.enemies.length === 0) {
    // Advance to next wave!
    state.wave += 1;
    state.waveSpawned = 0;
    state.spawnTimer = 1.15;
    state.waveBannerTimer = 1.6;
    state.score += 150 * (state.wave - 1);
    events.push({ type: 'waveClear', wave: state.wave });
  }

  // Update Enemies (distinct AI policies + fair attack token pool)
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const angleToPlayer = Math.atan2(dy, dx);

    if (e.archetype === 'swarmer') {
      // Agile sine-weave flanker
      const weave = Math.sin(state.elapsed * 5.2 + e.phaseOffset) * 0.55;
      const moveAngle = angleToPlayer + weave;
      e.vx = Math.cos(moveAngle) * e.speed;
      e.vy = Math.sin(moveAngle) * e.speed;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.angle = moveAngle;
    } else if (e.archetype === 'sniper') {
      // Mid-range orbit kiter with clear 0.65s laser windup telegraph
      if (e.aiState === 'orbit' || e.aiState === 'approach') {
        const desiredDist = 235;
        const radialPush = dist < desiredDist - 35 ? -1 : dist > desiredDist + 35 ? 1 : 0;
        const tangentDir = e.id % 2 === 0 ? 1 : -1;
        const tangentAngle = angleToPlayer + (Math.PI / 2) * tangentDir;
        e.vx =
          Math.cos(angleToPlayer) * radialPush * e.speed * 0.85 +
          Math.cos(tangentAngle) * e.speed * 0.72;
        e.vy =
          Math.sin(angleToPlayer) * radialPush * e.speed * 0.85 +
          Math.sin(tangentAngle) * e.speed * 0.72;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.angle = angleToPlayer;
        e.stateTimer -= dt;

        const insideArena =
          Math.hypot(e.x - ARENA_CENTER_X, e.y - ARENA_CENTER_Y) < ARENA_RADIUS - 12;

        if (
          e.stateTimer <= 0 &&
          insideArena &&
          canClaimAttackToken(state.enemies, waveCfg.maxAttackTokens)
        ) {
          e.aiState = 'windup';
          e.stateTimer = e.windupDuration;
          e.hasAttackToken = true;
          e.targetX = p.x;
          e.targetY = p.y;
          e.vx = 0;
          e.vy = 0;
          events.push({ type: 'telegraph', x: e.x, y: e.y, archetype: 'sniper' });
        }
      } else if (e.aiState === 'windup') {
        // Track slowly during early half of windup, then lock aim so player can dodge!
        if (e.stateTimer > e.windupDuration * 0.42) {
          e.targetX = p.x;
          e.targetY = p.y;
        }
        e.angle = Math.atan2(e.targetY - e.y, e.targetX - e.x);
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          const boltSpeed = 435 * Math.min(1.3, waveCfg.speedMultiplier);
          state.projectiles.push({
            id: state.nextEntityId++,
            owner: 'enemy',
            x: e.x + Math.cos(e.angle) * 18,
            y: e.y + Math.sin(e.angle) * 18,
            vx: Math.cos(e.angle) * boltSpeed,
            vy: Math.sin(e.angle) * boltSpeed,
            radius: 6,
            life: 2.2,
            color: '#F59E0B',
          });
          e.aiState = 'recover';
          e.stateTimer = 0.95;
          e.hasAttackToken = false;
          events.push({ type: 'enemyShoot', x: e.x, y: e.y });
        }
      } else {
        e.stateTimer -= dt;
        e.angle = angleToPlayer;
        if (e.stateTimer <= 0) {
          e.aiState = 'orbit';
          e.stateTimer = 1.25;
        }
      }
    } else {
      // Renewal Charger: closes in, shows 0.55s lock-on telegraph, then lunges at high speed
      if (e.aiState === 'approach') {
        e.vx = Math.cos(angleToPlayer) * e.speed;
        e.vy = Math.sin(angleToPlayer) * e.speed;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.angle = angleToPlayer;
        e.stateTimer -= dt;

        if (
          e.stateTimer <= 0 &&
          dist < 260 &&
          canClaimAttackToken(state.enemies, waveCfg.maxAttackTokens)
        ) {
          e.aiState = 'windup';
          e.stateTimer = e.windupDuration;
          e.hasAttackToken = true;
          e.targetX = p.x;
          e.targetY = p.y;
          e.vx = 0;
          e.vy = 0;
          events.push({ type: 'telegraph', x: e.x, y: e.y, archetype: 'charger' });
        }
      } else if (e.aiState === 'windup') {
        if (e.stateTimer > e.windupDuration * 0.45) {
          e.targetX = p.x;
          e.targetY = p.y;
        }
        e.angle = Math.atan2(e.targetY - e.y, e.targetX - e.x);
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          const lungeSpeed = 480 * Math.min(1.3, waveCfg.speedMultiplier);
          e.vx = Math.cos(e.angle) * lungeSpeed;
          e.vy = Math.sin(e.angle) * lungeSpeed;
          e.aiState = 'lunge';
          e.stateTimer = 0.42;
        }
      } else if (e.aiState === 'lunge') {
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vx *= Math.pow(0.28, dt);
        e.vy *= Math.pow(0.28, dt);
        e.stateTimer -= dt;
        if (e.stateTimer <= 0) {
          e.aiState = 'recover';
          e.stateTimer = 0.72;
          e.hasAttackToken = false;
        }
      } else {
        e.stateTimer -= dt;
        e.angle = angleToPlayer;
        if (e.stateTimer <= 0) {
          e.aiState = 'approach';
          e.stateTimer = 0.9;
        }
      }
    }

    // Soft enemy-enemy separation so silhouettes stay crisp and readable
    for (let j = i + 1; j < state.enemies.length; j++) {
      const other = state.enemies[j];
      const sdx = e.x - other.x;
      const sdy = e.y - other.y;
      const minSep = e.radius + other.radius + 6;
      const sDistSq = sdx * sdx + sdy * sdy;
      if (sDistSq > 0.001 && sDistSq < minSep * minSep) {
        const sDist = Math.sqrt(sDistSq);
        const push = (minSep - sDist) * 0.32;
        const nx = sdx / sDist;
        const ny = sdy / sDist;
        e.x += nx * push;
        e.y += ny * push;
        other.x -= nx * push;
        other.y -= ny * push;
      }
    }
  }

  // Update Projectiles & Check Collisions
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.life -= dt;

    const distFromCenter = Math.hypot(proj.x - ARENA_CENTER_X, proj.y - ARENA_CENTER_Y);
    if (proj.life <= 0 || distFromCenter > ARENA_RADIUS + 64) {
      state.projectiles.splice(i, 1);
      continue;
    }

    if (proj.owner === 'player') {
      let hit = false;
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];
        const hitDist = e.radius + proj.radius;
        const ddx = e.x - proj.x;
        const ddy = e.y - proj.y;
        if (ddx * ddx + ddy * ddy <= hitDist * hitDist) {
          hit = true;
          e.hp -= 1;
          e.hitFlashTimer = 0.065;
          // Crisp knockback impulse
          const pLen = Math.hypot(proj.vx, proj.vy) || 1;
          e.x += (proj.vx / pLen) * 8;
          e.y += (proj.vy / pLen) * 8;

          const color = getArchetypeColor(e.archetype);
          if (e.hp <= 0) {
            state.combo += 1;
            state.comboTimer = 3.2;
            const points = computeScoreGain(e.archetype, state.combo);
            state.score += points;
            if (e.archetype === 'charger') {
              state.hitstopTimer = 0.045;
              state.trauma = Math.min(1, state.trauma + 0.42);
            } else {
              state.trauma = Math.min(1, state.trauma + 0.16);
            }
            events.push({
              type: 'enemyKill',
              x: e.x,
              y: e.y,
              color,
              archetype: e.archetype,
              points,
            });
            state.enemies.splice(j, 1);
          } else {
            events.push({ type: 'enemyHit', x: proj.x, y: proj.y, color });
          }
          break;
        }
      }
      if (hit) {
        state.projectiles.splice(i, 1);
      }
    } else {
      // Enemy projectile hitting player
      const hitDist = p.radius + proj.radius - 2;
      const ddx = p.x - proj.x;
      const ddy = p.y - proj.y;
      if (ddx * ddx + ddy * ddy <= hitDist * hitDist) {
        state.projectiles.splice(i, 1);
        const dmg = applyPlayerDamage(state);
        if (dmg.damaged) {
          events.push({ type: 'playerHit', x: p.x, y: p.y });
          if (dmg.enteredKo) {
            return events;
          }
        }
      }
    }
  }

  // Enemy body colliding with player
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    const hitDist = p.radius + e.radius - 3;
    const ddx = p.x - e.x;
    const ddy = p.y - e.y;
    if (ddx * ddx + ddy * ddy <= hitDist * hitDist) {
      const dmg = applyPlayerDamage(state);
      if (dmg.damaged) {
        events.push({ type: 'playerHit', x: p.x, y: p.y });
        if (dmg.enteredKo) {
          return events;
        }
      }
    }
  }

  return events;
}
