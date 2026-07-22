-- Tasneef V10815 — فحص آمن للقراءة فقط قبل تثبيت الربط المباشر.
-- لا يعدل أي بيانات دائمة.

create temporary table if not exists v10815_identifier_preflight (
  table_name text,
  column_name text,
  actual_type text,
  total_values bigint,
  invalid_for_bigint bigint,
  sample_invalid_values text
) on commit drop;
truncate v10815_identifier_preflight;

do $$
declare r record;v_total bigint;v_bad bigint;v_sample text;v_type text;
begin
  for r in
    select table_name,column_name
    from information_schema.columns
    where table_schema='public' and column_name='project_id'
      and table_name in (
        'contracts','contract_services','annual_services','contract_attachments','contract_expiry_notifications',
        'project_contract_smart','contract_change_logs','worker_project_assignments','monthly_distribution',
        'monthly_project_distribution','project_assignments'
      )
    order by table_name
  loop
    select format_type(a.atttypid,a.atttypmod) into v_type
    from pg_attribute a
    join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=r.table_name and a.attname=r.column_name and a.attnum>0 and not a.attisdropped;

    execute format('select count(*) from public.%I where %I is not null',r.table_name,r.column_name) into v_total;
    execute format('select count(*) from public.%I where %I is not null and trim(%I::text)<>'''' and trim(%I::text)!~''^[0-9]+$''',r.table_name,r.column_name,r.column_name,r.column_name) into v_bad;
    execute format('select string_agg(v,'', '') from (select distinct %I::text v from public.%I where %I is not null and trim(%I::text)<>'''' and trim(%I::text)!~''^[0-9]+$'' limit 10) q',r.column_name,r.table_name,r.column_name,r.column_name,r.column_name) into v_sample;
    insert into v10815_identifier_preflight values(r.table_name,r.column_name,v_type,v_total,v_bad,v_sample);
  end loop;
end $$;

select
  (select format_type(a.atttypid,a.atttypmod)
   from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname='projects' and a.attname='id' and a.attnum>0 and not a.attisdropped) as projects_id_type,
  p.*
from v10815_identifier_preflight p
order by p.table_name;

select jsonb_build_object(
  'ready',
    (select format_type(a.atttypid,a.atttypmod)='bigint'
     from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='projects' and a.attname='id' and a.attnum>0 and not a.attisdropped)
    and coalesce((select sum(invalid_for_bigint) from v10815_identifier_preflight),0)=0,
  'projects_id_type',
    (select format_type(a.atttypid,a.atttypmod)
     from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relname='projects' and a.attname='id' and a.attnum>0 and not a.attisdropped),
  'invalid_project_id_values',coalesce((select sum(invalid_for_bigint) from v10815_identifier_preflight),0),
  'tables_checked',(select count(*) from v10815_identifier_preflight),
  'instruction',case when coalesce((select sum(invalid_for_bigint) from v10815_identifier_preflight),0)=0 then 'يمكن تشغيل ملف التثبيت V10815' else 'صحح القيم المعروضة قبل تشغيل ملف التثبيت' end
) as result;
