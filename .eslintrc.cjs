module.exports = {
  extends: 'airbnb-base',
  parserOptions: {
    ecmaVersion: 2020,
  },
  overrides: [
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended',
      ],
      rules: {
        'import/extensions': ['error', 'never'],
      },
      settings: {
        'import/extensions': ['.js', '.ts'],
        'import/resolver': {
          node: {
            extensions: ['.js', '.ts'],
          },
        },
      },
    },
    {
      files: ['.eslintrc.cjs', 'test/*.js'],
      env: {
        node: true,
      },
    },
  ],
};
