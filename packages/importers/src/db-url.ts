/** The local Docker DB. Development only: there is no production target (docs/PLAN.md). */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgres://paw:paw@localhost:5434/paw_mall';
}
