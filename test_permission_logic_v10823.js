const fs=require('fs'),vm=require('vm');
const listeners={};
const fakeClassList={add(){},remove(){},contains(){return false;}};
const document={
  readyState:'loading',
  addEventListener:(n,fn)=>{listeners[n]=fn;},
  getElementById:()=>null,
  querySelectorAll:()=>[],
  querySelector:()=>null,
  documentElement:{classList:fakeClassList,dataset:{}},
  body:null
};
const store={};
const localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k],key:i=>Object.keys(store)[i],get length(){return Object.keys(store).length;}};
const sandbox={window:null,document,localStorage,console,crypto:{randomUUID:()=> 'uuid'},requestAnimationFrame:fn=>{fn();return 1;},cancelAnimationFrame(){},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,MutationObserver:function(){this.observe=()=>{}},BroadcastChannel:function(){this.postMessage=()=>{}},location:{href:'',assign(){}},Headers:function(){},fetch:async()=>({}),performance:{},CSS:{escape:s=>s}};
sandbox.window=sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('/mnt/data/work_v10823/tasneef_permissions_v10817.js','utf8'),sandbox);
const svc=sandbox.PermissionsService;
const checks=[]; const ok=(n,c)=>checks.push([n,!!c]);
ok('الخدمة المركزية متاحة',!!svc);
ok('المفاتيح أكثر من 100',svc.CATALOG.length>100);
ok('مدير التشغيل يملك المشاريع',svc.ROLE_TEMPLATES.operations_manager.includes('projects.view'));
ok('مدير التشغيل لا يملك إدارة المستخدمين افتراضياً',!svc.ROLE_TEMPLATES.operations_manager.includes('users.manage_permissions'));
ok('المشرف يملك نطاق التشغيل الأساسي',svc.ROLE_TEMPLATES.supervisor.includes('attendance.view')&&svc.ROLE_TEMPLATES.supervisor.includes('tickets.view'));
ok('القالب المخصص لا يمنح الكل',!(svc.ROLE_TEMPLATES.custom||[]).includes('*'));
ok('المدير العام يملك wildcard',svc.ROLE_TEMPLATES.super_admin.includes('*'));
ok('المفتاح القديم يتحول إلى الجديد',svc.ALIASES['users.manage']==='users.manage_permissions');
const pass=checks.filter(x=>x[1]).length;
console.log(`V10823 LOGIC TEST: ${pass}/${checks.length} PASS`);
for(const [n,v] of checks) console.log(`${v?'PASS':'FAIL'} - ${n}`);
if(pass!==checks.length)process.exit(1);
