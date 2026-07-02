(function(){
  'use strict';
  const VERSION='V10280';
  const $=(id)=>document.getElementById(id);
  const esc=(v)=>String(v??'').replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  const num=(v)=>Number(String(v??'').replace(/,/g,''))||0;
  const money=(v)=>Number(num(v).toFixed(2)).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});
  const today=()=>new Date().toISOString().slice(0,10);
  const monthStart=(m)=>`${m}-01`;
  const daysInMonth=(m)=>{ const [y,mo]=String(m).split('-').map(Number); return new Date(y,mo,0).getDate(); };
  const dateRangeEnd=(m)=>{ const [y,mo]=String(m).split('-').map(Number); return `${y}-${String(mo).padStart(2,'0')}-${String(new Date(y,mo,0).getDate()).padStart(2,'0')}`; };
  let state={workers:[],projects:[],users:[],attendance:[],settings:[],saved:[],profiles:[],rows:[]};

  // V10272: بيانات شهر 06-2026 مطابقة حرفيًا لآخر ملف Excel معتمد من المستخدم.
  const JUNE_2026_EXACT_SALARY_ROWS = [{"row_order":1,"employee_ts_id":"TS-01","salary_month":"2026-06","residency_name":"شاه فهد شاه فهد","employee_name":"فهد","iqama_no":"2590242596","work_location":"FM","job_title":"مشرف","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1800.0,"allowance":200.0,"gross_salary":2000.0,"salary_by_days":2000.0,"commission":200.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":2200.0,"notes":"","manual_extra_deductions":0.0},{"row_order":2,"employee_ts_id":"TS-02","salary_month":"2026-06","residency_name":"محمد جاسم الدين","employee_name":"جاشيم","iqama_no":"2631728975","work_location":"فهد","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":50.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":3,"employee_ts_id":"TS-03","salary_month":"2026-06","residency_name":"سوزان داري","employee_name":"سوجان","iqama_no":"2596960688","work_location":"فهد","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":4,"employee_ts_id":"TS-04","salary_month":"2026-06","residency_name":"عليم الدين عليم الدين","employee_name":"عليم","iqama_no":"2604544011","work_location":"فهد","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":1.0,"payable_days":29.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1530.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":5,"employee_ts_id":"TS-05","salary_month":"2026-06","residency_name":"مد مهدي حسن","employee_name":"مهيد","iqama_no":"2632053159","work_location":"فهد","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":1.0,"payable_days":29.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":0.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1450.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":6,"employee_ts_id":"TS-06","salary_month":"2026-06","residency_name":"حسن عبدالحميد حسن","employee_name":"حسن","iqama_no":"2503201192","work_location":"FM","job_title":"مشرف","start_date":"2026-06-15","end_date":"2026-06-30","work_days":16.0,"absent_days":0.0,"payable_days":16.0,"basic_salary":2000.0,"allowance":300.0,"gross_salary":2300.0,"salary_by_days":1226.67,"commission":150.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1376.67,"notes":"","manual_extra_deductions":0.0},{"row_order":7,"employee_ts_id":"TS-07","salary_month":"2026-06","residency_name":"مد دلوار حوسان","employee_name":"ديلوار","iqama_no":"2610965622","work_location":"حسن","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":50.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":8,"employee_ts_id":"TS-08","salary_month":"2026-06","residency_name":"روبل محمد تورا علي","employee_name":"روبيول","iqama_no":"2568699892","work_location":"حسن","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":50.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":9,"employee_ts_id":"TS-09","salary_month":"2026-06","residency_name":"علي النور راشد","employee_name":"علي","iqama_no":"2625986555","work_location":"حسن","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1500.0,"notes":"","manual_extra_deductions":0.0},{"row_order":10,"employee_ts_id":"TS-10","salary_month":"2026-06","residency_name":"مد كوثر مياه","employee_name":"كوثر","iqama_no":"2510373091","work_location":"حسن","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-23","work_days":23.0,"absent_days":0.0,"payable_days":23.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1150.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1230.0,"notes":"","manual_extra_deductions":0.0},{"row_order":11,"employee_ts_id":"TS-11","salary_month":"2026-06","residency_name":"صالح احمد علي صالح","employee_name":"صالح","iqama_no":"2138086331","work_location":"برج جوديا مساء","job_title":"مشرف","start_date":"2026-06-13","end_date":"2026-06-30","work_days":18.0,"absent_days":0.0,"payable_days":18.0,"basic_salary":2000.0,"allowance":300.0,"gross_salary":2300.0,"salary_by_days":1380.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1380.0,"notes":"","manual_extra_deductions":0.0},{"row_order":12,"employee_ts_id":"TS-12","salary_month":"2026-06","residency_name":"عبدالرحيم باد ساه","employee_name":"بتشا","iqama_no":"262733392","work_location":"برج جوديا مساء","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":100.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1600.0,"notes":"","manual_extra_deductions":0.0},{"row_order":13,"employee_ts_id":"TS-13","salary_month":"2026-06","residency_name":"ديدار ال عالم","employee_name":"علم","iqama_no":"2605133442","work_location":"برج جوديا مساء","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":100.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1600.0,"notes":"","manual_extra_deductions":0.0},{"row_order":14,"employee_ts_id":"TS-14","salary_month":"2026-06","residency_name":"","employee_name":"لطفي","iqama_no":"","work_location":"برج جوديا صباج","job_title":"مشرف","start_date":"2026-06-13","end_date":"2026-06-30","work_days":18.0,"absent_days":0.0,"payable_days":18.0,"basic_salary":2000.0,"allowance":300.0,"gross_salary":2300.0,"salary_by_days":1380.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1380.0,"notes":"","manual_extra_deductions":0.0},{"row_order":15,"employee_ts_id":"TS-15","salary_month":"2026-06","residency_name":"إبراهيم ميا","employee_name":"ابراهيم","iqama_no":"A12575180","work_location":"برج جوديا صباج","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":1.0,"payable_days":29.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1530.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":16,"employee_ts_id":"TS-16","salary_month":"2026-06","residency_name":"فل ميه","employee_name":"فلومية","iqama_no":"A08052496","work_location":"برج جوديا صباج","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":100.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1600.0,"notes":"","manual_extra_deductions":0.0},{"row_order":17,"employee_ts_id":"TS-17","salary_month":"2026-06","residency_name":"مازن محمود  الخطيب","employee_name":"مازن الخطيب","iqama_no":"2632941221","work_location":"وجود الياسمين","job_title":"مشرف","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":2300.0,"allowance":200.0,"gross_salary":2500.0,"salary_by_days":2500.0,"commission":150.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":2650.0,"notes":"","manual_extra_deductions":0.0},{"row_order":18,"employee_ts_id":"TS-18","salary_month":"2026-06","residency_name":"محمد ارفال علام","employee_name":"اشرف","iqama_no":"2591983834","work_location":"وجود الياسمين","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":19,"employee_ts_id":"TS-19","salary_month":"2026-06","residency_name":"مد المغير","employee_name":"الونجير","iqama_no":"2611721362","work_location":"وجود الياسمين","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":20,"employee_ts_id":"TS-20","salary_month":"2026-06","residency_name":"أنور حسين","employee_name":"أنور","iqama_no":"A02459151","work_location":"وجود الياسمين","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":21,"employee_ts_id":"TS-21","salary_month":"2026-06","residency_name":"طيب ال رحمن","employee_name":"تيفور","iqama_no":"2582069692","work_location":"وجود الياسمين","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":22,"employee_ts_id":"TS-22","salary_month":"2026-06","residency_name":"بروديب مد محمحد مد","employee_name":"جابيت","iqama_no":"2621483334","work_location":"وجود الياسمين","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":23,"employee_ts_id":"TS-23","salary_month":"2026-06","residency_name":"مد راشد مد كازي","employee_name":"رشيد","iqama_no":"2628904696","work_location":"وجود الياسمين","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1500.0,"notes":"","manual_extra_deductions":0.0},{"row_order":24,"employee_ts_id":"TS-24","salary_month":"2026-06","residency_name":"شميم مياه","employee_name":"شميم","iqama_no":"2594630317","work_location":"وجود الياسمين","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":25,"employee_ts_id":"TS-25","salary_month":"2026-06","residency_name":"مد نجح الحق الحق","employee_name":"ناظمون","iqama_no":"2572167886","work_location":"وجود الياسمين","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":26,"employee_ts_id":"TS-26","salary_month":"2026-06","residency_name":"محمد هلال احمد","employee_name":"هلال","iqama_no":"2559093071","work_location":"وجود الياسمين","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":27,"employee_ts_id":"TS-27","salary_month":"2026-06","residency_name":"محمد إبراهيم محمد","employee_name":"محمد إبراهيم","iqama_no":"2623949415","work_location":"FM","job_title":"مشرف","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":2000.0,"allowance":300.0,"gross_salary":2300.0,"salary_by_days":2300.0,"commission":210.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":2510.0,"notes":"","manual_extra_deductions":0.0},{"row_order":28,"employee_ts_id":"TS-28","salary_month":"2026-06","residency_name":"مد فك شان","employee_name":"ديكسان","iqama_no":"A17270467","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":29,"employee_ts_id":"TS-29","salary_month":"2026-06","residency_name":"ميزان مياه ميزان مياه","employee_name":"ميزان","iqama_no":"2607714272","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":30,"employee_ts_id":"TS-30","salary_month":"2026-06","residency_name":"محمد ياسر محمد ياسر","employee_name":"ياسر","iqama_no":"2590242224","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":31,"employee_ts_id":"TS-31","salary_month":"2026-06","residency_name":"عبدال روف عبد ال روف","employee_name":"رؤوف","iqama_no":"2588414587","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1500.0,"notes":"","manual_extra_deductions":0.0},{"row_order":32,"employee_ts_id":"TS-32","salary_month":"2026-06","residency_name":"اوسيس شاندر","employee_name":"اوسيس","iqama_no":"A12772701","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":50.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":33,"employee_ts_id":"TS-33","salary_month":"2026-06","residency_name":"اوميت شيك خليل","employee_name":"اوميت","iqama_no":"2598201024","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":34,"employee_ts_id":"TS-34","salary_month":"2026-06","residency_name":"راهي احمد شودري","employee_name":"راهي","iqama_no":"2600892497","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":35,"employee_ts_id":"TS-35","salary_month":"2026-06","residency_name":"مد عريف سردل","employee_name":"عاريف","iqama_no":"2597129754","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":1.0,"payable_days":29.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1530.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":36,"employee_ts_id":"TS-36","salary_month":"2026-06","residency_name":"مد رقيب مياه","employee_name":"رقيب","iqama_no":"2588109567","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":50.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":37,"employee_ts_id":"TS-37","salary_month":"2026-06","residency_name":"عجائب دليل فيتا","employee_name":"عجائب","iqama_no":"2612512877","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":38,"employee_ts_id":"TS-38","salary_month":"2026-06","residency_name":"المغير رحمن المغير","employee_name":"رحمن","iqama_no":"2588414447","work_location":"محمد إبراهيم","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":39,"employee_ts_id":"TS-39","salary_month":"2026-06","residency_name":"محمد عبدالحق عباس","employee_name":"محمد عبده","iqama_no":"2630045207","work_location":"FM","job_title":"مشرف","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":2000.0,"allowance":300.0,"gross_salary":2300.0,"salary_by_days":2300.0,"commission":200.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":2500.0,"notes":"","manual_extra_deductions":0.0},{"row_order":40,"employee_ts_id":"TS-40","salary_month":"2026-06","residency_name":"مد راسل مد مياه","employee_name":"راسيل","iqama_no":"2612619300","work_location":"محمد عبده","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":41,"employee_ts_id":"TS-41","salary_month":"2026-06","residency_name":"مد اكرامول ال اوسين","employee_name":"اكرامول","iqama_no":"2525556508","work_location":"محمد عبده","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":1.0,"payable_days":29.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":50.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1500.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":42,"employee_ts_id":"TS-42","salary_month":"2026-06","residency_name":"محمد ليبو مياه","employee_name":"ديلوا","iqama_no":"2593116243","work_location":"محمد عبده","job_title":"عامل","start_date":"2026-06-11","end_date":"2026-06-30","work_days":20.0,"absent_days":0.0,"payable_days":20.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1000.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1000.0,"notes":"","manual_extra_deductions":0.0},{"row_order":43,"employee_ts_id":"TS-43","salary_month":"2026-06","residency_name":"مد عريف فقر","employee_name":"عريف","iqama_no":"2615559057","work_location":"محمد عبده","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":44,"employee_ts_id":"TS-44","salary_month":"2026-06","residency_name":"مد مهيب الرحمن","employee_name":"مهيب","iqama_no":"2562201745","work_location":"محمد عبده","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1500.0,"notes":"","manual_extra_deductions":0.0},{"row_order":45,"employee_ts_id":"TS-45","salary_month":"2026-06","residency_name":"مد ليتون ميا","employee_name":"ليتون","iqama_no":"2558253262","work_location":"محمد عبده","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-23","work_days":23.0,"absent_days":1.0,"payable_days":22.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1150.0,"commission":80.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1180.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":46,"employee_ts_id":"TS-46","salary_month":"2026-06","residency_name":"هيمونتو داش","employee_name":"همينتو","iqama_no":"2609947433","work_location":"محمد عبده","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":1.0,"payable_days":29.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1530.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":47,"employee_ts_id":"TS-47","salary_month":"2026-06","residency_name":"محمود احمد مصطفي","employee_name":"محمود","iqama_no":"po 8978741","work_location":"FM","job_title":"مشرف","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":2000.0,"allowance":300.0,"gross_salary":2300.0,"salary_by_days":2300.0,"commission":100.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":2400.0,"notes":"","manual_extra_deductions":0.0},{"row_order":48,"employee_ts_id":"TS-48","salary_month":"2026-06","residency_name":"راجو احمد","employee_name":"راجو","iqama_no":"2589141064","work_location":"محمود","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":1.0,"payable_days":29.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1530.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":49,"employee_ts_id":"TS-49","salary_month":"2026-06","residency_name":"محمد سال محمد بهير","employee_name":"اجارول","iqama_no":"2618749085","work_location":"محمود","job_title":"عامل","start_date":"2026-06-20","end_date":"2026-06-30","work_days":11.0,"absent_days":0.0,"payable_days":11.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":550.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":50,"employee_ts_id":"TS-50","salary_month":"2026-06","residency_name":"ثابت شودري","employee_name":"ثابت","iqama_no":"2578931400","work_location":"محمود","job_title":"عامل","start_date":"2026-06-20","end_date":"2026-06-30","work_days":11.0,"absent_days":0.0,"payable_days":11.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":550.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":51,"employee_ts_id":"TS-51","salary_month":"2026-06","residency_name":"برانتو داش","employee_name":"شانتو","iqama_no":"2635435221","work_location":"محمود","job_title":"عامل","start_date":"2026-06-20","end_date":"2026-06-30","work_days":11.0,"absent_days":0.0,"payable_days":11.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":550.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":52,"employee_ts_id":"TS-52","salary_month":"2026-06","residency_name":"","employee_name":"عبد السلام","iqama_no":"","work_location":"محمود","job_title":"عامل","start_date":"2026-06-20","end_date":"2026-06-30","work_days":11.0,"absent_days":0.0,"payable_days":11.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":550.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":53,"employee_ts_id":"TS-53","salary_month":"2026-06","residency_name":"مسال ميا","employee_name":"مساد","iqama_no":"2629057650","work_location":"محمود","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":11.0,"payable_days":19.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":550.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1030.0,"notes":"خصم غياب: 11 أيام","manual_extra_deductions":0.0},{"row_order":54,"employee_ts_id":"TS-54","salary_month":"2026-06","residency_name":"مفتاح اباريا اباموغا","employee_name":"مختار","iqama_no":"2639003512","work_location":"محمود","job_title":"عامل","start_date":"2026-06-20","end_date":"2026-06-30","work_days":11.0,"absent_days":0.0,"payable_days":11.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":550.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":55,"employee_ts_id":"TS-55","salary_month":"2026-06","residency_name":"ميزانر الرحمن الرحمن","employee_name":"ميزان 2","iqama_no":"2588512703","work_location":"محمود","job_title":"عامل","start_date":"2026-06-20","end_date":"2026-06-30","work_days":11.0,"absent_days":1.0,"payable_days":10.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":550.0,"commission":0.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":500.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":56,"employee_ts_id":"TS-56","salary_month":"2026-06","residency_name":"اختار حسين","employee_name":"اكتار","iqama_no":"2569565041","work_location":"محمود","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":1.0,"payable_days":29.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":50.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1500.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":57,"employee_ts_id":"TS-57","salary_month":"2026-06","residency_name":"محمد جايدر رحمن","employee_name":"جهيد","iqama_no":"2563858634","work_location":"محمود","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1580.0,"notes":"","manual_extra_deductions":0.0},{"row_order":58,"employee_ts_id":"TS-58","salary_month":"2026-06","residency_name":"محمد جوناب علي","employee_name":"جوناب علي","iqama_no":"2525413676","work_location":"محمود","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":1.0,"payable_days":29.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":80.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1530.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":0.0},{"row_order":59,"employee_ts_id":"TS-59","salary_month":"2026-06","residency_name":"مد رقيب مد رقيب","employee_name":"ركيب","iqama_no":"2609445594","work_location":"محمود","job_title":"عامل","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":50.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1550.0,"notes":"","manual_extra_deductions":0.0},{"row_order":60,"employee_ts_id":"TS-60","salary_month":"2026-06","residency_name":"محمد حمدي يوسف","employee_name":"محمد حمدي","iqama_no":"2502281229","work_location":"بررج جوديا","job_title":"مشرف","start_date":"2026-06-28","end_date":"2026-06-30","work_days":3.0,"absent_days":0.0,"payable_days":3.0,"basic_salary":200.0,"allowance":300.0,"gross_salary":2300.0,"salary_by_days":230.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":230.0,"notes":"","manual_extra_deductions":0.0},{"row_order":61,"employee_ts_id":"TS-61","salary_month":"2026-06","residency_name":"","employee_name":"مازن محمد","iqama_no":"","work_location":"حسن","job_title":"مشرف","start_date":"2026-06-01","end_date":"2026-06-13","work_days":13.0,"absent_days":0.0,"payable_days":13.0,"basic_salary":2000.0,"allowance":300.0,"gross_salary":2300.0,"salary_by_days":997.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":997.0,"notes":"رحل","manual_extra_deductions":0.0},{"row_order":62,"employee_ts_id":"TS-62","salary_month":"2026-06","residency_name":"اسعد مدني","employee_name":"اسعد","iqama_no":"2547694634","work_location":"صيانة","job_title":"فني","start_date":"2026-06-01","end_date":"2026-06-24","work_days":24.0,"absent_days":0.0,"payable_days":24.0,"basic_salary":2500.0,"allowance":300.0,"gross_salary":2800.0,"salary_by_days":2240.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":2240.0,"notes":"رحل","manual_extra_deductions":0.0},{"row_order":63,"employee_ts_id":"TS-63","salary_month":"2026-06","residency_name":"ابازر جعفر يوسف","employee_name":"اباذر","iqama_no":"2607828155","work_location":"صيانة","job_title":"فني","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1800.0,"allowance":200.0,"gross_salary":2000.0,"salary_by_days":2000.0,"commission":100.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":2100.0,"notes":"","manual_extra_deductions":0.0},{"row_order":64,"employee_ts_id":"TS-64","salary_month":"2026-06","residency_name":"تشابيل حسين","employee_name":"حسين","iqama_no":"2495945905","work_location":"صيانة","job_title":"فني","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1500.0,"commission":100.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1600.0,"notes":"","manual_extra_deductions":0.0},{"row_order":65,"employee_ts_id":"TS-65","salary_month":"2026-06","residency_name":"يعقوب","employee_name":"يعقوب","iqama_no":"2489866166","work_location":"صيانة","job_title":"فني","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":2700.0,"allowance":300.0,"gross_salary":3000.0,"salary_by_days":3000.0,"commission":100.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":3100.0,"notes":"","manual_extra_deductions":0.0},{"row_order":66,"employee_ts_id":"TS-66","salary_month":"2026-06","residency_name":"رحيم حسين رحيم","employee_name":"رحيم","iqama_no":"2622548283","work_location":"صيانة","job_title":"فني","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1300.0,"allowance":200.0,"gross_salary":1500.0,"salary_by_days":1450.0,"commission":0.0,"deductions":50.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1450.0,"notes":"خصم غياب: 1 يوم","manual_extra_deductions":50.0},{"row_order":67,"employee_ts_id":"TS-67","salary_month":"2026-06","residency_name":"مد الإسلام","employee_name":"شريف","iqama_no":"2489590048","work_location":"صيانة","job_title":"فني","start_date":"2026-06-01","end_date":"2026-06-10","work_days":10.0,"absent_days":0.0,"payable_days":10.0,"basic_salary":2700.0,"allowance":300.0,"gross_salary":3000.0,"salary_by_days":1000.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1000.0,"notes":"رحل","manual_extra_deductions":0.0},{"row_order":68,"employee_ts_id":"TS-68","salary_month":"2026-06","residency_name":"مد جويل ميا","employee_name":"جويل","iqama_no":"6431428926","work_location":"صيانة","job_title":"فني","start_date":"2026-06-15","end_date":"2026-06-30","work_days":15.0,"absent_days":0.0,"payable_days":15.0,"basic_salary":1500.0,"allowance":200.0,"gross_salary":1700.0,"salary_by_days":850.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":850.0,"notes":"","manual_extra_deductions":0.0},{"row_order":69,"employee_ts_id":"TS-69","salary_month":"2026-06","residency_name":"","employee_name":"عبد الرحمن","iqama_no":"","work_location":"صفاء 65","job_title":"حارس","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":200.0,"allowance":200.0,"gross_salary":400.0,"salary_by_days":400.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":400.0,"notes":"","manual_extra_deductions":0.0},{"row_order":70,"employee_ts_id":"TS-70","salary_month":"2026-06","residency_name":"سورت عين كازي علي","employee_name":"علي","iqama_no":"2471022208","work_location":"الماجدية 107","job_title":"حارس","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1200.0,"allowance":200.0,"gross_salary":1400.0,"salary_by_days":1400.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1400.0,"notes":"","manual_extra_deductions":0.0},{"row_order":71,"employee_ts_id":"TS-71","salary_month":"2026-06","residency_name":"","employee_name":"وهيب","iqama_no":"","work_location":"أثل 12","job_title":"حارس","start_date":"2026-06-01","end_date":"2026-06-30","work_days":30.0,"absent_days":0.0,"payable_days":30.0,"basic_salary":1500.0,"allowance":300.0,"gross_salary":1800.0,"salary_by_days":1800.0,"commission":0.0,"deductions":0.0,"rounding":0.0,"advance_deduction":0.0,"net_salary":1800.0,"notes":"","manual_extra_deductions":0.0}];

  function msg(t,kind){ const el=$('salaryMsg'); if(!el) return; el.className='msg '+(kind==='err'?'err':''); el.textContent=t; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),5000); }
  async function fetchAll(table, select='*', build){
    let out=[], from=0, size=1000;
    while(true){
      let q=sb.from(table).select(select).range(from,from+size-1);
      if(build) q=build(q);
      const {data,error}=await q;
      if(error) throw error;
      out=out.concat(data||[]);
      if(!data || data.length<size) break;
      from+=size;
    }
    return out;
  }
  function supervisorName(id){ const u=state.users.find(x=>String(x.id)===String(id)); return u?.full_name||u?.username||''; }
  function workerSupId(w){ return w.app_supervisor_id || w.supervisor_id || null; }
  function workerProjectId(w){ return w.project_id || w.assigned_project_id || null; }
  function statusPresent(s){ return ['present','حاضر','حضور'].includes(String(s||'').trim()); }
  function statusAbsent(s){ return ['absent','غائب','غياب'].includes(String(s||'').trim()); }
  function settingFor(type,id){ return state.settings.find(s=>s.entity_type===type && String(s.entity_id)===String(id))||{}; }
  function savedFor(type,id,month){
    // V10267: الإصلاح المهم
    // monthly_salaries.entity_id رقمي، بينما الصف داخل الشاشة قد يكون entity_id مثل TS-10.
    // لذلك نطابق الحفظ أولاً بالرقم، ثم بكود الموظف employee_ts_id / employee_code.
    const rawId=String(id||'');
    const tsFromId=(rawId.match(/TS[-_\s]?(\d+)/i)||[])[1];
    const numericFromTs=tsFromId ? String(Number(tsFromId)) : '';
    const cleanTs=tsFromId ? ('TS-'+String(Number(tsFromId)).padStart(2,'0')) : rawId;
    return state.saved.find(s=>{
      if(s.entity_type!==type) return false;
      if(String(s.salary_month||'').slice(0,7)!==month) return false;
      const sid=String(s.entity_id||'');
      const sts=String(s.employee_ts_id||s.employee_code||'');
      return sid===rawId || (numericFromTs && sid===numericFromTs) || sts===rawId || sts===cleanTs;
    }) || {};
  }
  function workerNameKey(v){ return String(v||'').trim().replace(/\s+/g,' '); }
  function normName(v){
    return workerNameKey(v).replace(/[إأآا]/g,'ا').replace(/[ى]/g,'ي').replace(/[ة]/g,'ه').replace(/[ًٌٍَُِّْـ]/g,'').toLowerCase();
  }

  function jobCategory(v){
    const s=String(v||'').trim();
    if(s.includes('مشرف')) return 'supervisors';
    if(s.includes('فني') || s.includes('صيانة')) return 'technicians';
    if(s.includes('حارس')) return 'guards';
    return 'workers';
  }
  function isNoSupervisorName(v){
    const s=normName(v);
    return !s || s==='بدون مشرف' || s==='بدونمشرف' || s==='غير مرتبط' || s==='غيرمرتبط';
  }

  function cleanSalaryName(v){
    return workerNameKey(v).replace(/^[\s\-–—_\.]+|[\s\-–—_\.]+$/g,'');
  }
  function isValidSalaryName(v){
    const s=cleanSalaryName(v);
    if(!s) return false;
    if(/^\d+$/.test(s)) return false;
    if(/^TS[-\s]?\d+$/i.test(s)) return false;
    if(/^(0|00|000|nan|null|undefined)$/i.test(s)) return false;
    // لازم يحتوي حرف عربي أو إنجليزي، وليس أرقام فقط
    return /[؀-ۿA-Za-z]/.test(s);
  }
  function displayNameForRow(r){
    const a=cleanSalaryName(r.employee_name);
    const b=cleanSalaryName(r.residency_name);
    if(isValidSalaryName(a)) return a;
    if(isValidSalaryName(b)) return b;
    return '';
  }
  function rowKeyByName(r){
    return jobCategory(r.job_title)+'|'+normName(displayNameForRow(r));
  }
  function betterSalaryRow(a,b){
    // احتفظ بالصف الأكثر اكتمالًا عند تكرار الاسم
    const score=(r)=>[
      r.employee_ts_id, r.residency_name, r.employee_name, r.iqama_no,
      r.work_location, r.job_title, r.start_date, r.end_date
    ].filter(x=>String(x||'').trim()).length + num(r.net_salary?1:0);
    return score(b)>score(a)?b:a;
  }
  function sanitizeSalaryRows(rows){
    const map=new Map();
    (rows||[]).forEach(r=>{
      const name=displayNameForRow(r);
      if(!name) return;
      r.employee_name=name;
      if(!isValidSalaryName(r.residency_name)) r.residency_name = r.residency_name && /[؀-ۿA-Za-z]/.test(String(r.residency_name)) ? r.residency_name : name;
      const key=rowKeyByName(r);
      if(!key || key.endsWith('|')) return;
      if(!map.has(key)) map.set(key,r);
      else map.set(key, betterSalaryRow(map.get(key), r));
    });
    return [...map.values()];
  }
  function supervisorGroupKeys(s){
    const keys=[s.employee_name, s.residency_name, s.supervisor_name];
    const wl=normName(s.work_location);
    // في ملف الرواتب بعض المشرفين يكون مكان العمل هو اسم المشروع/الفترة مثل برج جوديا،
    // وعمالهم يحملون نفس مكان العمل. لا نستخدم FM كمفتاح لأنه عام.
    if(wl && wl!=='fm') keys.push(s.work_location);
    return new Set(keys.map(normName).filter(Boolean));
  }
  function workerBelongsToSupervisor(r, s){
    const keys=supervisorGroupKeys(s);
    const vals=[r.work_location, r.supervisor_name, r.project_name].map(normName).filter(Boolean);
    return vals.some(v=>keys.has(v));
  }
  function salarySort(a,b){
    return num(a.row_order||9999)-num(b.row_order||9999) || String(displayNameForRow(a)).localeCompare(String(displayNameForRow(b)),'ar');
  }
  function salaryGroupedBuckets(rows){
    rows=sanitizeSalaryRows(rows).sort(salarySort);
    const supervisors=rows.filter(r=>jobCategory(r.job_title)==='supervisors');
    const workers=rows.filter(r=>jobCategory(r.job_title)==='workers');
    const guards=rows.filter(r=>jobCategory(r.job_title)==='guards');
    const techs=rows.filter(r=>jobCategory(r.job_title)==='technicians');
    const other=rows.filter(r=>!['supervisors','workers','guards','technicians'].includes(jobCategory(r.job_title)));
    const used=new Set();
    const groups=[];
    supervisors.forEach(s=>{
      const children=workers.filter(w=>!used.has(w) && workerBelongsToSupervisor(w,s)).sort(salarySort);
      children.forEach(w=>used.add(w));
      groups.push({type:'supervisor', supervisor:s, workers:children});
    });
    // أي عامل جديد من الحضور وليس موجودًا في ملف الربط يظهر للتنبيه فقط، ولا نضعه باسم عمال إضافيون.
    const unlinked=workers.filter(w=>!used.has(w)).sort(salarySort);
    return {groups, unlinked, techs:techs.sort(salarySort), guards:guards.sort(salarySort), other:other.sort(salarySort)};
  }
  function orderSalaryRowsForView(rows){
    const b=salaryGroupedBuckets(rows);
    const out=[];
    b.groups.forEach(g=>{ out.push({...g.supervisor,_isSupervisorExport:true}); g.workers.forEach(w=>out.push(w)); });
    b.techs.forEach(r=>out.push(r));
    b.guards.forEach(r=>out.push(r));
    b.unlinked.forEach(r=>out.push(r));
    b.other.forEach(r=>out.push(r));
    return out;
  }
  function profileByName(name){
    const key=normName(name);
    if(!key) return null;
    return (state.profiles||[]).find(p=>{
      const a=normName(p.employee_name), b=normName(p.residency_name), c=normName(p.work_location);
      return a===key || b===key || (a && key.includes(a)) || (key && a.includes(key)) || (c && c===key);
    }) || null;
  }
  function applyProfile(r, p){
    if(!p) return r;
    r.profile_id=p.id||null;
    r.employee_ts_id=r.employee_ts_id || p.employee_ts_id || '';
    r.residency_name=r.residency_name || p.residency_name || '';
    r.iqama_no=r.iqama_no || p.iqama_no || '';
    r.employee_name=r.employee_name || p.employee_name || '';
    r.work_location=p.work_location || r.work_location || 'FM';
    r.job_title=p.job_title || r.job_title || '';
    if(!r.start_date && p.default_start_date) r.start_date=String(p.default_start_date).slice(0,10);
    if(!r.end_date && p.default_end_date) r.end_date=String(p.default_end_date).slice(0,10);
    if((r.basic_salary===undefined || r.basic_salary===null || num(r.basic_salary)===0) && p.basic_salary!=null) r.basic_salary=num(p.basic_salary);
    if((r.allowance===undefined || r.allowance===null) && p.allowance!=null) r.allowance=num(p.allowance);
    if((r.commission===undefined || r.commission===null || num(r.commission)===0) && p.default_commission!=null) r.commission=num(p.default_commission);
    return r;
  }
  function projectNamesForGroup(g){
    const names=[...g.projectIds].map(id=>state.projects.find(p=>String(p.id)===String(id))?.name).filter(Boolean);
    return [...new Set(names)].join('، ');
  }
  function relatedProfileAttendance(p, month){
    // مطابقة مرنة بين أسماء ملف الإقامة وسجلات الحضور: الاسم الحركي / اسم الإقامة / جزء من الاسم.
    const rawNames=[p.employee_name,p.residency_name,p.employee_ts_id].map(workerNameKey).filter(Boolean);
    const keys=rawNames.map(normName).filter(Boolean);
    const present=new Set(), absent=new Set();
    if(!keys.length) return {present:[],absent:[],dates:[]};
    const isMatch=(value)=>{
      const n=normName(value);
      if(!n) return false;
      return keys.some(k=>{
        if(!k) return false;
        if(n===k) return true;
        // لا نسمح بالمطابقة الجزئية إلا إذا الاسم أكثر من حرفين حتى لا نربط خطأ.
        return (k.length>2 && n.includes(k)) || (n.length>2 && k.includes(n));
      });
    };
    (state.attendance||[]).forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10); if(!d.startsWith(month)) return;
      if(!isMatch(a.worker_identity||a.worker_name||a.employee_name)) return;
      if(statusAbsent(a.status)) absent.add(d); else if(statusPresent(a.status)) present.add(d);
    });
    return {present:[...present],absent:[...absent],dates:[...new Set([...present,...absent])].sort()};
  }

  function projectSupId(pid){ const p=state.projects.find(x=>String(x.id)===String(pid)); return p?.supervisor_id||null; }
  function uniqueWorkerGroups(){
    const map=new Map();
    state.workers.filter(w=>String(w.status||'active')!=='deleted' && String(w.status||'active')!=='inactive').forEach(w=>{
      const name=workerNameKey(w.name||w.full_name||w.worker_identity);
      if(!name) return;
      if(!map.has(name)) map.set(name,{name,workers:[],ids:new Set(),supervisorIds:new Set(),projectIds:new Set()});
      const g=map.get(name); g.workers.push(w); if(w.id!=null) g.ids.add(String(w.id));
      const sid=workerSupId(w); if(sid) g.supervisorIds.add(String(sid));
      const pid=workerProjectId(w); if(pid){ g.projectIds.add(String(pid)); const ps=projectSupId(pid); if(ps) g.supervisorIds.add(String(ps)); }
    });
    return [...map.values()].map(g=>{
      g.rep=g.workers.slice().sort((a,b)=>{
        const ap=workerProjectId(a)?0:1, bp=workerProjectId(b)?0:1;
        if(ap!==bp) return ap-bp;
        return Number(a.id||999999)-Number(b.id||999999);
      })[0]||{};
      return g;
    }).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  }
  function attendanceMatchesGroup(a,g){
    const name=workerNameKey(a.worker_identity||a.worker_name);
    if(name && name===g.name) return true;
    return a.worker_id!=null && g.ids.has(String(a.worker_id));
  }
  function attendanceDaysForGroup(g, month){
    const present=new Set(), absent=new Set();
    state.attendance.forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10); if(!d.startsWith(month)) return;
      if(!attendanceMatchesGroup(a,g)) return;
      if(statusAbsent(a.status)) absent.add(d);
      else if(statusPresent(a.status)) present.add(d);
    });
    absent.forEach(d=>present.delete(d));
    return {present:present.size, absent:absent.size, presentDates:[...present].sort(), absentDates:[...absent].sort(), dates:[...new Set([...present,...absent])].sort()};
  }
  function groupHasSupervisor(g,sid){ return !sid || g.supervisorIds.has(String(sid)); }
  function groupHasProject(g,pid){ return !pid || g.projectIds.has(String(pid)); }
  function serviceSpanFromDates(dates, fallbackMonth){
    const valid=(dates||[]).filter(Boolean).sort();
    if(valid.length) return {start:valid[0], end:valid[valid.length-1]};
    return {start:monthStart(fallbackMonth), end:dateRangeEnd(fallbackMonth)};
  }
  function normalizeDate(v){ return String(v||'').slice(0,10); }
  function clampDateToMonth(d, month){
    d=normalizeDate(d);
    const start=monthStart(month), end=dateRangeEnd(month);
    if(!d) return '';
    if(d<start) return start;
    if(d>end) return end;
    return d;
  }
  function daysBetweenInclusive(start,end,month){
    start=clampDateToMonth(start,month); end=clampDateToMonth(end,month);
    if(!start || !end) return 0;
    if(end<start){ const t=start; start=end; end=t; }
    const a=new Date(start+'T00:00:00'), b=new Date(end+'T00:00:00');
    return Math.max(0, Math.round((b-a)/86400000)+1);
  }
  function countDatesInRange(dates,start,end,month){
    start=clampDateToMonth(start,month); end=clampDateToMonth(end,month);
    if(!start || !end) return 0;
    if(end<start){ const t=start; start=end; end=t; }
    const seen=new Set((dates||[]).map(normalizeDate).filter(Boolean));
    let c=0; seen.forEach(d=>{ if(d>=start && d<=end) c++; });
    return c;
  }
  function applyPeriodFromDates(r, month){
    const span=serviceSpanFromDates(r._allDates||[], month);
    let start=clampDateToMonth(r.start_date||span.start, month) || monthStart(month);
    let end=clampDateToMonth(r.end_date||span.end, month) || dateRangeEnd(month);
    if(end<start){ const t=start; start=end; end=t; }
    r.start_date=start; r.end_date=end;
    r.work_days=daysBetweenInclusive(start,end,month);
    r.absent_days=countDatesInRange(r._absentDates||[],start,end,month);
    r.payable_days=Math.max(0,num(r.work_days)-num(r.absent_days));
    return r;
  }
  function supervisorAttendanceSpan(uid, month){
    const projectIds=new Set(state.projects.filter(p=>String(p.supervisor_id)===String(uid)).map(p=>String(p.id)));
    const relatedWorkers=state.workers.filter(w=>String(workerSupId(w))===String(uid) || projectIds.has(String(workerProjectId(w))));
    const workerIds=new Set(relatedWorkers.map(w=>String(w.id)));
    const names=new Set(relatedWorkers.map(w=>String(w.name||'').trim()).filter(Boolean));
    const dates=[], absentDates=[];
    state.attendance.forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10); if(!d.startsWith(month)) return;
      const ok=(a.worker_id!=null && workerIds.has(String(a.worker_id))) || (!a.worker_id && names.has(String(a.worker_identity||'').trim()));
      if(!ok) return;
      dates.push(d);
      if(statusAbsent(a.status)) absentDates.push(d);
    });
    return {...serviceSpanFromDates(dates, month), dates:[...new Set(dates)].sort(), absentDates:[...new Set(absentDates)].sort()};
  }
  function absenceNote(days){
    const d=num(days);
    if(d<=0) return '';
    return 'خصم غياب: '+money(d)+' '+(d===1?'يوم':'أيام');
  }
  function isJuneBase(month){ return String(month||'').slice(0,7)==='2026-06'; }
  function profileRowKey(p){ return String(p?.employee_ts_id||'') || ('profile_'+String(p?.id||p?.row_order||'')); }
  function validProfile(p){ return isValidSalaryName(p?.employee_name) || isValidSalaryName(p?.residency_name); }
  function profileMatchAttendance(p, a){
    const keys=[p.employee_name,p.residency_name].map(normName).filter(Boolean);
    const n=normName(a.worker_identity||a.worker_name||a.employee_name);
    if(!n || !keys.length) return false;
    return keys.some(k=>n===k || (k.length>2 && n.includes(k)) || (n.length>2 && k.includes(n)));
  }
  function profileAttendanceStats(p, month){
    const present=new Set(), absent=new Set(), all=new Set();
    (state.attendance||[]).forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10); if(!d.startsWith(month)) return;
      if(!profileMatchAttendance(p,a)) return;
      all.add(d);
      if(statusAbsent(a.status)) absent.add(d); else if(statusPresent(a.status)) present.add(d);
    });
    absent.forEach(d=>present.delete(d));
    return {dates:[...all].sort(), presentDates:[...present].sort(), absentDates:[...absent].sort(), present:present.size, absent:absent.size};
  }
  function makeSalaryRowFromProfile(p, month, idx){
    const ts=profileRowKey(p);
    const sv=savedFor('profile', ts, month) || {};
    const base=isJuneBase(month);
    const stats=profileAttendanceStats(p, month);
    const dim=daysInMonth(month);
    const cat=jobCategory(p.job_title);
    const fullName=sv.employee_name || p.employee_name || p.residency_name || '';
    const monthSpan = {start: monthStart(month), end: dateRangeEnd(month)};
    const attSpan = serviceSpanFromDates(stats.dates, month);
    const start = sv.start_date || (base ? String(p.default_start_date||monthSpan.start).slice(0,10) : (stats.dates.length ? attSpan.start : monthSpan.start));
    const end = sv.end_date || (base ? String(p.default_end_date||monthSpan.end).slice(0,10) : (stats.dates.length ? attSpan.end : monthSpan.end));
    const basicDefault = cat==='supervisors' ? 2000 : (cat==='guards'?1200:1300);
    const allowanceDefault = cat==='supervisors' ? 300 : 200;
    let r={
      entity_type:'profile', entity_id:ts, profile_id:p.id||null, row_order:num(p.row_order||idx||9999),
      salary_month:monthStart(month), employee_ts_id:sv.employee_ts_id||p.employee_ts_id||`TS-${String(idx).padStart(2,'0')}`,
      residency_name:sv.residency_name||p.residency_name||'', iqama_no:sv.iqama_no||p.iqama_no||'',
      employee_name:fullName, work_location:sv.work_location||p.work_location||'FM', project_name:sv.project_name||p.project_name||p.work_location||'',
      supervisor_id:null, supervisor_name:p.work_location||'', job_title:sv.job_title||p.job_title||'عامل',
      start_date:start, end_date:end, work_days:0, absent_days:0, payable_days:0,
      basic_salary:sv.basic_salary ?? p.basic_salary ?? basicDefault, allowance:sv.allowance ?? p.allowance ?? allowanceDefault,
      commission:sv.commission ?? p.default_commission ?? 0, deductions:sv.deductions ?? 0, rounding:sv.rounding ?? p.default_rounding ?? 0,
      advance_deduction:sv.advance_deduction ?? p.default_advance_deduction ?? 0, payment_method:'', notes:sv.notes || p.notes || '',
      _allDates:stats.dates, _absentDates:stats.absentDates, _manual_deductions: !!sv.employee_name
    };
    if(base && !sv.employee_name){
      r.start_date=String(p.default_start_date||r.start_date).slice(0,10);
      r.end_date=String(p.default_end_date||r.end_date).slice(0,10);
      r.work_days=num(p.default_work_days); r.absent_days=num(p.default_absent_days); r.payable_days=num(p.default_payable_days);
      r.gross_salary=num(p.gross_salary||num(r.basic_salary)+num(r.allowance));
      r.salary_by_days=num(p.default_salary_by_days||0); r.commission=num(p.default_commission||0);
      r.deductions=num(p.default_deductions||0); r.rounding=num(p.default_rounding||0); r.advance_deduction=num(p.default_advance_deduction||0);
      r.net_salary=num(p.default_net_salary||0);
      return r;
    }
    applyPeriodFromDates(r, month);
    if(!sv.employee_name && r.absent_days>0){ r._manual_deductions=false; r.notes=r.notes||absenceNote(r.absent_days); }
    return calcRow(r, dim);
  }
  function calcRow(r, dim){
    r.gross_salary=num(r.basic_salary)+num(r.allowance);
    r.work_days=num(r.work_days);               // أيام الفترة المسجلة من الحضور والغياب
    r.absent_days=num(r.absent_days);           // أيام الغياب داخل نفس الفترة
    r.payable_days=Math.max(0, r.work_days-r.absent_days); // للعرض فقط
    r.absence_deduction=(num(r.gross_salary)/dim)*r.absent_days;
    // إجمالي الراتب على أيام الفترة = راتب الفترة كاملة، والغياب يظهر في الخصومات حتى يكون واضحًا.
    r.salary_by_days=(num(r.gross_salary)/dim)*r.work_days;
    if(!r._manual_deductions){
      // خصم الغياب يدخل تلقائيًا في عمود الخصومات. لا يعتمد على خصومات محفوظة قديمة بقيمة صفر.
      const manualExtra=num(r.manual_extra_deductions||0);
      r.deductions=num(r.absence_deduction)+manualExtra;
    }
    r.net_salary=num(r.salary_by_days)+num(r.commission)-num(r.deductions)-num(r.advance_deduction)+num(r.rounding);
    return r;
  }
  function attendanceGroupKey(a){
    // V10259: عدم تكرار العامل. الاسم هو المفتاح الأساسي، وليس worker_id،
    // لأن نفس العامل قد يظهر بأكثر من worker_id قديم في جدول الحضور.
    const nm=workerNameKey(a.worker_identity||a.worker_name||a.employee_name);
    if(nm) return 'name:'+normName(nm);
    if(a.worker_id!=null) return 'id:'+String(a.worker_id);
    return '';
  }
  function workerByAttendance(a){
    if(a.worker_id!=null){
      const byId=state.workers.find(w=>String(w.id)===String(a.worker_id));
      if(byId) return byId;
    }
    const nm=normName(a.worker_identity||a.worker_name||a.employee_name);
    if(!nm) return null;
    return state.workers.find(w=>normName(w.name||w.full_name||w.worker_identity)===nm) || null;
  }
  function supervisorNameFromId(id){ return supervisorName(id)||''; }
  function projectNameFromId(id){ return state.projects.find(p=>String(p.id)===String(id))?.name||''; }
  function mostFrequent(arr){
    const m=new Map();
    (arr||[]).filter(v=>v!==undefined && v!==null && String(v)!=='').forEach(v=>m.set(String(v),(m.get(String(v))||0)+1));
    return [...m.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0] || '';
  }
  function profileKeys(p){
    return [p?.employee_name,p?.residency_name].map(workerNameKey).filter(Boolean).map(normName);
  }
  function groupMetaFromAttendance(g){
    const records=g.records||[];
    const w=g.worker||{};
    const first=records[0]||{};
    const name=workerNameKey(w.name||w.full_name||first.worker_identity||first.worker_name||first.employee_name);
    let profile=profileByName(name);
    if(!profile){
      for(const a of records){
        profile=profileByName(a.worker_identity||a.worker_name||a.employee_name);
        if(profile) break;
      }
    }
    const sid=mostFrequent(records.map(a=>a.supervisor_id || workerSupId(w) || projectSupId(a.project_id||workerProjectId(w))));
    const sname=supervisorNameFromId(sid) || (profile?.work_location && jobCategory(profile.job_title)!=='supervisors' ? profile.work_location : '');
    const pids=[...new Set(records.map(a=>a.project_id||workerProjectId(w)).filter(Boolean).map(String))];
    const projects=pids.map(projectNameFromId).filter(Boolean).join('، ');
    return {name, profile, supervisor_id:sid||null, supervisor_name:sname||'', project_name:projects, projectIds:pids, worker:w};
  }
  function attendanceStats(records, month){
    const present=new Set(), absent=new Set(), all=new Set();
    (records||[]).forEach(a=>{
      const d=String(a.attendance_date||'').slice(0,10);
      if(!d || !d.startsWith(month)) return;
      all.add(d);
      if(statusAbsent(a.status)) absent.add(d);
      else if(statusPresent(a.status)) present.add(d);
    });
    // الغياب له أولوية في نفس اليوم حتى لا يحسب حاضر وغائب معًا
    absent.forEach(d=>present.delete(d));
    return {present:present.size, absent:absent.size, dates:[...all].sort(), presentDates:[...present].sort(), absentDates:[...absent].sort()};
  }
  function makeSalaryRowFromAttendance(meta, stats, month, idx, isSupervisor=false){
    const p=meta.profile || null;
    const cat=isSupervisor ? 'supervisors' : jobCategory(p?.job_title || meta.worker?.position || meta.worker?.job_title || 'عامل');
    const entityId = isSupervisor ? ('sup_'+(meta.supervisor_id||normName(meta.name)||idx)) : (meta.worker?.id ? 'worker_'+meta.worker.id : 'att_'+normName(meta.name));
    const sv=savedFor(isSupervisor?'supervisor':'attendance',entityId,month) || {};
    const span=serviceSpanFromDates(stats.dates||[], month);
    const jobTitle = sv.job_title || p?.job_title || (isSupervisor?'مشرف':(cat==='technicians'?'فني':(cat==='guards'?'حارس':'عامل')));
    const basicDefault = cat==='supervisors' ? 2000 : (cat==='guards' ? 1200 : 1300);
    const allowanceDefault = cat==='supervisors' ? 300 : 200;
    let r={
      entity_type:isSupervisor?'supervisor':'attendance',
      entity_id:entityId,
      profile_id:p?.id||null,
      row_order:num(p?.row_order||9999),
      salary_month:monthStart(month),
      employee_ts_id:sv.employee_ts_id || p?.employee_ts_id || `TS-${String(idx+1).padStart(2,'0')}`,
      residency_name:sv.residency_name || p?.residency_name || '',
      iqama_no:sv.iqama_no || p?.iqama_no || '',
      employee_name:sv.employee_name || p?.employee_name || meta.name || p?.residency_name || '',
      // مكان العمل يعتمد على ملف الإكسل/بروفايل الموظف أولاً، ثم اسم المشرف للعمال، و FM للمشرف
      work_location:sv.work_location || p?.work_location || (isSupervisor?'FM':(meta.supervisor_name||'FM')),
      project_name:sv.project_name || p?.project_name || meta.project_name || '',
      supervisor_id:meta.supervisor_id||null,
      supervisor_name:isSupervisor ? (meta.name||meta.supervisor_name||'') : (meta.supervisor_name||''),
      job_title:jobTitle,
      start_date:sv.start_date || span.start || monthStart(month),
      end_date:sv.end_date || span.end || dateRangeEnd(month),
      work_days:0,
      absent_days:0,
      payable_days:0,
      basic_salary:sv.basic_salary ?? p?.basic_salary ?? basicDefault,
      allowance:sv.allowance ?? p?.allowance ?? allowanceDefault,
      commission:sv.commission ?? p?.default_commission ?? 0,
      deductions:sv.deductions ?? 0,
      rounding:sv.rounding ?? p?.default_rounding ?? 0,
      advance_deduction:sv.advance_deduction ?? p?.default_advance_deduction ?? 0,
      payment_method:sv.payment_method || '',
      notes:sv.notes || p?.notes || '',
      _allDates:stats.dates || [],
      _absentDates:stats.absentDates || [],
      _manual_deductions: !!sv.employee_name
    };
    applyPeriodFromDates(r, month);
    if(!sv.employee_name && r.absent_days>0){
      r._manual_deductions=false;
      r.notes = r.notes || absenceNote(r.absent_days);
    }
    return calcRow(r, daysInMonth(month));
  }
  function addProfileAttendanceRows(existingKeys, month, type, sid, pid){
    const out=[];
    (state.profiles||[]).forEach((p,pi)=>{
      const cat=jobCategory(p.job_title);
      // V10259: أسماء الفنيين والحراس تأتي من ملف الرواتب/الإقامة،
      // لكن الظهور والحسابات لا تتم إلا إذا وجد لهم سجل في الحضور والغياب للشهر المختار.
      if(!['technicians','guards'].includes(cat)) return;
      if(type!=='all' && type!==cat) return;
      const keys=profileKeys(p);
      if(keys.some(k=>existingKeys.has('name:'+k))) return;
      const st=relatedProfileAttendance(p, month);
      if(!st.dates.length) return;
      const meta={
        name:p.employee_name||p.residency_name||'',
        profile:p,
        supervisor_id:null,
        supervisor_name:p.work_location||'',
        project_name:p.work_location||'',
        projectIds:[],
        worker:null
      };
      if(sid) return;
      if(pid) return;
      const row=makeSalaryRowFromAttendance(meta, st, month, 7000+pi, false);
      row.job_title=p.job_title || (cat==='technicians'?'فني':'حارس');
      row.work_location=p.work_location || row.work_location || (cat==='technicians'?'صيانة':'FM');
      out.push(row);
    });
    return out;
  }


  function exactJuneRowsV10272(month){
    return JUNE_2026_EXACT_SALARY_ROWS.map((x,idx)=>{
      const r={
        entity_type:'profile',
        entity_id:x.employee_ts_id,
        profile_id:null,
        row_order:num(x.row_order||idx+1),
        salary_month:monthStart(month),
        employee_ts_id:x.employee_ts_id,
        residency_name:x.residency_name||'',
        iqama_no:x.iqama_no||'',
        employee_name:x.employee_name||x.residency_name||'',
        work_location:x.work_location||'FM',
        project_name:x.work_location||'',
        supervisor_id:null,
        supervisor_name: jobCategory(x.job_title)==='supervisors' ? (x.employee_name||x.residency_name||'') : (x.work_location||''),
        job_title:x.job_title||'عامل',
        start_date:x.start_date||monthStart(month),
        end_date:x.end_date||dateRangeEnd(month),
        work_days:num(x.work_days),
        absent_days:num(x.absent_days),
        payable_days:num(x.payable_days),
        basic_salary:num(x.basic_salary),
        allowance:num(x.allowance),
        gross_salary:num(x.gross_salary),
        salary_by_days:num(x.salary_by_days),
        commission:num(x.commission),
        deductions:num(x.deductions),
        rounding:num(x.rounding),
        advance_deduction:num(x.advance_deduction),
        net_salary:num(x.net_salary),
        payment_method:'',
        notes:x.notes||'',
        manual_extra_deductions:num(x.manual_extra_deductions),
        _exactJuneV10272:true,
        _allDates:[],
        _absentDates:[],
        _manual_deductions:false
      };
      // V10274: قبل عرض شهر 6 نطبق أي تعديل محفوظ على نفس صف الإكسل.
      // بهذا لا ترجع بداية/نهاية الخدمة أو الأيام أو المبالغ للقيمة الأصلية بعد الحفظ.
      return applySavedSalaryToExactJuneRow(r, month);
    });
  }

  function applySavedSalaryToExactJuneRow(r, month){
    // V10273: شهر 06-2026 يبدأ من ملف Excel المعتمد، لكن أي تعديل محفوظ من الشاشة له الأولوية.
    // هذا يمنع رجوع التاريخ/الأيام/الراتب للقيم الأصلية بعد الضغط على حفظ ثم تحديث الرواتب.
    const sv = savedFor('profile', r.employee_ts_id || r.entity_id, month) || {};
    if(!sv || !Object.keys(sv).length) return r;
    const textFields = ['employee_ts_id','residency_name','iqama_no','employee_name','work_location','project_name','supervisor_name','job_title','payment_method','notes'];
    const dateFields = ['start_date','end_date'];
    const numFields = ['work_days','absent_days','payable_days','basic_salary','allowance','gross_salary','salary_by_days','commission','deductions','rounding','advance_deduction','net_salary'];
    textFields.forEach(k=>{ if(sv[k] !== undefined && sv[k] !== null && String(sv[k]) !== '') r[k]=sv[k]; });
    dateFields.forEach(k=>{ if(sv[k]) r[k]=String(sv[k]).slice(0,10); });
    numFields.forEach(k=>{ if(sv[k] !== undefined && sv[k] !== null && String(sv[k]) !== '') r[k]=num(sv[k]); });
    r.entity_type = 'profile';
    r.entity_id = r.employee_ts_id || r.entity_id;
    r._savedOverrideV10273 = true;
    r._manual_deductions = true;
    return r;
  }

  function filterExactJuneRowsV10272(rows, type, sid, pid, q){
    let out=rows||[];
    if(type && type!=='all') out=out.filter(r=>jobCategory(r.job_title)===type);
    const supervisorFilterName = sid ? supervisorName(sid) : '';
    if(sid && supervisorFilterName){
      const k=normName(supervisorFilterName);
      out=out.filter(r=>{
        if(jobCategory(r.job_title)==='supervisors') return normName(r.employee_name)===k || normName(r.residency_name)===k;
        return normName(r.work_location)===k || normName(r.supervisor_name)===k;
      });
    }
    if(pid){
      const pname=state.projects.find(p=>String(p.id)===String(pid))?.name||'';
      const pk=normName(pname);
      if(pk) out=out.filter(r=>normName(r.work_location)===pk || normName(r.project_name)===pk);
    }
    if(q){
      out=out.filter(r=>[r.employee_ts_id,r.residency_name,r.iqama_no,r.employee_name,r.work_location,r.supervisor_name,r.project_name,r.job_title].join(' ').includes(q));
    }
    return out;
  }

  function buildRows(){
    const month=$('salaryMonth')?.value||today().slice(0,7);
    const type=$('salaryType')?.value||'all';
    const sid=$('salarySupervisor')?.value||'';
    const pid=$('salaryProject')?.value||'';
    const q=($('salarySearch')?.value||'').trim();

    // V10272: شهر 06-2026 يجب أن يطابق الإكسل الصحيح 100%، لذلك لا نبنيه من الحضور ولا من ملفات SQL السابقة.
    if(isJuneBase(month)){
      state.rows = filterExactJuneRowsV10272(orderSalaryRowsForView(exactJuneRowsV10272(month)), type, sid, pid, q);
      renderSalary();
      msg('تم تحميل شهر 06-2026 من ملف Excel المعتمد مع تطبيق أي تعديلات محفوظة: '+state.rows.length+' سجل');
      return;
    }

    const supervisorFilterName = sid ? supervisorName(sid) : '';
    const projectFilterName = pid ? (state.projects.find(p=>String(p.id)===String(pid))?.name||'') : '';
    const rows=[]; const profileNameKeys=new Set();
    const profiles=(state.profiles||[]).filter(validProfile).slice().sort((a,b)=>num(a.row_order||9999)-num(b.row_order||9999));
    profiles.forEach((p,idx)=>{
      const cat=jobCategory(p.job_title);
      if(type!=='all' && type!==cat) return;
      if(sid && cat==='workers' && normName(p.work_location)!==normName(supervisorFilterName)) return;
      if(sid && cat==='supervisors' && normName(p.employee_name)!==normName(supervisorFilterName) && normName(p.residency_name)!==normName(supervisorFilterName)) return;
      if(pid && ![p.work_location,p.project_name].some(x=>normName(x)===normName(projectFilterName))) return;
      const row=makeSalaryRowFromProfile(p, month, idx+1);
      if(!displayNameForRow(row)) return;
      [p.employee_name,p.residency_name,row.employee_name,row.residency_name].map(normName).filter(Boolean).forEach(k=>profileNameKeys.add(k));
      rows.push(row);
    });

    // إضافات جديدة من الحضور والغياب إذا لم تكن موجودة في ملف الإكسل/البروفايل
    const attendanceMonth=(state.attendance||[]).filter(a=>String(a.attendance_date||'').slice(0,7)===month);
    const groups=new Map();
    attendanceMonth.forEach(a=>{
      const nm=normName(a.worker_identity||a.worker_name||a.employee_name);
      if(!nm || profileNameKeys.has(nm)) return;
      const key=attendanceGroupKey(a); if(!key) return;
      if(!groups.has(key)) groups.set(key,{records:[],worker:workerByAttendance(a)});
      groups.get(key).records.push(a);
    });
    groups.forEach((g,key)=>{
      const meta=groupMetaFromAttendance(g);
      const cat=jobCategory(meta.profile?.job_title || meta.worker?.position || meta.worker?.job_title || 'عامل');
      if(type!=='all' && type!==cat) return;
      if(sid && String(meta.supervisor_id||'')!==String(sid) && normName(meta.supervisor_name)!==normName(supervisorFilterName)) return;
      if(pid && !(g.records||[]).some(a=>String(a.project_id||'')===String(pid))) return;
      const st=attendanceStats(g.records, month); if(!st.dates.length) return;
      const r=makeSalaryRowFromAttendance(meta, st, month, 10000+rows.length, false);
      if(displayNameForRow(r)) rows.push(r);
    });

    let final=sanitizeSalaryRows(rows);
    final=orderSalaryRowsForView(final);
    if(q) final=final.filter(r=>[r.employee_ts_id,r.residency_name,r.iqama_no,r.employee_name,r.work_location,r.supervisor_name,r.project_name,r.job_title].join(' ').includes(q));
    state.rows=final;
    renderSalary();
  }
  function totals(rows){
    return rows.reduce((a,r)=>{ ['basic_salary','allowance','gross_salary','salary_by_days','commission','deductions','advance_deduction','rounding','net_salary','work_days','absent_days','payable_days'].forEach(k=>a[k]=(a[k]||0)+num(r[k])); return a; },{});
  }
  function rowInput(r,k,cls='sal-input money'){ return `<input class="${cls}" data-key="${k}" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r[k]??0)}" oninput="tasneefSalariesV10267.update('${r.entity_type}','${r.entity_id}','${k}',this.value)" onchange="tasneefSalariesV10267.update('${r.entity_type}','${r.entity_id}','${k}',this.value)">`; }
  function dateInput(r,k){ return `<input type="date" class="sal-input salary-date-input" style="width:135px" data-key="${k}" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r[k]||'')}" oninput="tasneefSalariesV10267.update('${r.entity_type}','${r.entity_id}','${k}',this.value)" onchange="tasneefSalariesV10267.update('${r.entity_type}','${r.entity_id}','${k}',this.value)">`; }
  function textInput(r,k,w=130){ return `<input class="sal-input" style="width:${w}px" data-key="${k}" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r[k]||'')}" oninput="tasneefSalariesV10267.update('${r.entity_type}','${r.entity_id}','${k}',this.value)" onchange="tasneefSalariesV10267.update('${r.entity_type}','${r.entity_id}','${k}',this.value)">`; }
  function noteInput(r,w=170){ return `<input class="sal-input salary-notes-input" style="width:${w}px" data-key="notes" data-type="${r.entity_type}" data-id="${r.entity_id}" value="${esc(r.notes||'')}" oninput="tasneefSalariesV10267.update('${r.entity_type}','${r.entity_id}','notes',this.value)" onchange="tasneefSalariesV10267.update('${r.entity_type}','${r.entity_id}','notes',this.value)">`; }
  function renderSalaryRowHtml(r,i,month){
    return `<tr data-sal-row="${r.entity_type}_${r.entity_id}">
      <td>${i}</td><td>${textInput(r,'employee_ts_id',90)}</td><td>${esc(month)}</td>
      <td>${textInput(r,'residency_name',180)}</td><td>${textInput(r,'employee_name',120)}</td><td>${textInput(r,'iqama_no',120)}</td>
      <td>${esc(r.work_location||'FM')}</td><td>${noteInput(r,170)}</td><td>${esc(r.job_title||'')}</td>
      <td>${dateInput(r,'start_date')}</td><td>${dateInput(r,'end_date')}</td>
      <td>${money(r.work_days)}</td><td>${money(r.absent_days)}</td><td>${money(r.payable_days)}</td><td>${rowInput(r,'basic_salary')}</td><td>${rowInput(r,'allowance')}</td><td>${money(r.gross_salary)}</td><td>${money(r.salary_by_days)}</td>
      <td>${rowInput(r,'commission')}</td><td>${rowInput(r,'deductions')}</td><td>${rowInput(r,'rounding')}</td><td>${rowInput(r,'advance_deduction')}</td>
      <td><b>${money(r.net_salary)}</b></td>
    </tr>`;
  }
  function renderRowsGroupedHtml(rows, month){
    let n=0, html='';
    const b=salaryGroupedBuckets(rows);
    b.groups.forEach(g=>{
      const s=g.supervisor;
      const title=s.employee_name||s.residency_name||s.supervisor_name||'مشرف';
      html += `<tr class="salary-group-row"><td colspan="23">المشرف: ${esc(title)}</td></tr>`;
      html += renderSalaryRowHtml(s, ++n, month);
      g.workers.forEach(r=>{ html+=renderSalaryRowHtml(r, ++n, month); });
    });
    if(b.techs.length){ html += `<tr class="salary-group-row"><td colspan="23">الفنيين</td></tr>`; b.techs.forEach(r=>{ html+=renderSalaryRowHtml(r, ++n, month); }); }
    if(b.guards.length){ html += `<tr class="salary-group-row"><td colspan="23">الحراس</td></tr>`; b.guards.forEach(r=>{ html+=renderSalaryRowHtml(r, ++n, month); }); }
    if(b.unlinked.length){ html += `<tr class="salary-group-row"><td colspan="23">إضافات جديدة تحتاج ربط مشرف</td></tr>`; b.unlinked.forEach(r=>{ html+=renderSalaryRowHtml(r, ++n, month); }); }
    if(b.other.length){ html += `<tr class="salary-group-row"><td colspan="23">أخرى</td></tr>`; b.other.forEach(r=>{ html+=renderSalaryRowHtml(r, ++n, month); }); }
    return html;
  }
  function renderSalary(){
    const body=$('salaryBody'); if(!body) return;
    const rows=state.rows||[], t=totals(rows), month=$('salaryMonth')?.value||today().slice(0,7);
    $('salaryKpis').innerHTML=`
      <div class="kpi"><small>عدد السجلات</small><b>${rows.length}</b></div>
      <div class="kpi"><small>الراتب الأساسي</small><b>${money(t.basic_salary)}</b></div>
      <div class="kpi"><small>البدلات</small><b>${money(t.allowance)}</b></div>
      <div class="kpi"><small>الخصومات والسلف</small><b>${money(num(t.deductions)+num(t.advance_deduction))}</b></div>
      <div class="kpi"><small>الصافي</small><b>${money(t.net_salary)}</b></div>`;
    body.innerHTML=renderRowsGroupedHtml(rows, month) || '<tr><td colspan="23">لا توجد بيانات رواتب</td></tr>';
    const foot=$('salaryFoot'); if(foot) foot.innerHTML=`<tr><td colspan="14"><b>الإجمالي</b></td><td>${money(t.basic_salary)}</td><td>${money(t.allowance)}</td><td>${money(t.gross_salary)}</td><td>${money(t.salary_by_days)}</td><td>${money(t.commission)}</td><td>${money(t.deductions)}</td><td>${money(t.rounding)}</td><td>${money(t.advance_deduction)}</td><td>${money(t.net_salary)}</td></tr>`;
  }
  function update(type,id,key,value){
    const r=state.rows.find(x=>x.entity_type===type && String(x.entity_id)===String(id)); if(!r) return;
    const month=$('salaryMonth')?.value||today().slice(0,7);
    if(key==='deductions') r._manual_deductions=true;
    if(key==='notes') r._manual_notes=true;
    r[key]=['commission','deductions','rounding','advance_deduction','basic_salary','allowance'].includes(key)?num(value):value;
    if(['start_date','end_date'].includes(key)){
      // V10266: عند تعديل بداية أو نهاية الخدمة يتم حساب الأيام فورًا من نفس التاريخ المكتوب.
      // لا نعتمد على القيم القديمة ولا ننتظر حفظ الرواتب.
      r.start_date = clampDateToMonth(r.start_date || monthStart(month), month) || monthStart(month);
      r.end_date = clampDateToMonth(r.end_date || dateRangeEnd(month), month) || dateRangeEnd(month);
      if(r.end_date < r.start_date){ const t=r.start_date; r.start_date=r.end_date; r.end_date=t; }
      r.work_days = daysBetweenInclusive(r.start_date, r.end_date, month);
      if(!r._exactJuneV10272){
        r.absent_days = countDatesInRange(r._absentDates||[], r.start_date, r.end_date, month);
      }
      r.payable_days = Math.max(0, num(r.work_days)-num(r.absent_days));
      r._manual_deductions=false;
      if(r.absent_days>0 && !r._manual_notes) r.notes=absenceNote(r.absent_days);
      if(r.absent_days<=0 && !r._manual_notes && String(r.notes||'').startsWith('خصم غياب')) r.notes='';
    }
    if(key==='deductions'){
      // المستخدم عدّل الخصومات يدويًا؛ نعتبر الرقم المكتوب هو الخصم النهائي.
      r.manual_extra_deductions=Math.max(0, num(r.deductions)-num(r.absence_deduction));
    }
    if(['basic_salary','allowance'].includes(key) && !r._manual_deductions){
      const dim=daysInMonth(month);
      r.absence_deduction=(num(r.basic_salary)+num(r.allowance))/dim*num(r.absent_days);
      r.deductions=num(r.absence_deduction)+num(r.manual_extra_deductions||0);
    }
    calcRow(r,daysInMonth(month)); renderSalary();
  }
  async function loadSalary(){
    try{
      msg('جاري تحميل الرواتب...'); const month=$('salaryMonth')?.value||today().slice(0,7), start=monthStart(month), end=dateRangeEnd(month);
      const [workers,projects,users,attendance,settings,saved,profiles]=await Promise.all([
        fetchAll('workers','*'), fetchAll('projects','*'), fetchAll('app_users','*'),
        fetchAll('attendance','*',q=>q.gte('attendance_date',start).lte('attendance_date',end)),
        fetchAll('salary_settings','*').catch(()=>[]),
        fetchAll('monthly_salaries','*',q=>q.eq('salary_month',start)).catch(()=>[]),
        fetchAll('salary_employee_profiles','*').catch(e=>{ console.warn('salary profiles load failed', e); return []; })
      ]);
      state={workers,projects,users,attendance,settings,saved,profiles,rows:[]}; fillSalaryFilters(); buildRows(); msg('تم تحميل الرواتب من ملف Excel المعتمد مع إضافات الحضور والغياب - بيانات الموظفين: '+(profiles||[]).length+' موظف');
    }catch(e){ console.error(e); msg('فشل تحميل الرواتب: '+(e.message||e),'err'); }
  }
  function fillSalaryFilters(){
    const sup=$('salarySupervisor'), pr=$('salaryProject'); if(!sup||!pr) return;
    const sv=sup.value, pv=pr.value;
    sup.innerHTML='<option value="">كل المشرفين</option>'+state.users.filter(u=>String(u.role||'')==='supervisor').map(u=>`<option value="${u.id}">${esc(u.full_name||u.username)}</option>`).join('');
    pr.innerHTML='<option value="">كل المشاريع</option>'+state.projects.filter(p=>String(p.status||'active')!=='inactive').map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    sup.value=sv; pr.value=pv;
  }

  function syncSalaryRowsFromDom(){
    // V10275: تأكيد أن التصدير والحفظ يأخذان نفس القيم الظاهرة أمامك في الجدول.
    // أحيانًا المستخدم يعدل خلية ثم يضغط تصدير/حفظ مباشرة قبل خروج المؤشر من الخلية،
    // فيبقى state.rows قديمًا. هذه الدالة تقرأ القيم من DOM ثم تعيد الحساب بنفس منطق النظام.
    const body=$('salaryBody'); if(!body) return;
    const month=$('salaryMonth')?.value||today().slice(0,7);
    const dim=daysInMonth(month);
    const numericKeys=new Set(['commission','deductions','rounding','advance_deduction','basic_salary','allowance','work_days','absent_days','payable_days','gross_salary','salary_by_days','net_salary']);
    body.querySelectorAll('tr[data-sal-row]').forEach(tr=>{
      const first=tr.querySelector('input[data-key][data-type][data-id]');
      if(!first) return;
      const type=first.dataset.type, id=first.dataset.id;
      const r=state.rows.find(x=>x.entity_type===type && String(x.entity_id)===String(id));
      if(!r) return;
      let dateChanged=false, baseChanged=false, deductionChanged=false, notesChanged=false;
      tr.querySelectorAll('input[data-key]').forEach(inp=>{
        const k=inp.dataset.key; if(!k) return;
        let v=inp.value;
        if(numericKeys.has(k)){
          const nv=num(v);
          if(Math.abs(num(r[k])-nv)>0.000001){
            if(k==='deductions') deductionChanged=true;
            if(k==='basic_salary' || k==='allowance') baseChanged=true;
          }
          r[k]=nv;
        }else{
          if(String(r[k]??'')!==String(v??'')){
            if(k==='start_date' || k==='end_date') dateChanged=true;
            if(k==='notes') notesChanged=true;
          }
          r[k]=v;
        }
      });
      if(notesChanged) r._manual_notes=true;
      if(deductionChanged){
        r._manual_deductions=true;
        const absenceBase=Math.round(((num(r.basic_salary)+num(r.allowance))/dim*num(r.absent_days))*100)/100;
        r.manual_extra_deductions=Math.round((num(r.deductions)-absenceBase)*100)/100;
      }
      if(dateChanged){
        r.start_date=clampDateToMonth(r.start_date||monthStart(month),month)||monthStart(month);
        r.end_date=clampDateToMonth(r.end_date||dateRangeEnd(month),month)||dateRangeEnd(month);
        if(r.end_date<r.start_date){ const t=r.start_date; r.start_date=r.end_date; r.end_date=t; }
        r.work_days=daysBetweenInclusive(r.start_date,r.end_date,month);
        if(!r._exactJuneV10272) r.absent_days=countDatesInRange(r._absentDates||[],r.start_date,r.end_date,month);
        r.payable_days=Math.max(0,num(r.work_days)-num(r.absent_days));
        if(!r._manual_deductions) r.manual_extra_deductions=0;
        if(r.absent_days>0 && !r._manual_notes) r.notes=absenceNote(r.absent_days);
        if(r.absent_days<=0 && !r._manual_notes && String(r.notes||'').startsWith('خصم غياب')) r.notes='';
      }
      if(baseChanged && !r._manual_deductions){
        r.absence_deduction=(num(r.basic_salary)+num(r.allowance))/dim*num(r.absent_days);
        r.deductions=num(r.absence_deduction)+num(r.manual_extra_deductions||0);
      }
      calcRow(r,dim);
    });
  }

  async function saveProfileRows(){
    const rows=state.rows||[];
    for(const r of rows){
      const payload={
        employee_ts_id:r.employee_ts_id||null,
        residency_name:r.residency_name||'',
        employee_name:r.employee_name||'',
        iqama_no:r.iqama_no||'',
        work_location:r.work_location||'FM',
        job_title:r.job_title||'',
        default_start_date:r.start_date||null,
        default_end_date:r.end_date||null,
        basic_salary:num(r.basic_salary),
        allowance:num(r.allowance),
        default_commission:num(r.commission),
        notes:r.notes||'',
        updated_at:new Date().toISOString()
      };
      if(!payload.employee_name && !payload.employee_ts_id) continue;
      if(r.profile_id){
        const {error}=await sb.from('salary_employee_profiles').update(payload).eq('id',r.profile_id);
        if(error) throw error;
      }else if(payload.employee_ts_id){
        const {error}=await sb.from('salary_employee_profiles').upsert(payload,{onConflict:'employee_ts_id'});
        if(error) throw error;
      }
    }
  }

  function numericSalaryEntityId(r, idx){
    // V10265: monthly_salaries.entity_id في قاعدة البيانات رقم BIGINT.
    // لذلك لا نرسل TS-10 أو worker_10 داخل entity_id، بل نحولها إلى رقم ثابت،
    // ونبقي كود TS داخل employee_ts_id فقط.
    if(r && r.profile_id!=null && String(r.profile_id)!=='') return Number(r.profile_id);
    const raw = String((r && (r.entity_id || r.employee_ts_id || r.employee_code)) || '');
    let m = raw.match(/TS[-_\s]?(\d+)/i);
    if(m) return Number(m[1]);
    m = raw.match(/(?:worker|sup|profile)[-_]?(\d+)/i);
    if(m) return Number(m[1]);
    if(r && r.supervisor_id!=null && String(r.supervisor_id)!=='') return Number(r.supervisor_id);
    if(r && r.worker_id!=null && String(r.worker_id)!=='') return Number(r.worker_id);
    // fallback hash آمن وثابت للأسماء، حتى لا يفشل الحفظ إذا لم يوجد ID رقمي
    const key = String((r && (r.employee_ts_id || r.employee_name || r.residency_name || r.entity_id)) || idx || '0');
    let h = 0;
    for(let i=0;i<key.length;i++) h = ((h * 31) + key.charCodeAt(i)) >>> 0;
    return Number(h || (idx+1));
  }

  async function saveSalary(approve=false){
    try{
      syncSalaryRowsFromDom();
      await saveProfileRows().catch(e=>{ console.warn('profiles save skipped/failed',e); });
      const rows=(state.rows||[]).map((r,idx)=>({salary_month:monthStart($('salaryMonth')?.value||today().slice(0,7)),entity_type:r.entity_type,entity_id:numericSalaryEntityId(r,idx),employee_ts_id:r.employee_ts_id||r.employee_code||'',residency_name:r.residency_name||'',iqama_no:r.iqama_no||'',employee_name:r.employee_name,work_location:r.work_location||'FM',project_name:r.project_name||'',supervisor_id:r.supervisor_id,supervisor_name:r.supervisor_name,job_title:r.job_title,start_date:r.start_date||null,end_date:r.end_date||null,work_days:num(r.work_days),absent_days:num(r.absent_days),payable_days:num(r.payable_days),basic_salary:num(r.basic_salary),allowance:num(r.allowance),gross_salary:num(r.gross_salary),salary_by_days:num(r.salary_by_days),commission:num(r.commission),deductions:num(r.deductions),rounding:num(r.rounding),advance_deduction:num(r.advance_deduction),net_salary:num(r.net_salary),payment_method:'',notes:r.notes||'',is_approved:approve,approved_at:approve?new Date().toISOString():null,updated_at:new Date().toISOString()}));
      if(!rows.length) return msg('لا توجد رواتب للحفظ','err');
      const {error}=await sb.from('monthly_salaries').upsert(rows,{onConflict:'salary_month,entity_type,entity_id'});
      if(error) throw error; msg(approve?'تم اعتماد الرواتب':'تم حفظ تعديلات الرواتب'); await loadSalary();
    }catch(e){ console.error(e); msg('فشل حفظ الرواتب: '+(e.message||e),'err'); }
  }
  function exportWorkLocation(r){
    // مثل ملف الإكسل بالضبط: مكان العمل يؤخذ من بيانات الملف/النظام كما هو.
    return r.work_location || 'FM';
  }
  function groupedSalaryRows(rows){
    return orderSalaryRowsForView(rows||[]);
  }
  function salaryTableHtml(print=false){
    const sourceRows=state.rows||[], rows=groupedSalaryRows(sourceRows), t=totals(sourceRows), month=$('salaryMonth')?.value||today().slice(0,7);
    const th=['رقم','أيدي الموظف','الشهر','اسم الموظف في الإقامة','اسم الموظف الحركي','رقم الإقامة','مكان العمل','ملاحظات','الوظيفة','بداية الخدمة','نهاية الخدمة','أيام العمل','أيام الغياب','الأيام المستحقة','قيمة الرواتب الأساسية','البدلات','الإجمالي','إجمالي الراتب على أيام الفترة','العمولات','الخصومات','جبر الكسور','خصم السلف','الصافي'];
    let n=0;
    const trs=rows.map((r)=>{
      n++;
      const supClass=r._isSupervisorExport?' class="supervisor-row"':'';
      return `<tr${supClass}><td>${n}</td><td>${esc(r.employee_ts_id||'')}</td><td>${month}</td><td>${esc(r.residency_name||'')}</td><td>${esc(r.employee_name)}</td><td>${esc(r.iqama_no||'')}</td><td>${esc(exportWorkLocation(r))}</td><td>${esc(r.notes)}</td><td>${esc(r.job_title)}</td><td>${esc(r.start_date||'')}</td><td>${esc(r.end_date||'')}</td><td>${money(r.work_days)}</td><td>${money(r.absent_days)}</td><td>${money(r.payable_days)}</td><td>${money(r.basic_salary)}</td><td>${money(r.allowance)}</td><td>${money(r.gross_salary)}</td><td>${money(r.salary_by_days)}</td><td>${money(r.commission)}</td><td>${money(r.deductions)}</td><td>${money(r.rounding)}</td><td>${money(r.advance_deduction)}</td><td>${money(r.net_salary)}</td></tr>`;
    }).join('');
    return `<html dir="rtl"><head><meta charset="utf-8"><style>
    body{font-family:Tahoma,Arial;margin:20px;color:#111}
    h1{text-align:center;color:#0b5d49;margin:0 0 8px}.meta{text-align:center;margin-bottom:14px;font-weight:bold}
    table{border-collapse:collapse;width:100%;font-size:11px;direction:rtl}
    th{background:#0b5d49;color:white;font-weight:bold}
    td,th{border:1px solid #b8d6cd;padding:6px;text-align:center;vertical-align:middle;mso-number-format:'\\@'}
    tbody tr:nth-child(even){background:#f7fbfa}
    .supervisor-row td{background:#e8f3ef;font-weight:bold;color:#063f32}
    tfoot td{font-weight:bold;background:#dfeee9}
    .sign{display:flex;justify-content:space-between;margin-top:35px;font-weight:bold}.sign div{width:32%;text-align:center;border-top:1px solid #111;padding-top:8px}
    </style></head><body><h1>كشف الرواتب</h1><div class="meta">الشهر: ${month} - شركة تصنيف لإدارة المرافق</div><table><thead><tr>${th.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${trs}</tbody><tfoot><tr><td colspan="14">الإجمالي</td><td>${money(t.basic_salary)}</td><td>${money(t.allowance)}</td><td>${money(t.gross_salary)}</td><td>${money(t.salary_by_days)}</td><td>${money(t.commission)}</td><td>${money(t.deductions)}</td><td>${money(t.rounding)}</td><td>${money(t.advance_deduction)}</td><td>${money(t.net_salary)}</td></tr></tfoot></table><div class="sign"><div>إدارة الحسابات</div><div>مدير التشغيل</div><div>المدير العام</div></div></body></html>`;
  }
  function printSalary(){ syncSalaryRowsFromDom(); const w=window.open('','_blank'); w.document.write(salaryTableHtml(true)); w.document.close(); setTimeout(()=>w.print(),500); }
  function exportSalaryPDF(){
    syncSalaryRowsFromDom();
    const w=window.open('','_blank');
    w.document.write(salaryTableHtml(true));
    w.document.close();
    setTimeout(()=>{ try{ w.document.title='كشف الرواتب PDF'; w.focus(); w.print(); msg('تم تجهيز ملف PDF، اختر حفظ كـ PDF من نافذة الطباعة'); }catch(e){ msg('تعذر تجهيز PDF: '+(e.message||e),'err'); } },500);
  }
  function loadExcelJsV10268(){
    return new Promise((resolve,reject)=>{
      if(window.ExcelJS) return resolve(window.ExcelJS);
      const old=document.querySelector('script[data-tasneef-exceljs-v10268="1"]');
      if(old){ old.addEventListener('load',()=>resolve(window.ExcelJS)); old.addEventListener('error',reject); return; }
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
      s.async=true; s.dataset.tasneefExceljsV10268='1';
      s.onload=()=>window.ExcelJS?resolve(window.ExcelJS):reject(new Error('تعذر تحميل مكتبة ExcelJS'));
      s.onerror=()=>reject(new Error('تعذر تحميل مكتبة ExcelJS'));
      document.head.appendChild(s);
    });
  }
  function excelSerialFormulaDate(row, col){ return `${col}${row}`; }

  function excelFormulaAdjustmentV10278(v){
    const n=Math.round(num(v)*100)/100;
    if(Math.abs(n)<0.005) return '';
    return (n>0?'+':'') + String(n);
  }
  function excelSerialFromIsoDateV10276(v){
    const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m) return null;
    const y=Number(m[1]), mo=Number(m[2]), d=Number(m[3]);
    // Excel serial date independent from browser timezone; fixes export shifting 2026-06-01 to 2026-05-31.
    return Math.floor((Date.UTC(y,mo-1,d)-Date.UTC(1899,11,30))/86400000);
  }
  function salaryCellVisibleTextV10279(cell){
    if(!cell) return '';
    const input=cell.querySelector('input,textarea,select');
    if(input) return String(input.value ?? '').trim();
    return String(cell.innerText || cell.textContent || '').replace(/\s+/g,' ').trim();
  }
  function salaryParseNumberV10279(v){
    const raw=String(v??'').replace(/,/g,'').replace(/[\u200f\u200e]/g,'').trim();
    if(raw==='' || raw==='-' || raw==='—') return null;
    const n=Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  function salaryDomExportMatrixV10279(){
    // V10279: المصدر الوحيد للتصدير هو نفس جدول السستم الظاهر أمام المستخدم.
    // لا نعيد حساب من state ولا من ملف Excel ولا من قاعدة البيانات، حتى لا تختلف الأرقام.
    syncSalaryRowsFromDom();
    const table=document.querySelector('#salaries table.salary-table');
    if(!table) throw new Error('لم يتم العثور على جدول الرواتب في الشاشة');
    const headers=[...table.querySelectorAll('thead th')].map(th=>String(th.innerText||th.textContent||'').trim());
    const rows=[];
    const groupRows=[];
    const bodyRows=[...table.querySelectorAll('tbody tr')];
    bodyRows.forEach((tr)=>{
      if(tr.classList.contains('salary-group-row')){
        const title=String(tr.innerText||tr.textContent||'').replace(/\s+/g,' ').trim();
        if(title){ rows.push({type:'group', values:[title]}); groupRows.push(rows.length); }
        return;
      }
      const vals=[...tr.children].map(td=>salaryCellVisibleTextV10279(td));
      if(vals.length){
        while(vals.length < headers.length) vals.push('');
        rows.push({type:'data', values:vals.slice(0,headers.length)});
      }
    });
    const foot=table.querySelector('tfoot tr');
    let footerVals=null;
    if(foot){
      const cells=[...foot.children].map(td=>salaryCellVisibleTextV10279(td));
      footerVals=new Array(headers.length).fill('');
      footerVals[0]='الإجمالي';
      // تذييل السستم يبدأ بعد colspan 13 ثم الأعمدة المالية من 14 إلى 22
      const numericStart=13;
      for(let i=1;i<cells.length;i++){
        const target=numericStart + (i-1);
        if(target<footerVals.length) footerVals[target]=cells[i];
      }
    }
    return {headers, rows, footerVals};
  }
  async function exportSalaryExcel(){
    try{
      const ExcelJS=await loadExcelJsV10268();
      const {headers, rows, footerVals}=salaryDomExportMatrixV10279();
      if(!headers.length || !rows.length) return msg('لا توجد بيانات ظاهرة للتصدير','err');
      const month=$('salaryMonth')?.value||today().slice(0,7);
      const wb=new ExcelJS.Workbook();
      wb.creator='Tasneef System';
      wb.created=new Date();
      wb.modified=new Date();
      wb.calcProperties.fullCalcOnLoad = false;
      const ws=wb.addWorksheet('كشف الرواتب', {views:[{rightToLeft:true, state:'frozen', ySplit:3}]});
      ws.views=[{rightToLeft:true, state:'frozen', ySplit:3}];

      ws.mergeCells(1,1,1,headers.length);
      ws.getCell(1,1).value='كشف الرواتب';
      ws.getCell(1,1).font={bold:true,size:22,color:{argb:'FF0B5D49'}};
      ws.getCell(1,1).alignment={horizontal:'center',vertical:'middle'};
      ws.mergeCells(2,1,2,headers.length);
      ws.getCell(2,1).value=`الشهر: ${month} - شركة تصنيف لإدارة المرافق`;
      ws.getCell(2,1).font={bold:true,size:13,color:{argb:'FF111111'}};
      ws.getCell(2,1).alignment={horizontal:'center',vertical:'middle'};

      const headerRow=ws.getRow(3);
      headerRow.values=headers;
      headerRow.height=24;
      headerRow.eachCell({includeEmpty:true},cell=>{
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B5D49'}};
        cell.font={bold:true,color:{argb:'FFFFFFFF'},size:11};
        cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
        cell.border={top:{style:'thin',color:{argb:'FFB8D6CD'}},left:{style:'thin',color:{argb:'FFB8D6CD'}},bottom:{style:'thin',color:{argb:'FFB8D6CD'}},right:{style:'thin',color:{argb:'FFB8D6CD'}}};
      });
      const widths=[7,12,12,26,20,16,18,28,12,14,14,11,11,13,16,12,12,19,12,12,12,12,12];
      widths.forEach((w,i)=>ws.getColumn(i+1).width=w);

      const textCols=new Set([2,3,4,5,6,7,8,9,10,11]);
      const numericCols=new Set([1,12,13,14,15,16,17,18,19,20,21,22,23]);
      const dataRowNumbers=[];
      let excelRow=4;
      rows.forEach((item,idx)=>{
        const row=ws.getRow(excelRow);
        if(item.type==='group'){
          ws.mergeCells(excelRow,1,excelRow,headers.length);
          row.getCell(1).value=item.values[0] || '';
          row.height=24;
          row.eachCell({includeEmpty:true},cell=>{
            cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFDFEEE9'}};
            cell.font={bold:true,color:{argb:'FF063F32'},size:12};
            cell.alignment={horizontal:'right',vertical:'middle'};
            cell.border={top:{style:'thin',color:{argb:'FFB8D6CD'}},left:{style:'thin',color:{argb:'FFB8D6CD'}},bottom:{style:'thin',color:{argb:'FFB8D6CD'}},right:{style:'thin',color:{argb:'FFB8D6CD'}}};
          });
          excelRow++;
          return;
        }
        const vals=item.values||[];
        headers.forEach((_,i)=>{
          const c=i+1;
          const raw=vals[i] ?? '';
          const cell=row.getCell(c);
          if(numericCols.has(c)){
            const n=salaryParseNumberV10279(raw);
            cell.value = n===null ? raw : n;
            cell.numFmt = c===1 ? '0' : '#,##0.00;[Red]-#,##0.00;0';
          }else{
            cell.value=String(raw ?? '');
            cell.numFmt='@';
          }
        });
        dataRowNumbers.push(excelRow);
        row.height=22;
        row.eachCell({includeEmpty:true},(cell,col)=>{
          cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
          cell.border={top:{style:'thin',color:{argb:'FFB8D6CD'}},left:{style:'thin',color:{argb:'FFB8D6CD'}},bottom:{style:'thin',color:{argb:'FFB8D6CD'}},right:{style:'thin',color:{argb:'FFB8D6CD'}}};
          if((idx%2)===1) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF7FBFA'}};
        });
        excelRow++;
      });

      const totalRow=excelRow;
      const tr=ws.getRow(totalRow);
      ws.mergeCells(totalRow,1,totalRow,13);
      tr.getCell(1).value='الإجمالي';
      tr.getCell(1).alignment={horizontal:'center',vertical:'middle'};
      const totalCols=[15,16,17,18,19,20,21,22,23];
      totalCols.forEach(c=>{
        const exact=footerVals ? salaryParseNumberV10279(footerVals[c-1]) : null;
        const letter=ws.getColumn(c).letter;
        // صيغة تعتمد على نفس القيم المصدرة من الشاشة. والنتيجة الحالية تطابق السستم عند فتح الملف.
        tr.getCell(c).value={formula:`SUM(${dataRowNumbers.map(r=>`${letter}${r}`).join(',')})`, result: exact===null ? 0 : exact};
        tr.getCell(c).numFmt='#,##0.00;[Red]-#,##0.00;0';
      });
      tr.height=24;
      tr.eachCell({includeEmpty:true},cell=>{
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFDFEEE9'}};
        cell.font={bold:true,color:{argb:'FF063F32'}};
        cell.alignment={horizontal:'center',vertical:'middle'};
        cell.border={top:{style:'thin',color:{argb:'FFB8D6CD'}},left:{style:'thin',color:{argb:'FFB8D6CD'}},bottom:{style:'thin',color:{argb:'FFB8D6CD'}},right:{style:'thin',color:{argb:'FFB8D6CD'}}};
      });

      const signRow=totalRow+4;
      ws.getCell(`B${signRow}`).value='إدارة الحسابات';
      ws.getCell(`J${signRow}`).value='مدير التشغيل';
      ws.getCell(`R${signRow}`).value='المدير العام';
      ['B','J','R'].forEach(c=>{ ws.getCell(`${c}${signRow}`).font={bold:true}; ws.getCell(`${c}${signRow}`).alignment={horizontal:'center'}; ws.getCell(`${c}${signRow}`).border={top:{style:'thin'}}; });
      ws.getCell(`A${signRow+2}`).value='ملاحظة V10280: تم بناء تصدير Excel من الصفر من نفس بيانات الجدول الظاهرة في السستم؛ لا توجد إعادة حساب من ملف Excel أو قاعدة البيانات قبل التصدير.';
      ws.getCell(`A${signRow+2}`).font={italic:true,color:{argb:'FF666666'}};
      ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
      const buffer=await wb.xlsx.writeBuffer();
      const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download=`كشف_الرواتب_${month}.xlsx`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),2000);
      msg('تم تصدير Excel مطابق لبيانات السستم الظاهرة');
    }catch(e){
      console.error(e);
      msg('تعذر تصدير Excel: '+(e.message||e),'err');
    }
  }
  function inject(){
    if($('salaries')) return;
    const side=document.querySelector('.side'); const ref=[...document.querySelectorAll('.side .nav')].find(b=>String(b.textContent).includes('الأوقات الشهرية'));
    const btn=document.createElement('button'); btn.className='nav'; btn.textContent='الرواتب'; btn.onclick=function(){ showPage('salaries',this); setTimeout(loadSalary,50); };
    if(side) side.insertBefore(btn, ref?ref.nextSibling:side.querySelector('.nav.danger'));
    const main=document.querySelector('main.content'); const sec=document.createElement('section'); sec.id='salaries'; sec.className='page hidden'; sec.innerHTML=`
      <style>.salary-table-wrap{max-height:640px;overflow:auto}.salary-table{min-width:2300px}.salary-group-row td{background:#dfeee9;color:#064537;font-weight:900;text-align:right;font-size:13px}.salary-table th{position:sticky;top:0;z-index:2}.sal-input{width:110px;border:1px solid var(--line);border-radius:8px;padding:6px;text-align:center}.salary-actions{display:flex;gap:8px;flex-wrap:wrap}.salary-note{background:#eef8f4;border:1px solid var(--line);border-radius:14px;padding:10px;color:var(--brand);font-weight:800}</style>
      <div class="card"><div class="table-head"><h2>الرواتب</h2><span class="badge green">${VERSION}</span></div><div class="salary-note">ترتيب كشف الرواتب مطابق لملف Excel المعتمد: المشرف وتحته عماله، ثم الفنيين، ثم الحراس. أي موظف جديد من الحضور يظهر في قسم يحتاج ربط مشرف.</div><div id="salaryMsg" class="msg hidden"></div>
      <div class="filters"><div><label>الشهر</label><input type="month" id="salaryMonth" value="${today().slice(0,7)}" onchange="tasneefSalariesV10267.load()"></div><div><label>نوع الكشف</label><select id="salaryType" onchange="tasneefSalariesV10267.buildRows()"><option value="all">الكل</option><option value="supervisors">رواتب المشرفين</option><option value="workers">رواتب العمال</option><option value="technicians">رواتب الفنيين</option><option value="guards">رواتب الحراس</option></select></div><div><label>المشرف</label><select id="salarySupervisor" onchange="tasneefSalariesV10267.buildRows()"><option value="">كل المشرفين</option></select></div><div><label>المشروع</label><select id="salaryProject" onchange="tasneefSalariesV10267.buildRows()"><option value="">كل المشاريع</option></select></div><div><label>بحث</label><input id="salarySearch" oninput="tasneefSalariesV10267.buildRows()" placeholder="اسم/إقامة/TS"></div></div>
      <div class="salary-actions"><button onclick="tasneefSalariesV10267.load()">تحديث الرواتب</button><button class="light" onclick="tasneefSalariesV10267.save(false)">حفظ التعديلات</button><button class="light" onclick="tasneefSalariesV10267.save(true)">اعتماد الرواتب</button><button class="light" onclick="tasneefSalariesV10267.print()">طباعة</button><button class="light" onclick="tasneefSalariesV10267.exportPDF()">تصدير PDF</button><button class="light" onclick="tasneefSalariesV10267.exportExcel()">تصدير Excel</button></div><div id="salaryKpis" class="kpis small"></div>
      <div class="table-wrap salary-table-wrap"><table class="salary-table"><thead><tr><th>رقم</th><th>أيدي الموظف</th><th>الشهر</th><th>اسم الموظف في الإقامة</th><th>اسم الموظف الحركي</th><th>رقم الإقامة</th><th>مكان العمل</th><th>ملاحظات</th><th>الوظيفة</th><th>بداية الخدمة</th><th>نهاية الخدمة</th><th>أيام العمل</th><th>أيام الغياب</th><th>الأيام المستحقة</th><th>قيمة الرواتب الأساسية</th><th>البدلات</th><th>الإجمالي</th><th>إجمالي الراتب على أيام الفترة</th><th>العمولات</th><th>الخصومات</th><th>جبر الكسور</th><th>خصم السلف</th><th>الصافي</th></tr></thead><tbody id="salaryBody"></tbody><tfoot id="salaryFoot"></tfoot></table></div></div>`;
    if(main) main.appendChild(sec);
  }
  // V10266: حماية إضافية لو المتصفح لم ينفذ onchange داخل حقل التاريخ.
  document.addEventListener('input', function(e){
    const el=e.target;
    if(!el || !el.classList || !el.classList.contains('salary-date-input')) return;
    update(el.dataset.type, el.dataset.id, el.dataset.key, el.value);
  });
  document.addEventListener('change', function(e){
    const el=e.target;
    if(!el || !el.classList || !el.classList.contains('salary-date-input')) return;
    update(el.dataset.type, el.dataset.id, el.dataset.key, el.value);
  });
  window.tasneefSalariesV10267={inject,load:loadSalary,buildRows,update,save:saveSalary,print:printSalary,exportPDF:exportSalaryPDF,exportExcel:exportSalaryExcel,sync:syncSalaryRowsFromDom};
  window.tasneefSalariesV10280=window.tasneefSalariesV10267;
  window.tasneefSalariesV10279=window.tasneefSalariesV10267;
  window.tasneefSalariesV10278=window.tasneefSalariesV10267;
  window.tasneefSalariesV10272=window.tasneefSalariesV10267;
  window.tasneefSalariesV10266=window.tasneefSalariesV10267;
  window.tasneefSalariesV10261=window.tasneefSalariesV10267;
  window.tasneefSalariesV10265=window.tasneefSalariesV10267;
  document.addEventListener('DOMContentLoaded',()=>setTimeout(inject,500));
  window.addEventListener('load',()=>setTimeout(inject,700));
})();

// V10274 alias
window.tasneefSalariesV10274 = window.tasneefSalariesV10267;
