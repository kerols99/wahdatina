// ══════════════════════════════
// dashboard.js — الرئيسية والـ KPIs
// ══════════════════════════════

'use strict';

async function loadHome() {
  const container = document.getElementById('home-content');
  if (!container) return;
  container.innerHTML = '<div class="loading">⏳ جاري التحميل...</div>';

  try {
    const monthFirst = Helpers.currentMonthFirst();
    const todayStr   = Helpers.today();

    // جلب كل البيانات دفعة واحدة
    const [unitsRes, paymentsRes, expensesRes, ownerRes, depositsRes, movesRes] = await Promise.all([
      sb.from('units').select('id, monthly_rent, is_vacant, unit_status'),
      sb.from('rent_payments')
        .select('amount, payment_month, payment_date')
        .gte('payment_date', monthFirst.substring(0, 8) + '01')
        .lte('payment_date', monthFirst.substring(0, 8) + '31'),
      sb.from('expenses').select('amount').eq('period_month', monthFirst),
      sb.from('owner_payments').select('amount').eq('period_month', monthFirst),
      sb.from('deposits').select('refund_amount').eq('status', 'refunded').gte('refund_date', monthFirst.substring(0, 8) + '01'),
      sb.from('moves').select('type, status').eq('status', 'pending'),
    ]);

    // --- حساب KPIs ---
    const units        = unitsRes.data || [];
    const payments     = paymentsRes.data || [];
    const expenses     = expensesRes.data || [];
    const ownerPays    = ownerRes.data || [];
    const refunds      = depositsRes.data || [];
    const pendingMoves = movesRes.data || [];

    // الوحدات
    const totalUnits    = units.length;
    const occupied      = units.filter(u => !u.is_vacant && u.unit_status === 'occupied').length;
    const vacant        = units.filter(u => u.is_vacant).length;
    const reserved      = units.filter(u => u.unit_status === 'reserved').length;
    const maintenance   = units.filter(u => u.unit_status === 'maintenance').length;
    const leavingSoon   = units.filter(u => u.unit_status === 'leaving_soon').length;

    // المالي - Cash basis (payment_date هذا الشهر)
    const totalCollected = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

    // المالي - Accrual basis (payment_month = الشهر الحالي)
    const accrualPayments = await sb
      .from('rent_payments')
      .select('amount')
      .eq('payment_month', monthFirst);
    const accrualCollected = (accrualPayments.data || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);

    // المستهدف
    const target = units
      .filter(u => !u.is_vacant && u.unit_status === 'occupied')
      .reduce((s, u) => s + parseFloat(u.monthly_rent || 0), 0);

    const remaining    = Math.max(0, target - accrualCollected);
    const collRate     = target > 0 ? Math.round((accrualCollected / target) * 100) : 0;

    // الصافي
    const totalExp     = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const totalOwner   = ownerPays.reduce((s, o) => s + parseFloat(o.amount || 0), 0);
    const totalRefunds = refunds.reduce((s, d) => s + parseFloat(d.refund_amount || 0), 0);
    const netProfit    = totalCollected - totalExp - totalOwner - totalRefunds;

    const pendingArrivals   = pendingMoves.filter(m => m.type === 'arrive').length;
    const pendingDepartures = pendingMoves.filter(m => m.type === 'depart').length;

    // --- لون شريط التقدم ---
    const barColor = collRate >= 90 ? 'var(--green)' : collRate >= 60 ? 'var(--amber)' : 'var(--red)';

    container.innerHTML = `
<div class="home-month-label">${Helpers.fmtMonth(monthFirst)}</div>

<!-- KPI Cards -->
<div class="kpi-grid">
  <div class="kpi-card kpi-green">
    <div class="kpi-icon">💵</div>
    <div class="kpi-value">${Helpers.formatAED(totalCollected)}</div>
    <div class="kpi-label">إجمالي محصّل</div>
  </div>
  <div class="kpi-card kpi-blue">
    <div class="kpi-icon">🎯</div>
    <div class="kpi-value">${Helpers.formatAED(target)}</div>
    <div class="kpi-label">المستهدف</div>
  </div>
  <div class="kpi-card kpi-amber">
    <div class="kpi-icon">⏳</div>
    <div class="kpi-value">${Helpers.formatAED(remaining)}</div>
    <div class="kpi-label">المتبقي</div>
  </div>
  <div class="kpi-card kpi-purple">
    <div class="kpi-icon">📊</div>
    <div class="kpi-value">${collRate}%</div>
    <div class="kpi-label">نسبة التحصيل</div>
  </div>
</div>

<!-- Progress Bar -->
<div class="progress-wrap">
  <div class="progress-bar" style="width:${collRate}%; background:${barColor}"></div>
</div>

<!-- الصافي -->
<div class="net-card">
  <span class="net-label">الصافي</span>
  <span class="net-value ${netProfit >= 0 ? 'green' : 'red'}">${Helpers.formatAED(netProfit)}</span>
  <div class="net-breakdown">
    <span>مصاريف: ${Helpers.formatAED(totalExp)}</span>
    <span>مالك: ${Helpers.formatAED(totalOwner)}</span>
    <span>مرتجعات: ${Helpers.formatAED(totalRefunds)}</span>
  </div>
</div>

<!-- Status Grid -->
<div class="status-grid">
  <div class="stat-item">
    <span class="stat-val stat-green">${occupied}</span>
    <span class="stat-lbl">مشغولة</span>
  </div>
  <div class="stat-item">
    <span class="stat-val stat-muted">${vacant}</span>
    <span class="stat-lbl">شاغرة</span>
  </div>
  <div class="stat-item">
    <span class="stat-val stat-amber">${leavingSoon}</span>
    <span class="stat-lbl">مغادرة</span>
  </div>
  <div class="stat-item">
    <span class="stat-val stat-blue">${reserved}</span>
    <span class="stat-lbl">محجوزة</span>
  </div>
  <div class="stat-item">
    <span class="stat-val stat-red">${maintenance}</span>
    <span class="stat-lbl">صيانة</span>
  </div>
  <div class="stat-item">
    <span class="stat-val">${totalUnits}</span>
    <span class="stat-lbl">إجمالي</span>
  </div>
</div>

<!-- حجوزات وتنقلات -->
${(pendingArrivals + pendingDepartures) > 0 ? `
<div class="pending-moves">
  ${pendingArrivals > 0 ? `<div class="pending-chip chip-green" onclick="goPanel('moves')">🆕 ${pendingArrivals} حجز جديد</div>` : ''}
  ${pendingDepartures > 0 ? `<div class="pending-chip chip-amber" onclick="goPanel('moves')">🚪 ${pendingDepartures} مغادرة pending</div>` : ''}
</div>` : ''}

<!-- الوصول السريع -->
<div class="quick-links">
  <button class="quick-btn" onclick="goPanel('units')"><span>🏠 الوحدات</span></button>
  <button class="quick-btn" onclick="goPanel('pay')"><span>💰 تسجيل دفعة</span></button>
  <button class="quick-btn" onclick="goPanel('reports')"><span>📋 التقارير</span></button>
  <button class="quick-btn" onclick="goPanel('moves')"><span>🚀 التنقلات</span></button>
</div>
`;
  } catch (err) {
    console.error('loadHome error:', err);
    container.innerHTML = `<div class="error-msg">❌ ${Helpers.escapeHtml(err.message)}</div>`;
  }
}
