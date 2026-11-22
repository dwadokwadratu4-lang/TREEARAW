import { TreeHealthState } from '../types/telemetry';

class ForestAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windLfo: OscillatorNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private enabled = false;
  private beetleActive = false;
  private treeState: TreeHealthState = 'DOBRY';
  private gnawTimer: number | null = null;
  private alarmTimer: number | null = null;

  public isEnabled(): boolean {
    return this.enabled;
  }

  private ensureContext(): void {
    if (this.ctx) return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.0;
    masterGain.connect(ctx.destination);

    // Generowany proceduralnie szum różowy/brązowy na wiatr i las
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.03 * white) / 1.03;
      data[i] = lastOut * 3.2;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 0.85;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.22;

    // Powolny LFO modulujący podmuchy wiatru w koronach świerków
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.14;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    windLfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);

    noiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);

    noiseSource.start();
    windLfo.start();

    this.ctx = ctx;
    this.masterGain = masterGain;
    this.windGain = windGain;
    this.windFilter = windFilter;
    this.windLfo = windLfo;
    this.noiseBuffer = buffer;
  }

  public async setEnabled(next: boolean): Promise<boolean> {
    if (next) {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.enabled = true;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.65, this.ctx.currentTime, 0.25);
      }
      this.syncLoops();
    } else {
      this.enabled = false;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.15);
      }
      this.stopAlertLoops();
    }
    return this.enabled;
  }

  public updateEnvironment(beetleInfestation: boolean, treeState: TreeHealthState): void {
    const changed =
      this.beetleActive !== beetleInfestation || this.treeState !== treeState;
    this.beetleActive = beetleInfestation;
    this.treeState = treeState;

    if (this.enabled && this.windGain && this.windFilter && this.ctx) {
      const targetWind = treeState === 'FATALNY' ? 0.14 : 0.24;
      this.windGain.gain.setTargetAtTime(targetWind, this.ctx.currentTime, 0.4);
      const targetFreq = treeState === 'DOBRY' ? 360 : 270;
      this.windFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.5);
    }

    if (changed && this.enabled) {
      this.syncLoops();
    }
  }

  public playUiClick(pitchHz = 760): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitchHz, now);
    osc.frequency.exponentialRampToValueAtTime(pitchHz * 0.6, now + 0.035);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  private playBeetleGnawBurst(): void {
    if (!this.enabled || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const pulses = 2 + Math.floor(Math.random() * 4);

    for (let i = 0; i < pulses; i++) {
      const t = now + i * (0.045 + Math.random() * 0.04);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800 + Math.random() * 1600;
      filter.Q.value = 4.5;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      src.start(t, Math.random() * 2.5, 0.05);
    }
  }

  private playCriticalAlarmPulse(): void {
    if (!this.enabled || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    [0, 0.22].forEach((offset, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 880 : 660, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.17);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  private syncLoops(): void {
    this.stopAlertLoops();
    if (!this.enabled) return;

    if (this.beetleActive) {
      this.gnawTimer = window.setInterval(() => {
        if (this.enabled && this.beetleActive) {
          this.playBeetleGnawBurst();
        }
      }, 650);
    }

    if (this.treeState === 'FATALNY' || this.beetleActive) {
      this.alarmTimer = window.setInterval(() => {
        if (this.enabled && (this.treeState === 'FATALNY' || this.beetleActive)) {
          this.playCriticalAlarmPulse();
        }
      }, this.treeState === 'FATALNY' ? 3200 : 5200);
    }
  }

  private stopAlertLoops(): void {
    if (this.gnawTimer !== null) {
      clearInterval(this.gnawTimer);
      this.gnawTimer = null;
    }
    if (this.alarmTimer !== null) {
      clearInterval(this.alarmTimer);
      this.alarmTimer = null;
    }
  }

  public dispose(): void {
    this.stopAlertLoops();
    if (this.windLfo) {
      try {
        this.windLfo.stop();
      } catch {
        // ignore
      }
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export const forestAudio = new ForestAudioEngine();
