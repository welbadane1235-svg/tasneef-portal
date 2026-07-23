'use strict';
function canonical(u){
  const obj=(u&&typeof u==='object')?u:{};
  const raw=String(obj.role_key||obj.role||u||'').trim().toLowerCase();
  const aliases={
    admin:'super_admin',system_admin:'super_admin',super_admin:'super_admin',
    general_manager:'operations_manager',operations_manager:'operations_manager',operations:'operations_manager',
    financial_manager:'accountant',finance_manager:'accountant',accountant:'accountant',
    warehouse_manager:'warehouse_manager',warehouse_officer:'warehouse_manager',maintenance_manager:'maintenance_manager',quality_manager:'quality_manager',hr_manager:'hr_manager',sales_manager:'sales_manager',sales_employee:'sales_employee',contracts_officer:'contracts_officer',hr_officer:'hr_officer',tickets_officer:'tickets_officer',orders_officer:'orders_officer',data_entry:'data_entry',client:'client',supervisor:'supervisor',technician:'technician',read_only:'read_only',custom:'custom'
  };
  return aliases[raw]||raw||'custom';
}
function route(u){const k=canonical(u);if(k==='super_admin')return'admin';if(k==='supervisor')return'supervisor';if(k==='technician')return'technician';if(k==='client')return'client';return'general_manager';}
function home(u){const r=route(u);return (r==='admin'||r==='general_manager')?'admin.html':r==='technician'?'technician.html':r==='client'?'index.html':'supervisor.html';}
const cases=[
  [{role_key:'operations_manager',role:'admin'},'admin.html'],
  [{role_key:'maintenance_manager',role:'admin'},'admin.html'],
  [{role_key:'accountant',role:'admin'},'admin.html'],
  [{role_key:'sales_employee',role:'admin'},'admin.html'],
  [{role_key:'supervisor',role:'supervisor'},'supervisor.html'],
  [{role_key:'technician',role:'technician'},'technician.html'],
  [{role:'general_manager'},'admin.html'],
  [{role:'operations_manager'},'admin.html']
];
let passed=0;
for(const [input,expected] of cases){const actual=home(input);const ok=actual===expected;console.log(`${ok?'PASS':'FAIL'} ${JSON.stringify(input)} => ${actual}`);if(ok)passed++;}
console.log(`TOTAL ${passed}/${cases.length}`);
if(passed!==cases.length)process.exit(1);
