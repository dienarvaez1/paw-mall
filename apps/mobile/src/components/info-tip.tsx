import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';

import { ICONS } from '@/components/icons';
import { useAppTranslation } from '@/i18n/use-app-translation';

/** As the share icon above it on a place's page (owner's rule: same size). */
const ICON_SIZE = 20;
const TIP_WIDTH = 260;
/** pink-500 (owner's choice for the call-first notice, 2026-10-15). */
export const PINK_INFO = '#ec4899';

/**
 * An ⓘ that shows its message in a tooltip under it. Phones have no hover, so a tap opens the
 * tooltip and a tap anywhere closes it; screen readers read the message as the icon's label.
 */
export function InfoTip({
  message,
  color = PINK_INFO,
  testID,
}: {
  message: string;
  color?: string;
  testID?: string;
}) {
  const { t } = useAppTranslation();
  const icon = useRef<View>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const { width } = useWindowDimensions();
  const open = () =>
    icon.current?.measureInWindow((x, y, w, h) => setAnchor({ x: x + w, y: y + h }));
  return (
    <>
      <Pressable
        ref={icon}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={message}
        onPress={open}
        hitSlop={10}
        className="p-1"
      >
        <Image
          source={ICONS.info}
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
          tintColor={color}
        />
      </Pressable>
      <Modal
        transparent
        visible={anchor !== null}
        animationType="fade"
        onRequestClose={() => setAnchor(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => setAnchor(null)}
          style={{ flex: 1 }}
        >
          {anchor ? (
            <View
              testID={testID ? `${testID}-text` : undefined}
              style={{
                position: 'absolute',
                top: anchor.y + 6,
                left: Math.max(12, Math.min(anchor.x - TIP_WIDTH, width - TIP_WIDTH - 12)),
                width: TIP_WIDTH,
                borderColor: color,
              }}
              className="rounded-xl border bg-white p-3 shadow-lg dark:bg-neutral-900"
            >
              <Text className="text-sm leading-5 text-neutral-800 dark:text-neutral-200">
                {message}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}
