// Atelier: hair, barber, nails, spa. Editorial, thin serif, price list.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>{{business}} | {{city}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,500;1,300&family=Jost:wght@300;400;500&display=swap">
<style>
*{box-sizing:border-box;margin:0}html{scroll-behavior:smooth}
body{font:300 17px/1.7 Jost,system-ui,sans-serif;color:#171314;background:#F3E4DF}
h1,h2,h3{font-family:"Cormorant Garamond",Georgia,serif;font-weight:300;line-height:.95;letter-spacing:-.01em}
a{color:inherit;text-decoration:none}.wrap{max-width:1200px;margin:0 auto;padding:0 28px}
.sm{font:400 12px Jost,sans-serif;letter-spacing:.3em;text-transform:uppercase}
header .wrap{display:flex;align-items:center;height:80px;gap:30px}
.logo{font:500 26px "Cormorant Garamond",serif;letter-spacing:.06em}
nav{display:flex;gap:34px;margin:0 auto}nav a{font:400 12px Jost,sans-serif;letter-spacing:.3em;text-transform:uppercase}
.book{padding:12px 26px;background:#171314;color:#F3E4DF;font:400 12px Jost,sans-serif;letter-spacing:.3em;text-transform:uppercase;border:0;cursor:pointer;display:inline-block}
.book.o{background:transparent;color:#171314;border:1px solid #171314}
.hero .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:0;align-items:stretch;min-height:640px}
.hero .txt{padding:70px 40px 60px 0;display:flex;flex-direction:column;justify-content:flex-end}
.hero h1{font-size:clamp(70px,12vw,176px);margin:18px 0 26px}.hero h1 i{font-style:italic;color:#A5645A}
.hero p{max-width:36ch;margin-bottom:30px;font-size:19px}
.tall{background:linear-gradient(175deg,#D9B8AE,#A5645A);display:grid;place-items:end start;padding:26px;color:rgba(255,255,255,.85);font:400 11px Jost,sans-serif;letter-spacing:.3em;text-transform:uppercase;position:relative}
.tall:after{content:"";position:absolute;inset:18px;border:1px solid rgba(255,255,255,.5)}
.marq{border-top:1px solid #171314;border-bottom:1px solid #171314;padding:16px 0;text-align:center;font:300 italic 26px "Cormorant Garamond",serif;letter-spacing:.04em}
section{padding:100px 0}h2{font-size:clamp(46px,7vw,96px);margin:14px 0 54px}h2 i{font-style:italic;color:#A5645A}
.prices{display:grid;grid-template-columns:1fr 1fr;gap:0 80px}
.prices h3{font-size:34px;font-style:italic;margin:0 0 14px}
.line{display:flex;justify-content:space-between;gap:18px;padding:15px 0;border-top:1px solid rgba(23,19,20,.25);font-weight:400}.line span:last-child{font:500 22px "Cormorant Garamond",serif}
.line small{display:block;font-weight:300;font-size:14px;color:#6B5A58}
.ink{background:#171314;color:#F3E4DF}.ink h2 i{color:#D9B8AE}
.people{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}
.portrait{aspect-ratio:3/4;background:linear-gradient(170deg,#3A2F30,#231C1D);display:grid;place-items:center;color:rgba(243,228,223,.5);font:400 11px Jost,sans-serif;letter-spacing:.3em;text-transform:uppercase;margin-bottom:18px}
.people h3{font-size:32px}.people p{font-size:15px;color:#BFA9A4}
.gridg{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.sq{aspect-ratio:1;display:grid;place-items:center;background:linear-gradient(140deg,#E6CFC8,#C99A90);color:rgba(255,255,255,.9);font:400 11px Jost,sans-serif;letter-spacing:.3em;text-transform:uppercase}
.sq:nth-child(2){background:linear-gradient(140deg,#D8C3B2,#9E8573)}.sq:nth-child(3){background:linear-gradient(140deg,#C9A7A0,#7A4E47)}.sq:nth-child(4){background:linear-gradient(140deg,#EAD9D2,#BE9C92)}
.fin{text-align:center}.fin h2{margin-bottom:26px}
form{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0;max-width:880px;margin:36px auto 0;border:1px solid #171314}
input,select{padding:18px;border:0;border-right:1px solid #171314;background:transparent;font:inherit;color:inherit;min-width:0}
footer{padding:44px 0;border-top:1px solid #171314}footer .wrap{display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;align-items:baseline}
@media(max-width:860px){nav{display:none}header .book{margin-left:auto}.hero .wrap{grid-template-columns:1fr;min-height:0}.hero .txt{padding:40px 0}.tall{min-height:380px}.prices,.people,form{grid-template-columns:1fr}.gridg{grid-template-columns:1fr 1fr}input,select{border-right:0;border-bottom:1px solid #171314}section{padding:64px 0}}
</style></head><body>
<header><div class="wrap"><a class="logo" href="#top">{{business}}</a><nav><a href="#prices">Services</a><a href="#team">Stylists</a><a href="#look">Lookbook</a></nav><a class="book" href="#book">Book now</a></div></header>
<main id="top">
<div class="hero"><div class="wrap"><div class="txt"><span class="sm">Hair · Colour · Bridal · {{city}}</span><h1>Hair, <i>considered.</i></h1>
<p>A small studio where your appointment is never rushed and your colour is mixed for you alone.</p>
<div><a class="book" href="#book">Book now</a> <a class="book o" href="tel:{{tel}}">{{phone}}</a></div></div>
<div class="tall">Photo: your signature look</div></div></div>
<div class="marq">Cuts · Balayage · Colour correction · Extensions · Bridal · Treatments</div>
<section id="prices"><div class="wrap"><span class="sm">The menu</span><h2>Services <i>and prices</i></h2>
<div class="prices"><div><h3>Cut and style</h3>
<div class="line"><span>Signature cut<small>Consultation, wash, cut, finish</small></span><span>from 75</span></div>
<div class="line"><span>Fringe or tidy<small>Between appointments</small></span><span>20</span></div>
<div class="line"><span>Blow dry<small>Smooth, waves or volume</small></span><span>from 50</span></div>
<div class="line"><span>Occasion styling<small>Up-do or dressed down</small></span><span>from 95</span></div></div>
<div><h3>Colour</h3>
<div class="line"><span>Root colour<small>With gloss and blow dry</small></span><span>from 95</span></div>
<div class="line"><span>Balayage<small>Hand-painted, lived-in</small></span><span>from 240</span></div>
<div class="line"><span>Full highlights<small>With toner</small></span><span>from 210</span></div>
<div class="line"><span>Colour correction<small>Consultation required</small></span><span>quoted</span></div></div></div></div></section>
<section class="ink" id="team"><div class="wrap"><span class="sm">The chairs</span><h2>Meet the <i>stylists</i></h2>
<div class="people"><div><div class="portrait">Portrait</div><h3>Camille</h3><p>Owner and colourist. Twelve years behind the chair.</p></div><div><div class="portrait">Portrait</div><h3>Noor</h3><p>Cuts, curls and bridal.</p></div><div><div class="portrait">Portrait</div><h3>Jess</h3><p>Blonding and extensions.</p></div></div></div></section>
<section id="look"><div class="wrap"><span class="sm">From the studio</span><h2>Recent <i>work</i></h2>
<div class="gridg"><div class="sq">Photo</div><div class="sq">Photo</div><div class="sq">Photo</div><div class="sq">Photo</div></div></div></section>
<section class="fin" id="book" style="padding-top:20px"><div class="wrap"><span class="sm">Tuesday to Saturday</span><h2>Book your <i>chair</i></h2><p>New clients are asked for a short consultation first. It is free and takes fifteen minutes.</p>
<form onsubmit="return false"><input placeholder="Name"><input placeholder="Phone"><select><option>Cut and style</option><option>Colour</option><option>Bridal</option><option>Consultation</option></select><button class="book">Request</button></form></div></section>
</main>
<footer><div class="wrap"><span class="logo">{{business}}</span><span class="sm">{{city}}, Ontario</span><a class="sm" href="tel:{{tel}}">{{phone}}</a></div></footer>
</body></html>`;
export default html;
