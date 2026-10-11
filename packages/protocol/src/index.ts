/**
 * Wire protocol shared by the relay server, the hub (host) and the phone (controller).
 *
 * The phone and the hub never talk directly: both connect to the relay with a WebSocket and the
 * server forwards validated messages to the other side of the room.
 */
import { z } from 'zod';

export const WS_PATH = '/ws';

/** Unambiguous alphabet: no 0/O, 1/I/L. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 4;
export const MAX_MESSAGE_BYTES = 1024;
export const INPUT_RATE_HZ = 60;
export const INPUT_HEARTBEAT_MS = 100;

export const Role = z.enum(['host', 'controller']);
export type Role = z.infer<typeof Role>;

/** WebSocket close codes used by the relay. Clients must not auto-reconnect on these. */
export const CloseCode = {
  RoomNotFound: 4001,
  BadToken: 4002,
  Replaced: 4003,
  BadRequest: 4004,
  RateLimited: 4005,
} as const;
export const FATAL_CLOSE_CODES: readonly number[] = [
  CloseCode.RoomNotFound,
  CloseCode.BadToken,
  CloseCode.Replaced,
  CloseCode.BadRequest,
];

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Controller -> host
// ---------------------------------------------------------------------------------------------

const unit = z.number().min(-1).max(1);

/** Hot path: processed stick values, kept short on purpose. */
export const InputMessage = z.object({
  type: z.literal('input'),
  /** sequence number, monotonically increasing per controller page load */
  s: z.number().int().nonnegative(),
  /** roll: -1 bank left .. 1 bank right */
  r: unit,
  /** pitch: -1 nose down .. 1 nose up */
  p: unit,
  /** yaw rate from the gyro: -1 left .. 1 right */
  y: unit,
  /** throttle 0..1 */
  th: z.number().min(0).max(1),
  /** pressed buttons as a bitmask, bit i = layout.buttons[i] */
  b: z.number().int().min(0).max(0xffff),
});
export type InputMessage = z.infer<typeof InputMessage>;

export const CalibratedMessage = z.object({ type: z.literal('calibrated') });

export const CommandName = z.enum(['pause', 'resume', 'restart', 'quit']);
export type CommandName = z.infer<typeof CommandName>;
export const CommandMessage = z.object({ type: z.literal('command'), name: CommandName });

/** Sent when the controller page is hidden/visible (phone locked, app switched...). */
export const ControllerStatusMessage = z.object({
  type: z.literal('controller_status'),
  away: z.boolean(),
});

export const ControllerToHost = z.discriminatedUnion('type', [
  InputMessage,
  CalibratedMessage,
  CommandMessage,
  ControllerStatusMessage,
]);
export type ControllerToHost = z.infer<typeof ControllerToHost>;

// ---------------------------------------------------------------------------------------------
// Host -> controller
// ---------------------------------------------------------------------------------------------

export const ButtonSpec = z.object({
  id: z.string().min(1).max(24),
  label: z.string().min(1).max(24),
});
export type ButtonSpec = z.infer<typeof ButtonSpec>;

export const ControllerLayout = z.object({
  buttons: z.array(ButtonSpec).max(4),
  showThrottle: z.boolean(),
  theme: z.enum(['light', 'dark']).optional(),
  indicator: z.enum(['horizon', 'wheel']).optional(),
  /** Time-trial scores are milliseconds, and a lower best is better. */
  scoreFormat: z.enum(['points', 'time']).optional(),
});
export type ControllerLayout = z.infer<typeof ControllerLayout>;

export const LayoutMessage = z.object({
  type: z.literal('layout'),
  gameTitle: z.string().max(60),
  layout: ControllerLayout,
});

export const HostState = z.enum(['pairing', 'countdown', 'playing', 'paused', 'gameover']);
export type HostState = z.infer<typeof HostState>;

export const HostStateMessage = z.object({
  type: z.literal('host_state'),
  state: HostState,
  score: z.number().optional(),
  best: z.number().optional(),
});

export const GameEventKind = z.enum(['start', 'score', 'hit', 'crash', 'gameover']);
export type GameEventKind = z.infer<typeof GameEventKind>;

export const GameEventMessage = z.object({
  type: z.literal('game_event'),
  kind: GameEventKind,
  score: z.number().optional(),
  message: z.string().max(80).optional(),
  /** navigator.vibrate pattern in ms */
  vibrate: z.array(z.number().int().min(0).max(2000)).max(10).optional(),
});
export type GameEventMessage = z.infer<typeof GameEventMessage>;

export const HostToController = z.discriminatedUnion('type', [
  LayoutMessage,
  HostStateMessage,
  GameEventMessage,
]);
export type HostToController = z.infer<typeof HostToController>;

// ---------------------------------------------------------------------------------------------
// Client <-> server
// ---------------------------------------------------------------------------------------------

export const PingMessage = z.object({
  type: z.literal('ping'),
  id: z.number().int(),
  t: z.number(),
});
export type PingMessage = z.infer<typeof PingMessage>;

/** Anything a controller may send. */
export const FromController = z.union([ControllerToHost, PingMessage]);
/** Anything a host may send. */
export const FromHost = z.union([HostToController, PingMessage]);

export type ServerMessage =
  | { type: 'welcome'; role: Role; room: string; peerConnected: boolean }
  | { type: 'peer'; connected: boolean }
  | { type: 'pong'; id: number; t: number };

/** Messages a host receives. */
export type HostInbound = ControllerToHost | ServerMessage;
/** Messages a controller receives. */
export type ControllerInbound = HostToController | ServerMessage;

// ---------------------------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------------------------

export const CreateRoomRequest = z.object({ gameId: z.string().min(1).max(40) });
export type CreateRoomRequest = z.infer<typeof CreateRoomRequest>;

export interface CreateRoomResponse {
  roomCode: string;
  hostToken: string;
  controllerToken: string;
}

export interface ConfigResponse {
  /** Explicit public URL (e.g. a tunnel) to put into QR codes, if configured. */
  publicUrl: string | null;
  /** Non-internal IPv4 addresses of the server, used for QR codes in local development. */
  lanAddresses: string[];
}

/**
 * How the phone and the hub talk:
 * - `relay`: both connect to the JoyCon Hub Node server over WebSockets (dev server, Docker).
 * - `p2p`: direct WebRTC data channel, brokered by a PeerJS signalling server. Needs no backend
 *   of our own, so the hub can be hosted as static files (GitHub Pages).
 */
export type TransportKind = 'relay' | 'p2p';

/**
 * Relative URL the QR code points to (resolved against the hub page's URL, so it also works
 * when the site lives in a sub-folder such as https://user.github.io/Joyconhub/).
 */
export function controllerPath(
  roomCode: string,
  controllerToken: string,
  transport: TransportKind = 'relay',
): string {
  const q = new URLSearchParams({ r: roomCode, t: controllerToken });
  if (transport !== 'relay') q.set('m', transport);
  return `controller.html?${q.toString()}`;
}

/** PeerJS id of a hub in p2p mode. Knowing it (from the QR code) is what lets a phone join. */
export function p2pPeerId(roomCode: string, controllerToken: string): string {
  return `joyconhub-v1-${roomCode}-${controllerToken}`;
}

/** Message the hub sends a controller it is dropping because another phone took over (p2p mode). */
export const REPLACED_NOTICE = '__replaced';

export function wsQuery(role: Role, room: string, token: string): string {
  const q = new URLSearchParams({ role, room, token });
  return `${WS_PATH}?${q.toString()}`;
}
