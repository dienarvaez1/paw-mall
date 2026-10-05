import 'i18next';

import type { resources } from './resources';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    // Keys are written as `t('namespace.key')`, so the namespace separator is a dot too.
    nsSeparator: '.';
    resources: (typeof resources)['es'];
  }
}
