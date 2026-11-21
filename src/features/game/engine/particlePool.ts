export type ParticleKind = 'spark' | 'ring' | 'afterimage' | 'shard';

export interface ParticleSlot {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxRadius: number;
  angle: number;
  spin: number;
  life: number;
  maxLife: number;
  color: string;
}

const POOL_CAPACITY = 260;

/**
 * Fixed-capacity pre-allocated ring buffer particle pool.
 * Eliminates per-frame GC allocations during intense combat bursts.
 */
export class ParticlePool {
  readonly slots: ParticleSlot[];
  private cursor = 0;

  constructor() {
    this.slots = new Array<ParticleSlot>(POOL_CAPACITY);
    for (let i = 0; i < POOL_CAPACITY; i++) {
      this.slots[i] = {
        active: false,
        kind: 'spark',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 2,
        maxRadius: 2,
        angle: 0,
        spin: 0,
        life: 0,
        maxLife: 1,
        color: '#FFFFFF',
      };
    }
  }

  clear(): void {
    for (let i = 0; i < POOL_CAPACITY; i++) {
      this.slots[i].active = false;
    }
    this.cursor = 0;
  }

  private acquire(): ParticleSlot {
    const slot = this.slots[this.cursor];
    this.cursor = (this.cursor + 1) % POOL_CAPACITY;
    return slot;
  }

  spawnBurst(x: number, y: number, color: string, count: number, speed = 180): void {
    for (let i = 0; i < count; i++) {
      const slot = this.acquire();
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const mag = speed * (0.45 + Math.random() * 0.8);
      slot.active = true;
      slot.kind = i % 3 === 0 ? 'shard' : 'spark';
      slot.x = x;
      slot.y = y;
      slot.vx = Math.cos(angle) * mag;
      slot.vy = Math.sin(angle) * mag;
      slot.radius = 2.2 + Math.random() * 2.8;
      slot.maxRadius = slot.radius;
      slot.angle = angle;
      slot.spin = (Math.random() - 0.5) * 10;
      slot.maxLife = 0.24 + Math.random() * 0.28;
      slot.life = slot.maxLife;
      slot.color = color;
    }
  }

  spawnRing(x: number, y: number, color: string, maxRadius: number, duration = 0.34): void {
    const slot = this.acquire();
    slot.active = true;
    slot.kind = 'ring';
    slot.x = x;
    slot.y = y;
    slot.vx = 0;
    slot.vy = 0;
    slot.radius = 8;
    slot.maxRadius = maxRadius;
    slot.angle = 0;
    slot.spin = 0;
    slot.maxLife = duration;
    slot.life = duration;
    slot.color = color;
  }

  spawnAfterimage(x: number, y: number, angle: number, color = '#38BDF8'): void {
    const slot = this.acquire();
    slot.active = true;
    slot.kind = 'afterimage';
    slot.x = x;
    slot.y = y;
    slot.vx = 0;
    slot.vy = 0;
    slot.radius = 15;
    slot.maxRadius = 15;
    slot.angle = angle;
    slot.spin = 0;
    slot.maxLife = 0.22;
    slot.life = 0.22;
    slot.color = color;
  }

  update(dt: number): void {
    const drag = Math.pow(0.08, dt);
    for (let i = 0; i < POOL_CAPACITY; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        continue;
      }
      if (s.kind === 'ring') {
        const progress = 1 - s.life / s.maxLife;
        s.radius = 8 + (s.maxRadius - 8) * (1 - Math.pow(1 - progress, 2));
      } else if (s.kind !== 'afterimage') {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= drag;
        s.vy *= drag;
        s.angle += s.spin * dt;
      }
    }
  }
}
