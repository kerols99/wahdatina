// ══════════════════════════════
// units.js — إدارة الوحدات
// ══════════════════════════════

'use strict';

let _allUnits       = [];
let _unitsFilter    = 'all';   // all | paid | partial | unpaid
let _unitsSearch    = '';
let _currentMonthPayments = [];

// ══════════════════════════
// تحميل الوحدات
// ══════════════════════════
async function loadUnits() {
  const container = document.getElementById('units-list');
  if (!container) return;
  container.innerHTML = '<div class="loading">⏳ جاري التحميل...</div>';

  try {
    // جلب الوحدات + مدفوعات الشهر الحالي دفعة واحدة
    const monthFirst = Helpers.currentMonthFirst();

    const [unitsRes, paymentsRes] = await Promise.all([
      sb.from('units').select('*').order('apartment').order('room'),
      sb.from('rent_payments')
        .select('unit_id, apartment, room, amount, tenant_num')
        .eq('payment_month', monthFirst)
    ]);

    if (unitsRes.error)    throw unitsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    _allUnits              = unitsRes.data || [];
    _currentMonthPayments  = paymentsRes.data || [];

    renderUnitsList();
  } catch (err) {
    console.error('loadUnits error:', err);
    container.innerHTML = `<div class="error-msg">❌ حدث خطأ: ${Helpers.escapeHtml(err.message)}</div>`;
  }
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
  let statusLabel = 'شاغرة';

  if (!u.is_vacant) {
    if (paid >= required && required > 0) {
      statusClass = 'status-paid'; statusLabel = 'مدفوع';
    } else if (paid > 0) {
      statusClass = 'status-partial'; statusLabel = 'جزئي';
    } else {
      statusClass = 'status-unpaid'; statusLabel = 'غير مدفوع';
    }
  }

  if (u.unit_status === 'maintenance')   { statusClass = 'status-maint';  statusLabel = 'صيانة'; }
  if (u.unit_status === 'reserved')      { statusClass = 'status-reserved'; statusLabel = 'محجوز'; }
  if (u.unit_status === 'leaving_soon')  { statusClass = 'status-leaving'; statusLabel = 'مغادر قريباً'; }

  const tenantLine = u.tenant_name
    ? `<span class="unit-tenant">${Helpers.escapeHtml(u.tenant_name)}${u.tenant_name2 ? ' + ' + Helpers.escapeHtml(u.tenant_name2) : ''}</span>`
    : `<span class="unit-tenant muted">شاغرة</span>`;

  const payLine = !u.is_vacant && required > 0
    ? `<div class="unit-pay-line">
        <span class="paid-amt">${Helpers.formatAED(paid)}</span>
        <span class="pay-sep"> / </span>
        <span class="req-amt">${Helpers.formatAED(required)}</span>
        ${remaining > 0 ? `<span class="rem-badge">متبقي ${Helpers.formatAED(remaining)}</span>` : ''}
       </div>`
    : '';

  const waBtn = u.phone
    ? `<button class="icon-btn wa-btn" onclick="event.stopPropagation(); Helpers.openWhatsApp('${Helpers.escapeHtml(u.phone)}')" title="واتساب">💬</button>`
    : '';

  const payBtn = !u.is_vacant
    ? `<button class="icon-btn pay-btn" onclick="event.stopPropagation(); quickPayUnit('${u.id}')" title="دفع سريع">💰</button>`
    : '';

  return `
<div class="unit-card" onclick="openUnitDrawer('${u.id}')">
  <div class="unit-card-header">
    <div class="unit-id-block">
      <span class="unit-apt">شقة ${Helpers.escapeHtml(u.apartment)}</span>
      <span class="unit-room">غرفة ${Helpers.escapeHtml(u.room)}</span>
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

  openDrawer(`<div class="drawer-loading">⏳ جاري التحميل...</div>`);

  try {
    // جلب آخر 10 مدفوعات + التأمين
    const [paymentsRes, depositRes] = await Promise.all([
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
        .maybeSingle()
    ]);

    if (paymentsRes.error) throw paymentsRes.error;

    const payments = paymentsRes.data || [];
    const deposit  = depositRes.data;

    const paymentsHtml = payments.length > 0
      ? payments.map(p => `
          <div class="history-row">
            <span>${Helpers.fmtDate(p.payment_date)}</span>
            <span class="muted">${Helpers.fmtMonth(p.payment_month)}</span>
            <span class="green">${Helpers.formatAED(p.amount)}</span>
            <span class="muted">${p.payment_method}</span>
          </div>`).join('')
      : '<div class="muted small">لا توجد مدفوعات مسجّلة</div>';

    const depositHtml = deposit
      ? `<div class="deposit-row">
           <span>التأمين: ${Helpers.formatAED(deposit.amount)}</span>
           <span class="badge badge-${deposit.status === 'held' ? 'amber' : deposit.status === 'refunded' ? 'green' : 'red'}">
             ${deposit.status === 'held' ? 'محتجز' : deposit.status === 'refunded' ? 'مُسترد' : 'مصادر'}
           </span>
           ${deposit.refund_amount > 0 ? `<span class="muted small">مُسترد: ${Helpers.formatAED(deposit.refund_amount)}</span>` : ''}
         </div>`
      : '<div class="muted small">لا يوجد تأمين مسجّل</div>';

    const content = `
<div class="drawer-unit">
  <div class="drawer-unit-header">
    <h2>شقة ${Helpers.escapeHtml(unit.apartment)} — غرفة ${Helpers.escapeHtml(unit.room)}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>

  <div class="info-grid">
    <div class="info-item"><span class="info-label">المستأجر</span><span>${Helpers.escapeHtml(unit.tenant_name || '—')}</span></div>
    ${unit.tenant_name2 ? `<div class="info-item"><span class="info-label">الشريك</span><span>${Helpers.escapeHtml(unit.tenant_name2)}</span></div>` : ''}
    <div class="info-item"><span class="info-label">الهاتف</span><span>${Helpers.escapeHtml(unit.phone || '—')}</span></div>
    ${unit.phone2 ? `<div class="info-item"><span class="info-label">هاتف 2</span><span>${Helpers.escapeHtml(unit.phone2)}</span></div>` : ''}
    <div class="info-item"><span class="info-label">الإيجار</span><span class="green">${Helpers.formatAED(unit.monthly_rent)}</span></div>
    <div class="info-item"><span class="info-label">تاريخ البداية</span><span>${Helpers.fmtDate(unit.start_date)}</span></div>
    <div class="info-item"><span class="info-label">الأشخاص</span><span>${unit.persons_count || 1}</span></div>
    <div class="info-item"><span class="info-label">اللغة</span><span>${unit.language === 'AR' ? 'عربي' : 'إنجليزي'}</span></div>
    ${unit.notes ? `<div class="info-item full"><span class="info-label">ملاحظات</span><span>${Helpers.escapeHtml(unit.notes)}</span></div>` : ''}
  </div>

  <div class="section-title">التأمين</div>
  ${depositHtml}

  <div class="section-title">آخر المدفوعات</div>
  <div class="payments-history">${paymentsHtml}</div>

  <div class="drawer-actions">
    <button class="btn btn-primary" onclick="openEditUnit('${unit.id}')">✏️ تعديل</button>
    <button class="btn btn-success" onclick="closeDrawer(); quickPayUnit('${unit.id}')">💰 دفع</button>
    ${unit.phone ? `<button class="btn btn-whatsapp" onclick="sendRentReminder('${unit.id}')">💬 تذكير</button>` : ''}
    ${!unit.is_vacant ? `<button class="btn btn-warning" onclick="openDepartureForm('${unit.id}')">🚪 مغادرة</button>` : ''}
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
  const unit = _allUnits.find(u => u.id === unitId);
  if (!unit) return;
  openDrawer(buildUnitForm(unit));
}

function buildUnitForm(unit) {
  const isEdit = !!unit;
  const title  = isEdit ? 'تعديل الوحدة' : 'إضافة وحدة جديدة';

  return `
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>${title}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>

  <div class="form-group">
    <label>رقم الشقة *</label>
    <input type="text" id="uf-apt" value="${Helpers.escapeHtml(unit?.apartment || '')}" placeholder="مثال: 101">
  </div>
  <div class="form-group">
    <label>رقم الغرفة/البارتشن *</label>
    <input type="text" id="uf-room" value="${Helpers.escapeHtml(unit?.room || '')}" placeholder="مثال: A">
  </div>
  <div class="form-group">
    <label>اسم المستأجر</label>
    <input type="text" id="uf-tenant" value="${Helpers.escapeHtml(unit?.tenant_name || '')}" placeholder="الاسم الكامل">
  </div>
  <div class="form-group">
    <label>اسم الشريك</label>
    <input type="text" id="uf-tenant2" value="${Helpers.escapeHtml(unit?.tenant_name2 || '')}" placeholder="اختياري">
  </div>
  <div class="form-group">
    <label>رقم الهاتف</label>
    <input type="tel" id="uf-phone" value="${Helpers.escapeHtml(unit?.phone || '')}" placeholder="+971XXXXXXXXX">
  </div>
  <div class="form-group">
    <label>هاتف الشريك</label>
    <input type="tel" id="uf-phone2" value="${Helpers.escapeHtml(unit?.phone2 || '')}" placeholder="اختياري">
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>الإيجار الشهري</label>
      <input type="number" id="uf-rent" value="${unit?.monthly_rent || ''}" placeholder="0">
    </div>
    <div class="form-group">
      <label>التأمين</label>
      <input type="number" id="uf-deposit" value="${unit?.deposit || ''}" placeholder="0">
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>إيجار مستأجر 1</label>
      <input type="number" id="uf-rent1" value="${unit?.rent1 || ''}" placeholder="0">
    </div>
    <div class="form-group">
      <label>إيجار مستأجر 2</label>
      <input type="number" id="uf-rent2" value="${unit?.rent2 || ''}" placeholder="0">
    </div>
  </div>
  <div class="form-group">
    <label>تاريخ البداية</label>
    <input type="date" id="uf-start" value="${unit?.start_date || ''}">
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>عدد الأشخاص</label>
      <input type="number" id="uf-persons" value="${unit?.persons_count || 1}" min="1" max="10">
    </div>
    <div class="form-group">
      <label>اللغة</label>
      <select id="uf-lang">
        <option value="AR" ${(unit?.language || 'AR') === 'AR' ? 'selected' : ''}>عربي</option>
        <option value="EN" ${unit?.language === 'EN' ? 'selected' : ''}>English</option>
      </select>
    </div>
  </div>
  <div class="form-group">
    <label>حالة الوحدة</label>
    <select id="uf-status">
      <option value="available"     ${(unit?.unit_status || 'available') === 'available'    ? 'selected' : ''}>متاحة</option>
      <option value="occupied"      ${unit?.unit_status === 'occupied'     ? 'selected' : ''}>مشغولة</option>
      <option value="reserved"      ${unit?.unit_status === 'reserved'     ? 'selected' : ''}>محجوزة</option>
      <option value="maintenance"   ${unit?.unit_status === 'maintenance'  ? 'selected' : ''}>صيانة</option>
      <option value="leaving_soon"  ${unit?.unit_status === 'leaving_soon' ? 'selected' : ''}>مغادر قريباً</option>
    </select>
  </div>
  <div class="form-group">
    <label>ملاحظات</label>
    <textarea id="uf-notes" rows="2">${Helpers.escapeHtml(unit?.notes || '')}</textarea>
  </div>

  <div class="form-actions">
    <button class="btn btn-primary" onclick="saveUnit('${isEdit ? unit.id : ''}')">
      ${isEdit ? '💾 حفظ التعديلات' : '➕ إضافة الوحدة'}
    </button>
    ${isEdit ? `<button class="btn btn-danger" onclick="deleteUnit('${unit.id}')">🗑️ حذف</button>` : ''}
    <button class="btn btn-secondary" onclick="closeDrawer()">إلغاء</button>
  </div>
</div>`;
}

// ══════════════════════════
// حفظ الوحدة (إضافة / تعديل)
// ══════════════════════════
async function saveUnit(unitId = '') {
  const apt     = document.getElementById('uf-apt')?.value.trim();
  const room    = document.getElementById('uf-room')?.value.trim();
  const tenant  = document.getElementById('uf-tenant')?.value.trim();
  const tenant2 = document.getElementById('uf-tenant2')?.value.trim();
  const phone   = document.getElementById('uf-phone')?.value.trim();
  const phone2  = document.getElementById('uf-phone2')?.value.trim();
  const rent    = parseFloat(document.getElementById('uf-rent')?.value) || 0;
  const deposit = parseFloat(document.getElementById('uf-deposit')?.value) || 0;
  const rent1   = parseFloat(document.getElementById('uf-rent1')?.value) || 0;
  const rent2   = parseFloat(document.getElementById('uf-rent2')?.value) || 0;
  const start   = document.getElementById('uf-start')?.value || null;
  const persons = parseInt(document.getElementById('uf-persons')?.value) || 1;
  const lang    = document.getElementById('uf-lang')?.value || 'AR';
  const status  = document.getElementById('uf-status')?.value || 'available';
  const notes   = document.getElementById('uf-notes')?.value.trim();

  if (Helpers.isEmpty(apt) || Helpers.isEmpty(room)) {
    toast('رقم الشقة والغرفة مطلوبان', 'error');
    return;
  }

  const payload = {
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

  if (ME?.id) payload.created_by = ME.id;

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

    toast(unitId ? '✅ تم حفظ التعديلات' : '✅ تمت إضافة الوحدة', 'success');
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
  if (!confirm('هل أنت متأكد من حذف هذه الوحدة؟ سيتم حذف كل البيانات المرتبطة بها.')) return;

  try {
    const { error } = await sb.from('units').delete().eq('id', unitId);
    if (error) throw error;

    toast('🗑️ تم حذف الوحدة', 'info');
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
