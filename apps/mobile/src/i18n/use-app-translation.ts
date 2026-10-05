import { useTranslation } from 'react-i18next';

import { NAMESPACES } from './resources';

/**
 * `useTranslation` with every namespace loaded, so keys are written as
 * `t('namespace.key')` and checked against the `es` files at compile time.
 */
export function useAppTranslation() {
  return useTranslation(NAMESPACES);
}
