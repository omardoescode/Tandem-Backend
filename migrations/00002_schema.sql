create table tandem_session (
  session_id uuid default uuidv7() primary key,
  status varchar default 'running' check (status in ('running', 'checkin', 'finished')),
  start_time timestamptz not null default now(),
  scheduled_duration interval not null 
);

create table session_participant (
  session_id uuid not null references tandem_session(session_id),
  user_id text not null references "user"(id),
  status varchar check (status in ('pending', 'complete', 'disconnected')),
  focus_time_seconds INTEGER NOT NULL DEFAULT 0,
  break_time_seconds INTEGER NOT NULL DEFAULT 0,
  primary key (session_id, user_id)
); 

create table session_task (
  task_id uuid DEFAULT uuidv7() primary key,
  session_id uuid not null references tandem_session(session_id),
  user_id text not null references "user"(id) on delete cascade,
  title varchar(500) not null,
  is_complete boolean default false,
  created_at timestamptz not null default now()
);

-- TODO: Figure out the best PK for this
create table checkin (
  session_id uuid not null references tandem_session(session_id),
  reviewer_id text not null references "user"(id),
  reviewee_id text not null references "user"(id),
  work_proved boolean not null,
  primary key (session_id, reviewer_id, reviewee_id)
);

