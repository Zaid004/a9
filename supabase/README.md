# قاعدة البيانات

المشروع على Supabase اسمه `a9`. الجداول بمخطط `private` وما يگدر أحد يوصلها مباشرة؛
الموقع يتعامل وياها بس عن طريق دوال `a9_*`:

| الدالة | شنو تسوي |
|---|---|
| `a9_list_students()` | قائمة الأسماء ومنو عنده رقم سري |
| `a9_set_pin(id, pin)` | أول مرة: الطالب يختار رقم من 4 أرقام |
| `a9_login(id, pin)` | دخول (5 أغلاط = قفل 15 دقيقة) |
| `a9_me(token)` / `a9_logout(token)` | الجلسة |
| `a9_admin_students(token)` | للمسؤول: حالة كل الطلاب |
| `a9_admin_reset_pin(token, id)` | للمسؤول: تصفير رقم طالب |

الأرقام السرية تنحفظ مشفرة (bcrypt). أسماء الطلاب موجودة بالقاعدة بس، مو بهذا الريبو.

## صورة المجموعة
- `a9_group_photo(token)`: ترجع صورة المجموعة، وبس للي مسجل دخول.
- `a9_admin_set_group_photo(token, photo)`: للممثل، يرفع الصورة أو يحذفها.

الصورة محفوظة بجدول `private.settings`، ومو موجودة بالريبو.

### معرض صور المجموعة
- `a9_group_photo_ids(token)` و `a9_group_photo_data(token, id)`: للمسجلين دخول بس.
- `a9_admin_add_group_photo(token, photo)` و `a9_admin_remove_group_photo(token, id)`: للممثل. الحذف يعلّم الصورة كمحذوفة بدل ما يمسحها.
