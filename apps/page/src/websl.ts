/**
 * WebAssembly bridge module for the SL train animation.
 *
 * Loads and initializes the Rust-compiled WASM module (`websl`) and re-exports
 * the types and functions needed by the Preact components. Callers should import
 * this module (which performs an eager `init()`) and then use the exported
 * `Display`, `Options`, train-add functions, and `set_panic_hook`.
 *
 * @module websl
 */
import init, {
  /**
   * Backing store for the terminal grid. Holds character dimensions and the
   * callback that paints a string at a given `(y, x)` coordinate.
   *
   * @example
   * ```ts
   * const display = new sl.Display(cols, rows, (y, x, str) => {
   *   // paint `str` at row `y`, column `x`
   * });
   * ```
   */
  Display,

  /**
   * Configuration flags for the train animation: accident mode, flying mode,
   * and smoke rendering.
   */
  Options,

  /** Render a C51-class steam locomotive on the display. */
  add_c51,

  /** Render a D51-class steam locomotive on the display. */
  add_d51,

  /** Render the small logo train on the display. */
  add_logo,

  /** Install a Rust panic hook so panics print readable messages to the console. */
  set_panic_hook
} from '../../../libraries/websl/pkg/websl.js';
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
const resolveWasmImport = (wasmImport: WasmImportDefault): WasmImport =>
  typeof wasmImport === 'function' ? wasmImport() : wasmImport;

// Initialize the WASM module eagerly when this module is imported
await init(resolveWasmImport(wasm));

export { Display, Options, add_c51, add_d51, add_logo, set_panic_hook };
