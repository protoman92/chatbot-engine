import commonJs from 'rollup-plugin-commonjs';
import obfuscator from 'rollup-plugin-javascript-obfuscator';
import builtins from 'rollup-plugin-node-builtins';
import globals from 'rollup-plugin-node-globals';
import resolve from 'rollup-plugin-node-resolve';
import sourceMap from 'rollup-plugin-sourcemaps';
import typescript from 'rollup-plugin-typescript2';
import { uglify } from 'rollup-plugin-uglify';
import pkg from './package.json';

function createConfig({ file = 'dist/index.js' }) {
  return {
    input: 'src/index.ts',
    output: {
      format: 'umd',
      file,
      name: 'chatbot-engine',
      globals: { axios: 'axios', redis: 'redis' }
    },
    external: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.peerDependencies || {})
    ],
    plugins: [
      globals(),
      builtins(),
      typescript({
        tsconfigOverride: {
          compilerOptions: {
            target: 'es5',
            module: 'es2015'
          }
        }
      }),
      resolve(),
      commonJs({ include: 'node_modules/**' }),
      sourceMap(),
      obfuscator(),
      uglify()
    ]
  };
}

export default [createConfig({})];
