// The SVGs in assets/icons (Metro needs static requires).
import type { ImageSource } from 'expo-image';

export const ICONS = {
  compass: require('../../assets/icons/compass.svg') as ImageSource,
  locate: require('../../assets/icons/locate.svg') as ImageSource,
  'tab-explore': require('../../assets/icons/tab-search.svg') as ImageSource,
  'tab-settings': require('../../assets/icons/tab-settings.svg') as ImageSource,
};
