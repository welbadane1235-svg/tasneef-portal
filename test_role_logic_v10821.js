const aliases={admin:'super_admin',system_admin:'super_admin',super_admin:'super_admin',general_manager:'operations_manager',operations_manager:'operations_manager',financial_manager:'accountant',finance_manager:'accountant',accountant:'accountant',warehouse_manager:'warehouse_manager',warehouse_officer:'warehouse_manager',maintenance_manager:'maintenance_manager',sales_manager:'sales_manager',sales_employee:'sales_employee',supervisor:'supervisor',technician:'technician',read_only:'read_only',custom:'custom'};
function key(u){const explicit=String(u.role_key||'').toLowerCase(),legacy=String(u.role||'').toLowerCase();const chosen=(explicit&&explicit!=='custom')?explicit:(legacy||explicit||'custom');return aliases[chosen]||chosen||'custom';}
function route(u){const k=key(u);if(k==='super_admin')return'admin';if(['operations_manager','accountant','warehouse_manager','maintenance_manager','sales_manager','sales_employee','read_only','custom'].includes(k))return'general_manager';if(k==='technician')return'technician';return'supervisor';}
const cases=[
 [{role_key:'super_admin',role:'admin'},'admin'],
 [{role_key:'custom',role:'admin'},'admin'],
 [{role_key:'operations_manager',role:'operations_manager'},'general_manager'],
 [{role_key:'accountant',role:'financial_manager'},'general_manager'],
 [{role_key:'warehouse_manager',role:'warehouse_manager'},'general_manager'],
 [{role_key:'supervisor'},'supervisor'],
 [{role_key:'technician'},'technician'],
];
let failed=0;for(const [u,want] of cases){const got=route(u);const ok=got===want;console.log(`${ok?'PASS':'FAIL'} ${JSON.stringify(u)} => ${got}`);if(!ok)failed++;}
if(failed)process.exit(1);
