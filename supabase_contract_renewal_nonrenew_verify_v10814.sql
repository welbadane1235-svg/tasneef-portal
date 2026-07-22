-- Tasneef V10814 — تقرير تحقق بعد تشغيل supabase_contract_renewal_nonrenew_v10814.sql
-- قراءة فقط: لا يعدّل ولا يحذف أي بيانات.

-- 1) الأنواع الفعلية لكل علاقة مهمة، مع مقارنة نوع project_id بنوع projects.id.
with project_type as (
  select format_type(a.atttypid,a.atttypmod) as type_name
  from pg_attribute a
  join pg_class c on c.oid=a.attrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='projects' and a.attname='id' and a.attnum>0 and not a.attisdropped
), cols as (
  select c.relname table_name,a.attname column_name,format_type(a.atttypid,a.atttypmod) data_type
  from pg_attribute a
  join pg_class c on c.oid=a.attrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('projects','project_contract_smart','contracts','contract_services','contract_attachments','contract_change_logs','contract_expiry_notifications','worker_project_assignments','monthly_distribution','monthly_project_distribution','project_assignments')
    and a.attname in ('id','project_id','contract_id','service_id','provider_id','previous_contract_id')
    and a.attnum>0 and not a.attisdropped
)
select table_name,column_name,data_type,
       case when column_name='project_id' then case when data_type=(select type_name from project_type) then 'متوافق' else 'غير متوافق/راجع تقرير الترحيل' end else '-' end compatibility
from cols
order by table_name,column_name;

-- 2) نتيجة محاولات توحيد الأنواع وعدد السجلات التي احتاجت تصحيحًا أو ربطًا يدويًا.
select table_name,column_name,type_before,type_after,rows_checked,rows_converted,issue_count,status,details,run_at
from public.contract_identifier_migration_audit_v10814
order by id;

select table_name,column_name,raw_value,issue,detected_at
from public.contract_identifier_issues_v10814
order by id;

-- 3) توقيعات RPC الفعلية بعد التحديث.
select p.proname as function_name,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as result_type
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'save_contracts_services_editor_v10814',
  'execute_annual_service_v10814',
  'renew_project_contract_v10814',
  'non_renew_project_contract_v10814',
  'sync_contracts_from_smart_v10814',
  'refresh_contract_expiry_notifications_v10814'
)
order by p.proname;

-- 4) أعداد العقود والقرارات والخدمات والمرفقات بعد المزامنة.
select 'العقود حسب الحالة' metric,status detail,count(*)::bigint value from public.contracts group by status
union all
select 'عقود مرتبطة بعقد سابق','previous_contract_id',count(*)::bigint from public.contracts where previous_contract_id is not null
union all
select 'الخدمات المرتبطة بعقد','contract_id',count(*)::bigint from public.contract_services where contract_id is not null
union all
select 'الخدمات الملغاة لعدم التجديد','cancelled_due_to_non_renewal',count(*)::bigint from public.contract_services where status='cancelled_due_to_non_renewal'
union all
select 'المرفقات المرتبطة بعقد','contract_id',count(*)::bigint from public.contract_attachments where contract_id is not null
union all
select 'ملفات العقود المحفوظة في التخزين','storage_path',count(*)::bigint from public.contract_attachments where storage_path is not null
union all
select 'تنبيهات مفتوحة','open',count(*)::bigint from public.contract_expiry_notifications where status='open'
union all
select 'تنبيهات محلولة','resolved',count(*)::bigint from public.contract_expiry_notifications where status='resolved'
order by metric,detail;

-- 5) مشروع الماجدية 70: تقرير استلام دون أي كتابة.
with target as (
  select * from public.projects
  where regexp_replace(lower(coalesce(name,'')),'\s+','','g') like '%الماجدية70%'
     or regexp_replace(lower(coalesce(name,'')),'\s+','','g') like '%ماجدية70%'
  order by id limit 1
)
select 'project' source,to_jsonb(t) data from target t
union all
select 'contracts',coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) from public.contracts c join target t on c.project_id::text=t.id::text
union all
select 'annual_services',coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'::jsonb) from public.contract_services s join target t on s.project_id::text=t.id::text
union all
select 'attachments',coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.contract_attachments a join target t on a.project_id::text=t.id::text
union all
select 'smart_payload',coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from public.project_contract_smart x join target t on x.project_id::text=t.id::text;

-- 6) إثبات عدم وجود DELETE داخل RPC القرار والحفظ، وأن المقارنات صريحة ::text.
select p.proname,
       position('delete from' in lower(pg_get_functiondef(p.oid)))=0 as contains_no_delete,
       position('project_id::text' in lower(pg_get_functiondef(p.oid)))>0 as uses_explicit_project_id_comparison,
       position('for update' in lower(pg_get_functiondef(p.oid)))>0 as uses_row_lock
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('save_contracts_services_editor_v10814','execute_annual_service_v10814','renew_project_contract_v10814','non_renew_project_contract_v10814')
order by p.proname;

-- 7) إثبات بقاء التاريخ: العقود المجددة والعقود الجديدة المرتبطة بها.
select old.id old_contract_id,old.project_id,old.contract_key,old.status old_status,old.end_date old_end_date,
       new.id new_contract_id,new.status new_status,new.start_date new_start_date,new.end_date new_end_date,
       (select count(*) from public.contract_services s where s.contract_id=old.id) old_services,
       (select count(*) from public.contract_services s where s.contract_id=new.id) new_services,
       (select count(*) from public.contract_attachments a where a.contract_id=old.id) old_attachments,
       (select count(*) from public.contract_attachments a where a.contract_id=new.id) new_attachments
from public.contracts old
join public.contracts new on new.previous_contract_id=old.id
order by new.created_at desc;


-- V10814-R2: التحقق من أنواع أعمدة المستخدم بعد إصلاح stopped_by.
select table_name,column_name,data_type,udt_name
from information_schema.columns
where table_schema='public'
  and (table_name,column_name) in (
    ('projects','stopped_by'),
    ('contracts','closed_by'),
    ('contracts','renewed_by'),
    ('contract_expiry_notifications','resolved_by')
  )
order by table_name,column_name;

select jsonb_build_object(
  'actor_type_fix',to_regprocedure('public.contract_actor_value_v10814(text,text)') is not null,
  'renew_rpc',to_regprocedure('public.renew_project_contract_v10814(text,text,text,date,date,numeric,text,jsonb,text,jsonb,date,boolean,text,text)') is not null,
  'non_renew_rpc',to_regprocedure('public.non_renew_project_contract_v10814(text,text,text,text,text,text,text)') is not null
) as actor_fix_result;
