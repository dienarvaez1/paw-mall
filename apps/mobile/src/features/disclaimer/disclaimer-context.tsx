import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  DISCLAIMER_STORAGE_KEY,
  type DisclaimerStatus,
  parseDisclaimerAnswer,
  serializeDisclaimerAnswer,
} from './disclaimer';

type DisclaimerContextValue = {
  status: DisclaimerStatus;
  accept: () => void;
  decline: () => void;
};

const DisclaimerContext = createContext<DisclaimerContextValue>({
  status: 'loading',
  accept: () => {},
  decline: () => {},
});

/** The user's answer to the disclaimer, read once at launch and saved on the phone. */
export function DisclaimerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DisclaimerStatus>('loading');

  useEffect(() => {
    AsyncStorage.getItem(DISCLAIMER_STORAGE_KEY)
      .then((raw) => setStatus(parseDisclaimerAnswer(raw)))
      .catch(() => setStatus('pending'));
  }, []);

  const answer = useCallback((value: 'accepted' | 'declined') => {
    setStatus(value);
    // The answer applies for this session even if saving fails.
    AsyncStorage.setItem(DISCLAIMER_STORAGE_KEY, serializeDisclaimerAnswer(value)).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ status, accept: () => answer('accepted'), decline: () => answer('declined') }),
    [status, answer],
  );
  return <DisclaimerContext.Provider value={value}>{children}</DisclaimerContext.Provider>;
}

export function useDisclaimer(): DisclaimerContextValue {
  return useContext(DisclaimerContext);
}
