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
      await _loadProfile(session.user);
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
// _loadProfile — جيب الدور + is_active check
// ══════════════════════════
async function _loadProfile(user) {
  try {
    const { data: prof } = await sb.from('profiles')
      .select('role, full_name, name, is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (prof) {
      if (prof.is_active === false) {
        toast(LANG==='ar'
          ? 'حسابك غير نشط — تواصل مع المسؤول'
          : 'Your account is inactive — contact admin', 'error');
        await sb.auth.signOut();
        ME = null; MY_ROLE = 'viewer'; MY_NAME = '';
        showLogin();
        return false;
      }
      MY_ROLE = prof.role      || 'viewer';
      MY_NAME = prof.full_name || prof.name || user.email;
    } else {
      // أول مستخدم → admin تلقائياً
      await sb.from('profiles').upsert({
        id: user.id, email: user.email,
        full_name: user.email, name: user.email,
        role: 'admin', is_active: true,
      });
      MY_ROLE = 'admin';
      MY_NAME = user.email;
    }
    ME.role      = MY_ROLE;
    ME.full_name = MY_NAME;
    return true;
  } catch(e) {
    console.warn('_loadProfile:', e.message);
    MY_ROLE = 'viewer';
    return true;
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
    const active = await _loadProfile(data.user);
    if (!active) return; // is_active=false → logout
    toast(t('welcome'), 'success');
    showApp();
  } catch (err) {
    console.error('Login error:', err);
    toast(t('login_error'), 'error');
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
    toast(t('logout_success'), 'info');
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

  // عرض اسم المستخدم
  const nameEl = document.getElementById('user-name');
  if (nameEl) nameEl.textContent = MY_NAME || ME?.email || '';

  // تطبيق الصلاحيات على الـ UI
  if (typeof applyRoleUI === 'function') applyRoleUI();

  goPanel('home');
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
