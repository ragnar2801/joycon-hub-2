/**
 * Peer-to-peer transport for static hosting (GitHub Pages): the hub and the phone talk over a
 * WebRTC data channel. A PeerJS signalling server (the free public one by default) is only used
 * to set the connection up; game traffic then flows directly between the two devices, or through
 * PeerJS's TURN relay when a direct path is impossible.
 *
 * The links emulate the relay server's `welcome` / `peer` / `pong` messages, so the hub and the
 * controller code don't care which transport is in use.
 */
import type { DataConnection, Peer, PeerOptions } from 'peerjs';
import {
  CloseCode,
  ControllerToHost,
  HostToController,
  REPLACED_NOTICE,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  p2pPeerId,
  type ControllerInbound,
  type HostInbound,
} from '@joyconhub/protocol';
import type { Link, LinkHandlers } from './transport.ts';
import type { SocketStatus } from './socket.ts';

const PING_MS = 2000;
/** A connection that has been silent this long is considered dead (WebRTC close events can lag). */
const SILENCE_MS = 6500;
const CONNECT_TIMEOUT_MS = 12000;

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomString(alphabet: string, length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function createP2pRoom(): { roomCode: string; controllerToken: string } {
  return {
    roomCode: randomString(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH),
    controllerToken: randomString(TOKEN_ALPHABET, 20),
  };
}

/** Signalling server settings; defaults to the free PeerJS cloud server. */
function peerOptions(): PeerOptions {
  const env = import.meta.env;
  const opts: PeerOptions = { debug: 0 };
  if (env.VITE_PEER_HOST) {
    opts.host = env.VITE_PEER_HOST;
    if (env.VITE_PEER_PORT) opts.port = Number(env.VITE_PEER_PORT);
    if (env.VITE_PEER_PATH) opts.path = env.VITE_PEER_PATH;
    opts.secure = env.VITE_PEER_SECURE !== '0';
  }
  return opts;
}

let peerClass: Promise<typeof Peer> | null = null;
function loadPeer(): Promise<typeof Peer> {
  peerClass ??= import('peerjs').then((m) => m.Peer);
  return peerClass;
}

interface Envelope {
  type?: unknown;
  id?: unknown;
  t?: unknown;
}

/** Ping/pong + liveness bookkeeping for one data connection. */
class Heartbeat {
  rtt: number | null = null;
  lastSeen = performance.now();
  private pingId = 0;

  /** Handles transport-level messages; returns true if the message was consumed. */
  handle(conn: DataConnection, data: Envelope): boolean {
    this.lastSeen = performance.now();
    if (data.type === 'ping') {
      conn.send({ type: 'pong', id: data.id, t: data.t });
      return true;
    }
    if (data.type === 'pong') {
      if (typeof data.t === 'number') this.rtt = Math.round(performance.now() - data.t);
      return true;
    }
    return false;
  }

  ping(conn: DataConnection): void {
    conn.send({ type: 'ping', id: ++this.pingId, t: performance.now() });
  }

  get silent(): boolean {
    return performance.now() - this.lastSeen > SILENCE_MS;
  }
}

// ---------------------------------------------------------------------------------------------
// Hub side
// ---------------------------------------------------------------------------------------------

export class PeerHostLink implements Link<HostToController> {
  status: SocketStatus = 'connecting';
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private beat = new Heartbeat();
  private timer: number | undefined;
  private stopped = false;
  private registered = false;

  constructor(
    private readonly room: string,
    token: string,
    private readonly h: LinkHandlers<HostInbound>,
  ) {
    void this.start(p2pPeerId(room, token));
  }

  get rtt(): number | null {
    return this.conn?.open ? this.beat.rtt : null;
  }

  get isOpen(): boolean {
    return this.status === 'open';
  }

  send(msg: HostToController): boolean {
    if (!this.conn?.open) return false;
    this.conn.send(msg);
    return true;
  }

  close(): void {
    this.stopped = true;
    window.clearInterval(this.timer);
    this.peer?.destroy();
    this.peer = null;
    this.conn = null;
  }

  private setStatus(s: SocketStatus, code?: number): void {
    if (this.stopped) return;
    this.status = s;
    this.h.onStatus?.(s, code);
  }

  private async start(id: string): Promise<void> {
    let PeerCtor: typeof Peer;
    try {
      PeerCtor = await loadPeer();
    } catch {
      this.setStatus('failed', CloseCode.BadRequest);
      return;
    }
    if (this.stopped) return;
    const peer = new PeerCtor(id, peerOptions());
    this.peer = peer;

    peer.on('open', () => {
      this.registered = true;
      this.setStatus('open');
      this.h.onMessage({
        type: 'welcome',
        role: 'host',
        room: this.room,
        peerConnected: !!this.conn?.open,
      });
    });
    peer.on('connection', (conn) => this.adopt(conn));
    peer.on('disconnected', () => {
      // Lost the signalling server. An existing phone connection keeps working; we only need the
      // server again for new phones, so reconnect quietly.
      if (this.stopped || peer.destroyed) return;
      if (!this.conn?.open) this.setStatus('reconnecting');
      window.setTimeout(
        () => !this.stopped && !peer.destroyed && peer.disconnected && peer.reconnect(),
        1500,
      );
    });
    peer.on('error', (err) => {
      if (this.stopped) return;
      const type = (err as { type?: string }).type;
      if (type === 'unavailable-id' || type === 'invalid-id') {
        // Room id clash (practically impossible) → caller makes a new room.
        this.setStatus('failed', CloseCode.RoomNotFound);
      } else if (
        type === 'browser-incompatible' ||
        type === 'ssl-unavailable' ||
        type === 'invalid-key'
      ) {
        this.setStatus('failed', CloseCode.BadRequest);
      } else if (type === 'peer-unavailable' || type === 'webrtc') {
        // About a single connection; handled by its own events.
      } else if (!this.registered || !this.conn?.open) {
        this.setStatus('reconnecting');
      }
    });

    this.timer = window.setInterval(() => {
      const c = this.conn;
      if (!c?.open) return;
      if (this.beat.silent) this.drop(c);
      else this.beat.ping(c);
    }, PING_MS);
  }

  private adopt(conn: DataConnection): void {
    const old = this.conn;
    if (old && old !== conn) {
      try {
        if (old.open) old.send({ type: REPLACED_NOTICE });
      } catch {
        /* already gone */
      }
      window.setTimeout(() => old.close(), 200);
    }
    this.conn = conn;
    this.beat = new Heartbeat();
    conn.on('open', () => {
      if (this.conn !== conn) return;
      this.beat.lastSeen = performance.now();
      if (this.status !== 'open') this.setStatus('open');
      this.h.onMessage({ type: 'peer', connected: true });
    });
    conn.on('data', (raw) => {
      if (this.conn !== conn || typeof raw !== 'object' || raw === null) return;
      if (this.beat.handle(conn, raw as Envelope)) return;
      // No server validates for us in p2p mode, so the hub checks every message itself.
      const parsed = ControllerToHost.safeParse(raw);
      if (parsed.success) this.h.onMessage(parsed.data);
    });
    conn.on('close', () => this.drop(conn));
    conn.on('error', () => this.drop(conn));
  }

  private drop(conn: DataConnection): void {
    if (this.conn !== conn) return;
    this.conn = null;
    try {
      conn.close();
    } catch {
      /* ignore */
    }
    this.h.onMessage({ type: 'peer', connected: false });
  }
}

// ---------------------------------------------------------------------------------------------
// Phone side
// ---------------------------------------------------------------------------------------------

export class PeerControllerLink implements Link<ControllerToHost> {
  status: SocketStatus = 'connecting';
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private beat = new Heartbeat();
  private hostId: string;
  private timer: number | undefined;
  private retryTimer: number | undefined;
  private connectTimer: number | undefined;
  private attempt = 0;
  private unavailable = 0;
  private everConnected = false;
  private stopped = false;

  constructor(
    private readonly room: string,
    token: string,
    private readonly h: LinkHandlers<ControllerInbound>,
  ) {
    this.hostId = p2pPeerId(room, token);
    document.addEventListener('visibilitychange', this.onWake);
    window.addEventListener('online', this.onWake);
    void this.start();
  }

  get rtt(): number | null {
    return this.isOpen ? this.beat.rtt : null;
  }

  get isOpen(): boolean {
    return this.status === 'open' && !!this.conn?.open;
  }

  send(msg: ControllerToHost): boolean {
    if (!this.conn?.open) return false;
    this.conn.send(msg);
    return true;
  }

  close(): void {
    this.stopped = true;
    document.removeEventListener('visibilitychange', this.onWake);
    window.removeEventListener('online', this.onWake);
    window.clearInterval(this.timer);
    window.clearTimeout(this.retryTimer);
    window.clearTimeout(this.connectTimer);
    this.peer?.destroy();
    this.peer = null;
    this.conn = null;
  }

  private setStatus(s: SocketStatus, code?: number): void {
    if (this.stopped || this.status === 'failed') return;
    this.status = s;
    this.h.onStatus?.(s, code);
  }

  private fail(code: number): void {
    this.setStatus('failed', code);
    this.close();
  }

  private async start(): Promise<void> {
    let PeerCtor: typeof Peer;
    try {
      PeerCtor = await loadPeer();
    } catch {
      this.fail(CloseCode.BadRequest);
      return;
    }
    if (this.stopped) return;
    const peer = new PeerCtor(peerOptions());
    this.peer = peer;
    peer.on('open', () => this.connect());
    peer.on('disconnected', () => {
      if (this.stopped || peer.destroyed) return;
      window.setTimeout(
        () => !this.stopped && !peer.destroyed && peer.disconnected && peer.reconnect(),
        1500,
      );
    });
    peer.on('error', (err) => {
      if (this.stopped) return;
      const type = (err as { type?: string }).type;
      if (type === 'peer-unavailable') {
        // The hub isn't registered. Right away that means a stale QR code; after a working
        // session, give a reloading/reconnecting hub a few tries before giving up.
        this.unavailable++;
        if (!this.everConnected || this.unavailable >= 4) this.fail(CloseCode.RoomNotFound);
        else this.retry();
      } else if (
        type === 'browser-incompatible' ||
        type === 'ssl-unavailable' ||
        type === 'invalid-key'
      ) {
        this.fail(CloseCode.BadRequest);
      } else if (!this.conn?.open) {
        this.retry();
      }
    });
    this.timer = window.setInterval(() => {
      const c = this.conn;
      if (!c?.open) return;
      if (this.beat.silent) this.lost(c);
      else this.beat.ping(c);
    }, PING_MS);
  }

  private connect(): void {
    const peer = this.peer;
    if (this.stopped || !peer || peer.destroyed) return;
    if (peer.disconnected) {
      peer.reconnect();
      return; // 'open' fires again once the signalling server is back
    }
    if (this.conn && !this.conn.open) this.conn.close();
    if (this.conn?.open) return;
    this.setStatus(this.everConnected ? 'reconnecting' : 'connecting');
    const conn = peer.connect(this.hostId, { reliable: true, serialization: 'json' });
    this.conn = conn;
    this.beat = new Heartbeat();
    window.clearTimeout(this.connectTimer);
    this.connectTimer = window.setTimeout(() => {
      if (this.conn === conn && !conn.open) this.lost(conn);
    }, CONNECT_TIMEOUT_MS);

    conn.on('open', () => {
      if (this.conn !== conn) return;
      window.clearTimeout(this.connectTimer);
      this.everConnected = true;
      this.attempt = 0;
      this.unavailable = 0;
      this.beat.lastSeen = performance.now();
      this.setStatus('open');
      this.h.onMessage({
        type: 'welcome',
        role: 'controller',
        room: this.room,
        peerConnected: true,
      });
      this.beat.ping(conn);
    });
    conn.on('data', (raw) => {
      if (this.conn !== conn || typeof raw !== 'object' || raw === null) return;
      const env = raw as Envelope;
      if (env.type === REPLACED_NOTICE) {
        this.fail(CloseCode.Replaced);
        return;
      }
      if (this.beat.handle(conn, env)) return;
      const parsed = HostToController.safeParse(raw);
      if (parsed.success) this.h.onMessage(parsed.data);
    });
    conn.on('close', () => this.lost(conn));
    conn.on('error', () => this.lost(conn));
  }

  private lost(conn: DataConnection): void {
    if (this.conn !== conn) return;
    this.conn = null;
    try {
      conn.close();
    } catch {
      /* ignore */
    }
    if (this.stopped) return;
    this.retry();
  }

  private retry(): void {
    if (this.stopped || this.status === 'failed') return;
    this.setStatus('reconnecting');
    window.clearTimeout(this.retryTimer);
    this.attempt++;
    const delay = Math.min(6000, 500 * 2 ** Math.min(this.attempt, 4));
    this.retryTimer = window.setTimeout(() => this.connect(), delay);
  }

  /** Phone unlocked / back online: don't wait for the backoff timer. */
  private onWake = () => {
    if (document.visibilityState !== 'visible' || this.stopped || this.status === 'failed') return;
    const c = this.conn;
    if (c?.open && performance.now() - this.beat.lastSeen > PING_MS * 1.5) {
      this.lost(c); // probably died while the phone slept
      window.clearTimeout(this.retryTimer);
      this.connect();
    } else if (!c?.open) {
      window.clearTimeout(this.retryTimer);
      this.connect();
    }
  };
}
