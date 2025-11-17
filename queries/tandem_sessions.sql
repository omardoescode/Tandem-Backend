-- name: retrieveUsers :one
select * from tandem_session where session_id = $1;
