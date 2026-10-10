import QRCode from 'qrcode';
import { controllerPath, type ConfigResponse } from '@joyconhub/protocol';

export interface PairingTarget {
  url: string;
  warning?: string;
}

let configPromise: Promise<ConfigResponse | null> | null = null;

function loadConfig(): Promise<ConfigResponse | null> {
  configPromise ??= fetch('/api/config')
    .then((r) => (r.ok ? (r.json() as Promise<ConfigResponse>) : null))
    .catch(() => null);
  return configPromise;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Work out the URL the phone should open. A phone can't reach "localhost", so in local development
 * we swap in the computer's LAN address (or PUBLIC_URL when a tunnel is configured).
 */
export async function pairingTarget(
  roomCode: string,
  controllerToken: string,
): Promise<PairingTarget> {
  const cfg = await loadConfig();
  const path = controllerPath(roomCode, controllerToken);
  if (cfg?.publicUrl) return { url: cfg.publicUrl + path };

  let origin = location.origin;
  let warning: string | undefined;
  if (LOCAL_HOSTS.has(location.hostname)) {
    const lan = cfg?.lanAddresses[0];
    if (lan) origin = `${location.protocol}//${lan}${location.port ? ':' + location.port : ''}`;
    else
      warning =
        'Could not detect this computer’s network address, so a phone may not be able to open this link. Set PUBLIC_URL or open the hub using your LAN IP.';
  }
  if (location.protocol !== 'https:') {
    warning =
      'This page is served over plain HTTP. Phones only share motion sensors with HTTPS pages, so tilt controls will not work. Run the dev server (HTTPS by default) or put the hub behind HTTPS.';
  }
  return { url: origin + path, warning };
}

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f0c1d', light: '#ffffff' },
  });
}
