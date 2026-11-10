// Calm: dental, physio, chiropractic, wellness. Quiet, reassuring, lots of air.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;700&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:17px/1.7 "DM Sans",system-ui,sans-serif;color:#2B4644;background:#F5FAF9}
h1,h2,h3{font-family:"DM Serif Display",Georgia,serif;font-weight:400;line-height:1.1;color:#12403E}
a{color:inherit;text-decoration:none}.wrap{max-width:1100px;margin:0 auto;padding:0 24px}
header .wrap{display:flex;align-items:center;gap:26px;height:84px}
.logo{display:flex;align-items:center;gap:11px;font:400 23px "DM Serif Display",serif;color:#12403E}
.logo i{width:36px;height:36px;border-radius:50% 50% 50% 8px;background:#1E7F7A;display:block}
nav{display:flex;gap:28px;margin-left:auto;font-weight:500;font-size:16px}
.btn{display:inline-block;padding:14px 28px;border-radius:99px;background:#1E7F7A;color:#fff;font:700 16px "DM Sans",sans-serif;border:0;cursor:pointer}
.btn.soft{background:#DCEFEC;color:#12403E}
.hero .wrap{display:grid;grid-template-columns:1fr .82fr;gap:60px;align-items:center;padding-top:30px;padding-bottom:84px}
.new{display:inline-block;padding:7px 16px;border-radius:99px;background:#FCE5DA;color:#8A4A2E;font-weight:700;font-size:14px}
.hero h1{font-size:clamp(44px,6vw,76px);margin:20px 0}
.hero p{font-size:19px;max-width:42ch;margin-bottom:30px;color:#4A6563}
.arch{aspect-ratio:4/5;border-radius:240px 240px 28px 28px;background:linear-gradient(170deg,#BFE1DC,#7FBDB6);display:grid;place-items:end center;padding:34px;color:rgba(18,64,62,.7);font:700 12px "DM Sans",sans-serif;letter-spacing:.14em;text-transform:uppercase;text-align:center;position:relative}
.arch:before{content:"";position:absolute;left:-26px;bottom:60px;width:110px;height:110px;border-radius:50%;background:#F4B8A0}
.facts{display:flex;gap:34px;margin-top:38px}.facts div{font-size:15px;color:#4A6563}.facts b{display:block;font:400 32px "DM Serif Display",serif;color:#12403E}
section{padding:90px 0}.lab{font-weight:700;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#1E7F7A}
h2{font-size:clamp(34px,4.4vw,50px);margin:10px 0 44px;max-width:20ch}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.tile{padding:30px 26px;border-radius:26px;background:#fff}
.tile svg{width:30px;height:30px;color:#1E7F7A;margin-bottom:16px}.tile h3{font-size:24px;margin-bottom:6px}.tile p{font-size:16px;color:#4A6563}
.white{background:#fff}
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:40px}
.step b{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;border:2px solid #1E7F7A;font:400 26px "DM Serif Display",serif;color:#1E7F7A;margin-bottom:18px}
.step h3{font-size:26px;margin-bottom:6px}
.team{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;text-align:center}
.face{aspect-ratio:1;border-radius:50%;max-width:220px;margin:0 auto 18px;background:linear-gradient(160deg,#DCEFEC,#A8D4CE);display:grid;place-items:center;color:rgba(18,64,62,.6);font:700 11px "DM Sans",sans-serif;letter-spacing:.14em;text-transform:uppercase}
.team h3{font-size:24px}.team p{font-size:15px;color:#4A6563}
.band{display:grid;grid-template-columns:1fr auto;gap:26px;align-items:center;padding:40px 46px;border-radius:32px;background:#12403E;color:#DDEEEB}
.band h3{color:#fff;font-size:32px;margin-bottom:6px}
.visit{display:grid;grid-template-columns:1fr 1fr;gap:56px}
dl{display:grid;grid-template-columns:1fr auto;gap:10px 20px;margin:20px 0}dd{margin:0;font-weight:700;text-align:right}
form{display:grid;gap:12px;padding:34px;border-radius:30px;background:#fff}
input,select,textarea{width:100%;padding:14px 16px;border:1.5px solid #CFE3E0;border-radius:14px;font:inherit;background:#F8FCFB}
footer{padding:36px 0;font-size:15px;color:#4A6563;border-top:1px solid #DCEFEC}
@media(max-width:860px){nav{display:none}header .btn{margin-left:auto;padding:11px 18px}.hero .wrap,.tiles,.steps,.team,.band,.visit{grid-template-columns:1fr}.arch{max-width:340px;margin:0 auto}section{padding:58px 0}.facts{gap:22px}}
</style></head><body>
<header><div class="wrap"><a class="logo" href="#top"><i></i>{{business}}</a><nav><a href="#care">Care</a><a href="#first">Your first visit</a><a href="#team">Team</a><a href="tel:{{tel}}">{{phone}}</a></nav><a class="btn" href="#book">Book a visit</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><div><span class="new">Accepting new patients</span><h1>Gentle care for the whole family.</h1>
<p>An unhurried practice in {{city}} where we explain everything first, and nothing happens until you are comfortable.</p>
<a class="btn" href="#book">Book a visit</a> <a class="btn soft" href="tel:{{tel}}">Call {{phone}}</a>
<div class="facts"><div><b>20 yrs</b>caring for {{city}}</div><div><b>4.9</b>from 380 patients</div><div><b>Same day</b>emergency visits</div></div></div>
<div class="arch">Photo: a welcoming room</div></div></div>
<section class="white" id="care"><div class="wrap"><div class="lab">What we do</div><h2>Everything you need under one roof.</h2>
<div class="tiles">
<div class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg><h3>Check-ups and cleanings</h3><p>Thorough, gentle and on time.</p></div>
<div class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg><h3>Children</h3><p>First visits that feel like play.</p></div>
<div class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l2.6 5.8 6.4.7-4.8 4.3 1.4 6.2L12 16.8 6.4 20l1.4-6.2L3 9.5l6.4-.7z"/></svg><h3>Cosmetic</h3><p>Whitening, veneers and straightening.</p></div>
<div class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2v20M5 9h14"/></svg><h3>Restorative</h3><p>Fillings, crowns and implants that last.</p></div>
<div class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg><h3>Emergencies</h3><p>In pain? We see you the same day.</p></div>
<div class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12c4-6 14-6 18 0-4 6-14 6-18 0z"/><circle cx="12" cy="12" r="2.5"/></svg><h3>Nervous patients</h3><p>Sedation options and all the time you need.</p></div>
</div></div></section>
<section id="first"><div class="wrap"><div class="lab">New here?</div><h2>Your first visit, step by step.</h2>
<div class="steps"><div class="step"><b>1</b><h3>Book in a minute</h3><p>Online or by phone. Tell us if anything worries you.</p></div><div class="step"><b>2</b><h3>Meet, look, talk</h3><p>An hour, unhurried. We examine, take pictures and listen.</p></div><div class="step"><b>3</b><h3>A plan you understand</h3><p>What is urgent, what can wait, and what it costs.</p></div></div></div></section>
<section class="white" id="team"><div class="wrap"><div class="lab">The people</div><h2>Faces you will see every time.</h2>
<div class="team"><div><div class="face">Photo</div><h3>Dr. Amara Singh</h3><p>Owner, 20 years in practice</p></div><div><div class="face">Photo</div><h3>Dr. Leo Martin</h3><p>Family and children</p></div><div><div class="face">Photo</div><h3>Nadia Brooks</h3><p>Hygienist</p></div></div>
<div class="band" style="margin-top:70px"><div><h3>We bill your insurance directly.</h3><p>Most plans, including Sun Life, Manulife, Canada Life and the Canadian Dental Care Plan. You pay only your share.</p></div><a class="btn soft" href="#book">Check my plan</a></div></div></section>
<section id="book"><div class="wrap visit"><div><div class="lab">Visit us</div><h2 style="margin-bottom:10px">Book your visit.</h2><p>Free parking at the door, and a ramp at the side entrance.</p>
<dl><dt>Monday to Thursday</dt><dd>8 to 7</dd><dt>Friday</dt><dd>8 to 4</dd><dt>Saturday</dt><dd>9 to 2</dd></dl>
<p style="font:400 34px 'DM Serif Display',serif;color:#1E7F7A"><a href="tel:{{tel}}">{{phone}}</a></p></div>
<form onsubmit="return false"><input placeholder="Your name"><input placeholder="Phone"><select><option>New patient exam</option><option>Cleaning</option><option>Something hurts</option><option>Cosmetic consultation</option></select><textarea rows="3" placeholder="Anything we should know?"></textarea><button class="btn">Request a time</button></form></div></section>
</main>
<footer><div class="wrap">© {{business}} · {{city}}, Ontario · {{phone}}</div></footer>
</body></html>`;
export default html;
