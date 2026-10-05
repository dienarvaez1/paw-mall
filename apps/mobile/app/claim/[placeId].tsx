import { placeClaimSchema, receivedResponseSchema } from '@paw-mall/shared';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { apiPost } from '@/api/client';
import { usePlace } from '@/api/hooks';
import { Button } from '@/components/button';
import { usePlaceName } from '@/components/place-row';
import { ErrorState } from '@/components/states';
import {
  type DayRange,
  EMPTY_HOURS,
  type HoursForm,
  buildHours,
} from '@/features/claims/claim-hours';
import { useAppTranslation } from '@/i18n/use-app-translation';
import { useLocale } from '@/i18n/use-locale';

const INPUT =
  'min-h-12 rounded-xl bg-neutral-100 px-3 text-base text-neutral-900 dark:bg-neutral-900 dark:text-white';

/**
 * "¿Eres el dueño?": the owner sends the details to publish and a contact for the review. Vets can
 * also say they're open 24 hours and take emergencies. (The SAT certificate check is deferred.)
 */
export default function ClaimScreen() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const { t } = useAppTranslation();
  const locale = useLocale();
  const place = usePlace(Number(placeId));
  const placeName = usePlaceName({ name: place.data?.name ?? null });
  const isVet = (place.data?.categories ?? []).some((c) =>
    ['veterinarian', 'vet_hospital', 'public_vet_service'].includes(c.slug),
  );
  const [open24h, setOpen24h] = useState(false);
  const [acceptsEmergencies, setAcceptsEmergencies] = useState(false);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [hours, setHours] = useState<HoursForm>(EMPTY_HOURS);
  const [contactName, setContactName] = useState('');
  const [contact, setContact] = useState('');
  const [consent, setConsent] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const submit = useMutation({
    mutationFn: (claim: unknown) =>
      apiPost(`/v1/places/${placeId}/claims`, claim, locale, receivedResponseSchema),
  });

  function send() {
    const parsed = placeClaimSchema.safeParse({
      phone: phone.trim() || undefined,
      website: website.trim() ? withScheme(website.trim()) : undefined,
      hours: open24h ? undefined : buildHours(hours),
      open24h: isVet && open24h ? true : undefined,
      acceptsEmergencies: isVet && acceptsEmergencies ? true : undefined,
      contactName,
      contact,
      consent,
    });
    setInvalid(!parsed.success);
    if (parsed.success) submit.mutate(parsed.data);
  }

  if (submit.isSuccess) {
    return (
      <View className="flex-1 bg-white p-6 dark:bg-neutral-950">
        <Text className="text-base leading-6 text-neutral-800 dark:text-neutral-200">
          {t('places.claim.thanks')}
        </Text>
      </View>
    );
  }

  const setDay = (key: keyof HoursForm) => (range: DayRange) =>
    setHours({ ...hours, [key]: range });

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white dark:bg-neutral-950"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerClassName="gap-6 p-4 pb-16" keyboardShouldPersistTaps="handled">
        {place.data ? (
          <Text className="text-xl font-bold text-neutral-900 dark:text-white">{placeName}</Text>
        ) : null}
        <Text className="text-base leading-6 text-neutral-700 dark:text-neutral-300">
          {t('places.claim.intro')}
        </Text>

        <Section title={t('places.claim.storeSection')}>
          <Field label={t('places.claim.phone')}>
            <TextInput
              className={INPUT}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              accessibilityLabel={t('places.claim.phone')}
            />
          </Field>
          <Field label={t('places.claim.website')}>
            <TextInput
              className={INPUT}
              value={website}
              onChangeText={setWebsite}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('places.claim.website')}
            />
          </Field>
        </Section>

        {isVet ? (
          <Section title={t('places.claim.vetSection')}>
            <SwitchRow label={t('places.claim.open24h')} value={open24h} onChange={setOpen24h} />
            <SwitchRow
              label={t('places.claim.acceptsEmergencies')}
              value={acceptsEmergencies}
              onChange={setAcceptsEmergencies}
            />
          </Section>
        ) : null}

        {open24h ? null : (
          <Section title={t('places.claim.hoursSection')} hint={t('places.claim.hoursHint')}>
            <DayRow
              label={t('places.claim.weekdays')}
              value={hours.weekdays}
              onChange={setDay('weekdays')}
            />
            <DayRow
              label={t('places.claim.saturday')}
              value={hours.saturday}
              onChange={setDay('saturday')}
            />
            <DayRow
              label={t('places.claim.sunday')}
              value={hours.sunday}
              onChange={setDay('sunday')}
            />
          </Section>
        )}

        <Section title={t('places.claim.contactSection')} hint={t('places.claim.contactHint')}>
          <Field label={t('places.claim.contactName')}>
            <TextInput
              className={INPUT}
              value={contactName}
              onChangeText={setContactName}
              accessibilityLabel={t('places.claim.contactName')}
            />
          </Field>
          <Field label={t('places.claim.contact')}>
            <TextInput
              className={INPUT}
              value={contact}
              onChangeText={setContact}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('places.claim.contact')}
            />
          </Field>
        </Section>

        <View className="flex-row items-start gap-3">
          <Switch
            value={consent}
            onValueChange={setConsent}
            accessibilityLabel={t('places.claim.consent')}
            trackColor={{ true: '#0f766e' }}
          />
          <Text className="flex-1 text-sm leading-5 text-neutral-700 dark:text-neutral-300">
            {t('places.claim.consent')}
          </Text>
        </View>

        {invalid ? (
          <Text accessibilityRole="alert" className="text-sm text-red-700 dark:text-red-400">
            {t('places.claim.invalid')}
          </Text>
        ) : null}
        {submit.isError ? <ErrorState error={submit.error} /> : null}

        <View className="flex-row">
          <Button
            label={t('places.claim.submit')}
            onPress={() => {
              if (!submit.isPending) send();
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function withScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text
        accessibilityRole="header"
        className="text-lg font-semibold text-neutral-900 dark:text-white"
      >
        {title}
      </Text>
      {hint ? <Text className="text-sm text-neutral-500 dark:text-neutral-400">{hint}</Text> : null}
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-neutral-600 dark:text-neutral-300">{label}</Text>
      {children}
    </View>
  );
}

function DayRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DayRange;
  onChange: (range: DayRange) => void;
}) {
  const { t } = useAppTranslation();
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-base text-neutral-900 dark:text-white">{label}</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('places.claim.closedDay')}
          </Text>
          <Switch
            value={value.closed}
            onValueChange={(closed) => onChange({ ...value, closed })}
            accessibilityLabel={`${label}: ${t('places.claim.closedDay')}`}
          />
        </View>
      </View>
      {!value.closed ? (
        <View className="flex-row gap-3">
          <TextInput
            className={`${INPUT} flex-1`}
            value={value.open}
            onChangeText={(open) => onChange({ ...value, open })}
            placeholder={t('places.claim.timePlaceholder')}
            accessibilityLabel={`${label}: ${t('places.claim.open')}`}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            className={`${INPUT} flex-1`}
            value={value.close}
            onChangeText={(close) => onChange({ ...value, close })}
            placeholder={t('places.claim.timePlaceholder')}
            accessibilityLabel={`${label}: ${t('places.claim.close')}`}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      ) : null}
    </View>
  );
}

function SwitchRow(props: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="flex-1 text-base text-neutral-900 dark:text-white">{props.label}</Text>
      <Switch
        value={props.value}
        onValueChange={props.onChange}
        accessibilityLabel={props.label}
        trackColor={{ true: '#0f766e' }}
      />
    </View>
  );
}
