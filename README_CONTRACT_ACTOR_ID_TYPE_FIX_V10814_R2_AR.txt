إصلاح V10814-R2 — توافق معرف المستخدم في العقود والمشاريع

سبب الخطأ:
عمود projects.stopped_by موجود فعليًا بنوع bigint، بينما RPC كان يرسل p_user_id من نوع text مباشرة.

الإصلاح:
- قراءة النوع الفعلي لكل عمود من كتالوج PostgreSQL.
- تحويل معرف المستخدم صراحة إلى bigint أو uuid أو text حسب العمود.
- عند عدم صلاحية المعرف للنوع الرقمي يتم حفظ NULL بدل إيقاف العملية، مع بقاء اسم المستخدم في سجل التعديلات.
- شمل الإصلاح: projects.stopped_by وcontracts.closed_by وcontracts.renewed_by وcontract_expiry_notifications.resolved_by.
- إضافة رسالة عربية بدل إظهار الخطأ التقني 42804 للمستخدم.

التشغيل:
يمكن تشغيل ملف supabase_contract_actor_id_type_hotfix_v10814_r2.sql فقط إذا كان ملف V10814 الأساسي قد نجح سابقًا.
أو تشغيل ملف supabase_contract_renewal_nonrenew_v10814.sql الكامل المصحح على قاعدة جديدة.
