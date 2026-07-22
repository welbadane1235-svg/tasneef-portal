const fs = require('fs');
const vm = require('vm');
global.window = global;
global.document = {
  readyState: 'loading',
  getElementById: () => null,
  addEventListener: () => {},
  querySelectorAll: () => []
};
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; }
};
global.crypto = { randomUUID: () => 'x' };
const base = process.argv[2];
vm.runInThisContext(fs.readFileSync(base + '/tasneef_permissions_v10817.js', 'utf8'));
const files = [
  'admin.html', 'supervisor.html', 'technician.html', 'app.js',
  'tasneef_contracts_services_editor_v10807.js',
  'tasneef_orders_v10801.js', 'tasneef_crm_unified_v10600.js'
];
const ignore = new Set([
  '$', 'if', 'document.getElementById', 'event.stopPropagation', 'this.closest',
  'window.open', 'window.print', 'login', 'logout', 'showPage',
  'showSupervisorWindow', 'showTechMainTab', 'showTechMainTabById', 'showTechWindow',
  'refreshAll', 'copyText', 'playAppSound', 'enableSupervisorSounds', 'print',
  'resetServiceFilters', 'resetTicketAdvancedFiltersV10801', 'resetOrdersFiltersV233',
  'assistantCopyLast', 'assistantClear', 'supClientCloseSlideModal', 'initTechnician',
  'clearBatchFiltersV149', 'closeInvoiceViewV149', 'filterSupplierInvoicesV178',
  'changeOrdersPageV360', 'toggleModuleV10700'
]);
let total = 0, mapped = 0;
const unexpected = [];
const inferredPermissions = new Set();
for (const file of files) {
  const source = fs.readFileSync(base + '/' + file, 'utf8');
  for (const attr of ['onclick', 'onchange', 'onsubmit']) {
    const patterns = [
      new RegExp(attr + '\\s*=\\s*"([^"]+)"', 'g'),
      new RegExp(attr + "\\s*=\\s*'([^']+)'", 'g')
    ];
    for (const re of patterns) {
      let m;
      while ((m = re.exec(source))) {
        const mm = m[1].match(/^\s*([\w$.]+)/);
        if (!mm) continue;
        total++;
        const fn = mm[1];
        const permission = PermissionsService.inferActionPermission(fn);
        if (permission || fn === 'deleteRow' || fn === 'financeDelete') { mapped++; if (permission) inferredPermissions.add(permission); }
        else if (!ignore.has(fn)) unexpected.push(attr + ':' + fn);
      }
    }
  }
}
const canonical = new Set(PermissionsService.CATALOG.map(x => x.permission_key));
const nonCanonical = [...inferredPermissions].filter(x => !canonical.has(x));
console.log(JSON.stringify({ catalog: PermissionsService.CATALOG.length, total, mapped, unexpected, nonCanonical }));
process.exit(0);
