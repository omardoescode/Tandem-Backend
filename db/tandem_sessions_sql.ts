import { type QueryArrayConfig, type QueryArrayResult } from "pg";

import { type IPostgresInterval } from "postgres-interval";

interface Client {
  query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export const retrieveUsersQuery = `-- name: retrieveUsers :one
select session_id, status, start_time, scheduled_duration from tandem_session where session_id = $1`;

export interface retrieveUsersArgs {
  sessionId: string;
}

export interface retrieveUsersRow {
  sessionId: string;
  status: string | null;
  startTime: Date;
  scheduledDuration: IPostgresInterval;
}

export async function retrieveUsers(
  client: Client,
  args: retrieveUsersArgs,
): Promise<retrieveUsersRow | null> {
  const result = await client.query({
    text: retrieveUsersQuery,
    values: [args.sessionId],
    rowMode: "array",
  });
  if (result.rows.length !== 1) {
    return null;
  }
  const row = result.rows[0];

  if (row == undefined) {
    return null;
  }

  return {
    sessionId: row[0],
    status: row[1],
    startTime: row[2],
    scheduledDuration: row[3],
  };
}
