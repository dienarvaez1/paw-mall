-- Adoption, rescue and animal protection (Phase 22, owner's choice 2026-10-14): shelters,
-- sanctuaries, adoption centers, rescuers and non-profits that help animals. Must match
-- packages/shared/src/categories.ts.
INSERT INTO categories (slug, "group", sort_order) VALUES ('animal_welfare', 'pet_business', 11)
ON CONFLICT (slug) DO NOTHING;--> statement-breakpoint
INSERT INTO category_translations (category_id, locale, name)
SELECT c.id, t.locale, t.name
FROM (VALUES ('es', 'Adopción, rescate y protección animal'),
             ('en', 'Adoption, rescue and animal protection')) AS t(locale, name)
JOIN categories c ON c.slug = 'animal_welfare'
ON CONFLICT (category_id, locale) DO NOTHING;
