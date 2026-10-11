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
      className={`min-h-12 flex-1 items-center justify-center rounded-xl border px-4 ${
        primary
          ? 'border-paw bg-paw active:bg-paw-dark'
          : 'active:bg-amber-100 border-amber-500 bg-amber-50 dark:bg-amber-950'
      }`}
    >
      <Text
        className={`text-base font-semibold ${
          primary ? 'text-teal-950' : 'text-amber-900 dark:text-amber-200'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
