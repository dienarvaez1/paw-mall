import { Pressable, Text } from 'react-native';

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
      className={`min-h-12 flex-1 items-center justify-center rounded-xl px-4 ${
        primary
          ? 'bg-paw active:bg-paw-dark'
          : 'bg-neutral-100 active:bg-neutral-200 dark:bg-neutral-800'
      }`}
    >
      <Text
        className={`text-base font-semibold ${
          primary ? 'text-teal-950' : 'text-neutral-900 dark:text-white'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
