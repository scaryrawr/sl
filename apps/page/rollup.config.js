import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import { wasm } from '@rollup/plugin-wasm';
import copy from 'rollup-plugin-copy';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
  input: 'src/index.jsx',
  jsx: 'react-jsx',
  output: {
    dir: 'lib',
    format: 'esm',
    sourcemap: true,
    compact: true
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
    }),
    terser({
      compress: {
        dead_code: true,
        unused: true,
        drop_console: true,
        passes: 3,
        toplevel: true
      },
      mangle: {
        toplevel: true
      },
      format: {
        comments: false
      }
    }),
    ...(process.env.ANALYZE_BUNDLE
      ? [
          visualizer({
            filename: 'lib/bundle-analysis.html',
            open: true,
            gzipSize: true,
            brotliSize: true
          })
        ]
      : [])
  ]
};

export default config;
