-- name: createSession :one
insert into tandem_session(scheduled_duration) values ($1) returning *;

-- name: createSessionParticipant :one
insert into session_participant(session_id, user_id) values ($1, $2) returning *;

-- name: createSessionTask :one
insert into session_task(session_id, user_id, title) values ($1, $2, $3) returning *;

-- name: toggleSessionTask :exec
update session_task set is_complete = $2 where task_id = $1 and user_id = $3; 

-- name: getCompletedSessionsForCheckIn :many
select ts.session_id, start_time, scheduled_duration, user_id
from tandem_session ts join session_participant sp on ts.session_id = sp.session_id
where start_time + scheduled_duration < now()
  and ts.status = 'running';

-- name: updateSessionStatusToCheckIn :exec
update tandem_session set status = 'checkin' where session_id = any($1);

-- name: abortSession :exec
update tandem_session set status = 'disconnected' where session_id = any($1);

-- name: createCheckInReport :exec
insert into checkin(session_id, reviewer_id, work_proved, reviewee_id) values ($1, $2, $3, $4);

-- name: checkSessionDone :one
select count(distinct reviewer_id) = 2 done from checkin where session_id = $1;
