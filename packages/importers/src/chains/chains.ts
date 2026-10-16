// Chain-wide pet policies (data/pet-friendly-chains.json): one policy a chain states for its
// branches, given to each DENUE branch whose name matches. Owner, curated, website and users'
// policies are never replaced; a branch that stops matching loses the chain policy.
//
// Importer scripts run on plain Node, which can't load packages/shared's values, so this file
// imports only its types (as curated.ts does).
import type { CategorySlug, PetPolicyInput } from '@pet-helper/shared';
import type postgres from 'postgres';
import { z } from 'zod';

import { dogSizeForWeightLimit } from '../curated/curated.ts';

const chainSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** Matched against the branch's name, upper case and without accents. */
  match: z.string().min(3),
  categories: z.array(z.enum(['restaurant', 'cafe', 'lodging'])).min(1),
  policy: z.strictObject({
    dogs: z.boolean().nullable(),
    cats: z.boolean().nullable(),
    otherPets: z.boolean().nullable(),
    maxWeightKg: z.number().positive().nullable(),
    maxPets: z.number().int().positive().nullable(),
    fee: z.null(),
    areas: z.array(z.enum(['indoor', 'terrace', 'outdoor'])),
    rules: z.string().nullable(),
  }),
  source: z.strictObject({
    name: z.string().min(1),
    url: z.url(),
    checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
});
export const chainsFileSchema = z.object({ about: z.string(), chains: z.array(chainSchema) });
export type Chain = z.infer<typeof chainSchema>;

/** The chain's policy as stored: the largest dog size follows the weight limit. */
export function chainPolicy(chain: Chain): PetPolicyInput {
  const { maxWeightKg, dogs } = chain.policy;
  return {
    ...chain.policy,
    maxDogSize: dogs && maxWeightKg !== null ? dogSizeForWeightLimit(maxWeightKg) : null,
  };
}

/**
 * Gives every matching DENUE branch the chain's policy (source 'chain'), and removes chain
 * policies from places that no longer match any chain. Returns branches per chain.
 */
export async function applyChains(sql: postgres.Sql, chains: Chain[]) {
  return sql.begin(async (tx) => {
    const kept: number[] = [];
    const branches: Record<string, number> = {};
    for (const chain of chains) {
      const p = chainPolicy(chain);
      const categories: CategorySlug[] = chain.categories;
      const rows = await tx<{ place_id: number }[]>`
        INSERT INTO pet_policies (place_id, dogs, cats, other_pets, max_dog_size, max_weight_kg,
                                  max_pets, areas, rules, source, source_name, source_url,
                                  last_confirmed_on)
        SELECT p.id, ${p.dogs}, ${p.cats}, ${p.otherPets}, ${p.maxDogSize}, ${p.maxWeightKg},
               ${p.maxPets}, ${p.areas}, ${p.rules}, 'chain', ${chain.source.name},
               ${chain.source.url}, ${chain.source.checkedOn}
        FROM places p
        WHERE p.source = 'denue' AND p.hidden_at IS NULL
          AND upper(f_unaccent(p.name)) LIKE ${`%${chain.match}%`}
          AND EXISTS (SELECT 1 FROM place_categories pc JOIN categories c ON c.id = pc.category_id
                      WHERE pc.place_id = p.id AND c.slug = ANY(${categories}))
        ON CONFLICT (place_id) DO UPDATE SET
          dogs = EXCLUDED.dogs, cats = EXCLUDED.cats, other_pets = EXCLUDED.other_pets,
          max_dog_size = EXCLUDED.max_dog_size, max_weight_kg = EXCLUDED.max_weight_kg,
          max_pets = EXCLUDED.max_pets, areas = EXCLUDED.areas, rules = EXCLUDED.rules,
          source_name = EXCLUDED.source_name, source_url = EXCLUDED.source_url,
          last_confirmed_on = GREATEST(pet_policies.last_confirmed_on, EXCLUDED.last_confirmed_on)
        WHERE pet_policies.source = 'chain'
        RETURNING place_id`;
      branches[chain.name] = rows.length;
      kept.push(...rows.map((r) => r.place_id));
    }
    const removed = await tx`
      DELETE FROM pet_policies WHERE source = 'chain' AND place_id <> ALL(${kept}::int[])`;
    return { branches, removed: removed.count };
  });
}
