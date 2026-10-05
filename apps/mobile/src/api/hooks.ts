import { healthResponseSchema } from '@paw-mall/shared';
import { useQuery } from '@tanstack/react-query';

import { useLocale } from '@/i18n/use-locale';

import { apiGet } from './client';

export function useHealth() {
  const locale = useLocale();
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet('/health', {}, locale, healthResponseSchema),
  });
}
