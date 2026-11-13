// Fresh Start: home and office cleaning. Airy, packages with prices up front.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | House cleaning in {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:16px/1.65 "Plus Jakarta Sans",system-ui,sans-serif;color:#14324F;background:#fff}
h1,h2,h3{line-height:1.1;letter-spacing:-.03em;font-weight:800}
a{color:inherit;text-decoration:none}.wrap{max-width:1100px;margin:0 auto;padding:0 22px}
header .wrap{display:flex;align-items:center;gap:24px;height:76px}
.logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:20px}
.logo i{width:34px;height:34px;border-radius:50%;background:#FFC93C;display:grid;place-items:center;font-style:normal;font-size:18px}
nav{display:flex;gap:24px;margin-left:auto;font-weight:500;font-size:15px}
.btn{display:inline-flex;justify-content:center;padding:13px 22px;border-radius:99px;background:#2F8FE0;color:#fff;font-weight:700;border:0;cursor:pointer;font:700 16px "Plus Jakarta Sans",sans-serif;box-shadow:0 8px 20px rgba(47,143,224,.3)}
.btn.y{background:#FFC93C;color:#14324F;box-shadow:0 8px 20px rgba(255,201,60,.35)}
.hero{background:linear-gradient(180deg,#EAF5FF 0%,#fff 100%);border-radius:0 0 48px 48px}
.hero .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:44px;align-items:center;padding-top:50px;padding-bottom:70px}
.tag{display:inline-flex;gap:8px;align-items:center;padding:6px 14px;border-radius:99px;background:#fff;font-weight:700;font-size:13px;box-shadow:0 2px 10px rgba(20,50,79,.08)}
.tag:before{content:"";width:8px;height:8px;border-radius:50%;background:#35C27A}
.hero h1{font-size:clamp(40px,5.6vw,66px);margin:18px 0}.hero h1 span{background:linear-gradient(transparent 62%,#FFC93C 62%)}
.hero p{font-size:18px;color:#48647F;max-width:44ch}
.book{background:#fff;border-radius:28px;padding:28px;box-shadow:0 20px 50px rgba(20,50,79,.14)}
.book h2{font-size:22px;margin-bottom:16px}
label{display:block;font-weight:700;font-size:13px;margin-bottom:12px}
select,input{width:100%;margin-top:5px;padding:12px 14px;border:2px solid #E3EDF6;border-radius:14px;font:inherit;background:#F8FBFE}
.est{display:flex;justify-content:space-between;align-items:baseline;margin:6px 0 16px;padding:12px 16px;border-radius:14px;background:#FFF6D9;font-weight:700}
.est b{font-size:26px}
section{padding:76px 0}.center{text-align:center}h2.t{font-size:clamp(30px,4vw,44px);margin-bottom:10px}.sub{color:#48647F;max-width:52ch;margin:0 auto 40px}
.plans{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch}
.plan{display:flex;flex-direction:column;padding:30px;border-radius:28px;border:2px solid #E3EDF6;background:#fff;text-align:left}
.plan.hot{border-color:#2F8FE0;background:#F4FAFF;position:relative;transform:translateY(-10px)}
.plan.hot:before{content:"Most booked";position:absolute;top:-14px;left:28px;padding:5px 14px;border-radius:99px;background:#2F8FE0;color:#fff;font-weight:700;font-size:12px}
.plan h3{font-size:22px}.price{font-size:44px;font-weight:800;margin:8px 0 2px}.price small{font-size:15px;font-weight:500;color:#48647F}
.plan ul{list-style:none;padding:0;margin:18px 0 24px;display:grid;gap:9px;flex:1}
.plan li{padding-left:28px;position:relative}.plan li:before{content:"✓";position:absolute;left:0;top:1px;width:20px;height:20px;border-radius:50%;background:#D8F3E4;color:#17834C;font-size:12px;font-weight:800;display:grid;place-items:center}
.soft{background:#F4FAFF;border-radius:48px}
.rooms{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.room{background:#fff;border-radius:22px;padding:24px}.room b{display:block;font-size:18px;margin-bottom:8px}.room span{display:block;color:#48647F;font-size:15px}
.gua{display:grid;grid-template-columns:auto 1fr auto;gap:28px;align-items:center;padding:34px 38px;border-radius:32px;background:#14324F;color:#fff}
.seal{width:92px;height:92px;border-radius:50%;background:#FFC93C;color:#14324F;display:grid;place-items:center;font-weight:800;font-size:13px;text-align:center;line-height:1.15}
.revs{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:44px}
.rev{padding:24px;border-radius:24px;background:#fff;border:2px solid #E3EDF6}.rev p{margin:8px 0 12px}.rev b{font-size:14px}.st{color:#FFB400;letter-spacing:2px}
details{border-bottom:2px solid #E3EDF6;padding:18px 0;max-width:720px;margin:0 auto;text-align:left}summary{font-weight:700;font-size:18px;cursor:pointer}details p{margin-top:10px;color:#48647F}
footer{padding:36px 0;color:#48647F;font-size:14px;text-align:center}
@media(max-width:860px){nav{display:none}header .btn{margin-left:auto;padding:10px 16px}.hero .wrap,.plans,.rooms,.gua,.revs{grid-template-columns:1fr}.plan.hot{transform:none}section{padding:54px 0}.gua{text-align:center;justify-items:center}}
</style></head><body>
<header><div class="wrap"><a class="logo" href="#top"><i>✦</i>{{business}}</a><nav><a href="#prices">Prices</a><a href="#included">What we clean</a><a href="#faq">Questions</a><a href="tel:{{tel}}">{{phone}}</a></nav><a class="btn" href="#book">Book a clean</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><div><span class="tag">Openings this week in {{city}}</span>
<h1>A cleaner home <span>by Friday.</span></h1><p>The same two cleaners every visit, insured and background-checked. Book in a minute, pay after the clean.</p>
<p style="margin-top:22px"><a class="btn y" href="tel:{{tel}}">Call {{phone}}</a></p></div>
<form class="book" id="book" onsubmit="return false"><h2>Get your price</h2>
<label>Your home<select><option>1 to 2 bedrooms</option><option selected>3 bedrooms</option><option>4 or more bedrooms</option><option>Office</option></select></label>
<label>How often<select><option>Every two weeks</option><option>Weekly</option><option>Monthly</option><option>Just once</option></select></label>
<div class="est"><span>Estimated price</span><b>$149</b></div>
<label>Phone<input placeholder="519 555 0100"></label><button class="btn" style="width:100%">Book my clean</button></form></div></div>
<section id="prices" class="center"><div class="wrap"><h2 class="t">Simple prices. No quotes to wait for.</h2><p class="sub">For a three bedroom home in {{city}}. Smaller homes cost less. Supplies and equipment included.</p>
<div class="plans"><div class="plan"><h3>Standard clean</h3><div class="price">$149 <small>per visit</small></div><ul><li>Kitchen and bathrooms</li><li>Dusting and vacuuming</li><li>Floors mopped</li><li>Beds made</li></ul><a class="btn y" href="#book">Choose Standard</a></div>
<div class="plan hot"><h3>Deep clean</h3><div class="price">$249 <small>one time</small></div><ul><li>Everything in Standard</li><li>Inside oven and fridge</li><li>Baseboards and vents</li><li>Inside windows</li><li>Cabinet fronts</li></ul><a class="btn" href="#book">Choose Deep</a></div>
<div class="plan"><h3>Move in or out</h3><div class="price">$329 <small>empty home</small></div><ul><li>Everything in Deep</li><li>Inside all cupboards</li><li>Closets and shelves</li><li>Garage sweep</li></ul><a class="btn y" href="#book">Choose Move</a></div></div></div></section>
<section class="soft" id="included"><div class="wrap center"><h2 class="t">What we clean, room by room</h2><p class="sub">Every visit follows the same checklist, and you get it ticked off by text when we finish.</p>
<div class="rooms" style="text-align:left"><div class="room"><b>Kitchen</b><span>Counters and sinks</span><span>Appliance fronts</span><span>Microwave inside</span><span>Floors</span></div><div class="room"><b>Bathrooms</b><span>Tub, shower, toilet</span><span>Mirrors and taps</span><span>Tile and grout wipe</span><span>Floors</span></div><div class="room"><b>Bedrooms</b><span>Beds made</span><span>Dusting</span><span>Vacuum and edges</span><span>Mirrors</span></div><div class="room"><b>Living areas</b><span>Dust all surfaces</span><span>Cushions fluffed</span><span>Glass and screens</span><span>Stairs</span></div></div></div></section>
<section><div class="wrap"><div class="gua"><div class="seal">Happy<br>or free</div><div><h3 style="font-size:26px;margin-bottom:6px">Not happy? We come back within 24 hours.</h3><p style="color:#B9CCDF">Tell us what we missed and we re-clean it free. If it is still not right, you do not pay.</p></div><a class="btn y" href="#book">Book now</a></div>
<div class="revs"><div class="rev"><div class="st">★★★★★</div><p>Same two ladies every time and they remember how I like things. Worth every dollar.</p><b>Sandra K.</b></div><div class="rev"><div class="st">★★★★★</div><p>Booked the move-out clean on Monday, got my full deposit back on Friday.</p><b>Jamal W.</b></div><div class="rev"><div class="st">★★★★★</div><p>I work from home and barely notice they are here, until I see the kitchen.</p><b>Erin P.</b></div></div></div></section>
<section id="faq" style="padding-top:0"><div class="wrap center"><h2 class="t">Common questions</h2><div style="margin-top:26px">
<details open><summary>Do I need to be home?</summary><p>No. Most clients give us a door code or a key, which we keep locked and coded.</p></details>
<details><summary>Do you bring your own supplies?</summary><p>Yes, including a vacuum. Tell us if you prefer unscented or your own products.</p></details>
<details><summary>What if I need to reschedule?</summary><p>Text us 24 hours ahead and there is no charge.</p></details></div></div></section>
</main>
<footer><div class="wrap">© {{business}} · {{city}} and area · Insured and bonded · <a href="tel:{{tel}}">{{phone}}</a></div></footer>
</body></html>`;
export default html;
