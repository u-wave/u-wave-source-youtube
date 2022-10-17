import fs from 'fs';
import typescript from 'rollup-plugin-typescript2';
import nodeResolve from '@rollup/plugin-node-resolve';
import isBuiltinModule from 'is-builtin-module';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

const paths = pkg.exports['.'][0];
const external = Object.keys(pkg.dependencies);

export default {
  input: 'src/index.ts',
  output: [{
    file: paths.default,
    exports: 'named',
    format: 'cjs',
    sourcemap: true,
  }, {
    file: paths.import,
    format: 'esm',
    sourcemap: true,
  }],
  external: (id) => isBuiltinModule(id) || external.some((m) => id.split('/')[0] === m),
  plugins: [
    typescript(),
    nodeResolve(),
  ],
};
