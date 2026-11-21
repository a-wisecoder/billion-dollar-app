import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  KO_DURATION,
  PLAYER_INVULN_DURATION,
  applyPlayerDamage,
  canClaimAttackToken,
  computeScoreGain,
  countActiveAttackTokens,
  createEnemy,
  createInitialSimulationState,
  getWaveConfig,
  pickArchetype,
  stepSimulation,
  type PlayerInputState,
} from './gameRules.ts';

const IDLE_INPUT: PlayerInputState = {
  moveX: 0,
  moveY: 0,
  aimX: ARENA_CENTER_X + 100,
  aimY: ARENA_CENTER_Y,
  firing: false,
  dashRequested: false,
};

test('wave difficulty smoothly ramps multiple knobs across waves', () => {
  const w1 = getWaveConfig(1);
  const w3 = getWaveConfig(3);
  const w6 = getWaveConfig(6);

  assert.ok(w3.totalSpawns > w1.totalSpawns);
  assert.ok(w6.totalSpawns > w3.totalSpawns);
  assert.ok(w3.spawnInterval < w1.spawnInterval);
  assert.ok(w6.speedMultiplier > w3.speedMultiplier);
  assert.ok(w6.maxAttackTokens >= w1.maxAttackTokens);
});

test('pickArchetype spawns swarmer & sniper in wave 1 and introduces charger from wave 2+', () => {
  assert.equal(pickArchetype(1, 0.1), 'swarmer');
  assert.equal(pickArchetype(1, 0.95), 'sniper');
  assert.equal(pickArchetype(2, 0.95), 'charger');
});

test('attack token pool caps concurrent telegraphing enemies fairly', () => {
  const e1 = createEnemy(1, 'sniper', 2, 0);
  const e2 = createEnemy(2, 'charger', 2, 1.5);
  e1.hasAttackToken = true;

  assert.equal(countActiveAttackTokens([e1, e2]), 1);
  assert.equal(canClaimAttackToken([e1, e2], 1), false);
  assert.equal(canClaimAttackToken([e1, e2], 2), true);
});

test('player damage respects invulnerability frames and reaches KO -> gameover cleanly', () => {
  const state = createInitialSimulationState('playing');
  assert.equal(state.player.hp, 3);

  // Hit 1
  const h1 = applyPlayerDamage(state);
  assert.equal(h1.damaged, true);
  assert.equal(h1.enteredKo, false);
  assert.equal(state.player.hp, 2);
  assert.ok(state.player.invulnTimer > 0);

  // Immediate follow-up hit during invulnerability is ignored
  const blocked = applyPlayerDamage(state);
  assert.equal(blocked.damaged, false);
  assert.equal(state.player.hp, 2);

  // Clear invuln & hit 2
  state.player.invulnTimer = 0;
  applyPlayerDamage(state);
  assert.equal(state.player.hp, 1);

  // Clear invuln & lethal hit 3 -> enters KO transition
  state.player.invulnTimer = 0;
  const lethal = applyPlayerDamage(state);
  assert.equal(lethal.damaged, true);
  assert.equal(lethal.enteredKo, true);
  assert.equal(state.player.hp, 0);
  assert.equal(state.phase, 'ko');

  // Step through hitstop + KO dissolve duration -> transitions to gameover
  let elapsed = 0;
  let sawGameOver = false;
  while (elapsed < KO_DURATION + 0.25) {
    const events = stepSimulation(state, IDLE_INPUT, 0.04);
    if (events.some((ev) => ev.type === 'gameOver')) {
      sawGameOver = true;
    }
    elapsed += 0.04;
  }

  assert.equal(sawGameOver, true);
  assert.equal(state.phase, 'gameover');
  assert.ok(PLAYER_INVULN_DURATION > 0.5);
});

test('firing destroys an enemy, increments score and combo, and clears wave when empty', () => {
  const state = createInitialSimulationState('playing');
  const waveCfg = getWaveConfig(1);
  state.waveSpawned = waveCfg.totalSpawns;

  // Place a 1-HP swarmer directly along player's aim vector
  const target = createEnemy(99, 'swarmer', 1, 0);
  target.x = state.player.x + 85;
  target.y = state.player.y;
  target.hp = 1;
  state.enemies = [target];

  const firingInput: PlayerInputState = {
    moveX: 0,
    moveY: 0,
    aimX: target.x,
    aimY: target.y,
    firing: true,
    dashRequested: false,
  };

  let killed = false;
  let waveCleared = false;
  for (let i = 0; i < 15; i++) {
    const events = stepSimulation(state, firingInput, 0.03);
    if (events.some((ev) => ev.type === 'enemyKill')) killed = true;
    if (events.some((ev) => ev.type === 'waveClear')) waveCleared = true;
  }

  assert.equal(killed, true);
  assert.equal(waveCleared, true);
  assert.equal(state.wave, 2);
  assert.ok(state.score >= computeScoreGain('swarmer', 1));
});
