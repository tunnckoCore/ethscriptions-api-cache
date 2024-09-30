/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/no-extraneous-dependencies */

const config = require('eslint-config-tunnckocore');

module.exports = {
  ...config.eslintConfig,
  rules: {
    ...config.eslintConfig.rules,
    '@typescript-eslint/triple-slash-reference': 'off',
    'unicorn/no-null': 'off',
    'unicorn/prevent-abbreviations': 'off',
    'import/no-unresolved': ['error', { ignore: ['^astro:*'] }],
    'import/prefer-default-export': 'off',
    'unicorn/no-await-expression-member': 'off',
    'unicorn/no-useless-spread': 'off', // useless rule
    'unicorn/prefer-switch': 'off', // fvck off
    // 'no-explicit-any': 'warn',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'off',
    'no-use-before-define': [
      'error',
      {
        functions: false,
        classes: true,
        variables: true,
        allowNamedExports: false,
      },
    ],
  },
};
