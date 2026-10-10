import '../shared/theme.css';
import './controller.css';
import { TiltProcessor } from '@joyconhub/input';
import {
  CloseCode,
  INPUT_HEARTBEAT_MS,
  INPUT_RATE_HZ,
  isValidRoomCode,
  normalizeRoomCode,
  type CommandName,
  type ControllerInbound,
  type ControllerLayout,
  type ControllerToHost,
  type HostState,
} from '@joyconhub/protocol';
import { RelaySocket, type SocketStatus } from '../net/socket.ts';
import { escapeHtml, readJSON, writeJSON } from '../shared/storage.ts';
import { AttitudeIndicator } from './attitude.ts';
import { DeviceSensors, TouchTiltSensors, type SensorSource } from './sensors.ts';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type ControllerSettings,
} from './settings.ts';

type Phase = 'connecting' | 'error' | 'start' | 'denied' | 'nosensor' | 'calibrate' | 'play';

const SESSION_KEY = 'joyconhub:controller';
const params = new URLSearchParams(location.search);
const simMode = params.has('sim');

function readCredentials(): { room: string; token: string } | null {
  const m = location.pathname.match(/^\/c\/([^/]+)/);
  const fromUrl = m ? normalizeRoomCode(decodeURIComponent(m[1]!)) : '';
  const tokenFromUrl = params.get('t') ?? '';
  if (fromUrl && tokenFromUrl && isValidRoomCode(fromUrl)) {
    writeJSON('session', SESSION_KEY, { room: fromUrl, token: tokenFromUrl });
    // Keep the secret out of the address bar (screenshots, sharing); reloads use sessionStorage.
    history.replaceState(null, '', `/c/${fromUrl}${simMode ? '?sim=1' : ''}`);
    return { room: fromUrl, token: tokenFromUrl };
  }
  const saved = readJSON<{ room: string; token: string }>('session', SESSION_KEY, {
    room: '',
    token: '',
  });
  if (saved.room && saved.token && (!fromUrl || fromUrl === saved.room)) return saved;
  return null;
}

class ControllerApp {
  private phase: Phase = 'connecting';
  private socket: RelaySocket<ControllerInbound, ControllerToHost> | null = null;
  private processor: TiltProcessor;
  private sensors: SensorSource | null = null;
  private settings: ControllerSettings = loadSettings();
  private layout: ControllerLayout = {
    buttons: [{ id: 'boost', label: 'Boost' }],
    showThrottle: true,
  };
  private gameTitle = '';
  private hostConnected = false;
  private hostState: HostState = 'pairing';
  private score = 0;
  private best = 0;
  private calibrated = false;
  private throttle = 0.6;
  private buttons = 0;
  private seq = 0;
  private lastSent = { r: 0, p: 0, y: 0, th: 0, b: 0, at: 0 };
  private sendTimer = 0;
  private wakeLock: { release(): Promise<void> } | null = null;
  private rotateDismissed = false;
  private toastTimer = 0;
  private els: Record<string, HTMLElement> = {};
  private calIndicator!: AttitudeIndicator;
  private playIndicator!: AttitudeIndicator;

  constructor(private readonly root: HTMLElement) {
    this.processor = new TiltProcessor();
    this.applySettings();
    this.render();
    const creds = readCredentials();
    if (!creds) {
      this.fail(
        'Scan the QR code',
        'Open JoyCon Hub on a computer, pick a game, then scan the QR code it shows with this phone’s camera.',
      );
      return;
    }
    this.socket = new RelaySocket<ControllerInbound, ControllerToHost>({
      role: 'controller',
      room: creds.room,
      token: creds.token,
      onMessage: (m) => this.onMessage(m),
      onStatus: (s, code) => this.onSocketStatus(s, code),
    });
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', () => this.updateOverlays());
    requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------------------------------
  // Networking
  // ------------------------------------------------------------------------------------------

  private onSocketStatus(status: SocketStatus, code?: number): void {
    if (status === 'open') {
      if (this.phase === 'connecting') this.setPhase('start');
    } else if (status === 'failed') {
      this.hostConnected = false;
      if (code === CloseCode.RoomNotFound) {
        this.fail(
          'Game session ended',
          'This room no longer exists. Scan the new QR code on the game screen.',
        );
      } else if (code === CloseCode.BadToken) {
        this.fail(
          'Invalid link',
          'This controller link is not valid. Scan the QR code on the game screen again.',
        );
      } else if (code === CloseCode.Replaced) {
        this.fail(
          'Controller taken over',
          'This game is now being controlled from another tab or phone.',
          true,
        );
      } else {
        this.fail('Connection failed', 'Could not connect to the game. Scan the QR code again.');
      }
    }
    this.updateTop();
    this.updateOverlays();
  }

  private send(msg: ControllerToHost): void {
    this.socket?.send(msg);
  }

  private onMessage(msg: ControllerInbound): void {
    switch (msg.type) {
      case 'welcome':
        this.hostConnected = msg.peerConnected;
        if (this.calibrated) this.send({ type: 'calibrated' });
        if (document.visibilityState === 'visible')
          this.send({ type: 'controller_status', away: false });
        break;
      case 'peer':
        this.hostConnected = msg.connected;
        if (msg.connected && this.calibrated) this.send({ type: 'calibrated' });
        break;
      case 'layout':
        this.layout = msg.layout;
        this.gameTitle = msg.gameTitle;
        this.renderPlayControls();
        break;
      case 'host_state':
        this.hostState = msg.state;
        if (msg.score !== undefined) this.score = msg.score;
        if (msg.best !== undefined) this.best = msg.best;
        break;
      case 'game_event':
        if (msg.score !== undefined) this.score = msg.score;
        if (msg.kind === 'start') this.score = 0;
        this.feedback(msg.kind, msg.vibrate, msg.message);
        break;
      default:
        break;
    }
    this.updateTop();
    this.updateOverlays();
    this.updateScore();
  }

  private startSending(): void {
    window.clearInterval(this.sendTimer);
    this.sendTimer = window.setInterval(() => this.sendInput(), 1000 / INPUT_RATE_HZ);
  }

  private sendInput(): void {
    if (this.phase !== 'play' || !this.socket?.isOpen) return;
    const o = this.processor.output;
    const q = (v: number) => Math.round(v * 1000) / 1000;
    const r = q(o.roll);
    const p = q(o.pitch);
    const y = this.settings.rudder ? q(o.yaw) : 0;
    const th = q(this.throttle);
    const b = this.buttons;
    const now = performance.now();
    const L = this.lastSent;
    const changed =
      Math.abs(r - L.r) > 0.002 ||
      Math.abs(p - L.p) > 0.002 ||
      Math.abs(y - L.y) > 0.002 ||
      th !== L.th ||
      b !== L.b;
    if (!changed && now - L.at < INPUT_HEARTBEAT_MS) return;
    this.send({ type: 'input', s: ++this.seq, r, p, y, th, b });
    this.lastSent = { r, p, y, th, b, at: now };
  }

  private command(name: CommandName): void {
    this.send({ type: 'command', name });
    this.vibrate([15]);
  }

  // ------------------------------------------------------------------------------------------
  // Sensors & calibration
  // ------------------------------------------------------------------------------------------

  /** Must run inside the tap handler (iOS permission prompt). */
  private async start(useTouch = simMode): Promise<void> {
    this.sensors?.stop();
    const sensors: SensorSource = useTouch ? new TouchTiltSensors() : new DeviceSensors();
    sensors.onOrientation = (r) => this.processor.pushOrientation(r);
    sensors.onRotation = (r) => this.processor.pushRotationRate(r, r.t);
    const result = await sensors.start();
    this.sensors = sensors;
    void this.requestWakeLock();
    this.enterFullscreen();

    if (result === 'denied') return this.setPhase('denied');
    if (result !== 'ok') return this.setPhase('nosensor', result === 'insecure');
    if (!(await sensors.waitForData(1500))) return this.setPhase('nosensor');
    this.processor.resetCalibration();
    this.calibrated = false;
    this.setPhase('calibrate');
    this.renderPlayControls();
  }

  private calibrate(): void {
    if (!this.processor.calibrate()) {
      this.toast('Waiting for motion data…');
      return;
    }
    const first = !this.calibrated;
    this.calibrated = true;
    this.vibrate([40]);
    this.flash('#3fa9ff');
    this.send({ type: 'calibrated' });
    if (first || this.phase === 'calibrate') {
      this.setPhase('play');
      this.startSending();
    } else {
      this.toast('Centered');
    }
  }

  private applySettings(): void {
    const s = this.settings;
    this.processor.settings = {
      ...this.processor.settings,
      rollRange: s.sensitivity,
      pitchRange: Math.round(s.sensitivity * 0.85),
      invertPitch: s.invertPitch,
      invertRoll: s.invertRoll,
    };
  }

  // ------------------------------------------------------------------------------------------
  // Device helpers
  // ------------------------------------------------------------------------------------------

  private async requestWakeLock(): Promise<void> {
    try {
      const wl = (
        navigator as unknown as {
          wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> };
        }
      ).wakeLock;
      if (wl && document.visibilityState === 'visible') this.wakeLock = await wl.request('screen');
    } catch {
      this.wakeLock = null;
    }
  }

  private enterFullscreen(): void {
    const el = document.documentElement as HTMLElement & {
      requestFullscreen?: () => Promise<void>;
    };
    if (document.fullscreenElement || typeof el.requestFullscreen !== 'function') return;
    el.requestFullscreen()
      .then(() => {
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        return o?.lock?.('landscape');
      })
      .catch(() => {});
  }

  private onVisibility = () => {
    const visible = document.visibilityState === 'visible';
    this.send({ type: 'controller_status', away: !visible });
    if (visible) void this.requestWakeLock();
  };

  private vibrate(pattern: number[] | undefined): boolean {
    if (!pattern || !this.settings.haptics || typeof navigator.vibrate !== 'function') return false;
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }

  private feedback(kind: string, pattern?: number[], message?: string): void {
    const vibrated = this.vibrate(pattern);
    const color =
      kind === 'score'
        ? '#4dff88'
        : kind === 'crash' || kind === 'hit'
          ? '#ff4d4d'
          : kind === 'start'
            ? '#3fa9ff'
            : '#7c5cff';
    // Phones without vibration (iPhone) get a stronger visual cue instead.
    if (!vibrated || kind !== 'score') this.flash(color);
    if (message) this.toast(message);
  }

  // ------------------------------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------------------------------

  private setPhase(p: Phase, insecure = false): void {
    this.phase = p;
    this.els.root!.dataset.phase = p;
    if (p === 'nosensor') {
      this.els.nosensorText!.textContent = insecure
        ? 'Motion sensors only work on secure (https://) pages, and this page was opened over http. Ask the host to use HTTPS, or play with touch controls.'
        : 'We could not read this device’s motion sensors. You can still play by dragging on the screen.';
    }
    this.updateOverlays();
    this.updateTop();
  }

  private fail(title: string, text: string, canRetry = false): void {
    this.els.errorTitle!.textContent = title;
    this.els.errorText!.textContent = text;
    this.els.retry!.classList.toggle('hidden', !canRetry);
    this.sensors?.stop();
    window.clearInterval(this.sendTimer);
    this.setPhase('error');
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="ctrl" data-phase="connecting" data-el="root">
        <header class="ctrl-top">
          <span class="logo"><span class="pills"><i></i><i></i></span>JoyCon <b>Hub</b></span>
          <span class="title" data-el="title"></span>
          <span class="conn"><span class="dot" data-el="dot"></span><span data-el="conn"></span></span>
          <button class="icon-btn" data-action="settings" aria-label="Settings">⚙️</button>
        </header>

        <section class="screen message" data-show="connecting">
          <div class="spinner"></div>
          <p>Connecting to the game…</p>
        </section>

        <section class="screen message" data-show="error">
          <h1 data-el="errorTitle"></h1>
          <p data-el="errorText"></p>
          <button class="btn blue hidden" data-el="retry" data-action="reload">Reconnect</button>
        </section>

        <section class="screen message" data-show="start">
          <h1>Your phone is the controller</h1>
          <p>Tilt to steer. We use your phone’s motion sensors; nothing leaves this game session.</p>
          <button class="btn primary big-btn" data-action="start" data-testid="start">Tap to Start</button>
          ${simMode ? '<p>Touch mode (sim) is on: drag on the circle to tilt.</p>' : ''}
        </section>

        <section class="screen message" data-show="denied">
          <h1>Motion access is off</h1>
          <p>Tilt controls need permission to read motion sensors.</p>
          <ol>
            <li>Tap <b>Try again</b> and choose <b>Allow</b>.</li>
            <li>No prompt? On iPhone: <b>Settings → Safari → Motion &amp; Orientation Access</b>, then reload this page.</li>
          </ol>
          <button class="btn primary big-btn" data-action="start">Try again</button>
          <button class="link-btn" data-action="touch">Use touch controls instead</button>
        </section>

        <section class="screen message" data-show="nosensor">
          <h1>No motion sensors</h1>
          <p data-el="nosensorText"></p>
          <button class="btn primary big-btn" data-action="touch">Use touch controls</button>
        </section>

        <section class="screen calibrate" data-show="calibrate">
          <canvas class="attitude" data-el="calCanvas"></canvas>
          <div class="copy">
            <h1>Hold it like a controller</h1>
            <p>Turn your phone sideways and hold it with both hands in a comfortable position. That pose will mean “fly straight”.</p>
            <button class="btn blue big-btn" data-action="calibrate" data-testid="calibrate">Calibrate</button>
          </div>
        </section>

        <section class="screen play" data-show="play">
          <div class="throttle" data-el="throttleWrap">
            <div class="track" data-el="throttle"><div class="fill" data-el="throttleFill"></div><div class="knob" data-el="throttleKnob"></div></div>
            <label>Throttle</label>
          </div>
          <div class="play-center">
            <div class="score" data-el="score"></div>
            <canvas class="attitude" data-el="playCanvas"></canvas>
            <div class="pad-hint hidden" data-el="padHint">Drag on the circle to tilt</div>
            <div class="row">
              <button class="small-btn" data-action="calibrate">⟳ Recenter</button>
              <button class="small-btn" data-action="pause">❚❚ Pause</button>
            </div>
          </div>
          <div class="actions" data-el="actions"></div>
        </section>
      </div>
      <div class="overlay hidden" data-el="overlay"></div>
      <div class="sheet hidden" data-el="sheet"></div>
      <div class="flash" data-el="flash"></div>
      <div class="toast" data-el="toast"></div>`;
    this.root
      .querySelectorAll<HTMLElement>('[data-el]')
      .forEach((n) => (this.els[n.dataset.el!] = n));
    this.calIndicator = new AttitudeIndicator(this.els.calCanvas as HTMLCanvasElement);
    this.playIndicator = new AttitudeIndicator(this.els.playCanvas as HTMLCanvasElement);
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    this.bindThrottle();
    this.bindTouchPad(this.els.playCanvas!);
    this.bindTouchPad(this.els.calCanvas!);
    this.renderPlayControls();
    this.updateTop();
  }

  private onClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    switch (target.dataset.action) {
      case 'start':
        void this.start();
        break;
      case 'touch':
        void this.start(true);
        break;
      case 'calibrate':
        this.calibrate();
        break;
      case 'pause':
        this.command('pause');
        break;
      case 'resume':
        this.command('resume');
        break;
      case 'restart':
        this.command('restart');
        break;
      case 'quit':
        this.command('quit');
        break;
      case 'settings':
        this.openSettings();
        break;
      case 'close-settings':
        this.els.sheet!.classList.add('hidden');
        break;
      case 'portrait':
        this.rotateDismissed = true;
        this.updateOverlays();
        break;
      case 'reload':
        location.reload();
        break;
    }
  };

  private renderPlayControls(): void {
    const actions = this.els.actions;
    if (!actions) return;
    actions.innerHTML = this.layout.buttons
      .map(
        (b, i) => `<button class="action-btn" data-button="${i}">${escapeHtml(b.label)}</button>`,
      )
      .join('');
    actions.querySelectorAll<HTMLElement>('[data-button]').forEach((btn) => {
      const bit = 1 << Number(btn.dataset.button);
      const down = (e: PointerEvent) => {
        e.preventDefault();
        btn.setPointerCapture?.(e.pointerId);
        this.buttons |= bit;
        btn.classList.add('pressed');
        this.vibrate([10]);
        this.sendInput();
      };
      const up = () => {
        this.buttons &= ~bit;
        btn.classList.remove('pressed');
        this.sendInput();
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
    });
    this.els.throttleWrap!.classList.toggle('hidden', !this.layout.showThrottle);
    this.els.padHint!.classList.toggle('hidden', this.sensors?.kind !== 'touch');
    this.updateThrottle();
  }

  private bindThrottle(): void {
    const track = this.els.throttle!;
    let active = false;
    const set = (e: PointerEvent) => {
      const r = track.getBoundingClientRect();
      const portrait = r.width > r.height;
      const v = portrait ? (e.clientX - r.left) / r.width : 1 - (e.clientY - r.top) / r.height;
      this.throttle = Math.max(0, Math.min(1, v));
      this.updateThrottle();
    };
    track.addEventListener('pointerdown', (e) => {
      active = true;
      track.setPointerCapture?.(e.pointerId);
      set(e);
    });
    track.addEventListener('pointermove', (e) => active && set(e));
    const end = () => (active = false);
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
  }

  private updateThrottle(): void {
    const track = this.els.throttle!;
    const portrait = track.clientWidth > track.clientHeight;
    const pct = `${(this.throttle * 100).toFixed(1)}%`;
    const fill = this.els.throttleFill!;
    const knob = this.els.throttleKnob!;
    if (portrait) {
      Object.assign(fill.style, {
        width: pct,
        height: '100%',
        top: '0',
        bottom: '0',
        right: 'auto',
      });
      Object.assign(knob.style, {
        left: `calc(${pct} - 11px)`,
        top: '6px',
        bottom: '6px',
        width: '22px',
        height: 'auto',
        marginTop: '0',
        right: 'auto',
      });
    } else {
      Object.assign(fill.style, { height: pct, width: 'auto', top: 'auto', right: '0' });
      Object.assign(knob.style, {
        top: `${(100 - this.throttle * 100).toFixed(1)}%`,
        left: '6px',
        right: '6px',
        width: 'auto',
        height: '22px',
        marginTop: '-11px',
        bottom: 'auto',
      });
    }
  }

  /** In touch mode the horizon doubles as a virtual tilt pad. */
  private bindTouchPad(canvas: HTMLElement): void {
    let active = false;
    const set = (e: PointerEvent) => {
      if (!(this.sensors instanceof TouchTiltSensors)) return;
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      this.sensors.set(x * 1.3, y * 1.3);
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (!(this.sensors instanceof TouchTiltSensors)) return;
      active = true;
      canvas.setPointerCapture?.(e.pointerId);
      set(e);
    });
    canvas.addEventListener('pointermove', (e) => active && set(e));
    const end = () => {
      active = false;
      if (this.sensors instanceof TouchTiltSensors) this.sensors.set(0, 0);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  private updateTop(): void {
    const s = this.socket?.status;
    let dot = 'warn';
    let text = 'Connecting…';
    if (this.phase === 'error') {
      dot = 'bad';
      text = 'Offline';
    } else if (s === 'open' && this.hostConnected) {
      dot = 'ok';
      text = this.socket?.rtt != null ? `${this.socket.rtt} ms` : 'Connected';
    } else if (s === 'open') {
      text = 'Waiting for game';
    } else if (s === 'reconnecting') {
      dot = 'bad';
      text = 'Reconnecting…';
    }
    this.els.dot!.className = `dot ${dot}`;
    this.els.conn!.textContent = text;
    this.els.title!.textContent = this.gameTitle;
  }

  private updateScore(): void {
    this.els.score!.textContent =
      this.hostState === 'playing' || this.score ? `Score ${this.score}` : '';
  }

  private updateOverlays(): void {
    const ov = this.els.overlay!;
    const inGame = this.phase === 'play' || this.phase === 'calibrate';
    const portrait = window.innerHeight > window.innerWidth;
    let html = '';
    if (inGame && portrait && !this.rotateDismissed && this.sensors?.kind !== 'touch') {
      html = `<div class="rotate-icon">📱</div><h1>Turn your phone sideways</h1>
        <p>Hold it in landscape with both hands, like a gamepad. If the screen doesn’t rotate, turn off rotation lock.</p>
        <div class="row"><button class="btn" data-action="portrait">Play in portrait</button></div>`;
    } else if (this.phase === 'play' && this.socket?.status === 'open' && !this.hostConnected) {
      html = `<div class="spinner"></div><h1>Waiting for the game screen</h1><p>Keep this page open. It reconnects automatically.</p>`;
    } else if (this.phase === 'play' && this.socket?.status === 'reconnecting') {
      html = `<div class="spinner"></div><h1>Reconnecting…</h1><p>Check your Wi-Fi or mobile data.</p>`;
    } else if (this.phase === 'play' && this.hostState === 'paused') {
      html = `<h1>Paused</h1><div class="row">
          <button class="btn primary big-btn" data-action="resume" data-testid="resume">Resume</button></div>
        <div class="row"><button class="btn" data-action="restart">Restart</button><button class="btn" data-action="calibrate">Recenter</button><button class="btn" data-action="quit">Quit game</button></div>`;
    } else if (this.phase === 'play' && this.hostState === 'gameover') {
      html = `<h1>Game over</h1><p>Score <b>${this.score}</b> · Best <b>${this.best}</b></p>
        <div class="row"><button class="btn primary big-btn" data-action="restart" data-testid="play-again">Play again</button></div>
        <div class="row"><button class="btn" data-action="quit">Back to games</button></div>`;
    }
    if (ov.dataset.html !== html) {
      ov.dataset.html = html;
      ov.innerHTML = html;
      // Overlay buttons live outside .ctrl, so delegate them explicitly.
      ov.onclick = this.onClick;
    }
    ov.classList.toggle('hidden', !html);
  }

  private openSettings(): void {
    const s = this.settings;
    const sheet = this.els.sheet!;
    sheet.innerHTML = `
      <div class="sheet-box">
        <h2>Controller settings</h2>
        <label class="setting"><span>Tilt range <small>Smaller = more sensitive</small></span>
          <span><input type="range" min="15" max="60" step="1" value="${s.sensitivity}" data-setting="sensitivity" /> <b data-el-val>${s.sensitivity}°</b></span></label>
        <label class="setting"><span>Invert pitch <small>Tilt back to dive (flight-sim style)</small></span><input type="checkbox" data-setting="invertPitch" ${s.invertPitch ? 'checked' : ''} /></label>
        <label class="setting"><span>Invert roll</span><input type="checkbox" data-setting="invertRoll" ${s.invertRoll ? 'checked' : ''} /></label>
        <label class="setting"><span>Twist to steer <small>Use the gyroscope as a rudder</small></span><input type="checkbox" data-setting="rudder" ${s.rudder ? 'checked' : ''} /></label>
        <label class="setting"><span>Vibration <small>Not supported on iPhone</small></span><input type="checkbox" data-setting="haptics" ${s.haptics ? 'checked' : ''} /></label>
        <div class="row" style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn blue" data-action="calibrate">Recenter now</button>
          <button class="btn" data-action="reset-settings">Reset</button>
          <button class="btn primary" data-action="close-settings" style="margin-left:auto">Done</button>
        </div>
      </div>`;
    sheet.classList.remove('hidden');
    sheet.onclick = (e) => {
      const t = e.target as HTMLElement;
      if (t === sheet) return sheet.classList.add('hidden');
      const action = t.closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'reset-settings') {
        this.settings = { ...DEFAULT_SETTINGS };
        saveSettings(this.settings);
        this.applySettings();
        this.openSettings();
      } else if (action === 'calibrate') {
        if (this.phase === 'play') this.calibrate();
        sheet.classList.add('hidden');
      } else if (action === 'close-settings') {
        sheet.classList.add('hidden');
      }
    };
    sheet.querySelectorAll<HTMLInputElement>('[data-setting]').forEach((input) => {
      input.oninput = () => {
        const key = input.dataset.setting as keyof ControllerSettings;
        if (input.type === 'checkbox') (this.settings[key] as boolean) = input.checked;
        else {
          (this.settings[key] as number) = Number(input.value);
          sheet.querySelector('[data-el-val]')!.textContent = `${input.value}°`;
        }
        saveSettings(this.settings);
        this.applySettings();
      };
    });
  }

  private flash(color: string): void {
    const f = this.els.flash!;
    f.style.background = color;
    f.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  }

  private toast(text: string): void {
    const t = this.els.toast!;
    t.textContent = text;
    t.classList.add('on');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('on'), 900);
  }

  private frame = () => {
    requestAnimationFrame(this.frame);
    const o = this.processor.output;
    if (this.phase === 'calibrate')
      this.calIndicator.draw(o.rollDeg, o.pitchDeg, o.roll, o.pitch, this.processor.hasSample);
    else if (this.phase === 'play') {
      this.playIndicator.draw(o.rollDeg, o.pitchDeg, o.roll, o.pitch, true);
      this.updateTop();
    }
  };
}

new ControllerApp(document.getElementById('app')!);
