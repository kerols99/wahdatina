// ══════════════════════════════════════════
// admin.js — الأدوار والصلاحيات وإدارة الفريق
// ══════════════════════════════════════════
'use strict';

// ── Globals ────────────────────────────────
let MY_ROLE = 'viewer';
let MY_NAME = '';

// ── Role definitions ───────────────────────
const ROLES = {
  admin:     { label: '👑 Admin',     labelAr: '👑 مسؤول كامل',   color: '#f59e0b' },
  manager:   { label: '🟢 Manager',   labelAr: '🟢 مدير',         color: '#22c55e' },
  collector: { label: '🟡 Collector', labelAr: '🟡 محصّل دفعات', color: '#eab308' },
  viewer:    { label: '👁 Viewer',    labelAr: '👁 مشاهد فقط',   color: '#64748b' },
};

// ── Permissions table ──────────────────────
const PERMISSIONS = {
  read:             ['admin','manager','collector','viewer'],
  add_payment:      ['admin','manager','collector'],
  manage_units:     ['admin','manager'],
  manage_moves:     ['admin','manager'],
  manage_expenses:  ['admin','manager'],
  delete:           ['admin','manager'],
  manage_team:      ['admin'],
  settings:         ['admin'],
};

// ── canDo / requireRole ────────────────────
function canDo(action) {
  return (PERMISSIONS[action] || []).includes(MY_ROLE);
}

function requireRole(action, msg) {
  if (!canDo(action)) {
    toast(msg || t('no_permission'), 'error');
    return false;
  }
  return true;
}

// ── applyRoleUI — إخفاء عناصر حسب الدور ──
function applyRoleUI() {
  // حذف — manager+ فقط
  if (!canDo('delete')) {
    document.querySelectorAll('[data-role="delete"]')
      .forEach(el => el.style.display = 'none');
  }
  // moves — manager+ فقط
  if (!canDo('manage_moves')) {
    document.querySelectorAll('[data-role="moves"]')
      .forEach(el => el.style.display = 'none');
  }
  // expenses — manager+ فقط
  if (!canDo('manage_expenses')) {
    document.querySelectorAll('[data-role="expenses"]')
      .forEach(el => el.style.display = 'none');
  }
  // إضافة/تعديل وحدة — manager+ فقط
  if (!canDo('manage_units')) {
    document.querySelectorAll('[data-role="units"]')
      .forEach(el => el.style.display = 'none');
  }
  // admin panel — admin فقط
  const adminBtn = document.getElementById('admin-btn');
  if (adminBtn) adminBtn.style.display = MY_ROLE === 'admin' ? 'inline-flex' : 'none';
}

// ══════════════════════════════════════════
// loadAdminPanel
// ══════════════════════════════════════════
async function loadAdminPanel() {
  if (!requireRole('manage_team')) return;
  openDrawer(`<div class="drawer-loading">${t('loading')}</div>`);
  try {
    const { data: profiles, error } = await sb
      .from('profiles').select('*').order('created_at');
    if (error) throw error;

    const rows = (profiles || []).map(p => {
      const role = ROLES[p.role] || ROLES.viewer;
      const isMe = p.id === ME?.id;
      return `
<div class="team-card ${isMe ? 'team-card-me' : ''}">
  <div class="team-card-info">
    <div class="team-name">${Helpers.escapeHtml(p.full_name || p.name || p.email)}</div>
    <div class="team-email muted small">${Helpers.escapeHtml(p.email)}</div>
    <div class="team-role-badge" style="color:${role.color}">
      ${LANG === 'ar' ? role.labelAr : role.label}
    </div>
    <div class="muted small">${p.is_active ? '✅ '+t('active') : '❌ '+t('inactive')}</div>
  </div>
  <div class="team-card-actions">
    ${!isMe ? `
    <select class="role-select" onchange="changeRole('${p.id}', this.value)">
      ${Object.entries(ROLES).map(([key, r]) =>
        `<option value="${key}" ${p.role === key ? 'selected' : ''}>
          ${LANG === 'ar' ? r.labelAr : r.label}
        </option>`
      ).join('')}
    </select>
    <button class="icon-btn" title="${t('toggle_active')}"
      onclick="toggleActive('${p.id}', ${!p.is_active})"
      style="color:${p.is_active ? 'var(--green)' : 'var(--red)'}">
      ${p.is_active ? '✅' : '❌'}
    </button>
    <button class="icon-btn" onclick="deleteStaff('${p.id}','${Helpers.escapeHtml(p.email)}')">🗑️</button>
    ` : `<span class="muted small">${t('you')}</span>`}
  </div>
</div>`;
    }).join('');

    openDrawer(`
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>👑 ${t('admin_team')}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>

  <button class="add-unit-btn" onclick="toggleAddStaff()">
    ➕ ${t('btn_add_staff')}
  </button>

  <div id="add-staff-form" style="display:none;margin-top:12px">
    <div class="form-group">
      <label>${t('staff_email')}</label>
      <input type="email" id="new-staff-email" placeholder="email@example.com">
    </div>
    <div class="form-group">
      <label>${t('staff_name')}</label>
      <input type="text" id="new-staff-name" placeholder="${t('staff_name_ph')}">
    </div>
    <div class="form-group">
      <label>${t('staff_pass')}</label>
      <input type="password" id="new-staff-pass" placeholder="••••••••" minlength="6">
    </div>
    <div class="form-group">
      <label>${t('staff_role')}</label>
      <select id="new-staff-role">
        ${Object.entries(ROLES).map(([key, r]) =>
          `<option value="${key}" ${key==='collector'?'selected':''}>
            ${LANG === 'ar' ? r.labelAr : r.label}
          </option>`
        ).join('')}
      </select>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-create-user" onclick="createUser()">
        💾 ${t('btn_create_user')}
      </button>
      <button class="btn btn-secondary" onclick="toggleAddStaff()">${t('btn_cancel')}</button>
    </div>
  </div>

  <button class="btn btn-secondary" style="width:100%;margin-top:16px" onclick="loadAuditLog()">
    📋 ${t('audit_log_title')}
  </button>

  <div class="section-title" style="margin-top:20px">
    ${t('team_members')} (${(profiles||[]).length})
  </div>
  <div id="team-list">
    ${rows || `<div class="empty-msg">${t('no_team_members')}</div>`}
  </div>
</div>`);

  } catch(err) {
    openDrawer(`<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`);
  }
}

// ══════════════════════════════════════════
// toggleAddStaff
// ══════════════════════════════════════════
function toggleAddStaff() {
  const form = document.getElementById('add-staff-form');
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

// ══════════════════════════════════════════
// createUser
// ══════════════════════════════════════════
async function createUser() {
  if (!requireRole('manage_team')) return;

  const email = document.getElementById('new-staff-email')?.value.trim();
  const name  = document.getElementById('new-staff-name')?.value.trim();
  const pass  = document.getElementById('new-staff-pass')?.value;
  const role  = document.getElementById('new-staff-role')?.value || 'collector';

  if (!email || !pass) { toast(t('toast_email_pass_required'), 'error'); return; }
  if (pass.length < 6)  { toast(t('toast_pass_too_short'), 'error'); return; }

  const btn = document.getElementById('btn-create-user');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    const { data, error } = await sb.auth.admin.createUser({
      email, password: pass, email_confirm: true,
      user_metadata: { full_name: name || email, role },
    });
    if (error) throw error;

    const { error: profErr } = await sb.from('profiles').upsert({
      id: data.user.id, email,
      full_name: name || email, name: name || email,
      role, is_active: true,
    });
    if (profErr) throw profErr;

    logAction('create_user', 'profiles', data.user.id, { email, role });
    toast(t('toast_user_created'), 'success');
    loadAdminPanel();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
    if (btn) { btn.disabled = false; btn.textContent = `💾 ${t('btn_create_user')}`; }
  }
}

// ══════════════════════════════════════════
// loadTeam — للاستخدام الداخلي
// ══════════════════════════════════════════
async function loadTeam() {
  try {
    const { data, error } = await sb.from('profiles')
      .select('id, email, full_name, name, role, is_active')
      .order('role').order('created_at');
    if (error) throw error;
    return data || [];
  } catch(err) {
    console.error('loadTeam:', err);
    return [];
  }
}

// ══════════════════════════════════════════
// changeRole
// ══════════════════════════════════════════
async function changeRole(userId, newRole) {
  if (!requireRole('manage_team')) return;
  if (!ROLES[newRole]) return;
  try {
    const { error } = await sb.from('profiles')
      .update({ role: newRole }).eq('id', userId);
    if (error) throw error;
    logAction('change_role', 'profiles', userId, { role: newRole });
    toast(t('toast_role_changed'), 'success');
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════
// toggleActive — تفعيل/تعطيل حساب
// ══════════════════════════════════════════
async function toggleActive(userId, newState) {
  if (!requireRole('manage_team')) return;
  try {
    const { error } = await sb.from('profiles')
      .update({ is_active: newState }).eq('id', userId);
    if (error) throw error;
    toast(newState ? t('toast_user_activated') : t('toast_user_deactivated'), 'success');
    loadAdminPanel();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════
// deleteStaff
// ══════════════════════════════════════════
async function deleteStaff(userId, email) {
  if (!requireRole('manage_team')) return;
  if (!confirm(`${t('confirm_delete_staff')}: ${email}`)) return;
  try {
    const { error } = await sb.from('profiles').delete().eq('id', userId);
    if (error) throw error;
    await sb.auth.admin.deleteUser(userId).catch(() =>
      console.warn('auth delete needs service role')
    );
    logAction('delete_staff', 'profiles', userId, { email });
    toast(t('toast_staff_deleted'), 'info');
    loadAdminPanel();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════
// AUDIT LOG
// ══════════════════════════════════════════
async function logAction(action, entity, entityId, details = {}) {
  try {
    await sb.from('audit_log').insert({
      user_id: ME?.id || null, user_email: ME?.email || null,
      user_name: MY_NAME || ME?.email || null,
      action, entity, entity_id: entityId ? String(entityId) : null, details,
    });
  } catch(err) {
    console.warn('logAction:', err.message);
  }
}

async function loadAuditLog() {
  if (!requireRole('manage_team')) return;
  openDrawer(`<div class="drawer-loading">${t('loading')}</div>`);
  try {
    const { data: logs, error } = await sb.from('audit_log')
      .select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;

    window._auditLogs = logs || [];
    renderAuditList(logs || []);
  } catch(err) {
    openDrawer(`<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`);
  }
}

function renderAuditList(logs) {
  const ACTION_ICONS = {
    pay_rent:'💰', pay_deposit:'🔒', pay_expense:'💸', pay_owner:'👤',
    add_unit:'🏠', edit_unit:'✏️', delete_unit:'🗑️', departure:'🚪',
    arrival:'🆕', transfer:'🔄', create_user:'👑', change_role:'🎭',
    delete_staff:'❌', building_add:'🏢', building_edit:'✏️', building_delete:'🗑️',
  };
  const ACTION_LABELS_AR = {
    pay_rent:'إيجار', pay_deposit:'تأمين', pay_expense:'مصروف', pay_owner:'دفعة مالك',
    add_unit:'إضافة وحدة', edit_unit:'تعديل وحدة', delete_unit:'حذف وحدة',
    departure:'مغادرة', arrival:'انتقال', transfer:'نقل داخلي',
    create_user:'إنشاء مستخدم', change_role:'تغيير دور', delete_staff:'حذف عضو',
    building_add:'إضافة مبنى', building_edit:'تعديل مبنى', building_delete:'حذف مبنى',
  };
  const ACTION_LABELS_EN = {
    pay_rent:'Rent', pay_deposit:'Deposit', pay_expense:'Expense', pay_owner:'Owner Pay',
    add_unit:'Add Unit', edit_unit:'Edit Unit', delete_unit:'Delete Unit',
    departure:'Departure', arrival:'Arrival', transfer:'Transfer',
    create_user:'Create User', change_role:'Change Role', delete_staff:'Delete Staff',
    building_add:'Add Building', building_edit:'Edit Building', building_delete:'Delete Building',
  };

  const rows = logs.map(log => {
    const icon = ACTION_ICONS[log.action] || '📝';
    const label = LANG==='ar' ? (ACTION_LABELS_AR[log.action]||log.action) : (ACTION_LABELS_EN[log.action]||log.action);
    const d = log.details || {};
    const parts = [];
    if (d.apartment) parts.push(`${LANG==='ar'?'شقة':'Apt'} ${d.apartment}`);
    if (d.room)      parts.push(`${LANG==='ar'?'غرفة':'Room'} ${d.room}`);
    if (d.tenant)    parts.push(d.tenant);
    if (d.amount)    parts.push(Helpers.formatAED(d.amount));
    if (d.month)     parts.push(d.month);
    if (d.email)     parts.push(d.email);
    if (d.role)      parts.push(d.role);
    if (d.name)      parts.push(d.name);
    const detail = parts.join(' · ');
    const dt = log.created_at ? new Date(log.created_at) : null;
    const timeStr = dt ? dt.toLocaleTimeString(LANG==='ar'?'ar-AE':'en-AE',{hour:'2-digit',minute:'2-digit'}) : '';
    return `
<div class="audit-row">
  <div class="audit-icon">${icon}</div>
  <div class="audit-body">
    <div class="audit-action">${label}</div>
    ${detail ? `<div class="audit-detail muted small">${Helpers.escapeHtml(detail)}</div>` : ''}
    <div class="audit-meta muted small">${Helpers.escapeHtml(log.user_name||log.user_email||'—')} · ${Helpers.fmtDate(log.created_at)} ${timeStr}</div>
  </div>
</div>`;
  }).join('');

  openDrawer(`
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>📋 ${t('audit_log_title')}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>
  <select class="audit-filter" onchange="filterAuditLog(this.value)">
    <option value="">${t('all_actions')}</option>
    <option value="pay_rent">💰 ${LANG==='ar'?'إيجار':'Rent'}</option>
    <option value="pay_deposit">🔒 ${LANG==='ar'?'تأمين':'Deposit'}</option>
    <option value="pay_expense">💸 ${LANG==='ar'?'مصروف':'Expense'}</option>
    <option value="add_unit">🏠 ${LANG==='ar'?'إضافة وحدة':'Add Unit'}</option>
    <option value="departure">🚪 ${LANG==='ar'?'مغادرة':'Departure'}</option>
    <option value="arrival">🆕 ${LANG==='ar'?'انتقال':'Arrival'}</option>
    <option value="create_user">👑 ${LANG==='ar'?'مستخدم':'User'}</option>
  </select>
  <div id="audit-list" style="margin-top:12px">
    ${rows || `<div class="empty-msg">${t('no_audit_logs')}</div>`}
  </div>
</div>`);
}

function filterAuditLog(action) {
  const list = document.getElementById('audit-list');
  if (!list) return;
  const filtered = action
    ? (window._auditLogs||[]).filter(l => l.action === action)
    : (window._auditLogs||[]);
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-msg">${t('no_audit_logs')}</div>`;
    return;
  }
  // re-use renderAuditList logic inline
  list.innerHTML = filtered.map(log => {
    const ACTION_ICONS = {pay_rent:'💰',pay_deposit:'🔒',pay_expense:'💸',pay_owner:'👤',add_unit:'🏠',edit_unit:'✏️',delete_unit:'🗑️',departure:'🚪',arrival:'🆕',transfer:'🔄',create_user:'👑',change_role:'🎭',delete_staff:'❌'};
    const icon = ACTION_ICONS[log.action] || '📝';
    const d = log.details || {};
    const parts = [d.apartment&&`${LANG==='ar'?'شقة':'Apt'} ${d.apartment}`,d.room&&`${LANG==='ar'?'غرفة':'Room'} ${d.room}`,d.tenant,d.amount&&Helpers.formatAED(d.amount),d.email,d.role].filter(Boolean);
    const dt = log.created_at ? new Date(log.created_at) : null;
    const timeStr = dt ? dt.toLocaleTimeString(LANG==='ar'?'ar-AE':'en-AE',{hour:'2-digit',minute:'2-digit'}) : '';
    return `<div class="audit-row"><div class="audit-icon">${icon}</div><div class="audit-body"><div class="audit-action">${log.action}</div>${parts.length?`<div class="muted small">${Helpers.escapeHtml(parts.join(' · '))}</div>`:''}<div class="audit-meta muted small">${Helpers.escapeHtml(log.user_name||'—')} · ${Helpers.fmtDate(log.created_at)} ${timeStr}</div></div></div>`;
  }).join('');
}
