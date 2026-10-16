import eslint from '@eslint/js';
import globals from 'globals';
import tsEslint from 'typescript-eslint';

export default tsEslint.config(
	{
		ignores: ['*.env', 'build/**', 'dist/**', 'node_modules/**'],
	},
	eslint.configs.recommended,
	...tsEslint.configs.recommended,
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			globals: {
				...globals.node,
			},
			parserOptions: {
				project: './tsconfig.json',
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					args: 'all',
					argsIgnorePattern: '^_',
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
			'@typescript-eslint/no-explicit-any': 'warn',
		},
	}
);
