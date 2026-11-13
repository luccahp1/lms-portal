// Ridgeline: roofing, eavestrough, siding, renovation. Dark and confident, before and after.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | Roofing and exteriors in {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:17px/1.6 Barlow,system-ui,sans-serif;color:#1C1F22;background:#F4F1EC}
h1,h2,h3{font-family:"Barlow Condensed",sans-serif;text-transform:uppercase;line-height:.98;letter-spacing:.01em}
a{color:inherit;text-decoration:none}.wrap{max-width:1180px;margin:0 auto;padding:0 24px}
header{position:absolute;top:0;left:0;right:0;z-index:5;color:#fff}
header .wrap{display:flex;align-items:center;gap:28px;height:84px}
.logo{font:800 26px "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:.04em}
.logo span{color:#C8743B}
nav{display:flex;gap:26px;margin-left:auto;font-weight:600;font-size:15px;text-transform:uppercase;letter-spacing:.08em}
.tel{padding:10px 18px;border:2px solid #C8743B;font:700 20px "Barlow Condensed",sans-serif;letter-spacing:.04em}
.hero{position:relative;min-height:640px;display:flex;align-items:flex-end;color:#fff;background:linear-gradient(115deg,#15181B 0%,#15181B 52%,transparent 52.2%),repeating-linear-gradient(135deg,#3A3F45 0 22px,#33383D 22px 44px);padding:150px 0 70px}
.hero:after{content:"Photo: a finished roof at golden hour";position:absolute;right:6%;bottom:44%;font:600 12px Barlow,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.hero h1{font-size:clamp(52px,8.5vw,112px);font-weight:800;max-width:9ch}
.hero h1 b{color:#C8743B}
.hero p{max-width:40ch;margin:20px 0 28px;color:#C9CDD2;font-size:19px}
.btn{display:inline-block;padding:16px 30px;background:#C8743B;color:#fff;font:700 20px "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:.08em;border:0;cursor:pointer}
.btn.ghost{background:transparent;border:2px solid rgba(255,255,255,.4);margin-left:10px}
.badges{background:#C8743B;color:#fff}.badges .wrap{display:grid;grid-template-columns:repeat(4,1fr)}
.badge{padding:22px 18px;border-left:1px solid rgba(255,255,255,.25);font-weight:500;font-size:15px}
.badge b{display:block;font:800 30px "Barlow Condensed",sans-serif;text-transform:uppercase}
section{padding:84px 0}h2{font-size:clamp(36px,5vw,62px);font-weight:800;margin-bottom:36px}h2 b{color:#C8743B}
.list{display:grid;grid-template-columns:1fr 1fr;gap:0 56px}
.row{display:grid;grid-template-columns:70px 1fr;gap:16px;padding:22px 0;border-top:2px solid #1C1F22}
.row i{font:800 46px "Barlow Condensed",sans-serif;font-style:normal;color:#C8743B;line-height:1}
.row h3{font-size:28px;font-weight:700;margin-bottom:4px}.row p{color:#5B6067;font-size:16px}
.dark{background:#1C1F22;color:#fff}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.ph{position:relative;min-height:340px;display:grid;place-items:center;background:repeating-linear-gradient(135deg,#34393F 0 20px,#2D3237 20px 40px);color:rgba(255,255,255,.6);font:600 12px Barlow,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-align:center;padding:20px}
.ph em{position:absolute;top:0;left:0;padding:8px 16px;background:#C8743B;color:#fff;font:700 18px "Barlow Condensed",sans-serif;font-style:normal;letter-spacing:.1em}
.fin{background:#fff;border-left:10px solid #C8743B;padding:38px 42px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between}
.fin h3{font-size:40px;font-weight:800}.fin p{color:#5B6067;max-width:44ch}
.quotes{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
.q{border-top:4px solid #C8743B;padding-top:18px;font-size:17px}.q b{display:block;margin-top:12px;font:700 18px "Barlow Condensed",sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#C8743B}
.form{display:grid;grid-template-columns:1fr 1fr;gap:54px;align-items:start}
form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
input,select,textarea{width:100%;padding:14px;background:#2A2E33;border:1px solid #454B52;color:#fff;font:inherit}
textarea,form .btn{grid-column:1/-1}::placeholder{color:#8F969E}
footer{background:#111315;color:#8F969E;padding:30px 0;font-size:14px;text-transform:uppercase;letter-spacing:.08em}
@media(max-width:860px){nav{display:none}.tel{margin-left:auto}.hero{background:linear-gradient(180deg,rgba(21,24,27,.92),rgba(21,24,27,.88)),repeating-linear-gradient(135deg,#3A3F45 0 22px,#33383D 22px 44px);min-height:0;padding:130px 0 54px}.hero:after{display:none}.badges .wrap,.list,.ba,.quotes,.form,form{grid-template-columns:1fr}.btn.ghost{margin:10px 0 0}section{padding:56px 0}}
</style></head><body>
<header><div class="wrap"><a class="logo" href="#top">{{business}}</a>
<nav><a href="#services">Services</a><a href="#work">Our work</a><a href="#financing">Financing</a><a href="#quote">Free inspection</a></nav>
<a class="tel" href="tel:{{tel}}">{{phone}}</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><h1>Roofs that <b>outlast</b> the weather.</h1>
<p>Roofing, eavestrough and siding for {{city}} homes. Installed by our own crews, never subcontracted.</p>
<a class="btn" href="#quote">Book a free inspection</a><a class="btn ghost" href="tel:{{tel}}">Call {{phone}}</a></div></div>
<div class="badges"><div class="wrap"><div class="badge"><b>25 years</b>workmanship warranty</div><div class="badge"><b>1,400+</b>roofs in {{city}}</div><div class="badge"><b>WSIB</b>covered and fully insured</div><div class="badge"><b>Free</b>written estimate in 24 hours</div></div></div>
<section id="services"><div class="wrap"><h2>What we <b>build</b></h2><div class="list">
<div class="row"><i>01</i><div><h3>Roof replacement</h3><p>Architectural shingles and steel, with ice and water shield on every eave.</p></div></div>
<div class="row"><i>02</i><div><h3>Roof repair</h3><p>Leaks, lifted shingles and storm damage, usually fixed the same week.</p></div></div>
<div class="row"><i>03</i><div><h3>Eavestrough</h3><p>Seamless five and six inch aluminum, leaf guards, downspout rerouting.</p></div></div>
<div class="row"><i>04</i><div><h3>Siding and trim</h3><p>Vinyl, fibre cement and aluminum capping that ends the painting for good.</p></div></div>
<div class="row"><i>05</i><div><h3>Soffit and fascia</h3><p>Vented soffit that keeps your attic dry and your shingles cool.</p></div></div>
<div class="row"><i>06</i><div><h3>Skylights</h3><p>New installs and replacements, flashed properly so they never leak.</p></div></div>
</div></div></section>
<section class="dark" id="work"><div class="wrap"><h2>Before and <b>after</b></h2>
<div class="ba"><div class="ph"><em>Before</em>Photo: the old roof</div><div class="ph"><em>After</em>Photo: the same house, finished</div></div></div></section>
<section id="financing"><div class="wrap"><div class="fin"><div><h3>A new roof from $129 a month</h3><p>Zero down, approved in minutes, and no penalty for paying it off early. Ask for the numbers with your estimate.</p></div><a class="btn" href="#quote">See my options</a></div>
<div class="quotes" style="margin-top:64px"><div class="q">They found rot the last roofer shingled over, showed me photos, and fixed it for the price they quoted.<b>Helen R., {{city}}</b></div><div class="q">Two days, start to finish. The yard was cleaner when they left than when they came.<b>Tom B., Byron</b></div><div class="q">Third quote was theirs and the only one that climbed on the roof before pricing it.<b>Anita S., Komoka</b></div></div></div></section>
<section class="dark" id="quote"><div class="wrap form"><div><h2>Free <b>inspection</b></h2><p style="color:#C9CDD2">We climb up, take photos and tell you honestly whether you need a repair or a roof. You get a written price within 24 hours.</p><p style="margin-top:22px;font:800 44px 'Barlow Condensed',sans-serif"><a href="tel:{{tel}}">{{phone}}</a></p></div>
<form onsubmit="return false"><input placeholder="Name"><input placeholder="Phone"><input placeholder="Address" style="grid-column:1/-1"><select style="grid-column:1/-1"><option>Roof replacement</option><option>Roof repair</option><option>Eavestrough</option><option>Siding</option></select><textarea rows="3" placeholder="Anything we should know?"></textarea><button class="btn">Book my inspection</button></form></div></section>
</main>
<footer><div class="wrap">© {{business}} · {{city}}, Ontario · Licensed · Insured · WSIB</div></footer>
</body></html>`;
export default html;
