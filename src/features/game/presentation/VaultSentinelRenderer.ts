import {
  ARENA_CENTER_X,
  ARENA_CENTER_Y,
  ARENA_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getArchetypeColor,
  type EnemyEntity,
  type GameSimulationState,
} from '../engine/gameRules';
import type { ParticlePool } from '../engine/particlePool';

export interface CameraTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

export function computeCameraTransform(
  viewportWidth: number,
  viewportHeight: number,
): CameraTransform {
  const scale = Math.min(viewportWidth / WORLD_WIDTH, viewportHeight / WORLD_HEIGHT);
  const offsetX = (viewportWidth - WORLD_WIDTH * scale) / 2;
  const offsetY = (viewportHeight - WORLD_HEIGHT * scale) / 2;
  return { scale, offsetX, offsetY };
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  rotation: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * Math.PI * 2) / sides;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: EnemyEntity,
  elapsed: number,
): void {
  const baseColor = getArchetypeColor(e.archetype);
  const fillColor = e.hitFlashTimer > 0 ? '#FFFFFF' : baseColor;

  // Telegraph rendering BEFORE enemy body so sightlines sit cleanly beneath
  if (e.aiState === 'windup' && e.windupDuration > 0) {
    const progress = 1 - Math.max(0, e.stateTimer / e.windupDuration);
    if (e.archetype === 'sniper') {
      // Glowing amber laser sightline telegraph
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      const rayX = e.x + Math.cos(e.angle) * 560;
      const rayY = e.y + Math.sin(e.angle) * 560;
      ctx.lineTo(rayX, rayY);
      ctx.strokeStyle =
        progress > 0.72
          ? `rgba(254, 243, 199, ${0.55 + progress * 0.45})`
          : `rgba(245, 158, 11, ${0.28 + progress * 0.5})`;
      ctx.lineWidth = 1.5 + progress * 2.5;
      ctx.setLineDash(progress > 0.7 ? [] : [8, 6]);
      ctx.stroke();
      ctx.restore();
    } else if (e.archetype === 'charger') {
      // Pulsing lock-on telegraph ring + lunge corridor preview
      ctx.save();
      const ringR = e.radius + 10 + (1 - progress) * 24;
      ctx.beginPath();
      ctx.arc(e.x, e.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(244, 63, 94, ${0.35 + progress * 0.65})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.angle) * 190, e.y + Math.sin(e.angle) * 190);
      ctx.strokeStyle = `rgba(129, 140, 248, ${0.25 + progress * 0.45})`;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);

  if (e.archetype === 'swarmer') {
    // Sleek rose twin-fin dart
    ctx.beginPath();
    ctx.moveTo(e.radius + 3, 0);
    ctx.lineTo(-e.radius * 0.85, -e.radius * 0.78);
    ctx.lineTo(-e.radius * 0.35, 0);
    ctx.lineTo(-e.radius * 0.85, e.radius * 0.78);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else if (e.archetype === 'sniper') {
    // Sharp amber prism with inner emitter core
    const pulse = e.aiState === 'windup' ? 1.12 + Math.sin(elapsed * 32) * 0.08 : 1;
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.moveTo(e.radius + 4, 0);
    ctx.lineTo(0, -e.radius * 0.9);
    ctx.lineTo(-e.radius, 0);
    ctx.lineTo(0, e.radius * 0.9);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(2, 0, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = e.aiState === 'windup' ? '#FFFFFF' : '#0B101B';
    ctx.fill();
  } else {
    // Heavy armored hexagonal charger with crouch squash during windup
    const crouch = e.aiState === 'windup' ? 0.84 : e.aiState === 'lunge' ? 1.24 : 1;
    ctx.scale(crouch, 2 - crouch);
    drawPolygon(ctx, 0, 0, e.radius, 6, 0);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = '#E0E7FF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Forward ramming chevron
    ctx.beginPath();
    ctx.moveTo(e.radius * 0.9, 0);
    ctx.lineTo(e.radius * 0.15, -8);
    ctx.lineTo(e.radius * 0.15, 8);
    ctx.closePath();
    ctx.fillStyle = '#0B101B';
    ctx.fill();
  }
  ctx.restore();

  // Compact HP pip bar for multi-HP elites once damaged
  if (e.maxHp > 1 && e.hp < e.maxHp) {
    const barW = e.radius * 1.9;
    const barH = 3.5;
    const bx = e.x - barW / 2;
    const by = e.y - e.radius - 11;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = baseColor;
    ctx.fillRect(bx, by, barW * Math.max(0, e.hp / e.maxHp), barH);
  }
}

export function renderVaultSentinelFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: GameSimulationState,
  particles: ParticlePool,
  aimWorldX: number,
  aimWorldY: number,
): void {
  // Deep obsidian backdrop
  ctx.fillStyle = '#060911';
  ctx.fillRect(0, 0, width, height);

  const cam = computeCameraTransform(width, height);
  const shakeMag = state.trauma * state.trauma * 15;
  const shakeX = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;
  const shakeY = shakeMag > 0.1 ? (Math.random() * 2 - 1) * shakeMag : 0;

  ctx.save();
  ctx.translate(cam.offsetX + shakeX * cam.scale, cam.offsetY + shakeY * cam.scale);
  ctx.scale(cam.scale, cam.scale);

  // Subtle ambient radial vault chamber glow
  const radialGrad = ctx.createRadialGradient(
    ARENA_CENTER_X,
    ARENA_CENTER_Y,
    24,
    ARENA_CENTER_X,
    ARENA_CENTER_Y,
    ARENA_RADIUS + 80,
  );
  radialGrad.addColorStop(0, 'rgba(99, 102, 241, 0.14)');
  radialGrad.addColorStop(0.62, 'rgba(15, 23, 42, 0.35)');
  radialGrad.addColorStop(1, 'rgba(6, 9, 17, 0)');
  ctx.fillStyle = radialGrad;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Concentric security grid rings inside arena
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
  ctx.lineWidth = 1;
  for (const r of [110, 220]) {
    ctx.beginPath();
    ctx.arc(ARENA_CENTER_X, ARENA_CENTER_Y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Subtle cross-axis hairlines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.beginPath();
  ctx.moveTo(ARENA_CENTER_X - ARENA_RADIUS, ARENA_CENTER_Y);
  ctx.lineTo(ARENA_CENTER_X + ARENA_RADIUS, ARENA_CENTER_Y);
  ctx.moveTo(ARENA_CENTER_X, ARENA_CENTER_Y - ARENA_RADIUS);
  ctx.lineTo(ARENA_CENTER_X, ARENA_CENTER_Y + ARENA_RADIUS);
  ctx.stroke();

  // Center Vault Core watermark emblem
  ctx.save();
  ctx.translate(ARENA_CENTER_X, ARENA_CENTER_Y);
  ctx.rotate(state.elapsed * 0.18);
  drawPolygon(ctx, 0, 0, 34, 6, 0);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Arena outer shield perimeter + rotating orbital ticks
  ctx.beginPath();
  ctx.arc(ARENA_CENTER_X, ARENA_CENTER_Y, ARENA_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle =
    state.player.hitFlashTimer > 0
      ? 'rgba(244, 63, 94, 0.85)'
      : 'rgba(99, 102, 241, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.save();
  ctx.translate(ARENA_CENTER_X, ARENA_CENTER_Y);
  ctx.rotate(state.elapsed * 0.08);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI * 2) / 24;
    const inner = ARENA_RADIUS + 5;
    const outer = i % 3 === 0 ? ARENA_RADIUS + 15 : ARENA_RADIUS + 10;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    ctx.stroke();
  }
  ctx.restore();

  // Render pooled particles (rings, afterimages, sparks, shards)
  for (let i = 0; i < particles.slots.length; i++) {
    const s = particles.slots[i];
    if (!s.active) continue;
    const alpha = Math.max(0, Math.min(1, s.life / s.maxLife));
    ctx.save();
    ctx.globalAlpha = alpha;
    if (s.kind === 'ring') {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.5 * alpha + 0.8;
      ctx.stroke();
    } else if (s.kind === 'afterimage') {
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.lineTo(-12, -11);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-12, 11);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
    } else if (s.kind === 'shard') {
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = s.color;
      ctx.fillRect(-s.radius, -s.radius * 0.45, s.radius * 2, s.radius * 0.9);
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius * (0.4 + alpha * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.fill();
    }
    ctx.restore();
  }

  // Render Enemies
  for (let i = 0; i < state.enemies.length; i++) {
    drawEnemy(ctx, state.enemies[i], state.elapsed);
  }

  // Render Projectiles with crisp luminous tails
  for (let i = 0; i < state.projectiles.length; i++) {
    const proj = state.projectiles[i];
    const pAngle = Math.atan2(proj.vy, proj.vx);
    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(pAngle);
    ctx.beginPath();
    ctx.moveTo(proj.radius * 1.9, 0);
    ctx.lineTo(-proj.radius * 2.1, -proj.radius * 0.72);
    ctx.lineTo(-proj.radius * 2.1, proj.radius * 0.72);
    ctx.closePath();
    ctx.fillStyle = proj.color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(2, 0, proj.radius * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  // Render Player Sentinel Craft (hidden once shattered into Game Over)
  const p = state.player;
  if (state.phase !== 'gameover') {
    const invulnBlink =
      p.invulnTimer > 0 && Math.floor(state.elapsed * 20) % 2 === 0;
    const koAlpha =
      state.phase === 'ko' ? Math.max(0, state.koTimer / 0.35) : 1;

    if (!invulnBlink) {
      ctx.save();
      ctx.globalAlpha = koAlpha;
      ctx.translate(p.x, p.y);

      // Subtle dash-ready / cooldown ring beneath craft
      if (state.phase === 'playing' && p.dashCooldown > 0) {
        const readyPct = 1 - Math.min(1, p.dashCooldown / 0.95);
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * readyPct);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.rotate(p.aimAngle);
      ctx.scale(p.squashX, p.squashY);

      // Thruster glow behind ship
      ctx.beginPath();
      ctx.arc(-11, 0, p.dashTimer > 0 ? 10 : 6, 0, Math.PI * 2);
      ctx.fillStyle =
        p.dashTimer > 0 ? 'rgba(56, 189, 248, 0.75)' : 'rgba(99, 102, 241, 0.48)';
      ctx.fill();

      // Main Sentinel chevron hull
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-13, -13);
      ctx.lineTo(-7, 0);
      ctx.lineTo(-13, 13);
      ctx.closePath();
      ctx.fillStyle = p.hitFlashTimer > 0 ? '#FFFFFF' : '#E2E8F0';
      ctx.fill();
      ctx.strokeStyle = p.dashTimer > 0 ? '#38BDF8' : '#6366F1';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Luminous cockpit core
      ctx.beginPath();
      ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#38BDF8';
      ctx.fill();
      ctx.restore();
    }
  }

  // Crisp aim reticle during live play
  if (state.phase === 'playing') {
    ctx.save();
    ctx.translate(aimWorldX, aimWorldY);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-6, 0);
    ctx.moveTo(6, 0);
    ctx.lineTo(14, 0);
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -6);
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 14);
    ctx.stroke();
    ctx.restore();
  }

  // Brief non-obstructive Wave callout pulse inside canvas
  if (state.phase === 'playing' && state.waveBannerTimer > 0) {
    const a = Math.min(1, state.waveBannerTimer / 0.4);
    ctx.save();
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = '#E0E7FF';
    ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${state.wave}`, ARENA_CENTER_X, ARENA_CENTER_Y - 120);
    ctx.restore();
  }

  ctx.restore();
}
