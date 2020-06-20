import typescript from 'rollup-plugin-typescript2';
import nodeResolve from '@rollup/plugin-node-resolve';
import isBuiltinModule from 'is-builtin-module';

const pkg = require('./package.json');
const paths = pkg.exports['.'][0];

const external = Object.keys(pkg.dependencies);

process.env.BABEL_ENV = 'rollup';

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
