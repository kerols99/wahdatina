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

  // Bulk pay — load on switch
  if (tab === 'bulk') {
    const c = document.getElementById('bulk-pay-content');
    if (c) { c.style.display = 'block'; loadBulkPay(); }
  } else {
    const c = document.getElementById('bulk-pay-content');
    if (c) c.style.display = 'none';
  }
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
  if (!requireRole('add_payment')) return;
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
    logAction('pay_rent', 'rent_payments', inserted?.id, { apartment: apt, room, tenant: tenant, amount, month: Helpers.fmtMonth(month) });
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
  if (!requireRole('manage_expenses')) return;
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
    logAction('pay_expense', 'expenses', null, { amount, month: Helpers.fmtMonth(month) });
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
  if (!requireRole('manage_expenses')) return;
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
    logAction('pay_owner', 'owner_payments', null, { amount, month: Helpers.fmtMonth(month) });
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
  if (!requireRole('add_payment')) return;
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
    logAction('pay_deposit', 'deposits', null, { apartment: apt, room, amount });
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

// ══════════════════════════════════════════
// deletePayment — حذف دفعة
// ══════════════════════════════════════════
async function deletePayment(paymentId) {
  if (!requireRole('delete')) return;
  if (!confirm(t('btn_confirm_delete'))) return;
  try {
    // حذف الإيصال المرتبط أولاً
    await sb.from('receipts').delete().eq('payment_id', paymentId);
    const { error } = await sb.from('rent_payments').delete().eq('id', paymentId);
    if (error) throw error;
    toast(t('toast_deleted'), 'info');
    // إعادة تحميل الـ drawer لو مفتوح
    const drawerEl = document.querySelector('[data-unit-id]');
    if (drawerEl) openUnitDrawer(drawerEl.dataset.unitId);
    else loadUnits();
  } catch(e) {
    toast(`❌ ${e.message}`, 'error');
  }
}
window.deletePayment = deletePayment;

// ══════════════════════════════════════════
// deleteDeposit — حذف تأمين
// ══════════════════════════════════════════
async function deleteDeposit(depositId) {
  if (!requireRole('delete')) return;
  if (!confirm(t('btn_confirm_delete'))) return;
  try {
    const { error } = await sb.from('deposits').delete().eq('id', depositId);
    if (error) throw error;
    toast(t('toast_deleted'), 'info');
    loadUnits();
    closeDrawer();
  } catch(e) {
    toast(`❌ ${e.message}`, 'error');
  }
}
window.deleteDeposit = deleteDeposit;

// ══════════════════════════════════════════
// openRefundDeposit — فورم استرداد التأمين
// ══════════════════════════════════════════
function openRefundDeposit(depositId) {
  openDrawer(`
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>↩️ ${t('deposit_refund_title') || 'استرداد التأمين'}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>
  <input type="hidden" id="ref-dep-id" value="${depositId}">
  <div class="form-group">
    <label>${t('refund_amount') || 'مبلغ الاسترداد'}</label>
    <input type="number" id="ref-amount" placeholder="0">
  </div>
  <div class="form-group">
    <label>${t('refund_date') || 'تاريخ الاسترداد'}</label>
    <input type="date" id="ref-date" value="${Helpers.today()}">
  </div>
  <div class="form-group">
    <label>${t('drawer_notes') || 'ملاحظات'}</label>
    <textarea id="ref-notes" rows="2"></textarea>
  </div>
  <div class="form-actions">
    <button class="btn btn-success" onclick="saveRefundDeposit()">↩️ ${t('btn_save') || 'حفظ'}</button>
    <button class="btn btn-secondary" onclick="closeDrawer()">${t('btn_cancel') || 'إلغاء'}</button>
  </div>
</div>`);
}
window.openRefundDeposit = openRefundDeposit;

// ══════════════════════════════════════════
// saveRefundDeposit — حفظ الاسترداد
// ══════════════════════════════════════════
async function saveRefundDeposit() {
  const depId  = document.getElementById('ref-dep-id')?.value;
  const amount = parseFloat(document.getElementById('ref-amount')?.value) || 0;
  const date   = document.getElementById('ref-date')?.value;
  const notes  = document.getElementById('ref-notes')?.value.trim();

  if (!amount || !date) { toast(t('toast_apt_required') || 'أدخل المبلغ والتاريخ', 'error'); return; }

  try {
    // جيب التأمين الحالي
    const { data: dep } = await sb.from('deposits').select('amount').eq('id', depId).maybeSingle();
    const isFullRefund = dep && amount >= dep.amount;

    const { error } = await sb.from('deposits').update({
      refund_amount:  amount,
      refund_date:    date,
      status:         isFullRefund ? 'refunded' : 'held',
      notes:          notes || null,
    }).eq('id', depId);

    if (error) throw error;
    toast('✅ ' + (t('toast_deposit_refunded') || 'تم تسجيل الاسترداد'), 'success');
    closeDrawer();
    loadUnits();
  } catch(e) {
    toast(`❌ ${e.message}`, 'error');
  }
}
window.saveRefundDeposit = saveRefundDeposit;

// ══════════════════════════════════════════
// printReceipt — طباعة إيصال
// ══════════════════════════════════════════
async function printReceipt(paymentId) {
  try {
    // جيب الإيصال + بيانات الوحدة للهاتف
    const { data: receipt } = await sb.from('receipts')
      .select('*').eq('payment_id', paymentId).maybeSingle();
    if (!receipt) { toast('مفيش إيصال لهذه الدفعة', 'error'); return; }

    // جيب هاتف المستأجر من الوحدة
    const { data: unit } = await sb.from('units')
      .select('phone, phone2, tenant_name, tenant_name2, language')
      .eq('apartment', String(receipt.apartment))
      .eq('room', String(receipt.room))
      .maybeSingle();

    const html = `
      <div style="font-family:Arial;direction:rtl;padding:20px;max-width:400px;margin:0 auto">
        <h2 style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px">إيصال دفع / Payment Receipt</h2>
        <p><b>رقم الإيصال / Receipt No:</b> ${receipt.receipt_no}</p>
        <p><b>المستأجر / Tenant:</b> ${receipt.tenant_name || '—'}</p>
        <p><b>الوحدة / Unit:</b> شقة ${receipt.apartment} — غرفة ${receipt.room}</p>
        <p><b>المبلغ / Amount:</b> ${receipt.amount} AED</p>
        <p><b>الشهر / Month:</b> ${receipt.payment_month || '—'}</p>
        <p><b>التاريخ / Date:</b> ${receipt.payment_date || '—'}</p>
        <p><b>طريقة الدفع / Method:</b> ${receipt.payment_method || '—'}</p>
      </div>`;

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>@media print{body{margin:0}}</style></head><body>${html}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);

    // عرض زرار WhatsApp لو في هاتف
    if (unit?.phone) {
      _showReceiptWAButton(receipt, unit);
    }
  } catch(e) {
    toast(`❌ ${e.message}`, 'error');
  }
}
window.printReceipt = printReceipt;

// WhatsApp message for receipt — يستخدم نفس modal واحدتي
function _showReceiptWAButton(receipt, unit) {
  const lang  = (unit && unit.language ? unit.language : 'AR').toUpperCase();
  const phone = unit && unit.phone ? unit.phone : '';
  const name  = unit && unit.tenant_name ? unit.tenant_name : '';

  if (!phone) return;

  var msgAR = '\uD83E\uDDFE إيصال دفع\n'
    + 'رقم الإيصال: ' + receipt.receipt_no + '\n'
    + 'الوحدة: شقة ' + receipt.apartment + ' — غرفة ' + receipt.room + '\n'
    + 'المستأجر: ' + (receipt.tenant_name || '—') + '\n'
    + 'المبلغ: ' + receipt.amount + ' AED\n'
    + 'الشهر: ' + (receipt.payment_month || '—') + '\n'
    + 'التاريخ: ' + (receipt.payment_date || '—') + '\n'
    + 'طريقة الدفع: ' + (receipt.payment_method || '—') + '\n'
    + 'شكراً لسداد الإيجار \uD83D\uDE4F';

  var msgEN = '\uD83E\uDDFE Payment Receipt\n'
    + 'Receipt No: ' + receipt.receipt_no + '\n'
    + 'Unit: Apt ' + receipt.apartment + ' — Room ' + receipt.room + '\n'
    + 'Tenant: ' + (receipt.tenant_name || '—') + '\n'
    + 'Amount: ' + receipt.amount + ' AED\n'
    + 'Month: ' + (receipt.payment_month || '—') + '\n'
    + 'Date: ' + (receipt.payment_date || '—') + '\n'
    + 'Method: ' + (receipt.payment_method || '—') + '\n'
    + 'Thank you for your payment \uD83D\uDE4F';

  var msg = lang === 'EN' ? msgEN : msgAR;

  // استخدام نفس modal واحدتي
  if (window.showWAModal) {
    showWAModal(phone, name, msg, lang);
  } else {
    Helpers.openWhatsApp(phone, msg);
  }

  // لو في مستأجر ثاني
  if (unit && unit.phone2 && unit.tenant_name2) {
    setTimeout(function() {
      if (window.showWAModal) showWAModal(unit.phone2, unit.tenant_name2, msg, lang);
    }, 500);
  }
}



// ══════════════════════════════════════════
// editPayment — تعديل دفعة
// ══════════════════════════════════════════
async function editPayment(paymentId) {
  if (!requireRole('manage_units')) return;
  try {
    const { data: p } = await sb.from('rent_payments').select('*').eq('id', paymentId).maybeSingle();
    if (!p) { toast('لم يتم العثور على الدفعة', 'error'); return; }

    const mon = p.payment_month ? p.payment_month.slice(0,7) : '';
    const modal = document.createElement('div');
    modal.id = 'edit-pay-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:600;display:flex;align-items:flex-end;justify-content:center;padding:16px';
    modal.innerHTML = `
      <div style="background:var(--surf);border-radius:20px 20px 0 0;padding:20px 16px 32px;width:100%;max-width:520px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-weight:800;font-size:1rem">✏️ ${t('btn_edit_payment')}</div>
          <button onclick="document.getElementById('edit-pay-modal').remove()"
            style="background:var(--surf2);border:1px solid var(--border);border-radius:50%;width:32px;height:32px;cursor:pointer">✕</button>
        </div>
        <div class="form-group">
          <label>${t('pay_amount')}</label>
          <input type="number" id="ep-amt" class="form-input" value="${p.amount || 0}">
        </div>
        <div class="form-group">
          <label>${t('pay_month')}</label>
          <input type="month" id="ep-mon" class="form-input" value="${mon}">
        </div>
        <div class="form-group">
          <label>${t('pay_date')}</label>
          <input type="date" id="ep-date" class="form-input" value="${(p.payment_date||'').slice(0,10)}">
        </div>
        <div class="form-group">
          <label>${t('pay_method')}</label>
          <select id="ep-meth" class="form-input">
            <option value="Cash" ${p.payment_method==='Cash'?'selected':''}>💵 Cash</option>
            <option value="Transfer" ${p.payment_method==='Transfer'?'selected':''}>🏦 Transfer</option>
            <option value="Cheque" ${p.payment_method==='Cheque'?'selected':''}>📝 Cheque</option>
          </select>
        </div>
        <div class="form-group">
          <label>${t('drawer_notes')}</label>
          <input type="text" id="ep-notes" class="form-input" value="${Helpers.escapeHtml(p.notes||'')}">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="saveEditPayment('${paymentId}')">💾 ${t('save_changes')}</button>
          <button class="btn btn-secondary" onclick="document.getElementById('edit-pay-modal').remove()">${t('btn_cancel')}</button>
        </div>
      </div>`;
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    document.body.appendChild(modal);
  } catch(e) { toast(`❌ ${e.message}`, 'error'); }
}
window.editPayment = editPayment;

async function saveEditPayment(paymentId) {
  const amt   = parseFloat(document.getElementById('ep-amt')?.value) || 0;
  const mon   = document.getElementById('ep-mon')?.value;
  const date  = document.getElementById('ep-date')?.value;
  const meth  = document.getElementById('ep-meth')?.value || 'Cash';
  const notes = document.getElementById('ep-notes')?.value.trim() || null;

  if (!amt || !mon) { toast(t('toast_apt_required'), 'error'); return; }

  try {
    const { error } = await sb.from('rent_payments').update({
      amount:         amt,
      payment_month:  Helpers.toMonthFirst(mon),
      payment_date:   date || null,
      payment_method: meth,
      notes:          notes,
    }).eq('id', paymentId);
    if (error) throw error;
    toast('✅ ' + t('save_changes'), 'success');
    document.getElementById('edit-pay-modal')?.remove();
    loadUnits();
  } catch(e) { toast(`❌ ${e.message}`, 'error'); }
}
window.saveEditPayment = saveEditPayment;

// ══════════════════════════════════════════
// editDeposit — تعديل تأمين
// ══════════════════════════════════════════
async function editDeposit(depositId) {
  if (!requireRole('manage_units')) return;
  try {
    const { data: d } = await sb.from('deposits').select('*').eq('id', depositId).maybeSingle();
    if (!d) { toast('لم يتم العثور على التأمين', 'error'); return; }

    const modal = document.createElement('div');
    modal.id = 'edit-dep-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:600;display:flex;align-items:flex-end;justify-content:center;padding:16px';
    modal.innerHTML = `
      <div style="background:var(--surf);border-radius:20px 20px 0 0;padding:20px 16px 32px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-weight:800;font-size:1rem">✏️ ${t('btn_edit_deposit')}</div>
          <button onclick="document.getElementById('edit-dep-modal').remove()"
            style="background:var(--surf2);border:1px solid var(--border);border-radius:50%;width:32px;height:32px;cursor:pointer">✕</button>
        </div>
        <div class="form-group">
          <label>${t('pay_amount')}</label>
          <input type="number" id="ed-amt" class="form-input" value="${d.amount || 0}">
        </div>
        <div class="form-group">
          <label>${t('drawer_date') || 'تاريخ الاستلام'}</label>
          <input type="date" id="ed-date" class="form-input" value="${(d.deposit_received_date||'').slice(0,10)}">
        </div>
        <div class="form-group">
          <label>${t('deposit_status') || 'الحالة'}</label>
          <select id="ed-status" class="form-input" onchange="document.getElementById('ed-refund-wrap').style.display=this.value==='refunded'?'block':'none'">
            <option value="held" ${d.status==='held'?'selected':''}>🔒 ${t('deposit_held')}</option>
            <option value="refunded" ${d.status==='refunded'?'selected':''}>↩️ ${t('deposit_refunded')}</option>
            <option value="forfeited" ${d.status==='forfeited'?'selected':''}>🚫 ${t('deposit_forfeited')}</option>
          </select>
        </div>
        <div id="ed-refund-wrap" style="display:${d.status==='refunded'?'block':'none'}">
          <div class="form-group">
            <label>${t('refund_date')}</label>
            <input type="date" id="ed-refund-date" class="form-input" value="${(d.refund_date||'').slice(0,10)}">
          </div>
          <div class="form-group">
            <label>${t('refund_amount')}</label>
            <input type="number" id="ed-refund-amt" class="form-input" value="${d.refund_amount || 0}">
          </div>
        </div>
        <div class="form-group">
          <label>${t('drawer_notes')}</label>
          <input type="text" id="ed-notes" class="form-input" value="${Helpers.escapeHtml(d.notes||'')}">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="saveEditDeposit('${depositId}')">💾 ${t('save_changes')}</button>
          <button class="btn btn-secondary" onclick="document.getElementById('edit-dep-modal').remove()">${t('btn_cancel')}</button>
        </div>
      </div>`;
    modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
    document.body.appendChild(modal);
  } catch(e) { toast(`❌ ${e.message}`, 'error'); }
}
window.editDeposit = editDeposit;

async function saveEditDeposit(depositId) {
  const amt        = parseFloat(document.getElementById('ed-amt')?.value) || 0;
  const date       = document.getElementById('ed-date')?.value;
  const status     = document.getElementById('ed-status')?.value || 'held';
  const refundDate = document.getElementById('ed-refund-date')?.value || null;
  const refundAmt  = parseFloat(document.getElementById('ed-refund-amt')?.value) || 0;
  const notes      = document.getElementById('ed-notes')?.value.trim() || null;

  if (!amt) { toast(t('toast_apt_required'), 'error'); return; }

  try {
    const { error } = await sb.from('deposits').update({
      amount:                amt,
      deposit_received_date: date || null,
      status:                status,
      refund_date:           status === 'refunded' ? refundDate : null,
      refund_amount:         status === 'refunded' ? (refundAmt || amt) : 0,
      notes:                 notes,
    }).eq('id', depositId);
    if (error) throw error;
    toast('✅ ' + t('save_changes'), 'success');
    document.getElementById('edit-dep-modal')?.remove();
    loadUnits();
  } catch(e) { toast(`❌ ${e.message}`, 'error'); }
}
window.saveEditDeposit = saveEditDeposit;

// ══════════════════════════════════════════
// editExpense — تعديل مصروف
// ══════════════════════════════════════════
async function editExpense(expenseId) {
  if (!requireRole('manage_expenses')) return;
  try {
    const { data: e } = await sb.from('expenses').select('*').eq('id', expenseId).maybeSingle();
    if (!e) { toast('لم يتم العثور على المصروف', 'error'); return; }

    const modal = document.createElement('div');
    modal.id = 'edit-exp-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:600;display:flex;align-items:flex-end;justify-content:center;padding:16px';
    modal.innerHTML = `
      <div style="background:var(--surf);border-radius:20px 20px 0 0;padding:20px 16px 32px;width:100%;max-width:520px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-weight:800;font-size:1rem">✏️ ${t('btn_edit_expense')}</div>
          <button onclick="document.getElementById('edit-exp-modal').remove()"
            style="background:var(--surf2);border:1px solid var(--border);border-radius:50%;width:32px;height:32px;cursor:pointer">✕</button>
        </div>
        <div class="form-group">
          <label>${t('exp_cat') || 'الفئة'}</label>
          <input type="text" id="ee-cat" class="form-input" value="${Helpers.escapeHtml(e.category||'')}">
        </div>
        <div class="form-group">
          <label>${t('pay_amount')}</label>
          <input type="number" id="ee-amt" class="form-input" value="${e.amount || 0}">
        </div>
        <div class="form-group">
          <label>${t('pay_month')}</label>
          <input type="month" id="ee-mon" class="form-input" value="${(e.period_month||'').slice(0,7)}">
        </div>
        <div class="form-group">
          <label>${t('exp_desc') || 'الوصف'}</label>
          <input type="text" id="ee-desc" class="form-input" value="${Helpers.escapeHtml(e.description||'')}">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="saveEditExpense('${expenseId}')">💾 ${t('save_changes')}</button>
          <button class="btn btn-secondary" onclick="document.getElementById('edit-exp-modal').remove()">${t('btn_cancel')}</button>
        </div>
      </div>`;
    modal.addEventListener('click', ev => { if(ev.target===modal) modal.remove(); });
    document.body.appendChild(modal);
  } catch(err) { toast(`❌ ${err.message}`, 'error'); }
}
window.editExpense = editExpense;

async function saveEditExpense(expenseId) {
  const cat  = document.getElementById('ee-cat')?.value.trim();
  const amt  = parseFloat(document.getElementById('ee-amt')?.value) || 0;
  const mon  = document.getElementById('ee-mon')?.value;
  const desc = document.getElementById('ee-desc')?.value.trim() || null;

  if (!amt || !mon) { toast(t('toast_apt_required'), 'error'); return; }

  try {
    const { error } = await sb.from('expenses').update({
      category:    cat || null,
      amount:      amt,
      period_month: Helpers.toMonthFirst(mon),
      description: desc,
    }).eq('id', expenseId);
    if (error) throw error;
    toast('✅ ' + t('save_changes'), 'success');
    document.getElementById('edit-exp-modal')?.remove();
    if (typeof loadExpRpt === 'function') loadExpRpt();
  } catch(e) { toast(`❌ ${e.message}`, 'error'); }
}
window.saveEditExpense = saveEditExpense;

// ══════════════════════════════════════════
// calcOwnerBalance — حساب رصيد المالك
// ══════════════════════════════════════════
async function calcOwnerBalance() {
  const monEl = document.getElementById('own-month');
  if (monEl && !monEl.value) {
    const now = new Date();
    monEl.value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  }
  const mon = monEl ? monEl.value : '';
  if (!mon) return;

  const wrap    = document.getElementById('own-balance-wrap');
  const display = document.getElementById('own-balance-display');
  if (!wrap || !display) return;

  display.textContent = '⏳ ...';
  wrap.style.display = 'block';

  try {
    const monYM     = mon.slice(0,7);
    const monStart  = monYM + '-01';
    const monEnd    = Helpers.monthEnd(monStart);

    const [pR, dR, eR, oR] = await Promise.all([
      sb.from('rent_payments').select('amount').gte('payment_date', monStart).lte('payment_date', monEnd),
      sb.from('deposits').select('amount,status,refund_amount').gte('deposit_received_date', monStart).lte('deposit_received_date', monEnd),
      sb.from('expenses').select('amount').eq('period_month', monStart),
      sb.from('owner_payments').select('amount').eq('period_month', monStart),
    ]);

    const totalRent = (pR.data||[]).reduce((s,p) => s+parseFloat(p.amount||0), 0);
    const totalDeps = (dR.data||[]).filter(d=>d.status!=='refunded').reduce((s,d) => s+parseFloat(d.amount||0), 0);
    const totalExp  = (eR.data||[]).reduce((s,e) => s+parseFloat(e.amount||0), 0);
    const totalOwn  = (oR.data||[]).reduce((s,o) => s+parseFloat(o.amount||0), 0);
    const balance   = totalRent + totalDeps - totalExp - totalOwn;

    wrap.innerHTML = `
<div style="background:var(--surf2);border-radius:12px;padding:12px;margin-top:8px">
  <div style="font-size:.7rem;color:var(--muted);margin-bottom:8px;font-weight:700">💰 حساب شهر ${Helpers.fmtMonth(monStart)}</div>
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:.78rem"><span style="color:var(--muted)">✅ إيجار محصّل</span><b style="color:var(--green)">${Helpers.formatAED(totalRent)}</b></div>
  ${totalDeps>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:.78rem"><span style="color:var(--muted)">🔒 تأمينات</span><b style="color:var(--accent)">${Helpers.formatAED(totalDeps)}</b></div>`:''}
  ${totalExp>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:.78rem"><span style="color:var(--muted)">💸 مصاريف</span><b style="color:var(--amber)">- ${Helpers.formatAED(totalExp)}</b></div>`:''}
  ${totalOwn>0?`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:.78rem"><span style="color:var(--muted)">👤 دُفع للمالك</span><b>- ${Helpers.formatAED(totalOwn)}</b></div>`:''}
  <div style="display:flex;justify-content:space-between;padding:8px 0 4px;border-top:1px solid var(--border);margin-top:6px">
    <b style="font-size:.85rem">🏦 المتبقي للمالك</b>
    <b style="font-size:.95rem;color:${balance>=0?'var(--green)':'var(--red)'}">${Helpers.formatAED(balance)}</b>
  </div>
</div>`;
  } catch(e) {
    if(wrap) wrap.innerHTML = `<div class="error-msg">❌ ${e.message}</div>`;
  }
}
window.calcOwnerBalance = calcOwnerBalance;

// ══════════════════════════════════════════
// askWhoPayment — اختيار المستأجر عند الدفع
// للوحدات اللي فيها مستأجرين اتنين
// ══════════════════════════════════════════
function askWhoPayment(unitId) {
  const unit = (window._allUnits || []).find(u => u.id === unitId);
  if (!unit) return;
  if (!unit.tenant_name2 || !unit.rent2) {
    // مستأجر واحد — افتح الـ quick pay مباشرة
    if (window.quickPayUnit) quickPayUnit(unitId);
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'who-pay-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:600;display:flex;align-items:flex-end;justify-content:center;padding:16px';

  const paidMap = {};
  (window._currentMonthPayments || []).forEach(p => {
    if (p.tenant_num === 2) paidMap['t2_'+p.unit_id] = (paidMap['t2_'+p.unit_id]||0) + parseFloat(p.amount||0);
    else paidMap[p.unit_id] = (paidMap[p.unit_id]||0) + parseFloat(p.amount||0);
  });

  const paid1 = paidMap[unitId] || 0;
  const paid2 = paidMap['t2_'+unitId] || 0;
  const due1  = Math.max(0, parseFloat(unit.rent1||unit.monthly_rent||0) - paid1);
  const due2  = Math.max(0, parseFloat(unit.rent2||0) - paid2);

  const btnStyle = (due) => `width:100%;padding:16px;margin-bottom:10px;background:var(--surf2);border:2px solid ${due>0?'var(--accent)':'var(--green)'};border-radius:14px;color:var(--text);font-family:inherit;font-size:.95rem;font-weight:700;cursor:pointer;display:flex;justify-content:space-between;align-items:center`;

  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:20px 20px 0 0;padding:20px 16px 32px;width:100%;max-width:520px">
      <div style="font-weight:800;font-size:1rem;margin-bottom:16px">💰 ${t('pay_who') || 'مين بيدفع؟'}</div>
      <button style="${btnStyle(due1)}" onclick="document.getElementById('who-pay-modal').remove(); quickPayUnit('${unitId}', 1)">
        <span>👤 ${Helpers.escapeHtml(unit.tenant_name)}</span>
        <span style="color:${due1>0?'var(--accent)':'var(--green)'}">
          ${due1>0 ? Helpers.formatAED(due1)+' متبقي' : '✅ مدفوع'}
        </span>
      </button>
      <button style="${btnStyle(due2)}" onclick="document.getElementById('who-pay-modal').remove(); quickPayUnit('${unitId}', 2)">
        <span>👤 ${Helpers.escapeHtml(unit.tenant_name2)}</span>
        <span style="color:${due2>0?'var(--accent)':'var(--green)'}">
          ${due2>0 ? Helpers.formatAED(due2)+' متبقي' : '✅ مدفوع'}
        </span>
      </button>
      <button onclick="document.getElementById('who-pay-modal').remove()"
        style="width:100%;padding:12px;background:var(--surf2);border:1px solid var(--border);border-radius:12px;color:var(--muted);font-family:inherit;cursor:pointer">
        ${t('btn_cancel')}
      </button>
    </div>`;

  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}
window.askWhoPayment = askWhoPayment;

// ══════════════════════════════════════════
// Bulk Pay — دفع جماعي
// ══════════════════════════════════════════
async function loadBulkPay() {
  const c = document.getElementById('bulk-pay-content');
  if (!c) return;
  c.innerHTML = `<div class="loading">${t('loading')}</div>`;
  try {
    const monthFirst = Helpers.currentMonthFirst();
    const [unitsRes, paysRes] = await Promise.all([
      sb.from('units').select('id,apartment,room,tenant_name,monthly_rent,rent1,rent2,tenant_name2,is_vacant').eq('is_vacant',false).order('apartment').order('room'),
      sb.from('rent_payments').select('unit_id,amount,tenant_num').eq('payment_month', monthFirst),
    ]);

    const units = unitsRes.data || [];
    const pays  = paysRes.data  || [];

    const paidMap = {}, paid2Map = {};
    pays.forEach(p => {
      if (p.tenant_num === 2) paid2Map[p.unit_id] = (paid2Map[p.unit_id]||0) + parseFloat(p.amount||0);
      else paidMap[p.unit_id] = (paidMap[p.unit_id]||0) + parseFloat(p.amount||0);
    });

    // فلتر: غير مدفوعين فقط
    const unpaid = units.filter(u => {
      const due = parseFloat(u.monthly_rent||0) - (paidMap[u.id]||0);
      return due > 0;
    });

    if (!unpaid.length) {
      c.innerHTML = `<div class="empty-msg">✅ ${t('all_paid') || 'كل الوحدات دفعت هذا الشهر'}</div>`;
      return;
    }

    const today = Helpers.today();
    c.innerHTML = `
<div style="font-size:.75rem;color:var(--muted);margin-bottom:12px">${unpaid.length} وحدة غير مدفوعة — ${Helpers.fmtMonth(monthFirst)}</div>
${unpaid.map(u => {
  const due = parseFloat(u.monthly_rent||0) - (paidMap[u.id]||0);
  return `
<div style="background:var(--surf2);border-radius:12px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px">
  <div style="flex:1;min-width:0">
    <div style="font-weight:700;font-size:.85rem">${t('apt_label')} ${Helpers.escapeHtml(u.apartment)} — ${t('room_label')} ${Helpers.escapeHtml(u.room)}</div>
    <div style="font-size:.72rem;color:var(--muted)">${Helpers.escapeHtml(u.tenant_name||'—')}</div>
    <div style="font-size:.72rem;color:var(--red);font-weight:700">${t('kpi_remaining')}: ${Helpers.formatAED(due)}</div>
  </div>
  <button onclick="bulkSavePay('${u.id}','${u.apartment}','${u.room}','${monthFirst}','${today}',this)"
    style="background:var(--green)22;border:1px solid var(--green)44;border-radius:8px;padding:8px 14px;color:var(--green);font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">
    💰 ${Helpers.formatAED(due)}
  </button>
</div>`;
}).join('')}`;
  } catch(e) {
    c.innerHTML = `<div class="error-msg">❌ ${e.message}</div>`;
  }
}
window.loadBulkPay = loadBulkPay;

async function bulkSavePay(unitId, apt, room, month, date, btn) {
  if (!requireRole('add_payment')) return;
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    const { data: unit } = await sb.from('units').select('tenant_name,monthly_rent').eq('id', unitId).maybeSingle();
    const { data: pays } = await sb.from('rent_payments').select('amount').eq('unit_id', unitId).eq('payment_month', month);
    const paid = (pays||[]).reduce((s,p)=>s+parseFloat(p.amount||0),0);
    const due  = parseFloat(unit?.monthly_rent||0) - paid;
    if (due <= 0) { btn.textContent = '✅'; return; }

    const { error } = await sb.from('rent_payments').insert({
      unit_id: unitId, apartment: String(apt), room: String(room),
      tenant_name: unit?.tenant_name || null,
      amount: due, payment_month: month,
      payment_date: date, payment_method: 'Cash',
      created_by: ME?.id || null,
    });
    if (error) throw error;

    btn.textContent = '✅';
    btn.style.background = 'var(--green)44';
    btn.style.color = 'var(--green)';
    btn.disabled = true;
    toast(`✅ ${unit?.tenant_name || apt+'/'+room}`, 'success');
  } catch(e) {
    btn.disabled = false;
    btn.textContent = '❌';
    toast(e.message, 'error');
  }
}
window.bulkSavePay = bulkSavePay;

// ══════════════════════════════════════════
// openReceiptSearch — بحث في الإيصالات
// ══════════════════════════════════════════
async function openReceiptSearch() {
  const existing = document.getElementById('rcpt-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'rcpt-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:600;display:flex;align-items:flex-end;justify-content:center;padding:16px';

  modal.innerHTML = `
    <div style="background:var(--surf);border-radius:20px 20px 0 0;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;padding:0 0 32px">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--surf)">
        <div style="font-size:.95rem;font-weight:700">🔍 ${t('receipt_search')||'بحث في الإيصالات'}</div>
        <button onclick="document.getElementById('rcpt-modal').remove()"
          style="background:none;border:none;color:var(--muted);font-size:1.1rem;cursor:pointer">✕</button>
      </div>
      <div style="padding:12px 16px">
        <input id="rcpt-search" type="text" placeholder="${t('search_placeholder')||'ابحث باسم أو شقة أو شهر...'}"
          style="width:100%;padding:10px 14px;background:var(--surf2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-family:inherit;font-size:.85rem"
          oninput="filterReceipts()">
      </div>
      <div id="rcpt-list" style="padding:0 16px">
        <div class="loading">${t('loading')}</div>
      </div>
    </div>`;

  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);

  // جيب الإيصالات
  try {
    const { data } = await sb.from('receipts')
      .select('*').order('created_at', {ascending: false}).limit(200);
    window._allReceipts = data || [];
    filterReceipts();
  } catch(e) {
    document.getElementById('rcpt-list').innerHTML = `<div class="error-msg">❌ ${e.message}</div>`;
  }
}
window.openReceiptSearch = openReceiptSearch;

function filterReceipts() {
  const q    = (document.getElementById('rcpt-search')?.value || '').toLowerCase();
  const list = document.getElementById('rcpt-list');
  if (!list) return;

  const items = (window._allReceipts || []).filter(r =>
    !q ||
    (r.tenant_name||'').toLowerCase().includes(q) ||
    String(r.apartment||'').includes(q) ||
    String(r.room||'').includes(q) ||
    (r.payment_month||'').includes(q) ||
    (r.receipt_no||'').toLowerCase().includes(q)
  );

  if (!items.length) {
    list.innerHTML = `<div class="empty-msg">${t('no_receipts')||'لا توجد إيصالات'}</div>`;
    return;
  }

  list.innerHTML = items.map(r => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border)22;display:flex;justify-content:space-between;align-items:center;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:.75rem;font-weight:700;color:var(--accent);font-family:monospace">${r.receipt_no||'—'}</div>
        <div style="font-size:.75rem;color:var(--text);margin-top:2px">
          ${t('apt_label')} ${Helpers.escapeHtml(r.apartment||'')} — ${t('room_label')} ${Helpers.escapeHtml(r.room||'')}
          ${r.tenant_name ? ' · ' + Helpers.escapeHtml(r.tenant_name) : ''}
        </div>
        <div style="font-size:.68rem;color:var(--muted)">${r.payment_month||''} · ${r.payment_date||''}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <b style="color:var(--green)">${Helpers.formatAED(r.amount)}</b>
        ${r.payment_id ? `<button onclick="printReceipt('${r.payment_id}')"
          style="background:var(--accent)22;border:1px solid var(--accent)44;border-radius:6px;padding:2px 8px;color:var(--accent);font-size:.68rem;cursor:pointer;font-family:inherit">🖨️</button>` : ''}
      </div>
    </div>`).join('');
}
window.filterReceipts = filterReceipts;

// ══════════════════════════════════════════
// printOwnerSettlement — كشف حساب المالك PDF
// ══════════════════════════════════════════
async function printOwnerSettlement() {
  const monEl = document.getElementById('own-month');
  const mon   = monEl ? monEl.value : '';
  if (!mon) { toast(t('toast_month_req'), 'error'); return; }

  const monYM    = mon.slice(0,7);
  const monStart = monYM + '-01';
  const monEnd   = Helpers.monthEnd(monStart);
  const monthLabel = Helpers.fmtMonth(monStart);

  try {
    const [pR, dR, eR, oR, rR] = await Promise.all([
      sb.from('rent_payments').select('apartment,room,amount,payment_date,payment_method').gte('payment_date', monStart).lte('payment_date', monEnd),
      sb.from('deposits').select('apartment,room,amount,deposit_received_date,tenant_name,status').gte('deposit_received_date', monStart).lte('deposit_received_date', monEnd),
      sb.from('expenses').select('category,amount,description').eq('period_month', monStart),
      sb.from('owner_payments').select('amount,method,reference,notes').eq('period_month', monStart),
      sb.from('deposits').select('apartment,room,refund_amount,refund_date,tenant_name').gt('refund_amount', 0).gte('refund_date', monStart).lte('refund_date', monEnd),
    ]);

    const pays    = pR.data || [];
    const deps    = dR.data || [];
    const exps    = eR.data || [];
    const owns    = oR.data || [];
    const refunds = rR.data || [];

    const totalRent    = pays.reduce((s,p) => s+parseFloat(p.amount||0), 0);
    const totalDeps    = deps.filter(d=>d.status!=='refunded').reduce((s,d) => s+parseFloat(d.amount||0), 0);
    const totalRefunds = refunds.reduce((s,r) => s+parseFloat(r.refund_amount||0), 0);
    const totalExp     = exps.reduce((s,e) => s+parseFloat(e.amount||0), 0);
    const totalOwn     = owns.reduce((s,o) => s+parseFloat(o.amount||0), 0);
    const balance      = totalRent + totalDeps - totalRefunds - totalExp - totalOwn;

    const TH = t => `<th style="padding:6px 8px;background:#f0f0f0;border:1px solid #ccc;font-size:11px;text-align:right">${t}</th>`;
    const TD = (t,s='') => `<td style="padding:5px 8px;border:1px solid #ddd;font-size:11px;text-align:right${s?';'+s:''}">${t||'—'}</td>`;
    const ROW = (l,v,c='') => `<tr><td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:11px;color:#555">${l}</td><td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;font-weight:700;text-align:left${c?';color:'+c:''}">${v}</td></tr>`;

    const pdfHtml = `
<div style="font-family:Arial,sans-serif;direction:rtl;color:#111;max-width:700px;margin:0 auto">
  <div style="border-bottom:3px solid #1a3a6a;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:1.2rem;font-weight:800;color:#1a3a6a">كشف حساب المالك</div>
      <div style="font-size:.85rem;color:#555;margin-top:3px">${monthLabel}</div>
    </div>
    <div style="font-size:.75rem;color:#888">${new Date().toLocaleDateString('ar-EG')}</div>
  </div>

  ${pays.length ? `
  <div style="font-weight:700;font-size:.9rem;margin-bottom:8px;color:#1a3a6a">💰 الإيجارات المحصّلة (${pays.length})</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead><tr>${TH('شقة')}${TH('غرفة')}${TH('المبلغ')}${TH('التاريخ')}${TH('الطريقة')}</tr></thead>
    <tbody>${pays.map(p=>`<tr>${TD(p.apartment)}${TD(p.room)}${TD(Helpers.formatAED(p.amount),'color:#1a7a4a;font-weight:700')}${TD(p.payment_date||'')}${TD(p.payment_method||'')}</tr>`).join('')}</tbody>
  </table>` : ''}

  ${deps.length ? `
  <div style="font-weight:700;font-size:.9rem;margin-bottom:8px;color:#1a3a6a">🔒 تأمينات مستلمة (${deps.length})</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead><tr>${TH('شقة')}${TH('غرفة')}${TH('المستأجر')}${TH('المبلغ')}${TH('التاريخ')}</tr></thead>
    <tbody>${deps.map(d=>`<tr>${TD(d.apartment)}${TD(d.room)}${TD(d.tenant_name||'')}${TD(Helpers.formatAED(d.amount),'color:#2456d3;font-weight:700')}${TD(d.deposit_received_date||'')}</tr>`).join('')}</tbody>
  </table>` : ''}

  ${exps.length ? `
  <div style="font-weight:700;font-size:.9rem;margin-bottom:8px;color:#1a3a6a">💸 المصاريف (${exps.length})</div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
    <thead><tr>${TH('الفئة')}${TH('المبلغ')}${TH('الوصف')}</tr></thead>
    <tbody>${exps.map(e=>`<tr>${TD(e.category||'')}${TD(Helpers.formatAED(e.amount),'color:#b07400;font-weight:700')}${TD(e.description||'')}</tr>`).join('')}</tbody>
  </table>` : ''}

  <div style="border-top:2px solid #333;padding-top:14px;margin-top:4px">
    <div style="font-weight:700;font-size:.9rem;margin-bottom:10px;color:#1a3a6a">📊 الملخص</div>
    <table style="width:100%;border-collapse:collapse">
      <tbody>
        ${ROW('✅ إجمالي الإيجار', Helpers.formatAED(totalRent), '#1a7a4a')}
        ${totalDeps>0?ROW('🔒 إجمالي التأمينات', Helpers.formatAED(totalDeps), '#2456d3'):''}
        ${totalRefunds>0?ROW('↩️ تأمينات مرتجعة', '- '+Helpers.formatAED(totalRefunds), '#c0392b'):''}
        ${totalExp>0?ROW('💸 إجمالي المصاريف', '- '+Helpers.formatAED(totalExp), '#b07400'):''}
        ${totalOwn>0?ROW('👤 دُفع للمالك مسبقاً', '- '+Helpers.formatAED(totalOwn), '#555'):''}
        <tr style="background:${balance>=0?'#1a7a4a':'#c0392b'}">
          <td style="padding:10px;font-size:13px;font-weight:800;color:#fff">🏦 المتبقي للمالك</td>
          <td style="padding:10px;font-size:15px;font-weight:800;color:#fff;text-align:left">${Helpers.formatAED(balance)}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>`;

    const overlay = document.getElementById('pdfOverlay');
    const content = document.getElementById('pdf-content');
    if (overlay && content) {
      content.innerHTML = pdfHtml;
      overlay.style.display = 'flex';
    }
  } catch(e) {
    toast(`❌ ${e.message}`, 'error');
  }
}
window.printOwnerSettlement = printOwnerSettlement;
