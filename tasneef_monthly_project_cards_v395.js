/* V395 - إصلاح جذري: قراءة شهر 6 من ملف الأوقات الأصلي، عدم تصفير الوقت، كل مشروع دوام كامل كرت مستقل */
(function(){
  'use strict';
  window.__tasneefMonthlyCardsV395=true;
  const VERSION='395';
  const S=v=>String(v??'').trim();
  const N=v=>{ if(typeof v==='number') return Number.isFinite(v)?v:0; const s=S(v).replace(/,/g,'').replace(/[^0-9.\-]/g,''); const n=Number(s); return Number.isFinite(n)?n:0; };
  const $=id=>document.getElementById(id);
  const esc=v=>S(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>S(v).replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').toLowerCase();
  const monthVal=()=>($('mt52Month')?.value||$('ms391Month')?.value||'2026-06');
  const arMins=m=>{m=Math.round(Number(m)||0);const h=Math.floor(m/60),mm=m%60;if(!h)return mm+' دقيقة'; if(!mm)return h+' ساعة'; return h+' ساعة و '+mm+' دقيقة';};
  const pct=v=>`${Math.round((Number(v)||0)*10)/10}%`.replace('.0%','%');
  const parseHoursTxt=t=>{ const s=S(t); let total=0; const hm=s.match(/(\d+)\s*ساعة/); const mm=s.match(/(\d+)\s*دقيقة/); if(hm) total+=Number(hm[1])*60; if(mm) total+=Number(mm[1]); return total; };

  const PROJECT_DEFAULTS=[
    ['العجلان ريفيرا 19','دوام كامل',540,20,'2025-10-01','2026-09-30'],
    ['العجلان 19','دوام كامل',540,20,'2025-10-01','2026-09-30'],
    ['العجلان 30','دوام كامل',540,180,'2026-06-20','2027-06-19'],
    ['الرمز A17','دوام كامل',540,150,'2026-06-01','2027-05-31'],
    ['الرمز 17 A','دوام كامل',540,150,'2026-06-01','2027-05-31'],
    ['مكين 37','دوام كامل',540,90,'2025-04-24','2026-07-23'],
    ['الماجدية 88','دوام كامل',540,40,'2025-12-01','2026-11-30'],
    ['وجود الياسمين','دوام كامل',540,300,'2026-04-14','2027-04-13'],
    ['صفاء 65','دوام كامل',720,60,'2026-01-13','2027-01-12'],
    ['برج جوديا صباح','دوام كامل',720,720,'2026-01-01','2026-12-31'],
    ['صفاء 28','دوام كامل',540,60,'2026-01-01','2026-12-31'],
    ['الشعلان 50','زيارة يومية',540,30,'2026-01-01','2026-12-31'],
    ['الشعلان 51','زيارة يومية',540,30,'2026-02-01','2027-01-31']
  ];
  const defFor=name=>{ const n=norm(name); return PROJECT_DEFAULTS.find(d=>{const dn=norm(d[0]); return n===dn || n.includes(dn) || dn.includes(n);}); };
  function typeOverride(name,type){
    const n=norm(name), t=norm(type);
    if(n.includes('الشعلان')&&(n.includes('50')||n.includes('51'))) return 'زيارة يومية';
    if((n.includes('العجلان')&&(n.includes('ريفيرا')||n.includes('19')||n.includes('30'))) || (n.includes('مكين')&&n.includes('37')) || (n.includes('الرمز')&&(n.includes('a17')||n.includes('17')))) return 'دوام كامل';
    const d=defFor(name); if(d) return d[1];
    if(t.includes('دوام')||t.includes('كامل')||t.includes('دائم')||t.includes('full')||t.includes('24')) return 'دوام كامل';
    return 'زيارة يومية';
  }
  const isFull=r=>typeOverride(r.projectName,r.projectType)==='دوام كامل';
  function monthRange(ym){ const [y,m]=S(ym).split('-').map(Number); return {start:new Date(y,m-1,1), end:new Date(y,m,0)}; }
  function requiredForMonth(r){
    const d=defFor(r.projectName);
    const daily=Number(r.requiredDailyMinutes||r.requiredMinutes||r.required_daily_minutes||(d?d[2]:0))||0;
    const friday=Number(r.fridayMinutes||r.friday_minutes||(d?d[3]:daily))||daily;
    if(!daily) return 0;
    const {start,end}=monthRange(monthVal()); let a=start,b=end;
    const cs=r.contractStart||r.contract_start||(d?d[4]:''); const ce=r.contractEnd||r.contract_end||(d?d[5]:'');
    if(cs){const x=new Date(cs+'T00:00:00'); if(x>a) a=x;} if(ce){const x=new Date(ce+'T00:00:00'); if(x<b) b=x;}
    if(a>b) return 0; let total=0;
    for(let cur=new Date(a); cur<=b; cur.setDate(cur.getDate()+1)) total += cur.getDay()===5 ? friday : daily;
    return total;
  }
  function workerTokens(txt){
    if(Array.isArray(txt)) return [...new Set(txt.map(S).filter(Boolean))];
    const out=[], s=S(txt).replace(/\s+/g,' '); if(!s) return out;
    const matches=s.match(/TS-\d+\s*-\s*[^،,\n]+|TS-\d+/gi);
    if(matches) matches.forEach(m=>out.push(S(m).toUpperCase().replace(/\s*-\s*/,' - '))); else s.split(/[،,\n]+/).map(S).filter(Boolean).forEach(x=>out.push(x));
    return [...new Set(out)];
  }
  const projectKey=name=>norm(name).replace(/\s+/g,' ');

  const EMBEDDED_JUNE_ROWS_V395=[{"projectId":"excel-2026-06-001","projectName":"برج جوديا مساء","projectType":"زيارة يومية","supervisorId":"TS-14+TS-11","supervisorName":"TS-14 + TS-11 - صالح","supervisorCodes":["TS-14","TS-11"],"workerCodes":["TS-12","TS-13","TS-15","TS-16"],"workers":["TS-12 - بتشا","TS-13 - علم","TS-15 - ابراهيم","TS-16 - فلومية"],"logsCount":0,"totalMinutes":14322,"requiredMinutes":0,"transferMinutes":0,"percentage":100.0,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-002","projectName":"اتحاد العاصمة","projectType":"زيارة يومية","supervisorId":"TS-06","supervisorName":"TS-06 - حسن","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"logsCount":0,"totalMinutes":3003,"requiredMinutes":0,"transferMinutes":0,"percentage":27.164179104477608,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-003","projectName":"أثل 12","projectType":"زيارة يومية","supervisorId":"TS-06","supervisorName":"TS-06 - حسن","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"logsCount":0,"totalMinutes":3612,"requiredMinutes":0,"transferMinutes":0,"percentage":32.6729986431479,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-004","projectName":"الين 32","projectType":"زيارة يومية","supervisorId":"TS-06","supervisorName":"TS-06 - حسن","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"logsCount":0,"totalMinutes":1773,"requiredMinutes":0,"transferMinutes":0,"percentage":16.03799185888738,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-005","projectName":"جادة 39","projectType":"زيارة يومية","supervisorId":"TS-06","supervisorName":"TS-06 - حسن","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"logsCount":0,"totalMinutes":444,"requiredMinutes":0,"transferMinutes":0,"percentage":4.016282225237449,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-006","projectName":"فرساي 10","projectType":"زيارة يومية","supervisorId":"TS-06","supervisorName":"TS-06 - حسن","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"logsCount":0,"totalMinutes":877,"requiredMinutes":0,"transferMinutes":0,"percentage":7.933061962912709,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-007","projectName":"فرساي 11","projectType":"زيارة يومية","supervisorId":"TS-06","supervisorName":"TS-06 - حسن","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"logsCount":0,"totalMinutes":613,"requiredMinutes":0,"transferMinutes":0,"percentage":5.545002261420172,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-008","projectName":"فرساي 4","projectType":"زيارة يومية","supervisorId":"TS-06","supervisorName":"TS-06 - حسن","supervisorCodes":["TS-06"],"workerCodes":["TS-07","TS-08","TS-09","TS-10"],"workers":["TS-07 - ديلوار","TS-08 - روبيول","TS-09 - علي","TS-10 - كوثر"],"logsCount":0,"totalMinutes":733,"requiredMinutes":0,"transferMinutes":0,"percentage":6.63048395391678,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-009","projectName":"آفاق العربية","projectType":"زيارة يومية","supervisorId":"TS-01","supervisorName":"TS-01 - فهد","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"logsCount":0,"totalMinutes":2103,"requiredMinutes":0,"transferMinutes":0,"percentage":16.652149813920342,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-010","projectName":"تعمير 17","projectType":"زيارة يومية","supervisorId":"TS-01","supervisorName":"TS-01 - فهد","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"logsCount":0,"totalMinutes":2240,"requiredMinutes":0,"transferMinutes":0,"percentage":17.7369546282366,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-011","projectName":"رؤيا 1","projectType":"زيارة يومية","supervisorId":"TS-01","supervisorName":"TS-01 - فهد","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"logsCount":0,"totalMinutes":999,"requiredMinutes":0,"transferMinutes":0,"percentage":7.910365032860876,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-012","projectName":"رايات نجد 5","projectType":"زيارة يومية","supervisorId":"TS-01","supervisorName":"TS-01 - فهد","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"logsCount":0,"totalMinutes":919,"requiredMinutes":0,"transferMinutes":0,"percentage":7.276902367566712,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-013","projectName":"عالم الابتكار 47","projectType":"زيارة يومية","supervisorId":"TS-01","supervisorName":"TS-01 - فهد","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"logsCount":0,"totalMinutes":2367,"requiredMinutes":0,"transferMinutes":0,"percentage":18.742576609391083,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-014","projectName":"فارهين 11","projectType":"زيارة يومية","supervisorId":"TS-01","supervisorName":"TS-01 - فهد","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"logsCount":0,"totalMinutes":733,"requiredMinutes":0,"transferMinutes":0,"percentage":5.804101670757779,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-015","projectName":"فرساي 7","projectType":"زيارة يومية","supervisorId":"TS-01","supervisorName":"TS-01 - فهد","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"logsCount":0,"totalMinutes":1418,"requiredMinutes":0,"transferMinutes":0,"percentage":11.228125742339062,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-016","projectName":"مغنى 29","projectType":"زيارة يومية","supervisorId":"TS-01","supervisorName":"TS-01 - فهد","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"logsCount":0,"totalMinutes":1141,"requiredMinutes":0,"transferMinutes":0,"percentage":9.034761263758018,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-017","projectName":"هاجر 32","projectType":"زيارة يومية","supervisorId":"TS-01","supervisorName":"TS-01 - فهد","supervisorCodes":["TS-01"],"workerCodes":["TS-02","TS-03","TS-04","TS-05"],"workers":["TS-02 - جاشيم","TS-03 - سوجان","TS-04 - عليم","TS-05 - مهيد"],"logsCount":0,"totalMinutes":709,"requiredMinutes":0,"transferMinutes":0,"percentage":5.614062871169531,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-018","projectName":"وجود الياسمين","projectType":"دوام كامل","supervisorId":"TS-17","supervisorName":"TS-17 - مازن الخطيب","supervisorCodes":["TS-17"],"workerCodes":["TS-18","TS-19","TS-20","TS-21","TS-22","TS-23","TS-24","TS-25","TS-26"],"workers":["TS-18 - اشرف","TS-19 - الونجير","TS-20 - أنور","TS-21 - تيفور","TS-22 - جابيت","TS-23 - رشيد","TS-24 - شميم","TS-25 - ناظمون","TS-26 - هلال"],"logsCount":0,"totalMinutes":16183,"requiredMinutes":0,"transferMinutes":0,"percentage":100.0,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-019","projectName":"الرمز 17 A","projectType":"زيارة يومية","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-28","TS-29","TS-30"],"workers":["TS-28 - ديكسان","TS-29 - ميزان","TS-30 - محمد  ياسر"],"logsCount":0,"totalMinutes":16139,"requiredMinutes":0,"transferMinutes":0,"percentage":30.539681338228057,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-020","projectName":"العجلان ريفيرا 19","projectType":"دوام كامل","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-31","TS-33"],"workers":["TS-31 - رؤوف","TS-33 - اوميت"],"logsCount":0,"totalMinutes":15655,"requiredMinutes":0,"transferMinutes":0,"percentage":29.62381258751845,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-021","projectName":"الماجدية 107","projectType":"زيارة يومية","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"logsCount":0,"totalMinutes":4774,"requiredMinutes":0,"transferMinutes":0,"percentage":9.033796313817508,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-022","projectName":"الماجدية 88","projectType":"دوام كامل","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-36","TS-37"],"workers":["TS-36 - رقيب","TS-37 - عجائب"],"logsCount":0,"totalMinutes":9462,"requiredMinutes":0,"transferMinutes":0,"percentage":17.904855618211407,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-023","projectName":"صفاء 50","projectType":"زيارة يومية","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"logsCount":0,"totalMinutes":2788,"requiredMinutes":0,"transferMinutes":0,"percentage":5.275706770616508,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-024","projectName":"كاف A","projectType":"زيارة يومية","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"logsCount":0,"totalMinutes":1144,"requiredMinutes":0,"transferMinutes":0,"percentage":2.1647806834954397,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-025","projectName":"كاف B","projectType":"زيارة يومية","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"logsCount":0,"totalMinutes":724,"requiredMinutes":0,"transferMinutes":0,"percentage":1.3700185444499111,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-026","projectName":"كاف c","projectType":"زيارة يومية","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"logsCount":0,"totalMinutes":887,"requiredMinutes":0,"transferMinutes":0,"percentage":1.6784619460318662,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-027","projectName":"مغنى 14","projectType":"زيارة يومية","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"logsCount":0,"totalMinutes":682,"requiredMinutes":0,"transferMinutes":0,"percentage":1.2905423305453583,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-028","projectName":"واجهة قرطبة","projectType":"زيارة يومية","supervisorId":"TS-27","supervisorName":"TS-27 - محمد إبراهيم","supervisorCodes":["TS-27"],"workerCodes":["TS-32","TS-34","TS-35","TS-38"],"workers":["TS-32 - اوسيس","TS-34 - راهي","TS-35 - عاريف","TS-38 - رحمن"],"logsCount":0,"totalMinutes":591,"requiredMinutes":0,"transferMinutes":0,"percentage":1.1183438670854937,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-029","projectName":"جمال الأندلس","projectType":"زيارة يومية","supervisorId":"TS-39","supervisorName":"TS-39 - محمد عبده","supervisorCodes":["TS-39"],"workerCodes":["TS-40","TS-44"],"workers":["TS-40 - راسيل","TS-44 - مهيب"],"logsCount":0,"totalMinutes":1734,"requiredMinutes":0,"transferMinutes":0,"percentage":5.082510185538001,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-030","projectName":"صفاء 28","projectType":"دوام كامل","supervisorId":"TS-39","supervisorName":"TS-39 - محمد عبده","supervisorCodes":["TS-39"],"workerCodes":["TS-43","TS-42","TS-40","TS-41"],"workers":["TS-43 - عريف","TS-42 - ديلوا","TS-40 - راسيل","TS-41 - اكرامول"],"logsCount":0,"totalMinutes":14594,"requiredMinutes":0,"transferMinutes":0,"percentage":42.77632851657531,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-031","projectName":"صفاء 65","projectType":"دوام كامل","supervisorId":"TS-39","supervisorName":"TS-39 - محمد عبده","supervisorCodes":["TS-39"],"workerCodes":["TS-44","TS-45","TS-46"],"workers":["TS-44 - مهيب","TS-45 - ليتون","TS-46 - همينتو"],"logsCount":0,"totalMinutes":17789,"requiredMinutes":0,"transferMinutes":0,"percentage":52.14116129788668,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-032","projectName":"الشعلان 50","projectType":"دوام كامل","supervisorId":"TS-47","supervisorName":"TS-47 - محمود","supervisorCodes":["TS-47"],"workerCodes":["TS-48","TS-49"],"workers":["TS-48 - راجو","TS-49 - اجارول"],"logsCount":0,"totalMinutes":13670,"requiredMinutes":0,"transferMinutes":0,"percentage":27.947009036267733,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-033","projectName":"الشعلان 51","projectType":"دوام كامل","supervisorId":"TS-47","supervisorName":"TS-47 - محمود","supervisorCodes":["TS-47"],"workerCodes":["TS-48","TS-49"],"workers":["TS-48 - راجو","TS-49 - اجارول"],"logsCount":0,"totalMinutes":13409,"requiredMinutes":0,"transferMinutes":0,"percentage":27.413419470908124,"commitment":0,"source":"Excel شهر 6 - أكواد العمال","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-034","projectName":"العجلان 30","projectType":"دوام كامل","supervisorId":"TS-47","supervisorName":"TS-47 - محمود","supervisorCodes":["TS-47"],"workerCodes":["TS-50","TS-51","TS-52","TS-53","TS-54","TS-55"],"workers":["TS-50 - ثابت","TS-51 - شانتو","TS-52 - عبد السلام","TS-53 - مساد","TS-54 - مختار","TS-55 - ميزان 2"],"logsCount":0,"totalMinutes":6120,"requiredMinutes":0,"transferMinutes":0,"percentage":12.511755325673631,"commitment":0,"source":"Excel شهر 6 - أكواد العمال - دوام كامل محدّث","lastUpdated":"2026-06-30T23:59:00+03:00"},{"projectId":"excel-2026-06-035","projectName":"مكين 37","projectType":"دوام كامل","supervisorId":"TS-47","supervisorName":"TS-47 - محمود","supervisorCodes":["TS-47"],"workerCodes":["TS-56","TS-57","TS-58","TS-59"],"workers":["TS-56 - اكتار","TS-57 - جهيد","TS-58 - جوناب علي","TS-59 - ركيب"],"logsCount":0,"totalMinutes":15715,"requiredMinutes":0,"transferMinutes":0,"percentage":32.127816167150506,"commitment":0,"source":"Excel شهر 6 - أكواد العمال - دوام كامل محدّث","lastUpdated":"2026-06-30T23:59:00+03:00"}];
  async function loadJuneRows(){
    if(monthVal()!=='2026-06') return [];
    return normalizeRows((EMBEDDED_JUNE_ROWS_V395||[]).map(x=>({
      projectId:x.projectId,
      projectName:x.projectName,
      projectType:typeOverride(x.projectName,x.projectType),
      supervisorName:S(x.supervisorName||x.supervisorId||'غير محدد'),
      workers:workerTokens(x.workers||x.workerCodes),
      totalMinutes:N(x.totalMinutes),
      source:'بيانات شهر 6 الأصلية المضمنة v395'
    })));
  }
  function extractRowsFromTable(){
    const rows=[];
    const trs=[...document.querySelectorAll('#mt52Body tr')];
    trs.forEach(tr=>{
      const td=[...tr.children]; if(td.length<5) return;
      // دعم أكثر من ترتيب أعمدة لأن النسخ السابقة تغيرت
      const texts=td.map(x=>S(x.innerText));
      let supervisor=texts[0]||'غير محدد', project=texts[1]||'', workers=texts[2]||'';
      if(!project || /لا توجد|اختر الشهر/.test(project)) return;
      let minutes=0;
      for(const t of texts){
        const val=N(t); const hm=parseHoursTxt(t);
        if(hm>minutes) minutes=hm;
        if(val>minutes && val<1000000) minutes=val;
      }
      rows.push({supervisorName:supervisor, projectName:project, projectType:typeOverride(project,texts.join(' ')), workers:workerTokens(workers), totalMinutes:minutes, source:'جدول الأوقات'});
    });
    return normalizeRows(rows);
  }
  function normalizeRows(rows){
    const map=new Map();
    (rows||[]).forEach(x=>{
      const r={...x}; r.projectName=S(r.projectName); if(!r.projectName) return;
      r.projectType=typeOverride(r.projectName,r.projectType);
      r.totalMinutes=Number(r.totalMinutes)||0;
      r.workers=workerTokens(r.workers||[]);
      const k=projectKey(r.projectName); const old=map.get(k);
      if(!old){ map.set(k,r); return; }
      old.totalMinutes=Math.max(Number(old.totalMinutes)||0, Number(r.totalMinutes)||0);
      old.workers=[...new Set([...(old.workers||[]),...(r.workers||[])])];
      if((!old.supervisorName||old.supervisorName==='غير محدد')&&r.supervisorName) old.supervisorName=r.supervisorName;
      old.projectType=typeOverride(old.projectName,old.projectType);
    });
    const out=[...map.values()];
    const daily=out.filter(r=>!isFull(r));
    const supTotals={}; daily.forEach(r=>{const k=norm(r.supervisorName||'غير محدد'); supTotals[k]=(supTotals[k]||0)+(Number(r.totalMinutes)||0);});
    out.forEach(r=>{
      r.projectType=typeOverride(r.projectName,r.projectType);
      if(isFull(r)){
        r.requiredMinutes=requiredForMonth(r);
        r.percentage=r.requiredMinutes>0 ? ((Number(r.totalMinutes)||0)/r.requiredMinutes*100) : 0;
        r.calcNote='دوام كامل: الوقت المستغرق ÷ الوقت المطلوب للمشروع نفسه';
      }else{
        const st=supTotals[norm(r.supervisorName||'غير محدد')]||0;
        r.requiredMinutes=0;
        r.percentage=st>0 ? ((Number(r.totalMinutes)||0)/st*100) : 0;
        r.calcNote='زيارة يومية: وقت المشروع ÷ إجمالي وقت المشرف';
      }
    });
    return out.sort((a,b)=>(Number(isFull(a))-Number(isFull(b))) || S(a.supervisorName).localeCompare(S(b.supervisorName),'ar') || S(a.projectName).localeCompare(S(b.projectName),'ar'));
  }
  async function getRows(){
    const june=await loadJuneRows();
    if(june.length && june.reduce((a,r)=>a+r.totalMinutes,0)>0) return june;
    return extractRowsFromTable();
  }
  function ensureCss(){
    if($('mt395Css')) return;
    const st=document.createElement('style'); st.id='mt395Css';
    st.textContent=`.mt395-note{background:#fff8e8;border:1px solid #ead28d;color:#6a4d00;border-radius:14px;padding:10px 12px;margin:8px 0 12px;font-weight:800;line-height:1.8}.mt395-super{border:1px solid #cfe2da;border-radius:18px;background:#fff;overflow:hidden;margin:12px 0}.mt395-super>h3{margin:0;background:#0a4539;color:#fff;padding:12px 14px}.mt395-grid{display:grid!important;grid-template-columns:repeat(3,minmax(280px,1fr))!important;gap:12px!important}.mt395-card{border:1px solid #dbe8e2!important;border-radius:18px!important;background:#fbfdfc!important;padding:13px!important;break-inside:avoid!important;box-shadow:0 8px 22px rgba(0,0,0,.04)!important}.mt395-card.full{border:2px solid #123b70!important;background:#fbfdff!important}.mt395-card h4{margin:0 0 10px!important;text-align:right!important;color:#0a4539!important;font-size:18px!important}.mt395-card.full h4{color:#123b70!important}.mt395-line{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed #d7e5df;padding:7px 0}.mt395-line span{color:#60746c}.mt395-line b{color:#0a4539;text-align:left}.mt395-workers{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.mt395-workers span{background:#eef6f3;border:1px solid #dbe8e2;border-radius:999px;padding:5px 9px;font-weight:800;color:#0a4539}.mt395-bar{height:10px;background:#e7f0ec;border-radius:999px;overflow:hidden;margin-top:8px}.mt395-bar i{display:block;height:100%;background:#0a4539}.mt395-card.full .mt395-bar i{background:#123b70}@media(max-width:1200px){.mt395-grid{grid-template-columns:repeat(2,minmax(260px,1fr))!important}}@media(max-width:760px){.mt395-grid{grid-template-columns:1fr!important}}`;
    document.head.appendChild(st);
  }
  function card(r){
    const full=isFull(r), workers=(r.workers||[]).length?r.workers:['لا يوجد عمال مربوطين'];
    return `<article class="mt395-card ${full?'full':''}"><h4>${esc(r.projectName)}</h4><div class="mt395-line"><span>المشرف</span><b>${esc(r.supervisorName||'-')}</b></div><div class="mt395-line"><span>نوع التشغيل</span><b>${esc(r.projectType)}</b></div><div class="mt395-line"><span>الوقت المستغرق</span><b>${esc(arMins(r.totalMinutes))}</b></div><div class="mt395-line"><span>إجمالي الدقائق</span><b>${Math.round(r.totalMinutes).toLocaleString('en-US')}</b></div>${full?`<div class="mt395-line"><span>الوقت المطلوب</span><b>${r.requiredMinutes?esc(arMins(r.requiredMinutes)):'-'}</b></div>`:''}<div class="mt395-line"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div><div class="mt395-bar"><i style="width:${Math.min(100,Math.max(0,r.percentage)).toFixed(0)}%"></i></div><div class="mt395-workers">${workers.map(w=>`<span>${esc(w)}</span>`).join('')}</div></article>`;
  }
  async function render(){
    if(window.__mt395Rendering) return window.tasneefMonthlyV395Rows||[];
    window.__mt395Rendering=true;
    ensureCss();
    const rows=await getRows();
    window.__mt395Rendering=false;
    if(!rows.length) return rows;
    window.tasneefMonthlyV395Rows=rows; window.tasneefMonthlyV393Rows=rows;
    const daily=rows.filter(r=>!isFull(r)), full=rows.filter(r=>isFull(r));
    const visitGrid=$('mt52VisitGrid');
    if(visitGrid){
      const bySup=new Map(); daily.forEach(r=>{const k=r.supervisorName||'غير محدد'; if(!bySup.has(k)) bySup.set(k,[]); bySup.get(k).push(r);});
      visitGrid.className='';
      visitGrid.innerHTML=`<div class="mt395-note">تصحيح v395: تم إلغاء الصفر وقراءة شهر 6 من ملف الأوقات الأصلي. مشاريع الزيارة حسب المشرف، وكل مشروع مربع مستقل.</div>`+[...bySup.entries()].map(([sup,list])=>`<section class="mt395-super"><h3>${esc(sup)}</h3><div class="mt395-grid">${list.map(card).join('')}</div></section>`).join('');
    }
    const workersCard=document.querySelector('.monthly-workers-v10152');
    if(workersCard){
      const h=workersCard.querySelector('h2'); if(h) h.textContent='المشاريع الدائمة / الدوام الكامل';
      const small=workersCard.querySelector('small'); if(small) small.textContent='كل مشروع يظهر في مربع مستقل وحسابه لحاله: الوقت المستغرق ÷ الوقت المطلوب.';
      const grid=$('mt52WorkersGrid'); if(grid){grid.className='mt395-grid'; grid.innerHTML=full.length?full.map(card).join(''):'<div class="mt395-note">لا توجد مشاريع دوام كامل لهذا الشهر.</div>';}
    }
    const summary=$('mt52Summary');
    if(summary){ const total=rows.reduce((a,r)=>a+r.totalMinutes,0); summary.innerHTML=`<div class="mt52-kpi"><small>الشهر</small><b>${esc(monthVal())}</b></div><div class="mt52-kpi"><small>المشاريع بدون تكرار</small><b>${rows.length}</b></div><div class="mt52-kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="mt52-kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="mt52-kpi"><small>إجمالي الوقت</small><b>${esc(arMins(total))}</b></div>`; }
    const msg=$('mt52Message'); if(msg){msg.classList.remove('hidden'); msg.textContent='تم التصحيح v395: الأوقات أصبحت من بيانات شهر 6 الأصلية وليست صفراً، وكل مشروع دوام كامل يظهر مربع مستقل.';}
    patchTable(rows);
    return rows;
  }
  function patchTable(rows){
    const body=$('mt52Body'); if(!body||!rows.length) return;
    body.innerHTML=rows.map(r=>`<tr><td>${esc(r.supervisorName)}</td><td>${esc(r.projectName)}</td><td>${(r.workers||[]).map(esc).join('، ')||'-'}</td><td>-</td><td>${Math.round(r.totalMinutes).toLocaleString('en-US')}</td><td>${esc(arMins(r.totalMinutes))}</td><td>${r.requiredMinutes?Math.round(r.requiredMinutes).toLocaleString('en-US'):'-'}</td><td><b>${pct(r.percentage)}</b></td><td>${esc(r.projectType)}</td><td>${esc(r.calcNote)}</td><td>${esc(r.source||'-')}</td></tr>`).join('');
  }
  async function printReport(ev){
    if(ev){ev.preventDefault(); ev.stopPropagation();}
    const rows=(window.tasneefMonthlyV395Rows&&window.tasneefMonthlyV395Rows.length)?window.tasneefMonthlyV395Rows:await render();
    const daily=rows.filter(r=>!isFull(r)), full=rows.filter(r=>isFull(r));
    const bySup=new Map(); daily.forEach(r=>{const k=r.supervisorName||'غير محدد'; if(!bySup.has(k)) bySup.set(k,[]); bySup.get(k).push(r);});
    const total=rows.reduce((a,r)=>a+r.totalMinutes,0);
    const logo=(document.querySelector('img[src*="tasneef_logo_print"]')?.src)||'tasneef_logo_print.png';
    const pcard=r=>`<article class="p-card ${isFull(r)?'full':''}"><h3>${esc(r.projectName)}</h3><div class="line"><span>المشرف</span><b>${esc(r.supervisorName)}</b></div><div class="line"><span>نوع التشغيل</span><b>${esc(r.projectType)}</b></div><div class="line"><span>الوقت المستغرق</span><b>${esc(arMins(r.totalMinutes))}</b></div><div class="line"><span>إجمالي الدقائق</span><b>${Math.round(r.totalMinutes).toLocaleString('en-US')}</b></div>${isFull(r)?`<div class="line"><span>الوقت المطلوب</span><b>${r.requiredMinutes?esc(arMins(r.requiredMinutes)):'-'}</b></div>`:''}<div class="line"><span>نسبة المشروع</span><b>${pct(r.percentage)}</b></div><div class="bar"><i style="width:${Math.min(100,Math.max(0,r.percentage)).toFixed(0)}%"></i></div><div class="workers"><b>العمال:</b> ${(r.workers||[]).map(esc).join('، ')||'-'}</div></article>`;
    const dailyHtml=[...bySup.entries()].map(([sup,list])=>`<section class="super"><h2>${esc(sup)}</h2><div class="grid">${list.map(pcard).join('')}</div></section>`).join('')||'<div class="empty">لا توجد مشاريع زيارة يومية.</div>';
    const fullHtml=full.length?`<section class="full-section"><h2>المشاريع الدائمة / الدوام الكامل</h2><div class="grid">${full.map(pcard).join('')}</div></section>`:'<div class="empty">لا توجد مشاريع دوام كامل.</div>';
    const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الأوقات الشهرية ${esc(monthVal())}</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;margin:0;color:#15231f;background:#fff}.head{border:2px solid #0a4539;border-radius:18px;background:#f7fcfa;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.brand{display:flex;gap:12px;align-items:center}.brand img{width:100px;height:58px;object-fit:contain;background:#fff;border:1px solid #dbe8e2;border-radius:12px;padding:6px}h1{margin:0;color:#0a4539;font-size:24px}.sub{color:#60746c;margin-top:4px}.month{background:#0a4539;color:#fff;border-radius:16px;padding:9px 18px;text-align:center}.month b{display:block;font-size:24px}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px}.kpi{border:1px solid #dbe8e2;border-radius:14px;background:#fbfdfc;padding:8px;text-align:center}.kpi small{display:block;color:#60746c}.kpi b{font-size:18px;color:#0a4539}.title{font-size:18px;color:#0a4539;margin:10px 0 6px}.super,.full-section{border:1px solid #dbe8e2;border-radius:16px;margin:9px 0;overflow:hidden;break-inside:avoid}.super h2,.full-section h2{margin:0;background:#0a4539;color:#fff;padding:9px 12px;font-size:17px}.full-section h2{background:#123b70}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;padding:9px}.p-card{border:1px solid #dbe8e2;border-radius:14px;background:#fbfdfc;padding:10px;break-inside:avoid}.p-card.full{border:2px solid #123b70;background:#fbfdff}.p-card h3{margin:0 0 8px;color:#0a4539;font-size:16px}.p-card.full h3{color:#123b70}.line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed #d9e5df;padding:5px 0;font-size:12px}.line span{color:#60746c}.line b{color:#0a4539}.workers{font-size:12px;line-height:1.7;margin-top:8px}.bar{height:9px;background:#e7f0ec;border-radius:999px;overflow:hidden;margin-top:7px}.bar i{display:block;height:100%;background:#0a4539}.p-card.full .bar i{background:#123b70}.empty{text-align:center;color:#60746c;padding:18px}.footer{display:flex;justify-content:space-between;color:#60746c;border-top:1px solid #dbe8e2;padding-top:7px;margin-top:10px;font-size:11px}@media print{.p-card,.super,.full-section{break-inside:avoid}}</style></head><body><header class="head"><div class="brand"><img src="${logo}"><div><h1>تقرير الأوقات الشهرية</h1><div class="sub">تصحيح v395: كل مشروع دوام كامل مربع مستقل، والوقت من ملف الأوقات الشهرية الأصلي بدون تصفير</div></div></div><div class="month"><small>الشهر</small><b>${esc(monthVal())}</b><small>V${VERSION}</small></div></header><div class="kpis"><div class="kpi"><small>المشاريع بدون تكرار</small><b>${rows.length}</b></div><div class="kpi"><small>زيارة يومية</small><b>${daily.length}</b></div><div class="kpi"><small>دوام كامل</small><b>${full.length}</b></div><div class="kpi"><small>إجمالي الدقائق</small><b>${Math.round(total).toLocaleString('en-US')}</b></div><div class="kpi"><small>إجمالي الوقت</small><b>${esc(arMins(total))}</b></div></div><h2 class="title">مشاريع الزيارة اليومية حسب المشرف</h2>${dailyHtml}${fullHtml}<div class="footer"><span>تم إنشاء التقرير من نظام شركة تصنيف لإدارة المرافق ويعتبر معتمدًا ما لم يبرر العميل خلاف ذلك</span><span>${new Date().toLocaleString('en-GB')}</span></div><script>setTimeout(()=>print(),600)<\/script></body></html>`;
    const w=window.open('','_blank'); if(w){w.document.write(html);w.document.close();} else window.print(); return false;
  }
  function attach(){
    const print=$('mt52Print'); if(print && print.dataset.v395!=='1'){ print.dataset.v395='1'; print.textContent='طباعة التقرير المصحح v395'; print.addEventListener('click',printReport,true); print.onclick=printReport; }
    ['mt52Refresh','mt52Rebuild'].forEach(id=>{const b=$(id); if(b&&b.dataset.v395!=='1'){b.dataset.v395='1'; b.addEventListener('click',()=>setTimeout(render,1800),true);}});
  }
  function boot(){ attach(); setInterval(attach,1000); setTimeout(render,800); setTimeout(render,1800); setTimeout(render,3500); setTimeout(render,6000); let n=0; const iv=setInterval(()=>{n++; render(); if(n>10) clearInterval(iv);},2000); }
  window.tasneefMonthlyCardsV395={render,print:printReport,typeOverride,requiredForMonth,normalizeRows};
  window.tasneefPrintMonthlyFormulaV391=printReport; window.tasneefPrintMonthlyFormulaV392=printReport; window.tasneefPrintMonthlyFormulaV393=printReport;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();
