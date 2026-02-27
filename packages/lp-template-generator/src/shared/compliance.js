/**
 * Shared Compliance Components
 * ============================
 * APR table, disclaimer text, legal modals.
 * These must be IDENTICAL across all templates for legal safety.
 */

/**
 * Calculate monthly payment
 */
function calcPayment(principal, apr, months) {
  const r = apr / 100 / 12;
  if (r === 0) return principal / months;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

/**
 * Generate APR table rows
 */
export function generateAPRRows(config) {
  const { amountMin, amountMax, aprMin, aprMax } = config;
  const steps = [0, 0.25, 0.5, 0.75, 1];
  
  return steps.map((pct, i) => {
    const amt = Math.round(amountMin + (amountMax - amountMin) * pct);
    const term = [12, 24, 36, 48, 60][i] || 36;
    const minPay = Math.round(calcPayment(amt, aprMin, term));
    const maxPay = Math.round(calcPayment(amt, aprMax, term));
    return { amt, term, minPay, maxPay, minTotal: minPay * term, maxTotal: maxPay * term };
  });
}

/**
 * Generate representative example
 */
export function getRepExample(config) {
  const amt = Math.round(config.amountMin + (config.amountMax - config.amountMin) * 0.5);
  const term = 36;
  const apr = 9.99;
  const pay = Math.round(calcPayment(amt, apr, term));
  const total = pay * term;
  return { amt, term, apr, pay, total, interest: total - amt };
}

/**
 * APR disclosure table HTML
 */
export function aprTableHTML(config) {
  const rows = generateAPRRows(config);
  const rep = getRepExample(config);
  const fmt = n => '$' + Number(n).toLocaleString();

  return `
    <div class="apr-section-title">APR &amp; Loan Cost Disclosure</div>
    <div class="apr-section-sub">Annual Percentage Rate (APR) ranges from <strong style="color:var(--primary)">${config.aprMin}% to ${config.aprMax}%</strong>. Actual rate depends on credit score, loan amount, and term.</div>
    <div class="apr-table-wrap"><table class="apr-table">
      <thead><tr><th>Amount</th><th>Term</th><th>APR Range</th><th>Monthly</th><th>Total</th></tr></thead>
      <tbody>
        ${rows.map(r => `<tr><td><strong>${fmt(r.amt)}</strong></td><td>${r.term} mo</td><td class="apr-col">${config.aprMin}%\u2013${config.aprMax}%</td><td>${fmt(r.minPay)}\u2013${fmt(r.maxPay)}</td><td>${fmt(r.minTotal)}\u2013${fmt(r.maxTotal)}</td></tr>`).join('\n        ')}
      </tbody>
    </table></div>
    <div class="apr-rep"><strong>Representative Example:</strong> ${fmt(rep.amt)} at ${rep.apr}% APR for ${rep.term} months = <strong>${fmt(rep.pay)}/mo</strong>, total <strong>${fmt(rep.total)}</strong>, interest <strong>${fmt(rep.interest)}</strong>.</div>
  `;
}

/**
 * Disclaimer text
 */
export function disclaimerHTML(config) {
  const fmt = n => '$' + Number(n).toLocaleString();
  return `<strong>\u26a0\ufe0f Important Disclosures</strong><br/>${config.brand} is not a lender and does not make credit decisions. We connect consumers with lending partners. Loan amounts ${fmt(config.amountMin)}\u2013${fmt(config.amountMax)}. Not available in all states. This is an advertisement.`;
}

/**
 * Legal popup modals HTML (Privacy, Terms, Contact, Disclosures)
 */
export function legalModalsHTML(config) {
  const rep = getRepExample(config);
  const fmt = n => '$' + Number(n).toLocaleString();
  const year = new Date().getFullYear();

  return `
  <div class="popup-overlay" id="privacyPopup"><div class="popup-card"><button class="popup-close" onclick="closePopup('privacyPopup')">\u2715</button><div class="popup-header"><h3>\ud83d\udd12 Privacy Policy</h3><p>Last updated: January ${year}</p></div><div class="popup-body"><p><strong>Information We Collect</strong><br/>We collect personal information you provide (name, email, ZIP, loan preferences) and device/browsing data via cookies.</p><p><strong>How We Use It</strong><br/>To connect you with lending partners. Not sold for unrelated marketing.</p><p><strong>Security</strong><br/>256-bit SSL encryption for all data.</p><p><strong>Contact</strong><br/>${config.brand}, ${config.address}<br/>${config.email}</p></div></div></div>
  <div class="popup-overlay" id="termsPopup"><div class="popup-card"><button class="popup-close" onclick="closePopup('termsPopup')">\u2715</button><div class="popup-header"><h3>\ud83d\udccb Terms of Service</h3><p>Last updated: January ${year}</p></div><div class="popup-body"><p><strong>Service</strong><br/>${config.brand} is a loan matching service, not a lender.</p><p><strong>Eligibility</strong><br/>Must be 18+, US citizen/resident with bank account and income.</p><p><strong>APR</strong><br/>${config.aprMin}%\u2013${config.aprMax}%. Amounts ${fmt(config.amountMin)}\u2013${fmt(config.amountMax)}.</p></div></div></div>
  <div class="popup-overlay" id="contactPopup"><div class="popup-card"><button class="popup-close" onclick="closePopup('contactPopup')">\u2715</button><div class="popup-header"><h3>\ud83d\udcde Contact Us</h3></div><div class="popup-body" style="text-align:center"><strong style="font-size:16px">${config.brand}</strong><p>\ud83d\udccd ${config.address}</p><p>\ud83d\udcde <a href="tel:${config.phone}" style="color:var(--primary);font-weight:700">${config.phone}</a></p><p>\u2709\ufe0f <a href="mailto:${config.email}" style="color:var(--primary)">${config.email}</a></p></div></div></div>
  <div class="popup-overlay" id="disclPopup"><div class="popup-card"><button class="popup-close" onclick="closePopup('disclPopup')">\u2715</button><div class="popup-header"><h3>\u26a0\ufe0f Disclosures</h3></div><div class="popup-body"><p>${config.brand} is NOT a lender. APR ${config.aprMin}%\u2013${config.aprMax}%.</p><p><strong>Example:</strong> ${fmt(rep.amt)} at ${rep.apr}% for ${rep.term} months = ${fmt(rep.pay)}/mo, total ${fmt(rep.total)}.</p></div></div></div>
  `;
}

/**
 * Modal CSS (shared by all templates)
 */
export function modalCSS() {
  return `
    .popup-overlay{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:opacity .3s}
    .popup-overlay.active{opacity:1;pointer-events:auto}
    .popup-card{background:#fff;border-radius:20px;width:100%;max-width:520px;max-height:85vh;overflow-y:auto;position:relative;box-shadow:0 32px 80px rgba(0,0,0,.3);animation:pop-in .35s cubic-bezier(.16,1,.3,1)}
    @keyframes pop-in{from{opacity:0;transform:translateY(30px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
    .popup-close{position:absolute;top:12px;right:12px;z-index:5;width:36px;height:36px;border-radius:50%;background:var(--bg);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;color:var(--fg-sub);transition:all .2s}
    .popup-close:hover{background:var(--fg);color:#fff}
    .popup-header{padding:28px 24px 0;text-align:center}
    .popup-header h3{font-size:20px;font-weight:800;margin-bottom:4px}
    .popup-header p{font-size:13px;color:var(--muted)}
    .popup-body{padding:20px 24px 28px;font-size:13px;color:var(--fg-sub);line-height:1.8}
    .popup-body p+p{margin-top:14px}
  `;
}

/**
 * Modal JS (shared by all templates)
 */
export function modalJS() {
  return `
    function openPopup(id){document.getElementById(id).classList.add('active');document.body.style.overflow='hidden'}
    function closePopup(id){document.getElementById(id).classList.remove('active');document.body.style.overflow=''}
    document.querySelectorAll('.popup-overlay').forEach(p=>p.addEventListener('click',function(e){if(e.target===this)closePopup(this.id)}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.popup-overlay.active').forEach(p=>closePopup(p.id))});
  `;
}

/**
 * Compliance section CSS
 */
export function complianceCSS() {
  return `
    .compliance{background:#fff;padding:40px 0;border-top:1px solid var(--border)}
    .compliance-text{font-size:12px;color:var(--fg-sub);line-height:1.9;text-align:center;max-width:800px;margin:0 auto}
    .compliance-text strong{color:var(--fg)}
    .compliance-text a{color:var(--primary);font-weight:600}
    .apr-section-title{font-size:16px;font-weight:800;color:var(--fg);text-align:center;margin:32px 0 8px}
    .apr-section-sub{font-size:13px;color:var(--fg-sub);text-align:center;margin-bottom:16px}
    .apr-table-wrap{overflow-x:auto;margin:0 auto;max-width:800px}
    .apr-table{width:100%;border-collapse:collapse;font-size:13px;border:2px solid var(--fg);border-radius:8px;overflow:hidden}
    .apr-table th{padding:12px 14px;font-weight:800;font-size:12px;background:var(--fg);color:#fff;text-align:left;text-transform:uppercase;letter-spacing:.5px}
    .apr-table td{padding:11px 14px;border-bottom:1px solid var(--border);font-weight:500}
    .apr-table tbody tr:nth-child(even){background:var(--bg)}
    .apr-col{font-weight:700;color:var(--primary)}
    .apr-rep{max-width:800px;margin:16px auto 0;background:#fef9e7;border:2px solid var(--accent);border-radius:10px;padding:16px 20px;font-size:13px;line-height:1.7;text-align:center}
    .apr-rep strong{color:var(--primary)}
  `;
}
