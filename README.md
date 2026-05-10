# Tasneef HTML App V15

تحديث V15 يضيف نسخة الفني:

- `technician.html`
- الفني يرى التكتات المفتوحة
- استلام التكت
- إغلاق التكت مع كتابة كيف تم الإغلاق
- يظهر من أغلق التكت ومدة فتحه

## حسابات الفنيين الافتراضية

- mazin_khatib / 123456
- jamal / 123456
- sharif / 123456
- asaad / 123456
- hussein / 123456

## مهم
شغل ملف `schema_update_v15_technician.sql` في Supabase قبل تجربة الفنيين.

## تحديث V92 - تقارير العملاء المستقلة
تمت إضافة نظام تقارير العملاء:
- صفحة داخل لوحة الإدارة باسم: تقارير العملاء.
- إنشاء تقرير، رفع صور، حفظ مسودة، اعتماد ونشر.
- صفحة مستقلة للعميل: client-report.html لا تعرض إلا التقرير المعتمد والمنشور.
- رابط خاص لكل تقرير عبر public_token.
- تجهيز رسالة واتساب تلقائيًا بعد الاعتماد.

### مهم قبل الاستخدام
شغّل ملف قاعدة البيانات التالي داخل Supabase SQL Editor:
`schema_update_v92_client_reports.sql`

### واتساب تلقائي بالكامل
النسخة تفتح رسالة واتساب جاهزة إذا لم يتم ربط مزود WhatsApp API.
لإرسال الرسالة تلقائيًا بالكامل بدون فتح واتساب، أضف رابط Webhook في المتصفح:
```js
localStorage.setItem('tasneef_whatsapp_webhook_url','https://YOUR-WHATSAPP-WEBHOOK')
```
ويجب أن يستقبل الـ Webhook البيانات:
`phone`, `message`, `report_id`, `report_number`.

### رابط التقارير
إذا رفعت الملفات على دومين مختلف، اضبط رابط صفحة التقرير:
```js
localStorage.setItem('tasneef_report_base_url','https://your-domain.com/client-report.html')
```
