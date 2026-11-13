-- منصة A9: جدول الدرجات ودوالها (الدرجات نفسها تنضاف من القاعدة، مو من هذا الملف)
create table if not exists private.grades (
  student_id  int not null references private.students(id),
  rotation    text not null,
  grade       numeric(5,2),
  max_grade   numeric(5,2) not null default 10,
  status      text,              -- مثلاً: محجوبة
  updated_at  timestamptz not null default now(),
  primary key (student_id, rotation)
);

-- الطالب يشوف درجاته هو بس
create or replace function public.a9_my_grades(p_token uuid)
returns table (rotation text, grade numeric, max_grade numeric, status text)
language plpgsql stable security definer set search_path = '' as $$
declare v_id int := private.session_student(p_token);
begin
  if v_id is null then raise exception 'no_session'; end if;
  return query select g.rotation, g.grade, g.max_grade, g.status from private.grades g where g.student_id = v_id;
end $$;

-- الممثل يشوف درجات الكل
create or replace function public.a9_admin_grades(p_token uuid, p_rotation text)
returns table (id int, name text, grade numeric, max_grade numeric, status text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.students x where x.id = private.session_student(p_token) and x.is_admin) then
    raise exception 'not_admin';
  end if;
  return query
    select s.id, s.name, g.grade, g.max_grade, g.status
      from private.students s left join private.grades g on g.student_id = s.id and g.rotation = p_rotation
     order by s.id;
end $$;

revoke all on function public.a9_my_grades(uuid), public.a9_admin_grades(uuid, text) from public;
grant execute on function public.a9_my_grades(uuid), public.a9_admin_grades(uuid, text) to anon, authenticated;

