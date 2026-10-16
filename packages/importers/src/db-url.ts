/** The local Docker DB. Development only: there is no production target (docs/PLAN.md). */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgres://pet_helper:pet_helper@localhost:5434/pet_helper';
}
