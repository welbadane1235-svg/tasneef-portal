from pathlib import Path
import subprocess, sys
root=Path(__file__).parent
mod=(root/'tasneef_unified_employee_excel_v10810.js').read_text(encoding='utf-8')
admin=(root/'admin.html').read_text(encoding='utf-8')
checks=[]
def check(name, cond): checks.append((name,bool(cond)))

check('Build V10810 موجود', 'V10810-UNIFIED-PAYROLL-STYLE-ATTENDANCE' in admin)
check('ملف V10810 محمل', 'tasneef_unified_employee_excel_v10810.js?v=10810-payroll-style-attendance' in admin)
check('ملف V10809 غير محمل', 'tasneef_unified_employee_excel_v10809.js?v=' not in admin)
check('app.js محدث الكاش', 'app.js?v=10810-unified-payroll-style-attendance' in admin)
check('عنوان كشف الرواتب مطابق', "['كشف الرواتب']" in mod)
check('عنوان الشركة والشهر موجود', 'شركة تصنيف لإدارة المرافق' in mod and 'الشهر: ${month}' in mod)
check('رأس أخضر مطابق للتصميم', "rgb:'0B624E'" in mod)
check('أول عمود رقم', "const headers=['رقم','أيدي الموظف','الشهر'" in mod)
check('اسم الموظف في الإقامة موجود', "'اسم الموظف في الإقامة'" in mod)
check('اسم الموظف الحركي موجود', "'اسم الموظف الحركي'" in mod)
check('رقم الإقامة موجود', "'رقم الإقامة'" in mod)
check('مكان العمل موجود', "'مكان العمل'" in mod)
check('اسم المشرف موجود', "'اسم المشرف'" in mod)
check('الوظيفة موجودة', "'الوظيفة'" in mod)
check('بداية الدوام موجودة', "'بداية الدوام'" in mod)
check('نهاية الدوام موجودة', "'نهاية الدوام'" in mod)
check('أيام الحضور والغياب موجودة', "'أيام الحضور','أيام الغياب'" in mod)
check('الخانات المالية مطابقة', all(x in mod for x in ["'قيمة الرواتب الأساسية'","'البدلات'","'الإجمالي'","'إجمالي الراتب على أيام الفترة'","'العمولات'","'الخصومات'","'جبر الكسور'","'خصم السلف'","'الصافي'","'ملاحظات'"]))
check('بداية الدوام من أول حضور فعلي', "const worked=days.filter(d=>['present','late','early_leave'].includes(d.status))" in mod and 'firstWorked?dateTimeLabel(firstWorked.date,firstWorked.firstIn)' in mod)
check('نهاية الدوام من آخر حضور فعلي', 'lastWorked?dateTimeLabel(lastWorked.date,lastWorked.lastOut)' in mod)
check('لا تستخدم تاريخ الخدمة كبديل لبداية الدوام', "x.firstIn||'لا يوجد تسجيل'" in mod and "x.workStart" not in mod[mod.index('const dataRows='):mod.index('if(dataRows.length)')])
check('المصدر هو جدول attendance', "safeFetch('attendance'" in mod)
check('مصدر الرواتب الموحد مستخدم عند توفره', "rpc('get_unified_payroll_from_server'" in mod)
check('فشل RPC له fallback آمن', "payroll RPC fallback" in mod)
check('الزيارة اليومية تعرض اسم المشرف', 'i.full?i.name:sup.name' in mod)
check('الدوام الكامل يعرض اسم المشروع', "return t.includes('دوام')" in mod and 'i.full?i.name:sup.name' in mod)
check('المشرف يظهر أولاً', "a.roleGroup==='supervisor'?0:1" in mod)
check('ثم الترتيب حسب المشروع', "a.primaryProject.localeCompare(b.primaryProject,'ar')" in mod)
check('صف المشرف مميز', "supervisor?'DCEFE8'" in mod)
check('صف إجمالي موجود', "const totals=['الإجمالي'" in mod)
check('كشف يومي موجود', "'كشف يومي'" in mod)
check('الدليل يوضح مصدر الحضور فقط', 'المصدر: جدول الحضور والغياب فقط' in mod)
check('منع الضغط المكرر', "if(btn?.disabled)return" in mod)
check('زر التنزيل محدث', "btn.textContent='تنزيل كشف الموظفين Excel'" in mod)
check('ربط V10810 هو المسيطر', 'btn.dataset.v10810' in mod and 'window.exportSupervisorEmployeesExcelV10810=exportExcel' in mod)

syntax_ok=True
for f in ['tasneef_unified_employee_excel_v10810.js']:
    r=subprocess.run(['node','--check',str(root/f)],capture_output=True,text=True)
    if r.returncode!=0:
        syntax_ok=False
        print(r.stderr)
check('فحص Syntax لملف JavaScript', syntax_ok)

passed=sum(v for _,v in checks)
for name,ok in checks: print(('PASS' if ok else 'FAIL')+' | '+name)
print(f'RESULT {passed}/{len(checks)}')
sys.exit(0 if passed==len(checks) else 1)
