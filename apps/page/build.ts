#!/usr/bin/env bun
import { copyFile, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const libDir = path.join(root, 'lib');

// Step 1: Build the main entry points (index.tsx and embed.tsx)
// This generates the WASM file with a content hash
console.log('Building main entry points...');
const mainBuild = Bun.spawn(
  [
    'bun',
    'build',
    './src/index.tsx',
    './src/embed.tsx',
    '--outdir',
    './lib',
    '--target=browser',
    '--sourcemap',
    '--minify',
    '--public-path',
    './',
    '--define:process.env.NODE_ENV=production'
  ],
  {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit'
  }
);

await mainBuild.exited;

if (mainBuild.exitCode !== 0) {
  console.error('Main build failed');
  process.exit(1);
}

// Step 2: Find the generated WASM file
console.log('Finding WASM file...');
const files = await readdir(libDir);
const wasmFile = files.find((file) => file.endsWith('.wasm'));

if (!wasmFile) {
  console.error('No WASM file found in lib directory');
  process.exit(1);
}

console.log(`Found WASM file: ${wasmFile}`);

// Step 3: Read the service worker source, inject the WASM filename, and write to a temp file
const serviceWorkerSrc = path.join(root, 'src', 'service-worker.ts');
const serviceWorkerTemp = path.join(root, 'src', 'service-worker.tmp.ts');

let serviceWorkerContent = await readFile(serviceWorkerSrc, 'utf-8');

// Replace the placeholder with the actual WASM filename
serviceWorkerContent = serviceWorkerContent.replace(
  '// WASM_PLACEHOLDER - will be replaced at build time',
  `\`\${BASE_PATH}/${wasmFile}\`,`
);

await writeFile(serviceWorkerTemp, serviceWorkerContent);

// Step 4: Build the service worker with the injected filename
console.log('Building service worker...');
const swBuild = Bun.spawn(
  [
    'bun',
    'build',
    serviceWorkerTemp,
    '--outdir',
    './lib',
    '--target=browser',
    '--sourcemap',
    '--minify',
    '--define:process.env.NODE_ENV=production'
  ],
  {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit'
  }
);

await swBuild.exited;

if (swBuild.exitCode !== 0) {
  console.error('Service worker build failed');
  process.exit(1);
}

// Step 5: Rename the output file from service-worker.tmp.js to service-worker.js
const swTempOutput = path.join(libDir, 'service-worker.tmp.js');
const swFinalOutput = path.join(libDir, 'service-worker.js');
const swTempMap = path.join(libDir, 'service-worker.tmp.js.map');
const swFinalMap = path.join(libDir, 'service-worker.js.map');

await copyFile(swTempOutput, swFinalOutput);
await copyFile(swTempMap, swFinalMap);

// Clean up temp files
await unlink(serviceWorkerTemp);
await unlink(swTempOutput);
await unlink(swTempMap);

// Step 6: Copy static files
console.log('Copying static files...');
await copyFile(path.join(root, 'index.html'), path.join(libDir, 'index.html'));
await copyFile(path.join(root, 'embed.html'), path.join(libDir, 'embed.html'));
await copyFile(path.join(root, 'favicon.svg'), path.join(libDir, 'favicon.svg'));
await copyFile(path.join(root, 'manifest.json'), path.join(libDir, 'manifest.json'));

console.log('Build complete!');
