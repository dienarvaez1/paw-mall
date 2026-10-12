// The SVGs in assets/icons (Metro needs static requires).
import type { CategorySlug } from '@paw-mall/shared';
import type { ImageSource } from 'expo-image';

export const ICONS = {
  compass: require('../../assets/icons/compass.svg') as ImageSource,
  'keyboard-hide': require('../../assets/icons/keyboard-hide.svg') as ImageSource,
  locate: require('../../assets/icons/locate.svg') as ImageSource,
  'tab-explore': require('../../assets/icons/tab-search.svg') as ImageSource,
  'tab-pets': require('../../assets/icons/tab-pets.svg') as ImageSource,
  'tab-settings': require('../../assets/icons/tab-settings.svg') as ImageSource,
  'tab-urgent': require('../../assets/icons/tab-urgent.svg') as ImageSource,
};

/** Map pins: one line icon per category (white on the category's color). */
export const CATEGORY_ICONS: Partial<Record<CategorySlug, ImageSource>> = {
  vet_hospital: require('../../assets/icons/cat-vet_hospital.svg') as ImageSource,
  veterinarian: require('../../assets/icons/cat-veterinarian.svg') as ImageSource,
  public_vet_service: require('../../assets/icons/cat-public_vet_service.svg') as ImageSource,
  groomer: require('../../assets/icons/cat-groomer.svg') as ImageSource,
  boarding: require('../../assets/icons/cat-boarding.svg') as ImageSource,
  boutique: require('../../assets/icons/cat-boutique.svg') as ImageSource,
  pet_store: require('../../assets/icons/cat-pet_store.svg') as ImageSource,
  feed_store: require('../../assets/icons/cat-feed_store.svg') as ImageSource,
  pet_funeral: require('../../assets/icons/cat-pet_funeral.svg') as ImageSource,
  dog_trainer: require('../../assets/icons/cat-dog_trainer.svg') as ImageSource,
  restaurant: require('../../assets/icons/cat-restaurant.svg') as ImageSource,
  cafe: require('../../assets/icons/cat-cafe.svg') as ImageSource,
  lodging: require('../../assets/icons/cat-lodging.svg') as ImageSource,
  museum: require('../../assets/icons/cat-museum.svg') as ImageSource,
  park: require('../../assets/icons/cat-park.svg') as ImageSource,
  tourist_site: require('../../assets/icons/cat-tourist_site.svg') as ImageSource,
};
