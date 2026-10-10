import { describe, expect, it } from 'vitest';
import {
  FromController,
  FromHost,
  ROOM_CODE_ALPHABET,
  controllerPath,
  isValidRoomCode,
  normalizeRoomCode,
  p2pPeerId,
} from '../src/index.ts';

describe('room codes', () => {
  it('alphabet has no ambiguous characters', () => {
    for (const ch of '01OIL') expect(ROOM_CODE_ALPHABET).not.toContain(ch);
  });
  it('validates codes', () => {
    expect(isValidRoomCode('K7QX')).toBe(true);
    expect(isValidRoomCode('K7Q')).toBe(false);
    expect(isValidRoomCode('K0QX')).toBe(false);
    expect(isValidRoomCode(normalizeRoomCode(' k7qx '))).toBe(true);
  });
  it('builds relative controller paths', () => {
    expect(controllerPath('ABCD', 'x y')).toBe('controller.html?r=ABCD&t=x+y');
    expect(controllerPath('ABCD', 'tok', 'p2p')).toBe('controller.html?r=ABCD&t=tok&m=p2p');
  });
  it('builds PeerJS-safe ids', () => {
    expect(p2pPeerId('K7QX', 'aB3dE')).toMatch(/^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*$/);
  });
});

describe('message schemas', () => {
  it('accepts a valid input frame', () => {
    const r = FromController.safeParse({
      type: 'input',
      s: 1,
      r: 0.5,
      p: -0.2,
      y: 0,
      th: 0.6,
      b: 1,
    });
    expect(r.success).toBe(true);
  });
  it('rejects out-of-range input', () => {
    expect(
      FromController.safeParse({ type: 'input', s: 1, r: 2, p: 0, y: 0, th: 0, b: 0 }).success,
    ).toBe(false);
    expect(
      FromController.safeParse({ type: 'input', s: -1, r: 0, p: 0, y: 0, th: 0, b: 0 }).success,
    ).toBe(false);
  });
  it('controllers cannot send host messages', () => {
    expect(FromController.safeParse({ type: 'host_state', state: 'playing' }).success).toBe(false);
    expect(FromHost.safeParse({ type: 'host_state', state: 'playing' }).success).toBe(true);
  });
  it('hosts cannot send input', () => {
    expect(FromHost.safeParse({ type: 'input', s: 1, r: 0, p: 0, y: 0, th: 0, b: 0 }).success).toBe(
      false,
    );
  });
  it('accepts ping from both sides', () => {
    const ping = { type: 'ping', id: 3, t: 123.4 };
    expect(FromHost.safeParse(ping).success).toBe(true);
    expect(FromController.safeParse(ping).success).toBe(true);
  });
});
