import QRCode from 'qrcode';
import { controllerPath, type ConfigResponse, type TransportKind } from '@joyconhub/protocol';

export interface PairingTarget {
  url: string;
  warning?: string;
}

let configPromise: Promise<ConfigResponse | null> | null = null;

/** LAN addresses from the relay server; absent on static hosting. */
function loadConfig(): Promise<ConfigResponse | null> {
  configPromise ??= fetch('/api/config')
    .then((r) =>
      r.ok && r.headers.get('content-type')?.includes('json')
        ? (r.json() as Promise<ConfigResponse>)
        : null,
    )
    .catch(() => null);
  return configPromise;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Work out the URL the phone should open. It is resolved against this page's URL, so it works
 * from a sub-folder (GitHub Pages). A phone can't reach "localhost", so in local development we
 * swap in the computer's LAN address (or PUBLIC_URL when a tunnel is configured).
 */
export async function pairingTarget(
  transport: TransportKind,
  roomCode: string,
  controllerToken: string,
): Promise<PairingTarget> {
  const path = controllerPath(roomCode, controllerToken, transport);
  const url = new URL(path, location.href);
  let warning: string | undefined;

  if (LOCAL_HOSTS.has(location.hostname)) {
    const cfg = await loadConfig();
    if (cfg?.publicUrl) return { url: new URL(path, cfg.publicUrl + '/').href };
    const lan = cfg?.lanAddresses[0];
    if (lan) url.hostname = lan;
    else
      warning =
        'Could not detect this computer’s network address, so a phone may not be able to open this link. Open the hub using your LAN IP or a public URL instead.';
  }
  if (location.protocol !== 'https:') {
    warning =
      'This page is served over plain HTTP. Phones only share motion sensors with HTTPS pages, so tilt controls will not work. Use the HTTPS dev server, GitHub Pages, or another HTTPS host.';
  }
  return { url: url.href, warning };
}

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f0c1d', light: '#ffffff' },
  });
}
