import { QueryArrayConfig, QueryArrayResult } from "pg";

import { IPostgresInterval } from "postgres-interval";

interface Client {
    query: (config: QueryArrayConfig) => Promise<QueryArrayResult>;
}

export const createSessionQuery = `-- name: createSession :one
insert into tandem_session(session_id, scheduled_duration) values ($1, $2) returning session_id, status, start_time, scheduled_duration`;

export interface createSessionArgs {
    sessionId: string;
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
        values: [args.sessionId, args.scheduledDuration],
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
insert into session_task(task_id, session_id, user_id, title) values ($1, $2, $3,$4) returning task_id, session_id, user_id, title, is_complete, created_at`;

export interface createSessionTaskArgs {
    taskId: string;
    sessionId: string;
    userId: string;
    title: string;
}

export interface createSessionTaskRow {
    taskId: string;
    sessionId: string;
    userId: string;
    title: string;
    isComplete: boolean | null;
    createdAt: Date;
}

export async function createSessionTask(client: Client, args: createSessionTaskArgs): Promise<createSessionTaskRow | null> {
    const result = await client.query({
        text: createSessionTaskQuery,
        values: [args.taskId, args.sessionId, args.userId, args.title],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        taskId: row[0],
        sessionId: row[1],
        userId: row[2],
        title: row[3],
        isComplete: row[4],
        createdAt: row[5]
    };
}

export const checkSessionTaskExistsQuery = `-- name: checkSessionTaskExists :one
select 1 exists from session_task where session_id = $1 and user_id = $2`;

export interface checkSessionTaskExistsArgs {
    sessionId: string;
    userId: string;
}

export interface checkSessionTaskExistsRow {
    exists: string;
}

export async function checkSessionTaskExists(client: Client, args: checkSessionTaskExistsArgs): Promise<checkSessionTaskExistsRow | null> {
    const result = await client.query({
        text: checkSessionTaskExistsQuery,
        values: [args.sessionId, args.userId],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        exists: row[0]
    };
}

export const toggleSessionTaskQuery = `-- name: toggleSessionTask :exec
update session_task set is_complete = $2 where task_id = $1 and user_id = $3`;

export interface toggleSessionTaskArgs {
    taskId: string;
    isComplete: string | null;
    userId: string;
}

export async function toggleSessionTask(client: Client, args: toggleSessionTaskArgs): Promise<void> {
    await client.query({
        text: toggleSessionTaskQuery,
        values: [args.taskId, args.isComplete, args.userId],
        rowMode: "array"
    });
}

export const getCompletedSessionsForCheckInQuery = `-- name: getCompletedSessionsForCheckIn :many
select ts.session_id, start_time, scheduled_duration, user_id
from tandem_session ts join session_participant sp on ts.session_id = sp.session_id
where start_time + scheduled_duration < now()
  and ts.status = 'running'`;

export interface getCompletedSessionsForCheckInRow {
    sessionId: string;
    startTime: Date;
    scheduledDuration: IPostgresInterval;
    userId: string;
}

export async function getCompletedSessionsForCheckIn(client: Client): Promise<getCompletedSessionsForCheckInRow[]> {
    const result = await client.query({
        text: getCompletedSessionsForCheckInQuery,
        values: [],
        rowMode: "array"
    });
    return result.rows.map(row => {
        return {
            sessionId: row[0],
            startTime: row[1],
            scheduledDuration: row[2],
            userId: row[3]
        };
    });
}

export const updateSessionStatusToCheckInQuery = `-- name: updateSessionStatusToCheckIn :exec
update tandem_session set status = 'checkin' where session_id = any($1)`;

export interface updateSessionStatusToCheckInArgs {
    sessionId: string[];
}

export async function updateSessionStatusToCheckIn(client: Client, args: updateSessionStatusToCheckInArgs): Promise<void> {
    await client.query({
        text: updateSessionStatusToCheckInQuery,
        values: [args.sessionId],
        rowMode: "array"
    });
}

export const abortSessionQuery = `-- name: abortSession :exec
update tandem_session set status = 'disconnected' where session_id = any($1)`;

export interface abortSessionArgs {
    sessionId: string[];
}

export async function abortSession(client: Client, args: abortSessionArgs): Promise<void> {
    await client.query({
        text: abortSessionQuery,
        values: [args.sessionId],
        rowMode: "array"
    });
}

export const createCheckInReportQuery = `-- name: createCheckInReport :exec
insert into checkin(session_id, reviewer_id, work_proved, reviewee_id) values ($1, $2, $3, $4)`;

export interface createCheckInReportArgs {
    sessionId: string;
    reviewerId: string;
    workProved: string;
    revieweeId: string;
}

export async function createCheckInReport(client: Client, args: createCheckInReportArgs): Promise<void> {
    await client.query({
        text: createCheckInReportQuery,
        values: [args.sessionId, args.reviewerId, args.workProved, args.revieweeId],
        rowMode: "array"
    });
}

export const checkSessionDoneQuery = `-- name: checkSessionDone :one
select count(distinct reviewer_id) = 2 done from checkin where session_id = $1`;

export interface checkSessionDoneArgs {
    sessionId: string;
}

export interface checkSessionDoneRow {
    done: string;
}

export async function checkSessionDone(client: Client, args: checkSessionDoneArgs): Promise<checkSessionDoneRow | null> {
    const result = await client.query({
        text: checkSessionDoneQuery,
        values: [args.sessionId],
        rowMode: "array"
    });
    if (result.rows.length !== 1) {
        return null;
    }
    const row = result.rows[0];
    return {
        done: row[0]
    };
}

