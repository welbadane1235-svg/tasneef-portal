-- Tasneef V10815 — تقرير تحقق بعد التثبيت (قراءة فقط)

select table_name,column_name,data_type,udt_name
from information_schema.columns
where table_schema='public'
  and ((table_name='projects' and column_name='id') or (column_name='project_id' and table_name in(
    'contracts','contract_services','annual_services','contract_attachments','contract_expiry_notifications',
    'project_contract_smart','contract_change_logs','worker_project_assignments','monthly_distribution',
    'monthly_project_distribution','project_assignments'
  )))
order by table_name,column_name;

with duplicate_keys as (
  select notification_key,count(*) n
  from public.contract_expiry_notifications
  where status<>'resolved'
  group by notification_key
  having count(*)>1
)
select jsonb_build_object(
  'build','V10815',
  'projects_id_type',(select data_type from information_schema.columns where table_schema='public' and table_name='projects' and column_name='id'),
  'contracts_project_id_type',(select data_type from information_schema.columns where table_schema='public' and table_name='contracts' and column_name='project_id'),
  'services_project_id_type',(select data_type from information_schema.columns where table_schema='public' and table_name='contract_services' and column_name='project_id'),
  'attachments_project_id_type',(select data_type from information_schema.columns where table_schema='public' and table_name='contract_attachments' and column_name='project_id'),
  'notifications_project_id_type',(select data_type from information_schema.columns where table_schema='public' and table_name='contract_expiry_notifications' and column_name='project_id'),
  'stopped_projects_visible_in_contracts',(select count(*) from public.projects where is_active=false),
  'stopped_due_to_nonrenew',(select count(*) from public.projects where is_active=false and stopped_reason='contract_not_renewed'),
  'active_notifications',(select count(*) from public.contract_expiry_notifications where status<>'resolved'),
  'resolved_notifications',(select count(*) from public.contract_expiry_notifications where status='resolved'),
  'duplicate_notifications_fixed',(select count(*) from public.contract_expiry_notifications where resolution='duplicate_merged'),
  'active_duplicate_keys',(select count(*) from duplicate_keys),
  'historical_contracts',(select count(*) from public.contracts),
  'historical_services',(select count(*) from public.contract_services),
  'historical_attachments',(select count(*) from public.contract_attachments),
  'identifier_issues',(select count(*) from public.contract_identifier_issues_v10815),
  'project_id_backups',(select count(*) from public.contract_project_id_backup_v10815),
  'save_rpc',to_regprocedure('public.save_contracts_services_editor_v10815(bigint,timestamp with time zone,timestamp with time zone,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,text,text,text,text)') is not null,
  'renew_rpc',to_regprocedure('public.renew_project_contract_v10815(bigint,text,text,date,date,numeric,text,jsonb,text,jsonb,date,boolean,text,text)') is not null,
  'nonrenew_rpc',to_regprocedure('public.non_renew_project_contract_v10815(bigint,text,text,text,text,date,text,text)') is not null,
  'transaction_note','RPCs are single PostgreSQL transactions; any exception rolls back the complete decision.'
) as result;

select * from public.contract_identifier_issues_v10815 order by id desc limit 200;
