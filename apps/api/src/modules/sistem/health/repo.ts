import { sql } from 'drizzle-orm';
import { db } from '../../../db/client';

/** Query paling ringan untuk memastikan database menjawab. */
export async function ping(): Promise<void> {
  await db.execute(sql`select 1`);
}
