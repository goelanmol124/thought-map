import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist/**',
    'test-results/**',
    'ThoughtMap/**',
    'ThoughtMapBackups/**',
    // Preserved user-modified WebRTC work (out of inquiry product scope).
    'src/components/WebRTCDebugger.tsx',
    'src/webrtc/**',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Service worker runs in a dedicated worker global scope.
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.serviceworker,
    },
    rules: {
      'no-restricted-globals': 'off',
    },
  },
])
