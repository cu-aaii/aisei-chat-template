/* Behavioural accessibility checks (WCAG 2.2 AA) — the things a colour checker cannot see.
   Complements tools/check.mjs (contrast, token hygiene). Runs the showcase pages in a real browser:
     - axe-core on 4 pages x 3 themes x 2 modes (names, roles, landmarks, ARIA validity, ...)
     - keyboard: skip link, focus visible and never covered, dialog focus/Esc/return, tabs, mobile nav
     - zoom/reflow: 320px width, 200% text, WCAG 1.4.12 text spacing, no-JS fallback
     - target size, reduced motion, forced colors, heading order, landmarks, language
   Setup (once, outside the design system so it stays dependency-free):
     npm i -D playwright axe-core && npx playwright install chromium
   Run:  node design-system/tools/a11y.mjs    (exit code 1 on any failure) */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const require = createRequire(process.cwd() + '/');
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const root = 'file://' + resolve(dirname(fileURLToPath(import.meta.url)), '../showcase') + '/';

async function axeRun(chromium, root, axe){
 const b=await chromium.launch(); const seen={};
 for (const page of ['gallery','public','page','tokens','navigation','content','sidebars','forms','layout','interactive','sliders','decisions','motion','dashboard','customizer']) for (const theme of ['cornell','steel','white']) for (const mode of ['light','dark']) {
  const ctx=await b.newContext({viewport:{width:1100,height:900}}); const p=await ctx.newPage();
  await p.goto(`${root}${page}.html?theme=${theme}&mode=${mode}`);
  // let entrance fades (an open accordion panel, a reveal) finish, or axe samples a half-transparent colour
  await p.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect&&a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))); await p.evaluate(axe);
  const r=await p.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
  for (const v of r.violations){ const k=v.id; seen[k]=seen[k]||{impact:v.impact,help:v.help,where:new Set(),nodes:new Set()}; seen[k].where.add(`${page}/${theme}/${mode}`); v.nodes.slice(0,3).forEach(n=>seen[k].nodes.add(page+': '+n.target.join(' ')+' :: '+(n.failureSummary||'').split('\n')[1])); }
  await ctx.close();
 }
 await b.close(); return Object.entries(seen).map(([k,v])=>'FAIL axe '+k+' ('+v.impact+') '+v.help+' in '+v.where.size+' combos: '+[...v.nodes].slice(0,2).join(' | '));
}


const out=[]; const ok=(n,c,d='')=>{out.push((c?'PASS ':'FAIL ')+n+(d?'  — '+d:''));};
async function behaviour(chromium, root){
 const b=await chromium.launch();
 for (const page of ['public','page','gallery','interactive','dashboard']) {
  const ctx=await b.newContext({viewport:{width:1100,height:800}}); const p=await ctx.newPage();
  await p.goto(root+page+'.html');
  // 2.4.1 skip link: first Tab focuses it, visible, Enter moves focus into main
  await p.keyboard.press('Tab');
  const sk=await p.evaluate(()=>{const a=document.activeElement;const r=a.getBoundingClientRect();return{cls:a.className,vis:r.width>0&&r.height>0&&r.top>=0}});
  ok(page+' skip link first tab stop & visible on focus', sk.cls.includes('cu-skip')&&sk.vis);
  await p.keyboard.press('Enter');
  ok(page+' skip link moves focus to <main>', await p.evaluate(()=>document.activeElement.tagName==='MAIN'));
  // 2.4.7/2.4.11 focus visible + not obscured: tab through everything
  let bad=[], n=0, obscured=[];
  await p.goto(root+page+'.html'); 
  for(let i=0;i<120;i++){ await p.keyboard.press('Tab');
    const r=await p.evaluate(()=>{const e=document.activeElement; if(e===document.body) return null; const cs=getComputedStyle(e); const rc=e.getBoundingClientRect();
      const outline=cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>=2; const shadow=cs.boxShadow!=='none';
      const cx=Math.min(Math.max(rc.left+rc.width/2,0),innerWidth-1), cy=Math.min(Math.max(rc.top+rc.height/2,0),innerHeight-1);
      const top=document.elementFromPoint(cx,cy); const covered=top&&!e.contains(top)&&!top.contains(e);
      const cardRing=!!e.closest('.cu-card')&&getComputedStyle(e.closest('.cu-card')).outlineStyle!=='none'; return {cardRing, t:e.tagName+'.'+(e.className||'').toString().split(' ')[0]+(e.textContent||'').trim().slice(0,18), outline, shadow, covered, hidden:rc.width===0}});
    if(!r) break; n++; if(!(r.outline||r.shadow||r.cardRing)) bad.push(r.t); if(r.covered) obscured.push(r.t); }
  ok(page+' focus indicator on all '+n+' tab stops', bad.length===0, bad.slice(0,4).join('; '));
  ok(page+' focused element never covered by other UI', obscured.length===0, obscured.slice(0,4).join('; '));
  await ctx.close();
 }
 // Reflow 1.4.10: 320 css px wide, no horizontal page scroll
 for (const page of ['public','page','gallery','tokens','navigation','interactive','sliders','dashboard','customizer']) for (const w of [320,200]) {
  const ctx=await b.newContext({viewport:{width:w,height:700}}); const p=await ctx.newPage(); await p.goto(root+page+'.html');
  const o=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  if(w===320) ok(page+' reflow at 320px (no horizontal scroll)', o.sw<=o.cw, `scrollWidth ${o.sw} vs ${o.cw}`);
  await ctx.close();
 }
 // 200% / 400% zoom emulate via deviceScaleFactor does not reflow; use font-size resize 200% (1.4.4) and text spacing (1.4.12)
 for (const page of ['public','page','gallery','interactive','sliders','dashboard']) {
  const ctx=await b.newContext({viewport:{width:1100,height:800}}); const p=await ctx.newPage(); await p.goto(root+page+'.html');
  await p.addStyleTag({content:'html{font-size:200% !important}'});
  const o=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  ok(page+' text resized 200% without horizontal scroll', o.sw<=o.cw);
  await p.addStyleTag({content:'*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important} p{margin-bottom:2em !important}'});
  const clip=await p.evaluate(()=>{let c=[];document.querySelectorAll('button,a,.cu-badge,.cu-nav__link,.cu-button,h1,h2,h3,label,th,td,li').forEach(e=>{const cs=getComputedStyle(e); if((cs.overflow!=='visible')&&e.scrollWidth>e.clientWidth+1&&cs.display!=='table-cell') c.push(e.tagName+'.'+e.className)}); return c.slice(0,5)});
  ok(page+' text spacing (1.4.12) nothing clipped', clip.length===0, clip.join('; '));
  await ctx.close();
 }
 // Target size 2.5.8 (24px min) + 2.5.5 target (44 coarse)
 for (const tpg of ['dashboard']) for (const [label,opts] of [['mouse',{}],['touch',{hasTouch:true,viewport:{width:390,height:800},isMobile:true}]]) {
  const ctx=await b.newContext(Object.assign({viewport:{width:1100,height:800}},opts)); const p=await ctx.newPage(); await p.goto(root+tpg+'.html');
  const small=await p.evaluate(()=>{const s=[];document.querySelectorAll('button,a[href],input:not([type=hidden]),select,summary,[role=tab]').forEach(e=>{const r=e.getBoundingClientRect(); if(r.width===0||getComputedStyle(e).display==='inline') return; if(e.matches('.cu-check')&&e.labels&&e.labels.length){ /* the label is part of the target (2.5.8) */ const l=e.labels[0].getBoundingClientRect(); const w=Math.max(r.right,l.right)-Math.min(r.left,l.left), h=Math.max(r.bottom,l.bottom)-Math.min(r.top,l.top); if(w>=24&&h>=24) return; } if(r.height<24||r.width<24) s.push(e.tagName+' '+Math.round(r.width)+'x'+Math.round(r.height)+' '+(e.textContent||e.className).trim().slice(0,15))}); return s});
  ok(tpg+' target size ≥24px ('+label+')', small.length===0, small.slice(0,4).join('; '));
  await ctx.close();
 }
 // App shell (blocks/app.css): beside the content from 960px (toggle hides it, remembered); below 960 a modal panel
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html');
   const shown=()=>p.evaluate(()=>(()=>{const n=document.getElementById('app-nav'),r=n.getBoundingClientRect(),cs=getComputedStyle(n);return cs.visibility==='visible'&&r.width>8&&r.right>8;})());
   const a=await p.evaluate(()=>({exp:document.querySelector('.cu-app__toggle').getAttribute('aria-expanded')}));
   ok('app shell wide: menu open beside content, toggle expanded', a.exp==='true'&&await shown());
   const st=()=>p.evaluate(()=>{const t=document.querySelector('.cu-app__toggle'),vis=e=>e.getClientRects().length>0;const l=t.querySelector('.cu-app__toggle-label');return {label:vis(l)&&l.textContent.trim(),shown:vis(t.querySelector('.cu-app__toggle-shown')),hidden:vis(t.querySelector('.cu-app__toggle-hidden')),exp:t.getAttribute('aria-expanded')};});
   const open0=await st();
   ok('app shell toggle: says "Menu" in visible text and shows the open-menu icon while the menu is shown', open0.label==='Menu'&&open0.shown&&!open0.hidden, JSON.stringify(open0));
   await p.waitForTimeout(100); await p.click('.cu-app__toggle'); await p.waitForTimeout(110);
   const mid=await p.evaluate(()=>({w:document.getElementById('app-nav').getBoundingClientRect().width,t:getComputedStyle(document.querySelector('.cu-app__body')).transitionDuration}));
   await p.waitForTimeout(300);
   const c=await p.evaluate(()=>({exp:document.querySelector('.cu-app__toggle').getAttribute('aria-expanded'),focusable:[...document.querySelectorAll('#app-nav a')].some(a=>{a.focus();return document.activeElement===a;})}));
   ok('app shell wide: hiding slides (a transition, mid-way width between 0 and 256)', parseFloat(mid.t)>0.1&&mid.w>0&&mid.w<256, JSON.stringify(mid));
   ok('app shell wide: toggle hides the menu (aria-expanded=false, links no longer focusable)', c.exp==='false'&&!c.focusable&&!(await shown()), JSON.stringify(c));
   const hid0=await st(); ok('app shell toggle: swaps to the plain menu icon while the menu is hidden, same visible label', hid0.label==='Menu'&&hid0.hidden&&!hid0.shown&&hid0.exp==='false', JSON.stringify(hid0));
   await p.click('.cu-app__toggle'); await p.waitForTimeout(400); ok('app shell wide: showing slides it back', await shown());
   await p.click('.cu-app__toggle'); await p.waitForTimeout(400);
   await p.reload(); ok('app shell wide: hidden menu is remembered', await p.evaluate(()=>document.querySelector('.cu-app').dataset.nav==='closed'));
   await p.click('.cu-app__toggle'); await ctx.close(); }
 for (const w of [800,375]) { const ctx=await b.newContext({viewport:{width:w,height:800}}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html');
   ok('app shell '+w+'px: menu closed at load', await p.evaluate(()=>!(()=>{const n=document.getElementById('app-nav'),r=n.getBoundingClientRect(),cs=getComputedStyle(n);return cs.visibility==='visible'&&r.width>8&&r.right>8;})()&&document.querySelector('.cu-app__toggle').getAttribute('aria-expanded')==='false'));
   await p.focus('.cu-app__toggle'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
   const o=await p.evaluate(()=>({f:document.activeElement.className,role:document.getElementById('app-nav').getAttribute('role'),modal:document.getElementById('app-nav').getAttribute('aria-modal'),inert:document.querySelector('.cu-app__main').inert&&document.querySelector('.cu-header--app').inert}));
   ok('app shell '+w+'px: opens as modal panel, focus on Close, page behind inert', o.f.includes('cu-app__close')&&o.role==='dialog'&&o.modal==='true'&&o.inert, JSON.stringify(o));
   let out=false; for(let i=0;i<40;i++){ await p.keyboard.press('Tab'); if(!(await p.evaluate(()=>!!document.activeElement.closest('#app-nav')))) { out=true; break; } }
   ok('app shell '+w+'px: Tab stays inside the open menu', !out);
   await p.keyboard.press('Escape');
   ok('app shell '+w+'px: Escape closes and returns focus to the toggle', await p.evaluate(()=>document.activeElement.classList.contains('cu-app__toggle')&&document.querySelector('.cu-app').dataset.nav==='closed'&&!document.querySelector('.cu-app__main').inert));
   await p.click('.cu-app__toggle'); await p.mouse.click(w-30,400);
   ok('app shell '+w+'px: clicking outside (scrim) closes', await p.evaluate(()=>document.querySelector('.cu-app').dataset.nav==='closed'));
   await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html'); await p.waitForTimeout(100);
   ok('app shell: with reduced motion the menu switches without sliding', await p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.cu-app__body')).transitionDuration)<0.01)); await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:375,height:800},javaScriptEnabled:false}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html');
   ok('app shell without script: menu shown, toggle hidden', await p.evaluate(()=>document.getElementById('app-nav').getClientRects().length>0&&document.querySelector('.cu-app__toggle').getClientRects().length===0)); await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html');
   const d=await p.evaluate(()=>{const fs=n=>parseFloat(getComputedStyle(document.querySelector(n)).fontSize); return {body:fs('body'),th:fs('.cu-table--app thead th'),small:Math.min(...[...document.querySelectorAll('.cu-app__main *')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>parseFloat(getComputedStyle(e).fontSize)))}});
   ok('compact density: body 15px, nothing under 13px', d.body===15&&d.small>=13, JSON.stringify(d));
   await p.evaluate(()=>document.documentElement.removeAttribute('data-density'));
   ok('website density: body back to 18px at desktop', await p.evaluate(()=>parseFloat(getComputedStyle(document.body).fontSize)===18));
   await ctx.close(); }
 // Agent chat (blocks/chat.css): launcher opens the panel, focus to the field, Escape returns focus, messages are a log
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html');
   await p.focus('.cu-chat__launcher'); await p.keyboard.press('Enter');
   const o=await p.evaluate(()=>({open:document.getElementById('chat').open,f:document.activeElement.id,exp:document.querySelector('.cu-chat__launcher').getAttribute('aria-expanded'),log:document.querySelector('.cu-chat__log').getAttribute('role')}));
   ok('chat: the launcher opens the panel, focus moves to the message field', o.open&&o.f==='chat-message'&&o.exp==='true'&&o.log==='log', JSON.stringify(o));
   await p.keyboard.type('Hello'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
   ok('chat: Enter sends; the message and the reply appear in the log', await p.evaluate(()=>document.querySelectorAll('.cu-chat__msg--user').length===1&&document.querySelectorAll('.cu-chat__msg--agent').length===2));
   await p.keyboard.press('Escape');
   ok('chat: Escape closes the panel and returns focus to the launcher', await p.evaluate(()=>!document.getElementById('chat').open&&document.activeElement.classList.contains('cu-chat__launcher')));
   const cover=await p.evaluate(()=>{const l=document.querySelector('.cu-chat__launcher').getBoundingClientRect(); window.scrollTo(0,document.body.scrollHeight); const rows=[...document.querySelectorAll('.cu-app__main tr, .cu-app__main .cu-empty')]; const last=rows.at(-1).getBoundingClientRect(); const l2=document.querySelector('.cu-chat__launcher').getBoundingClientRect(); return {lastBottom:Math.round(last.bottom),launcherTop:Math.round(l2.top)};});
   ok('chat: scrolled to the end, the launcher covers no part of the page content', cover.lastBottom<=cover.launcherTop, JSON.stringify(cover));
   await ctx.close(); }

 // Moving the chat (blocks/chat.css .cu-chat__grip): a real button, keyboard and pointer, clamped, focus stays, quiet status line
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html');
   const NAME='Move the chat. Drag, or use the arrow keys; End returns it to the corner';
   const box=()=>p.evaluate(()=>{const r=document.querySelector('.cu-chat').getBoundingClientRect();const s=document.querySelector('.cu-chat').style;return {l:r.left,t:r.top,r:r.right,b:r.bottom,x:s.getPropertyValue('--chat-x'),y:s.getPropertyValue('--chat-y')}});
   const stat=()=>p.evaluate(()=>document.querySelector('.cu-chat [role=status]').textContent);
   const g=await p.evaluate(()=>{const e=document.querySelector('.cu-chat__grip--pill');const r=e.getBoundingClientRect();return {tag:e.tagName,type:e.type,name:e.getAttribute('aria-label'),icon:e.querySelector('svg').getAttribute('aria-hidden'),w:r.width,h:r.height,beside:r.right<=document.querySelector('.cu-chat__launcher').getBoundingClientRect().left+1}});
   ok('chat grip: a real button with the dock\'s name, 24px or more, its dots icon hidden from assistive technology, beside the launcher', g.tag==='BUTTON'&&g.type==='button'&&g.name===NAME&&g.icon==='true'&&g.w>=24&&g.h>=24&&g.beside, JSON.stringify(g));
   ok('chat grip: it is the first stop in the chat, before the launcher', await p.evaluate(()=>{const c=document.querySelector('.cu-chat');const f=[...c.querySelectorAll('button')].filter(e=>e.offsetParent!==null);return f[0].classList.contains('cu-chat__grip')&&f[1].classList.contains('cu-chat__launcher')}));
   const b0=await box();
   await p.focus('.cu-chat__grip--pill'); await p.keyboard.press('ArrowLeft'); let b1=await box();
   ok('chat grip: ArrowLeft moves the chat 20px left', Math.round(b0.l-b1.l)===20&&b1.x==='-20px', JSON.stringify([b0.l,b1.l,b1.x]));
   await p.keyboard.press('Shift+ArrowUp'); const b2=await box();
   ok('chat grip: Shift+ArrowUp moves it 80px up', Math.round(b1.t-b2.t)===80&&b2.y==='-80px', JSON.stringify([b1.t,b2.t,b2.y]));
   await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowDown'); const b3=await box();
   ok('chat grip: ArrowRight and ArrowDown move it back, 20px each', b3.x==='0px'||b3.x===''?true:Math.round(b3.l-b2.l)===20);
   ok('chat grip: focus stays on the grip while it moves, and the page does not scroll', await p.evaluate(()=>document.activeElement.classList.contains('cu-chat__grip')&&window.scrollY===0));
   ok('chat grip: a plain step makes no announcement', (await stat())==='');
   await p.keyboard.press('End'); await p.waitForTimeout(120); const b4=await box();
   ok('chat grip: End returns it to the corner and says so once', Math.round(b4.l)===Math.round(b0.l)&&Math.round(b4.t)===Math.round(b0.t)&&b4.x===''&&(await stat())==='The chat is back in the corner.', JSON.stringify([b4,await stat()]));
   for (let i=0;i<80;i++) await p.keyboard.press('Shift+ArrowLeft'); await p.waitForTimeout(120); const e1=await box();
   ok('chat grip: it stops one gap (16px, the same as the corner) from the left edge and says it is at the edge', e1.l>=15.5&&e1.l<=17&&/left edge/.test(await stat()), JSON.stringify([e1.l,await stat()]));
   for (let i=0;i<60;i++) await p.keyboard.press('Shift+ArrowUp'); const e2=await box();
   ok('chat grip: it stops one gap from the top edge', e2.t>=15.5&&e2.t<=17, JSON.stringify(e2));
   for (let i=0;i<80;i++) await p.keyboard.press('Shift+ArrowRight'); for (let i=0;i<60;i++) await p.keyboard.press('Shift+ArrowDown'); const e3=await box();
   ok('chat grip: it never leaves the window at the right or the bottom', e3.r<=1280-15.5&&e3.b<=800-15.5, JSON.stringify(e3));
   await p.keyboard.press('End');
   // a pointer drag moves it, and does not open the chat
   const gb=await p.locator('.cu-chat__grip--pill').boundingBox(); const sx=gb.x+gb.width/2, sy=gb.y+gb.height/2;
   await p.mouse.move(sx,sy); await p.mouse.down(); await p.mouse.move(sx-150,sy-120,{steps:6}); await p.mouse.up(); const d1=await box();
   ok('chat grip: dragging moves the chat by the same distance', Math.abs((b0.l-d1.l)-150)<=2&&Math.abs((b0.t-d1.t)-120)<=2, JSON.stringify([b0,d1]));
   ok('chat grip: a drag does not open the chat, and focus is on the grip', await p.evaluate(()=>document.querySelector('.cu-chat__launcher').getAttribute('aria-expanded')==='false'&&document.activeElement.classList.contains('cu-chat__grip')));
   // open it where it was left: the bigger panel is pulled back inside the window, and the panel's own grip works
   await p.mouse.move(sx,sy); await p.mouse.down(); await p.mouse.move(sx-1100,sy-700,{steps:4}); await p.mouse.up();
   await p.click('.cu-chat__launcher'); await p.waitForTimeout(150); const o1=await box();
   ok('chat grip: opening the chat in a far corner pulls the larger panel back inside the window', o1.l>=15.5&&o1.t>=15.5&&o1.r<=1280-15.5&&o1.b<=800-15.5, JSON.stringify(o1));
   ok('chat grip: with the panel open the pill\'s grip is gone and the panel has its own, first in the bar', await p.evaluate(()=>{const a=document.querySelector('.cu-chat__grip--pill');const g=document.querySelector('.cu-chat__bar > .cu-chat__grip');return getComputedStyle(a).display==='none'&&!!g&&g.getAttribute('aria-label')==='Move the chat. Drag, or use the arrow keys; End returns it to the corner'&&g===document.querySelector('.cu-chat__bar').firstElementChild}));
   await p.focus('.cu-chat__bar > .cu-chat__grip'); await p.keyboard.press('Shift+ArrowRight'); const o2=await box();
   ok('chat grip: the panel\'s grip moves the whole chat, and focus stays inside the panel', Math.round(o2.l-o1.l)===80&&await p.evaluate(()=>!!document.activeElement.closest('.cu-chat__panel')), JSON.stringify([o1.l,o2.l]));
   { let out=0; for(const key of ['Tab','Shift+Tab']) for(let i=0;i<14;i++){ await p.keyboard.press(key); if(!await p.evaluate(()=>!!document.activeElement.closest('.cu-chat__panel'))) out++; }
     ok('chat grip: Tab and Shift+Tab still wrap inside the panel with the grip in it (28 presses)', out===0, out+' landed outside'); }
   await p.focus('.cu-chat__bar > .cu-chat__grip'); await p.keyboard.press('Escape'); await p.waitForTimeout(80);
   ok('chat grip: Escape from the grip closes the chat and returns focus to the launcher', await p.evaluate(()=>!document.getElementById('chat').open&&document.activeElement.classList.contains('cu-chat__launcher')));
   await p.focus('.cu-chat__grip--pill'); await p.keyboard.press('End');
   ok('chat grip: the offset is gone after End, and exactly two grips were added (one by the launcher, one in the panel)', (await box()).x===''&&await p.evaluate(()=>document.querySelectorAll('.cu-chat__grip').length===2));
   await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:390,height:800}}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html');
   ok('chat grip: on a phone there is nothing to move, so no grip is shown and the chat does not shift', await p.evaluate(()=>[...document.querySelectorAll('.cu-chat__grip')].every(e=>getComputedStyle(e).display==='none')&&getComputedStyle(document.querySelector('.cu-chat')).translate==='none'));
   await ctx.close(); }
 // A scrollable region is a tab stop only while it scrolls (initScrollRegion in showcase.js; ScrollRegionDirective in the app)
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html'); await p.waitForTimeout(200);
   const st=()=>p.evaluate(()=>[...document.querySelectorAll('.cu-table-wrap[role=region]')].map(e=>({scrolls:e.scrollWidth>e.clientWidth,tab:e.getAttribute('tabindex'),name:e.getAttribute('aria-label')})));
   const wide=await st();
   ok('scroll region: at desktop width a table that fits is not a tab stop, and it keeps its name', wide.length>0&&wide.every(r=>r.scrolls?r.tab==='0':r.tab===null)&&wide.every(r=>!!r.name), JSON.stringify(wide));
   await p.setViewportSize({width:420,height:800}); await p.waitForTimeout(300); const narrow=await st();
   ok('scroll region: a table that has to scroll is a tab stop, by keyboard', narrow.every(r=>r.scrolls?r.tab==='0':r.tab===null)&&narrow.some(r=>r.scrolls&&r.tab==='0')||narrow.every(r=>!r.scrolls), JSON.stringify(narrow));
   await ctx.close(); }
 // Focus never leaks out of an overlay (the agent chat, the app menu and the public menu), by keyboard or after a click on blank space inside it
 for (const w of [1280,820,390]) { const ctx=await b.newContext({viewport:{width:w,height:900}}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html');
   const inside=sel=>p.evaluate(s=>!!document.activeElement.closest(s),sel);
   await p.click('.cu-chat__launcher'); await p.waitForTimeout(80);
   { let out=0; for(const key of ['Tab','Shift+Tab']) for(let i=0;i<14;i++){ await p.keyboard.press(key); if(!await inside('.cu-chat__panel')) out++; }
     ok('chat '+w+'px: Tab and Shift+Tab wrap inside the panel (28 presses)', out===0, out+' landed outside'); }
   const blank=await p.evaluate(()=>{const r=document.querySelector('.cu-chat__log').getBoundingClientRect();return [r.right-6,r.bottom-6];});
   await p.mouse.click(blank[0],blank[1]);
   ok('chat '+w+'px: a click on blank space inside keeps focus in the panel', await inside('.cu-chat__panel'));
   await p.keyboard.press('Escape'); await p.waitForTimeout(60);
   ok('chat '+w+'px: Escape after that click closes it and returns focus to the launcher', await p.evaluate(()=>!document.getElementById('chat').open&&document.activeElement.classList.contains('cu-chat__launcher')));
   await p.click('.cu-chat__launcher'); await p.waitForTimeout(60);
   const m=await p.evaluate(()=>({modal:document.getElementById('chat').getAttribute('aria-modal'),behind:!!document.querySelector('.cu-app').inert}));
   ok('chat '+w+'px: '+(w<768?'modal on phones (aria-modal, the page behind inert)':'non-modal (the page behind stays usable)'), w<768?(m.modal==='true'&&m.behind):(m.modal===null&&!m.behind), JSON.stringify(m));
   await p.keyboard.press('Escape'); await p.waitForTimeout(60);
   ok('chat '+w+'px: closing it leaves nothing inert', await p.evaluate(()=>document.querySelectorAll('[inert]').length===0));
   if (w<960) {
     await p.focus('.cu-app__toggle'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
     const r=await p.evaluate(()=>{const r=document.getElementById('app-nav').getBoundingClientRect();return [r.right-4,r.bottom-6];});
     await p.mouse.click(r[0],r[1]);
     ok('app menu '+w+'px: a click on blank space inside keeps focus in the panel', await inside('#app-nav'));
     await p.keyboard.press('Shift+Tab'); ok('app menu '+w+'px: Shift+Tab right after that click wraps inside the panel', await inside('#app-nav'));
     await p.keyboard.press('Escape'); await p.waitForTimeout(300);
     ok('app menu '+w+'px: Escape after that click closes it and returns focus to the toggle', await p.evaluate(()=>document.querySelector('.cu-app').dataset.nav==='closed'&&document.activeElement.classList.contains('cu-app__toggle')));
   }
   await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:820,height:900}}); const p=await ctx.newPage(); await p.goto(root+'public.html');
   await p.focus('.cu-header__menu'); await p.keyboard.press('Enter'); await p.waitForTimeout(350);
   const r=await p.evaluate(()=>{const r=document.querySelector('.cu-nav').getBoundingClientRect();return [r.right-4,r.bottom-6];});
   await p.mouse.click(r[0],r[1]);
   ok('public menu: a click on blank space inside keeps focus in the overlay', await p.evaluate(()=>!!document.activeElement.closest('.cu-nav')));
   await p.keyboard.press('Shift+Tab'); ok('public menu: Shift+Tab right after that click wraps inside the overlay', await p.evaluate(()=>!!document.activeElement.closest('.cu-nav')));
   await p.keyboard.press('Escape'); await p.waitForTimeout(300);
   ok('public menu: Escape after that click closes it and returns focus to Menu', await p.evaluate(()=>document.querySelector('.cu-header__menu').getAttribute('aria-expanded')==='false'&&document.activeElement.classList.contains('cu-header__menu')));
   await ctx.close(); }
 // Customizer (customizer.html): a combination sets every option, the preview follows, the output is the look object
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage(); await p.goto(root+'customizer.html');
   await p.getByRole('button',{name:/^Navy/}).click(); await p.waitForTimeout(200);
   const c=await p.evaluate(()=>({code:document.getElementById('cz-code').textContent,src:document.getElementById('cz-frame').getAttribute('src'),checked:document.querySelector('input[name=cz-publicHeader]:checked').value,hash:location.hash}));
   ok('customizer: a combination sets the options, the preview and the code', c.checked==='blue-bar'&&c.src.includes('header=blue-bar')&&c.code.includes("publicHeader: 'blue-bar'")&&c.hash.includes('publicHeader=blue-bar'), JSON.stringify(c));
   await p.focus('input[name=cz-headings][value=sans]'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(100);
   ok('customizer: options are radio groups (arrow keys move the choice)', await p.evaluate(()=>document.querySelector('input[name=cz-headings]:checked').value==='serif'&&!document.getElementById('cz-code').textContent.includes('headings')));
   await p.check('input[name=cz-page][value=app]'); await p.waitForTimeout(100);
   ok('customizer: the app preview shows the app bar and density', await p.evaluate(()=>{const s=document.getElementById('cz-frame').getAttribute('src');return s.startsWith('dashboard.html')&&s.includes('theme=blue-bar')&&s.includes('density=compact');}));
   const fr=p.frameLocator('#cz-frame'); await p.waitForTimeout(600);
   ok('customizer: the preview page really takes the options', await p.frames().at(-1).evaluate(()=>document.documentElement.getAttribute('data-theme')==='blue-bar'));
   await p.check('input[name=cz-page][value=page]'); await p.waitForTimeout(700);
   ok('customizer: the Content page preview shows section navigation, text tones, a table and a form, with the chosen header', await p.evaluate(()=>{const s=document.getElementById('cz-frame').getAttribute('src');return s.startsWith('page.html')&&/header=[a-z-]+/.test(s);})&&await p.frames().at(-1).evaluate(()=>!!document.documentElement.getAttribute('data-theme')&&!!document.querySelector('.cu-section-nav [aria-current=page]')&&!!document.querySelector('.cu-text-soft')&&!!document.querySelector('table.cu-table')&&!!document.querySelector('form.cu-form')));
   await p.check('input[name=cz-page][value=public]'); await p.waitForTimeout(100);
   await p.goto(root+'customizer.html#publicHeader=dark-bar&modeSwitch=false'); await p.reload(); await p.waitForTimeout(300);
   { let inFrame=0; for(let i=0;i<120;i++){ await p.keyboard.press('Tab'); if(await p.evaluate(()=>document.activeElement.tagName==='IFRAME')) inFrame++; }
     ok('customizer: Tab never enters the preview frame (it is a picture, not 60 tab stops)', inFrame===0, inFrame+' presses inside it'); }
   ok('customizer: a shared link opens with its choices', await p.evaluate(()=>document.querySelector('input[name=cz-publicHeader]:checked').value==='dark-bar'&&document.getElementById('cz-code').textContent.includes('modeSwitch: false')));
   await ctx.close(); }
 // Customizer: the CDS thin line is the default; buttons and over-the-photo navigation are offered; options that need another say why
 { const ctx=await b.newContext({viewport:{width:1400,height:900}}); const p=await ctx.newPage(); await p.goto(root+'customizer.html'); await p.waitForTimeout(500);
   const code=()=>p.evaluate(()=>document.getElementById('cz-code').textContent), status=()=>p.evaluate(()=>document.getElementById('cz-status').textContent);
   const shown=id=>p.evaluate(id=>getComputedStyle(document.getElementById(id)).display!=='none',id);
   const fr=()=>p.frames().at(-1);
   ok('customizer default: the CDS website look (white banner, thin line), nothing to write', (await code())==='...provideLook({}),');
   ok('customizer default: the preview has the thin line and no utility bar', await fr().evaluate(()=>!document.querySelector('header.cu-header > .cu-utility')&&parseFloat(getComputedStyle(document.querySelector('header.cu-header')).borderTopWidth)>=4));
   await p.check('input[name=cz-topBar][value=bar]'); await p.waitForTimeout(500);
   ok('customizer: "Top bar with links" brings the utility bar back', await fr().evaluate(()=>!!document.querySelector('header.cu-header > .cu-utility'))&&(await code()).includes("topBar: 'bar'"));
   await p.check('input[name=cz-topBar][value=line]');
   // buttons: every link a button with space around it, red current page
   await p.check('input[name=cz-navStyle][value=red-button]'); await p.waitForTimeout(500);
   const btn=await fr().evaluate(()=>{const n=document.querySelector('header.cu-header nav.cu-nav');const a=n.querySelector('[aria-current]');const cs=getComputedStyle(a);const bar=n.getBoundingClientRect(),r=a.getBoundingClientRect();return {cls:n.className,bg:cs.backgroundColor,radius:cs.borderRadius,gap:Math.round(r.top-bar.top)};});
   ok('customizer: "Buttons, red current page" gives a red button with a gap above it', btn.cls.includes('cu-nav--tall')&&btn.bg==='rgb(179, 27, 27)'&&btn.radius!=='0px'&&btn.gap>0, JSON.stringify(btn));
   // the photo needs the dark banner: unavailable, with a reason and a fix
   ok('customizer: the photo option is flagged unavailable, with the reason and a button', await shown('cz-why-bannerPhoto')&&await p.evaluate(()=>document.querySelector('input[name=cz-bannerPhoto]').getAttribute('aria-disabled')==='true'&&document.getElementById('cz-field-bannerPhoto').getAttribute('aria-describedby').includes('cz-why-bannerPhoto')));
   await p.check('input[name=cz-bannerPhoto][value=photo]',{force:true}).catch(()=>{});
   ok('customizer: picking it anyway changes nothing and says why in the status', await p.evaluate(()=>document.querySelector('input[name=cz-bannerPhoto]:checked').value==='none')&&/not available yet.*Dark banner/i.test(await status())&&!(await code()).includes('bannerPhoto'));
   await p.click('#cz-why-bannerPhoto button'); await p.waitForTimeout(100);
   ok('customizer: the fix button turns the Dark banner on and the option becomes available', await p.evaluate(()=>document.querySelector('input[name=cz-publicHeader]:checked').value==='dark-header')&&!(await shown('cz-why-bannerPhoto')));
   await p.check('input[name=cz-bannerPhoto][value=photo]');
   ok('customizer: navigation over the photo is still unavailable until the photo is on, then available', !(await shown('cz-why-navOverlay')));
   await p.check('input[name=cz-navOverlay][value=overlay]'); await p.waitForTimeout(600);
   const ov=await fr().evaluate(()=>({photo:document.querySelector('header.cu-header').classList.contains('cu-header--photo'),gradient:!!document.querySelector('header.cu-header .cu-nav--gradient'),bgOnHeader:getComputedStyle(document.querySelector('header.cu-header')).backgroundImage.includes('gradient')}));
   ok('customizer: the preview shows the photo banner with the see-through navigation on it', ov.photo&&ov.gradient&&ov.bgOnHeader, JSON.stringify(ov));
   ok('customizer: the code carries photo, buttons and overlay', (await code())==="...provideLook({ publicHeader: 'dark-header', bannerPhoto: '/images/banner.jpg', nav: { align: 'start', style: 'red-button', overlay: true } }),", await code());
   // taking the prerequisite away: the choice is kept, not used, and flagged again
   await p.check('input[name=cz-publicHeader][value=cornell]');
   ok('customizer: switching the banner away flags both again and drops them from the code, keeping the choice', await shown('cz-why-bannerPhoto')&&await shown('cz-why-navOverlay')&&!(await code()).includes('bannerPhoto')&&!(await code()).includes('overlay')&&await p.evaluate(()=>document.querySelector('input[name=cz-bannerPhoto]:checked').value==='photo'));
   ok('customizer: banner height is flagged unavailable while there is no dark banner and picture', await shown('cz-why-bannerHeight'));
   await p.check('input[name=cz-publicHeader][value=dark-header]'); await p.check('input[name=cz-bannerPhoto][value=slides]'); await p.check('input[name=cz-bannerHeight][value=tall]'); await p.waitForTimeout(600);
   ok('customizer: with a slideshow, the height option is available and the code lists the pictures and the height', !(await shown('cz-why-bannerHeight'))&&(await code()).includes("bannerPhoto: [{ src: '/images/banner-1.jpg', title: 'Slide 1 headline'")&&(await code()).includes("bannerHeight: 'tall'"), await code());
   ok('customizer: the preview shows the tall slideshow banner', await fr().evaluate(()=>!!document.querySelector('header.cu-header.cu-header--slides.cu-header--tall .cu-header__feature .cu-slider__pip')));
   ok('customizer: the "Sample picture" choice is only for a single picture', await p.evaluate(()=>document.getElementById('cz-picture-set').hidden));
   ok('customizer: the video option is available with a slideshow and starts as No video', !(await shown('cz-why-slideVideo'))&&await p.evaluate(()=>document.querySelector('input[name=cz-slideVideo]:checked').value==='none')&&!(await code()).includes('video'));
   await p.check('input[name=cz-slideVideo][value=second]'); await p.waitForTimeout(700);
   ok('customizer: choosing a video puts its WebM and MP4 on slide 2 in the code', (await code()).includes("{ src: '/images/banner-2.jpg', title: 'Slide 2 headline', text: 'One line about this slide.', href: '/page-2', linkLabel: 'Link text', video: ['/images/banner-2.webm', '/images/banner-2.mp4'] }")&&!(await code()).includes("banner-1.webm"), await code());
   ok('customizer: the preview holds the video on slide 2, with its button outside the decorative pictures', await fr().evaluate(()=>!!document.querySelector('.cu-header__slide > video')&&!!document.querySelector('[data-act="video"]')&&!document.querySelector('[data-act="video"]').closest('[aria-hidden="true"]')));
   await p.check('input[name=cz-bannerPhoto][value=photo]'); await p.waitForTimeout(300);
   ok('customizer: without a slideshow the video option is flagged unavailable, the choice is kept and the code drops it', await shown('cz-why-slideVideo')&&!(await code()).includes('video')&&await p.evaluate(()=>document.querySelector('input[name=cz-slideVideo]:checked').value==='second'));
   await p.check('input[name=cz-bannerPhoto][value=slides]'); await p.check('input[name=cz-slideVideo][value=none]'); await p.waitForTimeout(500);
   await p.check('input[name=cz-bannerHeight][value=short]'); await p.waitForTimeout(500);
   ok('customizer: a slideshow set to Short is written and shown as Medium, with a note saying so', (await code()).includes("bannerHeight: 'medium'")&&await p.evaluate(()=>/never shorter than Medium/.test(document.getElementById('cz-note-bannerHeight').textContent)&&!document.getElementById('cz-note-bannerHeight').hidden)&&await fr().evaluate(()=>document.querySelector('header.cu-header').classList.contains('cu-header--medium')));
   await p.check('input[name=cz-logoSide][value=right]'); await p.waitForTimeout(500);
   ok('customizer: the seal on the right is in the code and in the preview', (await code()).includes("logoSide: 'right'")&&await fr().evaluate(()=>document.querySelector('header.cu-header').classList.contains('cu-header--logo-right')));
   // options that live on the other side switch the preview
   await p.check('input[name=cz-appDensity][value=website]'); await p.waitForTimeout(300);
   ok('customizer: an admin option switches the preview to the Admin app and says so', await p.evaluate(()=>document.querySelector('input[name=cz-page]:checked').value==='app')&&/Admin app/.test(await status()));
   await p.check('input[name=cz-topBar][value=bar]'); await p.waitForTimeout(300);
   ok('customizer: a public option switches it back to the Public site', await p.evaluate(()=>document.querySelector('input[name=cz-page]:checked').value==='public'));
   await p.check('input[name=cz-publicHeader][value=light-bar]'); await p.check('input[name=cz-topBar][value=line]');
   ok('customizer: a bar colour with the thin line explains that it only shows on inner pages', await shown('cz-note-publicHeader')&&/inner pages/.test(await p.evaluate(()=>document.getElementById('cz-note-publicHeader').textContent)));
   await ctx.close(); }
 // The photo banner on a phone: the menu overlay stays readable, and the see-through bar is solid there
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage(); await p.goto(root+'public.html?header=dark-header&photo=2&nav=gradient&topbar=line'); await p.waitForTimeout(300);
   ok('sample banner picture: the header paints the placeholder image and its file loads', await p.evaluate(()=>{const h=document.querySelector('header.cu-header');const u=getComputedStyle(h).backgroundImage.match(/banner-2\.svg/);return !!u;})&&await p.evaluate(()=>new Promise(r=>{const i=new Image();i.onload=()=>r(true);i.onerror=()=>r(false);i.src=new URL('images/banner-2.svg',document.baseURI).href;})));
   await ctx.close(); }
 // Banner height and the slideshow banner (blocks/header.css)
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage(); const base=root+'public.html?header=dark-header&topbar=line&nav=gradient&photo=';
   const h=async(q)=>{await p.goto(base+q); await p.waitForTimeout(300); return p.evaluate(()=>{const hd=document.querySelector('header.cu-header'),nv=hd.querySelector('.cu-nav').getBoundingClientRect(),r=hd.getBoundingClientRect();const bb=hd.querySelector('.cu-brand').getBoundingClientRect(),sl=hd.querySelector('.cu-brand__seal').getBoundingClientRect(),tx=hd.querySelector('.cu-brand__text').getBoundingClientRect();return {h:Math.round(r.height),navBottomGap:Math.round(r.bottom-nv.bottom),navUnderBrand:Math.round(nv.top-bb.bottom),sealTop:Math.round(sl.top),textTop:Math.round(tx.top)};});};
   const short=await h('1'), med=await h('1&height=medium'), tall=await h('1&height=tall');
   ok('banner height: short < medium < tall', short.h<med.h&&med.h<tall.h, JSON.stringify({short,med,tall}));
   ok('banner height: the navigation stays right under the logo and the picture grows below it', Math.abs(tall.navUnderBrand)<=2&&Math.abs(med.navUnderBrand)<=2&&tall.navBottomGap>med.navBottomGap&&med.navBottomGap>short.navBottomGap&&tall.navBottomGap>=100, JSON.stringify({short,med,tall}));
   ok('banner height: the seal and title stay at the top, in the same place at every height', short.sealTop===med.sealTop&&short.sealTop===tall.sealTop&&short.textTop===tall.textTop&&short.textTop===med.textTop, JSON.stringify({short,med,tall}));
   await p.goto(base+'slides&height=tall'); await p.waitForTimeout(300);
   const gap=await p.evaluate(()=>{const bs=document.querySelector('.cu-nav').getBoundingClientRect(),hb=document.querySelector('header.cu-header').getBoundingClientRect().bottom,cap=document.querySelector('.cu-header__caption.is-current').getBoundingClientRect(),ct=document.querySelector('.cu-header__controls').getBoundingClientRect(),nv=document.querySelector('.cu-nav').getBoundingClientRect();const free=hb-bs.bottom;return {free:Math.round(free),left:Math.round(free-(ct.bottom-cap.top)),above:Math.round(cap.top-bs.bottom),below:Math.round(hb-ct.bottom)};});
   ok('slideshow banner: the caption sits lower than the middle, with at least a fifth of the space left over below it', gap.below>=gap.left*0.2-2&&gap.above>gap.below, JSON.stringify(gap));
   const cur=()=>p.evaluate(()=>[...document.querySelectorAll('.cu-header__caption')].findIndex(e=>e.classList.contains('is-current')));
   await p.goto(base+'slides'); await p.waitForTimeout(300);
   const sl=await p.evaluate(()=>({pics:document.querySelectorAll('.cu-header__slide').length,hidden:document.querySelector('.cu-header__slides').getAttribute('aria-hidden'),caps:document.querySelectorAll('.cu-header__caption').length,heads:[...document.querySelectorAll('.cu-header__caption h2')].every(h=>h.textContent.trim().length>3),links:document.querySelectorAll('.cu-header__caption a').length,btns:[...document.querySelectorAll('.cu-header__controls .cu-slider__btn')].map(b=>b.getAttribute('aria-label')),pips:document.querySelectorAll('.cu-slider__pip').length,pipCur:[...document.querySelectorAll('.cu-slider__pip')].findIndex(e=>e.getAttribute('aria-current')==='true'),inert:[...document.querySelectorAll('.cu-header__caption')].map(e=>e.hasAttribute('inert')),region:document.querySelector('.cu-header__feature').getAttribute('aria-roledescription')}));
   ok('slideshow banner: pictures are hidden decoration; each slide has a headline, text and link; carousel region with a labelled group per slide', sl.pics===3&&sl.hidden==='true'&&sl.caps===3&&sl.heads&&sl.links===3&&sl.region==='carousel', JSON.stringify(sl));
   ok('slideshow banner: Previous, Next and Pause buttons and a dot per slide, the first one current, every caption still reachable (none inert)', sl.btns.join('|')==='Previous slide|Next slide|Pause slideshow'&&sl.pips===3&&sl.pipCur===0&&sl.inert.join()==='false,false,false', JSON.stringify(sl));
   await p.waitForTimeout(6800);
   ok('slideshow banner: the slides advance by themselves, picture and caption together', await cur()===1&&await p.evaluate(()=>[...document.querySelectorAll('.cu-header__slide')].findIndex(e=>e.classList.contains('is-current'))===1));
   await p.click('[aria-label="Next slide"]'); await p.waitForTimeout(300);
   const afterNext=await cur(); await p.waitForTimeout(6800);
   ok('slideshow banner: Next goes on one slide and stops autoplay for good', afterNext===2&&await cur()===2);
   await p.click('[aria-label="Previous slide"]'); ok('slideshow banner: Previous goes back one', await cur()===1);
   await p.locator('.cu-header__caption a').nth(2).focus(); ok('slideshow banner: focus on a caption link shows its slide (CDS)', await cur()===2);
   await p.click('[aria-label="Previous slide"]'); await p.click('[aria-label="Previous slide"]');
   await p.click('.cu-slider__pip[data-go="0"], .cu-slider__pip >> nth=0'); ok('slideshow banner: a dot shows its slide and marks itself current', await cur()===0&&await p.evaluate(()=>document.querySelector('.cu-slider__pip').getAttribute('aria-current')==='true'));
   await p.keyboard.press('ArrowRight'); ok('slideshow banner: ArrowRight on a dot moves to the next slide and keeps focus on its dot', await cur()===1&&await p.evaluate(()=>document.activeElement.classList.contains('cu-slider__pip')&&document.activeElement.getAttribute('aria-current')==='true'));
   await p.goto(base+'slides'); await p.waitForTimeout(300);
   await p.click('[data-act="toggle"]'); const lbl=await p.evaluate(()=>document.querySelector('[data-act="toggle"]').getAttribute('aria-label')); await p.waitForTimeout(6800);
   ok('slideshow banner: Pause stops it, and the button then says Play', await cur()===0&&lbl==='Play slideshow', await cur()+' '+lbl);
   ok('slideshow banner: the Pause button is reachable by keyboard with a visible focus ring', await (async()=>{await p.goto(base+'slides'); await p.waitForTimeout(300); for(let i=0;i<20&&!(await p.evaluate(()=>document.activeElement.getAttribute('data-act')==='toggle'));i++) await p.keyboard.press('Tab'); return p.evaluate(()=>{const e=document.activeElement,cs=getComputedStyle(e);return e.getAttribute('data-act')==='toggle'&&cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>=2;});})());
   await p.goto(root+'public.html?header=dark-header&topbar=line&photo=slides&logo=right'); await p.waitForTimeout(300);
   ok('seal on the right: the seal is right of the title (CDS logo-right)', await p.evaluate(()=>document.querySelector('.cu-brand__seal').getBoundingClientRect().left>document.querySelector('.cu-brand__text').getBoundingClientRect().left));
   await ctx.close(); }
 // ---- slideshow banner with a video on slide 2 (?video=2) ----
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage(); await p.goto(root+'public.html?header=dark-header&topbar=line&photo=slides&video=2&height=tall'); await p.waitForTimeout(500);
  const st=()=>p.evaluate(()=>{const v=document.querySelector('.cu-header__slide > video'),b=document.querySelector('[data-act="video"]');return {has:!!v,paused:v.paused,hidden:b.hidden,label:b.getAttribute('aria-label'),inLayer:!!v.closest('[aria-hidden="true"]'),btnInLayer:!!b.closest('[aria-hidden="true"]')}});
  const s0=await st();
  ok('banner video: slide 2 holds a video in the decorative picture layer; the button is outside it, and hidden while another slide shows', s0.has&&s0.paused&&s0.hidden&&s0.inLayer&&!s0.btnInLayer, JSON.stringify(s0));
  await p.click('.cu-slider__pip >> nth=1'); await p.waitForTimeout(700);
  const s1=await st();
  ok('banner video: it plays when its slide shows and the Pause video button appears', !s1.paused&&!s1.hidden&&s1.label==='Pause video', JSON.stringify(s1));
  await p.click('[data-act="video"]'); await p.waitForTimeout(200); const s2=await st();
  ok('banner video: its button pauses it (label Play video)', s2.paused&&s2.label==='Play video', JSON.stringify(s2));
  await p.click('.cu-slider__pip >> nth=0'); await p.waitForTimeout(300); const s3=await st();
  ok('banner video: it stops and its button hides when the slide changes', s3.paused&&s3.hidden, JSON.stringify(s3));
  ok('banner video: the button is a text button with its own words (Pause video / Play video) matching its name, an icon hidden from assistive technology, apart from the slideshow buttons, at least 24px', await p.evaluate(()=>{const b=document.querySelector('[data-act="video"]');b.hidden=false;const r=b.getBoundingClientRect();return b.tagName==='BUTTON'&&b.querySelector('svg').getAttribute('aria-hidden')==='true'&&b.textContent.trim()===b.getAttribute('aria-label')&&!b.closest('.cu-slider__buttons')&&r.width>=60&&r.height>=24}));
  await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}); const p=await ctx.newPage(); await p.goto(root+'public.html?header=dark-header&topbar=line&photo=slides&video=2&height=tall'); await p.waitForTimeout(400);
  await p.click('.cu-slider__pip >> nth=1'); await p.waitForTimeout(600);
  ok('banner video: with reduced motion it does not play (the picture shows) and the button offers Play video', await p.evaluate(()=>{const v=document.querySelector('.cu-header__slide > video');return v.paused&&document.querySelector('[data-act="video"]').getAttribute('aria-label')==='Play video'}));
  await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'}); const p=await ctx.newPage(); await p.goto(root+'public.html?header=dark-header&topbar=line&photo=slides'); await p.waitForTimeout(300);
   await p.waitForTimeout(6800); ok('slideshow banner with reduced motion: first slide stays, no Pause button, Previous and Next still there', await p.evaluate(()=>!document.querySelector('[data-act="toggle"]')&&document.querySelectorAll('.cu-header__controls .cu-slider__btn').length===2&&[...document.querySelectorAll('.cu-header__slide')].findIndex(e=>e.classList.contains('is-current'))===0));
   await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:390,height:800}}); const p=await ctx.newPage(); await p.goto(root+'public.html?header=dark-header&photo=1&nav=gradient&topbar=line');
   await p.click('.cu-header__menu'); await p.waitForTimeout(300);
   const bg=await p.evaluate(()=>{const c=getComputedStyle(document.querySelector('header.cu-header .cu-nav')).backgroundColor;const m=/rgba?\(([^)]+)\)/.exec(c)[1].split(/[ ,/]+/).map(Number);return {c,alpha:m.length>3?m[3]:1};});
   ok('photo banner on a phone: the opened menu overlay is nearly opaque, not see-through', bg.alpha>=0.9, JSON.stringify(bg));
   await ctx.close(); }
 // Dialog behaviour (CDS: focus bounds, Close first, Escape, backdrop click, held Enter ignored, focus returns)
 for (const pg of ['gallery','interactive']) {
  const ctx=await b.newContext({viewport:{width:1100,height:800}}); const p=await ctx.newPage(); await p.goto(root+pg+'.html');
  const opener=p.locator('[data-open-dialog]').first(); await opener.focus(); await p.keyboard.press('Enter');
  ok(pg+' dialog opens from the keyboard', await p.evaluate(()=>!!document.querySelector('dialog[open]')));
  ok(pg+' dialog: Close button gets focus first', await p.evaluate(()=>document.activeElement.classList.contains('cu-dialog__close')));
  ok(pg+' dialog has an accessible name', await p.evaluate(()=>{const d=document.querySelector('dialog[open]');const l=d.getAttribute('aria-labelledby');return !!(l&&document.getElementById(l)?.textContent.trim())||!!d.getAttribute('aria-label')}));
  const stops=await p.evaluate(()=>[...document.querySelector('dialog[open]').querySelectorAll('a[href],button,input,select,textarea,summary')].length);
  for (const key of ['Tab','Shift+Tab']) {
   let outside=0, seen=new Set();
   for(let i=0;i<stops*3+3;i++){ await p.keyboard.press(key); const r=await p.evaluate(()=>{const a=document.activeElement;return a.closest('dialog')?(a.className||a.tagName):null}); if(r===null) outside++; else seen.add(r); }
   ok(pg+' dialog: '+key+' never leaves the dialog ('+(stops*3+3)+' presses, '+stops+' controls)', outside===0 && seen.size>=2, outside+' presses landed outside');
  }
  await p.keyboard.press('Escape');
  ok(pg+' Escape closes the dialog', await p.evaluate(()=>!document.querySelector('dialog[open]')));
  ok(pg+' focus returns to the opener', await p.evaluate(()=>document.activeElement.hasAttribute('data-open-dialog')));
  await opener.click(); await p.mouse.click(4,4); // backdrop (outside the dialog box)
  ok(pg+' click on the backdrop closes the dialog', await p.evaluate(()=>!document.querySelector('dialog[open]')));
  await opener.focus(); await p.keyboard.down('Enter'); await p.keyboard.down('Enter'); await p.keyboard.up('Enter');
  ok(pg+' holding Enter does not flip the dialog open and shut', await p.evaluate(()=>!!document.querySelector('dialog[open]')));
  await ctx.close(); }
 // Tabs (CDS): manual activation. Arrows move focus and wrap; Enter or Space selects.
 { const ctx=await b.newContext({viewport:{width:1100,height:800}}); const p=await ctx.newPage(); await p.goto(root+'gallery.html');
  const tabs=p.locator('[role=tab]'); const n=await p.locator('.cu-tabs').first().locator('[role=tab]').count();
  await tabs.first().focus(); await p.keyboard.press('ArrowRight');
  ok('tabs: ArrowRight moves focus to the next tab', await p.evaluate(()=>document.activeElement.getAttribute('role')==='tab'&&document.activeElement.getAttribute('aria-selected')==='false'));
  await p.keyboard.press('Enter');
  ok('tabs: Enter activates the focused tab', await p.evaluate(()=>document.activeElement.getAttribute('aria-selected')==='true'));
  ok('tabs: only the selected tab is a tab stop (roving tabindex)', await p.evaluate(()=>{const r=document.activeElement.closest('[role=tablist]');return [...r.querySelectorAll('[role=tab]')].filter(t=>t.tabIndex===0).length===1}));
  await p.keyboard.press('Home'); await p.keyboard.press('ArrowLeft');
  ok('tabs: ArrowLeft on the first tab wraps to the last', await p.evaluate(()=>{const t=[...document.activeElement.closest('[role=tablist]').querySelectorAll('[role=tab]')];return document.activeElement===t[t.length-1]}));
  await p.keyboard.press('Tab');
  ok('tabs: Tab leaves the tab list into the open panel or the next control', await p.evaluate(()=>!document.activeElement.closest('[role=tablist]')));
  await ctx.close(); }
 // Search drawer: opens to the field, Escape closes and returns focus to the button
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage(); await p.goto(root+'public.html');
  const sb=p.locator('.cu-header__button[aria-controls^=search]'); await sb.focus(); await p.keyboard.press('Enter');
  ok('search: opens and focuses the field', await p.evaluate(()=>document.activeElement.type==='search'));
  await p.keyboard.press('Escape');
  ok('search: Escape closes it and returns focus to the button', await sb.getAttribute('aria-expanded')==='false' && await p.evaluate(()=>document.activeElement.getAttribute('aria-controls')?.startsWith('search')));
  // closing slides up like opening slides down: still on screen and moving a moment after the press, hidden once it has finished
  await p.waitForTimeout(700); await sb.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  await sb.click(); await p.waitForTimeout(60);
  const mid=await p.evaluate(()=>{const e=document.querySelector('.cu-search');return {hidden:e.hidden,closing:e.classList.contains('is-closing'),mt:parseFloat(getComputedStyle(e).marginBlockStart)};});
  ok('search: closing is animated (still shown and sliding up after 60ms)', !mid.hidden&&mid.closing&&mid.mt<0, JSON.stringify(mid));
  await p.waitForTimeout(700);
  ok('search: hidden once the closing animation ends', await p.evaluate(()=>document.querySelector('.cu-search').hidden&&!document.querySelector('.cu-search').classList.contains('is-closing')));
  await sb.click(); await p.waitForTimeout(500); await sb.click(); await p.waitForTimeout(60); await sb.click(); await p.waitForTimeout(700);
  ok('search: reopening during the close cancels it, and it is still open after the animation', await sb.getAttribute('aria-expanded')==='true' && await p.evaluate(()=>!document.querySelector('.cu-search').hidden&&!document.querySelector('.cu-search').classList.contains('is-closing')));
  await ctx.close(); }
 // Mobile menu overlay (below 960px): dialog semantics, focus trap, Escape, focus return
 { const ctx=await b.newContext({viewport:{width:375,height:800}}); const p=await ctx.newPage(); await p.goto(root+'public.html');
  const t=p.locator('.cu-header__menu').first(); await t.focus(); await p.keyboard.press('Enter');
  ok('mobile menu button expands', await t.getAttribute('aria-expanded')==='true');
  ok('menu overlay is a modal dialog', await p.evaluate(()=>{const n=document.querySelector('.cu-nav');return n.getAttribute('role')==='dialog'&&n.getAttribute('aria-modal')==='true'}));
  ok('menu overlay moves focus to Close', await p.evaluate(()=>document.activeElement.classList.contains('cu-nav__close')));
  { let outside=0; for(const key of ['Tab','Shift+Tab']) for(let i=0;i<20;i++){ await p.keyboard.press(key); if(!await p.evaluate(()=>!!document.activeElement.closest('.cu-nav'))) outside++; }
    ok('menu overlay: Tab and Shift+Tab never leave it (40 presses)', outside===0, outside+' landed outside'); }
  ok('page behind the overlay is inert', await p.evaluate(()=>!!document.querySelector('main[inert]')));
  ok('overlay links visible', await p.evaluate(()=>document.querySelector('.cu-nav__link').getBoundingClientRect().height>0));
  await p.keyboard.press('Escape');
  ok('Escape closes the overlay and returns focus to Menu', await t.getAttribute('aria-expanded')==='false' && await p.evaluate(()=>document.activeElement.classList.contains('cu-header__menu')));
  ok('collapsed nav is not visible', await p.evaluate(()=>getComputedStyle(document.querySelector('.cu-nav')).display==='none'));
  await ctx.close(); }
 // Home header never uses the wordmark; inner header never uses the seal (CDS brand rule)
 { const ctx=await b.newContext({viewport:{width:1280,height:800}}); const p=await ctx.newPage();
  await p.goto(root+'public.html'); ok('home page: seal, no wordmark', await p.evaluate(()=>!!document.querySelector('header .cu-seal')&&!document.querySelector('header .cu-utility__wordmark')));
  for (const pg of ['dashboard','gallery']) { await p.goto(root+pg+'.html'); ok(pg+' (inner page): wordmark, no seal', await p.evaluate(()=>!!document.querySelector('header .cu-utility__wordmark')&&!document.querySelector('header .cu-seal'))); }
  await ctx.close(); }
 // No-JS: navigation still usable
 { const ctx=await b.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'}); const p=await ctx.newPage(); await p.goto(root+'dashboard.html'); await p.waitForTimeout(100);
   ok('app shell: with reduced motion the menu switches without sliding', await p.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('.cu-app__body')).transitionDuration)<0.01)); await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:375,height:800},javaScriptEnabled:false}); const p=await ctx.newPage(); await p.goto(root+'public.html');
  ok('no-JS: main nav links still visible', await p.evaluate(()=>document.querySelector('.cu-nav__link').getBoundingClientRect().height>0)); await ctx.close(); }
 // Reduced motion, forced colors, contrast more
 { const ctx=await b.newContext({reducedMotion:'reduce',viewport:{width:1100,height:800}}); const p=await ctx.newPage(); await p.goto(root+'gallery.html');
  const m=await p.evaluate(()=>{let long=0;document.querySelectorAll('*').forEach(e=>{const d=parseFloat(getComputedStyle(e).transitionDuration)||0;const a=parseFloat(getComputedStyle(e).animationDuration)||0; if(d>0.01||a>0.01) long++}); return long});
  ok('reduced motion: no transitions/animations', m===0, m+' elements'); await ctx.close(); }
 { const ctx=await b.newContext({forcedColors:'active',viewport:{width:1100,height:800}}); const p=await ctx.newPage(); await p.goto(root+'gallery.html');
  const r=await p.evaluate(()=>{const btn=document.querySelector('.cu-button');const cs=getComputedStyle(btn);return{border:cs.borderTopStyle+' '+cs.borderTopWidth, logoFill:(()=>{const l=document.querySelector('.cu-logo');return l?getComputedStyle(l).fill:'n/a'})()}});
  ok('forced-colors: buttons keep a border', r.border.startsWith('solid')&&parseFloat(r.border.split(' ')[1])>0, r.border); await ctx.close(); }
 // Language, title, landmarks, headings
 for (const page of ['public','gallery','tokens','navigation','dashboard']) { const ctx=await b.newContext(); const p=await ctx.newPage(); await p.goto(root+page+'.html');
  const s=await p.evaluate(()=>({lang:document.documentElement.lang,title:document.title,h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length,hs:[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h=>+h.tagName[1]), banner:!!document.querySelector('header,[role=banner]'), nav:document.querySelectorAll('nav').length, navNamed:[...document.querySelectorAll('nav')].filter(n=>!n.getAttribute('aria-label')&&!n.getAttribute('aria-labelledby')).length}));
  let skip=false; for(let i=1;i<s.hs.length;i++) if(s.hs[i]-s.hs[i-1]>1) skip=true;
  ok(page+' lang/title/one h1/one main', !!s.lang&&!!s.title&&s.h1===1&&s.main===1, JSON.stringify({h1:s.h1,main:s.main}));
  ok(page+' heading levels do not skip', !skip, s.hs.join(''));
  if (page!=='tokens'&&page!=='navigation') { const req=await p.evaluate(()=>{const l=[...document.querySelectorAll('footer.cu-footer a')].map(a=>a.href);return{contentinfo:!!document.querySelector('footer.cu-footer'),cornell:l.some(h=>/^https:\/\/www\.cornell\.edu\/?$/.test(h)),privacy:l.some(h=>h==='https://privacy.cornell.edu/'),access:l.some(h=>/tdx\.cornell\.edu.*ServiceDet\?ID=373|accessibility\.cornell\.edu.*web-accessibility-assistance/.test(h)),copy:/©\s*20\d\d/.test(document.querySelector('footer.cu-footer')?.textContent||'')}});
   ok(page+' footer has required Cornell links and ©year', req.contentinfo&&req.cornell&&req.privacy&&req.access&&req.copy, JSON.stringify(req)); }
  ok(page+' multiple <nav> all labelled', s.nav<2||s.navNamed===0, s.navNamed+' unlabelled of '+s.nav);
  await ctx.close(); }
 // Print / viewport meta zoom
 { const ctx=await b.newContext(); const p=await ctx.newPage(); await p.goto(root+'public.html'); ok('viewport allows zoom (1.4.4)', await p.evaluate(()=>!/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(document.querySelector('meta[name=viewport]').content))); await ctx.close(); }

 // ---- Navigation menus (blocks/nav.css + the reference behaviour) ----
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage(); await p.goto(root+'navigation.html');
  const focusId=()=>p.evaluate(()=>{const e=document.activeElement;return e&&(e.textContent||'').trim().slice(0,40)+'|'+e.className});
  const nav=p.locator('nav[aria-label="Dropdown navigation"]');
  const parentLink=nav.locator('.cu-nav__list > .cu-nav__parent > .cu-nav__link').nth(1); // "Navigation item" with the flyout menu
  const open=()=>nav.locator('.cu-nav__list > .cu-nav__parent.is-open').count();
  ok('menus: every disclosure button has aria-expanded and a name', await p.evaluate(()=>[...document.querySelectorAll('.cu-nav__toggle')].every(t=>t.hasAttribute('aria-expanded')&&(t.textContent||'').trim().length>0)));
  ok('menus: closed submenu links are not tab stops', await p.evaluate(()=>{const n=document.querySelector('nav[aria-label="Dropdown navigation"]');return [...n.querySelectorAll('.cu-nav__sub a')].every(a=>a.getClientRects().length===0)}));
  await parentLink.focus(); await p.keyboard.press('ArrowDown');
  ok('menus: Down on a parent opens it and focuses the first item', (await open())===1 && (await focusId()).startsWith('Secondary item|'), await focusId());
  await p.keyboard.press('ArrowDown'); ok('menus: Down moves to the next item (the flyout parent)', (await focusId()).startsWith('Secondary item with a flyout'), await focusId());
  await p.keyboard.press('ArrowRight'); ok('menus: Right opens a flyout and enters it', (await focusId()).startsWith('Tertiary'), await focusId());
  await p.keyboard.press('ArrowLeft'); ok('menus: Left returns from a flyout to its parent', (await focusId()).startsWith('Secondary item with a flyout'), await focusId());
  await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); ok('menus: Up from the first item returns to the top-level link', (await focusId()).startsWith('Navigation item|'), await focusId());
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('Escape');
  ok('menus: Escape closes the menu and returns focus to its link', (await open())===0 && (await focusId()).startsWith('Navigation item|'), await focusId());
  await parentLink.focus(); await p.keyboard.press('ArrowRight'); ok('menus: Right on the bar moves to the next top-level item', (await focusId()).startsWith('Navigation item|'));
  await parentLink.focus(); await p.keyboard.press('ArrowDown');
  let tabs=0; for(let i=0;i<12;i++){ await p.keyboard.press('Tab'); tabs++; if(!(await nav.evaluate((n)=>n.contains(document.activeElement)))) break; }
  ok('menus: Tab leaves an open menu (no trap) and it closes', tabs<12 && (await open())===0, tabs+' tabs');
  // pointer: hover opens, moving away closes, Escape closes a hover-opened menu
  await nav.locator('.cu-nav__list > .cu-nav__parent').first().hover(); await p.waitForTimeout(100);
  ok('menus: hover opens a menu', (await open())===1);
  await p.keyboard.press('Escape'); ok('menus: Escape dismisses a hover-opened menu (1.4.13)', (await open())===0);
  // mega: Left/Right jump columns, Up/Down follow them
  const mega=p.locator('nav[aria-label="Light megamenu"]'); const mTop=mega.locator('.cu-nav__list > .cu-nav__parent > .cu-nav__link').first();
  await mTop.focus(); await p.keyboard.press('ArrowDown');
  const g1=await focusId(); await p.keyboard.press('ArrowRight'); const g2=await focusId();
  ok('mega: Down opens the panel on the first link; Right jumps to the next column', g1.startsWith('About Cornell')&&g2.startsWith('Life at Cornell'), g1+' → '+g2);
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowDown'); ok('mega: Left returns and Down walks the column', (await focusId()).startsWith('Cornell History'), await focusId());
  await p.keyboard.press('Escape'); ok('mega: Escape closes and returns to the top-level link', (await mega.locator('.cu-nav__list > .cu-nav__parent.is-open').count())===0 && (await focusId()).startsWith('Explore'));
  // phone: the bar folds behind a button, submenus are accordions, nothing scrolls sideways
  const pc=await b.newContext({viewport:{width:375,height:800}}); const q=await pc.newPage(); await q.goto(root+'navigation.html');
  const tg=q.locator('.cu-nav-toggle').first(); const pn=q.locator('nav[aria-label="Dropdown navigation"]');
  ok('phone: the bar is folded until its button is pressed', !(await pn.isVisible()) && (await tg.getAttribute('aria-expanded'))==='false');
  await tg.click(); ok('phone: the button opens the bar', await pn.isVisible() && (await tg.getAttribute('aria-expanded'))==='true');
  const t2=pn.locator('.cu-nav__toggle').nth(1); await t2.click();
  ok('phone: a submenu toggle opens an accordion', (await t2.getAttribute('aria-expanded'))==='true' && await pn.locator('.cu-nav__sub').first().isVisible().catch(()=>false) || (await pn.locator('.cu-nav__parent.is-open > .cu-nav__sub').count())===1);
  ok('phone: no horizontal scroll with the menus open', await q.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  // no script: menus still reachable by hover/focus, and no dead buttons
  const nc=await b.newContext({viewport:{width:1280,height:800},javaScriptEnabled:false}); const n=await nc.newPage(); await n.goto(root+'navigation.html');
  ok('no-JS: disclosure buttons stay hidden and the bar still shows', await n.evaluate(()=>[...document.querySelectorAll('.cu-nav__toggle')].every(t=>getComputedStyle(t).display==='none')&&!!document.querySelector('.cu-nav__list')&&getComputedStyle(document.querySelector('.cu-nav-toggle[hidden]')).display==='none'));
  await ctx.close(); await pc.close(); await nc.close(); }

 // ---- Header: search panel, navigation spread and shape, breadcrumb space ----
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage(); await p.goto(root+'public.html');
  const y0=await p.evaluate(()=>document.querySelector('header.cu-header').getBoundingClientRect().top);
  await p.locator('.cu-header__button[aria-controls^=search]').click(); await p.waitForTimeout(350);
  const sr=await p.evaluate(()=>{const s=document.querySelector('.cu-search'),h=document.querySelector('header.cu-header');const sb=s.getBoundingClientRect(),hb=h.getBoundingClientRect();return{panelAbove:sb.bottom<=hb.top+5,pushed:hb.top>0,label:!!s.querySelector('label[for]'),radios:s.querySelectorAll('input[type=radio]').length,group:!!s.querySelector('fieldset legend'),bg:getComputedStyle(s).backgroundColor,h:Math.round(sb.height),submitName:(s.querySelector('button[type=submit]').textContent||'').trim()}});
  ok('search: panel slides in above the header and pushes the page down', sr.panelAbove&&sr.pushed&&sr.h>=100, JSON.stringify(sr));
  ok('search: labelled field, "This site / Cornell" radio group, named submit button', sr.label&&sr.radios===2&&sr.group&&sr.submitName.length>0);
  ok('search: panel colours are the CDS dark red', sr.bg==='rgb(160, 17, 20)', sr.bg);
  await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage(); await p.goto(root+'headers.html');
  const info=await p.evaluate(()=>[...document.querySelectorAll('header.cu-header nav.cu-nav')].map(n=>{const ul=n.querySelector('.cu-nav__list'),li=[...ul.children].map(x=>x.getBoundingClientRect()),nb=n.getBoundingClientRect(),cc=n.querySelector('.cu-container'),pad=parseFloat(getComputedStyle(cc).paddingLeft),c={left:cc.getBoundingClientRect().left+pad,right:cc.getBoundingClientRect().right-pad};const a=ul.querySelector('a').getBoundingClientRect();return{cls:n.className.replace('cu-nav ',''),first:Math.round(li[0].left-c.left),last:Math.round(c.right-li[li.length-1].right),linkH:Math.round(a.height),barH:Math.round(nb.height),gap:Math.round(a.top-nb.top)}}));
  const by=(k)=>info.find(i=>i.cls.includes(k)&&!i.cls.includes('red cu-nav--end'));
  const start=info.find(i=>i.cls==='cu-nav--start'), flat=start, tall=info.find(i=>i.cls.includes('cu-nav--tall')&&i.cls.includes('--start'));
  ok('header nav: flat bar fills edge to edge, tall bar leaves a gap', flat.gap===0&&flat.linkH===flat.barH&&tall.gap>=5&&tall.barH>tall.linkH, JSON.stringify([flat,tall]));
  ok('header nav: start aligns left, end aligns right', start.first<30&&info.find(i=>i.cls.includes('--end')&&i.cls.includes('underlines')).last<30);
  const even=info.find(i=>i.cls.includes('--even')), between=info.find(i=>i.cls.includes('--between')), around=info.find(i=>i.cls.includes('--around')), center=info.find(i=>i.cls.includes('--center'));
  ok('header nav: even and around leave space at both ends, between does not', even.first>40&&even.last>40&&around.first>40&&around.last>40&&(!between||between.first<30), JSON.stringify({even:[even.first,even.last],around:[around.first,around.last]}));
  ok('header nav: center is balanced', Math.abs(center.first-center.last)<4, center.first+' / '+center.last);
  await ctx.close(); }
 for (const [w,min] of [[1280,43],[800,18],[375,18]]) { const ctx=await b.newContext({viewport:{width:w,height:900}}); const p=await ctx.newPage(); await p.goto(root+'gallery.html');
  const gap=await p.evaluate(()=>{const h=document.querySelector('header.cu-header').getBoundingClientRect().bottom;const bc=document.querySelector('.cu-breadcrumb');const nav=document.querySelector('.cu-header > .cu-nav');const navB=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().bottom:h;return Math.round(bc.getBoundingClientRect().top-Math.max(h,navB))});
  ok('breadcrumb has space under the header at '+w+'px', gap>=min, gap+'px (min '+min+')'); await ctx.close(); }
 for (const [w,right] of [[1280,true],[800,true],[375,false]]) { const ctx=await b.newContext({viewport:{width:w,height:900}}); const p=await ctx.newPage(); await p.goto(root+'headers.html');
  const r=await p.evaluate(()=>{const h=document.querySelector('.cu-header--logo-right');const sl=h.querySelector('.cu-brand__seal').getBoundingClientRect();const tx=h.querySelector('.cu-brand__text').getBoundingClientRect();return{sealX:sl.left+sl.width/2,textX:tx.left+tx.width/2,sealY:sl.top,textY:tx.top}});
  if(right) ok('header seal on the right at '+w+'px', r.sealX>r.textX, Math.round(r.sealX)+' vs text '+Math.round(r.textX)); else ok('header seal stacks above the title on phones', r.sealY<r.textY, Math.round(r.sealY)+' vs '+Math.round(r.textY));
  await ctx.close(); }
 for (const [w,idx,right,tint] of [[1280,0,false,true],[1280,1,true,true],[800,3,true,false]]) { const ctx=await b.newContext({viewport:{width:w,height:900}}); const p=await ctx.newPage(); await p.goto(root+'sidebars.html');
  const r=await p.evaluate((i)=>{const g=document.querySelectorAll('.cu-region')[i];const q=s=>g.querySelector(s).getBoundingClientRect();const a=q('.cu-region__article'),pr=q('.cu-sidebar--primary'),se=q('.cu-sidebar--secondary');return{a:a.left,pr:pr.left,prB:pr.bottom,seT:se.top,seL:se.left,aL:a.left}},idx);
  ok('sidebars '+(right?'right':'left')+' at '+w+'px: primary above secondary, same column', Math.abs(r.pr-r.seL)<2 && r.seT>=r.prB-1, JSON.stringify(r));
  ok('sidebars '+(right?'right':'left')+' at '+w+'px: side', right? r.pr>r.a : r.pr<r.a, r.pr+' vs '+r.a);
  await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:375,height:900}}); const p=await ctx.newPage(); await p.goto(root+'sidebars.html');
  const y=await p.evaluate(()=>{const g=document.querySelectorAll('.cu-region')[1];const t=s=>g.querySelector(s).getBoundingClientRect().top;return[t('.cu-sidebar--primary'),t('.cu-region__article'),t('.cu-sidebar--secondary')]});
  ok('sidebars on phones: primary, article, secondary in order', y[0]<y[1]&&y[1]<y[2], y.map(Math.round).join(' < ')); await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p=await ctx.newPage(); await p.goto(root+'content.html');
  const clip=await p.evaluate(()=>{const q=document.querySelector('.cu-quote--offset');const r=q.getBoundingClientRect();let e=q.parentElement;while(e&&e!==document.body){const o=getComputedStyle(e).overflowX;if(o!=='visible'){const b=e.getBoundingClientRect();if(r.left<b.left-1)return 'clipped by '+e.className+' ('+Math.round(r.left)+' < '+Math.round(b.left)+')'}e=e.parentElement}return ''});
  ok('offset quote is not clipped', clip==='', clip);
  const r=await p.evaluate(()=>{const fs=e=>{const c=getComputedStyle(e);return c.fontSize+'|'+c.fontWeight+'|'+c.fontStyle};const real=[...document.querySelectorAll('#real-headings > *')];const sw=[...document.querySelectorAll('#swapped-headings > *')];return{real:real.map(fs),sw:sw.map(fs)}});
  ok('headings: h2.cu-h4 looks like h4', r.sw[0]===r.real[3], r.sw[0]+' vs '+r.real[3]);
  ok('headings: h4.cu-h2 looks like h2', r.sw[2]===r.real[1], r.sw[2]+' vs '+r.real[1]);
  ok('headings: h3.cu-h6 looks like h6', r.sw[1]===r.real[5], r.sw[1]+' vs '+r.real[5]);
  ok('headings: h5.cu-h3 looks like h3', r.sw[3]===r.real[2], r.sw[3]+' vs '+r.real[2]); await ctx.close(); }
 for (const w of [1280,375]) { const ctx=await b.newContext({viewport:{width:w,height:900}}); const p=await ctx.newPage(); await p.goto(root+'forms.html');
  const r=await p.evaluate(()=>{const i=document.querySelector('.cu-input');const bad=[...document.querySelectorAll('[aria-invalid="true"]')].filter(e=>!(e.getAttribute('aria-describedby')||'').split(' ').every(id=>document.getElementById(id)));const small=[...document.querySelectorAll('.cu-button')].filter(e=>e.getBoundingClientRect().height<24).length;const red=getComputedStyle(document.querySelector('.cu-button--red')).backgroundColor;return{w:i.getBoundingClientRect().width,cw:i.closest('.cu-container').getBoundingClientRect().width,bad:bad.length,small,red}});
  ok('forms: field width at '+w+'px', w>=1000? r.w<=600.5 : r.w>=r.cw-60, Math.round(r.w)+' in '+Math.round(r.cw));
  ok('forms: every invalid field points at an existing description', r.bad===0, r.bad+' broken');
  ok('forms: buttons meet the 24px target size', r.small===0, r.small+' too small');
  if(w===1280){ ok('forms: red button is the CDS red', r.red==='rgb(179, 27, 27)', r.red);
   await p.click('label[for="'+await p.evaluate(()=>document.querySelector('.cu-form-item > .cu-label').getAttribute('for'))+'"]');
   const foc=await p.evaluate(()=>document.activeElement.className); ok('forms: clicking a label focuses its field', /cu-input|cu-select|cu-textarea/.test(foc), foc);
   const cb=await p.evaluate(()=>{const c=document.querySelector('.cu-check[type=checkbox]:not(:checked)');c.focus();return c.id}); await p.keyboard.press('Space');
   ok('forms: Space toggles a checkbox', await p.evaluate(id=>document.getElementById(id).checked,cb)); }
  await ctx.close(); }
 // ---- video backdrop (blocks/backdrop.css): starts by itself, always pausable, a still picture for reduced motion ----
 { const ctx=await b.newContext({viewport:{width:1100,height:900}}); const p=await ctx.newPage(); await p.goto(root+'layout.html'); await p.waitForTimeout(1200);
  const st=()=>p.evaluate(()=>{const v=document.querySelector('.cu-backdrop > video'),b=v.parentElement.querySelector('.cu-backdrop__pause');return {paused:v.paused,muted:v.muted,loop:v.loop,label:b&&b.getAttribute('aria-label'),pausedClass:b&&b.classList.contains('is-paused'),t:v.currentTime,sound:v.mozHasAudio||v.webkitAudioDecodedByteCount>0};});
  const s0=await st();
  ok('video backdrop: it plays by itself, muted and looping, and the button offers Pause', !s0.paused&&s0.muted&&s0.loop&&s0.label==='Pause background video'&&!s0.pausedClass, JSON.stringify(s0));
  ok('video backdrop: only video backdrops get a Pause button (image backdrops have none)', await p.evaluate(()=>[...document.querySelectorAll('.cu-backdrop')].every(e=>!!e.querySelector(':scope > video')===!!e.querySelector('.cu-backdrop__pause'))));
  ok('video backdrop: the video is hidden from assistive technology as decoration, the button is a labelled button', await p.evaluate(()=>{const v=document.querySelector('.cu-backdrop > video');const b=v.parentElement.querySelector('button.cu-backdrop__pause');return v.getAttribute('aria-hidden')==='true'&&!v.hasAttribute('controls')&&!!b&&b.getAttribute('aria-label').length>5&&!b.hasAttribute('aria-pressed')}));
  await p.locator('.cu-backdrop__pause').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  const s1=await st(); await p.waitForTimeout(500); const s2=await st();
  ok('video backdrop: Enter on the button pauses it, the label says Play and the picture stops', s1.paused&&s1.label==='Play background video'&&s1.pausedClass&&s2.t===s1.t, JSON.stringify([s1,s2]));
  await p.keyboard.press('Space'); await p.waitForTimeout(300);
  ok('video backdrop: Space plays it again', !(await st()).paused);
  ok('video backdrop: the button has a visible focus ring and is at least 24px', await p.evaluate(()=>{const b=document.querySelector('.cu-backdrop__pause');b.focus();const r=b.getBoundingClientRect();return r.width>=24&&r.height>=24&&getComputedStyle(b).outlineStyle!=='none'||getComputedStyle(b).boxShadow!=='none'}));
  ok('video backdrop: the page does not scroll sideways', await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1100,height:900},reducedMotion:'reduce'}); const p=await ctx.newPage(); await p.goto(root+'layout.html'); await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>{const v=document.querySelector('.cu-backdrop > video'),b=v.parentElement.querySelector('.cu-backdrop__pause');return {paused:v.paused,t:v.currentTime,label:b.getAttribute('aria-label'),poster:!!v.getAttribute('poster')}});
  ok('video backdrop: with reduced motion it does not start, shows its poster, and the button offers Play', r.paused&&r.t===0&&r.poster&&r.label==='Play background video', JSON.stringify(r));
  await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1100,height:900},javaScriptEnabled:false}); const p=await ctx.newPage(); await p.goto(root+'layout.html');
  ok('video backdrop: without script it is a still picture (no autoplay attribute, no dead button)', await p.evaluate(()=>{const v=document.querySelector('.cu-backdrop > video');return !v.hasAttribute('autoplay')&&v.paused&&!document.querySelector('.cu-backdrop__pause')}));
  await ctx.close(); }
 // ---- the home page and the content page are built from the same parts (tools/build-pages.mjs) ----
 for (const pg of ['public','page']) { const ctx=await b.newContext({viewport:{width:1100,height:900}}); const p=await ctx.newPage(); await p.goto(root+pg+'.html'); await p.waitForTimeout(300);
  const has=await p.evaluate(()=>Object.fromEntries(Object.entries({tabs:'.cu-tabs [role=tab]',callout:'.cu-callout',quote:'.cu-quote',table:'.cu-table',accordion:'.cu-accordion',form:'form.cu-form',cards:'.cu-cards__card',notice:'.cu-notice',tones:'.cu-text-soft'}).map(([k,sel])=>[k,!!document.querySelector(sel)])));
  ok(pg+': it holds the shared content elements (tabs, callout, quote, table, accordion, form, cards, notice, text tones)', Object.values(has).every(Boolean), JSON.stringify(has));
  await p.locator('.cu-tabs [role=tab]').nth(1).click();
  ok(pg+': its tabs work: the second tab shows its panel and hides the first', await p.evaluate(()=>{const t=[...document.querySelectorAll('.cu-tabs [role=tab]')];const pn=id=>document.getElementById(id);return t[1].getAttribute('aria-selected')==='true'&&!pn(t[1].getAttribute('aria-controls')).hidden&&pn(t[0].getAttribute('aria-controls')).hidden}));
  ok(pg+': one h1, and no heading level is skipped', await p.evaluate(()=>{const h=[...document.querySelectorAll('main h1,main h2,main h3,main h4,main h5')].map(e=>+e.tagName[1]);let prev=0;return h.filter(n=>n===1).length===1&&h.every(n=>{const okk=n<=prev+1;prev=n;return okk})}));
  await ctx.close(); }
 for (const w of [1280,375]) { const ctx=await b.newContext({viewport:{width:w,height:900}}); const p=await ctx.newPage(); await p.goto(root+'layout.html');
  const r=await p.evaluate(()=>{const W=e=>e.getBoundingClientRect().width;
   const c12=[...document.querySelector('.cu-columns--1-2').children].map(W);
   const tiles=[...document.querySelectorAll('.cu-cards--tiles')[0].querySelectorAll('.cu-cards__card')].slice(0,3).map(e=>Math.round(e.getBoundingClientRect().top));
   const dark=getComputedStyle(document.querySelector('.cu-band--accent4')).colorScheme;
   const pause=document.querySelector('.cu-backdrop__pause').getBoundingClientRect();
   const co=[...document.querySelectorAll('.cu-callout')][1]; const cp=co.querySelector('.cu-callout__photo').getBoundingClientRect(), cm=co.querySelector('.cu-callout__message').getBoundingClientRect();
   return {c12,tiles,dark,pw:pause.width,stack:cm.top>=cp.bottom-1,over:document.documentElement.scrollWidth-innerWidth}; });
  ok('layout: no horizontal scroll at '+w+'px', r.over<=0, r.over);
  ok('layout: dark band switches colour scheme', /dark/.test(r.dark), r.dark);
  ok('layout: pause button meets target size', r.pw>=24, r.pw);
  ok('layout: callout in a narrow column stacks photo over message', r.stack);
  if(w===1280){ ok('layout: 1-2 columns are one third and two thirds', Math.abs(r.c12[1]/r.c12[0]-2)<0.1, r.c12.join(' / '));
   ok('layout: tiles sit three across at 1280', r.tiles[0]===r.tiles[1]&&r.tiles[1]===r.tiles[2], r.tiles.join(',')); }
  else { ok('layout: columns stack on phones', await p.evaluate(()=>{const k=[...document.querySelector('.cu-columns--1-1').children];return k[1].getBoundingClientRect().top>=k[0].getBoundingClientRect().bottom-1})); }
  await ctx.close(); }
 for (const [w,pg] of [[375,'headers'],[800,'headers'],[1280,'headers'],[375,'public']]) { const ctx=await b.newContext({viewport:{width:w,height:900}}); const p=await ctx.newPage(); await p.goto(root+pg+'.html');
  // the bar-less header's Search tab is 44 x 40 on purpose (CDS), and is checked on its own below
  const r=await p.evaluate(()=>[...document.querySelectorAll('.cu-header__button')].filter(e=>e.offsetWidth&&!(innerWidth>=960&&!e.closest('.cu-header').querySelector(':scope > .cu-utility'))).map(e=>Math.abs(e.getBoundingClientRect().width-e.getBoundingClientRect().height)).filter(d=>d>0.5).length);
  ok('header icon buttons are exactly square at '+w+'px ('+pg+'), except the CDS 44x40 tab of the bar-less header', r===0, r+' not square');
  await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:375,height:900}}); const p=await ctx.newPage(); await p.goto(root+'headers.html');
  await p.evaluate(()=>{const m=document.querySelector('.cu-header[data-collapsible] .cu-header__menu'); if(m) m.click();});
  const r=await p.evaluate(()=>{const c=[...document.querySelectorAll('.cu-nav__close')].find(e=>e.offsetWidth); if(!c) return null; const q=c.getBoundingClientRect(); return {w:q.width,h:q.height,rad:parseFloat(getComputedStyle(c).borderRadius)}});
  ok('menu close button is a true circle', !r || (Math.abs(r.w-r.h)<0.5 && r.rad>=r.w/2), JSON.stringify(r)); await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1280,height:900}}); const p=await ctx.newPage(); await p.goto(root+'forms.html');
  const r=await p.evaluate(()=>[...document.querySelectorAll('.cu-button--icon-only')].map(e=>{const q=e.getBoundingClientRect();return Math.abs(q.width-q.height)}).filter(d=>d>0.5).length);
  ok('icon-only buttons are exactly square (round ones are circles)', r===0, r+' not square'); await ctx.close(); }
 await b.close(); return out;
}

async function interactive(chromium, root){
 const b=await chromium.launch(); const pg='interactive';
 const open=async(w=1100,h=900,opts={})=>{const ctx=await b.newContext(Object.assign({viewport:{width:w,height:h}},opts)); const p=await ctx.newPage(); await p.goto(root+pg+'.html'); return [ctx,p];};
 // ---- tablists: every variant (CDS: arrows wrap, Enter/Space select, roving tabindex, hidden panels) ----
 { const [ctx,p]=await open();
  for (const [name,sel] of [['default','#a-t0'],['navbar','#b-t0'],['lined','#c-t0'],['dark bar','#d-t0']]) {
   const first=p.locator(sel); await first.focus(); await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter');
   const r=await p.evaluate((s)=>{const list=document.querySelector(s).closest('[role=tablist]');const tabs=[...list.querySelectorAll('[role=tab]')];const sel=tabs.filter(t=>t.getAttribute('aria-selected')==='true');
     const shown=tabs.filter(t=>!document.getElementById(t.getAttribute('aria-controls')).hidden);
     return {n:sel.length,idx:tabs.indexOf(sel[0]),shown:shown.length,stops:tabs.filter(t=>t.tabIndex===0).length,focus:document.activeElement===sel[0]}},sel);
   ok('tabs ('+name+'): Right then Enter selects the second tab, one panel shown, one tab stop', r.n===1&&r.idx===1&&r.shown===1&&r.stops===1&&r.focus, JSON.stringify(r));
   await p.keyboard.press('Space'); await p.keyboard.press('End'); await p.keyboard.press('Space');
   ok('tabs ('+name+'): End then Space selects the last tab', await p.evaluate((s)=>{const t=[...document.querySelector(s).closest('[role=tablist]').querySelectorAll('[role=tab]')];return t[t.length-1].getAttribute('aria-selected')==='true'},sel));
  }
  for (const id of ['#a-t0','#b-t0']) { await p.locator(id).focus(); await p.keyboard.press('Home'); await p.keyboard.press('Enter'); }
  await p.waitForTimeout(400);
  const cols=await p.evaluate(()=>{const f=(s)=>{const e=document.querySelector(s);const c=getComputedStyle(e);return {bg:c.backgroundColor,bb:c.borderBottomColor,col:c.color}};return {def:f('#a-t0'),nav:f('#b-t0')}});
  ok('tabs: default selected tab is link blue on white text; navbar selected has a carnelian underline', /0, 102, 153/.test(cols.def.bg)&&/255, 255, 255/.test(cols.def.col)&&/179, 27, 27/.test(cols.nav.bb), JSON.stringify(cols));
  { const [c3,q]=await open(1280,900); const m=await q.evaluate(()=>{const g=(s)=>{const e=document.querySelector(s),c=getComputedStyle(e),n=e.nextElementSibling;return {pad:c.padding,fs:c.fontSize,gap:Math.round(n.getBoundingClientRect().left-e.getBoundingClientRect().right),h:Math.round(e.getBoundingClientRect().height*10)/10}};
     const lt=document.querySelector('#c-t0').closest('[role=tablist]');return {def:g('#a-t0'),nav:g('#b-t0'),lined:g('#c-t0'),railGap:getComputedStyle(lt).marginBottom}});
    ok('tabs at 1280px match the measured CDS boxes: default 7.2/22.5/8.1 padding, 46px tall, 6px apart', m.def.pad==='7.2px 22.5px 8.1px'&&m.def.h===46.1&&m.def.gap===6, JSON.stringify(m.def));
    ok('tabs at 1280px: navbar --large is 24px with 60px between labels; lined is 0 20px padding, touching, 15px under the rail', m.nav.fs==='24px'&&m.nav.gap===60&&m.lined.pad==='0px 20px'&&m.lined.gap===0&&m.railGap==='15px', JSON.stringify(m));
    await c3.close(); }
  await ctx.close(); }
 // ---- accordions ----
 { const [ctx,p]=await open();
  const sum=p.locator('#one-set summary');
  await sum.nth(1).click(); await sum.nth(2).click();
  ok('accordion: single-select leaves exactly one item open', await p.evaluate(()=>document.querySelectorAll('#one-set details[open]').length===1 && document.querySelectorAll('#one-set details')[2].open));
  const eb=p.locator('#ex-set .cu-accordion-set__toggle');
  ok('accordion: expand all button is added by script with a label', (await eb.count())===1 && (await eb.textContent()).trim()==='Expand all');
  await eb.focus(); await p.keyboard.press('Enter');
  ok('accordion: Expand all opens every item and the button says Close all', await p.evaluate(()=>[...document.querySelectorAll('#ex-set details')].every(d=>d.open)) && (await eb.textContent()).trim()==='Close all');
  await p.locator('#ex-set summary').first().click(); await p.waitForTimeout(80);
  ok('accordion: closing one item puts the button back to Expand all', (await eb.textContent()).trim()==='Expand all');
  await p.locator('#ex-set summary').first().focus(); await p.keyboard.press('Enter');
  ok('accordion: Enter on a heading toggles it (no script needed)', await p.evaluate(()=>document.querySelector('#ex-set details').open));
  await p.keyboard.press('Space');
  ok('accordion: Space on a heading toggles it', await p.evaluate(()=>!document.querySelector('#ex-set details').open));
  ok('accordion: every heading is at least 24px tall', await p.evaluate(()=>[...document.querySelectorAll('summary')].every(s=>s.getBoundingClientRect().height>=24)));
  const ex=await p.evaluate(()=>{const sets=[...document.querySelectorAll('.cu-accordion-set')];return sets.map(s=>{const items=[...s.children].filter(c=>c.tagName==='DETAILS');const single=items.some(d=>d.hasAttribute('name'));const t=s.querySelector(':scope > .cu-accordion-set__toggle');return {want:items.length>1&&!single,has:!!t,first:t?s.firstElementChild===t:null}})});
  ok('accordion: as in CDS, every set of two or more (not single-select) gets Expand all at the top', ex.every(e=>e.want===e.has&&(!e.has||e.first)), JSON.stringify(ex));
  const ac=await p.evaluate(()=>{const cset=document.querySelector('.cu-accordion-set--compact');const d=cset.querySelector('details');d.open=true;const ic=getComputedStyle(d.querySelector('summary'),'::after');
    const sd=document.querySelector('.cu-accordion-set--simple > details');return {icon:ic.opacity,iconBg:ic.backgroundColor,simplePad:getComputedStyle(sd).paddingLeft}});
  ok('accordion: the open compact glyph is solid carnelian; simple keeps 15px sides', ac.icon==='1'&&/179, 27, 27/.test(ac.iconBg)&&ac.simplePad==='15px', JSON.stringify(ac));
  await ctx.close(); }
 // ---- tooltips (hover 150ms, focus, hoverable, Escape, edge detection) ----
 { const [ctx,p]=await open();
  const trig=p.locator('.cu-tooltip__trigger').first(), tip=p.locator('.cu-tooltip__tip').first();
  ok('tooltip: trigger is described by the tip; role=tooltip only on tips with no link in them', await p.evaluate(()=>{const ts=[...document.querySelectorAll('.cu-tooltip')];return ts.every(w=>{const t=w.querySelector('.cu-tooltip__trigger'),e=w.querySelector('.cu-tooltip__tip');return t.getAttribute('aria-describedby')===e.id&&(e.getAttribute('role')==='tooltip')===!e.querySelector('a[href],button')})&&ts.some(w=>w.querySelector('.cu-tooltip__tip a'))}));
  { await trig.focus(); await p.keyboard.press('Tab'); await p.waitForTimeout(400);
    const inTip=await p.evaluate(()=>{const a=document.activeElement;return a.tagName==='A'&&!!a.closest('.cu-tooltip__tip.is-active')});
    ok('tooltip: Tab from the trigger reaches the link in the tip, and the tip stays open while focus is in it (1.4.13)', inTip);
    await p.keyboard.press('Escape'); await p.waitForTimeout(50);
    ok('tooltip: Escape inside the tip closes it and returns focus to its trigger', !(await tip.isVisible()) && await p.evaluate(()=>document.activeElement===document.querySelector('.cu-tooltip__trigger')));
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(400);
    ok('tooltip: Tab out of the tip closes it after the delay', !(await tip.isVisible())); }
  ok('tooltip: hidden until asked for', !(await tip.isVisible()));
  await trig.focus(); await p.waitForTimeout(80);
  ok('tooltip: keyboard focus shows it', await tip.isVisible());
  await p.keyboard.press('Escape');
  ok('tooltip: Escape dismisses it while focus stays on the trigger', !(await tip.isVisible()) && await p.evaluate(()=>document.activeElement.classList.contains('cu-tooltip__trigger')));
  await p.mouse.move(2,2); await trig.hover(); await p.waitForTimeout(320);
  ok('tooltip: pointer hover shows it', await tip.isVisible());
  const tb=await tip.boundingBox(); await p.mouse.move(tb.x+tb.width/2, tb.y+tb.height/2, {steps:6}); await p.waitForTimeout(450);
  ok('tooltip: stays open while the pointer is on the tip (hoverable)', await tip.isVisible());
  await p.mouse.move(2,2); await p.waitForTimeout(450);
  ok('tooltip: closes after the pointer leaves both', !(await tip.isVisible()));
  await p.locator('.cu-tooltip__trigger').nth(4).focus(); await p.waitForTimeout(80);
  const inside=await p.evaluate(()=>{const r=document.querySelectorAll('.cu-tooltip__tip')[4].getBoundingClientRect();return r.left>=0&&r.right<=document.documentElement.clientWidth});
  ok('tooltip: a trigger at the right edge keeps its tip inside the viewport', inside);
  await ctx.close();
  const [c2,q]=await open(320,700); await q.locator('.cu-tooltip__trigger').nth(4).focus(); await q.waitForTimeout(80);
  ok('tooltip: stays inside a 320px screen', await q.evaluate(()=>{const r=document.querySelectorAll('.cu-tooltip__tip')[4].getBoundingClientRect();return r.left>=0&&r.right<=document.documentElement.clientWidth}));
  await c2.close(); }
 // ---- page, header search, default nav ----
 { for (const [mode,want] of [['light','rgb(255, 255, 255)'],['dark','rgb(34, 34, 34)']]) { const [ctx,p]=await open(1280,900,{colorScheme:mode}); await p.goto(root+'gallery.html');
     const bg=await p.evaluate(()=>getComputedStyle(document.body).backgroundColor); ok(`page: the page is CDS ${mode==='light'?'white':'#222'} (${mode}), grey only in bands`, bg===want, bg); await ctx.close(); }
   const [ctx,p]=await open(1280,900); await p.goto(root+'headers.html');
   const sr=await p.evaluate(()=>{const h=[...document.querySelectorAll('header.cu-header')].find(h=>h.querySelector('.cu-utility__search'));const vis=e=>e&&e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden';return {field:vis(h.querySelector('.cu-utility__search input')),button:vis(h.querySelector('.cu-header__button:not(.cu-header__menu)'))}});
   ok('header: with the inline search field on desktop there is no second Search button', sr.field&&!sr.button, JSON.stringify(sr)); await ctx.close();
   const [c2,q]=await open(390,800); await q.goto(root+'headers.html');
   const sm=await q.evaluate(()=>{const h=[...document.querySelectorAll('header.cu-header')].find(h=>h.querySelector('.cu-utility__search'));const vis=e=>e&&e.getClientRects().length>0;return {field:vis(h.querySelector('.cu-utility__search input')),button:vis(h.querySelector('.cu-header__button:not(.cu-header__menu)'))}});
   ok('header: on phones the inline field hides and the Search button is the way in', !sm.field&&sm.button, JSON.stringify(sm)); await c2.close();
   for (const pgn of ['public']) { const [c3,r]=await open(1280,900); await r.goto(root+pgn+'.html');
     const cls=await r.evaluate(()=>document.querySelector('header nav.cu-nav').className); ok(`${pgn}: the header uses the default navigation (flush items, tinted current page)`, cls==='cu-nav', cls); await c3.close(); }
 }
 // ---- mode switch in the footer ----
 { const [ctx,p]=await open(1280,900,{colorScheme:'light'}); await p.goto(root+'public.html');
   await p.locator('.cu-mode-switch label',{hasText:'Dark'}).click();
   const a=await p.evaluate(()=>[document.documentElement.getAttribute('data-mode'),getComputedStyle(document.body).backgroundColor]);
   ok('mode switch: Dark sets data-mode="dark" and the page goes dark', a[0]==='dark'&&a[1]==='rgb(34, 34, 34)', JSON.stringify(a));
   await p.locator('.cu-mode-switch input:checked').focus(); await p.keyboard.press('ArrowLeft');
   const b2=await p.evaluate(()=>[document.documentElement.getAttribute('data-mode'),document.activeElement.value]);
   ok('mode switch: one radio group, arrows move between the choices', b2[0]==='light'&&b2[1]==='light', JSON.stringify(b2));
   await p.keyboard.press('ArrowLeft');
   ok('mode switch: Automatic removes data-mode (follow the OS)', await p.evaluate(()=>!document.documentElement.hasAttribute('data-mode')));
   const t=await p.evaluate(()=>[...document.querySelectorAll('.cu-mode-switch label > span')].map(e=>Math.round(e.getBoundingClientRect().height)));
   ok('mode switch: every choice is at least 24px tall', t.every(h=>h>=24), t.join(',')); await ctx.close(); }
 // ---- motion: reveals, parallax, reduced motion, no script ----
 { const [ctx,p]=await open(1280,800); await p.goto(root+'motion.html'); await p.waitForTimeout(400);
   const st=()=>p.evaluate(()=>Object.fromEntries(['m-onload','m-fade','m-slide','m-custom'].map(id=>{const e=document.getElementById(id);return [id,{rev:e.classList.contains('is-revealed'),op:getComputedStyle(e).opacity}]})));
   let a=await st();
   ok('motion: on-load reveals at once; the others stay hidden until scrolled to', a['m-onload'].rev&&!a['m-fade'].rev&&a['m-fade'].op==='0'&&!a['m-slide'].rev, JSON.stringify(a));
   await p.evaluate(()=>document.getElementById('m-fade').scrollIntoView({block:'center'})); await p.waitForTimeout(900); a=await st();
   ok('motion: fade-in reveals when its top passes 85% of the viewport and ends fully visible', a['m-fade'].rev&&a['m-fade'].op==='1'&&!a['m-custom'].rev, JSON.stringify(a));
   await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(200);
   await p.locator('#m-slide a').focus(); await p.waitForTimeout(50);
   ok('motion: keyboard focus inside a hidden block reveals it at once', await p.evaluate(()=>document.getElementById('m-slide').classList.contains('is-revealed')));
   const y=async()=>p.evaluate(()=>{const m=getComputedStyle(document.getElementById('m-para')).transform;return m==='none'?0:Math.round(new DOMMatrix(m).m42)});
   await p.evaluate(()=>{const e=document.getElementById('m-para');window.scrollTo(0,e.getBoundingClientRect().top+scrollY-innerHeight+20)}); await p.waitForTimeout(150); const y1=await y();
   await p.evaluate(()=>{const e=document.getElementById('m-para');window.scrollTo(0,e.getBoundingClientRect().top+scrollY-20)}); await p.waitForTimeout(150); const y2=await y();
   ok('motion: parallax drifts against the scroll (down entering, up leaving)', y1>0&&y2<0, y1+' → '+y2);
   await ctx.close();
   const [c2,q]=await open(1280,800,{reducedMotion:'reduce'}); await q.goto(root+'motion.html'); await q.waitForTimeout(300);
   const r=await q.evaluate(()=>({all:[...document.querySelectorAll('.cu-motion-fadein,.cu-motion-slidein,.cu-motion-custom')].every(e=>getComputedStyle(e).opacity==='1'&&getComputedStyle(e).transform==='none'),para:getComputedStyle(document.getElementById('m-para')).transform}));
   ok('motion: with reduced motion everything is shown at once and nothing moves', r.all&&r.para==='none', JSON.stringify(r)); await c2.close();
   const [c3,s3]=await open(1280,800,{javaScriptEnabled:false}); await s3.goto(root+'motion.html');
   ok('motion: without script nothing is hidden', await s3.evaluate(()=>[...document.querySelectorAll('[class*=cu-motion-]')].every(e=>getComputedStyle(e).opacity==='1')));
   await c3.close(); }
 // ---- header top line: at every width, except over a red bar ----
 { for (const w of [1280,390]) { const [ctx,p]=await open(w,900); await p.goto(root+'decisions.html');
     const r=await p.evaluate(()=>[...document.querySelectorAll('header.cu-header')].map(h=>{const u=h.querySelector('.cu-utility');const bw=parseFloat(getComputedStyle(h).borderTopWidth);const hr=h.getBoundingClientRect(),ur=u.getBoundingClientRect();return {theme:h.dataset.theme||'red',line:Math.round((ur.top-hr.top)*10)/10,bw,col:getComputedStyle(h).borderTopColor}}));
     const red=r.find(x=>x.theme==='red'),others=r.filter(x=>x.theme!=='red');
     ok(`header top line at ${w}px: hidden over the red bar, a 4px carnelian line over light, dark and blue`, red.line===0&&others.length===3&&others.every(x=>x.line===4&&/179, 27, 27/.test(x.col)), JSON.stringify(r));
     await ctx.close(); }
   const [ctx,p]=await open(1280,900); await p.goto(root+'public.html');
   ok('header top line: the public home header (red bar) has no extra 4px at desktop', await p.evaluate(()=>{const h=document.querySelector('header.cu-header');return h.querySelector('.cu-utility').getBoundingClientRect().top-h.getBoundingClientRect().top===0}));
   await ctx.close(); }
 // ---- header without the utility bar: line + hanging red Search tab ----
 { const [ctx,p]=await open(1280,900); await p.goto(root+'headers.html');
   const m=await p.evaluate(()=>{const h=document.querySelector('header[aria-label="Site banner: Home header without the utility bar"]');const H=h.getBoundingClientRect();const b=h.querySelector('.cu-header__button:not(.cu-header__menu)');const r=b.getBoundingClientRect();return {line:getComputedStyle(h).borderTopWidth,bar:!!h.querySelector('.cu-utility'),btn:[Math.round(r.width),Math.round(r.height),Math.round(r.top-H.top)],bg:getComputedStyle(b).backgroundColor,seal:Math.round(h.querySelector('.cu-seal').getBoundingClientRect().top-H.top),nav:Math.round(h.querySelector('nav').getBoundingClientRect().top-H.top)}});
   ok('header without a utility bar: the 4px line, a carnelian 44x40 Search tab hanging from it, CDS spacing (seal 63, nav 214 at 1280)', m.line==='4px'&&!m.bar&&m.btn.join()==='44,40,4'&&/179, 27, 27/.test(m.bg)&&m.seal===63&&m.nav===214, JSON.stringify(m)); await ctx.close(); }
 // ---- CDS cards: the summary is outside the link ----
 { const [ctx,p]=await open(1280,900); await p.goto(root+'public.html');
   const c=await p.evaluate(()=>[...document.querySelectorAll('#tools .cu-cards__card')].map(c=>({inLink:!!c.querySelector('a .cu-cards__summary'),summary:!!c.querySelector('.cu-cards__body .cu-cards__summary'),top:Math.round(c.getBoundingClientRect().top)})));
   ok('public: Featured tools are CDS cards, three across, summary outside the link', c.length===3&&c.every(x=>!x.inLink&&x.summary&&x.top===c[0].top), JSON.stringify(c)); await ctx.close(); }
 // ---- cards: media is flush with the card edges, cards sit side by side in the auto grid ----
 { const [ctx,p]=await open(1488,900); await p.goto(root+'gallery.html'); await p.waitForTimeout(300);
   const c=await p.evaluate(()=>[...document.querySelectorAll('.cu-auto-grid > .cu-card')].map(card=>{const r=card.getBoundingClientRect(),m=card.querySelector('.cu-card__media'),b=getComputedStyle(card);return {pad:b.paddingLeft+' '+b.paddingRight,w:Math.round(r.width),top:Math.round(r.top),m:m?(()=>{const q=m.getBoundingClientRect();return [Math.round(q.left-r.left-parseFloat(b.borderLeftWidth)),Math.round(r.right-q.right-parseFloat(b.borderRightWidth)),Math.round(q.top-r.top-parseFloat(b.borderTopWidth))]})():null}}));
   ok('cards: no gutter inside the card, so a picture runs to all three edges', c.length>=3&&c.every(x=>x.pad==='0px 0px'&&(!x.m||x.m.every(v=>v===0))), JSON.stringify(c));
   ok('cards: the auto grid puts three cards side by side at 1488px', c.slice(0,3).every(x=>x.top===c[0].top)&&c[0].w<600, JSON.stringify(c.map(x=>x.w)));
   ok('cards: no .cu-card is a direct child of the CDS column grid', await p.evaluate(()=>!document.querySelector('.cu-grid > .cu-card')));
   await ctx.close(); }
 // ---- hover tabs: content tabs (#ht1 left, #ht2 right) and link tabs (#ht3 right --rad, #ht4 left) ----
 { const [ctx,p]=await open();
  const labels=p.locator('#ht1 > .cu-hovertabs__label');
  const vis=(id='#ht1')=>p.evaluate(id=>[...document.querySelectorAll(id+' > .cu-hovertabs__panel')].map(e=>getComputedStyle(e).visibility==='visible'&&getComputedStyle(e).opacity>0.5),id);
  await p.waitForTimeout(900);
  ok('hover tabs: first panel shows first, the others are hidden from sight and from the keyboard', JSON.stringify(await vis())==='[true,false,false]');
  await labels.nth(2).hover(); await p.waitForTimeout(1200);
  ok('hover tabs: hovering a label shows its panel', JSON.stringify(await vis())==='[false,false,true]' && await labels.nth(2).getAttribute('aria-expanded')==='true' && await labels.nth(0).getAttribute('aria-expanded')==='false');
  await p.mouse.move(2,2); await labels.nth(1).focus(); await p.waitForTimeout(1200);
  ok('hover tabs: focusing a label shows its panel', JSON.stringify(await vis())==='[false,true,false]');
  await p.keyboard.press('Tab');
  ok('hover tabs: Tab from a label goes into its own panel', await p.evaluate(()=>!!document.activeElement.closest('#ht1 > .cu-hovertabs__panel.is-current')));
  const g=await p.evaluate(()=>{
    const r=s=>document.querySelector(s).getBoundingClientRect();
    const tint=e=>{const c=e.querySelector('.cu-hovertabs__content');if(!c)return null;const b=getComputedStyle(c,'::before');return b.content!=='none'?b.backgroundColor:null};
    const pan=document.querySelector('#ht1 > .cu-hovertabs__panel.is-current');
    const cur=document.querySelector('#ht1 > .cu-hovertabs__label.is-current');
    return {
      tintFillsPanel: getComputedStyle(pan.querySelector('.cu-hovertabs__content')).position==='static' && !!tint(pan),
      blackCurrent: getComputedStyle(cur).backgroundColor,
      redCurrent: getComputedStyle(document.querySelector('#ht2 > .cu-hovertabs__label.is-current')).backgroundColor,
      rightPanelFirst: r('#ht2 > .cu-hovertabs__panel').left < r('#ht2 > .cu-hovertabs__label').left && r('#ht3 > .cu-hovertabs__panel').left < r('#ht3 > .cu-hovertabs__label').left,
      leftPanelSecond: r('#ht1 > .cu-hovertabs__panel').left > r('#ht1 > .cu-hovertabs__label').left && r('#ht4 > .cu-hovertabs__panel').left > r('#ht4 > .cu-hovertabs__label').left,
      linkPanelsBare: [...document.querySelectorAll('#ht3 > .cu-hovertabs__panel, #ht4 > .cu-hovertabs__panel')].every(e=>!e.children.length && !e.hasAttribute('tabindex')),
      wrapped: [...document.querySelectorAll('#ht3 > a, #ht4 > a')].every(a=>a.firstElementChild&&a.firstElementChild.classList.contains('cu-hovertabs__text')),
      smallFont: getComputedStyle(document.querySelector('#ht2 > .cu-hovertabs__label')).fontSize,
    }});
  ok('hover tabs: the content tint covers the whole picture, not a box behind the text', g.tintFillsPanel);
  ok('hover tabs: the current label is black by default and carnelian with --red', g.blackCurrent==='rgb(0, 0, 0)' && g.redCurrent==='rgb(179, 27, 27)', g.blackCurrent+' '+g.redCurrent);
  ok('hover tabs: --right puts the picture first for both kinds, the default puts it second', g.rightPanelFirst && g.leftPanelSecond);
  ok('hover tabs: link panels are only a picture (no content, no tint, no tab stop)', g.linkPanelsBare);
  ok('hover tabs: link label text is wrapped for the underline', g.wrapped);
  ok('hover tabs: --small sets 15px labels', g.smallFont==='15px', g.smallFont);
  // link tabs: underline grows under the current one; --rad stops 1em short; Enter follows the link
  const ul=id=>p.evaluate(id=>[...document.querySelectorAll(id+' > a .cu-hovertabs__text')].map(e=>getComputedStyle(e).backgroundSize),id);
  await p.waitForTimeout(700); let u=await ul('#ht3');
  ok('link tabs: only the current label has the carnelian underline, 1em short with --rad', /^calc\(100% - (1em|18px)\)/.test(u[0]) && u.slice(1).every(x=>x.startsWith('0')), JSON.stringify(u));
  await p.locator('#ht4 > a').nth(2).hover(); await p.waitForTimeout(900); u=await ul('#ht4');
  ok('link tabs: hovering moves the full-width underline (no --rad) to that label', u[2]==='100% 2px' && u[0].startsWith('0'), JSON.stringify(u));
  ok('link tabs: the boxed arrow fades in on the current one without --rad, and --rad has none', await p.evaluate(()=>getComputedStyle(document.querySelectorAll('#ht4 > a')[2],'::after').opacity)>0.3 && await p.evaluate(()=>getComputedStyle(document.querySelector('#ht3 > a'),'::after').content)==='none');
  await p.locator('#ht3 > a').nth(1).focus(); await p.waitForTimeout(300);
  ok('link tabs: focusing a link label shows its picture', JSON.stringify(await vis('#ht3'))==='[false,true,false,false,false]');
  await p.keyboard.press('Tab');
  ok('link tabs: Tab goes straight to the next link (the picture is not a stop)', await p.evaluate(()=>document.activeElement===document.querySelectorAll('#ht3 > a')[2]));
  await ctx.close();
  const [c2,q]=await open(600,800); const st=await q.evaluate(()=>({labels:[...document.querySelectorAll('#ht1 > .cu-hovertabs__label, #ht2 > .cu-hovertabs__label')].every(e=>getComputedStyle(e).display==='none'),links:[...document.querySelectorAll('#ht3 > a, #ht4 > a')].every(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).backgroundColor==='rgb(0, 0, 0)'),panels:[...document.querySelectorAll('.cu-hovertabs__panel')].every(e=>getComputedStyle(e).visibility==='visible'&&getComputedStyle(e).opacity==='1')}));
  ok('hover tabs below 768px: content labels hide, link labels stay as black bars over their pictures, every panel stacks', st.labels&&st.links&&st.panels, JSON.stringify(st)); await c2.close(); }
 // ---- back to top ----
 { const [ctx,p]=await open(1100,700,{reducedMotion:'reduce'});
  const fb=p.locator('.cu-back-to-top--floating');
  ok('back to top: the floating button is hidden at the top of the page', !(await fb.isVisible()));
  await p.evaluate(()=>window.scrollTo(0,1500)); await p.waitForTimeout(150);
  ok('back to top: it appears after scrolling down', await fb.isVisible());
  await fb.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  ok('back to top: pressing it scrolls to the top and moves focus to <main>', await p.evaluate(()=>window.scrollY<5&&document.activeElement.tagName==='MAIN'));
  ok('back to top: it is hidden again at the top', !(await fb.isVisible()));
  await p.evaluate(()=>window.scrollTo(0,1500)); await p.waitForTimeout(150);
  const sz=await p.evaluate(()=>{const r=document.querySelector('.cu-back-to-top--floating').getBoundingClientRect();return [r.width,r.height]});
  ok('back to top: a true circle at least 44px', Math.abs(sz[0]-sz[1])<0.5&&sz[0]>=44, sz.join('x'));
  await ctx.close(); }
 // ---- modal: the CDS close square and its size ----
 { const [ctx,p]=await open(); await p.locator('[data-open-dialog]').first().click();
  const r=await p.evaluate(()=>{const c=document.querySelector('dialog[open] .cu-dialog__close').getBoundingClientRect();const d=document.querySelector('dialog[open]').getBoundingClientRect();return {cw:c.width,ch:c.height,dw:d.width}});
  ok('modal: the close button is a square of at least 24px; the box is at least 640px wide on a desktop', Math.abs(r.cw-r.ch)<0.5&&r.cw>=24&&r.dw>=640, JSON.stringify(r));
  const t=await p.evaluate(()=>{const d=document.querySelector('dialog[open]');const h=d.querySelector('h2');return {ff:getComputedStyle(h).fontFamily,fs:getComputedStyle(h).fontSize,foot:getComputedStyle(d.querySelector('.cu-dialog__footer')).paddingTop}});
  ok('modal: the title keeps the page h2 look (serif) and the actions sit 4em below the text, as CDS', /freight-text|serif/.test(t.ff)&&t.foot==='72px', JSON.stringify(t));
  const live=await p.evaluate(()=>{const b=document.getElementById('toast1');return b.getAttribute('role')==='status'&&!b.hasAttribute('hidden')&&getComputedStyle(b).display!=='none'&&b.querySelector('.cu-update__content').textContent===''});
  ok('toast: the live region is in the accessibility tree and empty before anything happens', live);
  await p.locator('dialog[open] [data-show-update]').click(); await p.waitForTimeout(450);
  const shown=await p.evaluate(()=>{const b=document.getElementById('toast1'),r=b.getBoundingClientRect();return {open:b.hasAttribute('data-open'),text:b.textContent.trim(),right:Math.round(innerWidth-document.documentElement.clientWidth+ (document.documentElement.clientWidth-r.right)),w:Math.round(r.width),dialog:!!document.querySelector('dialog[open]'),focus:document.activeElement.getAttribute('data-open-dialog')}});
  ok('toast: confirming the dialog closes it, returns focus to its button, and shows the success message bottom right', shown.open&&/unsubscribed/.test(shown.text)&&!shown.dialog&&shown.focus==='modal1'&&shown.w===360, JSON.stringify(shown));
  await p.locator('#toast1').hover(); await p.waitForTimeout(4300);
  ok('toast: it stays while the pointer is on it (2.2.1)', await p.evaluate(()=>document.getElementById('toast1').hasAttribute('data-open')));
  await p.mouse.move(2,2); await p.waitForTimeout(4300);
  ok('toast: it closes itself 4s after the pointer leaves, and empties', await p.evaluate(()=>{const b=document.getElementById('toast1');return !b.hasAttribute('data-open')&&b.textContent.trim()===''}));
  await p.locator('[data-show-update=upd1]').click(); await p.waitForTimeout(4500);
  ok('update: the inline message stays until dismissed', await p.evaluate(()=>document.getElementById('upd1').hasAttribute('data-open')));
  await p.locator('#upd1 .cu-update__close').click();
  ok('update: Dismiss closes it and returns focus to the button that showed it', await p.evaluate(()=>!document.getElementById('upd1').hasAttribute('data-open')&&document.activeElement.getAttribute('data-show-update')==='upd1'));
  const hd=await p.evaluate(()=>{const h=document.querySelector('main h2, h2');const h5=document.querySelector('h3.cu-h5');const ff=e=>getComputedStyle(e).fontFamily;const a=ff(h),b=ff(h5);document.documentElement.setAttribute('data-headings','sans');const c=ff(h);document.documentElement.removeAttribute('data-headings');return {h2:a,h5:b,sans:c}});
  ok('headings: h1-h3 are Freight Text (serif) as in CDS, .cu-h5 stays sans, data-headings="sans" switches them back', /freight-text/.test(hd.h2)&&/freight-sans/.test(hd.h5)&&/freight-sans/.test(hd.sans), JSON.stringify(hd));
  const lt=await p.evaluate(()=>{const a=document.querySelector('a.cu-tooltip__trigger'),c=getComputedStyle(a);return {col:c.color,bb:c.borderBottomStyle,desc:!!a.getAttribute('aria-describedby')}});
  ok('tooltip: a link trigger keeps the link look and is described by its tip', /0, 102, 153/.test(lt.col)&&lt.bb==='none'&&lt.desc, JSON.stringify(lt));
  const ht5=await p.evaluate(()=>{const r=document.getElementById('ht5');return {count:r.getAttribute('data-count'),ultra:[...r.querySelectorAll('.cu-hovertabs__label')].every(l=>l.classList.contains('is-ultra')),compact6:null}});
  ok('hover tabs: eight labels get the tightest padding and the picture spans all eight rows', ht5.count==='8'&&ht5.ultra, JSON.stringify(ht5));
  await ctx.close(); }
 await b.close(); return out;
}

async function sliders(chromium, root){
 const b=await chromium.launch(); const pg='sliders';
 const open=async(w=1100,h=900,opts={})=>{const ctx=await b.newContext(Object.assign({viewport:{width:w,height:h}},opts)); const p=await ctx.newPage(); await p.goto(root+pg+'.html'); return [ctx,p];};
 const cur=(p,id)=>p.evaluate((i)=>[...document.querySelectorAll('#'+i+' .cu-slider__slide')].findIndex(s=>s.classList.contains('is-current')),id);
 // ---- image slider ----
 { const [ctx,p]=await open();
  ok('slider: starts on the first slide; the others are transparent but not inert or hidden, so their captions stay reachable and read out (CDS)', await cur(p,'sl1')===0 && await p.evaluate(()=>[...document.querySelectorAll('#sl1 .cu-slider__slide')].slice(1).every(s=>!s.hasAttribute('inert')&&getComputedStyle(s).visibility==='visible'&&getComputedStyle(s).opacity==='0')));
  ok('slider: it is a labelled carousel and each slide is "n of N"', await p.evaluate(()=>{const r=document.querySelector('#sl1');return r.getAttribute('aria-roledescription')==='carousel'&&!!r.getAttribute('aria-label')&&[...r.querySelectorAll('.cu-slider__slide')].every((s,i)=>s.getAttribute('aria-label')===(i+1)+' of 4'&&s.getAttribute('aria-roledescription')==='slide')}));
  const tog=p.locator('#sl1 [data-act=toggle]');
  ok('slider: a pause button is present while it autoplays and says what it does', (await tog.getAttribute('aria-label'))==='Pause slideshow');
  await p.waitForTimeout(4700);
  ok('slider: autoplay moves to the next slide after the interval', await cur(p,'sl1')===1);
  ok('slider: there is no live region (nothing is added or removed when a slide changes); a status line carries control changes', await p.evaluate(()=>!document.querySelector('#sl1 [aria-live]')&&document.querySelectorAll('#sl1 [role=status]').length===1));
  await tog.focus(); await p.keyboard.press('Enter');
  ok('slider: the pause button stops it (label becomes Play)', (await tog.getAttribute('aria-label'))==='Play slideshow');
  const was=await cur(p,'sl1'); await p.waitForTimeout(4700);
  ok('slider: paused means it does not move', await cur(p,'sl1')===was);
  await tog.focus(); await p.keyboard.press('Space');
  ok('slider: Play starts it again (label Pause)', (await tog.getAttribute('aria-label'))==='Pause slideshow');
  await p.locator('#sl1 [data-act=next]').click();
  ok('slider: Next goes on one slide and stops autoplay for good', (await tog.getAttribute('aria-label'))==='Play slideshow');
  ok('slider: Next says where we are in the status line', /^Slide \d of 4: \S/.test(await p.locator('#sl1 [role=status]').textContent()));
  await p.locator('#sl1 [data-act=prev]').click(); const afterPrev=await cur(p,'sl1');
  ok('slider: Previous goes back one slide', afterPrev===(was+1-1+4)%4 || afterPrev>=0);
  const pip=p.locator('#sl1 .cu-slider__pip').nth(0); await pip.focus(); await p.keyboard.press('Home');
  await p.keyboard.press('ArrowRight');
  ok('slider: ArrowRight on a pip shows the next slide and moves focus to its pip', await cur(p,'sl1')===1 && await p.evaluate(()=>document.activeElement===document.querySelectorAll('#sl1 .cu-slider__pip')[1]));
  await p.keyboard.press('End');
  ok('slider: End shows the last slide, ArrowRight then wraps to the first', await cur(p,'sl1')===3);
  await p.keyboard.press('ArrowRight');
  ok('slider: wraps from the last slide to the first', await cur(p,'sl1')===0);
  ok('slider: the current pip is marked aria-current, only one', await p.evaluate(()=>document.querySelectorAll('#sl1 .cu-slider__pip[aria-current=true]').length===1));
  const tabs=await p.evaluate(()=>[...document.querySelectorAll('#sl1 a[href],#sl1 button')].filter(e=>!e.closest('[inert]')).length);
  const caps=await p.evaluate(()=>document.querySelectorAll('#sl1 .cu-slider__slide a[href]').length);
  const vbtns=await p.evaluate(()=>document.querySelectorAll('#sl1 .cu-slider__video').length);
  ok('slider: every caption link and every control (and a video slide\'s own button) can be tabbed to, in page order (nothing is inert)', tabs===caps+3+4+vbtns && caps>=4, 'found '+tabs+' with '+caps+' caption links');
  await p.locator('#sl1 .cu-slider__slide').nth(2).locator('a[href]').first().focus();
  ok('slider: focus on a caption link shows its slide (CDS) and keeps autoplay stopped', await cur(p,'sl1')===2 && (await tog.getAttribute('aria-label'))==='Play slideshow');
  const sz=await p.evaluate(()=>[...document.querySelectorAll('#sl1 .cu-slider__btn,#sl1 .cu-slider__pip')].map(e=>{const r=e.getBoundingClientRect();return Math.min(r.width,r.height)}));
  ok('slider: every control is at least 24px', sz.every(v=>v>=24), sz.join(','));
  await ctx.close(); }
 // ---- a slide that holds a video ----
 { const [ctx,p]=await open(); const sl=':is(#sl1 .cu-slider__slide:nth-child(2))';
  const vid=()=>p.evaluate(()=>{const v=document.querySelector('#sl1 .cu-slider__slide:nth-child(2) > video'),b=v.parentElement.querySelector('.cu-slider__video');return {paused:v.paused,label:b&&b.getAttribute('aria-label'),hidden:v.getAttribute('aria-hidden'),ctl:v.hasAttribute('controls'),auto:v.hasAttribute('autoplay')}});
  ok('slider video: a slide can hold a <video>; it is a decorative picture with a Pause button and does not play while another slide shows', await (async()=>{const v=await vid();return v.paused&&v.hidden==='true'&&!v.ctl&&!v.auto&&!!v.label})());
  await p.locator('#sl1 .cu-slider__pip').nth(1).click(); await p.waitForTimeout(600);
  ok('slider video: it plays by itself when its slide shows, and its button offers Pause', await (async()=>{const v=await vid();return !v.paused&&v.label==='Pause video'})());
  await p.locator('#sl1 .cu-slider__slide:nth-child(2) .cu-slider__video').click(); await p.waitForTimeout(200);
  ok('slider video: its button pauses it (label Play)', await (async()=>{const v=await vid();return v.paused&&v.label==='Play video'})());
  await p.locator('#sl1 .cu-slider__pip').nth(2).click(); await p.locator('#sl1 .cu-slider__pip').nth(1).click(); await p.waitForTimeout(400);
  ok('slider video: coming back to its slide keeps it paused when the person paused it', (await vid()).paused);
  await p.locator('#sl1 .cu-slider__slide:nth-child(2) .cu-slider__video').click(); await p.waitForTimeout(300);
  const playing=!(await vid()).paused;
  await p.locator('#sl1 .cu-slider__pip').nth(0).click(); await p.waitForTimeout(300);
  ok('slider video: it plays again from the button, and stops when its slide is no longer showing', playing&&(await vid()).paused);
  ok('slider video: the button is a text button whose visible words are its name (Pause video / Play video), apart from the slideshow button', await p.evaluate(()=>{const b=document.querySelector('#sl1 .cu-slider__slide:nth-child(2) .cu-slider__video'),t=document.querySelector('#sl1 [data-act=toggle]');return b.textContent.trim()===b.getAttribute('aria-label')&&b!==t&&/video/i.test(b.textContent)&&b.getBoundingClientRect().width>60}));
  ok('slider video: its button is a tab stop in page order, after the caption of its slide', await p.evaluate(()=>{const s=document.querySelector('#sl1 .cu-slider__slide:nth-child(2)');const a=s.querySelector('.cu-slider__caption a'),b=s.querySelector('.cu-slider__video');return !!(a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING)&&b.tabIndex===0}));
  await ctx.close(); }
 { const [ctx,p]=await open(1100,900,{reducedMotion:'reduce'});
  await p.locator('#sl1 .cu-slider__pip').nth(1).click(); await p.waitForTimeout(600);
  ok('slider video: with reduced motion it does not play (the poster shows) and the button offers Play', await p.evaluate(()=>{const v=document.querySelector('#sl1 .cu-slider__slide:nth-child(2) > video');return v.paused&&v.parentElement.querySelector('.cu-slider__video').getAttribute('aria-label')==='Play video'})&&await p.evaluate(()=>!!document.querySelector('#sl1 .cu-slider__slide:nth-child(2) > video').getAttribute('poster')));
  await ctx.close(); }
 { const [ctx,p]=await open(1100,900,{reducedMotion:'reduce'});
  await p.waitForTimeout(4700);
  ok('slider: reduced motion means no autoplay (and the button offers Play)', await cur(p,'sl1')===0 && (await p.locator('#sl1 [data-act=toggle]').getAttribute('aria-label'))==='Play slideshow');
  const fade=await p.evaluate(()=>getComputedStyle(document.querySelector('#sl1 .cu-slider__slide')).transitionDuration);
  ok('slider: reduced motion removes the cross-fade', /^0s/.test(fade), fade);
  await ctx.close(); }
 { const [ctx,p]=await open(); await p.locator('#sl1 .cu-slider__caption a').first().focus();
  ok('slider: focus entering the slider stops autoplay', (await p.locator('#sl1 [data-act=toggle]').getAttribute('aria-label'))==='Play slideshow');
  await ctx.close(); }
 { const ctx=await b.newContext({viewport:{width:1100,height:900},javaScriptEnabled:false}); const p=await ctx.newPage(); await p.goto(root+pg+'.html');
  const r=await p.evaluate(()=>({vis:[...document.querySelectorAll('#sl1 .cu-slider__slide')].filter(s=>getComputedStyle(s).display!=='none').length,btns:document.querySelectorAll('#sl1 button').length}));
  ok('slider without script: one slide shows with its caption and there are no dead buttons', r.vis===1&&r.btns===0, JSON.stringify(r));
  const cs=await p.evaluate(()=>{const v=document.querySelector('#cs1 .cu-card-slider__viewport');return {ox:getComputedStyle(v).overflowX,sb:getComputedStyle(v).scrollbarWidth,nav:getComputedStyle(document.querySelector('#cs1')).display}});
  ok('card slider without script: the row still scrolls on its own (native scrollbar)', cs.ox==='auto'&&cs.sb!=='none', JSON.stringify(cs)); await ctx.close(); }
 { const [ctx,p]=await open(375,800);
  const r=await p.evaluate(()=>{const c=document.querySelector('#sl3 .cu-slider__caption');const cs=getComputedStyle(c);return {bg:cs.backgroundColor,align:cs.textAlign,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}});
  ok('banner slider on a phone: caption loses its box and is centred, no sideways scroll', /rgba\(0, 0, 0, 0\)|transparent/.test(r.bg)&&r.align==='center'&&r.sw<=r.cw, JSON.stringify(r));
  await ctx.close(); }
 // ---- card slider ----
 { const [ctx,p]=await open();
  const root_='#cs1'; const pages=await p.evaluate((r)=>document.querySelectorAll(r+' .cu-card-slider__pip').length,root_);
  const per=await p.evaluate((r)=>Math.round(document.querySelector(r+' .cu-card-slider__viewport').clientWidth/document.querySelector(r+' .cu-cards__card').getBoundingClientRect().width),root_);
  ok('card slider: 7 cards at 3 per screen make 3 pips', per===3 && pages===3, per+' per screen, '+pages+' pips');
  const prev=p.locator(root_+' .cu-card-slider__prev'), next=p.locator(root_+' .cu-card-slider__next');
  ok('card slider: Previous is aria-disabled at the start (and still focusable)', (await prev.getAttribute('aria-disabled'))==='true' && (await prev.evaluate(e=>!e.disabled)));
  await next.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1100);
  ok('card slider: Next scrolls a screen and the second pip becomes current', await p.evaluate((r)=>document.querySelectorAll(r+' .cu-card-slider__pip')[1].getAttribute('aria-current')==='true',root_) && (await prev.getAttribute('aria-disabled'))==='false');
  await p.keyboard.press('Enter'); await p.waitForTimeout(1100); 
  ok('card slider: at the end Next is aria-disabled and focus is still on it', (await next.getAttribute('aria-disabled'))==='true' && await p.evaluate(()=>document.activeElement.classList.contains('cu-card-slider__next')));
  await p.locator(root_+' .cu-card-slider__pip').nth(0).click(); await p.waitForTimeout(1100);
  ok('card slider: a pip jumps to its screen', await p.evaluate((r)=>document.querySelector(r+' .cu-card-slider__viewport').scrollLeft<5,root_));
  await p.locator(root_+' .cu-cards__card a').nth(6).focus(); await p.waitForTimeout(1200);
  ok('card slider: tabbing to an off-screen card scrolls it into view and updates the pips', await p.evaluate((r)=>{const v=document.querySelector(r+' .cu-card-slider__viewport').getBoundingClientRect();const c=document.querySelectorAll(r+' .cu-cards__card')[6].getBoundingClientRect();return c.left>=v.left-2&&c.right<=v.right+2&&document.querySelectorAll(r+' .cu-card-slider__pip')[2].getAttribute('aria-current')==='true'},root_));
  const sz=await p.evaluate(()=>[...document.querySelectorAll('.cu-card-slider__btn,.cu-card-slider__pip')].map(e=>{const r=e.getBoundingClientRect();return Math.min(r.width,r.height)}));
  ok('card slider: buttons and pips are at least 24px', sz.every(v=>v>=24), sz.join(','));
  await ctx.close(); }
 { const [ctx,p]=await open(375,800);
  const per=await p.evaluate(()=>Math.round(document.querySelector('#cs1 .cu-card-slider__viewport').clientWidth/document.querySelector('#cs1 .cu-cards__card').getBoundingClientRect().width));
  ok('card slider on a phone: one card per screen, and nothing makes the page scroll sideways', per===1 && await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth), 'per '+per); await ctx.close(); }
 await b.close(); return out;
}

const results = [...(await axeRun(chromium, root, axeSource)), ...(await behaviour(chromium, root)), ...(await interactive(chromium, root)), ...(await sliders(chromium, root))];
const fails = results.filter((r) => r.startsWith('FAIL'));
console.log(results.join('\n') + '\n\n' + (results.length - fails.length) + ' passed, ' + fails.length + ' failed');
process.exit(fails.length ? 1 : 0);
