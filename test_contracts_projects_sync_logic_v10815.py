from datetime import date,timedelta

def priority(days,status='open'):
    if status in {'renewed','not_renewed','resolved'}: return 'resolved'
    if days<0:return 'urgent'
    if days<=7:return 'high'
    if days<=30:return 'medium'
    return 'low'

def dedupe(rows):
    seen=set();out=[]
    for r in sorted(rows,key=lambda x:(x['key'],x.get('updated',0)),reverse=True):
        if r['key'] in seen: continue
        seen.add(r['key']);out.append(r)
    return out

def stop_project(project,contract,services,assignments):
    project={**project,'is_active':False,'status':'stopped','stopped_reason':'contract_not_renewed'}
    contract={**contract,'is_active':False,'status':'not_renewed'}
    services=[{**s,'status':'cancelled_due_to_non_renewal'} if s['remaining']>0 else s for s in services]
    assignments=[{**a,'is_active':False,'end_reason':'project_contract_not_renewed'} if a['project_id']==project['id'] else a for a in assignments]
    return project,contract,services,assignments

checks=[]
checks += [('expired urgent',priority(-1)=='urgent'),('7 days high',priority(7)=='high'),('30 days medium',priority(30)=='medium'),('60 days low',priority(60)=='low'),('resolved',priority(-10,'not_renewed')=='resolved')]
rows=[{'key':'contract_expiry:1:2026-07-01','updated':1},{'key':'contract_expiry:1:2026-07-01','updated':2},{'key':'contract_expiry:2:2026-08-01','updated':1}]
checks.append(('one active alert per key',len(dedupe(rows))==2))
p,c,s,a=stop_project({'id':24,'is_active':True},{'id':9,'is_active':True},[{'id':1,'remaining':2,'status':'due'},{'id':2,'remaining':0,'status':'done'}],[{'project_id':24,'is_active':True},{'project_id':25,'is_active':True}])
checks += [('project stopped',p['status']=='stopped' and not p['is_active']),('contract retained but nonrenewed',c['status']=='not_renewed' and c['id']==9),('future service cancelled',s[0]['status']=='cancelled_due_to_non_renewal'),('completed service preserved',s[1]['status']=='done'),('only target assignment ended',not a[0]['is_active'] and a[1]['is_active'])]
failed=[n for n,v in checks if not v]
out=[f"V10815 logic tests: {len(checks)-len(failed)}/{len(checks)} passed",'']+[('PASS ' if v else 'FAIL ')+n for n,v in checks]
from pathlib import Path
Path(__file__).with_name('CONTRACTS_PROJECTS_SYNC_ALERTS_LOGIC_TEST_V10815.txt').write_text('\n'.join(out)+'\n','utf-8')
print('\n'.join(out))
raise SystemExit(1 if failed else 0)
