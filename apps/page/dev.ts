import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const libDir = path.join(root, 'lib');
const indexSrc = path.join(root, 'index.html');
const indexDest = path.join(libDir, 'index.html');
const embedSrc = path.join(root, 'embed.html');
const embedDest = path.join(libDir, 'embed.html');
const faviconSrc = path.join(root, 'favicon.svg');
const faviconDest = path.join(libDir, 'favicon.svg');
const manifestSrc = path.join(root, 'manifest.json');
const manifestDest = path.join(libDir, 'manifest.json');
const PORT = process.env.PORT || '8080';

await mkdir(libDir, { recursive: true });
await copyFile(indexSrc, indexDest);
await copyFile(embedSrc, embedDest);
await copyFile(faviconSrc, faviconDest);
await copyFile(manifestSrc, manifestDest);

const build = Bun.spawn(
  [
    'bun',
    'build',
    './src/index.tsx',
    './src/embed.tsx',
    './src/service-worker.ts',
    '--outdir',
    './lib',
    '--target=browser',
    '--sourcemap',
    '--watch',
    '--public-path',
    './',
    '--define:process.env.NODE_ENV=development'
  ],
  {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit'
  }
);

const server = Bun.spawn(['bunx', 'http-server', './lib', '-p', PORT], {
  cwd: root,
  stdout: 'inherit',
  stderr: 'inherit'
});

const shutdown = () => {
  build.kill();
  server.kill();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await Promise.race([build.exited, server.exited]);
shutdown();
