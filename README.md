# JoyCon Hub

A browser gaming hub where **your phone is the controller**. Open the hub on a computer or TV, scan the QR code with your phone, and tilt to play. There's no app to install and no sign-up.

The first game is **Sky Tilt**. You fly a low-poly plane through golden rings over an endless island and steer by tilting your phone. The phone's motion sensors (accelerometer and gyroscope) supply the input.

```
 Computer / TV (hub + game)  ◀── WebSocket ──▶  Relay server  ◀── WebSocket ──▶  Phone (controller page)
        Three.js game                       rooms, tokens, validation          tilt → calibrated stick values
```

## Quick start

Requirements: Node 20+ and pnpm (`corepack enable` gives you pnpm).

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts the relay server on port 3000 and the web app on **https://localhost:5173**.

1. Open **https://localhost:5173** on your computer. The dev certificate is self-signed, so accept the browser warning once.
2. Click **Sky Tilt**. A QR code appears. It points at your computer's **LAN address** (for example `https://192.168.1.20:5173/c/K7QX?t=…`), not `localhost`.
3. Scan it with your phone. The phone must be on the **same Wi-Fi**. Accept the certificate warning there too (iPhone: _Show Details → visit this website_).
4. Tap **Start**, then allow motion access (iPhone asks).
5. Hold the phone sideways like a gamepad and tap **Calibrate**. The game starts on the big screen.

> **Why HTTPS?** Browsers only give motion-sensor data to secure pages, so the dev server uses HTTPS by default.

### Play from anywhere with a tunnel (no certificate warnings)

```bash
VITE_HTTP=1 PUBLIC_URL=https://<your-tunnel-host> pnpm dev
cloudflared tunnel --url http://localhost:5173      # or ngrok http 5173
```

`PUBLIC_URL` tells the hub which address to put in the QR code.

### Developer shortcuts

| URL                         | What it does                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/?debug=1`                 | Shows an FPS / latency / input overlay, plus a **Play with keyboard** button (arrows or WASD to fly, Shift or Space to boost, Q/E for throttle) |
| `/c/<ROOM>?sim=1`           | Controller with a drag-to-tilt touch pad instead of sensors, so you can test on a desktop browser                                               |
| Chrome DevTools → _Sensors_ | Emulates device orientation on the controller page                                                                                              |

## How to play Sky Tilt

| Phone                               | Plane                                         |
| ----------------------------------- | --------------------------------------------- |
| Tilt like a steering wheel          | Bank left/right (banking turns the plane)     |
| Lean the top edge away / toward you | Nose down / up                                |
| Throttle slider (left thumb)        | Speed                                         |
| **Boost** button (right thumb)      | Burst of speed (refills over time)            |
| ⟳ Recenter                          | Makes the current pose the new "fly straight" |
| ❚❚ Pause                            | Pauses on both screens                        |

Fly through the rings. Each ring scores `100 × combo` and adds 3 seconds to the clock. Hitting the ground or water ends the round, and so does running out of time. On the game-over screen, tap **Play again** on your phone.

Controller settings (⚙️): tilt range (sensitivity), invert pitch or roll, twist-to-steer (gyro rudder), and vibration.

## Repository layout

```
apps/
  server/        Fastify + ws relay: rooms, tokens, message validation, static hosting in production
  web/           Vite multi-page app: hub (index.html) + phone controller (controller.html)
packages/
  protocol/      Shared message types + zod schemas (the wire contract)
  input/         Sensor math: orientation → tilt, calibration, 1€ filter, dead zone, response curve
  game-sdk/      MiniGame interface the hub uses to run any game
games/
  sky-tilt/      The plane game (Three.js): flight model, streaming terrain, ring course, HUD, audio
e2e/             Playwright test: real hub page + emulated phone streaming orientation events
PLAN.md          The original project plan
```

## How the tilt controls work

All of this is in `packages/input`, with unit tests.

1. **Orientation → gravity.** `deviceorientation` gives Euler angles (α, β, γ). From β and γ we compute the world-up vector in the phone's own frame. α (the compass) is ignored, so magnetic interference can't affect steering.
2. **Device → screen frame.** The vector is rotated by `screen.orientation.angle`, so "right" and "up" always mean what the player sees, in any landscape or portrait orientation.
3. **Tilt angles.** Roll is how far the screen's right edge drops below horizontal. Recline is how far the screen leans back from vertical. Both are exact for rotations about the world-horizontal axes, which is how a plane banks and pitches, whatever pose the phone is held in.
4. **Calibration.** The pose at the moment you tap Calibrate becomes neutral. If a browser reports the opposite landscape angle, calibration detects it from gravity and corrects it.
5. **Shaping.** A 1€ filter (smooth when still, responsive when moving) is followed by a ±3° dead zone, a response curve (finer control near the center), and normalisation to −1…1.
6. **Transport.** Processed values are sent at up to 60 Hz, only when they change, plus a 10 Hz heartbeat. The hub always uses the latest sample and re-centres the stick if no input arrives for 500 ms.

The game maps the stick to a **target attitude**. Holding the phone at its calibrated pose always means "fly level".

## Pairing & connection rules

- `POST /api/rooms` creates a room with a 4-character code (no 0/O/1/I/L) plus separate host and controller tokens. The QR code carries the controller token. Guessing a room code alone isn't enough to join.
- The server validates every message with zod and only relays the messages each role is allowed to send. Messages larger than 1 KB, or more than 120 per second, are dropped.
- If the phone locks or drops off Wi-Fi, the game pauses and the QR code comes back. The phone reconnects by itself when unlocked and the game resumes.
- Rooms expire 2 minutes after both sides leave. A room that never gets a controller expires after 30 minutes.

## Adding a new game

1. Create `games/<name>` with a `createGame()` that returns a `MiniGame` (`mount`, `update(dt)`, `restart`, `pause`, `resume`, `unmount`). Read input from `ctx.input()` and report events with `ctx.emit()`.
2. Export metadata: title, card accent, and the controller layout (which buttons to show, and whether to show the throttle).
3. Add one entry in `apps/web/src/hub/registry.ts`.

The hub already handles pairing, pausing, reconnects and haptics.

## Scripts

| Command                                        |                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| `pnpm dev`                                     | Relay server + HTTPS Vite dev server                                           |
| `pnpm build`                                   | Production build of the web app (`apps/web/dist`)                              |
| `pnpm start`                                   | Production server: serves the build + WebSocket relay on `PORT` (default 3000) |
| `pnpm test`                                    | Unit and integration tests (Vitest)                                            |
| `pnpm e2e`                                     | End-to-end tests (Playwright; builds and starts the server itself)             |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` |                                                                                |

## Deploying

The production server is one Node process that serves the built app and the `/ws` relay. Deploy it anywhere that supports WebSockets and terminates HTTPS, such as Fly.io, Render or Railway:

```bash
docker build -t joyconhub .
docker run -p 8080:8080 joyconhub
```

| Env var               | Purpose                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`, `HOST`        | Listen address (production default `0.0.0.0:3000`; the Docker image uses 8080)                                                    |
| `PUBLIC_URL`          | Base URL for QR codes. Needed behind proxies/tunnels if the hub is opened via a different host                                    |
| `TLS_CERT`, `TLS_KEY` | Serve HTTPS directly (e.g. with [mkcert](https://github.com/FiloSottile/mkcert) certificates for LAN play without the dev server) |
| `ALLOWED_ORIGINS`     | Comma-separated origins allowed to create rooms and open sockets                                                                  |

## Browser support

- **Controller:** iOS Safari 13+ (asks for motion permission), Android Chrome. Phones without motion sensors get touch controls. iPhones have no vibration API, so they get a screen flash instead.
- **Hub:** current Chrome, Edge, Firefox or Safari with WebGL.

## Troubleshooting

| Problem                              | Fix                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Phone can't open the QR link         | Phone and computer must share a network (or use a tunnel). Some guest/corporate Wi-Fi blocks device-to-device traffic. |
| "No motion sensors" on the phone     | The page must be HTTPS. Use `pnpm dev`, a tunnel, or `TLS_CERT`/`TLS_KEY`.                                             |
| iPhone never asked for motion access | Settings → Safari → _Motion & Orientation Access_, then reload.                                                        |
| The plane drifts                     | Tap ⟳ Recenter while holding your natural pose; lower sensitivity in ⚙️.                                               |
| Screen doesn't rotate to landscape   | Turn off rotation lock, or tap "Play in portrait".                                                                     |
