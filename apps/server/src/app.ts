import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import {
  CreateRoomRequest,
  type ConfigResponse,
  type CreateRoomResponse,
} from '@joyconhub/protocol';
import { lanAddresses } from './lanAddress.ts';
import { RateLimiter } from './rateLimit.ts';
import { createRelay } from './relay.ts';
import { RoomRegistry } from './rooms.ts';

export interface AppOptions {
  /** directory with the built web app; static hosting is skipped if missing */
  staticDir?: string;
  publicUrl?: string | null;
  registry?: RoomRegistry;
  logger?: boolean;
  https?: { key: Buffer; cert: Buffer };
  /** allowed values of the WebSocket/HTTP Origin header; empty = allow all */
  allowedOrigins?: string[];
}

export interface App {
  fastify: FastifyInstance;
  registry: RoomRegistry;
}

export async function buildApp(opts: AppOptions = {}): Promise<App> {
  const fastify = Fastify({
    logger: opts.logger ?? false,
    trustProxy: true,
    ...(opts.https ? { https: opts.https } : {}),
  }) as unknown as FastifyInstance;
  const registry = opts.registry ?? new RoomRegistry();
  const roomLimiter = new RateLimiter(30, 60_000);
  const origins = opts.allowedOrigins ?? [];
  const originOk = (origin: string | undefined) =>
    origins.length === 0 || !origin || origins.includes(origin);

  fastify.get('/api/health', async () => ({ ok: true, rooms: registry.size }));

  fastify.get('/api/config', async (): Promise<ConfigResponse> => ({
    publicUrl: opts.publicUrl ?? null,
    lanAddresses: lanAddresses(),
  }));

  fastify.post('/api/rooms', async (req, reply) => {
    if (!originOk(req.headers.origin)) return reply.code(403).send({ error: 'origin not allowed' });
    if (!roomLimiter.allow(req.ip))
      return reply.code(429).send({ error: 'too many rooms, slow down' });
    const body = CreateRoomRequest.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'gameId required' });
    const room = registry.create(body.data.gameId);
    const res: CreateRoomResponse = {
      roomCode: room.code,
      hostToken: room.hostToken,
      controllerToken: room.controllerToken,
    };
    return reply.code(201).send(res);
  });

  if (opts.staticDir && existsSync(opts.staticDir)) {
    await fastify.register(fastifyStatic, { root: opts.staticDir, index: 'index.html' });
  }

  const relay = createRelay(registry, fastify.log);
  fastify.server.on('upgrade', (req, socket, head) => {
    if (!originOk(req.headers.origin)) {
      socket.destroy();
      return;
    }
    relay.handleUpgrade(req, socket, head);
  });

  const sweeper = setInterval(() => {
    const removed = registry.sweep();
    if (removed.length) fastify.log.info({ removed }, 'rooms expired');
  }, 30_000);
  sweeper.unref();

  fastify.addHook('onClose', async () => {
    clearInterval(sweeper);
    relay.close();
  });

  return { fastify, registry };
}
