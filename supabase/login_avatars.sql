-- منصة A9: صور الحسابات بقائمة تسجيل الدخول
-- انسخه والصقه بـ Supabase > SQL Editor > New query ثم اضغط Run
create or replace function public.a9_login_avatars()
returns table (id int, avatar text)
language sql stable security definer set search_path = '' as $$
  select s.id, s.avatar from private.students s where s.avatar is not null order by s.id;
$$;
revoke all on function public.a9_login_avatars() from public;
grant execute on function public.a9_login_avatars() to anon, authenticated;
