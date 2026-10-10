import type {
  ControllerInbound,
  ControllerToHost,
  CreateRoomResponse,
  HostInbound,
  HostToController,
  TransportKind,
} from '@joyconhub/protocol';
import { PeerControllerLink, PeerHostLink, createP2pRoom } from './p2p.ts';
import { RelaySocket, type SocketStatus } from './socket.ts';

export type { SocketStatus };

/** A connection from the hub to its phone, or from the phone to its hub. */
export interface Link<Out> {
  readonly status: SocketStatus;
  /** latest measured round trip in ms */
  readonly rtt: number | null;
  readonly isOpen: boolean;
  send(msg: Out): boolean;
  close(): void;
}

export interface LinkHandlers<In> {
  onMessage(msg: In): void;
  onStatus?(status: SocketStatus, closeCode?: number): void;
}

export interface HostRoom {
  roomCode: string;
  controllerToken: string;
  link: Link<HostToController>;
}

const BUILD_DEFAULT: TransportKind = import.meta.env.VITE_TRANSPORT === 'p2p' ? 'p2p' : 'relay';

/** `?transport=p2p|relay` overrides the build default (handy for testing p2p on the dev server). */
export function hubTransport(): TransportKind {
  const q = new URLSearchParams(location.search).get('transport');
  return q === 'p2p' || q === 'relay' ? q : BUILD_DEFAULT;
}

export class RoomError extends Error {}

export async function createHostRoom(
  kind: TransportKind,
  gameId: string,
  handlers: LinkHandlers<HostInbound>,
): Promise<HostRoom> {
  if (kind === 'p2p') {
    const { roomCode, controllerToken } = createP2pRoom();
    const link = new PeerHostLink(roomCode, controllerToken, handlers);
    return { roomCode, controllerToken, link };
  }
  let room: CreateRoomResponse;
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId }),
    });
    if (!res.ok) {
      throw new RoomError(
        res.status === 429
          ? 'Too many rooms created. Wait a minute and try again.'
          : `Server error (${res.status})`,
      );
    }
    room = (await res.json()) as CreateRoomResponse;
  } catch (e) {
    if (e instanceof RoomError) throw e;
    throw new RoomError('Cannot reach the JoyCon Hub server. Is it running?');
  }
  const link = new RelaySocket<HostInbound, HostToController>({
    role: 'host',
    room: room.roomCode,
    token: room.hostToken,
    ...handlers,
  });
  return { roomCode: room.roomCode, controllerToken: room.controllerToken, link };
}

export function connectController(
  kind: TransportKind,
  room: string,
  token: string,
  handlers: LinkHandlers<ControllerInbound>,
): Link<ControllerToHost> {
  if (kind === 'p2p') return new PeerControllerLink(room, token, handlers);
  return new RelaySocket<ControllerInbound, ControllerToHost>({
    role: 'controller',
    room,
    token,
    ...handlers,
  });
}
