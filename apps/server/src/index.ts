import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';
import { buildApp } from './app.ts';
import { lanAddresses } from './lanAddress.ts';

const here = dirname(fileURLToPath(import.meta.url));
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1');
const publicUrl = process.env.PUBLIC_URL?.replace(/\/$/, '') || null;

const https =
  process.env.TLS_CERT && process.env.TLS_KEY
    ? { cert: readFileSync(process.env.TLS_CERT), key: readFileSync(process.env.TLS_KEY) }
    : undefined;

const { fastify } = await buildApp({
  staticDir: resolve(here, '../../web/dist'),
  publicUrl,
  logger: true,
  https,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
});

await fastify.listen({ port, host });

if (production) {
  const scheme = https ? 'https' : 'http';
  const url = publicUrl ?? `${scheme}://${lanAddresses()[0] ?? 'localhost'}:${port}`;
  console.log(`\n  JoyCon Hub is running → ${url}\n`);
  qrcode.generate(url, { small: true });
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void fastify.close().then(() => process.exit(0));
  });
}
