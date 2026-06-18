import init, {
  Display,
  Options,
  add_c51,
  add_d51,
  add_logo,
  set_panic_hook
} from '../../../libraries/websl/pkg/websl.js';
import wasm from '../../../libraries/websl/pkg/websl_bg.wasm' with { type: 'file' };

await init(wasm);

export { Display, Options, add_c51, add_d51, add_logo, set_panic_hook };
