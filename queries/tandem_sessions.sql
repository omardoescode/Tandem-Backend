-- name: createSession :one
insert into tandem_session(scheduled_duration) values ($1) returning *;

-- name: createSessionParticipant :one
insert into session_participant(session_id, user_id) values ($1, $2) returning *;

-- name: createSessionTask :one
insert into session_task(session_id, user_id, title) values ($1, $2, $3) returning *;
