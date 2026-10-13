import { Image } from 'expo-image';
import { Pressable, Text, useColorScheme, View } from 'react-native';

import { BUTTON_HIT_SLOP } from '@/components/button';
import { ICONS } from '@/components/icons';

const TEAL = { light: '#115e59', dark: '#5eead4' };

/**
 * An action drawn as a link, not a button: a teal icon with its label, no border. Stacked (the
 * icon in a light teal circle, over its label, as in map apps' place sheets), it takes a quarter of a row, so a row of them lines up from the left (a
 * place's Directions, Call, Website, Social media). `inline` puts the icon left of the label, for
 * longer labels ("Reportar maltrato animal"). `compact` (inline only) matches a status pill's
 * height and 12 pt text, to sit beside one ("Horario sin confirmar" · "Ver horario").
 */
export function IconLink({
  icon,
  label,
  onPress,
  accessibilityLabel,
  inline = false,
  compact = false,
}: {
  icon: keyof typeof ICONS;
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  inline?: boolean;
  compact?: boolean;
}) {
  const scheme = useColorScheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={BUTTON_HIT_SLOP}
      className={`rounded-lg active:bg-neutral-100 dark:active:bg-neutral-800 ${
        !inline
          ? 'w-1/4 items-center gap-1 py-1'
          : compact
            ? 'flex-row items-center gap-1 self-start py-0.5 pr-2'
            : 'flex-row items-center gap-2 self-start py-1 pr-2'
      }`}
    >
      {inline ? (
        <Image
          source={ICONS[icon]}
          style={compact ? { width: 14, height: 14 } : { width: 18, height: 18 }}
          tintColor={scheme === 'dark' ? TEAL.dark : TEAL.light}
        />
      ) : (
        <View className="h-10 w-10 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-950">
          <Image
            source={ICONS[icon]}
            style={{ width: 20, height: 20 }}
            tintColor={scheme === 'dark' ? TEAL.dark : TEAL.light}
          />
        </View>
      )}
      <Text
        className="text-center text-xs font-semibold text-teal-800 dark:text-teal-300"
        numberOfLines={inline ? 1 : 2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A row of stacked `IconLink`s, lined up from the left. */
export function IconLinkRow({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap">{children}</View>;
}
