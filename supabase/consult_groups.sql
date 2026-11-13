-- منصة A9: مجموعات الاستشارية (4 مجاميع ثابتة)
-- انسخه كله والصقه بـ Supabase > SQL Editor > New query ثم اضغط Run
--
-- الحدود: كل مجموعة 8 طلاب كحد أعلى، منهم 5 بنات و4 ولد كحد أعلى.
-- الخصوصية: كل طالب يشوف أسماء نفس جنسه بس، والجنس الثاني كعدد. الممثل يشوف الكل.

create table if not exists private.consult_members (
  student_id  int primary key references private.students(id),
  group_no    int not null check (group_no between 1 and 4),
  added_by    int references private.students(id),
  joined_at   timestamptz not null default now()
);

create or replace function private.consult_locked()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true' from private.settings where key = 'consult_locked'), false);
$$;

-- هل اكو مكان بالمجموعة لهذا الجنس؟
create or replace function private.consult_has_room(p_group int, p_gender char)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from private.consult_members c where c.group_no = p_group) < 8
    and (select count(*) from private.consult_members c join private.students s on s.id = c.student_id
          where c.group_no = p_group and s.gender = p_gender) < case when p_gender = 'F' then 5 else 4 end;
$$;

revoke all on function private.consult_locked(), private.consult_has_room(int, char) from public, anon, authenticated;

-- كل اللي يحتاجه الطالب لصفحة المجاميع
create or replace function public.a9_consult_view(p_token uuid)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_id int := private.session_student(p_token);
  v_me private.students;
  v_admin boolean;
begin
  if v_id is null then raise exception 'no_session'; end if;
  select * into v_me from private.students where id = v_id;
  v_admin := v_me.is_admin;
  return json_build_object(
    'locked', private.consult_locked(),
    'is_admin', v_admin,
    'my_gender', v_me.gender,
    'my_group', (select group_no from private.consult_members where student_id = v_id),
    'groups', (
      select json_agg(json_build_object(
        'no', g.no,
        'girls', (select count(*) from private.consult_members c join private.students s on s.id = c.student_id where c.group_no = g.no and s.gender = 'F'),
        'boys',  (select count(*) from private.consult_members c join private.students s on s.id = c.student_id where c.group_no = g.no and s.gender = 'M'),
        'members', coalesce((
          select json_agg(json_build_object('id', s.id, 'name', s.name, 'avatar', s.avatar, 'gender', s.gender, 'is_admin', s.is_admin) order by s.name)
            from private.consult_members c join private.students s on s.id = c.student_id
           where c.group_no = g.no and (v_admin or s.gender = v_me.gender)
        ), '[]'::json)
      ) order by g.no)
      from generate_series(1, 4) as g(no)
    ),
    'unassigned', coalesce((
      select json_agg(json_build_object('id', s.id, 'name', s.name, 'avatar', s.avatar, 'gender', s.gender) order by s.name)
        from private.students s
       where not exists (select 1 from private.consult_members c where c.student_id = s.id)
         and (v_admin or s.gender = v_me.gender)
    ), '[]'::json)
  );
end $$;

-- الطالب ينضم لمجموعة (أو يبدل)
create or replace function public.a9_consult_join(p_token uuid, p_group int)
returns json language plpgsql security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token); v_gender char(1); v_cur int;
begin
  if v_id is null then return json_build_object('ok', false, 'error', 'no_session'); end if;
  if private.consult_locked() then return json_build_object('ok', false, 'error', 'locked'); end if;
  if p_group not between 1 and 4 then return json_build_object('ok', false, 'error', 'bad_group'); end if;
  lock table private.consult_members in exclusive mode;  -- حتى ما ينضم اثنين سوة ويعبرون الحد
  select gender into v_gender from private.students where id = v_id;
  select group_no into v_cur from private.consult_members where student_id = v_id;
  if v_cur = p_group then return json_build_object('ok', true); end if;
  if not private.consult_has_room(p_group, v_gender) then return json_build_object('ok', false, 'error', 'full'); end if;
  insert into private.consult_members(student_id, group_no, added_by) values (v_id, p_group, v_id)
  on conflict (student_id) do update set group_no = excluded.group_no, added_by = excluded.added_by, joined_at = now();
  perform private.log(v_id, 'consult_join', null, 'المجموعة ' || p_group);
  return json_build_object('ok', true);
end $$;

-- الطالب يطلع من مجموعته
create or replace function public.a9_consult_leave(p_token uuid)
returns json language plpgsql security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token); v_cur int;
begin
  if v_id is null then return json_build_object('ok', false, 'error', 'no_session'); end if;
  if private.consult_locked() then return json_build_object('ok', false, 'error', 'locked'); end if;
  select group_no into v_cur from private.consult_members where student_id = v_id;
  delete from private.consult_members where student_id = v_id;
  if v_cur is not null then perform private.log(v_id, 'consult_leave', null, 'المجموعة ' || v_cur); end if;
  return json_build_object('ok', true);
end $$;

-- الطالب يضيف صديق من نفس الجنس، بعده ما منضم لمجموعة
create or replace function public.a9_consult_add_friend(p_token uuid, p_friend int)
returns json language plpgsql security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token); v_group int; v_my char(1); v_fg char(1);
begin
  if v_id is null then return json_build_object('ok', false, 'error', 'no_session'); end if;
  if private.consult_locked() then return json_build_object('ok', false, 'error', 'locked'); end if;
  lock table private.consult_members in exclusive mode;
  select group_no into v_group from private.consult_members where student_id = v_id;
  if v_group is null then return json_build_object('ok', false, 'error', 'not_in_group'); end if;
  select gender into v_my from private.students where id = v_id;
  select gender into v_fg from private.students where id = p_friend;
  if v_fg is null or v_fg <> v_my then return json_build_object('ok', false, 'error', 'bad_friend'); end if;
  if exists (select 1 from private.consult_members where student_id = p_friend) then
    return json_build_object('ok', false, 'error', 'already_in_group');
  end if;
  if not private.consult_has_room(v_group, v_fg) then return json_build_object('ok', false, 'error', 'full'); end if;
  insert into private.consult_members(student_id, group_no, added_by) values (p_friend, v_group, v_id);
  perform private.log(v_id, 'consult_add', p_friend, 'المجموعة ' || v_group);
  return json_build_object('ok', true);
end $$;

-- الممثل: يحط أي طالب بأي مجموعة، أو يطلعه (p_group = null). يتجاوز الحدود.
create or replace function public.a9_admin_consult_assign(p_token uuid, p_student int, p_group int)
returns json language plpgsql security definer set search_path = '' as $$
declare v_admin int := private.session_student(p_token);
begin
  if not exists (select 1 from private.students x where x.id = v_admin and x.is_admin) then
    return json_build_object('ok', false, 'error', 'not_admin');
  end if;
  if p_group is null then
    delete from private.consult_members where student_id = p_student;
    perform private.log(v_admin, 'consult_assign', p_student, 'بدون مجموعة');
  else
    if p_group not between 1 and 4 then return json_build_object('ok', false, 'error', 'bad_group'); end if;
    insert into private.consult_members(student_id, group_no, added_by) values (p_student, p_group, v_admin)
    on conflict (student_id) do update set group_no = excluded.group_no, added_by = excluded.added_by, joined_at = now();
    perform private.log(v_admin, 'consult_assign', p_student, 'المجموعة ' || p_group);
  end if;
  return json_build_object('ok', true);
end $$;

-- الممثل: تثبيت المجاميع أو فتحها
create or replace function public.a9_admin_consult_lock(p_token uuid, p_locked boolean)
returns json language plpgsql security definer set search_path = '' as $$
declare v_admin int := private.session_student(p_token);
begin
  if not exists (select 1 from private.students x where x.id = v_admin and x.is_admin) then
    return json_build_object('ok', false, 'error', 'not_admin');
  end if;
  insert into private.settings(key, value, updated_at) values ('consult_locked', case when p_locked then 'true' else 'false' end, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform private.log(v_admin, case when p_locked then 'consult_lock' else 'consult_unlock' end);
  return json_build_object('ok', true);
end $$;

revoke all on function public.a9_consult_view(uuid), public.a9_consult_join(uuid, int), public.a9_consult_leave(uuid),
  public.a9_consult_add_friend(uuid, int), public.a9_admin_consult_assign(uuid, int, int), public.a9_admin_consult_lock(uuid, boolean) from public;
grant execute on function public.a9_consult_view(uuid), public.a9_consult_join(uuid, int), public.a9_consult_leave(uuid),
  public.a9_consult_add_friend(uuid, int), public.a9_admin_consult_assign(uuid, int, int), public.a9_admin_consult_lock(uuid, boolean) to anon, authenticated;

select 'تم' as result;
