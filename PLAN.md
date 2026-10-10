# JoyCon Hub — Project Plan

> A browser-based gaming hub of mini games where **your phone is the controller**.
> Scan a QR code on the big screen, tilt your phone, play. No app install, no keyboard, no mouse.

First game: **Sky Tilt**, a simple plane flying game. You steer by tilting the phone (accelerometer + gyroscope).

> **Status:** Phases 0–4 (the MVP) are implemented. See [README.md](README.md) for how to run it. Small deviations from this plan: the server runs TypeScript directly through `tsx`, a Dockerfile replaces platform-specific deploy config, and the room code entry fallback is replaced by a link shown under the QR code (joining always needs the controller token).

---

## 1. Goals & Scope

### Product goals
1. **Zero-friction pairing.** Scan a QR code and you are playing in under 10 seconds. No app, no account.
2. **Feels responsive.** Phone movement to on-screen reaction in **under 50 ms** on the same Wi-Fi, under 100 ms over the internet.
3. **Hub, not a one-off.** Adding the next mini game should only need a new game module, not changes to the core.

### MVP scope (v0.1)
- Hub landing page on the desktop/TV with a game list (only one game at first).
- QR-code pairing of one phone to one game session.
- Phone controller page: sensor permission, calibration, tilt streaming, on-screen buttons.
- Plane game: fly through rings, avoid the ground, score and timer, game over and restart.
- Works on **iOS Safari 16+** and **Android Chrome 110+** as controllers, and on desktop Chrome, Edge, Firefox and Safari as the display.

### Out of scope for the MVP (later phases)
- Multiplayer (several phones in one room), accounts, leaderboards, native apps, and the WebRTC peer-to-peer transport.

---

## 2. How it works (user flow)

```
 DESKTOP (Hub / Game screen)                SERVER                     PHONE (Controller)
 ───────────────────────────               ────────                   ───────────────────
 1. Open joyconhub.app
 2. Click "Sky Tilt"  ── create room ──────▶ room ABCD + token
 3. Shows QR: https://joyconhub.app/c/ABCD?t=…
                                                                     4. Scan QR with camera
                                            ◀── join ABCD + token ── 5. Controller page opens
 6. "Controller connected ✓"  ◀── paired ──                            6. Tap "Start" (permission prompt on iOS)
                                                                     7. Hold phone flat, tap "Calibrate"
 8. Game starts               ◀──── input stream (~60 Hz) ─────────── 8. Tilt to fly, tap buttons
 9. Game events (crash, score) ─────────────────────────────────────▶ 9. Vibrate + show score
```

The desktop and phone never talk to each other directly in the MVP. A small **WebSocket relay server** pairs them by room code and forwards messages. This is simpler and more reliable than WebRTC. WebRTC data channels are planned as a later latency upgrade (Phase 5).

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | Shared message types between server, hub and controller |
| Repo | **pnpm workspaces** monorepo | One repo, shared packages, independent builds |
| Frontend build | **Vite** | Fast dev server, built-in HTTPS plugin for sensor testing |
| Hub UI | **Vanilla TS + lightweight components** (or Preact if UI grows) | Hub is mostly a menu; keep the bundle small |
| 3D game | **Three.js** | Mature, simple, enough for a low-poly plane |
| Server | **Node.js 20 + Fastify + `ws`** | Lightweight WebSocket relay, also serves static files in prod |
| QR code | **`qrcode`** npm package | Renders the QR to canvas/SVG on the desktop |
| Validation | **zod** | Validates every inbound socket message on the server |
| Testing | **Vitest** (unit), **Playwright** (E2E, with emulated sensor events) | |
| Lint/format | ESLint + Prettier | |
| Deploy | **Fly.io / Render** (Node server serving static and WS), or static on Vercel plus WS on Fly | WebSockets need a long-running server |

---

## 4. Repository structure

```
joyconhub/
├─ apps/
│  ├─ server/                 # Node WebSocket relay + static hosting
│  │  ├─ src/
│  │  │  ├─ index.ts          # Fastify bootstrap, HTTPS in dev
│  │  │  ├─ rooms.ts          # Room registry, codes, tokens, TTL cleanup
│  │  │  ├─ relay.ts          # Message routing host <-> controller
│  │  │  └─ lanAddress.ts     # Detect LAN IP for QR URL in dev
│  │  └─ test/
│  └─ web/                    # Vite multi-page app
│     ├─ index.html           # Hub (desktop)
│     ├─ controller.html      # Phone controller  (route /c/:roomCode)
│     └─ src/
│        ├─ hub/              # Game list, pairing screen, QR, connection status
│        ├─ controller/       # Sensor capture, calibration, buttons, haptics
│        └─ net/              # WebSocket client w/ reconnect
├─ packages/
│  ├─ protocol/               # Message types + zod schemas (shared)
│  ├─ input/                  # Sensor math: filtering, calibration, mapping
│  └─ game-sdk/               # MiniGame interface + ControllerInput API
├─ games/
│  └─ sky-tilt/               # Plane game (Three.js), implements MiniGame
├─ PLAN.md
└─ package.json
```

---

## 5. Core architecture

### 5.1 Rooms & pairing
- When the desktop picks a game it calls `POST /api/rooms`. The server returns:
  - `roomCode`: 4–5 characters from an unambiguous alphabet (no `0/O/1/I`), e.g. `K7QX`.
  - `hostToken`: lets the desktop reconnect to its room.
  - `controllerToken`: one-time join secret embedded in the QR URL.
- The desktop opens a WebSocket as **host**.
- The QR encodes `https://<host>/c/<roomCode>?t=<controllerToken>`.
- Below the QR, the screen also shows the room code in big letters, so a player can type it at `/join` if scanning fails.
- The phone opens a WebSocket as **controller** with the code and token. The server binds it to the room and tells the host `controller_joined`.
- Room lifecycle: rooms expire after **10 minutes without a controller** or **2 minutes after both sides leave**. The server allows **1 controller per room** in the MVP; the data model allows `players[]` for later multiplayer.
- Reconnects: the phone keeps its token in `sessionStorage`. If the phone screen sleeps or the network drops, it rejoins on its own. The game pauses while the controller is disconnected and shows "Reconnect your phone" with the QR again.

### 5.2 Message protocol (`packages/protocol`)
All messages are JSON with a `type` field and are validated with zod. Input messages are kept small because they are the hot path.

| Direction | Type | Payload |
|---|---|---|
| ctrl → host | `input` | `{ s: seq, t: ms, r: roll, p: pitch, y: yawRate, b: buttonsBitmask, th: throttle }` (normalized floats, -1..1 / 0..1) |
| ctrl → host | `calibrated` | `{}` |
| host → ctrl | `game_event` | `{ kind: 'crash' \| 'ring' \| 'gameover' \| 'start', score?, vibrate?: number[] }` |
| host → ctrl | `layout` | `{ buttons: [{id, label}], showThrottle: boolean }`: the game tells the controller which buttons to show |
| server → both | `peer_joined` / `peer_left` / `error` | |
| both | `ping` / `pong` | Latency measurement shown in a debug overlay |

Other rules:
- The **sequence number** lets the host drop out-of-order packets.
- **Processed values** are sent, not raw sensor data. The phone does calibration and filtering, so the games stay simple.
- Send rate is capped at **60 Hz**. A message is sent only when values change beyond an epsilon, plus a 10 Hz heartbeat.
- Later optimization: a binary `Float32Array` frame (about 20 bytes) instead of JSON.

### 5.3 Game SDK (`packages/game-sdk`)
Every mini game implements one interface. The hub handles pairing, pausing and menus.

```ts
export interface ControllerInput {
  roll: number;       // -1 (left) .. 1 (right)
  pitch: number;      // -1 (nose down) .. 1 (nose up)
  yawRate: number;    // -1 .. 1, from gyro rotationRate
  throttle: number;   // 0 .. 1
  buttons: Record<string, boolean>;
  connected: boolean;
}

export interface MiniGame {
  id: string;
  title: string;
  thumbnail: string;
  controllerLayout: { buttons: { id: string; label: string }[]; showThrottle: boolean };
  mount(container: HTMLElement, ctx: GameContext): void;   // ctx.input(), ctx.emit(event)
  update(dt: number): void;
  pause(): void;
  resume(): void;
  unmount(): void;
}
```

The hub keeps a **game registry** (`games/index.ts`). Adding a game means adding a folder and one registry entry.

A **keyboard fallback** maps arrow keys to `ControllerInput`. It is for developers only and is hidden behind `?debug=1`, so the product stays phone-first.

---

## 6. Phone controller: sensor design (the core USP)

### 6.1 Sensor APIs
- **`DeviceOrientationEvent`** gives `alpha`, `beta` and `gamma` in degrees. This is the fused orientation from accelerometer, gyro and magnetometer, and it is the main source for **roll and pitch**.
- **`DeviceMotionEvent`** gives `rotationRate` (gyro, deg/s) and `accelerationIncludingGravity`. It is used for **yaw rate** and for gestures like the "shake to boost" button.
- Later option: the Generic Sensor API (`AbsoluteOrientationSensor`, which gives quaternions) on Android Chrome. Wrap it behind the same interface and fall back to DeviceOrientation.

### 6.2 Platform requirements (critical)
- **HTTPS is mandatory.** Browsers do not deliver motion or orientation events on insecure origins. This matters for local development too (see §9).
- **iOS 13+** needs `DeviceOrientationEvent.requestPermission()` and `DeviceMotionEvent.requestPermission()`, called from inside a **user tap**. The controller therefore opens with a big **"Tap to Start"** button.
- If the user denies the permission, show steps to recover it (Settings → Safari → Motion & Orientation Access, or reload and allow).
- Keep the screen awake with the **Screen Wake Lock API** (`navigator.wakeLock.request('screen')`), and request it again on `visibilitychange`.
- **Landscape lock:** call `screen.orientation.lock('landscape')` where supported (Android, in fullscreen). iOS ignores it, so show a "rotate your phone" overlay in portrait.

### 6.3 Holding pose & axis mapping
The player holds the phone **in landscape with both hands, like a game controller**, with the screen facing them.

| Plane action | Phone motion | Sensor source |
|---|---|---|
| **Roll** (bank left/right) | Tilt like a steering wheel | `beta`, remapped for landscape |
| **Pitch** (nose up/down) | Tilt the top edge toward or away from you | `gamma`, remapped for landscape |
| **Yaw** (optional, rudder) | Twist flat on the table plane | `rotationRate.alpha` (gyro) |
| **Throttle** | On-screen vertical slider (left thumb) | Touch |
| **Boost / Fire** | On-screen buttons (right thumb) | Touch |

**Axis remapping:** `beta` and `gamma` mean different things depending on `screen.orientation.angle` (0, 90, -90 or 180). The `input` package has a single `remapForScreenAngle()` function covering all four angles, with unit tests.

### 6.4 Signal processing pipeline (`packages/input`)
```
raw event ─▶ remap axes ─▶ subtract calibration offset ─▶ low-pass filter ─▶ dead-zone ─▶ response curve ─▶ clamp & normalize ─▶ send
```
1. **Calibration:** when the player taps "Calibrate", store the current pose as neutral. Store it as a quaternion built from alpha, beta and gamma. Computing the relative rotation `q_rel = q_neutral⁻¹ · q_current` this way avoids the jumps and gimbal lock you get from subtracting Euler angles directly. Recalibrate any time with a button.
2. **Smoothing:** an exponential moving average (`α ≈ 0.25`) or a **1€ filter**. The 1€ filter is preferred: little lag on fast moves and little jitter when holding still.
3. **Dead-zone:** about ±3° around neutral, so a resting hand flies straight.
4. **Response curve:** `out = sign(x) · |x|^1.5`, which gives fine control near center and full deflection at the edges. Sensitivity (max tilt angle, default ±35°) is adjustable in controller settings.
5. **Normalize:** map to -1..1 and clamp.
6. **Unwrap angle wraparound:** handle the ±180° jump in `beta` and `gamma` near vertical poses.

### 6.5 Controller UI (phone)
- Full-screen and landscape. A large **attitude indicator** (artificial horizon) mirrors the tilt, so the player sees their input.
- Throttle slider on the left; Boost and Pause buttons on the right. The layout comes from the game's `controllerLayout`.
- A connection status dot, with latency shown in debug mode.
- Haptics via `navigator.vibrate()` on crash or ring pass. This works on Android; iOS Safari has no vibration API, so iOS gets a visual flash instead.
- Settings sheet: sensitivity, invert pitch (a flight-sim preference), recalibrate.

---

## 7. First game: Sky Tilt (plane controller)

### 7.1 Gameplay (MVP)
- Endless low-poly landscape (procedurally generated terrain chunks) with **rings** floating in the air.
- Fly through rings for points. Each ring adds **+3 s** to a countdown timer that starts at 60 s.
- Hitting the ground or a mountain is a crash: explosion, the phone vibrates, game over.
- The game over screen shows the score. The phone shows "Play again" as a big button, so the player never needs the keyboard.

### 7.2 Flight model (arcade, not a simulator)
```
roll  += (input.roll  * maxRollRate  - roll  * rollDamping)  * dt
pitch += (input.pitch * maxPitchRate)                        * dt
yaw   += (sin(roll) * turnFactor + input.yawRate * rudder)   * dt   // bank-to-turn
speed  = lerp(minSpeed, maxSpeed, input.throttle) * (boost ? 1.6 : 1)
position += forward(yaw, pitch) * speed * dt
```
- **Bank-to-turn:** rolling the plane turns it. This feels intuitive with tilt control.
- Auto-level: roll slowly returns to level when the input is neutral, which makes it forgiving for beginners.
- Clamp pitch to about ±60° to avoid loops and disorientation in the MVP.
- A chase camera follows the plane with a spring-damper so motion looks smooth.

### 7.3 Rendering & assets
- Three.js scene: plane (simple glTF or procedural mesh), terrain chunks (a noise heightmap built with `simplex-noise`), sky gradient and fog for depth.
- Instanced meshes for rings and trees to keep performance up.
- Targets: **60 FPS on a mid-range laptop integrated GPU**; draw calls under 100.
- Audio: engine hum whose pitch follows speed, ring chime and crash. Audio starts on first user interaction to satisfy autoplay rules.

### 7.4 Input-to-game latency handling
- The game reads the **latest** input sample every frame. It does not queue samples.
- If the network jitters, interpolate between the last two samples for about 1 frame.
- If no input arrives for 500 ms, show "controller lagging". After 3 s, pause.

---

## 8. Hub (desktop) UI
1. **Home:** JoyCon Hub logo and a grid of game cards. Sky Tilt is playable; "Coming soon" cards for future games.
2. **Pairing screen:** a large QR code, the room code, and the steps "1. Scan with phone camera, 2. Tap Start, 3. Hold flat and calibrate". It updates live: Waiting… → Phone connected → Calibrated → **Start!**
3. **In-game:** the game canvas full-screen, a small connection badge, and a pause menu (opened from the phone's Pause button or Esc).
4. A help dialog explaining that both devices need internet. In dev, they also need to be on the same Wi-Fi.

---

## 9. Local development & HTTPS

Sensors need HTTPS on the phone, so the developer setup must handle it:

- **Option A (default): `vite-plugin-mkcert` or `@vitejs/plugin-basic-ssl`** with the dev server on `0.0.0.0`. The server detects the machine's **LAN IP** (`lanAddress.ts`) and puts it in the QR (`https://192.168.x.x:5173/c/ABCD`). With a self-signed certificate the phone must accept a warning once. mkcert plus installing its root CA on the phone avoids that warning.
- **Option B: a tunnel** (`cloudflared tunnel --url https://localhost:5173` or ngrok). This gives a real HTTPS URL that works across networks. Set the `PUBLIC_URL` env var so the QR uses it.
- `pnpm dev` runs the server and Vite together, and prints the pairing URL and a terminal QR (`qrcode-terminal`).
- **Sensor simulator:** a `?sim=1` mode on the controller page with on-screen sliders that produce fake orientation, for testing in a desktop browser. Chrome DevTools → Sensors panel also works.

---

## 10. Security & robustness
- Room codes are random and short-lived. The `controllerToken` stops someone who only guesses the 4-letter code from hijacking a room.
- Server-side zod validation of every message; oversized messages (over 1 KB) are dropped.
- Rate limits: at most 120 messages/s per socket, and room creation limited per IP.
- No personal data collected. Rooms live in memory only.
- CORS and WebSocket origin checks in production.
- Graceful handling of: phone sleeping, tab backgrounded (`visibilitychange` sends `paused`), Wi-Fi to cellular switch, and the server restarting (the client reconnects with exponential backoff).

---

## 11. Testing strategy
| Level | What |
|---|---|
| Unit (Vitest) | Axis remapping for all 4 screen angles, calibration quaternion math, 1€ filter, dead-zone and curve, protocol schemas, room expiry |
| Integration | Server: create room → host connects → controller joins with a bad token (rejected) → good token → input relayed → disconnect cleanup |
| E2E (Playwright) | Two browser contexts (desktop and an emulated mobile). Dispatch synthetic `deviceorientation` events on the controller and check that the plane's roll changes on the host |
| Manual device matrix | iPhone (Safari, iOS 16/17/18), Android Chrome (Pixel, Samsung). Check: permission flow, landscape, wake lock, reconnect after screen lock, latency |
| Performance | FPS overlay in debug mode; latency measured from ping/pong round-trip time |

---

## 12. Deployment
- Single Node service (Fastify) serves the built `apps/web/dist` and the `/ws` WebSocket endpoint, deployed on **Fly.io** or **Render** with automatic HTTPS.
- Pick a region close to the target users; WebSocket hops add latency.
- GitHub Actions CI: lint → typecheck → unit tests → build → E2E → deploy on `main`.
- Later, at scale: put the room registry in Redis so several server instances can share rooms (sticky sessions or pub/sub).

---

## 13. Milestones

| Phase | Deliverable | Key tasks | Est. |
|---|---|---|---|
| **0. Setup** | Repo skeleton | pnpm workspaces, Vite, TS, ESLint/Prettier, Vitest, CI, dev HTTPS | 1 day |
| **1. Pairing** | Phone connects via QR | Server rooms and tokens, WS relay, hub pairing screen with QR, controller join page, reconnect logic, ping display | 2–3 days |
| **2. Controller** | Phone streams clean tilt | iOS permission flow, landscape and wake lock, axis remap, calibration, 1€ filter, dead-zone and curve, attitude indicator UI, buttons and throttle, simulator mode, unit tests | 3–4 days |
| **3. Sky Tilt** | Playable plane game | Game SDK, Three.js scene, flight model, chase cam, terrain chunks, rings and scoring, crash and game over, haptic events, audio | 4–5 days |
| **4. Polish & launch** | Public MVP | Hub UI and branding, onboarding hints, settings (sensitivity/invert), error states, device testing matrix, E2E tests, deploy | 3 days |
| **5. Post-MVP** | Growth | WebRTC data channel (P2P, lower latency) with WS fallback, binary input frames, multiplayer rooms (2–4 phones), more mini games (e.g. tilt marble maze, racing, fishing with a "cast" gesture), local high scores, then global leaderboards, PWA install | ongoing |

**MVP total: about 2.5–3 weeks for one developer.**

---

## 14. Risks & mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| iOS motion permission confusion / denial | Player cannot play | Clear "Tap to Start" flow, recovery instructions, test on real iPhones early (Phase 2) |
| HTTPS required in dev | Slows development | mkcert / tunnel scripts from day 1; simulator mode |
| Network latency or jitter on busy Wi-Fi | Controls feel "floaty" | Small messages, 60 Hz cap, latest-sample-wins, interpolation; WebRTC P2P in Phase 5 |
| Sensor drift / noisy readings | Plane drifts | Use fused orientation (not raw gyro integration), recalibrate button, dead-zone, 1€ filter |
| Euler angle wraparound / gimbal lock | Sudden flips | Quaternion-based relative orientation |
| Device differences (axes, sensor rates) | Inconsistent feel | Screen-angle remap tests, device matrix, user sensitivity setting |
| Motion sickness / fatigue | Short sessions | Arcade physics, auto-level, pitch clamp, short rounds |
| Phone screen sleeps | Disconnects | Wake Lock API + auto-reconnect + game auto-pause |

---

## 15. Definition of done (MVP)
- [ ] A new user opens the hub, scans the QR with an iPhone or Android phone, and is flying within 15 seconds.
- [ ] Tilt to plane reaction feels instant (median round-trip under 50 ms on the same Wi-Fi, shown in the debug overlay).
- [ ] The plane flies straight when the phone is held at the calibrated neutral pose.
- [ ] Locking the phone and unlocking it again reconnects on its own and resumes the game.
- [ ] 60 FPS on a mid-range laptop.
- [ ] Unit and E2E tests pass in CI; deployed on a public HTTPS URL.
- [ ] Adding a second game needs only a new `games/<name>` folder and a registry entry.

---

## 16. Immediate next steps
1. Approve the stack and the holding pose (landscape, two hands).
2. Scaffold the monorepo (Phase 0).
3. Build a throwaway **sensor spike**: a single page that shows live alpha, beta and gamma plus a calibrated attitude indicator on a real iPhone and Android phone. This de-risks the core USP before building the game.
4. Then proceed with Phases 1 → 4.
