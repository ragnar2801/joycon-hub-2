import { expect, test, type Page } from '@playwright/test';

interface HubDebug {
  phase(): string;
  input(): {
    roll: number;
    pitch: number;
    throttle: number;
    buttons: Record<string, boolean>;
    connected: boolean;
  };
  controllerConnected(): boolean;
}

const hubState = (hub: Page) =>
  hub.evaluate(() => {
    const d = (window as unknown as { __joyconhub: HubDebug }).__joyconhub;
    return { phase: d.phase(), input: d.input(), connected: d.controllerConnected() };
  });

/** Stream synthetic DeviceOrientationEvents, like a real phone does at ~60 Hz. */
async function startFakeSensors(phone: Page) {
  await phone.evaluate(() => {
    const w = window as unknown as { __tilt: { beta: number; gamma: number } };
    w.__tilt = { beta: 10, gamma: -50 };
    setInterval(() => {
      window.dispatchEvent(
        new DeviceOrientationEvent('deviceorientation', {
          alpha: 0,
          beta: w.__tilt.beta,
          gamma: w.__tilt.gamma,
        }),
      );
    }, 16);
  });
}

const setTilt = (phone: Page, beta: number, gamma: number) =>
  phone.evaluate(
    ([b, g]) => {
      (window as unknown as { __tilt: { beta: number; gamma: number } }).__tilt = {
        beta: b!,
        gamma: g!,
      };
    },
    [beta, gamma],
  );

test('hub home lists games', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your phone is the/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sky Tilt/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Marble Maze/ })).toBeDisabled();
});

test('phone pairs through the QR link and flies the plane', async ({ browser }) => {
  test.setTimeout(120_000);
  const hubCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const hub = await hubCtx.newPage();
  await hub.goto('/?debug=1');
  await hub.getByRole('button', { name: /Sky Tilt/ }).click();

  const link = hub.getByTestId('pair-url');
  await expect(link).toHaveAttribute('href', /\/c\/[A-Z2-9]{4}\?t=/);
  await expect(hub.locator('.qr svg')).toBeVisible();
  const href = new URL((await link.getAttribute('href'))!);

  const phoneCtx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await phoneCtx.newPage();
  await phone.goto(href.pathname + href.search);
  // The token is moved out of the address bar.
  await expect(phone).toHaveURL(/\/c\/[A-Z2-9]{4}$/);
  await startFakeSensors(phone);

  await expect.poll(async () => (await hubState(hub)).connected).toBe(true);
  await expect(hub.getByText('Phone connected: calibrate on your phone')).toBeVisible();

  await phone.getByTestId('start').click();
  await phone.getByTestId('calibrate').click();

  // Calibrating starts the game on the big screen.
  await expect.poll(async () => (await hubState(hub)).phase).toBe('playing');
  await expect(hub.locator('.game-stage canvas')).toBeVisible();
  await expect(hub.getByTestId('st-score')).toHaveText('0');

  // Neutral pose → stick centred.
  await expect.poll(async () => Math.abs((await hubState(hub)).input.roll)).toBeLessThan(0.05);

  // Tilt the phone → the hub receives a strong roll; tilt back the other way → opposite sign.
  await setTilt(phone, -15, -50);
  await expect.poll(async () => Math.abs((await hubState(hub)).input.roll)).toBeGreaterThan(0.5);
  const first = Math.sign((await hubState(hub)).input.roll);
  await setTilt(phone, 35, -50);
  await expect.poll(async () => Math.sign((await hubState(hub)).input.roll)).toBe(-first);
  await setTilt(phone, 10, -50);

  // Boost button → button flag on the hub.
  const boost = phone.getByRole('button', { name: 'Boost' });
  await boost.dispatchEvent('pointerdown', { pointerId: 1 });
  await expect.poll(async () => (await hubState(hub)).input.buttons.boost).toBe(true);
  await boost.dispatchEvent('pointerup', { pointerId: 1 });
  await expect.poll(async () => (await hubState(hub)).input.buttons.boost).toBe(false);

  // Pause and resume from the phone.
  await phone.getByRole('button', { name: /Pause/ }).click();
  await expect.poll(async () => (await hubState(hub)).phase).toBe('paused');
  await expect(hub.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await phone.getByTestId('resume').click();
  await expect.poll(async () => (await hubState(hub)).phase).toBe('playing');

  // Dive into the ground → game over on both screens → "Play again" from the phone.
  let dived = false;
  for (const [b, g] of [
    [10, -85],
    [10, -15],
  ] as const) {
    await setTilt(phone, b, g);
    await phone.waitForTimeout(400);
    if ((await hubState(hub)).input.pitch < -0.5) {
      dived = true;
      break;
    }
  }
  expect(dived).toBe(true);
  await expect.poll(async () => (await hubState(hub)).phase, { timeout: 45_000 }).toBe('gameover');
  await expect(phone.getByRole('heading', { name: 'Game over' })).toBeVisible();
  await setTilt(phone, 10, -50);
  await phone.getByTestId('play-again').click();
  await expect.poll(async () => (await hubState(hub)).phase).toBe('playing');
  await expect(phone.getByRole('heading', { name: 'Game over' })).toBeHidden();

  // Losing the phone pauses the game and shows the QR code again.
  await phoneCtx.close();
  await expect.poll(async () => (await hubState(hub)).phase).toBe('paused');
  await expect(hub.getByRole('heading', { name: 'Phone disconnected' })).toBeVisible();
  await expect(hub.locator('.overlay .qr svg')).toBeVisible();

  await hubCtx.close();
});

test('controller without credentials explains what to do', async ({ page }) => {
  await page.goto('/c');
  await expect(page.getByRole('heading', { name: 'Scan the QR code' })).toBeVisible();
});

test('controller with an expired room says so', async ({ page }) => {
  await page.goto('/c/ABCD?t=nope');
  await expect(page.getByRole('heading', { name: 'Game session ended' })).toBeVisible();
});
