-- Pet crematoriums and funeral homes (owner's decision, 2026-10-05). Must match
-- packages/shared/src/categories.ts.
INSERT INTO categories (slug, "group", sort_order) VALUES ('pet_funeral', 'pet_business', 9)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint
INSERT INTO category_translations (category_id, locale, name)
SELECT c.id, t.locale, t.name
FROM (VALUES
  ('es', 'Crematorio y funeraria para mascotas'),
  ('en', 'Pet cremation and funeral services')
) AS t(locale, name)
JOIN categories c ON c.slug = 'pet_funeral'
ON CONFLICT (category_id, locale) DO NOTHING;
