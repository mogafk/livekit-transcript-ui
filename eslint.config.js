import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/', '**/node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['ui/src/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['server/**', 'scripts/**', '*.js', 'ui/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // TypeScript checks undefined names itself, including DOM types like ScrollBehavior.
    files: ['**/*.ts', '**/*.vue'],
    rules: { 'no-undef': 'off' },
  },
  prettier,
)
