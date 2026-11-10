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
  /** Render a C51-class steam locomotive on the display. */
  add_c51,
  /** Render a D51-class steam locomotive on the display. */
  add_d51,
  /** Render the small logo train on the display. */
  add_logo,
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
  /** Install a Rust panic hook so panics print readable messages to the console. */
  set_panic_hook,
  /**
   * Per-train smoke particle state. Create one `Smoke` per animated train and
   * pass the same instance to every frame of that train's render calls so
   * simultaneous trains never share smoke particles.
   */
  Smoke
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

export { add_c51, add_d51, add_logo, Display, Options, set_panic_hook, Smoke };
