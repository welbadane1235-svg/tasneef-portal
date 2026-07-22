-- Tasneef V10814 — فحص قبلي سريع وآمن (قراءة فقط)
-- شغّله قبل ملف الترحيل لمعرفة الأعمدة غير المتوافقة والقيم غير الرقمية.

select table_name,column_name,data_type,udt_name
from information_schema.columns
where table_schema='public'
  and column_name in ('id','project_id','contract_id','service_id','provider_id')
  and table_name in ('projects','project_contract_smart','contracts','contract_services','contract_attachments','contract_change_logs','contract_expiry_notifications','worker_project_assignments','monthly_distribution','monthly_project_distribution','project_assignments')
order by table_name,column_name;

-- يولد تقريرًا للقيم النصية غير الرقمية في project_id، دون افتراض أن projects.id رقمي.
do $$
declare r record;v_type text;v_project_type text;v_sql text;
begin
  create temporary table if not exists contract_id_preflight_v10814(table_name text,column_name text,data_type text,invalid_count bigint,sample_values text[]);
  select format_type(a.atttypid,a.atttypmod) into v_project_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='projects' and a.attname='id' and a.attnum>0 and not a.attisdropped;
  for r in select unnest(array['project_contract_smart','contracts','contract_services','contract_attachments','contract_change_logs','contract_expiry_notifications','worker_project_assignments','monthly_distribution','monthly_project_distribution','project_assignments']) table_name loop
    if to_regclass(format('public.%I',r.table_name)) is null then continue;end if;
    select format_type(a.atttypid,a.atttypmod) into v_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=r.table_name and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
    if v_type is null then continue;end if;
    if v_project_type in('smallint','integer','bigint') then
      v_sql:=format($q$insert into contract_id_preflight_v10814 select %L,'project_id',%L,count(*),(array_agg(distinct project_id::text))[1:10] from public.%I where project_id is not null and trim(project_id::text)<>'' and trim(project_id::text)!~ '^[0-9]+$'$q$,r.table_name,v_type,r.table_name);
    elsif v_project_type='uuid' then
      v_sql:=format($q$insert into contract_id_preflight_v10814 select %L,'project_id',%L,count(*),(array_agg(distinct project_id::text))[1:10] from public.%I where project_id is not null and trim(project_id::text)<>'' and trim(project_id::text)!~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'$q$,r.table_name,v_type,r.table_name);
    else
      v_sql:=format('insert into contract_id_preflight_v10814 values(%L,''project_id'',%L,0,array[]::text[])',r.table_name,v_type);
    end if;
    execute v_sql;
  end loop;
end $$;

select * from contract_id_preflight_v10814 order by table_name;
