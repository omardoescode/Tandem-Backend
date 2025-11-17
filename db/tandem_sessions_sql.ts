import { QueryArrayConfig, QueryArrayResult } from "pg";

import { IPostgresInterval } from "postgres-interval";

interface Client {
    query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export const createSessionQuery = `-- name: createSession :one
insert into tandem_session(scheduled_duration) values ($1) returning session_id, status, start_time, scheduled_duration`;

export interface createSessionArgs {
    scheduledDuration: IPostgresInterval;
}

export interface createSessionRow {
    sessionId: string;
    status: string | null;
    startTime: Date;
    scheduledDuration: IPostgresInterval;
}

export async function createSession(client: Client, args: createSessionArgs): Promise<createSessionRow | null> {
    const result = await client.query({
        text: createSessionQuery,
        values: [args.scheduledDuration],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        sessionId: row[0],
        status: row[1],
        startTime: row[2],
        scheduledDuration: row[3]
    };
}

export const createSessionParticipantQuery = `-- name: createSessionParticipant :one
insert into session_participant(session_id, user_id) values ($1, $2) returning session_id, user_id, status, focus_time_seconds, break_time_seconds`;

export interface createSessionParticipantArgs {
    sessionId: string;
    userId: string;
}

export interface createSessionParticipantRow {
    sessionId: string;
    userId: string;
    status: string | null;
    focusTimeSeconds: number;
    breakTimeSeconds: number;
}

export async function createSessionParticipant(client: Client, args: createSessionParticipantArgs): Promise<createSessionParticipantRow | null> {
    const result = await client.query({
        text: createSessionParticipantQuery,
        values: [args.sessionId, args.userId],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        sessionId: row[0],
        userId: row[1],
        status: row[2],
        focusTimeSeconds: row[3],
        breakTimeSeconds: row[4]
    };
}

export const createSessionTaskQuery = `-- name: createSessionTask :one
insert into session_task(session_id, user_id, title) values ($1, $2, $3) returning session_id, user_id, title, is_complete, created_at`;

export interface createSessionTaskArgs {
    sessionId: string;
    userId: string;
    title: string;
}

export interface createSessionTaskRow {
    sessionId: string;
    userId: string;
    title: string;
    isComplete: boolean | null;
    createdAt: Date;
}

export async function createSessionTask(client: Client, args: createSessionTaskArgs): Promise<createSessionTaskRow | null> {
    const result = await client.query({
        text: createSessionTaskQuery,
        values: [args.sessionId, args.userId, args.title],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        sessionId: row[0],
        userId: row[1],
        title: row[2],
        isComplete: row[3],
        createdAt: row[4]
    };
}

