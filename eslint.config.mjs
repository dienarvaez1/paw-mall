import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Shared base for packages without their own config. apps/mobile extends Expo's config instead.
export default tseslint.config(
  { ignores: ['**/node_modules/', '**/dist/', '**/.wrangler/', '**/.turbo/', 'apps/mobile/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
