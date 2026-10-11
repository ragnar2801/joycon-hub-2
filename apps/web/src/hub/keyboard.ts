import type { ControllerInput } from '@joyconhub/game-sdk';

/** Developer fallback (?debug=1): arrows/WASD to fly, Shift or Space to boost, Q/E throttle. */
export class KeyboardInput {
  private keys = new Set<string>();
  private throttle = 0.6;

  constructor() {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
  }

  read(): ControllerInput {
    const k = this.keys;
    const axis = (neg: string[], pos: string[]) =>
      (pos.some((c) => k.has(c)) ? 1 : 0) - (neg.some((c) => k.has(c)) ? 1 : 0);
    if (k.has('KeyE')) this.throttle = Math.min(1, this.throttle + 0.01);
    if (k.has('KeyQ')) this.throttle = Math.max(0, this.throttle - 0.01);
    return {
      roll: axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']),
      pitch: axis(['ArrowDown', 'KeyS'], ['ArrowUp', 'KeyW']),
      yawRate: 0,
      throttle: this.throttle,
      buttons: {
        boost: k.has('ShiftLeft') || k.has('ShiftRight') || k.has('Space'),
        brake: k.has('ArrowDown') || k.has('KeyS'),
        recover: k.has('Space'),
      },
      connected: true,
    };
  }

  dispose(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear);
  }

  private down = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  };
  private up = (e: KeyboardEvent) => this.keys.delete(e.code);
  private clear = () => this.keys.clear();
}
