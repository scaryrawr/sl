import init, { Display, add_c51, add_d51, add_logo, set_panic_hook, Options } from './pkg/websl.js';
import wasm from './pkg/websl_bg.wasm';

await init(await wasm());

export { Display, add_c51, add_d51, add_logo, set_panic_hook, Options };
