// ══════════════════════════════
// auth.js — تسجيل الدخول والخروج
// ══════════════════════════════

'use strict';

// ══════════════════════════
// تحقق من الجلسة عند التحميل
// ══════════════════════════
async function checkSession() {
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;

    if (session?.user) {
      ME = { id: session.user.id, email: session.user.email };
      showApp();
    } else {
      ME = null;
      showLogin();
    }
  } catch (err) {
    console.error('checkSession error:', err);
    showLogin();
  }
}

// ══════════════════════════
// تسجيل الدخول
// ══════════════════════════
async function handleLogin(e) {
  e.preventDefault();

  const emailEl = document.getElementById('login-email');
  const passEl  = document.getElementById('login-pass');
  const btnEl   = document.getElementById('login-btn');

  if (!emailEl || !passEl) return;

  const email    = emailEl.value.trim();
  const password = passEl.value;

  if (Helpers.isEmpty(email) || Helpers.isEmpty(password)) {
    toast('يرجى إدخال البريد الإلكتروني وكلمة المرور', 'error');
    return;
  }

  btnEl && (btnEl.disabled = true);
  btnEl && (btnEl.textContent = '...');

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    ME = { id: data.user.id, email: data.user.email };
    toast('مرحباً بك 👋', 'success');
    showApp();
  } catch (err) {
    console.error('Login error:', err);
    toast('بيانات الدخول غير صحيحة', 'error');
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = LANG === 'ar' ? 'دخول' : 'Login';
    }
  }
}

// ══════════════════════════
// تسجيل الخروج
// ══════════════════════════
async function handleLogout() {
  try {
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    ME = null;
    toast('تم تسجيل الخروج', 'info');
    showLogin();
  } catch (err) {
    console.error('Logout error:', err);
    toast('حدث خطأ أثناء الخروج', 'error');
  }
}

// ══════════════════════════
// إظهار/إخفاء الشاشات
// ══════════════════════════
function showLogin() {
  const loginScreen = document.getElementById('login-screen');
  const appScreen   = document.getElementById('app-screen');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appScreen)   appScreen.style.display   = 'none';
}

function showApp() {
  const loginScreen = document.getElementById('login-screen');
  const appScreen   = document.getElementById('app-screen');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appScreen)   appScreen.style.display   = 'flex';

  // تحميل الرئيسية + تفعيل الحجوزات المجدولة
  goPanel('home');

  // تشغيل scheduler مرة واحدة فقط
  if (!window._schedulerRan) {
    window._schedulerRan = true;
    activateScheduled?.();
  }
}

// ══════════════════════════
// تغيير كلمة المرور (مستقبلاً)
// ══════════════════════════
async function sendPasswordReset(email) {
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    toast('تم إرسال رابط إعادة التعيين إلى بريدك', 'success');
  } catch (err) {
    console.error('Password reset error:', err);
    toast('حدث خطأ، تأكد من البريد الإلكتروني', 'error');
  }
}
