/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'p2p' for static hosting (GitHub Pages); anything else uses the WebSocket relay server */
  readonly VITE_TRANSPORT?: string;
  /** custom PeerJS signalling server (defaults to the free PeerJS cloud server) */
  readonly VITE_PEER_HOST?: string;
  readonly VITE_PEER_PORT?: string;
  readonly VITE_PEER_PATH?: string;
  /** '0' for a plain-http signalling server (local testing) */
  readonly VITE_PEER_SECURE?: string;
}
