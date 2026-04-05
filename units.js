// ══════════════════════════════
// units.js — إدارة الوحدات
// ══════════════════════════════

'use strict';

let _allUnits       = [];
let _allBuildings   = [];   // قائمة المباني
let _unitsFilter    = 'all';
let _unitsSearch    = '';
let _buildingFilter = '';   // '' = كل المباني
let _currentMonthPayments = [];

// expose للـ moves.js
Object.defineProperty(window, '_allUnits',     { get: () => _allUnits });
Object.defineProperty(window, '_allBuildings', { get: () => _allBuildings });

// ══════════════════════════
// تحميل المباني (مرة واحدة)
// ══════════════════════════
async function loadBuildings() {
  if (_allBuildings.length > 0) return; // cached
  try {
    const { data, error } = await sb.from('buildings').select('*').order('name');
    if (error) throw error;
    _allBuildings = data || [];
  } catch(err) {
    console.warn('loadBuildings:', err.message);
    _allBuildings = [];
  }
}

// ══════════════════════════
// تحميل الوحدات
// ══════════════════════════
async function loadUnits() {
  const container = document.getElementById('units-list');
  if (!container) return;
  container.innerHTML = `<div class="loading">${t('loading')}</div>`;

  try {
    const monthFirst = Helpers.currentMonthFirst();

    // تحميل المباني أولاً (مع cache)
    await loadBuildings();

    // Q9: جيب الوحدات + المدفوعات دفعة واحدة
    let unitsQuery = sb.from('units').select('*').order('apartment').order('room');
    if (_buildingFilter) unitsQuery = unitsQuery.eq('building_id', _buildingFilter);

    const [unitsRes, paymentsRes] = await Promise.all([
      unitsQuery,
      sb.from('rent_payments')
        .select('unit_id, apartment, room, amount, tenant_num')
        .eq('payment_month', monthFirst)
    ]);

    if (unitsRes.error)    throw unitsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    _allUnits             = unitsRes.data || [];
    _currentMonthPayments = paymentsRes.data || [];

    renderBuildingFilter();
    renderUnitsList();
  } catch (err) {
    console.error('loadUnits error:', err);
    container.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

// ══════════════════════════
// فلتر المباني
// ══════════════════════════
function renderBuildingFilter() {
  const wrap = document.getElementById('building-filter-wrap');
  if (!wrap) return;

  if (_allBuildings.length === 0) {
    wrap.innerHTML = '';
    return;
  }

  const opts = [
    `<button class="filter-btn ${_buildingFilter===''?'active':''}" onclick="setBuildingFilter('')">${t('all_buildings')}</button>`,
    ..._allBuildings.map(b =>
      `<button class="filter-btn ${_buildingFilter===b.id?'active':''}" onclick="setBuildingFilter('${b.id}')">${Helpers.escapeHtml(b.name)}</button>`
    )
  ].join('');

  wrap.innerHTML = `<div class="filter-row building-filter">${opts}</div>`;
}

function setBuildingFilter(buildingId) {
  _buildingFilter = buildingId;
  loadUnits();
}

// ══════════════════════════
// رسم قائمة الوحدات
// ══════════════════════════
function renderUnitsList() {
  const container = document.getElementById('units-list');
  if (!container) return;

  // بناء map للمدفوعات: unit_id → إجمالي مدفوع
  const paidMap = {};
  for (const p of _currentMonthPayments) {
    const key = p.unit_id || `${p.apartment}-${p.room}`;
    paidMap[key] = (paidMap[key] || 0) + parseFloat(p.amount || 0);
  }

  // تصفية
  let filtered = _allUnits.filter(u => {
    // بحث
    if (_unitsSearch) {
      const q = _unitsSearch.toLowerCase();
      const match =
        u.apartment?.toLowerCase().includes(q) ||
        u.room?.toLowerCase().includes(q) ||
        u.tenant_name?.toLowerCase().includes(q) ||
        u.tenant_name2?.toLowerCase().includes(q);
      if (!match) return false;
    }

    // فلتر حالة الدفع
    if (_unitsFilter !== 'all' && !u.is_vacant) {
      const paid     = paidMap[u.id] || 0;
      const required = parseFloat(u.monthly_rent || 0);
      if (_unitsFilter === 'paid'    && paid < required) return false;
      if (_unitsFilter === 'partial' && (paid === 0 || paid >= required)) return false;
      if (_unitsFilter === 'unpaid'  && paid > 0)  return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-msg">لا توجد وحدات</div>';
    return;
  }

  container.innerHTML = filtered.map(u => renderUnitCard(u, paidMap)).join('');
}

// ══════════════════════════
// كارد الوحدة
// ══════════════════════════
function renderUnitCard(u, paidMap) {
  const paid     = paidMap[u.id] || 0;
  const required = parseFloat(u.monthly_rent || 0);
  const remaining = Math.max(0, required - paid);

  let statusClass = 'status-vacant';
  let statusLabel = t('status_vacant');

  if (!u.is_vacant) {
    if (paid >= required && required > 0) {
      statusClass = 'status-paid'; statusLabel = t('status_paid');
    } else if (paid > 0) {
      statusClass = 'status-partial'; statusLabel = t('status_partial');
    } else {
      statusClass = 'status-unpaid'; statusLabel = t('status_unpaid');
    }
  }

  if (u.unit_status === 'maintenance')   { statusClass = 'status-maint';  statusLabel = t('status_maint'); }
  if (u.unit_status === 'reserved')      { statusClass = 'status-reserved'; statusLabel = t('status_reserved'); }
  if (u.unit_status === 'leaving_soon')  { statusClass = 'status-leaving'; statusLabel = t('status_leaving'); }

  const tenantLine = u.tenant_name
    ? `<span class="unit-tenant">${Helpers.escapeHtml(u.tenant_name)}${u.tenant_name2 ? ' + ' + Helpers.escapeHtml(u.tenant_name2) : ''}</span>`
    : `<span class="unit-tenant muted">${t('vacant_label')}</span>`;

  const payLine = !u.is_vacant && required > 0
    ? `<div class="unit-pay-line">
        <span class="paid-amt">${Helpers.formatAED(paid)}</span>
        <span class="pay-sep"> / </span>
        <span class="req-amt">${Helpers.formatAED(required)}</span>
        ${remaining > 0 ? `<span class="rem-badge">${t('remaining_prefix')} ${Helpers.formatAED(remaining)}</span>` : ''}
       </div>`
    : '';

  const waBtn = u.phone
    ? `<button class="icon-btn wa-btn" onclick="event.stopPropagation(); Helpers.openWhatsApp('${Helpers.escapeHtml(u.phone)}')" title="WhatsApp">💬</button>`
    : '';

  const payBtn = !u.is_vacant
    ? `<button class="icon-btn pay-btn" onclick="event.stopPropagation(); quickPayUnit('${u.id}')" title="${t('btn_pay')}">💰</button>`
    : '';

  return `
<div class="unit-card" onclick="openUnitDrawer('${u.id}')">
  <div class="unit-card-header">
    <div class="unit-id-block">
      <span class="unit-apt">${t('apt_label')} ${Helpers.escapeHtml(u.apartment)}</span>
      <span class="unit-room">${t('room_label')} ${Helpers.escapeHtml(u.room)}</span>
    </div>
    <span class="status-badge ${statusClass}">${statusLabel}</span>
  </div>
  ${tenantLine}
  ${payLine}
  <div class="unit-card-actions">
    ${waBtn}
    ${payBtn}
  </div>
</div>`;
}

// ══════════════════════════
// Drawer تفاصيل الوحدة
// ══════════════════════════
async function openUnitDrawer(unitId) {
  const unit = _allUnits.find(u => u.id === unitId);
  if (!unit) return;

  openDrawer(`<div class="drawer-loading">${t('loading')}</div>`);

  try {
    // Q9: جيب كل البيانات دفعة واحدة — مدفوعات + تأمين + تاريخ الوحدة
    const [paymentsRes, depositRes, historyRes] = await Promise.all([
      sb.from('rent_payments')
        .select('*')
        .eq('unit_id', unitId)
        .order('payment_date', { ascending: false })
        .limit(10),
      sb.from('deposits')
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      // المستأجرون السابقون من unit_history
      sb.from('unit_history')
        .select('*')
        .eq('unit_id', unitId)
        .order('end_date', { ascending: false })
        .limit(5),
    ]);

    if (paymentsRes.error) throw paymentsRes.error;

    const payments = paymentsRes.data || [];
    const deposit  = depositRes.data;
    const history  = historyRes.data || [];

    // مدفوع هذا الشهر للمستأجر الحالي
    const monthFirst = Helpers.currentMonthFirst();
    const paidThisMonth = payments
      .filter(p => p.payment_month === monthFirst)
      .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const remaining = Math.max(0, parseFloat(unit.monthly_rent || 0) - paidThisMonth);

    const paymentsHtml = payments.length > 0
      ? payments.map(p => `
          <div class="history-row">
            <span>${Helpers.fmtDate(p.payment_date)}</span>
            <span class="muted">${Helpers.fmtMonth(p.payment_month)}</span>
            <span class="green">${Helpers.formatAED(p.amount)}</span>
            <span class="muted">${p.payment_method}</span>
          </div>`).join('')
      : `<div class="muted small">${t('no_payments')}</div>`;

    const depositHtml = deposit
      ? `<div class="deposit-row">
           <span>${t('drawer_deposit')}: ${Helpers.formatAED(deposit.amount)}</span>
           <span class="badge badge-${deposit.status === 'held' ? 'amber' : deposit.status === 'refunded' ? 'green' : 'red'}">
             ${deposit.status === 'held' ? t('deposit_held') : deposit.status === 'refunded' ? t('deposit_refunded') : t('deposit_forfeited')}
           </span>
           ${deposit.refund_amount > 0 ? `<span class="muted small">${t('refunded_prefix')}: ${Helpers.formatAED(deposit.refund_amount)}</span>` : ''}
         </div>`
      : `<div class="muted small">${t('no_deposit')}</div>`;

    const historyHtml = history.length > 0
      ? history.map(h => `
          <div class="prev-tenant-row">
            <div class="prev-tenant-name">👤 ${Helpers.escapeHtml(h.tenant_name || '—')}</div>
            <div class="prev-tenant-dates muted small">
              ${Helpers.fmtDate(h.start_date)} → ${Helpers.fmtDate(h.end_date)}
            </div>
            <div class="prev-tenant-amounts">
              <span class="green small">💰 ${Helpers.formatAED(h.monthly_rent)}</span>
              <span class="amber small">🔒 ${Helpers.formatAED(h.deposit)}</span>
            </div>
          </div>`).join('')
      : `<div class="muted small">${t('no_history')}</div>`;

    const dualTenantHtml = unit.tenant_name2 ? `
      <div class="dual-tenant-info">
        <div>👤 ${Helpers.escapeHtml(unit.tenant_name)} — <span class="green">${Helpers.formatAED(unit.rent1 || unit.monthly_rent)}</span></div>
        <div>👤 ${Helpers.escapeHtml(unit.tenant_name2)} — <span class="green">${Helpers.formatAED(unit.rent2 || 0)}</span></div>
      </div>` : '';

    const content = `
<div class="drawer-unit">
  <div class="drawer-unit-header">
    <h2>${t('apt_label')} ${Helpers.escapeHtml(unit.apartment)} — ${t('room_label')} ${Helpers.escapeHtml(unit.room)}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>

  ${remaining > 0 ? `
  <div class="drawer-remaining-banner">
    ⏳ ${t('kpi_remaining')}: <strong class="amber">${Helpers.formatAED(remaining)}</strong>
    / ${t('kpi_collected')}: <strong class="green">${Helpers.formatAED(paidThisMonth)}</strong>
  </div>` : !unit.is_vacant ? `
  <div class="drawer-paid-banner">✅ ${t('status_paid')} — ${Helpers.fmtMonth(monthFirst)}</div>` : ''}

  <div class="info-grid">
    ${unit.building_id ? `<div class="info-item full"><span class="info-label">${t('uf_building')}</span><span>🏢 ${Helpers.escapeHtml(_allBuildings.find(b=>b.id===unit.building_id)?.name || unit.building_id)}</span></div>` : ''}
    <div class="info-item"><span class="info-label">${t('drawer_tenant')}</span><span>${Helpers.escapeHtml(unit.tenant_name || '—')}</span></div>
    ${unit.tenant_name2 ? `<div class="info-item"><span class="info-label">${t('drawer_partner')}</span><span>${Helpers.escapeHtml(unit.tenant_name2)}</span></div>` : ''}
    <div class="info-item"><span class="info-label">${t('drawer_phone')}</span><span>${Helpers.escapeHtml(unit.phone || '—')}</span></div>
    ${unit.phone2 ? `<div class="info-item"><span class="info-label">${t('drawer_phone2')}</span><span>${Helpers.escapeHtml(unit.phone2)}</span></div>` : ''}
    <div class="info-item"><span class="info-label">${t('drawer_rent')}</span><span class="green">${Helpers.formatAED(unit.monthly_rent)}</span></div>
    <div class="info-item"><span class="info-label">${t('drawer_start')}</span><span>${Helpers.fmtDate(unit.start_date)}</span></div>
    <div class="info-item"><span class="info-label">${t('drawer_persons')}</span><span>${unit.persons_count || 1}</span></div>
    <div class="info-item"><span class="info-label">${t('drawer_lang')}</span><span>${(unit.language || 'AR').toUpperCase() === 'AR' ? t('uf_lang_ar') : t('uf_lang_en')}</span></div>
    ${unit.notes ? `<div class="info-item full"><span class="info-label">${t('drawer_notes')}</span><span>${Helpers.escapeHtml(unit.notes)}</span></div>` : ''}
  </div>

  ${dualTenantHtml}

  <div class="section-title">${t('drawer_deposit')}</div>
  ${depositHtml}

  <div class="section-title">${t('drawer_payments')}</div>
  <div class="payments-history">${paymentsHtml}</div>

  ${history.length > 0 ? `
  <div class="section-title">👥 ${t('prev_tenants')}</div>
  <div class="prev-tenants-list">${historyHtml}</div>` : ''}

  <div class="drawer-actions">
    <button class="btn btn-primary"  onclick="openEditUnit('${unit.id}')">${t('btn_edit')}</button>
    <button class="btn btn-success"  onclick="closeDrawer(); quickPayUnit('${unit.id}')">${t('btn_pay')}</button>
    ${unit.phone  ? `<button class="btn btn-whatsapp" onclick="sendRentReminder('${unit.id}',1)">💬 ${unit.tenant_name  ? Helpers.escapeHtml(unit.tenant_name.split(' ')[0])  : t('btn_reminder')}</button>` : ''}
    ${unit.phone2 && unit.tenant_name2 ? `<button class="btn btn-whatsapp" onclick="sendRentReminder('${unit.id}',2)">💬 ${Helpers.escapeHtml(unit.tenant_name2.split(' ')[0])}</button>` : ''}
    ${!unit.is_vacant ? `<button class="btn btn-warning" onclick="openDepartureForm('${unit.id}')">${t('btn_departure')}</button>` : ''}
  </div>
</div>`;

    openDrawer(content);
  } catch (err) {
    console.error('openUnitDrawer error:', err);
    openDrawer(`<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`);
  }
}

// ══════════════════════════
// نموذج إضافة/تعديل وحدة
// ══════════════════════════
function openAddUnit() {
  openDrawer(buildUnitForm(null));
}

async function openEditUnit(unitId) {
  try {
    const unit = _allUnits.find(u => u.id === unitId);
    if (!unit) { toast(t('unit_not_found'), 'error'); return; }
    openDrawer(buildUnitForm(unit));
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

function buildUnitForm(unit) {
  const isEdit = !!unit;
  const title  = isEdit ? t('edit_unit_title') : t('add_unit_title');

  // building selector
  const buildingOpts = _allBuildings.length > 0
    ? `<div class="form-group">
        <label>${t('uf_building')}</label>
        <select id="uf-building">
          <option value="">${t('no_building')}</option>
          ${_allBuildings.map(b =>
            `<option value="${b.id}" ${unit?.building_id === b.id ? 'selected' : ''}>${Helpers.escapeHtml(b.name)}</option>`
          ).join('')}
        </select>
      </div>`
    : `<input type="hidden" id="uf-building" value="${unit?.building_id || ''}">`;

  return `
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>${title}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>

  ${buildingOpts}

  <div class="form-group">
    <label>${t('uf_apt')}</label>
    <input type="text" id="uf-apt" value="${Helpers.escapeHtml(unit?.apartment || '')}" placeholder="${t('uf_apt_ph')}">
  </div>
  <div class="form-group">
    <label>${t('uf_room')}</label>
    <input type="text" id="uf-room" value="${Helpers.escapeHtml(unit?.room || '')}" placeholder="${t('uf_room_ph')}">
  </div>
  <div class="form-group">
    <label>${t('uf_tenant')}</label>
    <input type="text" id="uf-tenant" value="${Helpers.escapeHtml(unit?.tenant_name || '')}" placeholder="${t('uf_tenant_ph')}">
  </div>
  <div class="form-group">
    <label>${t('uf_tenant2')}</label>
    <input type="text" id="uf-tenant2" value="${Helpers.escapeHtml(unit?.tenant_name2 || '')}" placeholder="${t('uf_optional')}">
  </div>
  <div class="form-group">
    <label>${t('uf_phone')}</label>
    <input type="tel" id="uf-phone" value="${Helpers.escapeHtml(unit?.phone || '')}" placeholder="+971XXXXXXXXX">
  </div>
  <div class="form-group">
    <label>${t('uf_phone2')}</label>
    <input type="tel" id="uf-phone2" value="${Helpers.escapeHtml(unit?.phone2 || '')}" placeholder="${t('uf_optional')}">
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>${t('uf_rent')}</label>
      <input type="number" id="uf-rent" value="${unit?.monthly_rent || ''}" placeholder="0">
    </div>
    <div class="form-group">
      <label>${t('uf_deposit')}</label>
      <input type="number" id="uf-deposit" value="${unit?.deposit || ''}" placeholder="0">
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>${t('uf_rent1')}</label>
      <input type="number" id="uf-rent1" value="${unit?.rent1 || ''}" placeholder="0">
    </div>
    <div class="form-group">
      <label>${t('uf_rent2')}</label>
      <input type="number" id="uf-rent2" value="${unit?.rent2 || ''}" placeholder="0">
    </div>
  </div>
  <div class="form-group">
    <label>${t('uf_start')}</label>
    <input type="date" id="uf-start" value="${unit?.start_date || ''}">
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>${t('uf_persons')}</label>
      <input type="number" id="uf-persons" value="${unit?.persons_count || 1}" min="1" max="10">
    </div>
    <div class="form-group">
      <label>${t('uf_language')}</label>
      <select id="uf-lang">
        <option value="AR" ${(unit?.language || 'AR').toUpperCase() === 'AR' ? 'selected' : ''}>${t('uf_lang_ar')}</option>
        <option value="EN" ${unit?.language?.toUpperCase() === 'EN' ? 'selected' : ''}>${t('uf_lang_en')}</option>
      </select>
    </div>
  </div>
  <div class="form-group">
    <label>${t('uf_status')}</label>
    <select id="uf-status">
      <option value="available"    ${(unit?.unit_status||'available')==='available'   ? 'selected':''}>${t('uf_st_avail')}</option>
      <option value="occupied"     ${unit?.unit_status==='occupied'    ? 'selected':''}>${t('uf_st_occ')}</option>
      <option value="reserved"     ${unit?.unit_status==='reserved'    ? 'selected':''}>${t('uf_st_res')}</option>
      <option value="maintenance"  ${unit?.unit_status==='maintenance' ? 'selected':''}>${t('uf_st_maint')}</option>
      <option value="leaving_soon" ${unit?.unit_status==='leaving_soon'? 'selected':''}>${t('uf_st_leaving')}</option>
    </select>
  </div>
  <div class="form-group">
    <label>${t('uf_notes')}</label>
    <textarea id="uf-notes" rows="2">${Helpers.escapeHtml(unit?.notes || '')}</textarea>
  </div>

  <div class="form-actions">
    <button class="btn btn-primary" onclick="saveUnit('${isEdit ? unit.id : ''}')">
      ${isEdit ? t('btn_save') : t('btn_add_unit')}
    </button>
    ${isEdit ? `<button class="btn btn-danger" onclick="deleteUnit('${unit.id}')">${t('btn_delete')}</button>` : ''}
    <button class="btn btn-secondary" onclick="closeDrawer()">${t('btn_cancel')}</button>
  </div>
</div>`;
}

// ══════════════════════════
// حفظ الوحدة (إضافة / تعديل)
// ══════════════════════════
async function saveUnit(unitId = '') {
  if (!requireRole('manage_units')) return;
  const apt        = document.getElementById('uf-apt')?.value.trim();
  const room       = document.getElementById('uf-room')?.value.trim();
  const tenant     = document.getElementById('uf-tenant')?.value.trim();
  const tenant2    = document.getElementById('uf-tenant2')?.value.trim();
  const phone      = document.getElementById('uf-phone')?.value.trim();
  const phone2     = document.getElementById('uf-phone2')?.value.trim();
  const rent       = parseFloat(document.getElementById('uf-rent')?.value) || 0;
  const deposit    = parseFloat(document.getElementById('uf-deposit')?.value) || 0;
  const rent1      = parseFloat(document.getElementById('uf-rent1')?.value) || 0;
  const rent2      = parseFloat(document.getElementById('uf-rent2')?.value) || 0;
  const start      = document.getElementById('uf-start')?.value || null;
  const persons    = parseInt(document.getElementById('uf-persons')?.value) || 1;
  const lang       = document.getElementById('uf-lang')?.value || 'AR';
  const status     = document.getElementById('uf-status')?.value || 'available';
  const notes      = document.getElementById('uf-notes')?.value.trim();
  const buildingId = document.getElementById('uf-building')?.value || null;

  if (Helpers.isEmpty(apt) || Helpers.isEmpty(room)) {
    toast(t('toast_apt_required'), 'error');
    return;
  }

  const payload = {
    building_id:   buildingId || null,
    apartment:     apt,
    room:          room,
    tenant_name:   tenant  || null,
    tenant_name2:  tenant2 || null,
    phone:         phone   || null,
    phone2:        phone2  || null,
    monthly_rent:  rent,
    deposit:       deposit,
    rent1:         rent1,
    rent2:         rent2,
    start_date:    start,
    persons_count: persons,
    language:      lang,
    unit_status:   status,
    is_vacant:     (status === 'available' || status === 'maintenance') && !tenant,
    notes:         notes  || null,
    updated_at:    new Date().toISOString(),
  };

  // units table مش فيها created_by — موجودة في الجداول التانية بس
  // if (ME?.id) payload.created_by = ME.id;

  try {
    let error;
    if (unitId) {
      // تعديل
      ({ error } = await sb.from('units').update(payload).eq('id', unitId));
    } else {
      // إضافة
      ({ error } = await sb.from('units').insert(payload));
    }
    if (error) throw error;

    const action = unitId ? 'edit_unit' : 'add_unit';
    logAction(action, 'units', unitId || null, { apartment: apt, room });
    toast(unitId ? t('toast_unit_saved') : t('toast_unit_added'), 'success');
    closeDrawer();
    loadUnits();
  } catch (err) {
    console.error('saveUnit error:', err);
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════
// حذف الوحدة
// ══════════════════════════
async function deleteUnit(unitId) {
  if (!requireRole('delete')) return;
  if (!confirm(t('btn_confirm_delete'))) return;

  try {
    const { error } = await sb.from('units').delete().eq('id', unitId);
    if (error) throw error;

    logAction('delete_unit', 'units', unitId, { apartment: String(unit?.apartment||''), room: String(unit?.room||'') });
    toast(t('toast_unit_deleted'), 'info');
    closeDrawer();
    loadUnits();
  } catch (err) {
    console.error('deleteUnit error:', err);
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════
// إرسال تذكير إيجار
// ══════════════════════════
function sendRentReminder(unitId) {
  const unit = _allUnits.find(u => u.id === unitId);
  if (!unit || !unit.phone) return;

  const paidMap = {};
  for (const p of _currentMonthPayments) {
    paidMap[p.unit_id] = (paidMap[p.unit_id] || 0) + parseFloat(p.amount || 0);
  }

  const paid      = paidMap[unitId] || 0;
  const required  = parseFloat(unit.monthly_rent || 0);
  const remaining = Math.max(0, required - paid);
  const msg       = Helpers.rentReminderMsg(unit, Helpers.currentMonthFirst(), remaining, unit.language);

  Helpers.openWhatsApp(unit.phone, msg);
}

// ══════════════════════════
// بحث وفلترة
// ══════════════════════════
function setUnitsFilter(filter) {
  _unitsFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.filter-btn[data-filter="${filter}"]`)?.classList.add('active');
  renderUnitsList();
}

function setUnitsSearch(q) {
  _unitsSearch = q;
  renderUnitsList();
}

// ══════════════════════════
// دفع سريع من الوحدة
// ══════════════════════════
function quickPayUnit(unitId) {
  const unit = _allUnits.find(u => u.id === unitId);
  if (!unit) return;

  // الانتقال لتبويب الدفع مع ملء البيانات
  goPanel('pay');
  setTimeout(() => {
    const aptEl  = document.getElementById('pay-apt');
    const roomEl = document.getElementById('pay-room');
    if (aptEl)  aptEl.value  = unit.apartment;
    if (roomEl) roomEl.value = unit.room;
    autoFillRent?.();
  }, 100);
}

// ══════════════════════════
// resetBuildingsCache — تستخدمها reports.js بعد add/edit/delete مبنى
// ══════════════════════════
function resetBuildingsCache() {
  _allBuildings = [];
}

// ══════════════════════════════════════════
// إدارة المباني — Buildings Management
// الوظائف هنا في units.js لأن المباني مرتبطة بالوحدات مباشرة
// ══════════════════════════════════════════
async function openBuildingsManager() {
  openDrawer(`<div class="drawer-loading">${t('loading')}</div>`);
  try {
    const { data: buildings, error } = await sb
      .from('buildings').select('*').order('name');
    if (error) throw error;

    // عدد الوحدات لكل مبنى
    const unitCounts = {};
    _allUnits.forEach(u => {
      if (u.building_id) unitCounts[u.building_id] = (unitCounts[u.building_id] || 0) + 1;
    });

    const list = (buildings || []).map(b => `
<div class="rpt-row">
  <div style="display:flex;flex-direction:column;gap:2px;flex:1">
    <span class="bold">🏢 ${Helpers.escapeHtml(b.name)}</span>
    ${b.address ? `<span class="muted small">📍 ${Helpers.escapeHtml(b.address)}</span>` : ''}
    <span class="muted small">${unitCounts[b.id] || 0} ${t('nav_units').replace(/\s*\S+$/, '')}</span>
  </div>
  <div style="display:flex;gap:6px">
    <button class="icon-btn" onclick="editBuilding('${b.id}','${Helpers.escapeHtml(b.name)}','${Helpers.escapeHtml(b.address||'')}')">✏️</button>
    <button class="icon-btn" onclick="deleteBuilding('${b.id}')">🗑️</button>
  </div>
</div>`).join('');

    openDrawer(`
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>🏢 ${t('manage_buildings')}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>

  <input type="hidden" id="bld-id" value="">
  <div class="form-group">
    <label>${t('building_name_label')}</label>
    <input type="text" id="bld-name" placeholder="${t('building_name_ph')}">
  </div>
  <div class="form-group">
    <label>${t('building_address')}</label>
    <input type="text" id="bld-address" placeholder="${t('building_address_ph')}">
  </div>
  <div class="form-actions">
    <button class="btn btn-primary" onclick="saveBuilding()">${t('btn_save_building')}</button>
    <button class="btn btn-secondary" onclick="clearBuildingForm()">${t('btn_cancel')}</button>
  </div>

  <div class="section-title" style="margin-top:20px">
    ${t('existing_buildings')} (${(buildings||[]).length})
  </div>
  <div id="buildings-list">
    ${list || `<div class="empty-msg">${t('no_buildings_yet')}</div>`}
  </div>
</div>`);
  } catch(err) {
    openDrawer(`<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`);
  }
}

async function saveBuilding() {
  const id      = document.getElementById('bld-id')?.value.trim();
  const name    = document.getElementById('bld-name')?.value.trim();
  const address = document.getElementById('bld-address')?.value.trim();

  if (!name) { toast(t('building_name_required'), 'error'); return; }

  const btn = document.querySelector('[onclick="saveBuilding()"]');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    let error;
    if (id) {
      ({ error } = await sb.from('buildings')
        .update({ name, address: address || null }).eq('id', id));
    } else {
      ({ error } = await sb.from('buildings')
        .insert({ name, address: address || null }));
    }
    if (error) throw error;

    resetBuildingsCache();
    toast(id ? t('toast_building_updated') : t('toast_building_added'), 'success');
    openBuildingsManager(); // تحديث الـ drawer نفسه
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = t('btn_save_building'); }
  }
}

function editBuilding(id, name, address) {
  const idEl   = document.getElementById('bld-id');
  const nameEl = document.getElementById('bld-name');
  const addrEl = document.getElementById('bld-address');
  if (idEl)   idEl.value   = id;
  if (nameEl) nameEl.value = name;
  if (addrEl) addrEl.value = address;
  nameEl?.focus();
  // scroll للأعلى
  nameEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function clearBuildingForm() {
  ['bld-id','bld-name','bld-address'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('bld-name')?.focus();
}

async function deleteBuilding(id) {
  if (!confirm(t('btn_confirm_delete'))) return;

  // تحقق إن مفيش وحدات مرتبطة
  const linked = _allUnits.filter(u => u.building_id === id);
  if (linked.length > 0) {
    toast(`❌ ${t('building_has_units')} (${linked.length})`, 'error');
    return;
  }

  try {
    const { error } = await sb.from('buildings').delete().eq('id', id);
    if (error) throw error;
    resetBuildingsCache();
    toast(t('toast_building_deleted'), 'info');
    openBuildingsManager();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}
