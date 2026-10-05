-- Categories and their names. Slugs and groups must match packages/shared/src/categories.ts.
INSERT INTO categories (slug, "group", sort_order) VALUES
  ('pet_store', 'pet_business', 1),
  ('boutique', 'pet_business', 2),
  ('veterinarian', 'pet_business', 3),
  ('vet_hospital', 'pet_business', 4),
  ('public_vet_service', 'pet_business', 5),
  ('groomer', 'pet_business', 6),
  ('boarding', 'pet_business', 7),
  ('feed_store', 'pet_business', 8),
  ('restaurant', 'pet_friendly', 20),
  ('cafe', 'pet_friendly', 21),
  ('lodging', 'pet_friendly', 22),
  ('museum', 'pet_friendly', 23),
  ('park', 'pet_friendly', 24),
  ('tourist_site', 'pet_friendly', 25)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint
INSERT INTO category_translations (category_id, locale, name)
SELECT c.id, t.locale, t.name
FROM (VALUES
  ('pet_store', 'es', 'Tienda de mascotas'), ('pet_store', 'en', 'Pet store'),
  ('boutique', 'es', 'Boutique para mascotas'), ('boutique', 'en', 'Pet boutique'),
  ('veterinarian', 'es', 'Veterinaria'), ('veterinarian', 'en', 'Veterinarian'),
  ('vet_hospital', 'es', 'Hospital veterinario'), ('vet_hospital', 'en', 'Veterinary hospital'),
  ('public_vet_service', 'es', 'Servicio veterinario público'),
  ('public_vet_service', 'en', 'Public veterinary service'),
  ('groomer', 'es', 'Estética para mascotas'), ('groomer', 'en', 'Pet grooming'),
  ('boarding', 'es', 'Pensión para mascotas'), ('boarding', 'en', 'Pet boarding'),
  ('feed_store', 'es', 'Forrajería'), ('feed_store', 'en', 'Feed store'),
  ('restaurant', 'es', 'Restaurante'), ('restaurant', 'en', 'Restaurant'),
  ('cafe', 'es', 'Cafetería'), ('cafe', 'en', 'Café'),
  ('lodging', 'es', 'Hospedaje'), ('lodging', 'en', 'Lodging'),
  ('museum', 'es', 'Museo'), ('museum', 'en', 'Museum'),
  ('park', 'es', 'Parque'), ('park', 'en', 'Park'),
  ('tourist_site', 'es', 'Sitio turístico'), ('tourist_site', 'en', 'Tourist site')
) AS t(slug, locale, name)
JOIN categories c ON c.slug = t.slug
ON CONFLICT (category_id, locale) DO NOTHING;
