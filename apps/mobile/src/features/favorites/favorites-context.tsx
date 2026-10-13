import AsyncStorage from '@react-native-async-storage/async-storage';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { type Favorite, parseFavorites, toggleFavorite } from './favorites';

const STORAGE_KEY = 'favorites.places';

type FavoritesContextValue = {
  /** Newest first. */
  favorites: Favorite[];
  isFavorite: (id: number) => boolean;
  toggle: (id: number) => void;
};

const FavoritesContext = createContext<FavoritesContextValue>({
  favorites: [],
  isFavorite: () => false,
  toggle: () => {},
});

/** Favoritos: saved places, kept on this phone only (no login). */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setFavorites(parseFavorites(raw)))
      .catch(() => {});
  }, []);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      isFavorite: (id) => favorites.some((item) => item.id === id),
      toggle: (id) =>
        setFavorites((current) => {
          const next = toggleFavorite(current, id, Date.now());
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
          return next;
        }),
    }),
    [favorites],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  return useContext(FavoritesContext);
}
