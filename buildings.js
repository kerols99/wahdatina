// ══════════════════════════════════════════
// buildings.js — إدارة المباني + Building Switcher
// ══════════════════════════════════════════
'use strict';

// ── جيب مباني المستخدم الحالي ──────────────
async function loadMyBuildings() {
  try {
    let buildings = [];

    if (MY_ROLE === 'admin') {
      // admin يشوف كل المباني
      const { data, error } = await sb.from('buildings').select('*').order('name');
      if (error) throw error;
      buildings = data || [];
    } else {
      // باقي المستخدمين يشوفوا مبانيهم بس
      const { data, error } = await sb
        .from('building_users')
        .select('role, buildings(*)')
        .eq('user_id', ME.id);
      if (error) throw error;
      buildings = (data || []).map(r => ({ ...r.buildings, my_role: r.role }));
    }

    MY_BUILDINGS = buildings;

    // لو مفيش ACTIVE_BUILDING — اختار الأول تلقائياً
    if (!ACTIVE_BUILDING && buildings.length > 0) {
      const saved = localStorage.getItem('active_building_id');
      const found = saved ? buildings.find(b => b.id === saved) : null;
      ACTIVE_BUILDING = found || buildings[0];
      localStorage.setItem('active_building_id', ACTIVE_BUILDING.id);
    }

    renderBuildingSwitcher();
    return buildings;
  } catch(err) {
    console.error('loadMyBuildings:', err);
    return [];
  }
}

// ── Building Switcher في الـ header ──────────
function renderBuildingSwitcher() {
  const el = document.getElementById('building-switcher');
  if (!el) return;

  if (MY_BUILDINGS.length === 0) {
    el.innerHTML = `<span class="muted small">${t('no_buildings')}</span>`;
    return;
  }

  if (MY_BUILDINGS.length === 1) {
    el.innerHTML = `<span class="building-name-badge">🏢 ${Helpers.escapeHtml(ACTIVE_BUILDING?.name || '')}</span>`;
    return;
  }

  // أكثر من مبنى → dropdown
  el.innerHTML = `
<div class="building-select-wrap">
  <button class="building-switcher-btn" onclick="toggleBuildingMenu()" id="building-menu-btn">
    🏢 <span id="active-building-name">${Helpers.escapeHtml(ACTIVE_BUILDING?.name || t('select_building'))}</span>
    <span class="switcher-arrow">▾</span>
  </button>
  <div id="building-dropdown" class="building-dropdown" style="display:none">
    ${MY_BUILDINGS.map(b => `
      <button class="building-option ${ACTIVE_BUILDING?.id === b.id ? 'active' : ''}"
        onclick="switchBuilding('${b.id}')">
        ${ACTIVE_BUILDING?.id === b.id ? '✓ ' : ''}${Helpers.escapeHtml(b.name)}
        ${b.address ? `<span class="muted small">${Helpers.escapeHtml(b.address)}</span>` : ''}
      </button>
    `).join('')}
  </div>
</div>`;
}

function toggleBuildingMenu() {
  const dd = document.getElementById('building-dropdown');
  if (!dd) return;
  const isOpen = dd.style.display !== 'none';
  dd.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!document.getElementById('building-menu-btn')?.contains(e.target)) {
          dd.style.display = 'none';
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  }
}

async function switchBuilding(buildingId) {
  const building = MY_BUILDINGS.find(b => b.id === buildingId);
  if (!building) return;

  ACTIVE_BUILDING = building;
  localStorage.setItem('active_building_id', buildingId);

  // إغلاق القائمة
  const dd = document.getElementById('building-dropdown');
  if (dd) dd.style.display = 'none';

  // تحديث الاسم
  const nameEl = document.getElementById('active-building-name');
  if (nameEl) nameEl.textContent = building.name;

  // إعادة تحميل الصفحة الحالية
  toast(`🏢 ${building.name}`, 'info');
  renderBuildingSwitcher();

  // reload الـ panel الحالي
  const panel = document.querySelector('.nav-btn.active')?.dataset?.panel || 'home';
  switch(panel) {
    case 'home':    loadHome?.();    break;
    case 'units':   loadUnits?.();   break;
    case 'reports': loadReports?.(); break;
    case 'pay':     loadPay?.();     break;
    case 'moves':   loadMoves?.();   break;
  }
}

// ── إضافة مبنى جديد + ربطه بالمستخدم ──────
async function saveBuilding() {
  const name    = document.getElementById('building-name')?.value?.trim();
  const address = document.getElementById('building-address')?.value?.trim();
  const editId  = document.getElementById('building-edit-id')?.value;

  if (!name) { toast(t('toast_name_required'), 'error'); return; }

  const btn = document.getElementById('save-building-btn');
  if (btn) btn.disabled = true;

  try {
    if (editId) {
      // تعديل
      const { error } = await sb.from('buildings')
        .update({ name, address: address || null })
        .eq('id', editId);
      if (error) throw error;
      toast(t('toast_building_saved'), 'success');
    } else {
      // إضافة جديد
      const { data, error } = await sb.from('buildings')
        .insert({ name, address: address || null })
        .select().single();
      if (error) throw error;

      // ربط المبنى بالمستخدم تلقائياً
      if (MY_ROLE !== 'admin') {
        await sb.from('building_users').insert({
          building_id: data.id,
          user_id:     ME.id,
          role:        'owner',
        });
      }

      toast(t('toast_building_added'), 'success');
    }

    clearBuildingForm();
    await loadMyBuildings();
    openBuildingsManager();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
    if (btn) btn.disabled = false;
  }
}

// ── منح مستخدم صلاحية على مبنى (admin فقط) ──
async function grantBuildingAccess(buildingId, userId, role = 'manager') {
  if (!requireRole('settings')) return;
  try {
    const { error } = await sb.from('building_users').upsert({
      building_id: buildingId,
      user_id:     userId,
      role,
    });
    if (error) throw error;
    toast('✅ تم منح الصلاحية', 'success');
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ── إزالة صلاحية مستخدم من مبنى ──
async function revokeBuildingAccess(buildingId, userId) {
  if (!requireRole('settings')) return;
  try {
    const { error } = await sb.from('building_users')
      .delete()
      .eq('building_id', buildingId)
      .eq('user_id', userId);
    if (error) throw error;
    toast('✅ تم إزالة الصلاحية', 'success');
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ── openBuildingsManager — لوحة إدارة المباني ──
async function openBuildingsManager() {
  openDrawer(`<div class="drawer-loading">${t('loading')}</div>`);
  try {
    await loadMyBuildings();
    const buildings = MY_BUILDINGS;

    const rows = buildings.map(b => `
<div class="building-row">
  <div class="building-info">
    <div class="building-row-name">🏢 ${Helpers.escapeHtml(b.name)}</div>
    ${b.address ? `<div class="muted small">${Helpers.escapeHtml(b.address)}</div>` : ''}
    ${ACTIVE_BUILDING?.id === b.id ? `<span class="badge-active">✓ نشط</span>` : ''}
  </div>
  <div style="display:flex;gap:6px;align-items:center">
    ${ACTIVE_BUILDING?.id !== b.id ? `<button class="btn btn-secondary" style="padding:5px 10px;font-size:.78rem" onclick="switchBuilding('${b.id}')">تفعيل</button>` : ''}
    <button class="icon-btn" onclick="openEditBuilding('${b.id}','${Helpers.escapeHtml(b.name)}','${Helpers.escapeHtml(b.address||'')}')">✏️</button>
    <button class="icon-btn" data-role="delete" onclick="deleteBuilding('${b.id}')">🗑️</button>
  </div>
</div>`).join('');

    openDrawer(`
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>🏢 ${t('buildings_title')}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>

  <button class="add-unit-btn" onclick="toggleBuildingForm()">➕ ${t('btn_add_building')}</button>

  <div id="building-form" style="display:none;margin-top:12px">
    <input type="hidden" id="building-edit-id">
    <div class="form-group">
      <label>${t('building_name')} *</label>
      <input type="text" id="building-name" placeholder="${t('building_name_ph')}">
    </div>
    <div class="form-group">
      <label>${t('building_address')}</label>
      <input type="text" id="building-address" placeholder="${t('building_address_ph')}">
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="save-building-btn" onclick="saveBuilding()">
        💾 ${t('btn_save_building')}
      </button>
      <button class="btn btn-secondary" onclick="clearBuildingForm()">${t('btn_cancel')}</button>
    </div>
  </div>

  <div class="section-title" style="margin-top:16px">
    ${t('your_buildings')} (${buildings.length})
  </div>
  <div id="buildings-list">
    ${rows || `<div class="empty-msg">${t('no_buildings')}</div>`}
  </div>
</div>`);
  } catch(err) {
    openDrawer(`<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`);
  }
}

function toggleBuildingForm() {
  const f = document.getElementById('building-form');
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function openEditBuilding(id, name, address) {
  document.getElementById('building-edit-id').value  = id;
  document.getElementById('building-name').value     = name;
  document.getElementById('building-address').value  = address;
  const f = document.getElementById('building-form');
  if (f) f.style.display = 'block';
  const btn = document.getElementById('save-building-btn');
  if (btn) btn.textContent = `💾 ${t('btn_save')}`;
}

function clearBuildingForm() {
  ['building-edit-id','building-name','building-address'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const f = document.getElementById('building-form');
  if (f) f.style.display = 'none';
}

async function deleteBuilding(id) {
  if (!requireRole('delete')) return;
  if (!confirm(t('confirm_delete_building'))) return;
  try {
    const { error } = await sb.from('buildings').delete().eq('id', id);
    if (error) throw error;
    if (ACTIVE_BUILDING?.id === id) {
      ACTIVE_BUILDING = MY_BUILDINGS.find(b => b.id !== id) || null;
      if (ACTIVE_BUILDING) localStorage.setItem('active_building_id', ACTIVE_BUILDING.id);
    }
    toast(t('toast_building_deleted'), 'info');
    await loadMyBuildings();
    openBuildingsManager();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}
