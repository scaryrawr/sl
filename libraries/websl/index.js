import init, { Display, Options, add_c51, add_d51, add_logo, set_panic_hook } from './pkg/websl.js';
import wasm from './pkg/websl_bg.wasm';

// Bun’s bundler returns wasm imports as a URL string, while other bundlers (or raw
// wasm-bindgen output) return a function that resolves the compiled module. Handle
// either shape so runtime doesn’t explode on a non-function default export.
const wasmModuleOrPath = typeof wasm === 'function' ? wasm() : wasm;

await init(await wasmModuleOrPath);

export { Display, Options, add_c51, add_d51, add_logo, set_panic_hook };
