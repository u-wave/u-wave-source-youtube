module.exports = (api) => {
  // TODO configure this maybe
  api.cache.never();

  return {
    plugins: [
      process.env.BABEL_ENV !== 'rollup' && '@babel/plugin-transform-modules-commonjs',
      '@babel/plugin-syntax-object-rest-spread',
    ].filter(Boolean),
  };
};
