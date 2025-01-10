import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { wasm } from '@rollup/plugin-wasm';
import copy from 'rollup-plugin-copy';

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: 'src/index.jsx',
  jsx: 'react-jsx',
  output: {
    dir: 'lib',
    format: 'esm',
    sourcemap: true
  },
  plugins: [
    wasm(),
    nodeResolve(),
    commonjs(),
    replace({
      preventAssignment: true,
      values: {
        'process.env.NODE_ENV': JSON.stringify('production')
      }
    }),
    copy({
      targets: [{ src: 'index.html', dest: 'lib' }]
    })
  ]
};

export default config;
