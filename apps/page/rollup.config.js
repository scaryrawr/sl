import { nodeResolve } from '@rollup/plugin-node-resolve';
import { wasm } from '@rollup/plugin-wasm';
import copy from 'rollup-plugin-copy';

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: 'src/index.jsx',
  output: {
    dir: 'lib',
    format: 'esm',
    sourcemap: true
  },
  plugins: [
    wasm(),
    nodeResolve(),
    copy({
      targets: [{ src: 'index.html', dest: 'lib' }]
    })
  ]
};

export default config;
