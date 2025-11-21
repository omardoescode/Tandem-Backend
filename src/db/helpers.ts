import pool from "@/db/pool";
import { Ok, Err } from "@/utils/monads/Result";
import type Result from "@/utils/monads/Result";
import type { QueryArrayConfig, QueryArrayResult } from "pg";
import { DBError } from "./errors";

interface Client {
  query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export async function withClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<Result<T, DBError>> {
  let client = null;

  try {
    client = await pool.connect();
    const result = await fn(client);
    await client.query("commit");
    return Ok(result);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    if (client) await client.query("rollback");
    return Err(new DBError("DB error", { reason: err }));
  } finally {
    if (client) client.release();
  }
}
