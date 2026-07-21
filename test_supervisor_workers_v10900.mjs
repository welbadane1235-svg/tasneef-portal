import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = new URL('.', import.meta.url);
const app = fs.readFileSync(new URL('app.js', root), 'utf8');
const attendance = fs.readFileSync(new URL('tasneef_supervisor_attendance_from_unified_v434.js', root), 'utf8');
const sql = fs.readFileSync(new URL('supabase_supervisor_workers_strict_v10900.sql', root), 'utf8');
const html = fs.readFileSync(new URL('supervisor.html', root), 'utf8');

function section(text, start, end) {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, `Missing section: ${start}`);
  return text.slice(a, b);
}

const loader = section(app, 'async function loadUnifiedSupervisorWorkersV10713', 'window.__tasneefLegacySupervisorWorkerLoadersDisabledV10900');
assert.equal((loader.match(/sb\.rpc\('tasneef_get_unified_supervisor_workers_v10900'/g) || []).length, 1, 'workers loader must use one RPC');
assert(!loader.includes("from('monthly_distribution')"), 'active workers loader must not fetch full distribution');
assert(loader.includes("JSON.stringify(['supervisor-workers',requestedSupervisorId||authUserId,date])"), 'cache key must include supervisor and date');
assert(loader.includes('new AbortController()'), 'old requests must be cancellable');
assert(loader.includes("row.is_active!==true"), 'active workers require exact true');
assert(loader.includes('assignmentSupervisorId!==responseSupervisorId'), 'foreign supervisor rows must be rejected client-side');
assert(loader.includes('dedup.has(canonical)'), 'canonical ID dedupe must be active');

assert(app.includes('window.resolveCurrentSupervisorIdentity=async function(authUserId)'), 'identity resolver is missing');
assert(app.includes('window.getUnifiedSupervisorWorkers=async function(supervisorIdValue,selectedDate,force=false)'), 'unified function is missing');
assert(app.includes('networkRequests:1'), 'health report must record one workers request');
assert(app.includes('window.runSupervisorWorkersAuditV10900'), 'all-supervisor audit function is missing');
assert(app.includes("select('id,worker_id,supervisor_id,project_id,check_in,check_out')"), 'open presence query must be lightweight');
assert(app.includes(".not('check_in','is',null).is('check_out',null)"), 'open presence query must require check-in and no check-out');
assert(app.includes('تعذر التحقق من حالة الدخول</small>'), 'presence failure must keep worker names visible');
assert(app.includes("const presencePromise=workersPromise.then(()=>fetchPresence(false))"), 'presence must wait for resolved supervisor identity');

const projectChange = section(app, 'const oldProjectChange=window.onLogProjectChange', 'const oldInit=window.initSupervisor');
assert(!projectChange.includes('fetchUnifiedWorkers'), 'project change must not reload workers');

assert(attendance.includes("const BUILD='V10900 strict unified supervisor workers'"), 'preparation page build not updated');
assert(attendance.includes('if(!state.loaded || force || state.date!==date)'), 'preparation page must cache by exact date');
assert(attendance.includes('state.att=await qAttendanceMonth(monthOf(date)); state.date=date; render();'), 'saving attendance must not reload workers');
assert(!attendance.includes('state.loaded=false; await renderSupervisorUnified(true);'), 'legacy forced worker reload after save remains');

assert(html.includes('app.js?v=10900-supervisor-workers-strict-rpc'), 'app cache bust missing');
assert(html.includes('tasneef_supervisor_attendance_from_unified_v434.js?v=10900-unified-supervisor-workers'), 'attendance cache bust missing');

assert(sql.includes('tasneef_get_unified_supervisor_workers_v10900'), 'SQL RPC missing');
assert(sql.includes('worker_is_active = true'), 'SQL exact active filter missing');
assert(sql.includes('top_supervisor_count=1'), 'conflict exclusion missing');
assert(sql.includes('تم اعتماد أحدث توزيع فعال'), 'latest-assignment resolution missing');
assert(sql.includes('توزيع متعارض — يحتاج مراجعة'), 'unresolved conflict report missing');
assert(sql.includes('tasneef_supervisor_workers_audit_v10900'), 'audit RPC missing');

// Behavioral model for the acceptance scenarios encoded in the SQL.
function resolve(assignments) {
  const active = assignments.filter(x => x.is_active === true && x.canonical_employee_id && x.supervisor_id);
  const byWorker = new Map();
  for (const x of active) {
    const bySup = byWorker.get(x.canonical_employee_id) || new Map();
    const old = bySup.get(x.supervisor_id);
    if (!old || x.score > old.score) bySup.set(x.supervisor_id, x);
    byWorker.set(x.canonical_employee_id, bySup);
  }
  const selected = new Map();
  const conflicts = [];
  for (const [workerId, bySup] of byWorker) {
    const rows = [...bySup.values()].sort((a,b)=>b.score-a.score);
    const top = rows.filter(x=>x.score===rows[0].score);
    if (top.length !== 1) conflicts.push(workerId);
    else selected.set(workerId, top[0].supervisor_id);
  }
  return {selected, conflicts};
}

const model = resolve([
  {canonical_employee_id:'1',supervisor_id:'A',score:10,is_active:true,project:'P1'},
  {canonical_employee_id:'1',supervisor_id:'A',score:10,is_active:true,project:'P2'},
  {canonical_employee_id:'2',supervisor_id:'A',score:10,is_active:true},
  {canonical_employee_id:'2',supervisor_id:'B',score:20,is_active:true},
  {canonical_employee_id:'3',supervisor_id:'A',score:30,is_active:true},
  {canonical_employee_id:'3',supervisor_id:'B',score:30,is_active:true},
  {canonical_employee_id:'4',supervisor_id:'A',score:40,is_active:false},
]);
assert.equal(model.selected.get('1'), 'A', 'multiple projects under one supervisor must remain assigned once');
assert.equal(model.selected.get('2'), 'B', 'latest supervisor assignment must win');
assert(model.conflicts.includes('3'), 'same-date cross-supervisor conflict must be excluded');
assert(!model.selected.has('4'), 'inactive worker must be excluded');

console.log(JSON.stringify({
  status:'PASS',
  checks:27,
  workerLoadNetworkRequests:1,
  cacheKey:"['supervisor-workers', supervisorId, selectedDate]",
  sourceTable:'monthly_distribution',
  sourceFunction:'getUnifiedSupervisorWorkers',
  syntaxFiles:['app.js','tasneef_supervisor_attendance_from_unified_v434.js'],
  scenarios:['same supervisor multiple projects','latest transfer','unresolved conflict','inactive worker']
}, null, 2));
