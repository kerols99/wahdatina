// ══════════════════════════════
// helpers.js — دوال مساعدة عامة
// ══════════════════════════════

'use strict';

const Helpers = (() => {

  // تنسيق المبلغ بالدرهم — أرقام إنجليزية دائماً
  function formatAED(amount) {
    const n = parseFloat(amount) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' AED';
  }

  // تنسيق التاريخ للعرض
  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ar-AE', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // تنسيق شهر الدفع للعرض (YYYY-MM-01 → "أبريل 2026")
  function fmtMonth(dateStr, lang = 'ar') {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-AE', { year: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  }

  // أول يوم في الشهر الحالي كـ YYYY-MM-01
  function currentMonthFirst() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  // تحويل تاريخ أي شكل → YYYY-MM-01
  function toMonthFirst(dateStr) {
    if (!dateStr) return currentMonthFirst();
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  // اليوم كـ YYYY-MM-DD
  function today() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  // Escape HTML لمنع XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // توليد رقم إيصال فريد W-XXXXXX
  function genReceiptNo() {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `W-${rand}`;
  }

  // فتح واتساب
  function openWhatsApp(phone, message = '') {
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, '');
    const num = cleaned.startsWith('0') ? '971' + cleaned.slice(1) : cleaned;
    const url = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  // رسالة تذكير إيجار
  function rentReminderMsg(unit, month, remaining, lang = 'AR') {
    const name = unit.tenant_name || '';
    const apt  = unit.apartment || '';
    const room = unit.room || '';
    const monthLabel = fmtMonth(month, lang === 'AR' ? 'ar' : 'en');

    if (lang === 'AR') {
      return `السلام عليكم ${name} 👋\nتذكير بخصوص إيجار شهر ${monthLabel}\nالوحدة: شقة ${apt} — غرفة ${room}\nالمبلغ المتبقي: *${formatAED(remaining)}*\nنرجو السداد في أقرب وقت 🙏`;
    } else {
      return `Hi ${name} 👋\nRent reminder for ${monthLabel}\nUnit: Apt ${apt} — Room ${room}\nAmount due: *${formatAED(remaining)}*\nPlease settle at your earliest convenience 🙏`;
    }
  }

  // تحقق من قيمة فارغة
  function isEmpty(val) {
    return val === null || val === undefined || String(val).trim() === '';
  }

  // تحقق من رقم صحيح
  function isPositive(val) {
    return parseFloat(val) > 0;
  }

  return {
    formatAED,
    fmtDate,
    fmtMonth,
    currentMonthFirst,
    toMonthFirst,
    today,
    escapeHtml,
    genReceiptNo,
    openWhatsApp,
    rentReminderMsg,
    isEmpty,
    isPositive,
  };
})();
