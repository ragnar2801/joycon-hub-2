import { FATAL_CLOSE_CODES, wsQuery, type Role, type ServerMessage } from '@joyconhub/protocol';

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'failed';

export interface RelaySocketOptions<In> {
  role: Role;
  room: string;
  token: string;
  onMessage(msg: In): void;
  onStatus?(status: SocketStatus, closeCode?: number): void;
}

const PING_MS = 2000;

/**
 * WebSocket to the relay with automatic reconnect (exponential backoff), round-trip-time
 * measurement and an immediate retry when the page becomes visible again (phone unlocked).
 */
export class RelaySocket<In extends { type: string }, Out extends { type: string }> {
  status: SocketStatus = 'connecting';
  /** last measured round trip to the server, ms */
  rtt: number | null = null;
  private ws: WebSocket | null = null;
  private attempt = 0;
  private retryTimer: number | undefined;
  private pingTimer: number | undefined;
  private pingId = 0;
  private stopped = false;

  constructor(private readonly opts: RelaySocketOptions<In | ServerMessage>) {
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onVisible);
    this.connect();
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  send(msg: Out): boolean {
    if (!this.isOpen) return false;
    this.ws!.send(JSON.stringify(msg));
    return true;
  }

  close(): void {
    this.stopped = true;
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onVisible);
    window.clearTimeout(this.retryTimer);
    window.clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
  }

  private onVisible = () => {
    if (
      document.visibilityState === 'visible' &&
      !this.stopped &&
      !this.isOpen &&
      this.status !== 'failed'
    ) {
      window.clearTimeout(this.retryTimer);
      this.attempt = 0;
      if (this.ws?.readyState !== WebSocket.CONNECTING) this.connect();
    }
  };

  private setStatus(s: SocketStatus, code?: number): void {
    this.status = s;
    this.opts.onStatus?.(s, code);
  }

  private connect(): void {
    if (this.stopped) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(
      `${proto}://${location.host}${wsQuery(this.opts.role, this.opts.room, this.opts.token)}`,
    );
    this.ws = ws;
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    ws.onopen = () => {
      this.attempt = 0;
      this.setStatus('open');
      window.clearInterval(this.pingTimer);
      this.ping();
      this.pingTimer = window.setInterval(() => this.ping(), PING_MS);
    };
    ws.onmessage = (ev) => {
      let msg: In | ServerMessage;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.type === 'pong') {
        this.rtt = Math.round(performance.now() - (msg as { t: number }).t);
        return;
      }
      this.opts.onMessage(msg);
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      window.clearInterval(this.pingTimer);
      if (this.stopped) return;
      if (FATAL_CLOSE_CODES.includes(ev.code)) {
        this.setStatus('failed', ev.code);
        return;
      }
      this.attempt++;
      this.setStatus('reconnecting', ev.code);
      const delay =
        Math.min(8000, 400 * 2 ** Math.min(this.attempt, 5)) * (0.75 + Math.random() * 0.5);
      this.retryTimer = window.setTimeout(() => this.connect(), delay);
    };
  }

  private ping(): void {
    if (this.isOpen)
      this.ws!.send(JSON.stringify({ type: 'ping', id: ++this.pingId, t: performance.now() }));
  }
}
