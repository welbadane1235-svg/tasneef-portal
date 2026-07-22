-- Tasneef V10814 — تجديد العقود / عدم التجديد / إصلاح أنواع المعرفات
-- آمن لإعادة التشغيل. لا يحذف العقود أو الخدمات أو المرفقات أو السجلات التاريخية.
-- نفّذ الملف كاملًا من Supabase SQL Editor بصلاحية postgres.

begin;

create table if not exists public.contract_identifier_migration_audit_v10814 (
  id bigserial primary key,
  table_name text not null,
  column_name text not null,
  type_before text,
  type_after text,
  rows_checked bigint not null default 0,
  rows_converted bigint not null default 0,
  issue_count bigint not null default 0,
  status text not null,
  details text,
  run_at timestamptz not null default now()
);

create table if not exists public.contract_identifier_issues_v10814 (
  id bigserial primary key,
  table_name text not null,
  column_name text not null,
  raw_value text,
  issue text not null,
  detected_at timestamptz not null default now()
);

-- فحص ومحاولة توحيد project_id مع النوع الفعلي لـ projects.id.
-- لا يتم التحويل إذا وُجدت قيمة غير قابلة للتحويل؛ تُسجل بدلًا من حذفها أو تخمين ربطها.
do $$
declare
  v_target_type text;
  v_source_type text;
  v_total bigint;
  v_invalid bigint;
  v_rows bigint;
  r record;
begin
  select format_type(a.atttypid,a.atttypmod)
    into v_target_type
  from pg_attribute a
  join pg_class c on c.oid=a.attrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='projects' and a.attname='id' and a.attnum>0 and not a.attisdropped;

  if v_target_type is null then
    raise exception 'تعذر تحديد نوع public.projects.id';
  end if;

  for r in
    select * from (values
      ('project_contract_smart','project_id'),
      ('contract_services','project_id'),
      ('contract_attachments','project_id'),
      ('contract_change_logs','project_id'),
      ('worker_project_assignments','project_id'),
      ('monthly_distribution','project_id'),
      ('monthly_project_distribution','project_id'),
      ('project_assignments','project_id')
    ) as x(table_name,column_name)
  loop
    if to_regclass(format('public.%I',r.table_name)) is null then
      continue;
    end if;

    select format_type(a.atttypid,a.atttypmod)
      into v_source_type
    from pg_attribute a
    join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=r.table_name and a.attname=r.column_name and a.attnum>0 and not a.attisdropped;

    if v_source_type is null then
      continue;
    end if;

    execute format('select count(*) from public.%I where %I is not null',r.table_name,r.column_name) into v_total;

    if v_source_type=v_target_type then
      insert into public.contract_identifier_migration_audit_v10814(table_name,column_name,type_before,type_after,rows_checked,rows_converted,issue_count,status,details)
      values(r.table_name,r.column_name,v_source_type,v_target_type,v_total,0,0,'already_aligned','لا يحتاج تحويل');
      continue;
    end if;

    v_invalid:=0;
    if v_target_type in ('smallint','integer','bigint') then
      execute format($q$select count(*) from public.%I where %I is not null and trim(%I::text)<>'' and trim(%I::text)!~ '^[0-9]+$'$q$,r.table_name,r.column_name,r.column_name,r.column_name) into v_invalid;
    elsif v_target_type='uuid' then
      execute format($q$select count(*) from public.%I where %I is not null and trim(%I::text)<>'' and trim(%I::text)!~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'$q$,r.table_name,r.column_name,r.column_name,r.column_name) into v_invalid;
    elsif v_target_type like 'text%' or v_target_type like 'character varying%' or v_target_type like 'character%' then
      v_invalid:=0;
    else
      v_invalid:=v_total;
    end if;

    if v_invalid>0 then
      if v_target_type in ('smallint','integer','bigint') then
        execute format($q$insert into public.contract_identifier_issues_v10814(table_name,column_name,raw_value,issue)
          select %L,%L,%I::text,'سجل يحتاج ربط مشروع قبل تحويل النوع'
          from public.%I where %I is not null and trim(%I::text)<>'' and trim(%I::text)!~ '^[0-9]+$' limit 500$q$,
          r.table_name,r.column_name,r.column_name,r.table_name,r.column_name,r.column_name,r.column_name);
      elsif v_target_type='uuid' then
        execute format($q$insert into public.contract_identifier_issues_v10814(table_name,column_name,raw_value,issue)
          select %L,%L,%I::text,'سجل يحتاج ربط مشروع قبل تحويل النوع'
          from public.%I where %I is not null and trim(%I::text)<>'' and trim(%I::text)!~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' limit 500$q$,
          r.table_name,r.column_name,r.column_name,r.table_name,r.column_name,r.column_name,r.column_name);
      end if;
      insert into public.contract_identifier_migration_audit_v10814(table_name,column_name,type_before,type_after,rows_checked,rows_converted,issue_count,status,details)
      values(r.table_name,r.column_name,v_source_type,v_target_type,v_total,0,v_invalid,'needs_manual_link','لم يتغير النوع لوجود قيم تحتاج ربطًا يدويًا');
      continue;
    end if;

    begin
      execute format('alter table public.%I alter column %I type %s using nullif(trim(%I::text),'''')::%s',r.table_name,r.column_name,v_target_type,r.column_name,v_target_type);
      get diagnostics v_rows = row_count;
      insert into public.contract_identifier_migration_audit_v10814(table_name,column_name,type_before,type_after,rows_checked,rows_converted,issue_count,status,details)
      values(r.table_name,r.column_name,v_source_type,v_target_type,v_total,v_total,0,'aligned','تم توحيد النوع بأمان مع projects.id');
    exception when others then
      insert into public.contract_identifier_migration_audit_v10814(table_name,column_name,type_before,type_after,rows_checked,rows_converted,issue_count,status,details)
      values(r.table_name,r.column_name,v_source_type,v_target_type,v_total,0,0,'conversion_failed',sqlerrm);
    end;
  end loop;
end $$;

-- إنشاء سجل العقود التاريخي بنفس نوع projects.id الفعلي.
do $$
declare v_project_type text;
begin
  select format_type(a.atttypid,a.atttypmod) into v_project_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='projects' and a.attname='id' and a.attnum>0 and not a.attisdropped;

  execute format($q$
    create table if not exists public.contracts (
      id bigserial primary key,
      project_id %s not null,
      project_name text,
      contract_key text not null default 'operation',
      contract_type text,
      contract_number text,
      provider text,
      start_date date,
      end_date date,
      contract_value numeric(14,2) not null default 0,
      status text not null default 'draft',
      is_active boolean not null default true,
      previous_contract_id bigint references public.contracts(id),
      source_key text,
      non_renewal_reason text,
      non_renewal_details text,
      alert_next_date date,
      notes text,
      payload jsonb not null default '{}'::jsonb,
      renewed_at timestamptz,
      renewed_by text,
      closed_at timestamptz,
      closed_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )$q$,v_project_type);

  execute format($q$
    create table if not exists public.contract_expiry_notifications (
      id bigserial primary key,
      project_id %s not null,
      contract_id bigint references public.contracts(id),
      notification_key text not null,
      status text not null default 'open',
      resolution text,
      resolved_at timestamptz,
      resolved_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )$q$,v_project_type);
end $$;

-- إذا كانت الجداول موجودة سابقًا، توحيد project_id فيها أيضًا مع projects.id عند إمكان التحويل الآمن.
do $$
declare v_target_type text;v_source_type text;v_invalid bigint;v_total bigint;r record;
begin
  select format_type(a.atttypid,a.atttypmod) into v_target_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='projects' and a.attname='id' and a.attnum>0 and not a.attisdropped;
  for r in select unnest(array['contracts','contract_expiry_notifications']) table_name loop
    select format_type(a.atttypid,a.atttypmod) into v_source_type
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=r.table_name and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
    if v_source_type is null or v_source_type=v_target_type then continue;end if;
    execute format('select count(*) from public.%I where project_id is not null',r.table_name) into v_total;
    if v_target_type in('smallint','integer','bigint') then execute format($q$select count(*) from public.%I where project_id is not null and trim(project_id::text)<>'' and trim(project_id::text)!~ '^[0-9]+$'$q$,r.table_name) into v_invalid;
    elsif v_target_type='uuid' then execute format($q$select count(*) from public.%I where project_id is not null and trim(project_id::text)<>'' and trim(project_id::text)!~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'$q$,r.table_name) into v_invalid;
    else v_invalid:=0;end if;
    if v_invalid=0 then
      begin
        execute format('alter table public.%I alter column project_id type %s using nullif(trim(project_id::text),'''')::%s',r.table_name,v_target_type,v_target_type);
        insert into public.contract_identifier_migration_audit_v10814(table_name,column_name,type_before,type_after,rows_checked,rows_converted,issue_count,status,details) values(r.table_name,'project_id',v_source_type,v_target_type,v_total,v_total,0,'aligned','تم توحيد النوع بأمان مع projects.id');
      exception when others then
        insert into public.contract_identifier_migration_audit_v10814(table_name,column_name,type_before,type_after,rows_checked,rows_converted,issue_count,status,details) values(r.table_name,'project_id',v_source_type,v_target_type,v_total,0,0,'conversion_failed',sqlerrm);
      end;
    else
      insert into public.contract_identifier_migration_audit_v10814(table_name,column_name,type_before,type_after,rows_checked,rows_converted,issue_count,status,details) values(r.table_name,'project_id',v_source_type,v_target_type,v_total,0,v_invalid,'needs_manual_link','لم يتغير النوع لوجود قيم تحتاج ربطًا يدويًا');
    end if;
  end loop;
end $$;

alter table public.contracts add column if not exists project_name text;
alter table public.contracts add column if not exists contract_key text default 'operation';
alter table public.contracts add column if not exists contract_type text;
alter table public.contracts add column if not exists contract_number text;
alter table public.contracts add column if not exists provider text;
alter table public.contracts add column if not exists start_date date;
alter table public.contracts add column if not exists end_date date;
alter table public.contracts add column if not exists contract_value numeric(14,2) default 0;
alter table public.contracts add column if not exists status text default 'draft';
alter table public.contracts add column if not exists is_active boolean default true;
alter table public.contracts add column if not exists previous_contract_id bigint;
alter table public.contracts add column if not exists source_key text;
alter table public.contracts add column if not exists non_renewal_reason text;
alter table public.contracts add column if not exists non_renewal_details text;
alter table public.contracts add column if not exists alert_next_date date;
alter table public.contracts add column if not exists notes text;
alter table public.contracts add column if not exists payload jsonb default '{}'::jsonb;
alter table public.contracts add column if not exists renewed_at timestamptz;
alter table public.contracts add column if not exists renewed_by text;
alter table public.contracts add column if not exists closed_at timestamptz;
alter table public.contracts add column if not exists closed_by text;
alter table public.contracts add column if not exists created_at timestamptz default now();
alter table public.contracts add column if not exists updated_at timestamptz default now();

alter table public.contract_expiry_notifications add column if not exists notification_key text;
alter table public.contract_expiry_notifications add column if not exists status text default 'open';
alter table public.contract_expiry_notifications add column if not exists resolution text;
alter table public.contract_expiry_notifications add column if not exists resolved_at timestamptz;
alter table public.contract_expiry_notifications add column if not exists resolved_by text;
alter table public.contract_expiry_notifications add column if not exists created_at timestamptz default now();
alter table public.contract_expiry_notifications add column if not exists updated_at timestamptz default now();

create unique index if not exists uq_contracts_source_key_v10814 on public.contracts(source_key) where source_key is not null;
create unique index if not exists uq_contract_expiry_notification_key_v10814 on public.contract_expiry_notifications(notification_key);
create index if not exists idx_contracts_project_status_v10814 on public.contracts(project_id,status,is_active,end_date);

-- أعمدة الربط والحفظ التاريخي دون حذف البيانات القديمة.
alter table if exists public.contract_services add column if not exists contract_id bigint;
alter table if exists public.contract_services add column if not exists cancelled_at timestamptz;
alter table if exists public.contract_services add column if not exists cancellation_reason text;
alter table if exists public.contract_attachments add column if not exists contract_id bigint;
alter table if exists public.contract_attachments add column if not exists storage_bucket text;
alter table if exists public.contract_attachments add column if not exists storage_path text;
alter table if exists public.contract_attachments add column if not exists mime_type text;
alter table if exists public.contract_attachments add column if not exists size_bytes bigint;

-- تخزين خاص بعقود التجديد. المرفق لا يُحذف عند إيقاف المشروع.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('contract-files','contract-files',false,10485760,array['application/pdf','image/jpeg','image/png']::text[])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists contract_files_select_v10814 on storage.objects;
create policy contract_files_select_v10814 on storage.objects for select to anon,authenticated using(bucket_id='contract-files');
drop policy if exists contract_files_insert_v10814 on storage.objects;
create policy contract_files_insert_v10814 on storage.objects for insert to anon,authenticated with check(bucket_id='contract-files');
drop policy if exists contract_files_delete_failed_upload_v10814 on storage.objects;
create policy contract_files_delete_failed_upload_v10814 on storage.objects for delete to anon,authenticated using(bucket_id='contract-files');

alter table public.projects add column if not exists is_active boolean default true;
alter table public.projects add column if not exists status text default 'active';
alter table public.projects add column if not exists stopped_reason text;
alter table public.projects add column if not exists stopped_at timestamptz;
alter table public.projects add column if not exists stopped_by text;

-- إضافة أعمدة إنهاء التوزيع فقط للجداول الموجودة.
do $$
declare r record;
begin
  for r in select unnest(array['worker_project_assignments','monthly_distribution','monthly_project_distribution','project_assignments']) table_name loop
    if to_regclass(format('public.%I',r.table_name)) is not null then
      execute format('alter table public.%I add column if not exists end_date date',r.table_name);
      execute format('alter table public.%I add column if not exists end_reason text',r.table_name);
      execute format('alter table public.%I add column if not exists is_active boolean default true',r.table_name);
      execute format('alter table public.%I add column if not exists updated_at timestamptz default now()',r.table_name);
    end if;
  end loop;
end $$;

-- مزامنة العقود القديمة من payload إلى سجل العقود التاريخي دون حذف payload.
create or replace function public.sync_contracts_from_smart_v10814()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_target_type text;
  v_row record;
  v_key text;
  v_contract jsonb;
  v_project jsonb;
  v_project_name text;
  v_start date;
  v_end date;
  v_status text;
  v_source text;
  v_count integer:=0;
begin
  select format_type(a.atttypid,a.atttypmod) into v_target_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='contracts' and a.attname='project_id' and a.attnum>0 and not a.attisdropped;

  if to_regclass('public.project_contract_smart') is null then
    return jsonb_build_object('ok',true,'synced',0,'message','لا يوجد جدول project_contract_smart');
  end if;

  for v_row in execute 'select project_id::text project_id_text,coalesce(payload,''{}''::jsonb) payload from public.project_contract_smart' loop
    v_project:=null;
    execute 'select to_jsonb(p) from public.projects p where p.id::text=$1 limit 1' into v_project using v_row.project_id_text;
    if v_project is null then
      insert into public.contract_identifier_issues_v10814(table_name,column_name,raw_value,issue)
      values('project_contract_smart','project_id',v_row.project_id_text,'سجل عقد ذكي لا يرتبط بمشروع موجود');
      continue;
    end if;
    v_project_name:=coalesce(v_project->>'name','');
    foreach v_key in array array['operation','elevators','pools','civilDefense','cleaning','maintenance'] loop
      v_contract:=coalesce(v_row.payload->'contracts'->v_key,'{}'::jsonb);
      if v_key<>'operation' and lower(coalesce(v_contract->>'enabled','false')) not in ('true','1','yes') then continue; end if;
      v_start:=nullif(coalesce(v_contract->>'start_date',case when v_key='operation' then coalesce(v_project->>'contract_start',v_project->>'start_date') end,''),'')::date;
      v_end:=nullif(coalesce(v_contract->>'end_date',case when v_key='operation' then coalesce(v_project->>'contract_end',v_project->>'end_date') end,''),'')::date;
      if v_start is null and v_end is null and coalesce(v_contract->>'contract_number','')='' then continue; end if;
      v_status:=case when v_end is null then 'draft' when v_end<current_date then 'expired' when v_end<=current_date+30 then 'expiring' else 'active' end;
      v_source:=concat('smart:',v_row.project_id_text,':',v_key,':',coalesce(v_start::text,''),':',coalesce(v_end::text,''));
      execute format($q$insert into public.contracts(project_id,project_name,contract_key,contract_type,contract_number,provider,start_date,end_date,contract_value,status,is_active,source_key,notes,payload,created_at,updated_at)
        values(($1)::%s,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12,$13,now(),now())
        on conflict(source_key) where source_key is not null do update set project_name=excluded.project_name,contract_number=excluded.contract_number,provider=excluded.provider,start_date=excluded.start_date,end_date=excluded.end_date,contract_value=excluded.contract_value,payload=excluded.payload,updated_at=now()
        returning id$q$,v_target_type)
      using v_row.project_id_text,v_project_name,v_key,
        case v_key when 'operation' then 'عقد التشغيل الأساسي' when 'elevators' then 'عقد المصاعد' when 'pools' then 'عقد المسابح' when 'civilDefense' then 'عقد الدفاع المدني' when 'cleaning' then 'عقد النظافة' else 'عقد الصيانة' end,
        coalesce(v_contract->>'contract_number',''),coalesce(v_contract->>'provider',''),v_start,v_end,coalesce(nullif(v_contract->>'value','')::numeric,0),v_status,v_source,coalesce(v_contract->>'notes',''),v_contract;
      v_count:=v_count+1;
    end loop;
  end loop;
  return jsonb_build_object('ok',true,'synced',v_count);
end $$;

-- حفظ النافذة: project_id نص في واجهة RPC، والمقارنة دائمًا صريحة بواسطة ::text.
create or replace function public.save_contracts_services_editor_v10814(
  p_project_id text,
  p_expected_smart_updated_at timestamptz,
  p_smart_payload jsonb,
  p_project_changes jsonb,
  p_service_changes jsonb,
  p_new_services jsonb,
  p_archived_ids jsonb,
  p_audit_rows jsonb,
  p_user_id text,
  p_user_name text,
  p_reason text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_now timestamptz:=now();
  v_project jsonb;
  v_item jsonb;
  v_smart_type text;
  v_service_project_type text;
  v_audit_project_type text;
  v_smart_updated timestamptz;
  v_service_updated timestamptz;
  v_id text;
  v_updated integer:=0;
  v_inserted integer:=0;
  v_archived integer:=0;
begin
  if nullif(trim(p_project_id),'') is null then raise exception 'project_id is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_project_id,10814));
  execute 'select to_jsonb(p) from public.projects p where p.id::text=$1 limit 1' into v_project using p_project_id;
  if v_project is null then raise exception 'المشروع المحدد غير موجود'; end if;

  select format_type(a.atttypid,a.atttypmod) into v_smart_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='project_contract_smart' and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
  execute 'select updated_at from public.project_contract_smart where project_id::text=$1 for update' into v_smart_updated using p_project_id;
  if p_expected_smart_updated_at is not null and v_smart_updated is distinct from p_expected_smart_updated_at then raise exception 'تم تعديل هذا السجل من مستخدم آخر. حدّث البيانات قبل الحفظ.'; end if;
  execute format('insert into public.project_contract_smart(project_id,payload,updated_at,updated_by) values(($1)::%s,$2,$3,$4) on conflict(project_id) do update set payload=excluded.payload,updated_at=excluded.updated_at,updated_by=excluded.updated_by',v_smart_type)
    using p_project_id,coalesce(p_smart_payload,'{}'::jsonb),v_now,case when p_user_id~'^[0-9]+$' then p_user_id::bigint else null end;

  if coalesce(p_project_changes,'{}'::jsonb)?'contract_start'
     and exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='contract_start') then
    execute 'update public.projects set contract_start=nullif($1,'''')::date where id::text=$2' using p_project_changes->>'contract_start',p_project_id;
  end if;
  if coalesce(p_project_changes,'{}'::jsonb)?'contract_end'
     and exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='contract_end') then
    execute 'update public.projects set contract_end=nullif($1,'''')::date where id::text=$2' using p_project_changes->>'contract_end',p_project_id;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_service_changes,'[]'::jsonb)) loop
    v_id:=v_item->>'id';
    execute 'select updated_at from public.contract_services where id::text=$1 and project_id::text=$2 for update' into v_service_updated using v_id,p_project_id;
    if not found then raise exception 'الخدمة المحددة غير موجودة داخل المشروع'; end if;
    if nullif(v_item->>'expected_updated_at','') is not null and v_service_updated is distinct from (v_item->>'expected_updated_at')::timestamptz then raise exception 'تم تعديل إحدى الخدمات من مستخدم آخر. حدّث البيانات قبل الحفظ.'; end if;
    update public.contract_services set
      service_name=coalesce(v_item->>'service_name',service_name),service_type=coalesce(v_item->>'service_type',service_type),frequency=coalesce(v_item->>'frequency',frequency),
      visit_count=coalesce(nullif(v_item->>'visit_count','')::integer,visit_count),executed_count=coalesce(nullif(v_item->>'executed_count','')::integer,executed_count),
      remaining_count=greatest(coalesce(nullif(v_item->>'visit_count','')::integer,visit_count)-coalesce(nullif(v_item->>'executed_count','')::integer,executed_count),0),
      start_date=case when v_item?'start_date' then nullif(v_item->>'start_date','')::date else start_date end,end_date=case when v_item?'end_date' then nullif(v_item->>'end_date','')::date else end_date end,
      last_execution_date=case when v_item?'last_execution_date' then nullif(v_item->>'last_execution_date','')::date else last_execution_date end,next_due_date=case when v_item?'next_due_date' then nullif(v_item->>'next_due_date','')::date else next_due_date end,
      status=coalesce(v_item->>'status',status),executor_name=coalesce(v_item->>'executor_name',executor_name),notes=coalesce(v_item->>'notes',notes),is_archived=coalesce(nullif(v_item->>'is_archived','')::boolean,is_archived),updated_at=v_now
    where id::text=v_id and project_id::text=p_project_id;
    v_updated:=v_updated+1;
  end loop;

  select format_type(a.atttypid,a.atttypmod) into v_service_project_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='contract_services' and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
  for v_item in select value from jsonb_array_elements(coalesce(p_new_services,'[]'::jsonb)) loop
    execute format($q$insert into public.contract_services(project_id,project_name,service_name,service_type,frequency,visit_count,executed_count,remaining_count,start_date,end_date,last_execution_date,next_due_date,status,executor_name,notes,is_archived,created_at,updated_at)
      values(($1)::%s,$2,$3,$4,$5,$6,$7,greatest($6-$7,0),$8,$9,$10,$11,$12,$13,$14,false,$15,$15)$q$,v_service_project_type)
    using p_project_id,coalesce(v_project->>'name',''),coalesce(v_item->>'service_name',''),coalesce(v_item->>'service_type',v_item->>'service_name',''),coalesce(v_item->>'frequency','سنوي'),coalesce(nullif(v_item->>'visit_count','')::integer,1),coalesce(nullif(v_item->>'executed_count','')::integer,0),nullif(v_item->>'start_date','')::date,nullif(v_item->>'end_date','')::date,nullif(v_item->>'last_execution_date','')::date,nullif(v_item->>'next_due_date','')::date,coalesce(v_item->>'status','مستحقة'),coalesce(v_item->>'executor_name',''),coalesce(v_item->>'notes',''),v_now;
    v_inserted:=v_inserted+1;
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(p_archived_ids,'[]'::jsonb)) loop
    update public.contract_services set is_archived=true,archived_at=v_now,archived_by=case when p_user_id~'^[0-9]+$' then p_user_id::bigint else null end,archive_reason=p_reason,updated_at=v_now where id::text=trim(both '"' from v_item::text) and project_id::text=p_project_id;
    if found then v_archived:=v_archived+1; end if;
  end loop;

  select format_type(a.atttypid,a.atttypmod) into v_audit_project_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='contract_change_logs' and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
  for v_item in select value from jsonb_array_elements(coalesce(p_audit_rows,'[]'::jsonb)) loop
    execute format('insert into public.contract_change_logs(entity_type,entity_id,project_id,field_name,old_value,new_value,changed_by,changed_by_name,changed_at,reason) values(''contracts_services'',$1,($2)::%s,$3,$4,$5,$6,$7,$8,$9)',v_audit_project_type)
    using coalesce(nullif(v_item->>'entity_id',''),p_project_id),p_project_id,coalesce(v_item->>'field_name','unknown'),v_item->'old_value',v_item->'new_value',case when p_user_id~'^[0-9]+$' then p_user_id::bigint else null end,p_user_name,v_now,p_reason;
  end loop;

  perform public.sync_contracts_from_smart_v10814();
  return jsonb_build_object('ok',true,'project_id',p_project_id,'updated_services',v_updated,'inserted_services',v_inserted,'archived_services',v_archived,'saved_at',v_now);
end $$;

create or replace function public.execute_annual_service_v10814(
  p_service_id text,p_project_id text,p_execution_date date,p_executor text,p_notes text,p_user_id text,p_user_name text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.contract_services%rowtype;v_now timestamptz:=now();v_new_done integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(concat(p_project_id,':',p_service_id),10814));
  select * into v_row from public.contract_services where id::text=p_service_id and project_id::text=p_project_id for update;
  if not found then raise exception 'الخدمة المحددة غير موجودة داخل المشروع'; end if;
  if coalesce(v_row.is_archived,false) then raise exception 'لا يمكن تنفيذ خدمة مؤرشفة'; end if;
  v_new_done:=least(coalesce(v_row.executed_count,0)+1,greatest(coalesce(v_row.visit_count,0),1));
  update public.contract_services set executed_count=v_new_done,remaining_count=greatest(coalesce(visit_count,0)-v_new_done,0),last_execution_date=coalesce(p_execution_date,current_date),executor_name=coalesce(nullif(p_executor,''),executor_name),notes=concat_ws(E'\n',nullif(notes,''),nullif(p_notes,'')),status=case when greatest(coalesce(visit_count,0)-v_new_done,0)=0 then 'مكتملة' else 'منفذة جزئيًا' end,updated_at=v_now where id::text=p_service_id and project_id::text=p_project_id;
  perform public.write_contract_audit_v10814(p_project_id,'annual_service',p_service_id,'executed_count',to_jsonb(coalesce(v_row.executed_count,0)),to_jsonb(v_new_done),p_user_id,p_user_name,concat_ws(' — ','تنفيذ خدمة سنوية',p_notes));
  return jsonb_build_object('ok',true,'service_id',p_service_id,'executed_count',v_new_done,'remaining_count',greatest(coalesce(v_row.visit_count,0)-v_new_done,0));
end $$;


create or replace function public.write_contract_audit_v10814(
  p_project_id text,p_entity_type text,p_entity_id text,p_field_name text,p_old_value jsonb,p_new_value jsonb,p_user_id text,p_user_name text,p_reason text
) returns void language plpgsql security definer set search_path=public as $$
declare v_type text;
begin
  if to_regclass('public.contract_change_logs') is null then return;end if;
  select format_type(a.atttypid,a.atttypmod) into v_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='contract_change_logs' and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
  execute format('insert into public.contract_change_logs(entity_type,entity_id,project_id,field_name,old_value,new_value,changed_by,changed_by_name,changed_at,reason) values($1,$2,($3)::%s,$4,$5,$6,$7,$8,now(),$9)',v_type)
  using p_entity_type,p_entity_id,p_project_id,p_field_name,p_old_value,p_new_value,case when p_user_id~'^[0-9]+$' then p_user_id::bigint else null end,p_user_name,p_reason;
end $$;



-- V10814 R2: تحويل معرف المستخدم حسب النوع الفعلي للعمود دون تغيير نوع الأعمدة القديمة.
create or replace function public.contract_actor_value_v10814(
  p_user_id text,
  p_target_type text
) returns text
language plpgsql
immutable
as $$
declare
  v text:=nullif(btrim(coalesce(p_user_id,'')),'');
  t text:=lower(coalesce(p_target_type,''));
begin
  if v is null then return null; end if;
  if t in ('bigint','integer','smallint','numeric','decimal','real','double precision') or t like 'numeric(%' or t like 'decimal(%' then
    if v ~ '^[+-]?[0-9]+$' then return v; end if;
    return null;
  end if;
  if t='uuid' then
    if v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return v; end if;
    return null;
  end if;
  return v;
end $$;

create or replace function public.renew_project_contract_v10814(
  p_project_id text,p_contract_id text,p_contract_key text,p_new_start date,p_new_end date,p_new_value numeric,p_provider text,p_annual_services jsonb,p_notes text,p_attachment jsonb,p_alert_date date,p_reactivate boolean,p_user_id text,p_user_name text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_old public.contracts%rowtype;v_new_id bigint;v_now timestamptz:=now();v_target_type text;v_service_type text;v_attachment_type text;v_item jsonb;v_project jsonb;v_payload jsonb;v_smart_type text;v_old_end date;v_notification_key text;v_service_count integer:=0;v_actor_type text;v_actor_value text;
begin
  if p_new_start is null or p_new_end is null or p_new_end<p_new_start then raise exception 'تواريخ العقد الجديد غير صالحة'; end if;
  perform pg_advisory_xact_lock(hashtextextended(concat(p_project_id,':',p_contract_key),10814));
  execute 'select to_jsonb(p) from public.projects p where p.id::text=$1 limit 1 for update' into v_project using p_project_id;
  if v_project is null then raise exception 'المشروع المحدد غير موجود'; end if;

  if nullif(p_contract_id,'') is not null then select * into v_old from public.contracts where id::text=p_contract_id and project_id::text=p_project_id for update; end if;
  if v_old.id is null then select * into v_old from public.contracts where project_id::text=p_project_id and contract_key=p_contract_key and is_active=true order by created_at desc limit 1 for update; end if;

  if v_old.id is null then
    if to_regclass('public.project_contract_smart') is not null then execute 'select payload from public.project_contract_smart where project_id::text=$1 limit 1' into v_payload using p_project_id; end if;
    v_payload:=coalesce(v_payload,'{}'::jsonb);v_old_end:=nullif(coalesce(v_payload->'contracts'->p_contract_key->>'end_date',case when p_contract_key='operation' then coalesce(v_project->>'contract_end',v_project->>'end_date') end,''),'')::date;
    select format_type(a.atttypid,a.atttypmod) into v_target_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='contracts' and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
    execute format($q$insert into public.contracts(project_id,project_name,contract_key,contract_type,contract_number,provider,start_date,end_date,contract_value,status,is_active,source_key,notes,payload,created_at,updated_at)
      values(($1)::%s,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11,$12,$13,$14,$14) returning *$q$,v_target_type)
    into v_old using p_project_id,coalesce(v_project->>'name',''),p_contract_key,coalesce(v_payload->'contracts'->p_contract_key->>'title',p_contract_key),coalesce(v_payload->'contracts'->p_contract_key->>'contract_number',''),coalesce(v_payload->'contracts'->p_contract_key->>'provider',''),nullif(v_payload->'contracts'->p_contract_key->>'start_date','')::date,v_old_end,coalesce(nullif(v_payload->'contracts'->p_contract_key->>'value','')::numeric,0),case when v_old_end is null then 'draft' when v_old_end<current_date then 'expired' when v_old_end<=current_date+30 then 'expiring' else 'active' end,concat('materialized:',p_project_id,':',p_contract_key,':',coalesce(v_old_end::text,'')),coalesce(v_payload->'contracts'->p_contract_key->>'notes',''),coalesce(v_payload->'contracts'->p_contract_key,'{}'::jsonb),v_now;
  end if;

  v_old_end:=v_old.end_date;
  -- ربط الخدمات والمرفقات القديمة بالعقد القديم قبل إنشاء العقد الجديد؛ لا يتم حذف أو نقل التنفيذات التاريخية.
  if to_regclass('public.contract_services') is not null then
    update public.contract_services
       set contract_id=v_old.id,updated_at=v_now
     where project_id::text=p_project_id
       and contract_id is null
       and coalesce(is_archived,false)=false
       and (start_date is null or v_old.end_date is null or start_date<=v_old.end_date);
  end if;
  if to_regclass('public.contract_attachments') is not null then
    update public.contract_attachments
       set contract_id=v_old.id,updated_at=v_now
     where project_id::text=p_project_id
       and contract_id is null
       and (contract_key is null or contract_key=p_contract_key);
  end if;
  select format_type(a.atttypid,a.atttypmod) into v_actor_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='contracts' and a.attname='renewed_by' and a.attnum>0 and not a.attisdropped;
  v_actor_value:=public.contract_actor_value_v10814(p_user_id,v_actor_type);
  if v_actor_type is null then
    update public.contracts set status='renewed',is_active=false,renewed_at=v_now,updated_at=v_now where id=v_old.id;
  else
    execute format('update public.contracts set status=''renewed'',is_active=false,renewed_at=$1,renewed_by=($2)::%s,updated_at=$1 where id=$3',v_actor_type)
      using v_now,v_actor_value,v_old.id;
  end if;
  select format_type(a.atttypid,a.atttypmod) into v_target_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='contracts' and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
  execute format($q$insert into public.contracts(project_id,project_name,contract_key,contract_type,contract_number,provider,start_date,end_date,contract_value,status,is_active,previous_contract_id,alert_next_date,notes,payload,created_at,updated_at)
    values(($1)::%s,$2,$3,$4,$5,$6,$7,$8,$9,'active',true,$10,$11,$12,$13,$14,$14) returning id$q$,v_target_type)
  into v_new_id using p_project_id,coalesce(v_project->>'name',''),p_contract_key,coalesce(v_old.contract_type,p_contract_key),v_old.contract_number,p_provider,p_new_start,p_new_end,coalesce(p_new_value,0),v_old.id,p_alert_date,p_notes,jsonb_build_object('contract_number',v_old.contract_number,'provider',p_provider,'start_date',p_new_start,'end_date',p_new_end,'value',coalesce(p_new_value,0),'status','active','enabled',true),v_now;

  select format_type(a.atttypid,a.atttypmod) into v_service_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='contract_services' and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
  for v_item in select value from jsonb_array_elements(coalesce(p_annual_services,'[]'::jsonb)) loop
    execute format($q$insert into public.contract_services(project_id,contract_id,project_name,service_name,service_type,frequency,visit_count,executed_count,remaining_count,start_date,end_date,status,notes,is_archived,created_at,updated_at)
      values(($1)::%s,$2,$3,$4,$4,$5,$6,0,$6,$7,$8,'مستحقة',$9,false,$10,$10)$q$,v_service_type)
    using p_project_id,v_new_id,coalesce(v_project->>'name',''),coalesce(v_item->>'service_name',''),coalesce(v_item->>'frequency','سنوي'),coalesce(nullif(v_item->>'visit_count','')::integer,1),p_new_start,p_new_end,coalesce(v_item->>'notes',''),v_now;v_service_count:=v_service_count+1;
  end loop;

  if coalesce(p_attachment->>'file_url',p_attachment->>'name','')<>'' and to_regclass('public.contract_attachments') is not null then
    select format_type(a.atttypid,a.atttypmod) into v_attachment_type from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='contract_attachments' and a.attname='project_id' and a.attnum>0 and not a.attisdropped;
    execute format('insert into public.contract_attachments(project_id,contract_id,contract_key,category,name,file_url,storage_bucket,storage_path,mime_type,size_bytes,notes,is_archived,created_at,updated_at) values(($1)::%s,$2,$3,''عقد'',$4,$5,$6,$7,$8,$9,$10,false,$11,$11)',v_attachment_type)
    using p_project_id,v_new_id,p_contract_key,coalesce(p_attachment->>'name','العقد المجدد'),nullif(p_attachment->>'file_url',''),nullif(p_attachment->>'storage_bucket',''),nullif(p_attachment->>'storage_path',''),nullif(p_attachment->>'mime_type',''),coalesce(nullif(p_attachment->>'size_bytes','')::bigint,0),p_notes,v_now;
  end if;

  if to_regclass('public.project_contract_smart') is not null then
    execute 'select payload from public.project_contract_smart where project_id::text=$1 limit 1 for update' into v_payload using p_project_id;v_payload:=coalesce(v_payload,'{}'::jsonb);
    v_payload:=jsonb_set(v_payload,array['contracts',p_contract_key],jsonb_build_object('enabled',true,'provider',p_provider,'contract_number',v_old.contract_number,'start_date',p_new_start,'end_date',p_new_end,'value',coalesce(p_new_value,0),'status','نشط','notes',p_notes,'previous_contract_id',v_old.id,'contract_id',v_new_id),true);
    v_payload:=jsonb_set(v_payload,'{meta,last_renewal}',jsonb_build_object('old_contract_id',v_old.id,'new_contract_id',v_new_id,'renewed_at',v_now,'renewed_by',p_user_name),true);
    execute 'update public.project_contract_smart set payload=$1,updated_at=$2,updated_by=$3 where project_id::text=$4' using v_payload,v_now,case when p_user_id~'^[0-9]+$' then p_user_id::bigint else null end,p_project_id;
  end if;

  if p_contract_key='operation' then
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='contract_start')
       and exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='contract_end') then
      execute 'update public.projects set contract_start=$1,contract_end=$2,is_active=case when $3 then true else is_active end,status=case when $3 then ''active'' else status end,stopped_reason=case when $3 then null else stopped_reason end,stopped_at=case when $3 then null else stopped_at end,stopped_by=case when $3 then null else stopped_by end where id::text=$4' using p_new_start,p_new_end,coalesce(p_reactivate,false),p_project_id;
    elsif coalesce(p_reactivate,false) then
      execute 'update public.projects set is_active=true,status=''active'',stopped_reason=null,stopped_at=null,stopped_by=null where id::text=$1' using p_project_id;
    end if;
  end if;

  v_notification_key:=concat('contract_expiry:',v_old.id,':',coalesce(v_old_end::text,''));
  select format_type(a.atttypid,a.atttypmod) into v_actor_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='contract_expiry_notifications' and a.attname='resolved_by' and a.attnum>0 and not a.attisdropped;
  v_actor_value:=public.contract_actor_value_v10814(p_user_id,v_actor_type);
  if v_actor_type is null then
    update public.contract_expiry_notifications set status='resolved',resolution='renewed',resolved_at=v_now,updated_at=v_now where notification_key=v_notification_key or contract_id=v_old.id;
  else
    execute format('update public.contract_expiry_notifications set status=''resolved'',resolution=''renewed'',resolved_at=$1,resolved_by=($2)::%s,updated_at=$1 where notification_key=$3 or contract_id=$4',v_actor_type)
      using v_now,v_actor_value,v_notification_key,v_old.id;
  end if;

  perform public.write_contract_audit_v10814(p_project_id,'contract',v_old.id::text,'action',to_jsonb(v_old),jsonb_build_object('action','renewed','new_contract_id',v_new_id),p_user_id,p_user_name,p_notes);
  perform public.write_contract_audit_v10814(p_project_id,'contract',v_new_id::text,'action',null,jsonb_build_object('action','created_from_renewal','previous_contract_id',v_old.id,'services_created',v_service_count),p_user_id,p_user_name,p_notes);
  if coalesce(p_reactivate,false) then
    perform public.write_contract_audit_v10814(p_project_id,'project',p_project_id,'is_active',to_jsonb(v_project->>'is_active'),to_jsonb(true),p_user_id,p_user_name,'إعادة تنشيط المشروع بعد تجديد العقد');
  end if;

  return jsonb_build_object('ok',true,'old_contract_id',v_old.id,'new_contract_id',v_new_id,'new_services',v_service_count,'project_active',case when p_reactivate then true else coalesce((v_project->>'is_active')::boolean,true) end,'historical_contract_preserved',true);
end $$;

create or replace function public.non_renew_project_contract_v10814(
  p_project_id text,p_contract_id text,p_contract_key text,p_reason text,p_details text,p_user_id text,p_user_name text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_contract public.contracts%rowtype;v_now timestamptz:=now();v_project jsonb;v_payload jsonb;v_assignments integer:=0;v_services integer:=0;v_n integer;v_set text;v_where text;r record;v_notification_key text;v_actor_type text;v_actor_value text;
begin
  if nullif(p_reason,'') is null then raise exception 'سبب عدم التجديد مطلوب'; end if;
  perform pg_advisory_xact_lock(hashtextextended(concat(p_project_id,':',p_contract_key),10814));
  execute 'select to_jsonb(p) from public.projects p where p.id::text=$1 limit 1 for update' into v_project using p_project_id;if v_project is null then raise exception 'المشروع المحدد غير موجود';end if;
  if nullif(p_contract_id,'') is not null then select * into v_contract from public.contracts where id::text=p_contract_id and project_id::text=p_project_id for update;end if;
  if v_contract.id is null then select * into v_contract from public.contracts where project_id::text=p_project_id and contract_key=p_contract_key and is_active=true order by created_at desc limit 1 for update;end if;
  if v_contract.id is null then perform public.sync_contracts_from_smart_v10814();select * into v_contract from public.contracts where project_id::text=p_project_id and contract_key=p_contract_key and is_active=true order by created_at desc limit 1 for update;end if;
  if v_contract.id is null then raise exception 'تعذر تحديد العقد المطلوب';end if;

  select format_type(a.atttypid,a.atttypmod) into v_actor_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='contracts' and a.attname='closed_by' and a.attnum>0 and not a.attisdropped;
  v_actor_value:=public.contract_actor_value_v10814(p_user_id,v_actor_type);
  if v_actor_type is null then
    update public.contracts set status='not_renewed',is_active=false,non_renewal_reason=p_reason,non_renewal_details=p_details,closed_at=v_now,updated_at=v_now where id=v_contract.id;
  else
    execute format('update public.contracts set status=''not_renewed'',is_active=false,non_renewal_reason=$1,non_renewal_details=$2,closed_at=$3,closed_by=($4)::%s,updated_at=$3 where id=$5',v_actor_type)
      using p_reason,p_details,v_now,v_actor_value,v_contract.id;
  end if;

  select format_type(a.atttypid,a.atttypmod) into v_actor_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='projects' and a.attname='stopped_by' and a.attnum>0 and not a.attisdropped;
  v_actor_value:=public.contract_actor_value_v10814(p_user_id,v_actor_type);
  if v_actor_type is null then
    execute 'update public.projects set is_active=false,status=''stopped'',stopped_reason=''contract_not_renewed'',stopped_at=$1 where id::text=$2' using v_now,p_project_id;
  else
    execute format('update public.projects set is_active=false,status=''stopped'',stopped_reason=''contract_not_renewed'',stopped_at=$1,stopped_by=($2)::%s where id::text=$3',v_actor_type)
      using v_now,v_actor_value,p_project_id;
  end if;

  for r in select unnest(array['worker_project_assignments','monthly_distribution','monthly_project_distribution','project_assignments']) table_name loop
    if to_regclass(format('public.%I',r.table_name)) is null then continue;end if;
    v_set='';v_where='project_id::text=$1';
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=r.table_name and column_name='end_date') then v_set=v_set||'end_date=current_date,';end if;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=r.table_name and column_name='is_active') then v_set=v_set||'is_active=false,';v_where=v_where||' and coalesce(is_active,true)=true';end if;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=r.table_name and column_name='end_reason') then v_set=v_set||'end_reason=''project_contract_not_renewed'',';end if;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=r.table_name and column_name='status') then v_set=v_set||'status=''ended'',';v_where=v_where||' and lower(coalesce(status,'''') ) not in (''ended'',''stopped'',''inactive'',''archived'')';end if;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=r.table_name and column_name='month_key') then v_where=v_where||' and month_key::text>=to_char(current_date,''YYYY-MM'')';end if;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=r.table_name and column_name='updated_at') then v_set=v_set||'updated_at=now(),';end if;
    v_set=trim(trailing ',' from v_set);if v_set='' then continue;end if;
    execute format('update public.%I set %s where %s',r.table_name,v_set,v_where) using p_project_id;get diagnostics v_n=row_count;v_assignments:=v_assignments+v_n;
  end loop;

  update public.contract_services set status='cancelled_due_to_non_renewal',cancelled_at=v_now,cancellation_reason='project_contract_not_renewed',updated_at=v_now
  where project_id::text=p_project_id
    and (contract_id is null or contract_id=v_contract.id)
    and coalesce(is_archived,false)=false
    and greatest(coalesce(visit_count,0)-coalesce(executed_count,0),0)>0
    and (next_due_date is null or next_due_date>=current_date or end_date is null or end_date>=current_date);
  get diagnostics v_services=row_count;

  if to_regclass('public.project_contract_smart') is not null then execute 'select payload from public.project_contract_smart where project_id::text=$1 limit 1 for update' into v_payload using p_project_id;v_payload:=coalesce(v_payload,'{}'::jsonb);v_payload:=jsonb_set(v_payload,array['contracts',p_contract_key,'status'],to_jsonb('لم يجدد'::text),true);v_payload:=jsonb_set(v_payload,array['contracts',p_contract_key,'enabled'],'false'::jsonb,true);v_payload:=jsonb_set(v_payload,'{meta,last_non_renewal}',jsonb_build_object('contract_id',v_contract.id,'reason',p_reason,'details',p_details,'closed_at',v_now,'closed_by',p_user_name),true);execute 'update public.project_contract_smart set payload=$1,updated_at=$2,updated_by=$3 where project_id::text=$4' using v_payload,v_now,case when p_user_id~'^[0-9]+$' then p_user_id::bigint else null end,p_project_id;end if;

  v_notification_key:=concat('contract_expiry:',v_contract.id,':',coalesce(v_contract.end_date::text,''));
  select format_type(a.atttypid,a.atttypmod) into v_actor_type
  from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='contract_expiry_notifications' and a.attname='resolved_by' and a.attnum>0 and not a.attisdropped;
  v_actor_value:=public.contract_actor_value_v10814(p_user_id,v_actor_type);
  if v_actor_type is null then
    update public.contract_expiry_notifications set status='resolved',resolution='not_renewed',resolved_at=v_now,updated_at=v_now where notification_key=v_notification_key or contract_id=v_contract.id;
  else
    execute format('update public.contract_expiry_notifications set status=''resolved'',resolution=''not_renewed'',resolved_at=$1,resolved_by=($2)::%s,updated_at=$1 where notification_key=$3 or contract_id=$4',v_actor_type)
      using v_now,v_actor_value,v_notification_key,v_contract.id;
  end if;

  perform public.write_contract_audit_v10814(p_project_id,'contract',v_contract.id::text,'action',to_jsonb(v_contract),jsonb_build_object('action','not_renewed','project_stopped',true,'ended_assignments',v_assignments,'cancelled_services',v_services),p_user_id,p_user_name,concat_ws(' — ',p_reason,p_details));
  perform public.write_contract_audit_v10814(p_project_id,'project',p_project_id,'status',v_project,jsonb_build_object('status','stopped','is_active',false,'stopped_reason','contract_not_renewed'),p_user_id,p_user_name,concat_ws(' — ',p_reason,p_details));
  perform public.write_contract_audit_v10814(p_project_id,'assignment','project_assignments','action',null,jsonb_build_object('action','ended','rows',v_assignments,'end_reason','project_contract_not_renewed'),p_user_id,p_user_name,p_reason);
  perform public.write_contract_audit_v10814(p_project_id,'annual_service','future_services','action',null,jsonb_build_object('action','cancelled_due_to_non_renewal','rows',v_services),p_user_id,p_user_name,p_reason);
  perform public.write_contract_audit_v10814(p_project_id,'notification',v_notification_key,'resolution',null,to_jsonb('not_renewed'::text),p_user_id,p_user_name,p_reason);

  return jsonb_build_object('ok',true,'contract_id',v_contract.id,'project_stopped',true,'ended_assignments',v_assignments,'cancelled_future_services',v_services,'historical_data_deleted',false,'workers_stopped',false,'supervisors_stopped',false,'attachments_deleted',false);
end $$;

create or replace function public.refresh_contract_expiry_notifications_v10814()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  update public.contracts set status=case when end_date<current_date then 'expired' when end_date<=current_date+30 then 'expiring' else 'active' end,updated_at=now() where is_active=true and status not in('renewed','not_renewed','cancelled','archived') and end_date is not null;
  insert into public.contract_expiry_notifications(project_id,contract_id,notification_key,status,created_at,updated_at)
  select c.project_id,c.id,concat('contract_expiry:',c.id,':',c.end_date),'open',now(),now() from public.contracts c where c.is_active=true and c.status in('expiring','expired') and c.end_date is not null
  on conflict(notification_key) do nothing;
  get diagnostics v_count=row_count;return jsonb_build_object('ok',true,'created_notifications',v_count);
end $$;

select public.sync_contracts_from_smart_v10814();
select public.refresh_contract_expiry_notifications_v10814();

grant select,insert,update on public.contracts to anon,authenticated;
grant select,insert,update on public.contract_expiry_notifications to anon,authenticated;
grant select on public.contract_identifier_migration_audit_v10814 to anon,authenticated;
grant select on public.contract_identifier_issues_v10814 to anon,authenticated;
grant execute on function public.save_contracts_services_editor_v10814(text,timestamptz,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text) to anon,authenticated;
grant execute on function public.execute_annual_service_v10814(text,text,date,text,text,text,text) to anon,authenticated;
grant execute on function public.renew_project_contract_v10814(text,text,text,date,date,numeric,text,jsonb,text,jsonb,date,boolean,text,text) to anon,authenticated;
grant execute on function public.non_renew_project_contract_v10814(text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.contract_actor_value_v10814(text,text) to anon,authenticated;
grant execute on function public.write_contract_audit_v10814(text,text,text,text,jsonb,jsonb,text,text,text) to anon,authenticated;
grant execute on function public.sync_contracts_from_smart_v10814() to anon,authenticated;
grant execute on function public.refresh_contract_expiry_notifications_v10814() to anon,authenticated;

do $$ declare v_seq text;v_table text;begin
  foreach v_table in array array['contracts','contract_expiry_notifications','contract_identifier_migration_audit_v10814','contract_identifier_issues_v10814'] loop
    v_seq:=pg_get_serial_sequence('public.'||v_table,'id');if v_seq is not null then execute format('grant usage,select on sequence %s to anon,authenticated',v_seq);end if;
  end loop;
end $$;

commit;

-- تقرير الاستلام بعد التنفيذ
select table_name,column_name,data_type,udt_name
from information_schema.columns
where table_schema='public' and column_name in('id','project_id','contract_id','service_id','provider_id','previous_contract_id','renewed_by','closed_by','resolved_by','stopped_by')
  and table_name in('projects','project_contract_smart','contracts','contract_services','contract_attachments','contract_change_logs','contract_expiry_notifications')
order by table_name,column_name;

select * from public.contract_identifier_migration_audit_v10814 order by id desc;
select * from public.contract_identifier_issues_v10814 order by id desc limit 500;
select jsonb_build_object(
  'ok',true,
  'build','V10814',
  'contracts', (select count(*) from public.contracts),
  'active_contracts',(select count(*) from public.contracts where is_active=true),
  'open_expiry_notifications',(select count(*) from public.contract_expiry_notifications where status='open'),
  'historical_attachments',(select count(*) from public.contract_attachments),
  'historical_services',(select count(*) from public.contract_services)
) as result;
