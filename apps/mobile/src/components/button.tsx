import { Pressable, Text } from 'react-native';

/**
 * Buttons are drawn 20% smaller than the 44–48 pt touch targets guidelines ask for (owner's
 * choice); this keeps the touchable area at about that size around them.
 */
export const BUTTON_HIT_SLOP = 6;

type Props = {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary';
};

export function Button({ label, onPress, accessibilityLabel, variant = 'primary' }: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={BUTTON_HIT_SLOP}
      className={`min-h-[38px] flex-1 items-center justify-center rounded-xl border px-3 ${
        primary
          ? 'border-paw bg-paw active:bg-paw-dark'
          : 'active:bg-off-pressed border-off-border bg-off-bg dark:bg-off-bg-dark'
      }`}
    >
      <Text
        className={`text-[13px] font-semibold ${
          primary ? 'text-teal-950' : 'text-amber-900 dark:text-amber-200'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
