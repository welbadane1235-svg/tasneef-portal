from copy import deepcopy

def renew(state, old_id=10):
    s=deepcopy(state)
    old=next(c for c in s['contracts'] if c['id']==old_id)
    old['status']='renewed'; old['is_active']=False
    for x in s['services']:
        if x['project_id']==old['project_id'] and x.get('contract_id') is None:
            x['contract_id']=old_id
    for x in s['attachments']:
        if x['project_id']==old['project_id'] and x.get('contract_id') is None:
            x['contract_id']=old_id
    new_id=max(c['id'] for c in s['contracts'])+1
    s['contracts'].append({'id':new_id,'project_id':old['project_id'],'status':'active','is_active':True,'previous_contract_id':old_id})
    s['services'].append({'id':99,'project_id':old['project_id'],'contract_id':new_id,'executed_count':0,'visit_count':4,'status':'مستحقة'})
    s['notifications']['contract_expiry:10:2026-07-01']='renewed'
    return s,new_id

def nonrenew(state):
    s=deepcopy(state); pid=1
    s['projects'][pid].update(is_active=False,status='stopped')
    for a in s['assignments']:
        if a['project_id']==pid and a['is_active'] and a['month_key']>='2026-07':
            a.update(is_active=False,status='ended',end_reason='project_contract_not_renewed')
    for sv in s['services']:
        if sv['project_id']==pid and sv['visit_count']>sv['executed_count'] and sv.get('future',False):
            sv['status']='cancelled_due_to_non_renewal'
    s['contracts'][0].update(status='not_renewed',is_active=False)
    s['notifications']['contract_expiry:10:2026-07-01']='not_renewed'
    return s

base={
 'projects':{1:{'is_active':True,'status':'active'}},
 'contracts':[{'id':10,'project_id':1,'status':'expired','is_active':True}],
 'services':[{'id':1,'project_id':1,'contract_id':None,'executed_count':2,'visit_count':4,'status':'نشطة','future':True},{'id':2,'project_id':1,'contract_id':10,'executed_count':4,'visit_count':4,'status':'مكتملة','future':False}],
 'attachments':[{'id':1,'project_id':1,'contract_id':None}],
 'assignments':[{'id':1,'project_id':1,'month_key':'2026-07','is_active':True,'status':'active'},{'id':2,'project_id':1,'month_key':'2026-05','is_active':False,'status':'ended'}],
 'workers':{7:{'is_active':True}},'supervisors':{3:{'is_active':True}},
 'notifications':{'contract_expiry:10:2026-07-01':'open'}
}
checks=[]
r,new_id=renew(base)
checks.append(('renew preserves old contract',next(c for c in r['contracts'] if c['id']==10)['status']=='renewed'))
checks.append(('renew creates linked active contract',next(c for c in r['contracts'] if c['id']==new_id)['previous_contract_id']==10))
checks.append(('renew links historical records and resets new service',r['services'][0]['contract_id']==10 and r['attachments'][0]['contract_id']==10 and r['services'][-1]['executed_count']==0))
n=nonrenew(base)
checks.append(('non-renew stops project/current assignment but preserves historical assignment',not n['projects'][1]['is_active'] and not n['assignments'][0]['is_active'] and n['assignments'][1]['status']=='ended'))
checks.append(('non-renew does not stop worker/supervisor and keeps completed history',n['workers'][7]['is_active'] and n['supervisors'][3]['is_active'] and n['services'][1]['status']=='مكتملة'))
checks.append(('non-renew cancels only future remaining service',n['services'][0]['status']=='cancelled_due_to_non_renewal'))
checks.append(('decision resolves same unique alert',n['notifications']['contract_expiry:10:2026-07-01']=='not_renewed' and r['notifications']['contract_expiry:10:2026-07-01']=='renewed'))
out=['Tasneef V10814 logical transition tests',f'Passed: {sum(v for _,v in checks)}/{len(checks)}','']+[('PASS' if ok else 'FAIL')+' — '+name for name,ok in checks]
from pathlib import Path
Path(__file__).with_name('CONTRACT_RENEWAL_NONRENEW_LOGIC_TEST_V10814.txt').write_text('\n'.join(out),encoding='utf-8')
print('\n'.join(out))
raise SystemExit(0 if all(v for _,v in checks) else 1)
