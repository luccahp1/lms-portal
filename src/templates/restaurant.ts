// Supper: restaurants, cafes, bakeries. The menu on the page, warm and editorial.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Inter:wght@400;500;600&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:16px/1.7 Inter,system-ui,sans-serif;color:#F3E9DC;background:#1B1512}
h1,h2,h3{font-family:"Playfair Display",Georgia,serif;font-weight:500;line-height:1.05}
a{color:inherit;text-decoration:none}.wrap{max-width:1080px;margin:0 auto;padding:0 24px}
.caps{font:600 12px Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#D9753B}
header{position:sticky;top:0;z-index:5;background:rgba(27,21,18,.92);backdrop-filter:blur(8px);border-bottom:1px solid #3A2E27}
header .wrap{display:flex;align-items:center;gap:28px;height:66px}
.logo{font:italic 500 24px "Playfair Display",serif}
nav{display:flex;gap:28px;margin:0 auto;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#C9B9A6}
.btn{display:inline-block;padding:12px 26px;border:1px solid #D9753B;color:#F3E9DC;font:600 13px Inter,sans-serif;letter-spacing:.16em;text-transform:uppercase;background:transparent;cursor:pointer}
.btn.fill{background:#D9753B;color:#1B1512}
.hero{text-align:center;padding:96px 0 84px;background:radial-gradient(ellipse at 50% 0%,#3B2A20 0%,#1B1512 62%)}
.hero h1{font-size:clamp(56px,11vw,150px);font-style:italic;margin:18px 0 14px}
.hero p{max-width:46ch;margin:0 auto 30px;color:#C9B9A6;font-size:18px}
.rule{display:flex;align-items:center;gap:18px;justify-content:center;margin-top:44px;color:#C9B9A6;font-size:14px}
.rule:before,.rule:after{content:"";width:70px;height:1px;background:#5A4739}
.strip{display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:10px;padding:0 10px}
.ph{min-height:300px;display:grid;place-items:center;background:linear-gradient(150deg,#4A3326,#2A1E18);color:rgba(243,233,220,.55);font:600 11px Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;text-align:center;padding:16px}
.ph:nth-child(2){background:linear-gradient(150deg,#5B5A33,#2D2D1B)}.ph:nth-child(3){background:linear-gradient(150deg,#6B3A22,#2E1A10)}
section{padding:88px 0}h2{font-size:clamp(36px,5vw,58px);text-align:center;margin:10px 0 50px}h2 i{color:#D9753B}
.menu{display:grid;grid-template-columns:repeat(3,1fr);gap:54px}
.menu h3{font-size:24px;font-style:italic;color:#D9753B;padding-bottom:12px;margin-bottom:18px;border-bottom:1px solid #3A2E27}
.dish{margin-bottom:18px}.dish div{display:flex;align-items:baseline;gap:8px;font-weight:600}
.dish div:after{content:"";flex:1;order:1;border-bottom:1px dotted #6B5646;transform:translateY(-4px)}
.dish div b{order:2;font-weight:500;color:#C9B9A6}.dish p{color:#A8978A;font-size:14.5px;line-height:1.5}
.paper{background:#F3E9DC;color:#2A1E18}.paper h2 i{color:#B5521F}
.visit{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
table{width:100%;border-collapse:collapse;font-size:17px}td{padding:11px 0;border-bottom:1px solid #D9CBB8}td:last-child{text-align:right;font-weight:600}
.map{min-height:320px;display:grid;place-items:center;background:repeating-linear-gradient(0deg,#E6D9C6 0 28px,#E0D2BD 28px 29px),#E6D9C6;color:#8A7460;font:600 11px Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase}
.events{text-align:center;border-top:1px solid #3A2E27;border-bottom:1px solid #3A2E27}
.events p{max-width:54ch;margin:0 auto 26px;color:#C9B9A6}
form{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;max-width:820px;margin:0 auto}
input,select{padding:14px;background:transparent;border:1px solid #5A4739;color:#F3E9DC;font:inherit}select option{color:#1B1512}::placeholder{color:#8A7868}
footer{padding:40px 0;text-align:center;color:#8A7868;font-size:14px}footer .logo{display:block;margin-bottom:8px;color:#F3E9DC}
@media(max-width:860px){nav{display:none}header .btn{margin-left:auto}.strip,.menu,.visit,form{grid-template-columns:1fr}.menu{gap:34px}.ph{min-height:200px}section{padding:58px 0}.hero{padding:64px 0}}
</style></head><body>
<header><div class="wrap"><a class="logo" href="#top">{{business}}</a><nav><a href="#menu">Menu</a><a href="#visit">Visit</a><a href="#events">Private events</a></nav><a class="btn" href="#reserve">Reserve</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><div class="caps">Wood-fired kitchen · {{city}}</div><h1>{{business}}</h1>
<p>Seasonal plates cooked over flame, a short wine list we actually drink, and a room that stays open late.</p>
<a class="btn fill" href="#reserve">Reserve a table</a> <a class="btn" href="#menu">See the menu</a>
<div class="rule">Dinner Tuesday to Sunday from 5 · Brunch on weekends</div></div></div>
<div class="strip"><div class="ph">Photo: the dining room</div><div class="ph">Photo: a signature plate</div><div class="ph">Photo: the oven</div></div>
<section id="menu"><div class="wrap"><div class="caps" style="text-align:center">This week</div><h2>The <i>menu</i></h2>
<div class="menu"><div><h3>To start</h3>
<div class="dish"><div><span>Charred sourdough</span><b>9</b></div><p>Cultured butter, sea salt, olive oil</p></div>
<div class="dish"><div><span>Burrata</span><b>18</b></div><p>Roasted squash, sage, hazelnut</p></div>
<div class="dish"><div><span>Ember beets</span><b>15</b></div><p>Whipped feta, dill, pistachio</p></div>
<div class="dish"><div><span>Lamb skewers</span><b>19</b></div><p>Harissa, yogurt, mint</p></div></div>
<div><h3>From the fire</h3>
<div class="dish"><div><span>Half chicken</span><b>32</b></div><p>Preserved lemon, olives, pan jus</p></div>
<div class="dish"><div><span>Whole trout</span><b>36</b></div><p>Brown butter, capers, charred leek</p></div>
<div class="dish"><div><span>Ribeye for two</span><b>88</b></div><p>Bone marrow butter, frites</p></div>
<div class="dish"><div><span>Wood-oven gnocchi</span><b>27</b></div><p>Wild mushroom, thyme, pecorino</p></div></div>
<div><h3>To finish</h3>
<div class="dish"><div><span>Olive oil cake</span><b>12</b></div><p>Citrus, crème fraîche</p></div>
<div class="dish"><div><span>Burnt honey custard</span><b>11</b></div><p>Shortbread, sea salt</p></div>
<div class="dish"><div><span>Cheese plate</span><b>21</b></div><p>Three Ontario cheeses, quince</p></div>
<div class="dish"><div><span>Affogato</span><b>9</b></div><p>Vanilla gelato, espresso</p></div></div></div></div></section>
<section class="paper" id="visit"><div class="wrap visit"><div><div class="caps" style="color:#B5521F">Find us</div><h2 style="text-align:left;margin-bottom:26px">Come <i>hungry</i></h2>
<table><tr><td>Tuesday to Thursday</td><td>5 to 10</td></tr><tr><td>Friday and Saturday</td><td>5 to midnight</td></tr><tr><td>Sunday</td><td>10 to 2, 5 to 9</td></tr><tr><td>Monday</td><td>Closed</td></tr></table>
<p style="margin-top:22px">Downtown {{city}}. Street parking after 6 is free.<br><a href="tel:{{tel}}" style="font-weight:600">{{phone}}</a></p></div><div class="map">Map: your address</div></div></section>
<section class="events" id="events"><div class="wrap"><div class="caps">Groups of 10 to 60</div><h2 style="margin-bottom:18px">Private <i>events</i></h2><p>Birthdays, rehearsal dinners and office nights. Family-style menus from $65 a person, with the whole back room to yourselves.</p><a class="btn" href="tel:{{tel}}">Ask about a date</a></div></section>
<section id="reserve"><div class="wrap"><div class="caps" style="text-align:center">Tables for up to 8</div><h2>Reserve a <i>table</i></h2>
<form onsubmit="return false"><input placeholder="Name"><input placeholder="Phone"><select><option>2 people</option><option>3 people</option><option>4 people</option><option>5 to 8 people</option></select><input type="date"><button class="btn fill" style="grid-column:1/-1">Request this table</button></form></div></section>
</main>
<footer><div class="wrap"><span class="logo">{{business}}</span>{{city}}, Ontario · {{phone}}</div></footer>
</body></html>`;
export default html;
