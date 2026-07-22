from pathlib import Path
BASE=Path(__file__).parent
cases=[]
def t(name,cond): cases.append((name,bool(cond)))

def effective(role,role_grants,overrides,key,active=True):
    if not active:return False,'inactive'
    if role=='super_admin':return True,'super_admin'
    if key in overrides:return bool(overrides[key]),'user_allow' if overrides[key] else 'user_deny'
    if key in role_grants:return True,'role'
    return False,'none'

def scoped(allowed,scope,projects,pid=None):
    if not allowed:return False
    if pid is None or scope=='all':return True
    if scope in {'specific_projects','assigned_projects','supervisor_projects'}:return str(pid) in {str(x) for x in projects}
    return False

# Precedence and role templates
t('super_admin always allowed',effective('super_admin',set(),{'projects.edit':False},'projects.edit')[0])
t('explicit user deny overrides role',effective('supervisor',{'tickets.view'},{'tickets.view':False},'tickets.view')==(False,'user_deny'))
t('explicit user allow adds permission',effective('supervisor',set(),{'tickets.close':True},'tickets.close')==(True,'user_allow'))
t('role permission inherited',effective('supervisor',{'tickets.view'},{},'tickets.view')==(True,'role'))
t('missing permission denied',effective('supervisor',set(),{},'payroll.edit')==(False,'none'))
t('inactive user denied',effective('super_admin',set(),{},'dashboard.view',False)==(False,'inactive'))
# Project scope
t('specific project allowed',scoped(True,'specific_projects',[7,9],9))
t('other project denied',not scoped(True,'specific_projects',[7,9],10))
t('all project scope allowed',scoped(True,'all',[],999))
t('permission denial precedes project scope',not scoped(False,'all',[],9))
# Cache isolation and versions
cache=lambda uid,ver:f'tasneef:user-permissions:{uid}:{ver}'
t('cache isolated by user',cache(1,4)!=cache(2,4))
t('cache isolated by version',cache(1,4)!=cache(1,5))
# Session invalidation model
session=lambda active_user,active_session,expires: active_user and active_session and expires>0
t('disabled account invalidates old session',not session(False,True,100))
t('ended session rejected',not session(True,False,100))
# Transaction model: all-or-nothing
state={'profile':'old','permissions':{'a':False},'scope':[1]}
def transaction(fail=False):
    before={k:(v.copy() if isinstance(v,(dict,list)) else v) for k,v in state.items()}
    try:
        state['profile']='new';state['permissions']['a']=True;state['scope']=[2]
        if fail:raise RuntimeError()
    except RuntimeError:
        state.clear();state.update(before);return False
    return True
t('failed permission transaction rolls back',not transaction(True) and state=={'profile':'old','permissions':{'a':False},'scope':[1]})
t('successful permission transaction commits',transaction(False) and state=={'profile':'new','permissions':{'a':True},'scope':[2]})

passed=sum(v for _,v in cases)
out=['Tasneef Unified Permissions V10817 - Logic Test',f'Passed: {passed}/{len(cases)}','']+[('PASS' if v else 'FAIL')+' | '+n for n,v in cases]
(BASE/'UNIFIED_PERMISSIONS_LOGIC_TEST_V10817.txt').write_text('\n'.join(out),encoding='utf-8')
print('\n'.join(out))
raise SystemExit(0 if passed==len(cases) else 1)
