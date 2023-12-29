module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ['eslint:recommended', 'plugin:jest/recommended'],
    overrides: [
        {
            env: {
                node: true,
            },
            files: ['.eslintrc.{js,cjs}'],
            parserOptions: {
                sourceType: 'script',
            },
        },
        {
            files: ['webpack.config.js'],
            env: {
                node: true,
            },
        },
        {
            files: ['**/*.test.js', '**/*.spec.js'],
            env: {
                jest: true,
            },
        },
    ],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['import', 'jest'],
    rules: {
        'no-constant-condition': 'off',
        'import/no-unresolved': 'error',
        'import/named': 'error',
        'import/default': 'error',
        'import/namespace': 'error',
        'import/no-absolute-path': 'error',
        'import/no-duplicates': 'error',
        'import/order': 'error',
        'import/newline-after-import': 'error',
        'import/no-useless-path-segments': 'error',
        'import/no-mutable-exports': 'error',
        'import/no-extraneous-dependencies': 'error',
        'import/no-deprecated': 'warn',
        'import/no-named-as-default': 'error',
        'import/no-named-as-default-member': 'error',
        'import/extensions': [
            'error',
            'always',
            {
                js: 'never',
                jsx: 'never',
            },
        ],
    },
};
