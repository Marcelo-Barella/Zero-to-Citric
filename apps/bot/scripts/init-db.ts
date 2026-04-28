#!/usr/bin/env tsx
/**
 * One-shot bootstrap for the memories table + pgvector extension.
 * Reads POSTGRES_URL from env and runs INIT_SQL.
 */
import { initSchema, closeDb } from '../memory/db.js';

async function main(): Promise<void> {
  await initSchema();
  await closeDb();
  process.stdout.write('memories schema ready\n');
}

main().catch((err) => {
  process.stderr.write(`init-db failed: ${(err as Error).message}\n`);
  process.exit(1);
});
