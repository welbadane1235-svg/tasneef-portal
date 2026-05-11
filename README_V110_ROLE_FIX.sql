-- V110 App Users Role Check Fix
-- إصلاح قيد الأدوار حتى يقبل الأدوار الجديدة:
-- مدير عام / مدير مالي / مدير تشغيلي / فني / مشرف

-- توحيد أي أدوار قديمة قبل تعديل القيد
update public.app_users
set role = 'admin'
where role in ('manager', 'مدير', 'مدير عام', 'general');

update public.app_users
set role = 'financial_manager'
where role in ('مدير مالي', 'finance_manager', 'finance');

update public.app_users
set role = 'operations_manager'
where role in ('مدير تشغيلي', 'operation_manager', 'ops_manager', 'ops');

update public.app_users
set role = 'technician'
where role in ('فني', 'tech');

update public.app_users
set role = 'supervisor'
where role in ('مشرف');

-- حذف قيد الدور القديم وإضافة القيد الجديد
alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check
  check (role in (
    'admin',
    'general_manager',
    'financial_manager',
    'operations_manager',
    'technician',
    'supervisor'
  ));

-- تأكيد الصلاحيات الأساسية
alter table if exists public.app_users enable row level security;

drop policy if exists app_users_all_access on public.app_users;
create policy app_users_all_access on public.app_users
for all to anon, authenticated
using (true)
with check (true);

grant select, insert, update, delete on public.app_users to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
