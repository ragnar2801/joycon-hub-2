import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { CloseCode, type CreateRoomResponse } from '@joyconhub/protocol';
import { buildApp, type App } from '../src/app.ts';
import { RoomRegistry } from '../src/rooms.ts';

let app: App;
let base: string;

beforeEach(async () => {
  app = await buildApp();
  await app.fastify.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.fastify.server.address();
  if (!addr || typeof addr === 'string') throw new Error('no address');
  base = `127.0.0.1:${addr.port}`;
});

afterEach(async () => {
  await app.fastify.close();
});

async function createRoom(): Promise<CreateRoomResponse> {
  const res = await fetch(`http://${base}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ gameId: 'sky-tilt' }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as CreateRoomResponse;
}

interface Client {
  ws: WebSocket;
  messages: unknown[];
  next(pred?: (m: Record<string, unknown>) => boolean): Promise<Record<string, unknown>>;
  closed: Promise<number>;
}

function connect(role: string, room: string, token: string): Promise<Client> {
  const ws = new WebSocket(
    `ws://${base}/ws?role=${role}&room=${room}&token=${encodeURIComponent(token)}`,
  );
  const messages: Record<string, unknown>[] = [];
  const waiters: {
    pred: (m: Record<string, unknown>) => boolean;
    resolve: (m: Record<string, unknown>) => void;
  }[] = [];
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString()) as Record<string, unknown>;
    const i = waiters.findIndex((w) => w.pred(m));
    if (i >= 0) waiters.splice(i, 1)[0]!.resolve(m);
    else messages.push(m);
  });
  const closed = new Promise<number>((r) => ws.on('close', (code) => r(code)));
  const client: Client = {
    ws,
    messages,
    closed,
    next(pred = () => true) {
      const i = messages.findIndex(pred);
      if (i >= 0) return Promise.resolve(messages.splice(i, 1)[0]!);
      return new Promise((resolve) => waiters.push({ pred, resolve }));
    },
  };
  return new Promise((resolve) => {
    ws.on('open', () => resolve(client));
    ws.on('close', () => resolve(client));
  });
}

describe('relay server', () => {
  it('reports health and config', async () => {
    const res = await fetch(`http://${base}/api/config`);
    const json = (await res.json()) as { lanAddresses: unknown[] };
    expect(Array.isArray(json.lanAddresses)).toBe(true);
  });

  it('rejects bad room creation requests', async () => {
    const res = await fetch(`http://${base}/api/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('pairs host and controller and relays messages both ways', async () => {
    const room = await createRoom();
    expect(room.roomCode).toMatch(/^[A-Z2-9]{4}$/);

    const host = await connect('host', room.roomCode, room.hostToken);
    expect(await host.next()).toMatchObject({
      type: 'welcome',
      role: 'host',
      peerConnected: false,
    });

    const ctrl = await connect('controller', room.roomCode.toLowerCase(), room.controllerToken);
    expect(await ctrl.next()).toMatchObject({
      type: 'welcome',
      role: 'controller',
      peerConnected: true,
    });
    expect(await host.next()).toEqual({ type: 'peer', connected: true });

    ctrl.ws.send(JSON.stringify({ type: 'input', s: 1, r: 0.5, p: 0, y: 0, th: 0.5, b: 0 }));
    expect(await host.next()).toMatchObject({ type: 'input', r: 0.5 });

    host.ws.send(JSON.stringify({ type: 'game_event', kind: 'crash', vibrate: [100] }));
    expect(await ctrl.next()).toMatchObject({ type: 'game_event', kind: 'crash' });

    // Invalid and cross-role messages are dropped, not relayed.
    ctrl.ws.send(JSON.stringify({ type: 'host_state', state: 'playing' }));
    ctrl.ws.send('not json');
    ctrl.ws.send(JSON.stringify({ type: 'input', s: 2, r: 9, p: 0, y: 0, th: 0, b: 0 }));
    ctrl.ws.send(JSON.stringify({ type: 'calibrated' }));
    expect(await host.next()).toEqual({ type: 'calibrated' });

    ctrl.ws.close();
    expect(await host.next()).toEqual({ type: 'peer', connected: false });
    host.ws.close();
  });

  it('answers pings', async () => {
    const room = await createRoom();
    const host = await connect('host', room.roomCode, room.hostToken);
    await host.next();
    host.ws.send(JSON.stringify({ type: 'ping', id: 7, t: 42 }));
    expect(await host.next((m) => m.type === 'pong')).toEqual({ type: 'pong', id: 7, t: 42 });
    host.ws.close();
  });

  it('rejects unknown rooms and wrong tokens', async () => {
    const room = await createRoom();
    const unknown = await connect('controller', 'ZZZZ', room.controllerToken);
    expect(await unknown.closed).toBe(CloseCode.RoomNotFound);
    const wrong = await connect('controller', room.roomCode, room.hostToken);
    expect(await wrong.closed).toBe(CloseCode.BadToken);
    const badRole = await connect('admin', room.roomCode, room.hostToken);
    expect(await badRole.closed).toBe(CloseCode.BadRequest);
  });

  it('a reconnecting controller replaces the old socket', async () => {
    const room = await createRoom();
    const host = await connect('host', room.roomCode, room.hostToken);
    await host.next();
    const first = await connect('controller', room.roomCode, room.controllerToken);
    await first.next();
    const second = await connect('controller', room.roomCode, room.controllerToken);
    await second.next();
    expect(await first.closed).toBe(CloseCode.Replaced);
    // The host must not be told the controller left when the *old* socket closes.
    second.ws.send(JSON.stringify({ type: 'calibrated' }));
    await host.next((m) => m.type === 'calibrated');
    await new Promise((r) => setTimeout(r, 50));
    expect(host.messages.some((m) => (m as { connected?: boolean }).connected === false)).toBe(
      false,
    );
    second.ws.close();
    host.ws.close();
  });
});

describe('RoomRegistry expiry', () => {
  it('removes rooms that stay empty, keeps active ones', () => {
    let now = 0;
    const reg = new RoomRegistry({ emptyMs: 1000, unclaimedMs: 10_000 }, () => now);
    const a = reg.create('g');
    const b = reg.create('g');
    reg.attach(b, 'host', { close() {} } as never);
    now = 2000;
    expect(reg.sweep()).toEqual([a.code]);
    expect(reg.get(b.code)).toBeDefined();
    now = 20_000;
    expect(reg.sweep()).toEqual([b.code]); // never claimed by a controller
  });
});
