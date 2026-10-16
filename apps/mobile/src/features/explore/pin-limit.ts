import { MAP_DEFAULT_PINS, MAP_PIN_LIMITS } from '@pet-helper/shared';

/** The map's pin button: the next preset, back to the smallest after the largest. */
export function nextPinLimit(current: number): number {
  const index = (MAP_PIN_LIMITS as readonly number[]).indexOf(current);
  if (index === -1) return MAP_DEFAULT_PINS;
  return MAP_PIN_LIMITS[(index + 1) % MAP_PIN_LIMITS.length] ?? MAP_DEFAULT_PINS;
}
