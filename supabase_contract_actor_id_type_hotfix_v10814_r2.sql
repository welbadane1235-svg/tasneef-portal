-- Tasneef V10814-R2
-- Hotfix آمن بعد نجاح تثبيت V10814 الأساسي.
-- يعالج اختلاف نوع معرف المستخدم في stopped_by / closed_by / renewed_by / resolved_by.

begin;

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


grant execute on function public.contract_actor_value_v10814(text,text) to anon,authenticated;
grant execute on function public.renew_project_contract_v10814(text,text,text,date,date,numeric,text,jsonb,text,jsonb,date,boolean,text,text) to anon,authenticated;
grant execute on function public.non_renew_project_contract_v10814(text,text,text,text,text,text,text) to anon,authenticated;

commit;

-- نتيجة الفحص بعد الإصلاح
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
  'ok',true,
  'build','V10814-R2',
  'actor_cast_helper',to_regprocedure('public.contract_actor_value_v10814(text,text)') is not null,
  'renew_rpc',to_regprocedure('public.renew_project_contract_v10814(text,text,text,date,date,numeric,text,jsonb,text,jsonb,date,boolean,text,text)') is not null,
  'non_renew_rpc',to_regprocedure('public.non_renew_project_contract_v10814(text,text,text,text,text,text,text)') is not null
) as result;
