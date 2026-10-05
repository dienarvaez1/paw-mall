// Reports keys present in the `es` locale files but missing in `en`.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { findMissingKeys } from '../src/i18n/missing-keys.ts';

const localesDir = join(import.meta.dirname, '../src/i18n/locales');

function loadLocale(language: string) {
  const dir = join(localesDir, language);
  return Object.fromEntries(
    readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => [basename(file, '.json'), JSON.parse(readFileSync(join(dir, file), 'utf8'))]),
  );
}

const missing = findMissingKeys(loadLocale('es'), loadLocale('en'));

if (missing.length > 0) {
  console.error(`Missing in en (${missing.length}):`);
  for (const key of missing) {
    console.error(`  ${key}`);
  }
  process.exit(1);
}

console.log('i18n: every es key has an en value.');
