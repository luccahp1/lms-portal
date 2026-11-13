// Workhorse: plumbing, heating, electrical. Phone number first.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | Plumbing and heating in {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;800;900&family=Inter:wght@400;500;600&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:16px/1.6 Inter,system-ui,sans-serif;color:#17263A;background:#fff}
h1,h2,h3{font-family:Archivo,system-ui,sans-serif;line-height:1.08;letter-spacing:-.02em}
a{color:inherit;text-decoration:none}.wrap{max-width:1140px;margin:0 auto;padding:0 22px}
.strip{background:#F26A1B;color:#fff;font-weight:600;font-size:14px;text-align:center;padding:8px 12px}
.strip a{text-decoration:underline}
header{position:sticky;top:0;z-index:5;background:#0F2540;color:#fff}
header .wrap{display:flex;align-items:center;gap:26px;height:68px}
.logo{display:flex;align-items:center;gap:10px;font:800 19px Archivo,sans-serif}
.logo i{display:grid;place-items:center;width:38px;height:38px;border-radius:9px;background:#F26A1B;font-style:normal}
nav{display:flex;gap:22px;margin-left:auto;font-weight:500;font-size:15px;opacity:.9}
.call{display:flex;flex-direction:column;line-height:1.15;padding:8px 16px;border-radius:10px;background:#F26A1B;font:800 18px Archivo,sans-serif}
.call small{font:500 11px Inter,sans-serif;opacity:.9}
.hero{background:linear-gradient(160deg,#0F2540 0%,#17385F 100%);color:#fff;padding:64px 0 76px}
.hero .wrap{display:grid;grid-template-columns:1.15fr .85fr;gap:48px;align-items:center}
.hero h1{font-size:clamp(36px,5.2vw,60px);font-weight:900}
.hero h1 em{font-style:normal;color:#FF9A57}
.hero p{margin:18px 0 26px;font-size:18px;color:#C7D3E3;max-width:46ch}
.btns{display:flex;flex-wrap:wrap;gap:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 22px;border-radius:10px;font-weight:600;border:2px solid transparent;cursor:pointer;font-size:16px}
.btn-o{background:#F26A1B;color:#fff}.btn-w{border-color:rgba(255,255,255,.35);color:#fff}
.trust{display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:28px;font-size:14px;color:#C7D3E3}
.trust b{color:#fff}
.card{background:#fff;color:#17263A;border-radius:16px;padding:26px;box-shadow:0 24px 60px rgba(0,0,0,.3)}
.card h2{font-size:22px;margin-bottom:4px}.card p{color:#5A6B80;font-size:14px;margin:0 0 14px}
label{display:block;font-weight:600;font-size:13px;margin-bottom:10px}
input,select,textarea{width:100%;margin-top:4px;padding:11px 12px;border:1.5px solid #D4DCE6;border-radius:9px;font:inherit}
section{padding:72px 0}.kicker{font:600 13px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#F26A1B}
h2.big{font-size:clamp(28px,3.6vw,40px);font-weight:800;margin:8px 0 34px;max-width:22ch}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.svc{padding:24px;border:1.5px solid #E3E9F0;border-radius:14px;transition:.2s}
.svc:hover{border-color:#F26A1B;transform:translateY(-3px)}
.svc svg{width:34px;height:34px;color:#F26A1B;margin-bottom:12px}.svc h3{font-size:19px;margin-bottom:6px}.svc p{color:#5A6B80;font-size:15px}
.alt{background:#F4F7FA}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;counter-reset:s}
.step{counter-increment:s;padding-top:18px;border-top:4px solid #0F2540}
.step:before{content:"0" counter(s);font:900 44px Archivo,sans-serif;color:#F26A1B}
.step h3{font-size:20px;margin:6px 0}
.rev{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 14px rgba(15,37,64,.08)}
.stars{color:#F2A61B;letter-spacing:3px;margin-bottom:8px}.rev b{display:block;margin-top:12px}
.ph{display:grid;place-items:center;min-height:240px;border-radius:16px;background:linear-gradient(135deg,#17385F,#2C5C91);color:rgba(255,255,255,.8);font:600 12px Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;text-align:center;padding:16px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:44px;align-items:center}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.chips span{padding:8px 14px;border-radius:99px;background:#E8EEF5;font-weight:500;font-size:14px}
.cta{background:#F26A1B;color:#fff;text-align:center}.cta h2{font-size:clamp(28px,4vw,44px);font-weight:900}.cta a{display:inline-block;margin-top:18px;font:900 clamp(30px,5vw,54px) Archivo,sans-serif}
footer{background:#0A1A2E;color:#9FB0C6;padding:34px 0;font-size:14px}footer .wrap{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between}
@media(max-width:820px){nav{display:none}.call{margin-left:auto}.hero .wrap,.two,.grid,.steps{grid-template-columns:1fr}.hero{padding:40px 0 52px}section{padding:52px 0}}
</style></head><body>
<div class="strip">Burst pipe or no heat? We answer 24 hours a day. <a href="tel:{{tel}}">Call {{phone}}</a></div>
<header><div class="wrap"><a class="logo" href="#top"><i>{{initial}}</i>{{business}}</a>
<nav><a href="#services">Services</a><a href="#how">How it works</a><a href="#reviews">Reviews</a><a href="#area">Service area</a></nav>
<a class="call" href="tel:{{tel}}"><small>Call or text</small>{{phone}}</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><div>
<h1>Plumbing and heating done right, <em>the first time.</em></h1>
<p>Licensed technicians in {{city}} who show up when they say they will, quote before they start and clean up when they leave.</p>
<div class="btns"><a class="btn btn-o" href="tel:{{tel}}">Call {{phone}}</a><a class="btn btn-w" href="#quote">Get a free quote</a></div>
<div class="trust"><span><b>4.9 stars</b> from 212 reviews</span><span><b>Licensed</b> and insured</span><span><b>Since 2009</b> in {{city}}</span></div>
</div>
<form class="card" id="quote" onsubmit="return false"><h2>Get a free quote</h2><p>Tell us what is going on. We call back within the hour.</p>
<label>Your name<input name="name" placeholder="Jordan Smith"></label><label>Phone<input name="phone" placeholder="519 555 0100"></label>
<label>What do you need?<select><option>Leak or burst pipe</option><option>Furnace or boiler</option><option>Water heater</option><option>Drain or sewer</option><option>Something else</option></select></label>
<button class="btn btn-o" style="width:100%">Request my quote</button></form>
</div></div>
<section id="services"><div class="wrap"><div class="kicker">What we do</div><h2 class="big">One call for everything behind your walls.</h2>
<div class="grid">
<div class="svc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg><h3>Leaks and repairs</h3><p>Taps, toilets, burst pipes and the drip you have been ignoring.</p></div>
<div class="svc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-5 1-8z"/></svg><h3>Furnaces and boilers</h3><p>Repairs, tune-ups and high-efficiency replacements.</p></div>
<div class="svc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="3" width="12" height="18" rx="3"/><path d="M9 8h6M12 13v4"/></svg><h3>Water heaters</h3><p>Tank and tankless, installed the same week.</p></div>
<div class="svc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/></svg><h3>Drains and sewers</h3><p>Camera inspection, clearing and trenchless repair.</p></div>
<div class="svc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10h16v10H4zM8 10V6a4 4 0 0 1 8 0v4"/></svg><h3>Bathroom rough-ins</h3><p>New bathrooms and basement plumbing for renovations.</p></div>
<div class="svc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v6M12 16v6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M16 12h6"/></svg><h3>Air conditioning</h3><p>Central air and heat pumps, sized properly for your home.</p></div>
</div></div></section>
<section class="alt" id="how"><div class="wrap"><div class="kicker">How it works</div><h2 class="big">No surprises on the invoice.</h2>
<div class="steps"><div class="step"><h3>Call or send a request</h3><p>A real person answers. Emergencies are on the road within the hour.</p></div>
<div class="step"><h3>Get a price before we start</h3><p>We look, explain what is wrong in plain words and give you a fixed price.</p></div>
<div class="step"><h3>Fixed and guaranteed</h3><p>We do the work, clean up and back it with a two-year workmanship warranty.</p></div></div></div></section>
<section id="reviews"><div class="wrap"><div class="kicker">Reviews</div><h2 class="big">Neighbours who called us once and kept the number.</h2>
<div class="grid"><div class="rev"><div class="stars">★★★★★</div>Came out at 11 at night for a burst pipe and had it fixed in forty minutes. Fair price too.<b>Priya M.</b></div>
<div class="rev"><div class="stars">★★★★★</div>Replaced our furnace in one day. Explained every option without pushing the expensive one.<b>Dave and Karen T.</b></div>
<div class="rev"><div class="stars">★★★★★</div>On time, boots off at the door, and the bathroom looks perfect. Already booked them again.<b>Marcus L.</b></div></div></div></section>
<section class="alt" id="area"><div class="wrap two"><div><div class="kicker">Service area</div><h2 class="big" style="margin-bottom:10px">Local to {{city}}, and the towns around it.</h2><p>If you are within 40 minutes of {{city}}, we come to you. No travel charge inside the city.</p>
<div class="chips"><span>{{city}}</span><span>St. Thomas</span><span>Strathroy</span><span>Komoka</span><span>Dorchester</span><span>Ilderton</span><span>Lucan</span></div></div>
<div class="ph">Photo: your truck and crew</div></div></section>
<section class="cta"><div class="wrap"><h2>Need someone today?</h2><a href="tel:{{tel}}">{{phone}}</a></div></section>
</main>
<footer><div class="wrap"><span>© {{business}}, {{city}}. Licensed and insured.</span><span>Mon to Fri 7 to 6 · Emergencies 24/7</span></div></footer>
</body></html>`;
export default html;
