from pathlib import Path
import re, subprocess, json, sys
BASE=Path(__file__).parent
checks=[]
def check(name, cond, detail=''):
    checks.append((name,bool(cond),detail))

def read(name): return (BASE/name).read_text(encoding='utf-8',errors='ignore')
js=read('tasneef_permissions_v10817.js')
sql=read('supabase_unified_permissions_v10817.sql')
pre=read('supabase_unified_permissions_preflight_v10817.sql')
ver=read('supabase_unified_permissions_verify_v10817.sql')
contracts=read('tasneef_contracts_services_editor_v10807.js')
app=read('app.js')
html={n:read(n) for n in ['admin.html','index.html','supervisor.html','technician.html']}

node=subprocess.run(['node','--check',str(BASE/'tasneef_permissions_v10817.js')],capture_output=True,text=True)
check('JavaScript syntax',node.returncode==0,node.stderr.strip())
node2=subprocess.run(['node','--check',str(BASE/'tasneef_contracts_services_editor_v10807.js')],capture_output=True,text=True)
check('Contracts editor syntax',node2.returncode==0,node2.stderr.strip())

perm_chunk=sql[sql.find('insert into public.tasneef_permissions_v10817'):sql.find('insert into public.tasneef_roles_v10817')]
perms=re.findall(r"\('([a-z_]+\.[a-z_]+)','([a-z_]+)'",perm_chunk)
keys=[k for k,_ in perms]
check('127 canonical permissions',len(keys)==127,str(len(keys)))
check('Unique permission keys',len(set(keys))==127,str(len(set(keys))))

alias_chunk=sql[sql.find('insert into public.tasneef_permission_aliases_v10817'):sql.find('with grants(')]
alias=dict(re.findall(r"\('([^']+)','([^']+)'\)",alias_chunk))
check('Legacy alias catalog',len(alias)>=40,str(len(alias)))
check('Every alias targets canonical key',all(v in set(keys) for v in alias.values()))
plausible=set(re.findall(r"['\"]([a-z_]+\.[a-z_]+)['\"]",app))
mods={k.split('.')[0] for k in keys}
old={x for x in plausible if x.split('.')[0] in mods or x in alias}
unmapped=sorted(x for x in old if x not in set(keys) and alias.get(x) not in set(keys))
check('All detected legacy keys mapped',not unmapped,','.join(unmapped))

roles=re.findall(r"\('([a-z_]+)','[^']+',(?:true|false)\)",sql[sql.find('insert into public.tasneef_roles_v10817'):sql.find('insert into public.tasneef_permission_aliases_v10817')])
check('Role templates installed',len(set(roles))>=9,str(len(set(roles))))
check('General manager not automatic super-admin',"when 'general_manager' then 'operations_manager'" in sql and "general_manager') then return 'super_admin'" not in sql)
check('No default administrator/password created',"'123456','admin','super_admin'" not in sql and 'No user or default password is created' in sql)
check('Explicit super_admin runtime bypass',"role_key='super_admin'" in sql and "const SUPER_ROLES=new Set(['super_admin','system_admin','admin'])" in js)

for token in ['PermissionsService','getCurrentUserPermissions','can:canPermission','require:requirePermission','permissions_version','x-tasneef-session','BroadcastChannel','tasneef:user-permissions:']:
    check('Central service: '+token,token in js)
check('Cache key includes user and version','`tasneef:user-permissions:${S(userId)}:${Number(version)||0}`' in js)
check('Logout clears per-user cache','clearPermissionCache(u.id)' in js and "removeItem('tasneef_permission_session_v10817')" in js)
check('Live permission refresh',"setInterval" in js and 'checkVersion(false)' in js and "window.addEventListener('focus'" in js)
check('Legacy engine explicitly superseded','__tasneefLegacyPermissionsDisabledV10817' in js)

for name,text in html.items():
    check(name+' loads permissions module','tasneef_permissions_v10817.js?v=10817' in text)
check('Admin loads permissions CSS','tasneef_permissions_v10817.css?v=10817' in html['admin.html'])
check('No new application page created',not (BASE/'permissions.html').exists())
check('Supervisor all-projects fix preserved','tasneef_supervisor_projects_complete_v10816.js' in html['supervisor.html'])

for token in ['create table if not exists public.tasneef_roles_v10817','tasneef_permissions_v10817','tasneef_role_permissions_v10817','tasneef_user_permissions_v10817','tasneef_user_project_access_v10817','tasneef_permission_audit_v10817','tasneef_permission_sessions_v10817']:
    check('SQL table: '+token.split('.')[-1],token in sql)
for rpc in ['tasneef_login_v10817','get_effective_permissions_v10817','save_user_permission_bundle_v10817','save_app_user_permissions_v10817','set_user_status_v10817','end_user_sessions_v10817','grant_all_permissions_v10817','revoke_all_permissions_v10817','inspect_user_permissions_v10817']:
    check('RPC '+rpc,('function public.'+rpc) in sql)
check('Combined profile+permission transaction RPC','Save the user profile, role, overrides and project scope in one database transaction' in sql)
check('Direct privilege-escalation trigger','trg_enforce_app_users_permissions_v10817' in sql and 'users.manage_permissions required' in sql)
check('Last super-admin protection','ensure_not_last_super_admin_v10817' in sql and 'لا يمكن إزالة صلاحيات آخر مدير عام' in sql)
check('Self permission change blocked','لا يمكن للمستخدم تعديل صلاحياته بنفسه' in sql)
check('Grant-all server restricted to super-admin',"هذا الإجراء للمدير العام فقط" in sql and "role_key='super_admin'" in sql)
check('Cannot grant permission actor lacks','لا يمكنك منح صلاحية لا تملكها' in sql)
check('Disabled users invalidate sessions',"ended_reason='user_disabled'" in sql and "u.is_active=true" in sql)
check('RLS restrictive guards','as restrictive' in sql.lower() and sql.count('install_permission_policy_v10817(')>=18)
check('Storage RLS','storage.objects' in sql and 'files.upload' in sql and 'files.delete' in sql)
check('No service_role in browser JavaScript','service_role' not in js)
check('Preflight does not mutate public data', all(x not in pre.lower() for x in ['insert into public.','update public.','delete from public.','alter table public.']))
check('Verification includes no-loss and RLS checks','users_lost' in ver and 'RLS-sensitive tables' in ver and 'unmapped' not in ver.lower())

check('Contracts editor uses central permission service','PermissionsService' in contracts and 'contracts.renew' in contracts and 'contracts.non_renew' in contracts)
check('Sensitive contract decisions server-aligned','contract_user_has_permission_v10815' in sql and 'effective_permission_for_user_v10817' in sql)
check('UI route guards','PAGE_PERMISSIONS' in js and 'SUP_PAGE_PERMISSIONS' in js and 'TECH_PAGE_PERMISSIONS' in js)
check('Click/change/submit guards',"addEventListener('click',guardDomEvent,true)" in js and "addEventListener('change',guardDomEvent,true)" in js and "addEventListener('submit',guardDomEvent,true)" in js)
check('Financial fields redacted in UI','applyFinancialRedaction' in js and 'view_financial' in js)
check('User status/session UI uses server RPC',"set_user_status_v10817" in js and "end_user_sessions_v10817" in js)
check('Permission save requests reason','reasonDialog' in js and 'سبب التغيير مطلوب' in sql)

# Node runtime catalog/handler coverage
runtime_script=BASE/'_runtime_permission_check_v10817.js'
r=subprocess.run(['node',str(runtime_script),str(BASE)],capture_output=True,text=True,timeout=30)
try: runtime=json.loads(r.stdout.strip())
except Exception: runtime={'catalog':0,'total':0,'mapped':0,'unexpected':[r.stderr or r.stdout]}
check('Runtime catalog loads',runtime.get('catalog')==127,str(runtime))
check('Sensitive/UI handler mapping coverage',not runtime.get('unexpected'),str(runtime.get('unexpected')))
check('Every inferred handler permission is canonical',not runtime.get('nonCanonical'),str(runtime.get('nonCanonical')))
check('At least 290 handler bindings',runtime.get('mapped',0)>=290,f"{runtime.get('mapped')}/{runtime.get('total')}")

passed=sum(ok for _,ok,_ in checks);failed=len(checks)-passed
out=[f'Tasneef Unified Permissions V10817 - Static Test',f'Passed: {passed}/{len(checks)}',f'Failed: {failed}','']
for name,ok,detail in checks: out.append(('PASS' if ok else 'FAIL')+' | '+name+((' | '+detail) if detail else ''))
(BASE/'UNIFIED_PERMISSIONS_STATIC_TEST_V10817.txt').write_text('\n'.join(out),encoding='utf-8')
print('\n'.join(out))
sys.exit(1 if failed else 0)
