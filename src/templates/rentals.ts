// Yard: equipment and trailer rental, sales. A catalogue with rates.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | Rentals in {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:16px/1.6 Inter,system-ui,sans-serif;color:#111;background:#EDEBE6}
h1,h2,h3{font-family:"Space Grotesk",sans-serif;font-weight:700;line-height:1;letter-spacing:-.03em}
a{color:inherit;text-decoration:none}.wrap{max-width:1180px;margin:0 auto;padding:0 22px}
header{background:#111;color:#fff}header .wrap{display:flex;align-items:center;gap:26px;height:70px}
.logo{display:flex;align-items:center;gap:10px;font:700 21px "Space Grotesk",sans-serif}
.logo i{padding:3px 9px;background:#FFC400;color:#111;font-style:normal}
nav{display:flex;gap:24px;margin-left:auto;font-weight:500;font-size:15px;color:#CFCFCF}
.btn{display:inline-block;padding:13px 22px;background:#FFC400;color:#111;font:700 16px "Space Grotesk",sans-serif;border:2px solid #111;cursor:pointer;box-shadow:4px 4px 0 #111}
.btn.k{background:#111;color:#fff;box-shadow:4px 4px 0 #FFC400}
header .btn{box-shadow:none;border-color:#FFC400}
.hero{background:#FFC400;border-bottom:3px solid #111}
.hero .wrap{display:grid;grid-template-columns:1.2fr .8fr;gap:40px;padding-top:60px;padding-bottom:60px;align-items:center}
.hero h1{font-size:clamp(46px,7.4vw,96px);text-transform:uppercase}
.hero p{font-size:19px;max-width:42ch;margin:20px 0 26px;font-weight:500}
.cats{display:flex;flex-wrap:wrap;gap:8px;margin-top:26px}.cats a{padding:8px 14px;background:#111;color:#fff;font-weight:600;font-size:14px}
.ph{display:grid;place-items:center;background:repeating-linear-gradient(45deg,#D9D6CF 0 14px,#CFCBC3 14px 28px);color:#6B675F;font:600 11px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-align:center;padding:14px}
.hero .ph{min-height:330px;border:3px solid #111;box-shadow:8px 8px 0 #111;background:repeating-linear-gradient(45deg,#fff 0 14px,#F5F2EA 14px 28px)}
.bar{background:#111;color:#fff}.bar .wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:0}
.bar div{padding:20px 18px;border-left:1px solid #333;font-size:14px;color:#CFCFCF}.bar div:first-child{border-left:0;padding-left:0}.bar b{display:block;font:700 20px "Space Grotesk",sans-serif;color:#FFC400}
section{padding:76px 0}.head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:end;gap:14px;margin-bottom:30px}
h2{font-size:clamp(32px,4.6vw,54px);text-transform:uppercase}.head p{max-width:40ch;color:#55524B}
.cat{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.prod{background:#fff;border:2px solid #111;display:flex;flex-direction:column}
.prod .ph{aspect-ratio:16/10}.prod .in{padding:18px;display:flex;flex-direction:column;gap:8px;flex:1}
.prod h3{font-size:22px}.spec{font-size:14px;color:#55524B}
.rates{display:grid;grid-template-columns:1fr 1fr 1fr;margin-top:auto;border-top:2px solid #111}
.rates div{padding:10px 8px;text-align:center;border-left:2px solid #111;font-size:12px;color:#55524B;text-transform:uppercase;letter-spacing:.06em}.rates div:first-child{border-left:0}
.rates b{display:block;font:700 20px "Space Grotesk",sans-serif;color:#111;letter-spacing:-.02em}
.prod a{display:block;padding:12px;text-align:center;background:#111;color:#fff;font:700 15px "Space Grotesk",sans-serif}
.prod a:hover{background:#FFC400;color:#111}
.white{background:#fff;border-top:3px solid #111;border-bottom:3px solid #111}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:2px solid #111}
.step{padding:26px 22px;border-left:2px solid #111}.step:first-child{border-left:0}
.step b{font:700 15px "Space Grotesk",sans-serif;background:#FFC400;padding:3px 9px}.step h3{font-size:22px;margin:16px 0 8px}.step p{font-size:15px;color:#55524B}
.two{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.box{padding:34px;border:2px solid #111;background:#fff}.box.y{background:#FFC400}.box h3{font-size:30px;text-transform:uppercase;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin-top:8px}td{padding:9px 0;border-bottom:1px solid #D9D6CF}td:last-child{text-align:right;font-weight:600}
form{display:grid;grid-template-columns:1fr 1fr;gap:12px}input,select,textarea{width:100%;padding:13px;border:2px solid #111;font:inherit;background:#fff}
textarea,form .btn{grid-column:1/-1}
footer{background:#111;color:#9C9C9C;padding:28px 0;font-size:14px}footer .wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
@media(max-width:860px){nav{display:none}header .btn{margin-left:auto;padding:9px 14px}.hero .wrap,.cat,.two,form{grid-template-columns:1fr}.bar .wrap,.steps{grid-template-columns:1fr 1fr}.step:nth-child(3){border-left:0}.step:nth-child(n+3){border-top:2px solid #111}.bar div:nth-child(3){border-left:0;padding-left:0}section{padding:52px 0}.hero .ph{min-height:220px}}
</style></head><body>
<header><div class="wrap"><a class="logo" href="#top"><i>{{initial}}</i>{{business}}</a><nav><a href="#catalogue">Catalogue</a><a href="#how">How it works</a><a href="#rates">Delivery</a><a href="tel:{{tel}}">{{phone}}</a></nav><a class="btn" href="#reserve">Reserve</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><div><h1>Rent it today. Return it when you are done.</h1>
<p>Trailers and equipment in {{city}}, ready when you get here. No membership, no deposit on most rentals.</p>
<a class="btn k" href="#reserve">Reserve online</a> <a class="btn" href="tel:{{tel}}">Call {{phone}}</a>
<div class="cats"><a href="#catalogue">Utility trailers</a><a href="#catalogue">Dump trailers</a><a href="#catalogue">Car haulers</a><a href="#catalogue">Enclosed</a><a href="#catalogue">Equipment</a></div></div>
<div class="ph">Photo: your yard, full of trailers</div></div></div>
<div class="bar"><div class="wrap"><div><b>Open 7 days</b>7 am to 7 pm</div><div><b>Hitch included</b>ball, pin and wiring adapter</div><div><b>Half days</b>back by 1 pm, pay less</div><div><b>We deliver</b>anywhere within 60 km</div></div></div>
<section id="catalogue"><div class="wrap"><div class="head"><h2>The catalogue</h2><p>Rates before tax. Every rental includes straps, a spare and a walk-around before you leave.</p></div>
<div class="cat">
<div class="prod"><div class="ph">Photo</div><div class="in"><h3>5 x 8 utility trailer</h3><div class="spec">1,500 lb · rear ramp · fits a ride-on mower</div></div><div class="rates"><div><b>$39</b>half day</div><div><b>$59</b>day</div><div><b>$229</b>week</div></div><a href="#reserve">Reserve</a></div>
<div class="prod"><div class="ph">Photo</div><div class="in"><h3>6 x 12 dump trailer</h3><div class="spec">7,000 lb · hydraulic lift · tarp included</div></div><div class="rates"><div><b>$89</b>half day</div><div><b>$129</b>day</div><div><b>$549</b>week</div></div><a href="#reserve">Reserve</a></div>
<div class="prod"><div class="ph">Photo</div><div class="in"><h3>18 ft car hauler</h3><div class="spec">7,000 lb · slide-in ramps · winch plate</div></div><div class="rates"><div><b>$69</b>half day</div><div><b>$99</b>day</div><div><b>$399</b>week</div></div><a href="#reserve">Reserve</a></div>
<div class="prod"><div class="ph">Photo</div><div class="in"><h3>7 x 14 enclosed trailer</h3><div class="spec">Lockable · side door · rear ramp</div></div><div class="rates"><div><b>$79</b>half day</div><div><b>$109</b>day</div><div><b>$449</b>week</div></div><a href="#reserve">Reserve</a></div>
<div class="prod"><div class="ph">Photo</div><div class="in"><h3>Mini excavator</h3><div class="spec">1.7 tonne · fits a 36 inch gate · trailer included</div></div><div class="rates"><div><b>$219</b>half day</div><div><b>$329</b>day</div><div><b>$1,199</b>week</div></div><a href="#reserve">Reserve</a></div>
<div class="prod"><div class="ph">Photo</div><div class="in"><h3>Plate compactor</h3><div class="spec">200 lb · for pavers and gravel bases</div></div><div class="rates"><div><b>$45</b>half day</div><div><b>$69</b>day</div><div><b>$249</b>week</div></div><a href="#reserve">Reserve</a></div>
</div></div></section>
<section class="white" id="how"><div class="wrap"><div class="head"><h2>How renting works</h2><p>Ten minutes from the gate to the road.</p></div>
<div class="steps"><div class="step"><b>01</b><h3>Reserve</h3><p>Online or by phone. Pick a time, we hold it.</p></div><div class="step"><b>02</b><h3>Show up</h3><p>Bring a licence and proof of insurance for your vehicle.</p></div><div class="step"><b>03</b><h3>We hook you up</h3><p>Lights tested, load tips given, straps handed over.</p></div><div class="step"><b>04</b><h3>Bring it back</h3><p>Swept out, any time before closing. Late? Call us.</p></div></div></div></section>
<section id="rates"><div class="wrap two"><div class="box"><h3>Delivery</h3><p>We drop it in your driveway and pick it up when you are finished.</p><table><tr><td>{{city}}</td><td>$49 each way</td></tr><tr><td>Within 30 km</td><td>$79 each way</td></tr><tr><td>Within 60 km</td><td>$119 each way</td></tr></table></div>
<div class="box y"><h3>We also sell</h3><p>New and used trailers, with financing and trade-ins. Every used unit is safetied and comes with a 90 day warranty.</p><p style="margin-top:18px"><a class="btn k" href="tel:{{tel}}">Ask what is in stock</a></p></div></div></section>
<section class="white" id="reserve"><div class="wrap two" style="align-items:start"><div><h2>Reserve</h2><p style="margin-top:14px;color:#55524B;max-width:38ch">Tell us what and when. We confirm by text, usually within fifteen minutes during opening hours.</p><p style="margin-top:22px;font:700 40px 'Space Grotesk',sans-serif"><a href="tel:{{tel}}">{{phone}}</a></p></div>
<form onsubmit="return false"><input placeholder="Name"><input placeholder="Phone"><select><option>5 x 8 utility trailer</option><option>6 x 12 dump trailer</option><option>18 ft car hauler</option><option>7 x 14 enclosed trailer</option><option>Mini excavator</option><option>Plate compactor</option></select><input type="date"><textarea rows="3" placeholder="What are you hauling, and with what vehicle?"></textarea><button class="btn k">Request this rental</button></form></div></section>
</main>
<footer><div class="wrap"><span>© {{business}} · {{city}}, Ontario</span><span>Open 7 days, 7 to 7 · {{phone}}</span></div></footer>
</body></html>`;
export default html;
