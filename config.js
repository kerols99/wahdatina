// ══════════════════════════════
// config.js — إعدادات Supabase والمتغيرات العامة
// ══════════════════════════════

'use strict';

// ★ ضع هنا بيانات مشروع Supabase الجديد
const SB_URL = 'https://uaoahloctstyniqygfkk.supabase.co';
const SB_KEY = 'sb_publishable_kxMQ9UpHKBBWXs_BxpCIXw_RwNKIJSf';

// ══════════════════════════
// Supabase Client
// ══════════════════════════
let sb;
try {
  sb = window.supabase.createClient(SB_URL, SB_KEY);
} catch (e) {
  console.error('Supabase init failed:', e);
}

// ══════════════════════════
// Global State
// ══════════════════════════
let ME            = null;   // { id, email }
let LANG          = 'ar';   // 'ar' | 'en'
let CURRENT_PANEL = 'home';
let APP_THEME     = 'dark';

// ══════════════════════════
// Toast Notification
// ══════════════════════════
function toast(msg, type = 'info') {
  // type: 'success' | 'error' | 'info'
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);

  // Trigger animation
  requestAnimationFrame(() => el.classList.add('toast-show'));

  setTimeout(() => {
    el.classList.remove('toast-show');
    el.classList.add('toast-hide');
    setTimeout(() => el.remove(), 400);
  }, 3000);
}

// ══════════════════════════
// Panel Navigation
// ══════════════════════════
function goPanel(name) {
  // إخفاء كل البانلات
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  // إظهار البانل المطلوب
  const panel = document.getElementById(`panel-${name}`);
  if (panel) panel.classList.add('active');

  const navBtn = document.querySelector(`.nav-btn[data-panel="${name}"]`);
  if (navBtn) navBtn.classList.add('active');

  CURRENT_PANEL = name;

  // تحميل محتوى البانل
  switch (name) {
    case 'home':     loadHome?.();     break;
    case 'units':    loadUnits?.();    break;
    case 'pay':      loadPay?.();      break;
    case 'reports':  loadReports?.();  break;
    case 'moves':    loadMoves?.();    break;
  }
}

// ══════════════════════════
// Drawer
// ══════════════════════════
function openDrawer(contentHtml) {
  const overlay = document.getElementById('drawer-overlay');
  const drawer  = document.getElementById('drawer');
  const body    = document.getElementById('drawer-body');
  if (!overlay || !drawer || !body) return;

  body.innerHTML = contentHtml;
  overlay.classList.add('active');
  drawer.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  const overlay = document.getElementById('drawer-overlay');
  const drawer  = document.getElementById('drawer');
  if (!overlay || !drawer) return;

  overlay.classList.remove('active');
  drawer.classList.remove('active');
  document.body.style.overflow = '';
}

// ══════════════════════════
// Theme System — 6 Themes
// ══════════════════════════
const THEMES = ['default', 'chocolate', 'forest', 'olive', 'navy', 'ink', 'teal', 'light'];

function applyTheme(themeName) {
  if (!THEMES.includes(themeName)) themeName = 'default';
  APP_THEME = themeName;

  const root = document.documentElement;
  // إزالة كل الـ themes السابقة
  if (themeName === 'default') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', themeName);
  }

  localStorage.setItem('wn_theme', themeName);

  // تحديث الـ active swatch
  document.querySelectorAll('.theme-swatch').forEach(el => el.classList.remove('active'));
  const activeId = themeName === 'default' ? 'sw-default' : `sw-${themeName}`;
  document.getElementById(activeId)?.classList.add('active');

  closeThemePanel();
  toast(t('theme_changed'), 'success');
}

function openThemePanel() {
  document.getElementById('theme-panel')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeThemePanel(e) {
  // إغلاق فقط لو ضغط خارج الـ sheet أو استُدعي مباشرة
  if (e && e.target !== document.getElementById('theme-panel')) return;
  document.getElementById('theme-panel')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ══════════════════════════
// Init preferences
// ══════════════════════════
(function initPrefs() {
  const savedTheme = localStorage.getItem('wn_theme') || 'default';
  const savedLang  = localStorage.getItem('wn_lang')  || 'ar';
  APP_THEME = savedTheme;
  LANG      = savedLang;

  if (savedTheme === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  document.documentElement.setAttribute('lang', LANG);
  document.documentElement.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr');

  // تحديث active swatch لو الـ DOM جاهز
  document.addEventListener('DOMContentLoaded', () => {
    const activeId = savedTheme === 'default' ? 'sw-default' : `sw-${savedTheme}`;
    document.getElementById(activeId)?.classList.add('active');
  });
})();

// ══════════════════════════════════════════
// Nav Menu — hamburger drawer
// ══════════════════════════════════════════
function openNavMenu() {
  document.getElementById('nav-menu')?.classList.add('open');
  document.getElementById('nav-overlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeNavMenu() {
  document.getElementById('nav-menu')?.classList.remove('open');
  document.getElementById('nav-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

// ══════════════════════════════════════════
// Header dropdown menu
// ══════════════════════════════════════════
function toggleHeaderMenu() {
  const menu = document.getElementById('header-menu');
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  // إغلاق بالضغط خارجه
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!document.getElementById('header-menu-btn')?.contains(e.target)) {
          menu.style.display = 'none';
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  }
}
