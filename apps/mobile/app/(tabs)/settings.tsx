import { SUPPORTED_LOCALES } from '@paw-mall/shared';
import Constants from 'expo-constants';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { RADIUS_OPTIONS, toKm } from '@/features/settings/radius';
import { UNIT_OPTIONS, useSettings } from '@/features/settings/settings-context';
import { setLanguage } from '@/i18n';
import { formatDistance } from '@/i18n/format';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';

const CHECK_GLYPH = '✓';

export default function SettingsScreen() {
  const { t } = useAppTranslation();
  const locale = useLocale();
  const settings = useSettings();

  return (
    <ScrollView
      className="flex-1 bg-neutral-50 dark:bg-neutral-950"
      contentContainerClassName="pb-10"
    >
      <Section title={t('settings.language')}>
        {SUPPORTED_LOCALES.map((code) => (
          <Option
            key={code}
            label={t(`common.language.${code}`)}
            selected={locale === code}
            onPress={() => void setLanguage(code)}
          />
        ))}
      </Section>

      <Section title={t('settings.searchRadius')} hint={t('settings.searchRadiusHint')}>
        {RADIUS_OPTIONS[settings.units].map((value) => {
          // Shown in the selected unit; stored and sent to the API in km.
          const km = toKm(value, settings.units);
          return (
            <Option
              key={`${settings.units}-${value}`}
              label={formatDistance(km, locale, settings.units)}
              selected={Math.abs(settings.radiusKm - km) < 1e-6}
              onPress={() => settings.setRadiusKm(km)}
            />
          );
        })}
      </Section>

      <Section title={t('settings.units')}>
        {UNIT_OPTIONS.map((unit) => (
          <Option
            key={unit}
            label={t(`settings.unit.${unit}`)}
            selected={settings.units === unit}
            onPress={() => settings.setUnits(unit)}
          />
        ))}
      </Section>

      <Section title={t('settings.placesTitle')}>
        <SwitchRow
          label={t('settings.onlyWithPhone')}
          hint={t('settings.onlyWithPhoneHint')}
          value={settings.onlyWithPhone}
          onChange={settings.setOnlyWithPhone}
        />
        <SwitchRow
          label={t('settings.onlyWithWebsite')}
          hint={t('settings.onlyWithWebsiteHint')}
          value={settings.onlyWithWebsite}
          onChange={settings.setOnlyWithWebsite}
        />
        <SwitchRow
          label={t('settings.onlyWithSocial')}
          hint={t('settings.onlyWithSocialHint')}
          value={settings.onlyWithSocial}
          onChange={settings.setOnlyWithSocial}
        />
        <SwitchRow
          label={t('settings.hideUnnamed')}
          hint={t('settings.hideUnnamedHint')}
          value={settings.hideUnnamed}
          onChange={settings.setHideUnnamed}
        />
        <SwitchRow
          label={t('settings.onlyOpenNow')}
          hint={t('settings.onlyOpenNowHint')}
          value={settings.onlyOpenNow}
          onChange={settings.setOnlyOpenNow}
        />
      </Section>

      <Section title={t('settings.about')}>
        <Text className="px-4 py-3 text-sm text-neutral-500 dark:text-neutral-400">
          {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
        </Text>
        <Text className="px-4 pb-3 text-sm text-neutral-500 dark:text-neutral-400">
          {t('settings.dataSources')}
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View className="pt-6">
      <Text
        accessibilityRole="header"
        className="px-4 pb-1 text-sm font-semibold uppercase text-neutral-500 dark:text-neutral-400"
      >
        {title}
      </Text>
      {hint ? (
        <Text className="px-4 pb-2 text-sm text-neutral-500 dark:text-neutral-400">{hint}</Text>
      ) : null}
      <View className="border-y border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        {children}
      </View>
    </View>
  );
}

function SwitchRow(props: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View className="min-h-12 flex-row items-center justify-between gap-3 px-4 py-2">
      <View className="flex-1">
        <Text className="text-base text-neutral-900 dark:text-white">{props.label}</Text>
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">{props.hint}</Text>
      </View>
      <Switch
        value={props.value}
        onValueChange={props.onChange}
        accessibilityLabel={props.label}
        trackColor={{ true: '#0f766e' }}
      />
    </View>
  );
}

function Option({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className="min-h-12 flex-row items-center justify-between px-4 active:bg-neutral-100 dark:active:bg-neutral-800"
    >
      <Text className="text-base text-neutral-900 dark:text-white">{label}</Text>
      {selected ? (
        <Text className="text-lg font-bold text-teal-700 dark:text-teal-400">{CHECK_GLYPH}</Text>
      ) : null}
    </Pressable>
  );
}
