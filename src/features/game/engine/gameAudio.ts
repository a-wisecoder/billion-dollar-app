/**
 * Procedural Web Audio synthesizer for Vault Sentinel.
 * Zero external audio dependencies; unlocks cleanly on first user gesture.
 */
export class GameAudioSynth {
  private ctx: AudioContext | null = null;
  private muted = false;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(next: boolean): void {
    this.muted = next;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private jitter(baseFreq: number): number {
    return baseFreq * (0.92 + Math.random() * 0.16);
  }

  private playTone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    gainPeak: number,
  ): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(30, startFreq), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playShoot(): void {
    this.playTone('triangle', this.jitter(760), 210, 0.08, 0.08);
  }

  playDash(): void {
    this.playTone('sine', this.jitter(310), 680, 0.13, 0.11);
  }

  playEnemyHit(): void {
    this.playTone('square', this.jitter(420), 240, 0.055, 0.06);
  }

  playEnemyKill(heavy: boolean): void {
    if (heavy) {
      this.playTone('sawtooth', this.jitter(220), 58, 0.24, 0.14);
      this.playTone('triangle', this.jitter(520), 140, 0.18, 0.09);
    } else {
      this.playTone('triangle', this.jitter(480), 140, 0.12, 0.1);
    }
  }

  playTelegraph(kind: 'sniper' | 'charger'): void {
    if (kind === 'sniper') {
      this.playTone('sine', 420, 960, 0.28, 0.075);
    } else {
      this.playTone('sawtooth', 110, 260, 0.3, 0.085);
    }
  }

  playPlayerHit(): void {
    this.playTone('sawtooth', 175, 48, 0.28, 0.17);
  }

  playWaveClear(): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      window.setTimeout(() => {
        this.playTone('triangle', freq, freq * 1.02, 0.14, 0.08);
      }, idx * 70);
    });
  }

  playGameOver(): void {
    this.playTone('sawtooth', 260, 62, 0.45, 0.15);
  }
}
