// Greenhouse: landscaping, lawn care, snow. Soft, seasonal, gallery-led.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | Landscaping in {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Karla:wght@400;500;700&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:17px/1.65 Karla,system-ui,sans-serif;color:#24352A;background:#F7F3E8}
h1,h2,h3{font-family:Fraunces,Georgia,serif;font-weight:400;line-height:1.05;letter-spacing:-.02em;color:#24452F}
a{color:inherit;text-decoration:none}.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
header .wrap{display:flex;align-items:center;gap:26px;height:82px}
.logo{display:flex;align-items:center;gap:10px;font:600 22px Fraunces,serif;color:#24452F}
.logo svg{width:30px;height:30px;color:#7A9A5B}
nav{display:flex;gap:26px;margin-left:auto;font-weight:500}
.pill{padding:11px 20px;border-radius:99px;background:#24452F;color:#F7F3E8;font-weight:700;border:0;cursor:pointer;font-size:16px;display:inline-block}
.pill.soft{background:#E4E9D2;color:#24452F}
.hero .wrap{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;padding-top:34px;padding-bottom:70px}
.hero h1{font-size:clamp(44px,6.4vw,84px)}.hero h1 i{color:#C8643C}
.hero p{margin:22px 0 28px;font-size:19px;max-width:42ch;color:#4A5B4F}
.blob{aspect-ratio:1/1.05;border-radius:62% 38% 46% 54%/55% 48% 52% 45%;background:radial-gradient(circle at 30% 25%,#A9C487,#5E8250 60%,#34573B);display:grid;place-items:center;color:rgba(255,255,255,.85);font:700 12px Karla,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-align:center;padding:40px;position:relative}
.blob:after{content:"";position:absolute;right:-14px;bottom:26px;width:120px;height:120px;border-radius:50%;background:#C8643C;opacity:.9;mix-blend-mode:multiply}
.note{display:flex;gap:14px;align-items:center;margin-top:26px;font-size:15px;color:#4A5B4F}.note b{font:600 30px Fraunces,serif;color:#C8643C}
section{padding:78px 0}.eyebrow{font-weight:700;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#7A9A5B}
h2{font-size:clamp(34px,4.4vw,54px);margin:8px 0 38px;max-width:18ch}
.seasons{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.season{padding:26px 22px;border-radius:26px;background:#fff}
.season:nth-child(1){background:#E4E9D2}.season:nth-child(2){background:#F6E3B9}.season:nth-child(3){background:#F1D2BE}.season:nth-child(4){background:#DDE7EA}
.season h3{font-size:28px;margin-bottom:12px}.season ul{list-style:none;padding:0;display:grid;gap:7px;font-size:16px}.season li:before{content:"·  ";font-weight:700}
.green{background:#24452F;color:#EAE6D6}.green h2,.green h3{color:#F7F3E8}
.mosaic{display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:170px;gap:12px}
.ph{border-radius:22px;display:grid;place-items:center;background:linear-gradient(140deg,#6E9160,#3C6144);color:rgba(255,255,255,.8);font:700 11px Karla,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-align:center;padding:14px}
.ph.a{grid-column:span 2;grid-row:span 2}.ph.b{grid-row:span 2;background:linear-gradient(140deg,#B88A5C,#7C5637)}.ph.c{background:linear-gradient(140deg,#8FA9A0,#547066)}.ph.d{grid-column:span 2;background:linear-gradient(140deg,#A9C487,#6E9160)}
.path{display:grid;grid-template-columns:repeat(4,1fr);gap:22px;position:relative}
.stop span{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;background:#C8643C;color:#fff;font:600 20px Fraunces,serif;margin-bottom:14px}
.stop h3{font-size:23px;margin-bottom:6px}.stop p{font-size:16px;color:#4A5B4F}
blockquote{font:400 clamp(26px,3.6vw,42px)/1.25 Fraunces,serif;color:#24452F;max-width:24ch;margin:0 auto;text-align:center}
blockquote footer{font:700 14px Karla,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#7A9A5B;margin-top:22px}
.contact{display:grid;grid-template-columns:1fr 1fr;gap:50px}
form{display:grid;gap:12px;background:#fff;padding:30px;border-radius:28px}
input,select,textarea{width:100%;padding:13px 15px;border:1.5px solid #D9D4C3;border-radius:14px;font:inherit;background:#FCFAF4}
.foot{padding:34px 0;font-size:15px;color:#6B7A6E;border-top:1px solid #E2DCCB}
@media(max-width:860px){nav{display:none}header .pill{margin-left:auto}.hero .wrap,.seasons,.path,.contact{grid-template-columns:1fr}.mosaic{grid-template-columns:1fr 1fr}section{padding:54px 0}.blob{max-width:380px}}
</style></head><body>
<header><div class="wrap"><a class="logo" href="#top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21V9M12 9c0-4 3-6 7-6 0 4-2 7-7 6zM12 13c0-3-2-5-6-5 0 3 2 5 6 5z"/></svg>{{business}}</a>
<nav><a href="#services">Services</a><a href="#work">Our work</a><a href="#process">Process</a></nav><a class="pill" href="tel:{{tel}}">{{phone}}</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><div><h1>Yards worth <i>coming home</i> to.</h1>
<p>Design, planting, stonework and care for {{city}} gardens. One crew that knows your property, every season.</p>
<a class="pill" href="#contact">Plan my yard</a> <a class="pill soft" href="#work">See our work</a>
<div class="note"><b>18</b><span>years growing gardens<br>around {{city}}</span></div></div>
<div class="blob">Photo: your best garden</div></div></div>
<section id="services" style="padding-top:20px"><div class="wrap"><div class="eyebrow">Through the year</div><h2>The right work, at the right time.</h2>
<div class="seasons"><div class="season"><h3>Spring</h3><ul><li>Clean-up and edging</li><li>Mulch and soil</li><li>New planting</li><li>Lawn repair</li></ul></div>
<div class="season"><h3>Summer</h3><ul><li>Weekly mowing</li><li>Garden care</li><li>Patios and paths</li><li>Irrigation</li></ul></div>
<div class="season"><h3>Fall</h3><ul><li>Leaf removal</li><li>Aeration and seed</li><li>Tree and shrub pruning</li><li>Bulb planting</li></ul></div>
<div class="season"><h3>Winter</h3><ul><li>Snow plowing</li><li>Walkway shovelling</li><li>Salt and sand</li><li>Design for spring</li></ul></div></div></div></section>
<section class="green" id="work"><div class="wrap"><div class="eyebrow">Recent projects</div><h2>From bare lots to back gardens.</h2>
<div class="mosaic"><div class="ph a">Photo: a finished back yard</div><div class="ph b">Photo: stone path</div><div class="ph c">Photo: front bed</div><div class="ph c">Photo: water feature</div><div class="ph d">Photo: patio at dusk</div><div class="ph">Photo: lawn stripes</div></div></div></section>
<section id="process"><div class="wrap"><div class="eyebrow">How a project goes</div><h2>Four steps, one point of contact.</h2>
<div class="path"><div class="stop"><span>1</span><h3>Walk the yard</h3><p>We visit, listen and measure. Free, about 40 minutes.</p></div><div class="stop"><span>2</span><h3>A plan and a price</h3><p>A drawing, a plant list and one fixed number.</p></div><div class="stop"><span>3</span><h3>We build it</h3><p>Our own crew, with a foreman you can text.</p></div><div class="stop"><span>4</span><h3>We keep it growing</h3><p>Optional care plans, so it looks better every year.</p></div></div></div></section>
<section style="background:#EFE9D8"><div class="wrap"><blockquote>They turned a muddy slope into the place we eat dinner all summer.<footer>The Okafor family, {{city}}</footer></blockquote></div></section>
<section id="contact"><div class="wrap contact"><div><div class="eyebrow">Start here</div><h2>Tell us about your yard.</h2><p>Send a few lines, or call <a href="tel:{{tel}}" style="font-weight:700;color:#C8643C">{{phone}}</a>. We book site visits within the week from April to November.</p></div>
<form onsubmit="return false"><input placeholder="Your name"><input placeholder="Phone or email"><select><option>Design and build</option><option>Lawn and garden care</option><option>Stonework</option><option>Snow removal</option></select><textarea rows="3" placeholder="What would you like done?"></textarea><button class="pill">Send it</button></form></div></section>
</main>
<div class="foot"><div class="wrap">© {{business}} · Serving {{city}}, Komoka, Arva and Dorchester</div></div>
</body></html>`;
export default html;
