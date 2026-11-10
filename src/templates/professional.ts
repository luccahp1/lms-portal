// Ledger: accounting, law, insurance, real estate. Trust first, classic and precise.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@400;600&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:18px/1.7 "Source Sans 3",system-ui,sans-serif;color:#243044;background:#FAF7F0}
h1,h2,h3{font-family:"Libre Baskerville",Georgia,serif;font-weight:400;line-height:1.15;color:#14233B}
a{color:inherit;text-decoration:none}.wrap{max-width:1120px;margin:0 auto;padding:0 26px}
.top{background:#14233B;color:#C9D2E0;font-size:14px}.top .wrap{display:flex;justify-content:space-between;gap:16px;padding-top:8px;padding-bottom:8px}
header{border-bottom:1px solid #E2DCCD;background:#FAF7F0}
header .wrap{display:flex;align-items:center;gap:30px;height:88px}
.logo{font:700 24px "Libre Baskerville",serif;color:#14233B}.logo small{display:block;font:600 11px "Source Sans 3",sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#A8823A;margin-top:2px}
nav{display:flex;gap:30px;margin-left:auto;font-weight:600;font-size:16px}
.btn{display:inline-block;padding:14px 26px;background:#14233B;color:#fff;font:600 16px "Source Sans 3",sans-serif;border:0;cursor:pointer;border-radius:3px}
.btn.gold{background:#A8823A}.btn.line{background:transparent;color:#14233B;border:1.5px solid #14233B}
.hero .wrap{display:grid;grid-template-columns:1.2fr .8fr;gap:70px;padding-top:84px;padding-bottom:84px;align-items:center}
.over{font:600 13px "Source Sans 3",sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#A8823A}
.hero h1{font-size:clamp(40px,5.4vw,66px);margin:16px 0 22px}.hero h1 i{color:#A8823A}
.hero p{max-width:46ch;margin-bottom:32px;font-size:20px;color:#4B586C}
.figs{border-left:1px solid #D9D1BE;padding-left:44px;display:grid;gap:30px}
.fig b{display:block;font:400 52px "Libre Baskerville",serif;color:#14233B;line-height:1}.fig span{color:#4B586C;font-size:16px}
.creds{background:#fff;border-top:1px solid #E2DCCD;border-bottom:1px solid #E2DCCD}
.creds .wrap{display:flex;flex-wrap:wrap;gap:14px 44px;justify-content:center;padding-top:22px;padding-bottom:22px;font:600 13px "Source Sans 3",sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#6A7689}
section{padding:92px 0}h2{font-size:clamp(30px,4vw,44px);margin:12px 0 40px;max-width:22ch}
.areas{border-top:2px solid #14233B}
.area{display:grid;grid-template-columns:.9fr 1.4fr auto;gap:30px;align-items:center;padding:26px 0;border-bottom:1px solid #D9D1BE}
.area h3{font-size:24px}.area p{color:#4B586C;font-size:17px}.area span{font-size:24px;color:#A8823A}
.navy{background:#14233B;color:#C9D2E0}.navy h2,.navy h3{color:#fff}
.how{display:grid;grid-template-columns:1fr 1fr;gap:70px;align-items:start}
.how blockquote{font:italic 400 28px/1.45 "Libre Baskerville",serif;color:#fff;border-left:3px solid #A8823A;padding-left:28px}
.how cite{display:block;margin-top:18px;font:600 13px "Source Sans 3",sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#A8823A;font-style:normal}
.how ol{padding-left:22px;display:grid;gap:16px}.how li::marker{color:#A8823A;font-weight:600}
.partners{display:grid;grid-template-columns:repeat(3,1fr);gap:30px}
.ph{aspect-ratio:4/5;background:linear-gradient(170deg,#DDD6C6,#B9AF98);display:grid;place-items:center;color:rgba(20,35,59,.55);font:600 11px "Source Sans 3",sans-serif;letter-spacing:.22em;text-transform:uppercase;margin-bottom:18px}
.partners h3{font-size:22px}.partners p{font-size:16px;color:#4B586C}
.consult{display:grid;grid-template-columns:1fr 1fr;gap:60px;background:#fff;border:1px solid #E2DCCD;padding:54px}
form{display:grid;gap:14px}input,select,textarea{width:100%;padding:14px;border:1px solid #CFC7B4;border-radius:3px;font:inherit;background:#FDFCF8}
footer{background:#0E1929;color:#8793A6;padding:34px 0;font-size:15px}footer .wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
@media(max-width:860px){nav,.top span:last-child{display:none}header .btn{margin-left:auto;padding:11px 16px}.hero .wrap,.how,.partners,.consult,.area{grid-template-columns:1fr}.figs{border-left:0;padding-left:0;border-top:1px solid #D9D1BE;padding-top:30px}.area{gap:8px}.area span{display:none}.consult{padding:28px}section{padding:58px 0}.hero .wrap{padding-top:50px;padding-bottom:50px}}
</style></head><body>
<div class="top"><div class="wrap"><span>Tax deadline: we are booking April appointments now</span><span><a href="tel:{{tel}}">{{phone}}</a></span></div></div>
<header><div class="wrap"><a class="logo" href="#top">{{business}}<small>Chartered Professional Accountants</small></a><nav><a href="#areas">What we do</a><a href="#how">How we work</a><a href="#people">People</a></nav><a class="btn" href="#consult">Book a consultation</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><div><span class="over">{{city}}, Ontario · Est. 1998</span><h1>Clear books. <i>Calm</i> tax seasons.</h1>
<p>Accounting, tax and advice for owner-run businesses and the families behind them. You get a partner who knows your file, not a call centre.</p>
<a class="btn" href="#consult">Book a consultation</a> <a class="btn line" href="tel:{{tel}}">Call {{phone}}</a></div>
<div class="figs"><div class="fig"><b>26</b><span>years advising {{city}} businesses</span></div><div class="fig"><b>640</b><span>clients, most referred by another client</span></div><div class="fig"><b>1 day</b><span>to hear back, every time</span></div></div></div></div>
<div class="creds"><div class="wrap"><span>CPA Ontario</span><span>QuickBooks ProAdvisor</span><span>Xero Certified</span><span>{{city}} Chamber of Commerce</span></div></div>
<section id="areas"><div class="wrap"><span class="over">What we do</span><h2>Work we do every week, for businesses like yours.</h2>
<div class="areas">
<div class="area"><h3>Bookkeeping</h3><p>Monthly books closed by the tenth, with a one-page summary you can read in two minutes.</p><span>→</span></div>
<div class="area"><h3>Corporate tax</h3><p>Year-end, T2 returns and planning that starts well before December.</p><span>→</span></div>
<div class="area"><h3>Personal tax</h3><p>Owners, families, rentals and estates, filed properly and on time.</p><span>→</span></div>
<div class="area"><h3>Payroll and HST</h3><p>Remittances, T4s and filings handled, with reminders so nothing is late.</p><span>→</span></div>
<div class="area"><h3>Advice</h3><p>Buying, selling, incorporating or stepping back. A second opinion before you sign.</p><span>→</span></div>
</div></div></section>
<section class="navy" id="how"><div class="wrap how"><div><span class="over">How we work</span><h2>Fixed fees, agreed first.</h2>
<ol><li>A first conversation, free, to understand where you are.</li><li>A written scope and a fixed monthly or annual fee.</li><li>One named accountant who answers within a business day.</li><li>A review each year to check the fee still fits the work.</li></ol></div>
<blockquote>They found four years of missed credits in the first month, and I have not opened a shoebox of receipts since.<cite>Owner, a {{city}} contracting company</cite></blockquote></div></section>
<section id="people"><div class="wrap"><span class="over">The partners</span><h2>You will know who is looking after you.</h2>
<div class="partners"><div><div class="ph">Portrait</div><h3>Margaret Hartwell, CPA</h3><p>Founding partner. Owner-managed businesses.</p></div><div><div class="ph">Portrait</div><h3>Daniel Osei, CPA</h3><p>Corporate tax and reorganisations.</p></div><div><div class="ph">Portrait</div><h3>Ruth Chen, CPA</h3><p>Personal tax, trusts and estates.</p></div></div></div></section>
<section id="consult" style="padding-top:0"><div class="wrap"><div class="consult"><div><span class="over">Start here</span><h2 style="margin-bottom:16px">Book a free consultation.</h2><p>Thirty minutes, in person or by video. Bring your questions, and last year's return if you have it.</p><p style="margin-top:24px;font:400 30px 'Libre Baskerville',serif;color:#A8823A"><a href="tel:{{tel}}">{{phone}}</a></p></div>
<form onsubmit="return false"><input placeholder="Your name"><input placeholder="Business name"><input placeholder="Phone or email"><select><option>Bookkeeping</option><option>Corporate tax</option><option>Personal tax</option><option>Advice</option></select><textarea rows="3" placeholder="What would you like help with?"></textarea><button class="btn gold">Request a time</button></form></div></div></section>
</main>
<footer><div class="wrap"><span>© {{business}} · {{city}}, Ontario</span><span>Monday to Friday, 8:30 to 5</span></div></footer>
</body></html>`;
export default html;
