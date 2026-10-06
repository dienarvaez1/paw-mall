-- Dog training (owner's decision, 2026-10-05). Must match packages/shared/src/categories.ts.
INSERT INTO categories (slug, "group", sort_order) VALUES ('dog_trainer', 'pet_business', 10)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint
INSERT INTO category_translations (category_id, locale, name)
SELECT c.id, t.locale, t.name
FROM (VALUES ('es', 'Adiestramiento canino'), ('en', 'Dog training')) AS t(locale, name)
JOIN categories c ON c.slug = 'dog_trainer'
ON CONFLICT (category_id, locale) DO NOTHING;
