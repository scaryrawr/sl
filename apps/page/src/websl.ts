/**
 * WebAssembly bridge module for the SL train animation.
 *
 * Loads and initializes the Rust-compiled WASM module (`websl`) and re-exports
 * the types and functions needed by the Preact components. Callers should import
 * this module (which performs an eager `init()`) and then use the exported
 * `Display`, `Train`, and `set_panic_hook`.
 *
 * @module websl
 */
import init from '../../../libraries/websl/pkg/websl.js';
import wasm from '../../../libraries/websl/pkg/websl_bg.wasm' with { type: 'file' };

/**
 * Possible shapes for the WASM import value passed to `init()`.
 * Can be a path string, a pre-instantiated `WebAssembly.Module`, or a promise resolving to either.
 */
type WasmImport = string | WebAssembly.Module | Promise<string | WebAssembly.Module>;

/**
 * A `WasmImport` or a lazy function that returns one.
 * Used so callers can defer resolving the WASM asset until init time.
 */
type WasmImportDefault = WasmImport | (() => WasmImport);

/**
 * Resolve a lazy WASM import function to its concrete value.
 *
 * @param wasmImport - Direct value or function returning the value.
 * @returns Resolved WASM import.
 */
/** Whether a `WasmImportDefault` defers its value behind a lazy function. */
const isLazyWasmImport = (wasmImport: WasmImportDefault): wasmImport is () => WasmImport =>
  typeof wasmImport === 'function';

/**
 * Resolve a lazy WASM import function to its concrete value.
 *
 * @param wasmImport - Direct value or function returning the value.
 * @returns Resolved WASM import.
 */
const resolveWasmImport = (wasmImport: WasmImportDefault): WasmImport =>
  isLazyWasmImport(wasmImport) ? wasmImport() : wasmImport;

// Initialize the WASM module eagerly when this module is imported
await init(resolveWasmImport(wasm));

export { Display, set_panic_hook, Train } from '../../../libraries/websl/pkg/websl.js';
