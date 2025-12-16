# فزاعين - لوحة تحكم المدير

لوحة تحكم شاملة للمدير لإدارة المشروع بالكامل

## المميزات

- ✅ Dashboard رئيسي مع إحصائيات شاملة
- ✅ إدارة المزودين (قبول/رفض/تعليق)
- ✅ إدارة الطلبات ومتابعتها
- ✅ عرض التقارير والإحصائيات
- ✅ البحث والفلترة المتقدمة
- ✅ Backend على Firebase

## التقنيات المستخدمة

- React 18
- Vite
- React Router
- Tailwind CSS
- Firebase (Firestore)
- Lucide Icons
- date-fns

## التثبيت

```bash
npm install
# أو
yarn install
```

## التشغيل

```bash
npm run dev
# أو
yarn dev
```

## البناء للإنتاج

```bash
npm run build
# أو
yarn build
```

## البنية

```
src/
  ├── pages/          # الصفحات الرئيسية
  │   ├── Dashboard.jsx
  │   ├── Providers.jsx
  │   ├── Orders.jsx
  │   └── Login.jsx
  ├── components/      # الكمبوننتات
  │   └── Layout.jsx
  ├── services/        # خدمات Firebase
  │   ├── firebase.js
  │   └── adminService.js
  └── App.jsx
```

## بيانات الدخول الافتراضية

- البريد: admin@fazaaa.com
- كلمة المرور: admin123

## النشر على Vercel

### الطريقة الأولى: عبر Vercel CLI

1. تثبيت Vercel CLI:
```bash
npm i -g vercel
```

2. تسجيل الدخول:
```bash
vercel login
```

3. النشر:
```bash
cd admin-dashboard
vercel
```

4. لمتابعة التحديثات:
```bash
vercel --prod
```

### الطريقة الثانية: عبر GitHub

1. ارفع المشروع على GitHub
2. اذهب إلى [vercel.com](https://vercel.com)
3. سجل الدخول بحساب GitHub
4. اضغط "New Project"
5. اختر المشروع من GitHub
6. Vercel سيكتشف تلقائياً أنه مشروع Vite
7. اضغط "Deploy"

### إعدادات Vercel

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

ملف `vercel.json` موجود ومعد مسبقاً.

## ملاحظات

- تأكد من إعداد Firebase في `src/services/firebase.js`
- في الإنتاج، استخدم Firebase Authentication للتحقق من هوية المدير
- جميع المسارات (routes) تعمل بشكل صحيح بفضل إعداد rewrites في `vercel.json`

