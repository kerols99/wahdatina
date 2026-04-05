// ══════════════════════════════════════════
// dashboard.js — الرئيسية + تقرير التحصيل + المتأخرون
// ══════════════════════════════════════════
'use strict';

// ─────────────────────────────────────────
// loadHome — الشاشة الرئيسية
// Q5: activateScheduled تتكال من هنا مباشرة
// ─────────────────────────────────────────
async function loadHome() {
  const container = document.getElementById('home-content');
  if (!container) return;
  container.innerHTML = `<div class="loading">${t('loading')}</div>`;

  // Q5: activateScheduled من loadHome مباشرة
  activateScheduled?.();

  try {
    const monthFirst = Helpers.currentMonthFirst();

    // Q9: جيب كل البيانات دفعة واحدة
    const monthEnd = Helpers.monthEnd(monthFirst); // آخر يوم صح في الشهر

    const [unitsRes, paymentsRes, expensesRes, ownerRes, depositsRes, movesRes] = await Promise.all([
      sb.from('units').select('id, monthly_rent, is_vacant, unit_status, start_date'),
      sb.from('rent_payments')
        .select('amount, payment_month, payment_date, unit_id')
        .gte('payment_date', monthFirst)
        .lte('payment_date', monthEnd),
      sb.from('expenses').select('amount').eq('period_month', monthFirst),
      sb.from('owner_payments').select('amount').eq('period_month', monthFirst),
      sb.from('deposits').select('refund_amount, refund_date').eq('status','refunded')
        .gte('refund_date', monthFirst)
        .lte('refund_date', monthEnd),
      sb.from('moves').select('type, status'),
    ]);

    if (unitsRes.error)    throw unitsRes.error;
    if (paymentsRes.error) throw paymentsRes.error;

    const units        = unitsRes.data    || [];
    const payments     = paymentsRes.data || [];
    const expenses     = expensesRes.data || [];
    const ownerPays    = ownerRes.data    || [];
    const refunds      = depositsRes.data || [];
    const allMoves     = movesRes.data    || [];

    // ── Stats ──
    const totalUnits  = units.length;
    const occupied    = units.filter(u => !u.is_vacant && u.unit_status === 'occupied').length;
    const vacant      = units.filter(u => u.is_vacant).length;
    const reserved    = units.filter(u => u.unit_status === 'reserved').length;
    const maintenance = units.filter(u => u.unit_status === 'maintenance').length;
    const leavingSoon = units.filter(u => u.unit_status === 'leaving_soon').length;

    // جديد هذا الشهر (start_date في نفس الشهر)
    const newThisMonth = units.filter(u => u.start_date && u.start_date.startsWith(monthFirst.slice(0,7))).length;

    // ── Cash basis (payment_date هذا الشهر) ──
    const totalCollected = payments.reduce((s,p) => s + parseFloat(p.amount||0), 0);

    // ── Accrual basis (payment_month = الشهر الحالي) ──
    // جيب المدفوعات مع unit_id و tenant_num للـ late payers و dual-tenant
    const accrualRes = await sb.from('rent_payments')
      .select('unit_id, amount, tenant_num')
      .eq('payment_month', monthFirst);
    if (accrualRes.error) throw accrualRes.error;
    const accrualCollected = (accrualRes.data||[]).reduce((s,p) => s + parseFloat(p.amount||0), 0);

    const target    = units.filter(u => !u.is_vacant && u.unit_status === 'occupied')
                           .reduce((s,u) => s + parseFloat(u.monthly_rent||0), 0);
    const remaining = Math.max(0, target - accrualCollected);
    const collRate  = target > 0 ? Math.round((accrualCollected / target) * 100) : 0;

    const totalExp     = expenses.reduce((s,e) => s + parseFloat(e.amount||0), 0);
    const totalOwner   = ownerPays.reduce((s,o) => s + parseFloat(o.amount||0), 0);
    const totalRefunds = refunds.reduce((s,d) => s + parseFloat(d.refund_amount||0), 0);
    const netProfit    = totalCollected - totalExp - totalOwner - totalRefunds;

    const pendingArrivals   = allMoves.filter(m => m.type==='arrive' && m.status==='pending').length;
    const pendingDepartures = allMoves.filter(m => m.type==='depart' && m.status==='pending').length;

    const barColor = collRate >= 90 ? 'var(--green)' : collRate >= 60 ? 'var(--amber)' : 'var(--red)';

    container.innerHTML = `
<div class="home-month-label">${Helpers.fmtMonth(monthFirst)}</div>

<div class="kpi-grid">
  <div class="kpi-card kpi-green">
    <div class="kpi-icon">💵</div>
    <div class="kpi-value">${Helpers.formatAED(totalCollected)}</div>
    <div class="kpi-label">${t('kpi_collected')}</div>
  </div>
  <div class="kpi-card kpi-blue">
    <div class="kpi-icon">🎯</div>
    <div class="kpi-value">${Helpers.formatAED(target)}</div>
    <div class="kpi-label">${t('kpi_target')}</div>
  </div>
  <div class="kpi-card kpi-amber">
    <div class="kpi-icon">⏳</div>
    <div class="kpi-value">${Helpers.formatAED(remaining)}</div>
    <div class="kpi-label">${t('kpi_remaining')}</div>
  </div>
  <div class="kpi-card kpi-purple">
    <div class="kpi-icon">📊</div>
    <div class="kpi-value">${String(collRate)}%</div>
    <div class="kpi-label">${t('kpi_rate')}</div>
  </div>
</div>

<div class="progress-wrap">
  <div class="progress-bar" style="width:${collRate}%; background:${barColor}"></div>
</div>

<div class="net-card">
  <span class="net-label">${t('net_profit')}</span>
  <span class="net-value ${netProfit >= 0 ? 'green' : 'red'}">${Helpers.formatAED(netProfit)}</span>
  <div class="net-breakdown">
    <span>${t('expenses_lbl')}: ${Helpers.formatAED(totalExp)}</span>
    <span>${t('owner_lbl')}: ${Helpers.formatAED(totalOwner)}</span>
    <span>${t('refunds_lbl')}: ${Helpers.formatAED(totalRefunds)}</span>
  </div>
</div>

<div class="status-grid">
  <div class="stat-item"><span class="stat-val stat-green">${String(occupied)}</span><span class="stat-lbl">${t('stat_occupied')}</span></div>
  <div class="stat-item"><span class="stat-val stat-muted">${String(vacant)}</span><span class="stat-lbl">${t('stat_vacant')}</span></div>
  <div class="stat-item"><span class="stat-val stat-amber">${String(leavingSoon)}</span><span class="stat-lbl">${t('stat_leaving')}</span></div>
  <div class="stat-item"><span class="stat-val stat-blue">${String(reserved)}</span><span class="stat-lbl">${t('stat_reserved')}</span></div>
  <div class="stat-item"><span class="stat-val stat-red">${String(maintenance)}</span><span class="stat-lbl">${t('stat_maintenance')}</span></div>
  <div class="stat-item"><span class="stat-val stat-green">${String(newThisMonth)}</span><span class="stat-lbl">${t('stat_new')}</span></div>
</div>

${(pendingArrivals + pendingDepartures) > 0 ? `
<div class="pending-moves">
  ${pendingArrivals   > 0 ? `<div class="pending-chip chip-green" onclick="goPanel('moves')">🆕 ${pendingArrivals} ${t('pending_arrivals')}</div>` : ''}
  ${pendingDepartures > 0 ? `<div class="pending-chip chip-amber" onclick="goPanel('moves')">🚪 ${pendingDepartures} ${t('pending_departures')}</div>` : ''}
</div>` : ''}

<div class="section-title">${t('quick_access')}</div>
<div class="quick-links">
  <button class="quick-btn" onclick="goPanel('units')"><span>${t('quick_units')}</span></button>
  <button class="quick-btn" onclick="goPanel('pay')"><span>${t('quick_pay')}</span></button>
  <button class="quick-btn" onclick="goPanel('reports')"><span>${t('quick_reports')}</span></button>
  <button class="quick-btn" onclick="loadCollReport()"><span>📊 ${t('quick_coll_report')}</span></button>
  <button class="quick-btn" onclick="goPanel('moves')"><span>${t('quick_moves')}</span></button>
</div>

<div class="section-title" style="margin-top:20px">${t('late_payers_title')}</div>
<div id="late-payers-list"><div class="loading" style="padding:20px">⏳</div></div>
`;

    // تحميل المتأخرون بعد render الصفحة
    loadLatePayers(monthFirst, units, accrualRes.data || []);

  } catch (err) {
    console.error('loadHome error:', err);
    container.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}


// ══════════════════════════════════════════
// loadCollReport — تقرير التحصيل السريع
// اختيار شهر → KPI bar + قائمة مجمّعة حسب شقة + PDF
// ══════════════════════════════════════════
async function loadCollReport() {
  const monthFirst = Helpers.currentMonthFirst();
  openDrawer(`
<div class="drawer-form">
  <div class="drawer-form-header">
    <h2>📊 ${t('quick_report_title')}</h2>
    <button class="close-btn" onclick="closeDrawer()">✕</button>
  </div>
  <div class="report-controls" style="margin-bottom:16px">
    <input type="month" id="coll-month" value="${monthFirst.slice(0,7)}"
      onchange="renderCollReport()">
    <button class="btn btn-secondary" onclick="exportCollPDF()">${t('btn_export_pdf')}</button>
  </div>
  <div id="coll-report-body"><div class="loading">${t('loading')}</div></div>
</div>`);
  await renderCollReport();
}

async function renderCollReport() {
  const monthEl = document.getElementById('coll-month');
  const body    = document.getElementById('coll-report-body');
  if (!monthEl || !body) return;

  const monStart = monthEl.value + '-01';
  const monEnd   = Helpers.monthEnd(monStart);

  try {
    const [unitsRes, paysRes, depsRes, refundsRes] = await Promise.all([
      sb.from('units').select('id,apartment,room,tenant_name,monthly_rent,is_vacant').order('apartment').order('room'),
      sb.from('rent_payments').select('unit_id,amount').eq('payment_month', monStart),
      sb.from('deposits').select('unit_id,amount').gte('deposit_received_date', monStart).lte('deposit_received_date', monEnd),
      sb.from('deposits').select('unit_id,refund_amount').gt('refund_amount',0).gte('refund_date', monStart).lte('refund_date', monEnd),
    ]);

    if (unitsRes.error) throw unitsRes.error;

    const units   = unitsRes.data || [];
    const pays    = paysRes.data  || [];
    const deps    = depsRes.data  || [];
    const refunds = refundsRes.data || [];

    const paidMap = {};
    pays.forEach(p => { paidMap[p.unit_id] = (paidMap[p.unit_id]||0) + parseFloat(p.amount||0); });

    const totalRent    = pays.reduce((s,p) => s+parseFloat(p.amount||0), 0);
    const totalDeps    = deps.reduce((s,d) => s+parseFloat(d.amount||0), 0);
    const totalRefunds = refunds.reduce((s,r) => s+parseFloat(r.refund_amount||0), 0);
    const totalTarget  = units.filter(u => !u.is_vacant).reduce((s,u) => s+parseFloat(u.monthly_rent||0), 0);
    const totalNet     = totalRent + totalDeps - totalRefunds;

    // تجميع حسب شقة
    const aptMap = {};
    units.filter(u => !u.is_vacant).forEach(u => {
      const apt = u.apartment;
      if (!aptMap[apt]) aptMap[apt] = { apt, units: [], paid: 0, target: 0 };
      const paid = paidMap[u.id] || 0;
      aptMap[apt].units.push({ ...u, paid });
      aptMap[apt].paid   += paid;
      aptMap[apt].target += parseFloat(u.monthly_rent||0);
    });

    const groups = Object.values(aptMap).sort((a,b) => a.apt.localeCompare(b.apt, undefined, {numeric:true}));
    window._collReportData = { groups, totalRent, totalDeps, totalRefunds, totalTarget, totalNet, monStart };

    body.innerHTML = `
<div id="coll-report-content">
<div class="rpt-kpi-bar">
  <div class="rpt-kpi"><span class="rpt-kpi-val green">${Helpers.formatAED(totalRent)}</span><span class="rpt-kpi-lbl">${t('kpi_collected')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val blue">${Helpers.formatAED(totalDeps)}</span><span class="rpt-kpi-lbl">${t('deposits_received')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val red">${Helpers.formatAED(totalRefunds)}</span><span class="rpt-kpi-lbl">${t('refunds_lbl')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val amber">${Helpers.formatAED(Math.max(0,totalTarget-totalRent))}</span><span class="rpt-kpi-lbl">${t('kpi_remaining')}</span></div>
  <div class="rpt-kpi"><span class="rpt-kpi-val">${Helpers.formatAED(totalNet)}</span><span class="rpt-kpi-lbl">${t('net_profit')}</span></div>
</div>
${groups.map(g => `
<div class="rpt-apt-group">
  <div class="rpt-apt-header">
    <span>${t('apt_label')} ${Helpers.escapeHtml(g.apt)}</span>
    <span class="${g.paid >= g.target && g.target>0 ? 'green' : g.paid>0 ? 'amber' : 'red'}">${Helpers.formatAED(g.paid)} / ${Helpers.formatAED(g.target)}</span>
  </div>
  ${g.units.map(u => `
  <div class="rpt-unit-row">
    <span class="muted">${t('room_label')} ${Helpers.escapeHtml(u.room)}</span>
    <span>${Helpers.escapeHtml(u.tenant_name||'—')}</span>
    <span class="${u.paid>=parseFloat(u.monthly_rent||0)?'green':u.paid>0?'amber':'red'}">${Helpers.formatAED(u.paid)}</span>
    <span class="muted">${Helpers.formatAED(u.monthly_rent)}</span>
  </div>`).join('')}
</div>`).join('')}
</div>`;
  } catch(err) {
    body.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

async function exportCollPDF() {
  const d = window._collReportData;
  if (!d) return;
  const bodyHTML = document.getElementById('coll-report-content')?.innerHTML || '';
  if (typeof exportPDF === 'function') {
    await exportPDF(`${t('quick_report_title')} — ${Helpers.fmtMonth(d.monStart)}`, bodyHTML);
  }
}

// ─────────────────────────────────────────
// loadLatePayers — المتأخرون عن الدفع
// ─────────────────────────────────────────
async function loadLatePayers(monthFirst, units, paidThisMonth) {
  const container = document.getElementById('late-payers-list');
  if (!container) return;

  try {
    // بناء map للمدفوعين هذا الشهر
    const paidMap = {};
    paidThisMonth.forEach(p => {
      paidMap[p.unit_id] = (paidMap[p.unit_id] || 0) + parseFloat(p.amount || 0);
    });

    // الوحدات المشغولة اللي ما دفعتش
    const lateUnits = units.filter(u => {
      if (u.is_vacant || u.unit_status !== 'occupied') return false;
      const paid = paidMap[u.id] || 0;
      const required = parseFloat(u.monthly_rent || 0);
      return required > 0 && paid < required;
    });

    // جيب تفاصيل الوحدات المتأخرة
    if (lateUnits.length === 0) {
      container.innerHTML = `<div class="empty-msg" style="padding:16px">✅ ${t('no_late_payers')}</div>`;
      return;
    }

    const unitIds = lateUnits.map(u => u.id);
    const { data: details, error } = await sb
      .from('units')
      .select('id, apartment, room, tenant_name, tenant_name2, phone, phone2, monthly_rent, rent1, rent2, language')
      .in('id', unitIds);
    if (error) throw error;

    // إرسال جماعي
    const bulkBtn = `
      <button class="btn btn-whatsapp btn-full" style="margin-bottom:10px"
        onclick="sendBulkReminder()">
        💬 ${t('send_bulk_reminder')} (${lateUnits.length})
      </button>`;

    const rows = (details || []).map(u => {
      const paid  = paidMap[u.id]  || 0;
      const paid1 = paid1Map[u.id] || 0;
      const paid2 = paid2Map[u.id] || 0;
      const due   = Math.max(0, parseFloat(u.monthly_rent||0) - paid);
      const due1  = Math.max(0, parseFloat(u.rent1||0) - paid1);
      const due2  = Math.max(0, parseFloat(u.rent2||0) - paid2);
      const hasDual = u.tenant_name2 && u.rent2 > 0;

      return `
      <div class="late-card">
        <div class="late-info">
          <span class="late-unit">${t('apt_label')} ${Helpers.escapeHtml(u.apartment)} — ${t('room_label')} ${Helpers.escapeHtml(u.room)}</span>
          <span class="late-name">${Helpers.escapeHtml(u.tenant_name || '—')}</span>
          ${hasDual ? `<span class="late-name muted small">& ${Helpers.escapeHtml(u.tenant_name2)}</span>` : ''}
          <span class="late-due red">${t('remaining_prefix')}: ${Helpers.formatAED(due)}</span>
        </div>
        <div style="display:flex;gap:6px">
          ${u.phone ? `
          <button class="icon-btn" title="${Helpers.escapeHtml(u.tenant_name||'')}"
            onclick="sendSingleReminder('${u.id}','${Helpers.escapeHtml(u.phone)}','${Helpers.escapeHtml(u.tenant_name||'')}',${hasDual?due1:due},'${u.language||'AR'}')">
            💬
          </button>` : ''}
          ${hasDual && u.phone2 && due2 > 0 ? `
          <button class="icon-btn" title="${Helpers.escapeHtml(u.tenant_name2||'')}"
            onclick="sendSingleReminder('${u.id}','${Helpers.escapeHtml(u.phone2)}','${Helpers.escapeHtml(u.tenant_name2||'')}',${due2},'${u.language||'AR'}')">
            💬2
          </button>` : ''}
        </div>
      </div>`;
    }).join('');

    container.innerHTML = bulkBtn + `<div class="late-list">${rows}</div>`;

    // حفظ للـ bulk send
    window._lateUnitsDetails = details || [];
    window._paidMap  = paidMap;
    window._paid1Map = paid1Map;
    window._paid2Map = paid2Map;
    window._currentMonth = monthFirst;

  } catch (err) {
    console.error('loadLatePayers error:', err);
    container.innerHTML = `<div class="error-msg" style="padding:10px">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}

// ─────────────────────────────────────────
// sendSingleReminder
// ─────────────────────────────────────────
function sendSingleReminder(unitId, phone, name, due, lang) {
  const unit = { tenant_name: name, apartment: '', room: '' };
  const msg  = Helpers.rentReminderMsg(unit, window._currentMonth || Helpers.currentMonthFirst(), due, lang);
  Helpers.openWhatsApp(phone, msg);
}

// ─────────────────────────────────────────
// sendBulkReminder — إرسال جماعي مع دعم المستأجرين الاتنين
// ─────────────────────────────────────────
function sendBulkReminder() {
  const units   = window._lateUnitsDetails || [];
  const paid1Map = window._paid1Map || window._paidMap || {};
  const paid2Map = window._paid2Map || {};
  const month   = window._currentMonth || Helpers.currentMonthFirst();

  if (units.length === 0) return;

  // بناء قائمة الرسائل المطلوبة (قد يكون في وحدة رسالتان)
  const queue = [];
  units.forEach(u => {
    const hasDual = u.tenant_name2 && parseFloat(u.rent2 || 0) > 0;

    if (hasDual) {
      // مستأجر 1
      const due1 = Math.max(0, parseFloat(u.rent1||0) - (paid1Map[u.id]||0));
      if (u.phone && due1 > 0) {
        queue.push({ phone: u.phone, name: u.tenant_name, due: due1, lang: u.language, unit: u });
      }
      // مستأجر 2
      const due2 = Math.max(0, parseFloat(u.rent2||0) - (paid2Map[u.id]||0));
      if (u.phone2 && due2 > 0) {
        queue.push({ phone: u.phone2, name: u.tenant_name2, due: due2, lang: u.language, unit: u });
      }
    } else {
      const due = Math.max(0, parseFloat(u.monthly_rent||0) - (paid1Map[u.id]||0));
      if (u.phone && due > 0) {
        queue.push({ phone: u.phone, name: u.tenant_name, due, lang: u.language, unit: u });
      }
    }
  });

  let i = 0;
  function sendNext() {
    if (i >= queue.length) { toast(t('bulk_sent'), 'success'); return; }
    const item = queue[i++];
    const msg  = Helpers.rentReminderMsg(
      { ...item.unit, tenant_name: item.name },
      month, item.due, item.lang || 'AR'
    );
    Helpers.openWhatsApp(item.phone, msg);
    setTimeout(sendNext, 600);
  }
  sendNext();
}
