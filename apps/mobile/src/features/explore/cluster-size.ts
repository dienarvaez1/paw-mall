/** The count's font size in a map cluster. */
export const CLUSTER_FONT_SIZE = 10;

/** Room around the count inside the bubble, in points (both sides together). */
const PADDING = 12;
/** The smallest bubble, for one-digit counts. */
const MIN_SIZE = 22;
/** About how wide a digit (and a separator: "," or ".") is at CLUSTER_FONT_SIZE, semibold. */
const DIGIT_WIDTH = 0.62 * CLUSTER_FONT_SIZE;
const SEPARATOR_WIDTH = 0.32 * CLUSTER_FONT_SIZE;

/**
 * A cluster bubble's diameter for its formatted count ("8", "190", "1,237", "12,276"): just wide
 * enough for every digit and separator plus padding, so a bubble grows with the count and small
 * counts keep small bubbles.
 */
export function clusterSize(label: string): number {
  const digits = label.replace(/\D/g, '').length;
  const separators = label.length - digits;
  return Math.max(
    MIN_SIZE,
    Math.ceil(digits * DIGIT_WIDTH + separators * SEPARATOR_WIDTH + PADDING),
  );
}
