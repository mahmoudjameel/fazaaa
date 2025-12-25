/**
 * سكريبت لإصلاح حالات المزودين في Firestore
 * يقوم بمزامنة approvalStatus مع status
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Firebase config - استبدلها بإعدادات مشروعك
const firebaseConfig = {
  // انسخ الإعدادات من src/services/firebase.js
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixProviderStatuses() {
  try {
    console.log('🚀 بدء إصلاح حالات المزودين...\n');
    
    // جلب جميع المزودين
    const providersRef = collection(db, 'providers');
    const snapshot = await getDocs(providersRef);
    
    console.log(`📊 عدد المزودين: ${snapshot.docs.length}\n`);
    
    let fixedCount = 0;
    let errorCount = 0;
    const fixes = [];
    
    // فحص كل مزود
    for (const providerDoc of snapshot.docs) {
      const data = providerDoc.data();
      const providerId = providerDoc.id;
      
      const approvalStatus = data.approvalStatus;
      const status = data.status;
      
      // التحقق من وجود تعارض
      if (approvalStatus && status !== approvalStatus) {
        fixes.push({
          id: providerId,
          phone: data.phone || 'N/A',
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'N/A',
          before: {
            approvalStatus: approvalStatus,
            status: status
          },
          after: {
            approvalStatus: approvalStatus,
            status: approvalStatus
          }
        });
        
        try {
          // تحديث status ليطابق approvalStatus
          await updateDoc(doc(db, 'providers', providerId), {
            status: approvalStatus,
            updatedAt: new Date().toISOString(),
          });
          
          fixedCount++;
          console.log(`✅ تم إصلاح: ${providerId}`);
          console.log(`   الاسم: ${fixes[fixes.length - 1].name}`);
          console.log(`   الهاتف: ${fixes[fixes.length - 1].phone}`);
          console.log(`   قبل: approvalStatus="${approvalStatus}", status="${status}"`);
          console.log(`   بعد: approvalStatus="${approvalStatus}", status="${approvalStatus}"\n`);
        } catch (error) {
          errorCount++;
          console.error(`❌ فشل إصلاح: ${providerId}`, error.message, '\n');
        }
      } else if (!approvalStatus && status) {
        // إذا لم يكن approvalStatus موجوداً، انسخ من status
        fixes.push({
          id: providerId,
          phone: data.phone || 'N/A',
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'N/A',
          before: {
            approvalStatus: 'غير موجود',
            status: status
          },
          after: {
            approvalStatus: status,
            status: status
          }
        });
        
        try {
          await updateDoc(doc(db, 'providers', providerId), {
            approvalStatus: status,
            updatedAt: new Date().toISOString(),
          });
          
          fixedCount++;
          console.log(`✅ تم إصلاح: ${providerId}`);
          console.log(`   الاسم: ${fixes[fixes.length - 1].name}`);
          console.log(`   الهاتف: ${fixes[fixes.length - 1].phone}`);
          console.log(`   قبل: approvalStatus غير موجود, status="${status}"`);
          console.log(`   بعد: approvalStatus="${status}", status="${status}"\n`);
        } catch (error) {
          errorCount++;
          console.error(`❌ فشل إصلاح: ${providerId}`, error.message, '\n');
        }
      }
    }
    
    // ملخص النتائج
    console.log('\n' + '='.repeat(60));
    console.log('📊 ملخص النتائج:');
    console.log('='.repeat(60));
    console.log(`✅ تم إصلاحها: ${fixedCount}`);
    console.log(`❌ فشلت: ${errorCount}`);
    console.log(`✔️  لا تحتاج إصلاح: ${snapshot.docs.length - fixedCount - errorCount}`);
    console.log('='.repeat(60) + '\n');
    
    if (fixes.length > 0) {
      console.log('📋 قائمة المزودين المُصلحين:\n');
      fixes.forEach((fix, index) => {
        console.log(`${index + 1}. ${fix.name} (${fix.phone})`);
        console.log(`   قبل: approvalStatus="${fix.before.approvalStatus}", status="${fix.before.status}"`);
        console.log(`   بعد: approvalStatus="${fix.after.approvalStatus}", status="${fix.after.status}"\n`);
      });
    }
    
    console.log('✨ تم الانتهاء!\n');
    
  } catch (error) {
    console.error('❌ خطأ:', error);
  }
}

// تشغيل السكريبت
fixProviderStatuses();



