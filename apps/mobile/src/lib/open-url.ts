import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';

import { useAppTranslation } from '@/i18n/use-app-translation';

import { type DirectionsTarget, type MapsApp, directionsUrl, mapsAppsFor } from './links';

/**
 * "Cómo llegar": asks which maps app to use (an action sheet on iOS, a dialog on Android), then
 * opens directions to the place in it.
 */
export function useOpenDirections() {
  const { t } = useAppTranslation();
  return (target: DirectionsTarget) => {
    const apps = mapsAppsFor(Platform.OS);
    const labels = apps.map((app) => t(`common.mapsApp.${app}`));
    const open = (app: MapsApp) => void Linking.openURL(directionsUrl(app, target));
    const title = t('common.directionsWith');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, options: [...labels, t('common.cancel')], cancelButtonIndex: labels.length },
        (index) => {
          const app = apps[index];
          if (app) open(app);
        },
      );
      return;
    }
    // Android dialogs show at most three buttons: two apps and Cancel.
    Alert.alert(title, undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      ...apps.map((app, i) => ({ text: labels[i], onPress: () => open(app) })),
    ]);
  };
}
