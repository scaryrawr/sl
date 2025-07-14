import init, { Options, add_c51, add_d51, add_logo, set_panic_hook } from './pkg/websl.js';
import wasm from './pkg/websl_bg.wasm';

await init(await wasm());

export { Options, add_c51, add_d51, add_logo, set_panic_hook };
