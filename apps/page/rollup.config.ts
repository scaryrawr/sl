import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import { wasm } from '@rollup/plugin-wasm';
import type { RollupOptions } from 'rollup';
import copy from 'rollup-plugin-copy';
import { visualizer } from 'rollup-plugin-visualizer';

const config: RollupOptions = {
  input: 'src/index.tsx',
  output: {
    dir: 'lib',
    format: 'esm',
    sourcemap: true,
    compact: true
  },
  plugins: [
    wasm(),
    typescript({
      tsconfig: './tsconfig.json'
    }),
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
