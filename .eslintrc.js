module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ['eslint:recommended', 'plugin:jest/recommended', 'plugin:@typescript-eslint/recommended'],
    overrides: [
        {
            files: ['**/*.ts', '**/*.tsx'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                project: './tsconfig.json',
            },
            plugins: ['@typescript-eslint'],
            rules: {
                '@typescript-eslint/no-unused-vars': ['error', { vars: 'all', args: 'none', ignoreRestSiblings: false }],
            },
        },
        {
            files: ['**/*.js', '**/*.jsx'],
            parser: 'espree',
            rules: {
                '@typescript-eslint/no-unused-vars': 'off',
            },
        },
        {
            env: {
                node: true,
            },
            files: ['.eslintrc.{js,cjs}', '.eslintrc.{ts,cts}'],
            parserOptions: {
                sourceType: 'module',
                project: './tsconfig.json',
            },
        },
        {
            files: ['webpack.config.js'],
            env: {
                node: true,
            },
        },
        {
            files: ['**/*.test.js', '**/*.spec.js', '**/*.test.ts', '**/*.spec.ts'],
            env: {
                jest: true,
            },
        },
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['import', 'jest', '@typescript-eslint'],
    settings: {
        'import/resolver': {
            typescript: {},
        },
    },
    rules: {
        'no-constant-condition': 'off',
        'no-unused-vars': ['error', { vars: 'all', args: 'none', ignoreRestSiblings: false }],
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
                ts: 'never',
                tsx: 'never',
            },
        ],
    },
};
