// Shop Floor: auto repair, tires, detailing. Technical, price list, hours.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | Auto repair in {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:16px/1.6 Inter,system-ui,sans-serif;color:#E9E9EC;background:#0E0E10}
h1,h2,h3{font-family:Oswald,sans-serif;text-transform:uppercase;line-height:1.02;letter-spacing:.01em}
a{color:inherit;text-decoration:none}.wrap{max-width:1160px;margin:0 auto;padding:0 22px}
.mono{font-family:"JetBrains Mono",ui-monospace,monospace}
.haz{height:10px;background:repeating-linear-gradient(-45deg,#E02424 0 16px,#0E0E10 16px 32px)}
header .wrap{display:flex;align-items:center;gap:26px;height:74px}
.logo{font:700 24px Oswald,sans-serif;text-transform:uppercase;letter-spacing:.06em}.logo b{color:#E02424}
nav{display:flex;gap:24px;margin-left:auto;font:500 13px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.06em;color:#A9A9B2}
.btn{display:inline-block;padding:14px 24px;background:#E02424;color:#fff;font:700 17px Oswald,sans-serif;text-transform:uppercase;letter-spacing:.08em;border:0;cursor:pointer;clip-path:polygon(0 0,100% 0,100% 70%,calc(100% - 12px) 100%,0 100%)}
.btn.line{background:transparent;border:2px solid #3A3A42;clip-path:none}
.hero .wrap{display:grid;grid-template-columns:1.25fr .75fr;gap:40px;align-items:end;padding-top:56px;padding-bottom:64px}
.hero h1{font-size:clamp(50px,8vw,104px);font-weight:700}.hero h1 span{color:#E02424}
.hero p{max-width:44ch;margin:20px 0 28px;color:#A9A9B2;font-size:18px}
.open{border:2px solid #2A2A30;padding:24px;background:#151518}
.open h2{font-size:15px;color:#A9A9B2;letter-spacing:.14em;margin-bottom:14px}
.open .now{display:flex;align-items:center;gap:10px;font:700 26px Oswald,sans-serif;text-transform:uppercase;margin-bottom:14px}
.open .now:before{content:"";width:12px;height:12px;border-radius:50%;background:#3DD68C;box-shadow:0 0 0 5px rgba(61,214,140,.2)}
.hrs{display:grid;grid-template-columns:1fr auto;gap:6px 18px;font:500 14px "JetBrains Mono",monospace;color:#C9C9D1}
.stats{border-top:2px solid #2A2A30;border-bottom:2px solid #2A2A30}.stats .wrap{display:grid;grid-template-columns:repeat(3,1fr)}
.stat{padding:30px 22px;border-left:2px solid #2A2A30}.stat:first-child{border-left:0;padding-left:0}
.stat b{display:block;font:700 46px Oswald,sans-serif;color:#E02424}.stat span{color:#A9A9B2}
section{padding:78px 0}h2.h{font-size:clamp(34px,4.6vw,56px);font-weight:700;margin-bottom:8px}.lead{color:#A9A9B2;margin-bottom:34px;max-width:56ch}
.menu{border-top:2px solid #2A2A30}
.item{display:grid;grid-template-columns:54px 1fr auto;gap:18px;align-items:center;padding:18px 0;border-bottom:2px solid #2A2A30}
.item i{font:500 13px "JetBrains Mono",monospace;font-style:normal;color:#6E6E78}
.item h3{font-size:24px;font-weight:500}.item p{color:#A9A9B2;font-size:15px}
.item b{font:500 20px "JetBrains Mono",monospace;color:#fff;white-space:nowrap}.item b small{color:#6E6E78;font-size:12px}
.light{background:#F1F1F3;color:#17171A}.light .lead{color:#55555F}
.makes{display:flex;flex-wrap:wrap;gap:8px}.makes span{padding:9px 16px;border:2px solid #17171A;font:500 13px "JetBrains Mono",monospace;text-transform:uppercase}
.two{display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:start}
.ph{min-height:300px;display:grid;place-items:center;background:repeating-linear-gradient(45deg,#1C1C20 0 18px,#18181B 18px 36px);border:2px solid #2A2A30;color:#6E6E78;font:500 12px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.1em;text-align:center;padding:18px}
form{display:grid;grid-template-columns:1fr 1fr;gap:12px}input,select,textarea{width:100%;padding:14px;background:#151518;border:2px solid #2A2A30;color:#fff;font:inherit}
textarea,form .btn{grid-column:1/-1}::placeholder{color:#6E6E78}
footer{padding:26px 0;font:500 12px "JetBrains Mono",monospace;color:#6E6E78;text-transform:uppercase;letter-spacing:.06em}
@media(max-width:860px){nav{display:none}header .btn{margin-left:auto;padding:10px 16px}.hero .wrap,.stats .wrap,.two,form{grid-template-columns:1fr}.stat{border-left:0;padding-left:0;border-top:2px solid #2A2A30}.stat:first-child{border-top:0}.item{grid-template-columns:1fr auto}.item i{display:none}section{padding:54px 0}}
</style></head><body>
<div class="haz"></div>
<header><div class="wrap"><a class="logo" href="#top">{{business}}</a><nav><a href="#services">Services</a><a href="#why">Why us</a><a href="#visit">Hours</a><a href="tel:{{tel}}">{{phone}}</a></nav><a class="btn" href="#book">Book a bay</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><div><h1>Honest repairs. <span>No surprises.</span></h1>
<p>Licensed technicians in {{city}} who show you the worn part, quote before they touch anything and get you back on the road the same day when they can.</p>
<a class="btn" href="#book">Book a bay</a> <a class="btn line" href="tel:{{tel}}">Call {{phone}}</a></div>
<div class="open"><h2>Shop status</h2><div class="now">Open today 8 to 6</div><div class="hrs"><span>Mon to Fri</span><span>8:00 to 18:00</span><span>Saturday</span><span>9:00 to 14:00</span><span>Sunday</span><span>Closed</span><span>After hours</span><span>Key drop box</span></div></div></div></div>
<div class="stats"><div class="wrap"><div class="stat"><b>12 mo / 20,000 km</b><span>warranty on parts and labour</span></div><div class="stat"><b>310S</b><span>licensed technicians on every job</span></div><div class="stat"><b>Free</b><span>shuttle anywhere in {{city}}</span></div></div></div>
<section id="services"><div class="wrap"><h2 class="h">Service menu</h2><p class="lead">Typical prices for most cars. Yours is confirmed in writing before we start, and never goes up without a call.</p>
<div class="menu">
<div class="item"><i>01</i><div><h3>Oil and filter change</h3><p>Synthetic oil, 21-point check, tire pressure set.</p></div><b><small>from </small>$69</b></div>
<div class="item"><i>02</i><div><h3>Brakes</h3><p>Pads and rotors per axle, calipers serviced.</p></div><b><small>from </small>$189</b></div>
<div class="item"><i>03</i><div><h3>Tires</h3><p>Seasonal changeover, balancing and storage.</p></div><b><small>from </small>$49</b></div>
<div class="item"><i>04</i><div><h3>Check engine diagnosis</h3><p>Full scan and a plain-language report.</p></div><b>$95</b></div>
<div class="item"><i>05</i><div><h3>Safety inspection</h3><p>Ontario safety standards certificate.</p></div><b>$120</b></div>
<div class="item"><i>06</i><div><h3>Air conditioning</h3><p>Leak test, recharge and repair.</p></div><b><small>from </small>$129</b></div>
</div></div></section>
<section class="light" id="why"><div class="wrap two"><div><h2 class="h">We work on</h2><p class="lead">Domestic, Asian and European. Gas, hybrid and electric.</p><div class="makes"><span>Ford</span><span>GM</span><span>Toyota</span><span>Honda</span><span>Hyundai</span><span>Kia</span><span>VW</span><span>Mazda</span><span>Subaru</span><span>Nissan</span><span>Ram</span><span>Tesla</span></div></div>
<div><h2 class="h">You see it first</h2><p class="lead" style="margin-bottom:0">Every inspection comes with photos sent to your phone. You approve each line, and we keep the old parts for you to look at. If we would not do the repair on our own car, we tell you.</p></div></div></section>
<section id="visit"><div class="wrap two"><div class="ph">Photo: the shop front and bays</div>
<div id="book"><h2 class="h">Book a bay</h2><p class="lead">Pick a day. We confirm by text within the hour.</p>
<form onsubmit="return false"><input placeholder="Name"><input placeholder="Phone"><input placeholder="Year, make and model" style="grid-column:1/-1"><select style="grid-column:1/-1"><option>Oil change</option><option>Brakes</option><option>Tires</option><option>Diagnosis</option><option>Other</option></select><textarea rows="3" placeholder="What is it doing?"></textarea><button class="btn">Request a time</button></form></div></div></section>
</main>
<div class="haz"></div>
<footer><div class="wrap">© {{business}} · {{city}}, Ontario · {{phone}}</div></footer>
</body></html>`;
export default html;
