-- منصة A9: المحادثات وسجل الأحداث
-- انسخه كله والصقه بـ Supabase > SQL Editor > New query ثم اضغط Run
create table if not exists private.messages (
  id          bigserial primary key,
  sender      int not null references private.students(id),
  recipient   int not null references private.students(id),
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists messages_pair on private.messages (least(sender, recipient), greatest(sender, recipient), id);
create index if not exists messages_unread on private.messages (recipient) where read_at is null;

create table if not exists private.events (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  actor   int references private.students(id),
  target  int references private.students(id),
  kind    text not null,
  detail  text
);
create index if not exists events_at on private.events (id desc);

create or replace function private.log(p_actor int, p_kind text, p_target int default null, p_detail text default null)
returns void language sql security definer set search_path = '' as $$
  insert into private.events(actor, kind, target, detail) values (p_actor, p_kind, p_target, p_detail);
$$;
revoke all on function private.log(int, text, int, text) from public, anon, authenticated;

create or replace function public.a9_set_pin(p_id int, p_pin text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_token uuid; v_row private.students;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return json_build_object('ok', false, 'error', 'bad_pin');
  end if;
  update private.students
     set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
         failed = 0, locked_until = null, last_login = now()
   where id = p_id and pin_hash is null
  returning * into v_row;
  if not found then
    return json_build_object('ok', false, 'error', 'already_set');
  end if;
  insert into private.sessions(student_id) values (v_row.id) returning token into v_token;
  perform private.log(v_row.id, 'register');
  return json_build_object('ok', true, 'token', v_token, 'id', v_row.id, 'name', v_row.name, 'is_admin', v_row.is_admin);
end $$;

create or replace function public.a9_login(p_id int, p_pin text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_row private.students; v_token uuid;
begin
  select * into v_row from private.students where id = p_id for update;
  if not found then return json_build_object('ok', false, 'error', 'not_found'); end if;
  if v_row.pin_hash is null then return json_build_object('ok', false, 'error', 'no_pin'); end if;
  if v_row.locked_until is not null and v_row.locked_until > now() then
    return json_build_object('ok', false, 'error', 'locked',
      'minutes', ceil(extract(epoch from v_row.locked_until - now()) / 60));
  end if;
  if v_row.pin_hash <> extensions.crypt(coalesce(p_pin, ''), v_row.pin_hash) then
    update private.students
       set failed = case when failed + 1 >= 5 then 0 else failed + 1 end,
           locked_until = case when failed + 1 >= 5 then now() + interval '15 minutes' else null end
     where id = p_id;
    if v_row.failed + 1 >= 5 then perform private.log(p_id, 'locked');
    else perform private.log(p_id, 'login_failed'); end if;
    return json_build_object('ok', false, 'error', 'wrong_pin', 'left', greatest(0, 4 - v_row.failed));
  end if;
  update private.students set failed = 0, locked_until = null, last_login = now() where id = p_id;
  insert into private.sessions(student_id) values (p_id) returning token into v_token;
  perform private.log(p_id, 'login');
  return json_build_object('ok', true, 'token', v_token, 'id', v_row.id, 'name', v_row.name, 'is_admin', v_row.is_admin);
end $$;

create or replace function public.a9_logout(p_token uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token);
begin
  update private.sessions set expires_at = now() where token = p_token;
  if v_id is not null then perform private.log(v_id, 'logout'); end if;
end $$;

create or replace function public.a9_set_avatar(p_token uuid, p_avatar text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token);
begin
  if v_id is null then return json_build_object('ok', false, 'error', 'no_session'); end if;
  if p_avatar is not null and (length(p_avatar) > 120000 or p_avatar not like 'data:image/%') then
    return json_build_object('ok', false, 'error', 'bad_image');
  end if;
  update private.students set avatar = p_avatar where id = v_id;
  perform private.log(v_id, case when p_avatar is null then 'avatar_removed' else 'avatar' end);
  return json_build_object('ok', true);
end $$;

create or replace function public.a9_change_pin(p_token uuid, p_old text, p_new text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token); v_hash text;
begin
  if v_id is null then return json_build_object('ok', false, 'error', 'no_session'); end if;
  if p_new is null or p_new !~ '^[0-9]{4}$' then return json_build_object('ok', false, 'error', 'bad_pin'); end if;
  select pin_hash into v_hash from private.students where id = v_id;
  if v_hash is null or v_hash <> extensions.crypt(coalesce(p_old, ''), v_hash) then
    return json_build_object('ok', false, 'error', 'wrong_pin');
  end if;
  update private.students set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 8)) where id = v_id;
  perform private.log(v_id, 'pin_changed');
  return json_build_object('ok', true);
end $$;

create or replace function public.a9_admin_reset_pin(p_token uuid, p_student int)
returns json language plpgsql security definer set search_path = '' as $$
declare v_admin int := private.session_student(p_token);
begin
  if not exists (select 1 from private.students x where x.id = v_admin and x.is_admin) then
    return json_build_object('ok', false, 'error', 'not_admin');
  end if;
  update private.students set pin_hash = null, failed = 0, locked_until = null where id = p_student;
  update private.sessions set expires_at = now() where student_id = p_student and expires_at > now();
  perform private.log(v_admin, 'pin_reset', p_student);
  return json_build_object('ok', true);
end $$;

create or replace function public.a9_send(p_token uuid, p_to int, p_body text)
returns json language plpgsql security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token); v_body text := btrim(coalesce(p_body, '')); v_msg private.messages;
begin
  if v_id is null then return json_build_object('ok', false, 'error', 'no_session'); end if;
  if p_to = v_id or not exists (select 1 from private.students where id = p_to) then
    return json_build_object('ok', false, 'error', 'bad_recipient');
  end if;
  if length(v_body) = 0 or length(v_body) > 2000 then return json_build_object('ok', false, 'error', 'bad_body'); end if;
  insert into private.messages(sender, recipient, body) values (v_id, p_to, v_body) returning * into v_msg;
  perform private.log(v_id, 'message', p_to, v_body);
  return json_build_object('ok', true, 'id', v_msg.id, 'created_at', v_msg.created_at);
end $$;

create or replace function public.a9_messages(p_token uuid, p_other int, p_after bigint default 0)
returns table (id bigint, mine boolean, body text, created_at timestamptz, read_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token);
begin
  if v_id is null then raise exception 'no_session'; end if;
  update private.messages m set read_at = now()
   where m.recipient = v_id and m.sender = p_other and m.read_at is null;
  return query
    select m.id, m.sender = v_id, m.body, m.created_at, m.read_at
      from private.messages m
     where ((m.sender = v_id and m.recipient = p_other) or (m.sender = p_other and m.recipient = v_id))
       and m.id > coalesce(p_after, 0)
     order by m.id
     limit 500;
end $$;

create or replace function public.a9_conversations(p_token uuid)
returns table (other int, name text, avatar text, is_admin boolean, last_body text, last_at timestamptz, last_mine boolean, unread int)
language plpgsql stable security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token);
begin
  if v_id is null then raise exception 'no_session'; end if;
  return query
    with mine as (
      select case when m.sender = v_id then m.recipient else m.sender end as o, m.id, m.body, m.created_at, m.sender
        from private.messages m where m.sender = v_id or m.recipient = v_id
    ), last as (
      select distinct on (mine.o) mine.o, mine.body, mine.created_at, mine.sender = v_id as lm from mine order by mine.o, mine.id desc
    )
    select s.id, s.name, s.avatar, s.is_admin, l.body, l.created_at, l.lm,
           (select count(*)::int from private.messages u where u.sender = s.id and u.recipient = v_id and u.read_at is null)
      from last l join private.students s on s.id = l.o
     order by l.created_at desc;
end $$;

create or replace function public.a9_unread(p_token uuid)
returns int language sql stable security definer set search_path = '' as $$
  select count(*)::int from private.messages m where m.recipient = private.session_student(p_token) and m.read_at is null;
$$;

create or replace function public.a9_admin_events(p_token uuid, p_before bigint default null, p_limit int default 100)
returns table (id bigint, at timestamptz, kind text, actor text, target text, detail text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.students x where x.id = private.session_student(p_token) and x.is_admin) then
    raise exception 'not_admin';
  end if;
  return query
    select e.id, e.at, e.kind, a.name, t.name, e.detail
      from private.events e
      left join private.students a on a.id = e.actor
      left join private.students t on t.id = e.target
     where p_before is null or e.id < p_before
     order by e.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 300);
end $$;

revoke all on function public.a9_send(uuid, int, text), public.a9_messages(uuid, int, bigint), public.a9_conversations(uuid),
  public.a9_unread(uuid), public.a9_admin_events(uuid, bigint, int) from public;
grant execute on function public.a9_send(uuid, int, text), public.a9_messages(uuid, int, bigint), public.a9_conversations(uuid),
  public.a9_unread(uuid), public.a9_admin_events(uuid, bigint, int) to anon, authenticated;
