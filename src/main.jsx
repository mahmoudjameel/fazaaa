import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initGoogleAnalytics } from './utils/marketingAnalytics'

initGoogleAnalytics()

// بعد نشر نسخة جديدة تُحذف ملفات الصفحات القديمة — الصفحة المفتوحة تعلق عند فتح قسم.
// نعيد التحميل مرة واحدة فقط لجلب النسخة الجديدة (نفس المسار، بدون حلقة).
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'chunk_reload_at'
  let last = 0
  try { last = Number(sessionStorage.getItem(KEY)) || 0 } catch (_) {}
  if (Date.now() - last < 30_000) return
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch (_) {}
  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

