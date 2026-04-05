// ══════════════════════════════════════════
// moves.js — التنقلات الكاملة (المرحلة 3)
// 4 تبويبات: مغادرون / حجوزات / نقل داخلي / رسالة ترحيب
// ══════════════════════════════════════════
'use strict';

let _movesTab = 'departures';

// ══════════════════════════════════════════
// archiveUnitToHistory — ⭐ الأهم في المشروع
// لازم تتكال أول حاجة قبل أي تغيير للوحدة
// لو فشلت → throw error (مش تكمّل أبداً)
// ══════════════════════════════════════════
async function archiveUnitToHistory(unitId, endDate, snapshotType) {
  // 1. جيب البيانات الحالية
  const { data: curr, error: fetchErr } = await sb
    .from('units').select('*').eq('id', unitId).maybeSingle();
  if (fetchErr) throw new Error(`archiveUnitToHistory fetch: ${fetchErr.message}`);
  if (!curr)    throw new Error(`Unit ${unitId} not found`);

  // 2. تجاهل لو الوحدة فاضية — مفيش مستأجر يتحفظ
  if (curr.is_vacant || !curr.tenant_name) {
    console.log(`archiveUnitToHistory: unit ${curr.apartment}/${curr.room} is vacant — skipped`);
    return;
  }

  // 3. حفظ الـ snapshot
  const { error: histErr } = await sb.from('unit_history').insert({
    unit_id:       unitId,
    apartment:     String(curr.apartment),  // Q1: TEXT دايماً
    room:          String(curr.room),       // Q1: TEXT دايماً
    tenant_name:   curr.tenant_name,
    tenant_name2:  curr.tenant_name2  || null,
    phone:         curr.phone         || null,
    phone2:        curr.phone2        || null,
    monthly_rent:  curr.monthly_rent  || 0,
    deposit:       curr.deposit       || 0,
    start_date:    curr.start_date    || null,
    end_date:      endDate            || Helpers.today(),
    snapshot_type: snapshotType,            // 'departure' | 'transfer' | 'manual'
    recorded_by:   ME?.id             || null,
  });

  // 4. لو فشل الحفظ → وقّف كل حاجة (مش console.warn)
  if (histErr) throw new Error(`Failed to archive unit history: ${histErr.message}`);

  console.log(`✅ unit_history saved: ${curr.apartment}/${curr.room} — ${curr.tenant_name}`);
}

// ══════════════════════════════════════════
// Helper: findUnitId بـ apt+room مع تحديث move
// ══════════════════════════════════════════
async function findUnitId(apt, room, moveId) {
  const { data: f, error } = await sb
    .from('units').select('id')
    .eq('apartment', String(apt))  // Q1
    .eq('room', String(room))      // Q1
    .maybeSingle();
  if (error) throw error;
  if (!f) throw new Error(`Unit not found: ${apt}/${room}`);
  // Q7: حدّث الـ move بالـ unit_id الصح
  if (moveId) {
    await sb.from('moves').update({ unit_id: f.id }).eq('id', moveId);
  }
  return f.id;
}

// ─────────────────────────────────────────
// loadMoves — تحميل شاشة التنقلات
// ─────────────────────────────────────────
function loadMoves() {
  const container = document.getElementById('moves-content');
  if (!container) return;
  container.innerHTML = `
<div class="pay-tabs" id="moves-tabs">
  <button class="pay-tab-btn active" data-tab="departures" onclick="switchMovesTab('departures')">${t('moves_departures')}</button>
  <button class="pay-tab-btn" data-tab="arrivals"   onclick="switchMovesTab('arrivals')">${t('moves_arrivals')}</button>
  <button class="pay-tab-btn" data-tab="transfers"  onclick="switchMovesTab('transfers')">${t('moves_internal')}</button>
  <button class="pay-tab-btn" data-tab="welcome"    onclick="switchMovesTab('welcome')">${t('moves_welcome')}</button>
</div>
<div id="moves-tab-content"></div>`;

  switchMovesTab('departures');
}

function switchMovesTab(tab) {
  _movesTab = tab;
  document.querySelectorAll('#moves-tabs .pay-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const c = document.getElementById('moves-tab-content');
  if (!c) return;
  c.innerHTML = `<div class="loading">${t('loading')}</div>`;
  if      (tab === 'departures') loadDepartures();
  else if (tab === 'arrivals')   loadArrivals();
  else if (tab === 'transfers')  loadTransfers();
  else if (tab === 'welcome')    renderWelcomeLetter();
}

// ══════════════════════════════════════════
// تبويب أ — المغادرون
// ══════════════════════════════════════════
async function loadDepartures() {
  const c = document.getElementById('moves-tab-content');
  try {
    const [movesRes, unitsRes] = await Promise.all([
      sb.from('moves').select('*').eq('type','depart').eq('status','pending').order('move_date'),
      sb.from('units').select('id,is_vacant,unit_status'),
    ]);
    if (movesRes.error) throw movesRes.error;

    const moves   = movesRes.data || [];
    const units   = unitsRes.data || [];
    const vacant  = units.filter(u => u.is_vacant).length;
    const booked  = units.filter(u => u.unit_status==='reserved').length;

    c.innerHTML = `
<div class="moves-summary">
  <div class="moves-stat"><span class="stat-val stat-amber">${moves.length}</span><span class="stat-lbl">${t('departures_count')}</span></div>
  <div class="moves-stat"><span class="stat-val stat-muted">${vacant}</span><span class="stat-lbl">${t('stat_vacant')}</span></div>
  <div class="moves-stat"><span class="stat-val stat-blue">${booked}</span><span class="stat-lbl">${t('stat_reserved')}</span></div>
</div>

<div style="display:flex;gap:8px;margin-bottom:14px">
  <button class="add-unit-btn" style="flex:1;margin-bottom:0" onclick="openDepartureForm(null)">${t('btn_register_departure')}</button>
  <button class="btn btn-secondary" onclick="exportDeparturePDF()" style="white-space:nowrap;padding:10px 14px">🖨 PDF</button>
</div>

${moves.length === 0
  ? `<div class="empty-msg">${t('no_departures')}</div>`
  : moves.map(m => `
<div class="move-card">
  <div class="move-card-header">
    <div>
      <span class="unit-apt">${t('apt_label')} ${Helpers.escapeHtml(m.apartment)}</span>
      <span class="unit-room"> — ${t('room_label')} ${Helpers.escapeHtml(m.room)}</span>
    </div>
    <span class="status-badge status-amber">${Helpers.fmtDate(m.move_date)}</span>
  </div>
  <div class="move-tenant">${Helpers.escapeHtml(m.tenant_name || '—')}</div>
  ${m.notes ? `<div class="muted small">${Helpers.escapeHtml(m.notes)}</div>` : ''}
  <div class="move-actions">
    <button class="btn btn-success" onclick="confirmDeparture('${m.id}')">${t('btn_confirm_departure')}</button>
    <button class="btn btn-danger"  onclick="cancelMove('${m.id}')">${t('btn_cancel')}</button>
  </div>
</div>`).join('')
}`;
  } catch(err) {
    c.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

// فورم تسجيل مغادرة
function openDepartureForm(unitId) {
  let prefillApt = '', prefillRoom = '', prefillName = '';
  if (unitId && window._allUnits) {
    const u = window._allUnits.find(x => x.id === unitId);
    if (u) { prefillApt = u.apartment; prefillRoom = u.room; prefillName = u.tenant_name || ''; }
  }
  openDrawer(`
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>${t('btn_register_departure')}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>${t('pay_apt')}</label>
      <input type="text" id="dep-form-apt" value="${Helpers.escapeHtml(prefillApt)}" placeholder="101">
    </div>
    <div class="form-group">
      <label>${t('pay_room')}</label>
      <input type="text" id="dep-form-room" value="${Helpers.escapeHtml(prefillRoom)}" placeholder="A">
    </div>
  </div>
  <div class="form-group">
    <label>${t('drawer_tenant')}</label>
    <input type="text" id="dep-form-name" value="${Helpers.escapeHtml(prefillName)}">
  </div>
  <div class="form-group">
    <label>${t('move_date')}</label>
    <input type="date" id="dep-form-date" value="${Helpers.today()}">
  </div>
  <div class="form-group">
    <label>${t('drawer_notes')}</label>
    <textarea id="dep-form-notes" rows="2"></textarea>
  </div>
  <div class="form-actions">
    <button class="btn btn-primary" onclick="saveDepartureEntry()">${t('btn_save_departure')}</button>
    <button class="btn btn-secondary" onclick="closeDrawer()">${t('btn_cancel')}</button>
  </div>
</div>`);
}

async function saveDepartureEntry() {
  if (!requireRole('manage_moves')) return;
  const apt   = document.getElementById('dep-form-apt')?.value.trim();
  const room  = document.getElementById('dep-form-room')?.value.trim();
  const name  = document.getElementById('dep-form-name')?.value.trim();
  const date  = document.getElementById('dep-form-date')?.value;
  const notes = document.getElementById('dep-form-notes')?.value.trim();

  if (!apt || !room) { toast(t('toast_apt_required'), 'error'); return; }

  try {
    // Q7: جيب unit_id
    const { data: unit } = await sb.from('units').select('id').eq('apartment', String(apt)).eq('room', String(room)).maybeSingle();

    const { error } = await sb.from('moves').insert({
      type:        'depart',
      unit_id:     unit?.id || null,
      apartment:   String(apt),  // Q1
      room:        String(room), // Q1
      tenant_name: name || null,
      move_date:   date || Helpers.today(),
      status:      'pending',
      notes:       notes || null,
      created_by:  ME?.id || null,
    });
    if (error) throw error;

    // تحديث حالة الوحدة
    if (unit?.id) {
      const { error: uStatusErr } = await sb.from('units')
        .update({ unit_status: 'leaving_soon', updated_at: new Date().toISOString() })
        .eq('id', unit.id);
      if (uStatusErr) console.warn('leaving_soon update:', uStatusErr.message);
    }

    toast(t('toast_departure_saved'), 'success');
    closeDrawer();
    loadDepartures();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

async function confirmDeparture(moveId) {
  try {
    const { data: move, error: mErr } = await sb
      .from('moves').select('*').eq('id', moveId).maybeSingle();
    if (mErr) throw mErr;
    if (!move) return;

    // Q7: جيب unit_id مع fallback
    let unitId = move.unit_id;
    if (!unitId) unitId = await findUnitId(move.apartment, move.room, moveId);

    // ⭐ أول حاجة: حفظ التاريخ — لو فشل نوقف كل حاجة
    await archiveUnitToHistory(unitId, move.move_date || Helpers.today(), 'departure');

    // بعدين: إفراغ الوحدة
    const { error: uErr } = await sb.from('units').update({
      tenant_name: null, tenant_name2: null,
      phone: null, phone2: null,
      monthly_rent: 0, deposit: 0,
      persons_count: 1, start_date: null,
      is_vacant: true, unit_status: 'available',
      updated_at: new Date().toISOString(),
    }).eq('id', unitId);
    if (uErr) throw uErr;

    const { error: dErr } = await sb
      .from('moves').update({ status: 'done' }).eq('id', moveId);
    if (dErr) throw dErr;

    logAction('departure', 'moves', moveId, { apartment: move.apartment, room: move.room, tenant: move.tenant_name });
    toast(t('toast_departure_confirmed'), 'success');
    loadDepartures();
    loadHome();
  } catch(err) {
    console.error('confirmDeparture:', err);
    toast(`❌ ${err.message}`, 'error');
  }
}

async function cancelMove(moveId) {
  if (!confirm(t('confirm_cancel_move'))) return;
  try {
    const { error } = await sb.from('moves').update({ status: 'cancelled' }).eq('id', moveId);
    if (error) throw error;
    toast(t('toast_move_cancelled'), 'info');
    if (_movesTab === 'departures') loadDepartures();
    else loadArrivals();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════
// تبويب ب — الحجوزات الجديدة
// ══════════════════════════════════════════
async function loadArrivals() {
  const c = document.getElementById('moves-tab-content');
  try {
    const [movesRes, unitsRes] = await Promise.all([
      sb.from('moves').select('*').eq('type','arrive').eq('status','pending').order('new_start_date'),
      sb.from('units').select('id,is_vacant,unit_status'),
    ]);
    if (movesRes.error) throw movesRes.error;

    const moves   = movesRes.data || [];
    const units   = unitsRes.data || [];
    const vacant  = units.filter(u => u.is_vacant).length;
    const booked  = units.filter(u => u.unit_status==='reserved').length;
    const freeVac = vacant - booked;

    c.innerHTML = `
<div class="moves-summary">
  <div class="moves-stat"><span class="stat-val stat-blue">${booked}</span><span class="stat-lbl">${t('stat_reserved')}</span></div>
  <div class="moves-stat"><span class="stat-val stat-muted">${vacant}</span><span class="stat-lbl">${t('stat_vacant')}</span></div>
  <div class="moves-stat"><span class="stat-val stat-green">${freeVac}</span><span class="stat-lbl">${t('free_vacant')}</span></div>
</div>

<button class="add-unit-btn" onclick="openArrivalForm()">${t('btn_new_booking')}</button>

${moves.length === 0
  ? `<div class="empty-msg">${t('no_bookings')}</div>`
  : moves.map(m => `
<div class="move-card">
  <div class="move-card-header">
    <div>
      <span class="unit-apt">${t('apt_label')} ${Helpers.escapeHtml(m.apartment)}</span>
      <span class="unit-room"> — ${t('room_label')} ${Helpers.escapeHtml(m.room)}</span>
    </div>
    <span class="status-badge status-reserved">${Helpers.fmtDate(m.new_start_date)}</span>
  </div>
  <div class="move-tenant">${Helpers.escapeHtml(m.new_tenant_name || '—')}</div>
  <div class="move-meta muted small">
    ${m.new_phone ? `📞 ${Helpers.escapeHtml(m.new_phone)}` : ''}
    ${m.new_rent  ? ` • ${Helpers.formatAED(m.new_rent)}` : ''}
    ${m.new_persons ? ` • ${m.new_persons} 👤` : ''}
  </div>
  <div class="move-actions">
    <button class="btn btn-success" onclick="confirmArrival('${m.id}')">${t('btn_confirm_arrival')}</button>
    <button class="btn btn-danger"  onclick="cancelMove('${m.id}')">${t('btn_cancel')}</button>
  </div>
</div>`).join('')
}`;
  } catch(err) {
    c.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

function openArrivalForm() {
  openDrawer(`
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>${t('btn_new_booking')}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>
  <div class="form-row">
    <div class="form-group"><label>${t('pay_apt')}</label><input type="text" id="arr-apt" placeholder="101"></div>
    <div class="form-group"><label>${t('pay_room')}</label><input type="text" id="arr-room" placeholder="A"></div>
  </div>
  <div class="form-group"><label>${t('uf_tenant')}</label><input type="text" id="arr-name"></div>
  <div class="form-group"><label>${t('uf_phone')}</label><input type="tel" id="arr-phone" placeholder="+971"></div>
  <div class="form-row">
    <div class="form-group"><label>${t('uf_rent')}</label><input type="number" id="arr-rent" placeholder="0"></div>
    <div class="form-group"><label>${t('uf_deposit')}</label><input type="number" id="arr-deposit" placeholder="0"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>${t('uf_persons')}</label><input type="number" id="arr-persons" value="1" min="1"></div>
    <div class="form-group"><label>${t('uf_language')}</label>
      <select id="arr-lang">
        <option value="AR">${t('uf_lang_ar')}</option>
        <option value="EN">${t('uf_lang_en')}</option>
      </select>
    </div>
  </div>
  <div class="form-group"><label>${t('move_date')}</label><input type="date" id="arr-date" value="${Helpers.today()}"></div>
  <div class="form-group"><label>${t('drawer_notes')}</label><textarea id="arr-notes" rows="2"></textarea></div>
  <div class="form-actions">
    <button class="btn btn-primary" onclick="saveArrivalEntry()">${t('btn_save_booking')}</button>
    <button class="btn btn-secondary" onclick="closeDrawer()">${t('btn_cancel')}</button>
  </div>
</div>`);
}

async function saveArrivalEntry() {
  if (!requireRole('manage_moves')) return;
  const apt     = document.getElementById('arr-apt')?.value.trim();
  const room    = document.getElementById('arr-room')?.value.trim();
  const name    = document.getElementById('arr-name')?.value.trim();
  const phone   = document.getElementById('arr-phone')?.value.trim();
  const rent    = parseFloat(document.getElementById('arr-rent')?.value) || 0;
  const deposit = parseFloat(document.getElementById('arr-deposit')?.value) || 0;
  const persons = parseInt(document.getElementById('arr-persons')?.value) || 1;
  const lang    = document.getElementById('arr-lang')?.value || 'AR';
  const date    = document.getElementById('arr-date')?.value;
  const notes   = document.getElementById('arr-notes')?.value.trim();

  if (!apt || !room) { toast(t('toast_apt_required'), 'error'); return; }
  if (!name)         { toast(t('toast_name_required'), 'error'); return; }

  try {
    // Q7: جيب unit_id
    const { data: unit } = await sb.from('units').select('id').eq('apartment', String(apt)).eq('room', String(room)).maybeSingle();

    const isToday = date <= Helpers.today();
    const status  = isToday ? 'pending' : 'pending'; // دايماً pending — activateScheduled هتفعّل

    const { error: mErr } = await sb.from('moves').insert({
      type: 'arrive', unit_id: unit?.id || null,
      apartment: String(apt), room: String(room), // Q1
      new_tenant_name: name, new_phone: phone || null,
      new_rent: rent, new_deposit: deposit,
      new_persons: persons, new_start_date: date || Helpers.today(),
      language: lang, status,
      notes: notes || null, created_by: ME?.id || null,
    });
    if (mErr) throw mErr;

    // تسجيل عربون مؤقت فوراً
    if (deposit > 0 && unit?.id) {
      const { error: depErr } = await sb.from('deposits').insert({
        unit_id: unit.id, apartment: String(apt), room: String(room),
        tenant_name: name, amount: deposit, status: 'held',
        notes: 'عربون حجز', deposit_received_date: Helpers.today(),
        created_by: ME?.id || null,
      });
      if (depErr) console.warn('عربون insert:', depErr.message);

      // تحديث حالة الوحدة لمحجوزة
      const { error: resErr } = await sb.from('units')
        .update({ unit_status: 'reserved', updated_at: new Date().toISOString() })
        .eq('id', unit.id);
      if (resErr) console.warn('reserved update:', resErr.message);
    }

    toast(t('toast_booking_saved'), 'success');
    closeDrawer();

    // لو التاريخ اليوم أو قبل، فعّل فوراً
    if (isToday) {
      window._schedulerRan = false;
      await activateScheduled();
    }
    loadArrivals();
    loadHome();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

async function confirmArrival(moveId) {
  try {
    const { data: move } = await sb.from('moves').select('*').eq('id', moveId).maybeSingle();
    if (!move) return;
    window._schedulerRan = false;
    await _activateOneArrival(move);
    logAction('arrival', 'moves', moveId, { apartment: move.apartment, room: move.room, tenant: move.new_tenant_name });
    toast(t('toast_arrival_confirmed'), 'success');
    loadArrivals();
    loadHome();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════
// تبويب ج — النقل الداخلي
// ══════════════════════════════════════════
async function loadTransfers() {
  const c = document.getElementById('moves-tab-content');
  try {
    const { data: transfers, error } = await sb
      .from('internal_transfers').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    const pending  = (transfers||[]).filter(t => !t.is_executed);
    const executed = (transfers||[]).filter(t => t.is_executed);

    c.innerHTML = `
<button class="add-unit-btn" onclick="openTransferForm()">${t('btn_new_transfer')}</button>

${pending.length > 0 ? `<div class="section-title">${t('transfers_pending')}</div>
${pending.map(tr => `
<div class="move-card">
  <div class="move-card-header">
    <span>${t('apt_label')} ${Helpers.escapeHtml(tr.from_snapshot?.apartment||'?')} ${t('room_label')} ${Helpers.escapeHtml(tr.from_snapshot?.room||'?')} → ${t('apt_label')} ${Helpers.escapeHtml(tr.to_snapshot?.apartment||'?')} ${t('room_label')} ${Helpers.escapeHtml(tr.to_snapshot?.room||'?')}</span>
    <span class="status-badge ${tr.is_scheduled ? 'status-reserved' : 'status-partial'}">${tr.is_scheduled ? Helpers.fmtDate(tr.transfer_date) : t('transfer_immediate')}</span>
  </div>
  <div class="muted small">${Helpers.escapeHtml(tr.from_snapshot?.tenant_name||'—')}</div>
  <div class="move-actions">
    <button class="btn btn-success" onclick="executeTransferNow('${tr.id}')">${t('btn_execute_now')}</button>
    <button class="btn btn-danger"  onclick="deleteTransfer('${tr.id}')">${t('btn_cancel')}</button>
  </div>
</div>`).join('')}` : ''}

${executed.length > 0 ? `<div class="section-title">${t('transfers_done')}</div>
${executed.slice(0,5).map(tr => `
<div class="move-card" style="opacity:.7">
  <div class="move-card-header">
    <span>${t('apt_label')} ${Helpers.escapeHtml(tr.from_snapshot?.apartment||'?')} → ${t('apt_label')} ${Helpers.escapeHtml(tr.to_snapshot?.apartment||'?')}</span>
    <span class="status-badge status-paid">${Helpers.fmtDate(tr.transfer_date)}</span>
  </div>
  <div class="move-actions">
    <button class="btn btn-secondary" onclick="revertTransfer('${tr.id}')">${t('btn_revert')}</button>
  </div>
</div>`).join('')}` : ''}

${pending.length === 0 && executed.length === 0 ? `<div class="empty-msg">${t('no_transfers')}</div>` : ''}`;
  } catch(err) {
    c.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

function openTransferForm() {
  openDrawer(`
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>${t('btn_new_transfer')}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>
  <div class="section-title">${t('transfer_from')}</div>
  <div class="form-row">
    <div class="form-group"><label>${t('pay_apt')}</label><input type="text" id="tr-from-apt" placeholder="101" onblur="transferAutoFill('from')"></div>
    <div class="form-group"><label>${t('pay_room')}</label><input type="text" id="tr-from-room" placeholder="A" onblur="transferAutoFill('from')"></div>
  </div>
  <div id="tr-from-info" class="muted small" style="margin-bottom:10px"></div>
  <div class="section-title">${t('transfer_to')}</div>
  <div class="form-row">
    <div class="form-group"><label>${t('pay_apt')}</label><input type="text" id="tr-to-apt" placeholder="102" onblur="transferAutoFill('to')"></div>
    <div class="form-group"><label>${t('pay_room')}</label><input type="text" id="tr-to-room" placeholder="B" onblur="transferAutoFill('to')"></div>
  </div>
  <div id="tr-to-info" class="muted small" style="margin-bottom:10px"></div>
  <div class="form-row">
    <div class="form-group">
      <label>${t('transfer_type')}</label>
      <select id="tr-type" onchange="document.getElementById('tr-date-wrap').style.display=this.value==='scheduled'?'block':'none'">
        <option value="immediate">${t('transfer_immediate')}</option>
        <option value="scheduled">${t('transfer_scheduled')}</option>
      </select>
    </div>
  </div>
  <div id="tr-date-wrap" style="display:none">
    <div class="form-group"><label>${t('move_date')}</label><input type="date" id="tr-date" value="${Helpers.today()}"></div>
  </div>
  <div class="form-group"><label>${t('drawer_notes')}</label><textarea id="tr-notes" rows="2"></textarea></div>
  <div class="form-actions">
    <button class="btn btn-primary" onclick="saveTransfer()">${t('btn_save_transfer')}</button>
    <button class="btn btn-secondary" onclick="closeDrawer()">${t('btn_cancel')}</button>
  </div>
</div>`);
}

async function transferAutoFill(side) {
  const apt  = document.getElementById(`tr-${side}-apt`)?.value.trim();
  const room = document.getElementById(`tr-${side}-room`)?.value.trim();
  const info = document.getElementById(`tr-${side}-info`);
  if (!apt || !room || !info) return;
  try {
    const { data, error } = await sb.from('units').select('tenant_name, monthly_rent, is_vacant')
      .eq('apartment', String(apt)).eq('room', String(room)).maybeSingle();
    if (error) throw error;
    info.textContent = data
      ? (data.is_vacant
          ? `✅ ${t('vacant_label')}`
          : `👤 ${data.tenant_name || '—'} • ${Helpers.formatAED(data.monthly_rent)}`)
      : t('unit_not_found');
  } catch(err) {
    if (info) info.textContent = `❌ ${err.message}`;
  }
}

async function saveTransfer() {
  if (!requireRole('manage_moves')) return;
  const fromApt  = document.getElementById('tr-from-apt')?.value.trim();
  const fromRoom = document.getElementById('tr-from-room')?.value.trim();
  const toApt    = document.getElementById('tr-to-apt')?.value.trim();
  const toRoom   = document.getElementById('tr-to-room')?.value.trim();
  const type     = document.getElementById('tr-type')?.value;
  const date     = document.getElementById('tr-date')?.value || Helpers.today();
  const notes    = document.getElementById('tr-notes')?.value.trim();

  if (!fromApt || !fromRoom || !toApt || !toRoom) { toast(t('toast_apt_required'), 'error'); return; }

  try {
    const [fromRes, toRes] = await Promise.all([
      sb.from('units').select('*').eq('apartment', String(fromApt)).eq('room', String(fromRoom)).maybeSingle(),
      sb.from('units').select('*').eq('apartment', String(toApt)).eq('room', String(toRoom)).maybeSingle(),
    ]);
    if (!fromRes.data) { toast(t('unit_not_found'), 'error'); return; }
    if (!toRes.data)   { toast(t('unit_not_found'), 'error'); return; }

    const fromSnap = fromRes.data;
    const toSnap   = toRes.data;
    const isScheduled = type === 'scheduled';

    const { error } = await sb.from('internal_transfers').insert({
      from_unit_id: fromSnap.id, to_unit_id: toSnap.id,
      from_snapshot: fromSnap, to_snapshot: toSnap,
      transfer_date: date,
      is_scheduled: isScheduled, is_executed: false,
      notes: notes || null, created_by: ME?.id || null,
    });
    if (error) throw error;

    // فوري → نفّذ مباشرة
    if (!isScheduled) {
      const { data: tr } = await sb.from('internal_transfers').select('*').order('created_at', {ascending:false}).limit(1).maybeSingle();
      if (tr) await _executeScheduledTransfer(tr);
    }

    toast(t('toast_transfer_saved'), 'success');
    closeDrawer();
    loadTransfers();
    loadHome();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

async function executeTransferNow(trId) {
  try {
    const { data: tr } = await sb.from('internal_transfers').select('*').eq('id', trId).maybeSingle();
    if (!tr) return;
    await _executeScheduledTransfer(tr);
    toast(t('toast_transfer_done'), 'success');
    loadTransfers();
    loadHome();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

async function revertTransfer(trId) {
  if (!confirm(t('confirm_revert_transfer'))) return;
  try {
    const { data: tr } = await sb.from('internal_transfers').select('*').eq('id', trId).maybeSingle();
    if (!tr || !tr.from_snapshot || !tr.to_snapshot) return;

    // ارجع الـ snapshots لأماكنها
    if (tr.from_unit_id) {
      const { error: e1 } = await sb.from('units')
        .update({ ...tr.from_snapshot, updated_at: new Date().toISOString() })
        .eq('id', tr.from_unit_id);
      if (e1) throw e1;
    }
    if (tr.to_unit_id) {
      const { error: e2 } = await sb.from('units')
        .update({ ...tr.to_snapshot, updated_at: new Date().toISOString() })
        .eq('id', tr.to_unit_id);
      if (e2) throw e2;
    }
    const { error: e3 } = await sb.from('internal_transfers')
      .update({ is_executed: false }).eq('id', trId);
    if (e3) throw e3;

    toast(t('toast_transfer_reverted'), 'success');
    loadTransfers();
    loadHome();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

async function deleteTransfer(trId) {
  if (!confirm(t('btn_confirm_delete'))) return;
  try {
    const { error } = await sb.from('internal_transfers').delete().eq('id', trId);
    if (error) throw error;
    toast(t('toast_move_cancelled'), 'info');
    loadTransfers();
  } catch(err) {
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════════════════════
// تبويب د — رسالة الترحيب
// ══════════════════════════════════════════
function renderWelcomeLetter() {
  const c = document.getElementById('moves-tab-content');
  c.innerHTML = `
<div class="welcome-form">
  <div class="form-row">
    <div class="form-group"><label>${t('uf_tenant')}</label><input type="text" id="wl-name" placeholder="${t('uf_tenant_ph')}"></div>
    <div class="form-group"><label>${t('uf_phone')}</label><input type="tel" id="wl-phone" placeholder="+971"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>${t('pay_apt')}</label><input type="text" id="wl-apt" placeholder="101"></div>
    <div class="form-group"><label>${t('pay_room')}</label><input type="text" id="wl-room" placeholder="A"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>${t('uf_rent')}</label><input type="number" id="wl-rent" placeholder="2500"></div>
    <div class="form-group"><label>${t('uf_deposit')}</label><input type="number" id="wl-deposit" placeholder="2500"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>${t('uf_start')}</label><input type="date" id="wl-date" value="${Helpers.today()}"></div>
    <div class="form-group"><label>${t('uf_persons')}</label><input type="number" id="wl-persons" value="1" min="1"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>${t('building_name')}</label><input type="text" id="wl-building" placeholder="Al Barsha 1"></div>
    <div class="form-group"><label>${t('id_number')}</label><input type="text" id="wl-id" placeholder="784-..."></div>
  </div>
  <div class="form-actions">
    <button class="btn btn-primary"  onclick="previewWelcomeLetter()">${t('btn_preview')}</button>
    <button class="btn btn-success"  onclick="printWelcomeLetter()">${t('btn_print')}</button>
    <button class="btn btn-whatsapp" onclick="sendWelcomeWhatsApp()" id="wl-wa-btn">💬 WhatsApp</button>
  </div>
</div>
<div id="wl-preview" style="display:none;margin-top:20px"></div>`;
}

function buildWelcomeHTML(data) {
  const rules = [
    ['Booking Deposit / العربون',            'Deposit is required to confirm booking. / التأمين مطلوب لتأكيد الحجز.'],
    ['Cancellation / الإلغاء',               'Cancellation forfeits booking deposit. / الإلغاء يُسقط العربون.'],
    ['Refund Rule / استرداد التأمين',         'Full refund if notice before 15th. / استرداد كامل عند الإبلاغ قبل اليوم 15.'],
    ['Visits / الزيارات',                    'No overnight visitors allowed. / ممنوع الزيارات بالمبيت.'],
    ['Extended Stay / التمديد',              'Notify management 2 weeks before. / أبلغ الإدارة قبل أسبوعين.'],
    ['Last Month / آخر شهر',                 'Last month rent is not a replacement for deposit. / آخر شهر لا يُعوّض التأمين.'],
    ['Deposit Timing / موعد الاسترداد',      'Deposit returned within 7 days after departure. / التأمين يُرد خلال 7 أيام.'],
    ['Late Notice / التبليغ المتأخر',        'Notice after 15th = full month charge. / الإبلاغ بعد 15 = شهر كامل.'],
    ['Rent Collection / تحصيل الإيجار',      'Rent due on 1st of each month. / الإيجار في أول كل شهر.'],
    ['Personal Items / الأغراض',             'Remove all belongings before checkout. / إزالة جميع الأغراض قبل المغادرة.'],
    ['Handover / التسليم',                   'Keys returned before 4PM on last day. / تسليم المفاتيح قبل 4 مساءً.'],
    ['Kitchen & Fridge / المطبخ',            'Keep kitchen clean. Empty fridge before leaving. / نظافة المطبخ وتفريغ الثلاجة.'],
    ['Smoking & Fire / التدخين',             'No smoking inside. No open flames. / ممنوع التدخين والنار الحرة.'],
    ['Lock Change / القفل',                  'No lock changes without permission. / لا تغيير للقفل بدون إذن.'],
  ];

  return `
<!DOCTYPE html><html dir="ltr"><head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 15px; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
  .header h2 { margin: 0; font-size: 16px; }
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  .info-table td { padding: 5px 8px; border: 1px solid #ccc; }
  .info-table .label { background: #f0f0f0; font-weight: bold; width: 120px; }
  .rules-table { width: 100%; border-collapse: collapse; }
  .rules-table th { background: #2196f3; color: white; padding: 6px 8px; text-align: center; }
  .rules-table td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; }
  .rules-table tr:nth-child(even) td { background: #f9f9f9; }
  .num { width: 25px; text-align: center; font-weight: bold; }
  .sign-area { margin-top: 20px; display: flex; justify-content: space-between; }
  .sign-box { text-align: center; width: 45%; border-top: 1px solid #333; padding-top: 5px; }
  @media print { body { margin: 0; } }
</style></head><body>
<div class="header">
  <h2>🏢 واحدتنا — Wahdatina</h2>
  <div>${data.building || ''}</div>
</div>

<table class="info-table">
  <tr><td class="label">Tenant / المستأجر</td><td>${Helpers.escapeHtml(data.name||'')}</td><td class="label">Phone / الهاتف</td><td>${Helpers.escapeHtml(data.phone||'')}</td></tr>
  <tr><td class="label">Apt / الشقة</td><td>${Helpers.escapeHtml(data.apt||'')} — Room ${Helpers.escapeHtml(data.room||'')}</td><td class="label">ID / الهوية</td><td>${Helpers.escapeHtml(data.id||'')}</td></tr>
  <tr><td class="label">Rent / الإيجار</td><td>${Helpers.formatAED(data.rent)}</td><td class="label">Deposit / التأمين</td><td>${Helpers.formatAED(data.deposit)}</td></tr>
  <tr><td class="label">Start / البداية</td><td>${Helpers.fmtDate(data.date)}</td><td class="label">Persons / الأشخاص</td><td>${data.persons||1}</td></tr>
</table>

<table class="rules-table">
  <thead><tr><th class="num">#</th><th>English</th><th>العربية</th></tr></thead>
  <tbody>
  ${rules.map((r,i) => {
    const [titleLine, contentLine] = r;
    const [enTitle, arTitle] = titleLine.split(' / ');
    const [enContent, arContent] = contentLine.split(' / ');
    return `<tr>
      <td class="num">${i+1}</td>
      <td><strong>${enTitle}</strong><br>${enContent}</td>
      <td style="text-align:right;direction:rtl"><strong>${arTitle}</strong><br>${arContent}</td>
    </tr>`;
  }).join('')}
  </tbody>
</table>

<div class="sign-area">
  <div class="sign-box">Tenant Signature / توقيع المستأجر<br><br>${Helpers.escapeHtml(data.name||'')}</div>
  <div class="sign-box">Management / الإدارة<br><br>واحدتنا</div>
</div>
</body></html>`;
}

function previewWelcomeLetter() {
  const data = getWelcomeFormData();
  if (!data.name || !data.apt) { toast(t('toast_apt_required'), 'error'); return; }
  const preview = document.getElementById('wl-preview');
  preview.style.display = 'block';
  preview.innerHTML = `<iframe id="wl-iframe" style="width:100%;height:600px;border:1px solid var(--border);border-radius:var(--radius)"></iframe>`;
  const iframe = document.getElementById('wl-iframe');
  iframe.contentDocument.open();
  iframe.contentDocument.write(buildWelcomeHTML(data));
  iframe.contentDocument.close();
}

async function printWelcomeLetter() {
  const data = getWelcomeFormData();
  if (!data.name || !data.apt) { toast(t('toast_apt_required'), 'error'); return; }
  await exportPDF(t('moves_welcome') + ' — ' + Helpers.escapeHtml(data.name), buildWelcomeHTML(data));
}

function sendWelcomeWhatsApp() {
  const data = getWelcomeFormData();
  if (!data.name || !data.apt) { toast(t('toast_apt_required'), 'error'); return; }
  if (!data.phone) { toast(t('toast_phone_required'), 'error'); return; }

  const monthLabel = data.date ? Helpers.fmtDate(data.date) : '';
  const lang = (data.language || 'AR').toUpperCase();

  let msg;
  if (lang === 'AR') {
    msg = `مرحباً ${data.name} 👋
نرسل لكم إيصال الحجز لوحدتكم:
🏠 شقة ${data.apt} — غرفة ${data.room}
💰 الإيجار: ${Helpers.formatAED(data.rent)} شهرياً
🔒 التأمين: ${Helpers.formatAED(data.deposit)}
📅 تاريخ البداية: ${monthLabel}
${data.building ? '🏢 ' + data.building : ''}
أهلاً وسهلاً بكم 🙏`;
  } else {
    msg = `Hello ${data.name} 👋
Your booking receipt:
🏠 Apt ${data.apt} — Room ${data.room}
💰 Rent: ${Helpers.formatAED(data.rent)}/month
🔒 Deposit: ${Helpers.formatAED(data.deposit)}
📅 Start: ${monthLabel}
${data.building ? '🏢 ' + data.building : ''}
Welcome! 🙏`;
  }

  Helpers.openWhatsApp(data.phone, msg);
}

function getWelcomeFormData() {
  return {
    name:     document.getElementById('wl-name')?.value.trim(),
    phone:    document.getElementById('wl-phone')?.value.trim(),
    apt:      document.getElementById('wl-apt')?.value.trim(),
    room:     document.getElementById('wl-room')?.value.trim(),
    rent:     parseFloat(document.getElementById('wl-rent')?.value) || 0,
    deposit:  parseFloat(document.getElementById('wl-deposit')?.value) || 0,
    date:     document.getElementById('wl-date')?.value,
    persons:  document.getElementById('wl-persons')?.value || 1,
    building: document.getElementById('wl-building')?.value.trim(),
    id:       document.getElementById('wl-id')?.value.trim(),
  };
}

// ══════════════════════════════════════════
// activateScheduled + _activateOneArrival + _executeScheduledTransfer
// (كل القواعد Q1-Q15 مطبّقة)
// ══════════════════════════════════════════
async function activateScheduled() {
  if (window._schedulerRan) return;
  window._schedulerRan = true;
  try {
    const todayStr = Helpers.today();

    // Q4: Block 1 — حجوزات pending
    const { data: pendingArrivals, error: aErr } = await sb.from('moves')
      .select('*').eq('type','arrive').eq('status','pending').lte('new_start_date', todayStr);
    if (aErr) throw aErr;
    if (pendingArrivals && pendingArrivals.length > 0) {
      for (const move of pendingArrivals) {
        try { await _activateOneArrival(move); }
        catch(e) { console.error(`arrival ${move.id}:`, e); }
      }
    }

    // Q4: Block 2 — نقلات مجدولة (مستقل عن Block 1)
    const { data: scheduled, error: sErr } = await sb.from('internal_transfers')
      .select('*').eq('is_scheduled',true).eq('is_executed',false).lte('transfer_date', todayStr);
    if (sErr) throw sErr;
    if (scheduled && scheduled.length > 0) {
      for (const tr of scheduled) {
        try { await _executeScheduledTransfer(tr); }
        catch(e) { console.error(`transfer ${tr.id}:`, e); }
      }
    }

  } catch(err) {
    window._schedulerRan = false; // Q11: reset عند فشل
    console.error('activateScheduled:', err);
  }
}

async function _activateOneArrival(move) {
  // Q7: جيب unit_id مع fallback + تحديث الـ move
  let unitId = move.unit_id;
  if (!unitId) unitId = await findUnitId(move.apartment, move.room, move.id);

  // ⭐ أول حاجة: حفظ التاريخ للمستأجر القديم (لو موجود)
  // لو الوحدة فاضية → archiveUnitToHistory بتتجاهل تلقائياً
  await archiveUnitToHistory(unitId, move.move_date || Helpers.today(), 'departure');

  // بعدين: تحديث الوحدة بالمستأجر الجديد
  const { error: uErr } = await sb.from('units').update({
    tenant_name:   move.new_tenant_name  || null,
    phone:         move.new_phone        || null,
    monthly_rent:  move.new_rent         || 0,
    deposit:       move.new_deposit      || 0,
    persons_count: move.new_persons      || 1,
    start_date:    move.new_start_date   || Helpers.today(),
    language:      (move.language || 'AR').toUpperCase(),  // Q15
    is_vacant:     false,
    unit_status:   'occupied',
    updated_at:    new Date().toISOString(),
  }).eq('id', unitId);
  if (uErr) throw uErr;

  // Q6: guard التأمين
  if (move.new_deposit > 0) {
    // حذف العربون أولاً
    await sb.from('deposits')
      .delete().eq('unit_id', unitId).like('notes', '%عربون حجز%');

    // تحقق مفيش تأمين نهائي موجود
    const { data: existing } = await sb.from('deposits')
      .select('id').eq('unit_id', unitId).eq('status', 'held')
      .eq('tenant_name', move.new_tenant_name || '').limit(1);

    if (!existing?.length) {
      const { error: depErr } = await sb.from('deposits').insert({
        unit_id:               unitId,
        apartment:             String(move.apartment),  // Q1
        room:                  String(move.room),       // Q1
        tenant_name:           move.new_tenant_name || null,
        amount:                move.new_deposit,
        status:                'held',
        deposit_received_date: Helpers.today(),
        created_by:            ME?.id || null,
      });
      if (depErr) console.warn('deposit insert:', depErr.message);
    }
  }

  // تغيير status الـ move لـ done
  const { error: mErr } = await sb.from('moves')
    .update({ status: 'done', unit_id: unitId }).eq('id', move.id);
  if (mErr) throw mErr;

  console.log(`✅ activated: ${move.apartment}/${move.room}`);
}

async function _executeScheduledTransfer(transfer) {
  const { from_snapshot: fSnap, to_snapshot: tSnap } = transfer;
  if (!fSnap || !tSnap) {
    console.warn('transfer snapshot missing:', transfer.id);
    return;
  }

  // ⭐ أول حاجة: حفظ تاريخ الوحدتين — لو فشل نوقف
  if (transfer.from_unit_id) {
    await archiveUnitToHistory(transfer.from_unit_id, transfer.transfer_date, 'transfer');
  }
  if (transfer.to_unit_id) {
    await archiveUnitToHistory(transfer.to_unit_id, transfer.transfer_date, 'transfer');
  }

  // بعدين: تبديل البيانات بين الوحدتين
  if (transfer.from_unit_id) {
    const { error } = await sb.from('units').update({
      tenant_name:   tSnap.tenant_name   || null,
      phone:         tSnap.phone         || null,
      monthly_rent:  tSnap.monthly_rent  || 0,
      deposit:       tSnap.deposit       || 0,
      persons_count: tSnap.persons_count || 1,
      start_date:    tSnap.start_date    || null,
      language:      (tSnap.language || 'AR').toUpperCase(),  // Q15
      is_vacant:     !tSnap.tenant_name,
      unit_status:   tSnap.tenant_name ? 'occupied' : 'available',
      updated_at:    new Date().toISOString(),
    }).eq('id', transfer.from_unit_id);
    if (error) throw error;
  }

  if (transfer.to_unit_id) {
    const { error } = await sb.from('units').update({
      tenant_name:   fSnap.tenant_name   || null,
      phone:         fSnap.phone         || null,
      monthly_rent:  fSnap.monthly_rent  || 0,
      deposit:       fSnap.deposit       || 0,
      persons_count: fSnap.persons_count || 1,
      start_date:    fSnap.start_date    || null,
      language:      (fSnap.language || 'AR').toUpperCase(),  // Q15
      is_vacant:     !fSnap.tenant_name,
      unit_status:   fSnap.tenant_name ? 'occupied' : 'available',
      updated_at:    new Date().toISOString(),
    }).eq('id', transfer.to_unit_id);
    if (error) throw error;
  }

  const { error: trErr } = await sb.from('internal_transfers')
    .update({ is_executed: true }).eq('id', transfer.id);
  if (trErr) throw trErr;

  console.log(`✅ transfer executed: ${transfer.id}`);
}
