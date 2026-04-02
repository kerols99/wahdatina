// ══════════════════════════════
// payments.js — تسجيل المدفوعات
// ══════════════════════════════

'use strict';

// ══════════════════════════
// تحميل تبويب الدفع
// ══════════════════════════
function loadPay() {
  switchPayTab('rent');
}

function switchPayTab(tab) {
  document.querySelectorAll('.pay-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.pay-section').forEach(s => s.classList.remove('active'));

  document.querySelector(`.pay-tab-btn[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById(`pay-section-${tab}`)?.classList.add('active');
}

// ══════════════════════════
// Auto-fill بيانات الوحدة
// ══════════════════════════
async function autoFillRent() {
  const apt  = document.getElementById('pay-apt')?.value.trim();
  const room = document.getElementById('pay-room')?.value.trim();

  if (Helpers.isEmpty(apt) || Helpers.isEmpty(room)) return;

  try {
    const { data, error } = await sb
      .from('units')
      .select('id, tenant_name, monthly_rent, rent1, rent2, language')
      .eq('apartment', String(apt))  // Q1
      .eq('room', String(room))  // Q1
      .maybeSingle();

    if (error) throw error;
    if (!data) return;

    const nameEl   = document.getElementById('pay-tenant');
    const amountEl = document.getElementById('pay-amount');
    const monthEl  = document.getElementById('pay-month');
    const unitIdEl = document.getElementById('pay-unit-id');
    const badgeEl  = document.getElementById('r-tenant-badge');

    if (nameEl)   nameEl.value   = data.tenant_name || '';
    if (amountEl) amountEl.value = data.monthly_rent || '';
    if (monthEl && !monthEl.value) monthEl.value = Helpers.currentMonthFirst();
    if (unitIdEl) unitIdEl.value = data.id || '';

    // badge: اسم المستأجر + لو في مستأجر ثاني
    if (badgeEl) {
      const names = [data.tenant_name, data.tenant_name2].filter(Boolean);
      badgeEl.textContent = names.join(' & ') || '';
      badgeEl.style.display = names.length ? 'inline' : 'none';
    }

  } catch (err) {
    console.error('autoFillRent error:', err);
  }
}

// ══════════════════════════
// تسجيل دفعة إيجار
// ══════════════════════════
async function saveRent() {
  const apt      = document.getElementById('pay-apt')?.value.trim();
  const room     = document.getElementById('pay-room')?.value.trim();
  const tenant   = document.getElementById('pay-tenant')?.value.trim();
  const amount   = parseFloat(document.getElementById('pay-amount')?.value);
  const month    = document.getElementById('pay-month')?.value;
  const date     = document.getElementById('pay-date')?.value;
  const method   = document.getElementById('pay-method')?.value || 'Cash';
  const tenantN  = parseInt(document.getElementById('pay-tenant-num')?.value) || 1;
  const notes    = document.getElementById('pay-notes')?.value.trim();
  const unitId   = document.getElementById('pay-unit-id')?.value || null;

  // تحقق
  if (Helpers.isEmpty(apt) || Helpers.isEmpty(room)) {
    toast(t('toast_apt_required'), 'error'); return;
  }
  if (!amount || amount <= 0) {
    toast(t('toast_amount_req'), 'error'); return;
  }
  if (!month) {
    toast(t('toast_month_req'), 'error'); return;
  }
  if (!date) {
    toast(t('toast_date_req'), 'error'); return;
  }

  const payload = {
    unit_id:        unitId,
    apartment:      String(apt),    // Q1
    room:           String(room),   // Q1
    tenant_name:    tenant || null,
    amount:         amount,
    payment_month:  Helpers.toMonthFirst(month),
    payment_date:   date,
    payment_method: method,
    tenant_num:     tenantN,
    notes:          notes || null,
    created_by:     ME?.id || null,
  };

  const saveBtn = document.getElementById('save-rent-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '...'; }

  try {
    const { data: inserted, error } = await sb
      .from('rent_payments')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    // توليد إيصال
    await createReceipt(inserted, unitId, apt, room, tenant, amount, month, date, method);

    toast(t('toast_rent_saved'), 'success');
    resetRentForm();

    // تحديث الوحدات إذا كنا في بانل الوحدات
    if (CURRENT_PANEL === 'units') loadUnits();

  } catch (err) {
    console.error('saveRent error:', err);
    toast(`❌ ${err.message}`, 'error');
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'تسجيل الدفعة'; }
  }
}

// ══════════════════════════
// إنشاء إيصال
// ══════════════════════════
async function createReceipt(payment, unitId, apt, room, tenant, amount, month, date, method) {
  try {
    const receiptNo = Helpers.genReceiptNo();
    const { error } = await sb.from('receipts').insert({
      receipt_no:     receiptNo,
      payment_id:     payment.id,
      unit_id:        unitId,
      apartment:      String(apt),   // Q1
      room:           String(room),  // Q1
      tenant_name:    tenant || null,
      amount:         amount,
      // Q3: payment_month دايماً YYYY-MM-01
      payment_month:  Helpers.toMonthFirst(month),
      payment_date:   date,
      payment_method: method,
      lang:           LANG === 'ar' ? 'AR' : 'EN',
    });
    if (error) console.warn('Receipt insert warn:', error.message);
  } catch (err) {
    console.warn('createReceipt error:', err);
  }
}

// ══════════════════════════
// تسجيل مصروف
// ══════════════════════════
async function saveExpense() {
  const category = document.getElementById('exp-cat')?.value.trim();
  const amount   = parseFloat(document.getElementById('exp-amount')?.value);
  const month    = document.getElementById('exp-month')?.value;
  const desc     = document.getElementById('exp-desc')?.value.trim();
  const receipt  = document.getElementById('exp-receipt')?.value.trim();

  if (!amount || amount <= 0) {
    toast(t('toast_amount_req'), 'error'); return;
  }
  if (!month) {
    toast(t('toast_month_req'), 'error'); return;
  }

  const payload = {
    category:    category || null,
    amount:      amount,
    period_month: Helpers.toMonthFirst(month),
    description: desc     || null,
    receipt_no:  receipt  || null,
    created_by:  ME?.id   || null,
  };

  try {
    const { error } = await sb.from('expenses').insert(payload);
    if (error) throw error;
    toast(t('toast_exp_saved'), 'success');
    resetExpenseForm();
  } catch (err) {
    console.error('saveExpense error:', err);
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════
// تسجيل دفعة المالك
// ══════════════════════════
async function saveOwnerPayment() {
  const amount  = parseFloat(document.getElementById('own-amount')?.value);
  const month   = document.getElementById('own-month')?.value;
  const date    = document.getElementById('own-date')?.value;
  const method  = document.getElementById('own-method')?.value || 'Cash';
  const ref     = document.getElementById('own-ref')?.value.trim();
  const notes   = document.getElementById('own-notes')?.value.trim();

  if (!amount || amount <= 0) {
    toast(t('toast_amount_req'), 'error'); return;
  }
  if (!month) {
    toast(t('toast_month_req'), 'error'); return;
  }

  const payload = {
    amount:       amount,
    period_month: Helpers.toMonthFirst(month),
    payment_date: date    || null,
    method:       method,
    reference:    ref     || null,
    notes:        notes   || null,
    created_by:   ME?.id  || null,
  };

  try {
    const { error } = await sb.from('owner_payments').insert(payload);
    if (error) throw error;
    toast(t('toast_own_saved'), 'success');
    resetOwnerForm();
  } catch (err) {
    console.error('saveOwnerPayment error:', err);
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════
// تسجيل تأمين
// ══════════════════════════
async function saveDeposit() {
  const apt      = document.getElementById('dep-apt')?.value.trim();
  const room     = document.getElementById('dep-room')?.value.trim();
  const tenant   = document.getElementById('dep-tenant')?.value.trim();
  const amount   = parseFloat(document.getElementById('dep-amount')?.value) || 0;
  const status   = document.getElementById('dep-status')?.value || 'held';
  const refund   = parseFloat(document.getElementById('dep-refund')?.value) || 0;
  const deduct   = parseFloat(document.getElementById('dep-deduct')?.value) || 0;
  const rDate    = document.getElementById('dep-refund-date')?.value || null;
  const recDate  = document.getElementById('dep-received-date')?.value || null;
  const notes    = document.getElementById('dep-notes')?.value.trim();

  if (Helpers.isEmpty(apt) || Helpers.isEmpty(room)) {
    toast(t('toast_apt_required'), 'error'); return;
  }

  // جلب unit_id
  let unitId = null;
  try {
    const { data } = await sb
      .from('units')
      .select('id')
      .eq('apartment', String(apt))  // Q1
      .eq('room', String(room))      // Q1
      .maybeSingle();
    unitId = data?.id || null;
  } catch {/* لا بأس */}

  const payload = {
    unit_id:               unitId,
    apartment:             String(apt),   // Q1
    room:                  String(room),  // Q1
    tenant_name:           tenant   || null,
    amount:                amount,
    status:                status,
    refund_amount:         refund,
    deduction_amount:      deduct,
    refund_date:           rDate,
    deposit_received_date: recDate  || null,
    notes:                 notes    || null,
    created_by:            ME?.id   || null,
  };

  try {
    const { error } = await sb.from('deposits').insert(payload);
    if (error) throw error;
    toast(t('toast_dep_saved'), 'success');
    resetDepositForm();
  } catch (err) {
    console.error('saveDeposit error:', err);
    toast(`❌ ${err.message}`, 'error');
  }
}

// ══════════════════════════
// Reset Forms
// ══════════════════════════
function resetRentForm() {
  ['pay-apt','pay-room','pay-tenant','pay-amount','pay-notes','pay-unit-id'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const monthEl = document.getElementById('pay-month');
  if (monthEl) monthEl.value = Helpers.currentMonthFirst();
  const dateEl  = document.getElementById('pay-date');
  if (dateEl)  dateEl.value  = Helpers.today();
}

function resetExpenseForm() {
  ['exp-cat','exp-amount','exp-desc','exp-receipt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const monthEl = document.getElementById('exp-month');
  if (monthEl) monthEl.value = Helpers.currentMonthFirst();
}

function resetOwnerForm() {
  ['own-amount','own-ref','own-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const monthEl = document.getElementById('own-month');
  if (monthEl) monthEl.value = Helpers.currentMonthFirst();
  const dateEl  = document.getElementById('own-date');
  if (dateEl)  dateEl.value  = Helpers.today();
}

function resetDepositForm() {
  ['dep-apt','dep-room','dep-tenant','dep-amount','dep-refund','dep-deduct','dep-refund-date','dep-received-date','dep-notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ══════════════════════════════════════════
// autoFillDeposit — تعبئة تلقائية مع تحذير
// ══════════════════════════════════════════
async function autoFillDeposit() {
  const apt  = document.getElementById('dep-apt')?.value?.trim();
  const room = document.getElementById('dep-room')?.value?.trim();
  if (!apt || !room) return;

  try {
    const { data: unit, error } = await sb.from('units')
      .select('id, tenant_name, deposit, start_date, phone')
      .eq('apartment', String(apt))   // Q1
      .eq('room', String(room))
      .maybeSingle();
    if (error) throw error;
    if (!unit) return;

    const nameEl = document.getElementById('dep-tenant');
    const amtEl  = document.getElementById('dep-amount');
    const dateEl = document.getElementById('dep-received-date');

    if (nameEl && !nameEl.value) nameEl.value = unit.tenant_name || '';
    if (amtEl  && !amtEl.value)  amtEl.value  = unit.deposit     || '';
    if (dateEl && !dateEl.value) dateEl.value  = unit.start_date  || '';

    // تحذير لو في تأمين موجود بالفعل
    const { data: existing } = await sb.from('deposits')
      .select('id, amount, deposit_received_date')
      .eq('unit_id', unit.id)
      .eq('status', 'held')
      .limit(1);

    if (existing?.length) {
      showDepositWarning(existing[0]);
    } else {
      // إخفاء التحذير لو مش موجود
      document.getElementById('dep-warning')?.remove();
    }
  } catch(err) {
    console.warn('autoFillDeposit:', err.message);
  }
}

function showDepositWarning(dep) {
  // إزالة أي تحذير قديم
  document.getElementById('dep-warning')?.remove();
  const form = document.getElementById('pay-section-deposit');
  if (!form) return;
  const warn = document.createElement('div');
  warn.id = 'dep-warning';
  warn.className = 'warning-banner';
  warn.innerHTML = `⚠️ ${t('deposit_already_exists')}: ${Helpers.formatAED(dep.amount)} — ${Helpers.fmtDate(dep.deposit_received_date)}`;
  form.prepend(warn);
}
