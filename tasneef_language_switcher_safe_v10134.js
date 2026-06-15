
(function(){
  'use strict';
  if(window.__tasneefLanguageSwitcherSafeV10134) return;
  window.__tasneefLanguageSwitcherSafeV10134 = true;

  const STORE_KEY = 'tasneef_ui_lang_v10134';
  const LEGACY_KEY = 'tasneef_ui_lang_v10133';
  const LANGS = { ar:{label:'العربية',dir:'rtl'}, en:{label:'English',dir:'ltr'}, bn:{label:'বাংলা',dir:'ltr'}, hi:{label:'हिन्दी',dir:'ltr'} };
  const MAP = {
    'لوحة التحكم':['Dashboard','ড্যাশবোর্ড','डैशबोर्ड'],
    'التسجيلات اليومية':['Daily records','দৈনিক রেকর্ড','दैनिक रिकॉर्ड'],
    'إدارة المستخدمين':['User management','ব্যবহারকারী ব্যবস্থাপনা','उपयोगकर्ता प्रबंधन'],
    'المشاريع':['Projects','প্রকল্প','प्रोजेक्ट'],
    'العقود والخدمات':['Contracts & services','চুক্তি ও সেবা','अनुबंध और सेवाएं'],
    'العمال':['Workers','কর্মী','कामगार'],
    'الحضور والغياب':['Attendance','হাজিরা','उपस्थिति'],
    'الأوقات الشهرية':['Monthly times','মাসিক সময়','मासिक समय'],
    'التكتات':['Tickets','টিকিট','टिकट'],
    'الأوردرات':['Orders','অর্ডার','ऑर्डर'],
    'تقارير العملاء':['Client reports','ক্লায়েন্ট রিপোর্ট','ग्राहक रिपोर्ट'],
    'تقييمات العملاء':['Client ratings','ক্লায়েন্ট রেটিং','ग्राहक रेटिंग'],
    'التنبيهات':['Alerts','সতর্কতা','अलर्ट'],
    'مساعد تصنيف':['Tasneef assistant','তাসনিফ সহায়ক','तस्नीफ सहायक'],
    'المالية والمخزون':['Finance & inventory','ফাইন্যান্স ও স্টক','वित्त और स्टॉक'],
    'الجرد':['Inventory count','স্টক গণনা','इन्वेंटरी गिनती'],
    'التصدير والاستيراد':['Export & import','রপ্তানি ও আমদানি','निर्यात और आयात'],
    'مهام إدارية':['Administrative tasks','প্রশাসনিক কাজ','प्रशासनिक कार्य'],
    'تسجيل خروج':['Logout','লগ আউট','लॉगआउट'],
    'تحديث':['Refresh','রিফ্রেশ','रिफ्रेश'],
    'إضافة مهمة':['Add task','কাজ যোগ করুন','कार्य जोड़ें'],
    'إضافة أوردر':['Add order','অর্ডার যোগ করুন','ऑर्डर जोड़ें'],
    'إضافة منتج':['Add product','পণ্য যোগ করুন','उत्पाद जोड़ें'],
    'حفظ':['Save','সংরক্ষণ','सेव करें'],
    'حفظ المهمة':['Save task','কাজ সংরক্ষণ','कार्य सेव करें'],
    'إلغاء':['Cancel','বাতিল','रद्द करें'],
    'بحث':['Search','অনুসন্ধান','खोज'],
    'بحث في المهام':['Search tasks','কাজ খুঁজুন','कार्य खोजें'],
    'طباعة المعروض':['Print displayed','দেখানোটি প্রিন্ট','दिखाया हुआ प्रिंट करें'],
    'مهامي':['My tasks','আমার কাজ','मेरे कार्य'],
    'مهام مفتوحة':['Open tasks','খোলা কাজ','खुले कार्य'],
    'مهام مغلقة':['Closed tasks','বন্ধ কাজ','बंद कार्य'],
    'تم الاعتماد':['Approved','অনুমোদিত','स्वीकृत'],
    'المهام المتأخرة':['Late tasks','বিলম্বিত কাজ','देरी वाले कार्य'],
    'مهمة مفتوحة':['Open task','খোলা কাজ','खुला कार्य'],
    'مهمة فورية':['Immediate task','তাৎক্ষণিক কাজ','तुरंत कार्य'],
    'مجدولة':['Scheduled','নির্ধারিত','निर्धारित'],
    'فورية ومجدولة':['Immediate & scheduled','তাৎক্ষণিক ও নির্ধারিত','तुरंत और निर्धारित'],
    'الأولوية':['Priority','অগ্রাধিকার','प्राथमिकता'],
    'كل الأولويات':['All priorities','সব অগ্রাধিকার','सभी प्राथमिकताएं'],
    'كل أنواع المهام':['All task types','সব কাজের ধরন','सभी कार्य प्रकार'],
    'عاجل':['Urgent','জরুরি','तत्काल'],
    'مهم':['Important','গুরুত্বপূর্ণ','महत्वपूर्ण'],
    'عادي':['Normal','সাধারণ','सामान्य'],
    'منخفض':['Low','কম','कम'],
    'عنوان المهمة':['Task title','কাজের শিরোনাম','कार्य शीर्षक'],
    'تفاصيل المهمة':['Task details','কাজের বিবরণ','कार्य विवरण'],
    'نوع المهمة':['Task type','কাজের ধরন','कार्य प्रकार'],
    'تاريخ ووقت الجدولة':['Schedule date & time','সময়সূচির তারিখ ও সময়','शेड्यूल दिनांक और समय'],
    'المستلم من إدارة المستخدمين':['Recipient from users','ব্যবহারকারী থেকে গ্রহণকারী','उपयोगकर्ता से प्राप्तकर्ता'],
    'المستلم':['Recipient','গ্রহণকারী','प्राप्तकर्ता'],
    'من':['From','থেকে','से'],
    'إلى':['To','প্রতি','तक'],
    'الحالة':['Status','অবস্থা','स्थिति'],
    'المهمة':['Task','কাজ','कार्य'],
    'الجدولة':['Schedule','সময়সূচি','शेड्यूल'],
    'أنشئت':['Created','তৈরি হয়েছে','बनाया गया'],
    'أغلقت':['Closed','বন্ধ হয়েছে','बंद किया गया'],
    'اعتمدت':['Approved','অনুমোদিত','स्वीकृत'],
    'إجراء':['Action','অ্যাক्शन','कार्रवाई'],
    'فتح قسم مهام إدارية':['Open tasks section','কাজের বিভাগ খুলুন','कार्य अनुभाग खोलें'],
    'فتح المهمة':['Open task','কাজ খুলুন','कार्य खोलें'],
    'إغلاق التذكير':['Close reminder','রিমাইন্ডার বন্ধ','रिमाइंडर बंद करें'],
    'دخول / خروج':['Check in / out','প্রবেশ / প্রস্থান','प्रवेश / निकास'],
    'تسجيل الحضور':['Register attendance','হাজিরা নথিভুক্ত','उपस्थिति दर्ज करें'],
    'الملخص اليومي':['Daily summary','দৈনিক সারাংশ','दैनिक सारांश'],
    'تقرير يومي':['Daily report','দৈনিক রিপোর্ট','दैनिक रिपोर्ट'],
    'لوحة المشرف':['Supervisor panel','সুপারভাইজার প্যানেল','सुपरवाइजर पैनल'],
    'لوحة الفني':['Technician panel','টেকনিশিয়ান প্যানেল','तकनीशियन पैनल'],
    'الرئيسية':['Home','হোম','होम'],
    'إنشاء تكت':['Create ticket','টিকিট তৈরি','टिकट बनाएं'],
    'حضور وغياب':['Attendance','হাজিরা','उपस्थिति'],
    'حضور وغياب الفنيين':['Technician attendance','টেকনিশিয়ান হাজিরা','तकनीशियन उपस्थिति'],
    'تاريخ التحضير':['Attendance date','হাজিরার তারিখ','उपस्थिति दिनांक'],
    'الشهر':['Month','মাস','माह'],
    'ملاحظات اليوم':['Today notes','আজকের নোট','आज की टिप्पणी'],
    'تسجيل حضور':['Check in','হাজির','उपस्थित'],
    'تسجيل انصراف':['Check out','প্রস্থান','निकास'],
    'تسجيل غياب':['Mark absent','অনুপস্থিত','अनुपस्थित'],
    'طباعة PDF':['Print PDF','PDF প্রিন্ট','PDF प्रिंट'],
    'تقرير حضور الفني':['Technician attendance report','টেকনিশিয়ান হাজিরা রিপোর্ট','तकनीशियन उपस्थिति रिपोर्ट'],
    'التاريخ':['Date','তারিখ','दिनांक'],
    'اليوم':['Day','দিন','दिन'],
    'وقت الحضور':['Check-in time','হাজিরার সময়','उपस्थिति समय'],
    'وقت الانصراف':['Check-out time','প্রস্থানের সময়','निकास समय'],
    'ملاحظات':['Notes','নোট','टिप्पणी'],
    'حاضر':['Present','উপস্থিত','उपस्थित'],
    'غائب':['Absent','অনুপস্থিত','अनुपस्थित'],
    'المشروع':['Project','প্রকল্প','प्रोजेक्ट'],
    'اختر المشروع':['Choose project','প্রকল্প নির্বাচন করুন','प्रोजेक्ट चुनें'],
    'اختر':['Choose','নির্বাচন করুন','चुनें'],
    'كل المشاريع':['All projects','সব প্রকল্প','सभी प्रोजेक्ट'],
    'كل الحالات':['All statuses','সব অবস্থা','सभी स्थितियां'],
    'مفتوح':['Open','খোলা','खुला'],
    'تحت المعالجة':['Processing','প্রক্রিয়াধীন','प्रक्रिया में'],
    'مغلق':['Closed','বন্ধ','बंद'],
    'تم التنفيذ':['Completed','সম্পন্ন','पूर्ण'],
    'لم ينفذ':['Not done','হয়নি','नहीं हुआ'],
    'ملغي':['Cancelled','বাতিল','रद्द'],
    'رقم الطلب':['Order number','অর্ডার নম্বর','ऑर्डर नंबर'],
    'رقم الطلب بالجروب':['Group order number','গ্রুপ অর্ডার নম্বর','ग्रुप ऑर्डर नंबर'],
    'تاريخ الطلب':['Order date','অর্ডার তারিখ','ऑर्डर दिनांक'],
    'وقت الطلب':['Order time','অর্ডার সময়','ऑर्डर समय'],
    'مرسل الطلب':['Requester','অনুরোধকারী','अनुरोधकर्ता'],
    'نوع العقار':['Property type','সম্পত্তির ধরন','संपत्ति प्रकार'],
    'رقم الشقة':['Unit number','ফ্ল্যাট নম্বর','फ्लैट नंबर'],
    'اسم العميل':['Client name','গ্রাহকের নাম','ग्राहक नाम'],
    'رقم العميل':['Client number','গ্রাহক নম্বর','ग्राहक नंबर'],
    'المنفذ':['Executor','বাস্তবায়নকারী','निष्पादक'],
    'التفاصيل':['Details','বিবরণ','विवरण'],
    'تاريخ التنفيذ':['Execution date','বাস্তবায়নের তারিখ','निष्पादन दिनांक'],
    'كيفية التنفيذ':['Execution method','বাস্তবায়ন পদ্ধতি','निष्पादन विधि'],
    'حالة التنفيذ':['Execution status','বাস্তবায়নের অবস্থা','निष्पादन स्थिति'],
    'تخص':['Concern','সম্পর্কিত','संबंधित'],
    'حفظ الأوردر':['Save order','অর্ডার সংরক্ষণ','ऑर्डर सेव करें'],
    'أوردر جديد':['New order','নতুন অর্ডার','नया ऑर्डर'],
    'رفع / تعديل أوردر':['Add / edit order','অর্ডার যোগ / সম্পাদনা','ऑर्डर जोड़ें / संशोधित करें'],
    'تكتات مفتوحة':['Open tickets','খোলা টিকিট','खुले टिकट'],
    'تكتاتي قيد المعالجة':['My tickets in process','আমার প্রক্রিয়াধীন টিকিট','मेरे टिकट प्रक्रिया में'],
    'أغلقتها أنا':['Closed by me','আমি বন্ধ করেছি','मेरे द्वारा बंद'],
    'مختصر العمل':['Work summary','কাজের সারাংশ','कार्य सारांश'],
    'فتح التكتات':['Open tickets','টিকিট খুলুন','टिकट खोलें']
  };
  const idx = {en:0,bn:1,hi:2};
  function S(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function currentLang(){return localStorage.getItem(STORE_KEY) || localStorage.getItem(LEGACY_KEY) || 'ar';}
  function translate(text, lang){ const row = MAP[S(text)]; return (lang==='ar'||!row) ? text : (row[idx[lang]] || text); }
  function original(el){
    if(!el.dataset.tasneefI18nOriginal) el.dataset.tasneefI18nOriginal = el.textContent;
    return el.dataset.tasneefI18nOriginal;
  }
  function isSafe(el){
    if(!el || el.closest('#tasneefLangBoxV10134,[data-no-translate],.no-translate')) return false;
    if(el.closest('select,option,input,textarea,table,tbody,#ordersBody,#supOrdersBodyV10061,#techAttendanceBody,#logsBody,#supervisorAttendanceList,#supTicketsBody,#techOpenTicketsBody,#techMyTicketsBody,#techDoneTicketsBody')) return false;
    return true;
  }
  function apply(lang){
    try{
      document.documentElement.lang = lang;
      document.documentElement.dir = LANGS[lang]?.dir || 'rtl';
      if(document.body) document.body.dir = LANGS[lang]?.dir || 'rtl';
      const selector = 'button,label,h1,h2,h3,p,small,span,b,a,th';
      document.querySelectorAll(selector).forEach(el=>{
        if(!isSafe(el)) return;
        const children = Array.from(el.children).filter(c => c.tagName !== 'BR');
        if(children.length) return;
        const base = original(el);
        const t = translate(base, lang);
        if(S(el.textContent)!==S(t)) el.textContent = t;
      });
      const sel = document.getElementById('tasneefLangSelectV10134');
      if(sel) sel.value = lang;
    }catch(e){ console.warn('Tasneef safe language apply failed', e); }
  }
  function setLang(l){
    localStorage.setItem(STORE_KEY,l);
    try{ localStorage.setItem(LEGACY_KEY,l); }catch(_){ }
    apply(l);
  }
  function install(){
    if(document.getElementById('tasneefLangBoxV10134')){ apply(currentLang()); return; }
    const css = document.createElement('style');
    css.textContent = '#tasneefLangBoxV10134{position:fixed;top:12px;left:12px;z-index:999999;background:#fff;border:1px solid #dce6e2;border-radius:14px;box-shadow:0 10px 28px rgba(0,0,0,.12);padding:8px;display:flex;gap:6px;align-items:center;font-family:Tahoma,Arial,sans-serif}#tasneefLangBoxV10134 label{margin:0;color:#0A4033;font-size:12px;font-weight:800;white-space:nowrap}#tasneefLangBoxV10134 select{width:auto!important;min-width:112px!important;border-radius:10px!important;padding:7px 9px!important;font-size:12px!important;background:#fff!important}@media(max-width:760px){#tasneefLangBoxV10134{top:auto;bottom:12px;left:10px;right:auto;transform:scale(.92);transform-origin:left bottom}}';
    document.head.appendChild(css);
    const box = document.createElement('div');
    box.id='tasneefLangBoxV10134';
    box.setAttribute('data-no-translate','1');
    box.innerHTML = '<label data-no-translate>Language</label><select id="tasneefLangSelectV10134" data-no-translate><option value="ar">العربية</option><option value="en">English</option><option value="bn">বাংলা</option><option value="hi">हिन्दी</option></select>';
    document.body.appendChild(box);
    box.querySelector('select').addEventListener('change', e => setLang(e.target.value));
    // تأخير بسيط حتى لا يتداخل مع تسجيل الدخول أو تحميل المشاريع.
    setTimeout(()=>apply(currentLang()), 900);
    // لا يوجد MutationObserver حتى لا يبطئ الصفحة أو يغير بيانات الجداول والقوائم.
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, {once:true});
  else install();
  window.tasneefSetLanguageV10134 = setLang;
})();
