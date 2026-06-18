import init, {
  Display,
  Options,
  add_c51,
  add_d51,
  add_logo,
  set_panic_hook
} from '../../../libraries/websl/pkg/websl.js';
import wasm from '../../../libraries/websl/pkg/websl_bg.wasm' with { type: 'file' };

type WasmImport = string | WebAssembly.Module | Promise<string | WebAssembly.Module>;
type WasmImportDefault = WasmImport | (() => WasmImport);

const resolveWasmImport = (wasmImport: WasmImportDefault): WasmImport =>
  typeof wasmImport === 'function' ? wasmImport() : wasmImport;

await init(resolveWasmImport(wasm));

export { Display, Options, add_c51, add_d51, add_logo, set_panic_hook };
