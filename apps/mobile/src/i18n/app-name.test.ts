import { APP_NAME } from '@pet-helper/shared';
import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import esNative from '../../native-locales/es.json';
import enNative from '../../native-locales/en.json';
import { NAMESPACES, resources } from './resources';

/** Every translated string, flattened. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('app name in translations', () => {
  it('is never written out, only inserted as {{appName}}', () => {
    for (const language of Object.values(resources)) {
      for (const text of strings(language)) {
        expect(text).not.toContain(APP_NAME);
      }
    }
  });

  it('reads the same in every language', async () => {
    const i18n = createInstance();
    await i18n.init({
      resources,
      ns: NAMESPACES,
      defaultNS: 'common',
      nsSeparator: '.',
      interpolation: { escapeValue: false, defaultVariables: { appName: APP_NAME } },
    });
    for (const language of Object.keys(resources)) {
      expect(i18n.t('common.appName', { lng: language })).toBe(APP_NAME);
      expect(i18n.t('disclaimer.intro', { lng: language })).toContain(APP_NAME);
    }
  });

  it('is the native name on both platforms in every language', () => {
    for (const native of [esNative, enNative]) {
      expect(native.ios.CFBundleDisplayName).toBe(APP_NAME);
      expect(native.android.app_name).toBe(APP_NAME);
      expect(native.ios.NSLocationWhenInUseUsageDescription).toContain(APP_NAME);
    }
  });
});
