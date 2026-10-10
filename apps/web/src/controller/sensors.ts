import { currentScreenAngle } from '@joyconhub/input';

export interface OrientationReading {
  beta: number;
  gamma: number;
  screenAngle: number;
  t: number;
}

export interface RotationReading {
  alpha: number;
  beta: number;
  gamma: number;
  t: number;
}

export type StartResult = 'ok' | 'denied' | 'unsupported' | 'insecure';

export interface SensorSource {
  readonly kind: 'device' | 'touch';
  start(): Promise<StartResult>;
  /** resolves true once real data arrived, false after `timeoutMs` without any */
  waitForData(timeoutMs: number): Promise<boolean>;
  stop(): void;
  onOrientation: ((r: OrientationReading) => void) | null;
  onRotation: ((r: RotationReading) => void) | null;
}

type PermissionFn = () => Promise<'granted' | 'denied' | 'default'>;

/**
 * Real phone sensors. iOS 13+ requires `requestPermission()` to be called from inside a tap,
 * so `start()` must be invoked directly from a click/touch handler.
 */
export class DeviceSensors implements SensorSource {
  readonly kind = 'device' as const;
  onOrientation: ((r: OrientationReading) => void) | null = null;
  onRotation: ((r: RotationReading) => void) | null = null;
  private gotData = false;
  private dataWaiters: (() => void)[] = [];

  async start(): Promise<StartResult> {
    if (!window.isSecureContext) return 'insecure';
    if (typeof DeviceOrientationEvent === 'undefined') return 'unsupported';
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn };
    const DME = (typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : {}) as {
      requestPermission?: PermissionFn;
    };
    if (typeof DOE.requestPermission === 'function') {
      // Both requests start synchronously inside the user gesture.
      // Motion (gyro) permission is optional: orientation alone is enough to play.
      const [o] = await Promise.all([
        DOE.requestPermission().catch(() => 'denied' as const),
        typeof DME.requestPermission === 'function'
          ? DME.requestPermission().catch(() => 'denied' as const)
          : Promise.resolve('granted' as const),
      ]);
      if (o !== 'granted') return 'denied';
    }
    window.addEventListener('deviceorientation', this.onOrient);
    window.addEventListener('devicemotion', this.onMotion);
    return 'ok';
  }

  waitForData(timeoutMs: number): Promise<boolean> {
    if (this.gotData) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(this.gotData), timeoutMs);
      this.dataWaiters.push(() => {
        window.clearTimeout(timer);
        resolve(true);
      });
    });
  }

  stop(): void {
    window.removeEventListener('deviceorientation', this.onOrient);
    window.removeEventListener('devicemotion', this.onMotion);
  }

  private onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    if (!this.gotData) {
      this.gotData = true;
      this.dataWaiters.splice(0).forEach((f) => f());
    }
    this.onOrientation?.({
      beta: e.beta,
      gamma: e.gamma,
      screenAngle: currentScreenAngle(),
      t: performance.now(),
    });
  };

  private onMotion = (e: DeviceMotionEvent) => {
    const r = e.rotationRate;
    if (!r || r.alpha == null || r.beta == null || r.gamma == null) return;
    this.onRotation?.({ alpha: r.alpha, beta: r.beta, gamma: r.gamma, t: performance.now() });
  };
}

/**
 * Fallback for devices without motion sensors (and desktop testing via ?sim=1): a touch pad that
 * produces the same orientation readings a phone tilted that way would.
 */
export class TouchTiltSensors implements SensorSource {
  readonly kind = 'touch' as const;
  onOrientation: ((r: OrientationReading) => void) | null = null;
  onRotation: ((r: RotationReading) => void) | null = null;
  private timer = 0;
  private x = 0;
  private y = 0;
  private readonly maxDeg = 45;
  /** Neutral pose: phone held upright-ish at 45° in portrait. */
  private readonly baseBeta = 45;

  async start(): Promise<StartResult> {
    this.timer = window.setInterval(() => this.emit(), 1000 / 60);
    return 'ok';
  }

  waitForData(): Promise<boolean> {
    return Promise.resolve(true);
  }

  stop(): void {
    window.clearInterval(this.timer);
  }

  /** @param x -1..1 (bank right) @param y -1..1 (nose up) */
  set(x: number, y: number): void {
    this.x = Math.max(-1, Math.min(1, x));
    this.y = Math.max(-1, Math.min(1, y));
  }

  private emit(): void {
    // Portrait (screen angle 0): gamma ≈ bank, beta change ≈ recline change (nose up = lean back less).
    this.onOrientation?.({
      beta: this.baseBeta + this.y * this.maxDeg * 0.9,
      gamma: this.x * this.maxDeg,
      screenAngle: 0,
      t: performance.now(),
    });
  }
}
