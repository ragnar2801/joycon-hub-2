export const PORT = Number(process.env.E2E_PORT ?? 4317);
export const PEER_PORT = Number(process.env.E2E_PEER_PORT ?? 9011);
export const STATIC_PORT = Number(process.env.E2E_STATIC_PORT ?? 4400);

export const RELAY_BASE = `http://localhost:${PORT}/`;
/** Same sub-folder layout as a GitHub Pages project site. */
export const STATIC_BASE = `http://localhost:${STATIC_PORT}/Joyconhub/`;
