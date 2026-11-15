-- منصة A9: كاش الصور (تقليل الاستهلاك). مطبق على القاعدة.
-- الصورة تنزل للموبايل مرة وحدة وتنحفظ بـ localStorage، وبعدها السيرفر يرجع بس رقم النسخة (avatar_v).
-- الدوال: a9_members_lite, a9_avatars, a9_login_avatar_versions, a9_login_avatars_by_id
-- a9_set_avatar يرجع {ok, v}. a9_conversations و a9_consult_view و xo_json صارت ترجع بدون صور.
alter table private.students add column if not exists avatar_v bigint;
