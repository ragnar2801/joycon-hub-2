import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { WebSocket } from 'ws';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type Role } from '@joyconhub/protocol';

export interface Room {
  code: string;
  gameId: string;
  hostToken: string;
  controllerToken: string;
  host: WebSocket | null;
  controller: WebSocket | null;
  createdAt: number;
  /** last time either side connected or disconnected */
  lastSeen: number;
}

export interface RoomTimeouts {
  /** delete a room whose sockets are all gone after this long */
  emptyMs: number;
  /** delete a room that never got a controller after this long, even if the host is waiting */
  unclaimedMs: number;
}

export const DEFAULT_TIMEOUTS: RoomTimeouts = {
  emptyMs: 2 * 60_000,
  unclaimedMs: 30 * 60_000,
};

function token(): string {
  return randomBytes(18).toString('base64url');
}

export function tokensEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export class RoomRegistry {
  private rooms = new Map<string, Room>();
  private everClaimed = new WeakSet<Room>();

  constructor(
    private readonly timeouts: RoomTimeouts = DEFAULT_TIMEOUTS,
    private readonly now: () => number = Date.now,
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  create(gameId: string): Room {
    let code: string;
    do {
      code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++)
        code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    } while (this.rooms.has(code));
    const t = this.now();
    const room: Room = {
      code,
      gameId,
      hostToken: token(),
      controllerToken: token(),
      host: null,
      controller: null,
      createdAt: t,
      lastSeen: t,
    };
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  authorize(room: Room, role: Role, tok: string): boolean {
    return tokensEqual(role === 'host' ? room.hostToken : room.controllerToken, tok);
  }

  /** Attach a socket, returning the socket it replaced (if any). */
  attach(room: Room, role: Role, ws: WebSocket): WebSocket | null {
    const prev = room[role];
    room[role] = ws;
    room.lastSeen = this.now();
    if (role === 'controller') this.everClaimed.add(room);
    return prev;
  }

  /** Detach a socket if it is still the active one for its role. Returns true if it was. */
  detach(room: Room, role: Role, ws: WebSocket): boolean {
    if (room[role] !== ws) return false;
    room[role] = null;
    room.lastSeen = this.now();
    return true;
  }

  peerOf(room: Room, role: Role): WebSocket | null {
    return role === 'host' ? room.controller : room.host;
  }

  /** Remove expired rooms; returns the removed codes. */
  sweep(): string[] {
    const t = this.now();
    const removed: string[] = [];
    for (const [code, room] of this.rooms) {
      const empty = !room.host && !room.controller;
      const expiredEmpty = empty && t - room.lastSeen > this.timeouts.emptyMs;
      const unclaimed =
        !this.everClaimed.has(room) && t - room.createdAt > this.timeouts.unclaimedMs;
      if (expiredEmpty || unclaimed) {
        room.host?.close();
        room.controller?.close();
        this.rooms.delete(code);
        removed.push(code);
      }
    }
    return removed;
  }
}
