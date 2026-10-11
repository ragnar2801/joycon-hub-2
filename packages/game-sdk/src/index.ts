/**
 * The contract between the hub and a mini game. The hub owns pairing, the phone connection, pausing
 * and menus; a game only reads `ctx.input()` every frame and reports events with `ctx.emit()`.
 */
import type { ControllerLayout, GameEventKind } from '@joyconhub/protocol';

export interface ControllerInput {
  /** -1 bank left .. 1 bank right */
  roll: number;
  /** -1 nose down .. 1 nose up */
  pitch: number;
  /** -1 .. 1 twist (gyro yaw rate) */
  yawRate: number;
  /** 0 .. 1 */
  throttle: number;
  buttons: Record<string, boolean>;
  connected: boolean;
}

export const NEUTRAL_INPUT: ControllerInput = {
  roll: 0,
  pitch: 0,
  yawRate: 0,
  throttle: 0.6,
  buttons: {},
  connected: false,
};

export interface GameEvent {
  kind: GameEventKind;
  score?: number;
  /** personal best, sent with `gameover` */
  best?: number;
  message?: string;
  /** vibration pattern for the phone, in ms */
  vibrate?: number[];
}

export interface GameContext {
  /** Latest controller state; read it every frame, never cache it. */
  input(): ControllerInput;
  emit(event: GameEvent): void;
  /** Debug overlays requested (?debug=1). */
  debug: boolean;
  /** Optional host actions for in-game buttons; keep session and controller state in sync. */
  restart?(): void;
  pause?(): void;
}

export interface MiniGame {
  mount(container: HTMLElement, ctx: GameContext): void;
  /** Advance and render one frame. `dt` is in seconds and already clamped by the hub. */
  update(dt: number): void;
  /** Start a fresh round. */
  restart(): void;
  pause(): void;
  resume(): void;
  unmount(): void;
}

export interface GameModule {
  createGame(): MiniGame;
}

export interface GameDefinition {
  id: string;
  title: string;
  tagline: string;
  description: string;
  /** CSS colour used for the card accent */
  accent: string;
  /** emoji or short glyph shown on the card */
  icon: string;
  controllerLayout: ControllerLayout;
  /** false = "coming soon" card */
  available: boolean;
  load?: () => Promise<GameModule>;
}
