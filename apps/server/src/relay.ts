import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import {
  CloseCode,
  FromController,
  FromHost,
  MAX_MESSAGE_BYTES,
  Role,
  WS_PATH,
  normalizeRoomCode,
  type ServerMessage,
} from '@joyconhub/protocol';
import type { Room, RoomRegistry } from './rooms.ts';

/** Hard cap on messages per second per socket; above it messages are dropped, far above it we disconnect. */
const MSG_PER_SEC = 120;

interface Logger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
}

function send(ws: WebSocket | null, msg: ServerMessage): void {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

export function createRelay(registry: RoomRegistry, log: Logger) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const alive = new WeakMap<WebSocket, boolean>();

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, 15_000);
  heartbeat.unref();

  function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== WS_PATH) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, url));
  }

  function onConnection(ws: WebSocket, url: URL): void {
    const roleParse = Role.safeParse(url.searchParams.get('role'));
    const code = normalizeRoomCode(url.searchParams.get('room') ?? '');
    const tok = url.searchParams.get('token') ?? '';
    if (!roleParse.success) {
      ws.close(CloseCode.BadRequest, 'bad role');
      return;
    }
    const role = roleParse.data;
    const room = registry.get(code);
    if (!room) {
      ws.close(CloseCode.RoomNotFound, 'room not found');
      return;
    }
    if (!registry.authorize(room, role, tok)) {
      ws.close(CloseCode.BadToken, 'bad token');
      return;
    }

    const prev = registry.attach(room, role, ws);
    if (prev && prev !== ws) prev.close(CloseCode.Replaced, 'replaced by a newer connection');
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    log.info({ room: room.code, role, replaced: !!prev }, 'joined');

    const peer = registry.peerOf(room, role);
    send(ws, { type: 'welcome', role, room: room.code, peerConnected: !!peer });
    send(peer, { type: 'peer', connected: true });

    let windowStart = Date.now();
    let count = 0;
    const schema = role === 'host' ? FromHost : FromController;

    ws.on('message', (data: RawData, isBinary: boolean) => {
      const now = Date.now();
      if (now - windowStart >= 1000) {
        windowStart = now;
        count = 0;
      }
      if (++count > MSG_PER_SEC) {
        if (count > MSG_PER_SEC * 3) ws.close(CloseCode.RateLimited, 'too many messages');
        return;
      }
      if (isBinary) return;
      const text = data.toString();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }
      const result = schema.safeParse(parsed);
      if (!result.success) return;
      const msg = result.data;
      if (msg.type === 'ping') {
        send(ws, { type: 'pong', id: msg.id, t: msg.t });
        return;
      }
      const target = registry.peerOf(room, role);
      // Forward the original text: it is already validated, no need to re-serialise on the hot path.
      if (target && target.readyState === target.OPEN) target.send(text);
    });

    ws.on('close', () => onClose(room, role, ws));
    ws.on('error', (err) => log.warn({ room: room.code, role, err: err.message }, 'socket error'));
  }

  function onClose(room: Room, role: Role, ws: WebSocket): void {
    if (!registry.detach(room, role, ws)) return;
    log.info({ room: room.code, role }, 'left');
    send(registry.peerOf(room, role), { type: 'peer', connected: false });
  }

  function close(): void {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  }

  return { handleUpgrade, close };
}
