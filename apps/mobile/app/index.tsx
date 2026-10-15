import { Redirect } from 'expo-router';

import { useDisclaimer } from '@/features/disclaimer/disclaimer-context';

/** The first screen: the disclaimer until it's answered, then Explorar (or Urgencias if declined). */
export default function Index() {
  const { status } = useDisclaimer();
  if (status === 'loading') return null;
  if (status === 'pending') return <Redirect href="/disclaimer" />;
  return <Redirect href={status === 'accepted' ? '/explore' : '/urgent'} />;
}
