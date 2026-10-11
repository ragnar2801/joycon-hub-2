import {
  NEUTRAL_INPUT,
  type ControllerInput,
  type GameDefinition,
  type GameEvent,
  type GameModule,
  type MiniGame,
} from '@joyconhub/game-sdk';
import {
  CloseCode,
  type HostInbound,
  type HostState,
  type HostToController,
} from '@joyconhub/protocol';
import {
  RoomError,
  createHostRoom,
  hubTransport,
  type Link,
  type SocketStatus,
} from '../net/transport.ts';
import { escapeHtml, readJSON, writeJSON } from '../shared/storage.ts';
import { KeyboardInput } from './keyboard.ts';
import { pairingTarget, qrSvg, type PairingTarget } from './pairingUrl.ts';

type Phase = 'pairing' | 'playing' | 'paused' | 'gameover';
type PauseReason = 'user' | 'lost' | 'away';

/** After this long without an input frame the stick is treated as centred. */
const STALE_INPUT_MS = 500;

export interface SessionHost {
  exit(): void;
  debug: boolean;
}

/**
 * One play session of one game: owns the room, the relay socket, the pairing screen,
 * the mounted game, and the pause/resume rules when the phone disconnects.
 */
export class GameSession {
  private readonly transport = hubTransport();
  private room: { roomCode: string; controllerToken: string } | null = null;
  private target: PairingTarget | null = null;
  private qr = '';
  private socket: Link<HostToController> | null = null;
  /** consecutive room set-up failures, to avoid retrying forever */
  private roomFailures = 0;
  private socketStatus: SocketStatus = 'connecting';
  private controllerConnected = false;
  private calibrated = false;
  private phase: Phase = 'pairing';
  private pauseReason: PauseReason | null = null;
  private game: MiniGame | null = null;
  private module: Promise<GameModule>;
  private keyboard: KeyboardInput | null = null;
  private latest: ControllerInput = { ...NEUTRAL_INPUT };
  private lastInputAt = 0;
  private lastSeq = -1;
  private lastScore = 0;
  private best = 0;
  private raf = 0;
  private lastFrame = 0;
  private fps = 0;
  private error: string | null = null;
  private destroyed = false;
  private el: Record<string, HTMLElement> = {};

  constructor(
    private readonly def: GameDefinition,
    private readonly root: HTMLElement,
    private readonly host: SessionHost,
  ) {
    this.module = def.load!();
    this.best = readJSON('local', `joyconhub:best:${def.id}`, { v: 0 }).v;
    window.addEventListener('keydown', this.onKey);
    (window as unknown as { __joyconhub?: unknown }).__joyconhub = {
      phase: () => this.phase,
      input: () => this.input(),
      controllerConnected: () => this.controllerConnected,
      pairingUrl: () => this.target?.url,
    };
  }

  async start(): Promise<void> {
    this.renderPairing();
    await this.openRoom();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    this.socket?.close();
    this.keyboard?.dispose();
    this.game?.unmount();
    this.game = null;
  }

  // ------------------------------------------------------------------------------------------
  // Room + socket
  // ------------------------------------------------------------------------------------------

  private async openRoom(): Promise<void> {
    this.socket?.close();
    this.socket = null;
    this.error = null;
    this.room = null;
    this.target = null;
    this.qr = '';
    this.controllerConnected = false;
    this.calibrated = false;
    this.socketStatus = 'connecting';
    this.refresh();
    try {
      const room = await createHostRoom(this.transport, this.def.id, {
        onMessage: (m) => this.onMessage(m),
        onStatus: (s, code) => this.onSocketStatus(s, code),
      });
      if (this.destroyed) {
        room.link.close();
        return;
      }
      this.socket = room.link;
      this.room = room;
      this.target = await pairingTarget(this.transport, room.roomCode, room.controllerToken);
      this.qr = await qrSvg(this.target.url);
    } catch (e) {
      this.error = e instanceof RoomError ? e.message : 'Could not create a game room.';
    }
    this.refresh();
  }

  private onSocketStatus(status: SocketStatus, code?: number): void {
    this.socketStatus = status;
    if (status === 'open') this.roomFailures = 0;
    if (status === 'failed' && code !== CloseCode.Replaced) {
      this.controllerConnected = false;
      if (this.phase === 'playing') this.pause('lost');
      if (code === CloseCode.BadRequest || ++this.roomFailures > 3) {
        this.error =
          this.transport === 'p2p'
            ? 'Could not set up a direct connection in this browser. Try an up-to-date Chrome, Edge, Firefox or Safari.'
            : 'Lost the connection to the JoyCon Hub server.';
        this.refresh();
        return;
      }
      // Room is gone (e.g. server restarted): make a new one and show the new QR.
      void this.openRoom();
      return;
    }
    if (status === 'reconnecting') {
      this.controllerConnected = false;
      if (this.phase === 'playing') this.pause('lost');
    }
    this.refresh();
  }

  private send(msg: HostToController): void {
    this.socket?.send(msg);
  }

  private sendLayout(): void {
    this.send({ type: 'layout', gameTitle: this.def.title, layout: this.def.controllerLayout });
  }

  private sendState(): void {
    const state: HostState = this.phase;
    this.send({ type: 'host_state', state, score: this.lastScore, best: this.best });
  }

  private onMessage(msg: HostInbound): void {
    switch (msg.type) {
      case 'welcome':
        this.setControllerConnected(msg.peerConnected);
        break;
      case 'peer':
        this.setControllerConnected(msg.connected);
        break;
      case 'calibrated':
        this.calibrated = true;
        if (this.phase === 'pairing') void this.startGame();
        else if (this.phase === 'paused' && this.pauseReason !== 'user') this.resume();
        this.refresh();
        break;
      case 'input': {
        // Drop out-of-order frames; a big jump backwards means the phone reloaded the page.
        if (msg.s <= this.lastSeq && this.lastSeq - msg.s < 1000) break;
        this.lastSeq = msg.s;
        this.lastInputAt = performance.now();
        const buttons: Record<string, boolean> = {};
        this.def.controllerLayout.buttons.forEach(
          (b, i) => (buttons[b.id] = (msg.b & (1 << i)) !== 0),
        );
        this.latest = {
          roll: msg.r,
          pitch: msg.p,
          yawRate: msg.y,
          throttle: msg.th,
          buttons,
          connected: true,
        };
        break;
      }
      case 'command':
        if (msg.name === 'pause') this.pause('user');
        else if (msg.name === 'resume') this.resume();
        else if (msg.name === 'restart') this.restart();
        else if (msg.name === 'quit') this.host.exit();
        break;
      case 'controller_status':
        if (msg.away && this.phase === 'playing') this.pause('away');
        else if (!msg.away && this.phase === 'paused' && this.pauseReason === 'away') this.resume();
        break;
      default:
        break;
    }
  }

  private setControllerConnected(connected: boolean): void {
    this.controllerConnected = connected;
    if (connected) {
      // A (re)connected phone starts a fresh input stream and re-sends `calibrated` if it is.
      this.lastSeq = -1;
      this.calibrated = false;
      this.sendLayout();
      this.sendState();
    } else {
      this.calibrated = false;
      this.latest = { ...NEUTRAL_INPUT };
      if (this.phase === 'playing') this.pause('lost');
      else if (this.phase === 'paused' && !this.keyboard) {
        this.pauseReason = 'lost';
      }
    }
    this.refresh();
  }

  // ------------------------------------------------------------------------------------------
  // Game lifecycle
  // ------------------------------------------------------------------------------------------

  private input(): ControllerInput {
    if (this.keyboard) return this.keyboard.read();
    if (!this.controllerConnected) return { ...this.latest, connected: false };
    if (performance.now() - this.lastInputAt > STALE_INPUT_MS) {
      return { ...this.latest, roll: 0, pitch: 0, yawRate: 0, buttons: {} };
    }
    return this.latest;
  }

  private async startGame(): Promise<void> {
    if (this.game) return;
    this.phase = 'playing';
    this.renderGameView();
    let mod: GameModule;
    try {
      mod = await this.module;
    } catch {
      this.error = 'Could not load the game. Check your connection and try again.';
      this.phase = 'pairing';
      this.renderPairing();
      return;
    }
    if (this.destroyed) return;
    const game = mod.createGame();
    this.game = game;
    game.mount(this.el.stage!, {
      input: () => this.input(),
      emit: (e) => this.onGameEvent(e),
      debug: this.host.debug,
    });
    this.sendState();
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
      this.lastFrame = now;
      if (dt > 0) this.fps = this.fps * 0.95 + (1 / dt) * 0.05;
      if (this.phase === 'playing' || this.phase === 'gameover') this.game?.update(dt);
      this.updateBadge();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private onGameEvent(e: GameEvent): void {
    if (e.score !== undefined) this.lastScore = e.score;
    if (e.kind === 'start') this.lastScore = 0;
    if (e.kind === 'gameover') {
      this.phase = 'gameover';
      const result = e.best ?? e.score ?? 0;
      const improved =
        this.def.controllerLayout.scoreFormat === 'time'
          ? result > 0 && (this.best === 0 || result < this.best)
          : result > this.best;
      if (improved) {
        this.best = result;
        writeJSON('local', `joyconhub:best:${this.def.id}`, { v: this.best });
      }
      this.sendState();
    }
    this.send({
      type: 'game_event',
      kind: e.kind,
      score: e.score,
      message: e.message?.slice(0, 80),
      vibrate: e.vibrate,
    });
  }

  private pause(reason: PauseReason): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.pauseReason = reason;
      this.game?.pause();
    } else if (this.phase === 'paused' && reason === 'lost') {
      this.pauseReason = 'lost';
    } else {
      return;
    }
    this.sendState();
    this.refresh();
  }

  private resume(): void {
    if (this.phase !== 'paused') return;
    if (!this.keyboard && !this.controllerConnected) return;
    this.phase = 'playing';
    this.pauseReason = null;
    this.game?.resume();
    this.lastFrame = performance.now();
    this.sendState();
    this.refresh();
  }

  private restart(): void {
    if (!this.game) return;
    if (this.phase === 'paused') this.game.resume();
    this.game.restart();
    this.phase = 'playing';
    this.pauseReason = null;
    this.lastScore = 0;
    this.sendState();
    this.refresh();
  }

  private playWithKeyboard(): void {
    this.keyboard ??= new KeyboardInput();
    if (this.phase === 'pairing') void this.startGame();
    else this.resume();
    this.refresh();
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (this.phase === 'playing') this.pause('user');
      else if (this.phase === 'paused' && this.pauseReason === 'user') this.resume();
      else if (this.phase === 'pairing') this.host.exit();
    } else if (e.key === 'Enter' && this.phase === 'gameover') {
      this.restart();
    }
  };

  // ------------------------------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------------------------------

  private refresh(): void {
    if (this.destroyed) return;
    if (this.phase === 'pairing') this.updatePairing();
    else this.updateGameOverlay();
  }

  private qrCardHtml(): string {
    const code = this.room?.roomCode ?? '····';
    const url = this.target?.url ?? '';
    return `
      <div class="qr-card">
        <div class="qr">${this.qr || '<div class="spinner"></div>'}</div>
        <div class="room-code">Room <b>${escapeHtml(code)}</b></div>
        <a class="pair-url" data-testid="pair-url" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>
      </div>`;
  }

  private renderPairing(): void {
    this.root.innerHTML = `
      <div class="pair">
        <div class="topbar">
          <button class="btn ghost" data-action="back">← Back to games</button>
          <span class="logo"><span class="pills"><i></i><i></i></span>JoyCon <b>Hub</b></span>
        </div>
        <div class="pair-grid">
          <div>
            <div class="eyebrow">${escapeHtml(this.def.icon)} ${escapeHtml(this.def.title)}</div>
            <h2>Grab your phone.<br />It’s your controller.</h2>
            <ol class="steps">
              <li data-step="scan"><span class="state">1</span><span>Scan the QR code with your phone’s camera</span></li>
              <li data-step="start"><span class="state">2</span><span>Tap <b>Start</b> and allow motion access</span></li>
              <li data-step="calibrate"><span class="state">3</span><span>Hold it sideways like a controller, tap <b>Calibrate</b></span></li>
            </ol>
            <p class="hint">${
              this.transport === 'p2p'
                ? 'Phone and computer connect directly to each other, so both need internet access. Same Wi-Fi gives the lowest lag.'
                : 'Phone and computer need internet access. During local development they must be on the same Wi-Fi.'
            }</p>
            <div class="notice hidden" data-el="notice"></div>
            <div class="pair-actions">
              <button class="btn hidden" data-action="retry">Try again</button>
              ${this.host.debug ? '<button class="btn blue" data-action="keyboard">Play with keyboard (debug)</button>' : ''}
            </div>
          </div>
          <div data-el="qr">${this.qrCardHtml()}</div>
        </div>
      </div>`;
    this.bind();
    this.updatePairing();
  }

  private updatePairing(): void {
    const qr = this.root.querySelector<HTMLElement>('[data-el="qr"]');
    if (!qr) return;
    qr.innerHTML =
      this.qrCardHtml() +
      `<div class="status-line"><span class="dot ${this.statusDot()}"></span><span>${this.statusText()}</span></div>`;
    const steps = ['scan', 'start', 'calibrate'];
    const doneCount = this.calibrated ? 3 : this.controllerConnected ? 1 : 0;
    steps.forEach((s, i) => {
      const li = this.root.querySelector<HTMLElement>(`[data-step="${s}"]`);
      if (!li) return;
      li.classList.toggle('done', i < doneCount);
      li.classList.toggle('active', i === doneCount && !!this.room);
      li.querySelector('.state')!.textContent = i < doneCount ? '✓' : String(i + 1);
    });
    const notice = this.root.querySelector<HTMLElement>('[data-el="notice"]')!;
    const msg = this.error ?? this.target?.warning;
    notice.classList.toggle('hidden', !msg);
    notice.classList.toggle('bad', !!this.error);
    notice.textContent = msg ?? '';
    this.root.querySelector('[data-action="retry"]')?.classList.toggle('hidden', !this.error);
  }

  private statusDot(): string {
    if (this.error) return 'bad';
    if (this.socketStatus !== 'open') return 'warn';
    return this.controllerConnected ? 'ok' : 'warn';
  }

  private statusText(): string {
    if (this.error) return 'Not connected';
    if (this.socketStatus !== 'open')
      return this.transport === 'p2p' ? 'Setting up connection…' : 'Connecting to server…';
    if (!this.controllerConnected) return 'Waiting for your phone…';
    return this.calibrated ? 'Ready!' : 'Phone connected: calibrate on your phone';
  }

  private renderGameView(): void {
    this.root.innerHTML = `
      <div class="game-view">
        <div class="game-stage" data-el="stage"></div>
        <div class="badge" data-el="badge"></div>
        ${this.host.debug ? '<div class="debug-panel" data-el="debug"></div>' : ''}
        <div class="overlay hidden" data-el="overlay"></div>
      </div>`;
    this.el = {};
    this.root
      .querySelectorAll<HTMLElement>('[data-el]')
      .forEach((n) => (this.el[n.dataset.el!] = n));
    this.updateGameOverlay();
  }

  private updateGameOverlay(): void {
    const ov = this.el.overlay;
    if (!ov) return;
    if (this.phase !== 'paused') {
      ov.classList.add('hidden');
      ov.innerHTML = '';
      return;
    }
    ov.classList.remove('hidden');
    if (this.pauseReason === 'lost') {
      ov.innerHTML = `
        <div class="overlay-box">
          <h2>Phone disconnected</h2>
          <p>Unlock your phone to reconnect, or scan the code again.</p>
          ${this.qrCardHtml()}
          <div class="overlay-actions">
            ${this.host.debug ? '<button class="btn blue" data-action="keyboard">Use keyboard</button>' : ''}
            <button class="btn" data-action="quit">Quit to hub</button>
          </div>
        </div>`;
    } else if (this.pauseReason === 'away') {
      ov.innerHTML = `
        <div class="overlay-box">
          <h2>Phone is asleep</h2>
          <p>Unlock your phone and open the controller page to keep playing.</p>
          <div class="overlay-actions"><button class="btn" data-action="quit">Quit to hub</button></div>
        </div>`;
    } else {
      ov.innerHTML = `
        <div class="overlay-box">
          <h2>Paused</h2>
          <p>Resume from your phone, or press <span class="kbd">Esc</span>.</p>
          <div class="overlay-actions">
            <button class="btn primary" data-action="resume">Resume</button>
            <button class="btn" data-action="restart">Restart</button>
            <button class="btn" data-action="quit">Quit to hub</button>
          </div>
        </div>`;
    }
    this.bind();
  }

  private updateBadge(): void {
    const badge = this.el.badge;
    if (!badge) return;
    let dot = 'ok';
    let text: string;
    if (this.keyboard) {
      text = 'Keyboard';
    } else if (!this.controllerConnected) {
      dot = 'bad';
      text = 'Phone disconnected';
    } else if (performance.now() - this.lastInputAt > STALE_INPUT_MS && this.phase === 'playing') {
      dot = 'warn';
      text = 'Phone lagging…';
    } else {
      text = 'Phone connected';
    }
    if (this.socket?.rtt != null) text += ` · ${this.socket.rtt} ms`;
    if (this.phase === 'gameover') text += ' · Enter to restart';
    const html = `<span class="dot ${dot}"></span>${text}`;
    if (badge.innerHTML !== html) badge.innerHTML = html;

    if (this.el.debug) {
      const i = this.input();
      this.el.debug.textContent =
        `fps   ${this.fps.toFixed(0)}\nrtt   ${this.socket?.rtt ?? '-'} ms\nroll  ${i.roll.toFixed(2)}\npitch ${i.pitch.toFixed(2)}\n` +
        `yaw   ${i.yawRate.toFixed(2)}\nthr   ${i.throttle.toFixed(2)}\nbtn   ${
          Object.entries(i.buttons)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(',') || '-'
        }\nphase ${this.phase}`;
    }
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach((b) => {
      b.onclick = () => {
        switch (b.dataset.action) {
          case 'back':
          case 'quit':
            this.host.exit();
            break;
          case 'retry':
            this.roomFailures = 0;
            void this.openRoom();
            break;
          case 'keyboard':
            this.playWithKeyboard();
            break;
          case 'resume':
            this.resume();
            break;
          case 'restart':
            this.restart();
            break;
        }
      };
    });
  }
}
