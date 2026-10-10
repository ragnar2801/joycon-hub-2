// Local PeerJS signalling server for end-to-end tests of the p2p (GitHub Pages) transport.
import { PeerServer } from 'peer';

const port = Number(process.env.PEER_PORT ?? 9011);
PeerServer({ port, host: '127.0.0.1', path: '/' }, () =>
  console.log(`PeerJS signalling server on :${port}`),
);
