export const PANEL_CSS = `:host{all:initial;color-scheme:dark;--bg:oklch(10% 0 0);--raised:oklch(20.5% 0 0);--fg:oklch(97% 0 0);--muted:oklch(70.8% 0 0);--line:oklch(32% 0 0);--hover:oklch(29% 0 0);--red:oklch(70.4% .191 22.216);--amber:oklch(79% .14 78);--green:oklch(68.97% .1625 156.5);--blue:oklch(72% .14 255);--purple:#c27cf8;--orange:#ff8a3d;--sans:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:light){:host{color-scheme:light;--bg:oklch(98.75% 0 0);--raised:oklch(100% 0 0);--fg:oklch(20.5% 0 0);--muted:oklch(55.6% 0 0);--line:oklch(14.5% 0 0/.1);--hover:oklch(97% 0 0);--red:oklch(57.7% .245 27.325);--amber:oklch(59.7% .144 57.5);--green:oklch(59.6% .145 163.225);--blue:oklch(55% .17 255);--purple:oklch(54.1% .281 293.009);--orange:oklch(64.6% .222 41.116)}}
*{box-sizing:border-box}
[hidden]{display:none!important}
.root{font:13px/1.5 var(--sans);color:var(--fg);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.fab,.menu,.panel,.hint{position:fixed;z-index:2147483646}
.fab{left:20px;bottom:20px;display:flex;align-items:center;gap:6px;height:40px;padding:4px;border-radius:999px;background:#0a0a0a;color:#fff;border:1px solid rgba(255,255,255,.16);box-shadow:0 8px 24px rgba(0,0,0,.3);transition:transform .15s}
.fab:hover{transform:scale(1.04)}
.logo{display:grid;place-items:center;width:30px;height:30px}
.logo svg{width:30px;height:30px}
.issues{padding:0 10px 0 2px;font-size:12px;font-weight:600}
.issues:empty{display:none}
.issues::before{content:'';display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:currentColor}
.fab .red{color:#ff6166}.fab .amber{color:#f2a43a}
.menu,.panel{left:20px;bottom:72px;display:none;background:var(--bg);border:1px solid var(--line);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.28)}
.right .fab,.right .menu,.right .panel{left:auto;right:20px}
[data-view=menu] .menu{display:block}
[data-view=panel] .panel{display:flex}
.picking .menu,.picking .panel{display:none!important}
.pop{animation:pop .16s ease-out;transform-origin:bottom left}
.right .pop{transform-origin:bottom right}
@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.97)}}
@media (prefers-reduced-motion:reduce){.pop{animation:none}.fab{transition:none}}
.menu{width:272px;padding:6px}
.item{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;padding:7px 10px;border-radius:8px;text-align:left}
button.item:hover{background:var(--hover)}
.value{max-width:60%;overflow:hidden;color:var(--muted);font-size:12px;white-space:nowrap;text-overflow:ellipsis}
.value svg{display:block;width:14px;height:14px}
.danger{color:var(--red)}
hr{margin:6px 4px;border:0;border-top:1px solid var(--line)}
.count{font-weight:600}
.red{color:var(--red)}.amber{color:var(--amber)}.green{color:var(--green)}.blue{color:var(--blue)}.purple{color:var(--purple)}.dim,.time{color:var(--muted)}
.panel{flex-direction:column;width:min(600px,calc(100vw - 40px));height:min(640px,calc(100vh - 100px))}
.head{display:flex;align-items:center;gap:4px;padding:8px;border-bottom:1px solid var(--line)}
.tabs{display:flex;flex:1;gap:2px;overflow-x:auto}
.tabs button{padding:5px 10px;border-radius:6px;color:var(--muted);white-space:nowrap}
.tabs button:hover,.tabs [aria-selected=true]{color:var(--fg)}
.tabs [aria-selected=true]{background:var(--hover)}
.icon{display:grid;place-items:center;width:28px;height:28px;border-radius:6px;color:var(--muted)}
.icon:hover{background:var(--hover);color:var(--fg)}
.icon svg{width:16px;height:16px}
.search{padding:8px;border-bottom:1px solid var(--line)}
input[type=search]{width:100%;padding:6px 10px;font:inherit;color:var(--fg);background:var(--raised);border:1px solid var(--line);border-radius:8px;outline:0}
input[type=search]:focus{border-color:var(--blue)}
.body{flex:1;overflow:auto;padding:8px 12px 12px;font:12px/1.6 var(--mono)}
h3{margin:14px 0 6px;font:600 11px var(--sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.summary{margin:2px 0 8px;font-family:var(--sans);color:var(--muted)}
.link{margin-left:8px;color:var(--blue)}
.empty{display:grid;place-items:center;gap:4px;padding:56px 16px;font-family:var(--sans);text-align:center;color:var(--muted)}
.empty b{font-size:15px;color:var(--fg)}
.ok b::before{content:'✓ ';color:var(--green)}
.row,summary{padding:3px 6px;border-radius:6px;white-space:pre-wrap;word-break:break-word}
summary{list-style:none;cursor:pointer}
summary::-webkit-details-marker{display:none}
summary::before{content:'▸';display:inline-block;width:14px;color:var(--muted);transition:transform .12s}
details[open]>summary::before{transform:rotate(90deg)}
summary:hover,.row:hover{background:var(--hover)}
details details,details>.row{margin-left:14px}
.key,.name{color:var(--purple)}.s,.note{color:var(--green)}.n{color:var(--blue)}.b{color:var(--amber)}
.time{margin-right:8px}
.lv{display:inline-block;margin-right:8px;padding:0 6px;border-radius:4px;background:var(--hover);font-size:11px}
.lv{min-width:44px;text-align:center}
.lv.debug{color:var(--muted)}.lv.info{color:var(--blue)}.lv.warn{color:var(--amber)}.lv.error{color:var(--red)}
.card{margin-bottom:6px;padding:8px 10px;background:var(--raised);border:1px solid var(--line);border-radius:8px;cursor:pointer}
.card:hover{border-color:var(--blue)}
.card.bad{border-left:3px solid var(--red)}
.tagname{font-weight:600;color:var(--blue)}
.class-tag{margin-left:6px;padding:0 6px;border-radius:999px;background:var(--hover);color:var(--muted);font-size:11px}
.attr{margin-top:2px;word-break:break-word}
.attr.bad .note{color:var(--red)}
.hint{top:16px;left:50%;display:none;padding:8px 16px;border-radius:999px;background:#0a0a0a;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.3);white-space:nowrap;transform:translateX(-50%)}
.picking .hint{display:block}
.hint .dim{color:#a1a1a1}
.box{position:fixed;z-index:2147483645;display:none;pointer-events:none;border:2px solid #3b82f6;border-radius:3px;background:rgba(59,130,246,.12)}
.box span{position:absolute;left:-2px;top:-24px;padding:2px 6px;border-radius:4px;background:#0a0a0a;color:#fff;white-space:nowrap;font:11px var(--mono)}`;

export const ANALYTICS_CSS = `.wf-sum{display:flex;flex-wrap:wrap;gap:4px 14px;margin:2px 0 8px;font:13px var(--sans);color:var(--muted)}
.wf-sum b{font-weight:600;color:var(--fg)}
.wf-sum .bad b{color:var(--amber)}
.alert{margin:0 0 8px;padding:6px 10px;border:1px solid var(--amber);border-radius:8px;color:var(--amber);font:12px/1.4 var(--sans)}
.wf{display:grid;grid-template-columns:minmax(0,210px) minmax(0,1fr);gap:10px;align-items:start;font-family:var(--sans)}
@media (max-width:520px){.wf{grid-template-columns:minmax(0,1fr)}}
.runs{overflow:hidden;border:1px solid var(--line);border-radius:10px}
.rhead{display:flex;justify-content:space-between;gap:8px;padding:8px 10px 2px;font:600 11px var(--sans);color:var(--muted)}
.rhead+.run,.run+.run{border-top:0}
.run{display:grid;grid-template-columns:16px minmax(0,1fr);gap:6px;width:100%;padding:5px 10px;border-radius:0;text-align:left}
.run:hover{background:var(--hover)}
.run.on{background:var(--hover);box-shadow:inset 3px 0 var(--blue)}
.run code{font:600 12px var(--mono);color:var(--orange)}
.run small{display:block;overflow:hidden;font:11px var(--sans);color:var(--muted);white-space:nowrap;text-overflow:ellipsis}
.run.skip code,.run.skip .ricon{color:var(--muted);font-weight:400}
.ricon{text-align:center}.run.ok .ricon{color:var(--green)}.run.warn .ricon{color:var(--amber)}
.steps{position:sticky;top:0;padding:12px 12px 2px;background:var(--raised);border:1px solid var(--line);border-radius:10px}
.step{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;padding-bottom:12px}
.step:not(:last-child)::after{content:'';position:absolute;left:10px;top:24px;bottom:0;border-left:1px solid var(--line)}
.dot{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--line);border-radius:50%;background:var(--bg);font-size:12px}
.step.ok .dot{color:var(--green);border-color:var(--green)}
.step.warn .dot{color:var(--amber);border-color:var(--amber)}
.step.off .dot{color:var(--muted);border-style:dashed}
.step.skip .dot,.step.skip .stitle,.step.skip .sdetail{color:var(--muted)}
.stitle{font:600 13px var(--sans)}
.stitle code{margin-left:8px;font:400 12px var(--mono);color:var(--muted)}
.sdetail{font:12px/1.5 var(--sans)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.chip{padding:0 8px;border:1px solid var(--line);border-radius:999px;font:12px var(--sans)}
.chip.ok{color:var(--green);border-color:var(--green)}
.chip.warn{color:var(--amber);border-color:var(--amber)}
.chip.off{color:var(--muted);border-style:dashed}
.sdata>summary{padding:2px 0;font:12px var(--sans);color:var(--blue)}
.sdata[open]{font:12px/1.6 var(--mono)}
.facts{display:flex;flex-wrap:wrap;gap:2px 14px}
table{width:100%;margin:6px 0;border-collapse:collapse}
th,td{padding:2px 8px 2px 0;text-align:left;border-bottom:1px solid var(--line)}
th{font:600 11px var(--sans);color:var(--muted)}
.more{margin-top:12px}
.more>summary{font:12px var(--sans);color:var(--muted)}
.flow{margin:3px 0 3px 14px;font:12px var(--sans)}
.flow code{font:12px var(--mono)}`;

export const CART_CSS = `.chead{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin:2px 0 10px;font:13px var(--sans);color:var(--muted)}
.chead b{font-weight:600;color:var(--fg)}
.chead>span{margin-right:auto}
.chead .link{margin-left:0}
.ccard{margin-bottom:10px;padding:12px;background:var(--raised);border-radius:8px;box-shadow:0 0 0 1px var(--line),0 1px 2px #0000000d;font:14px/1.45 var(--sans);font-variant-numeric:tabular-nums}
.cbadges{display:flex;justify-content:flex-end;gap:6px;margin-bottom:6px}
.cbadge{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;font:500 12px var(--sans);white-space:nowrap}
.cbadge.offer{color:var(--green);background:color-mix(in oklab,var(--green) 10%,transparent)}
.cbadge.code{color:var(--blue);background:color-mix(in oklab,var(--blue) 10%,transparent)}
.cmain{display:grid;grid-template-columns:44px minmax(0,1fr) auto 14px;gap:12px;align-items:center}
.cthumb{position:relative;width:44px;height:44px}
.cthumb img,.cnoimg{display:block;width:44px;height:44px;border-radius:6px;background:var(--hover);box-shadow:0 0 0 1px var(--line);object-fit:contain}
.cbubble{position:absolute;top:-7px;right:-7px;display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--hover);box-shadow:0 0 0 2px var(--raised);font:600 11px var(--sans)}
.cname{overflow:hidden;font-weight:500;white-space:nowrap;text-overflow:ellipsis}
.cunit{display:flex;align-items:center;gap:4px;color:var(--muted)}
.cstep{display:inline-flex;align-items:center;gap:2px}
.cstep button{width:20px;height:20px;border-radius:6px;box-shadow:0 0 0 1px var(--line);color:var(--fg)}
.cstep button:hover{background:var(--hover)}
.cstep span{min-width:18px;color:var(--fg);text-align:center}
.csource{font-size:11px;color:var(--muted)}
.cprice{display:flex;flex-direction:column;align-items:flex-end}
.cprice s{font-size:13px;color:var(--muted)}
.cprice b{font-weight:600}
.cprice small{font-size:11px;color:var(--amber)}
.cremove{align-self:start;font-size:12px;color:var(--muted)}
.cremove:hover{color:var(--red)}
.cvars{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.cvar{display:flex;flex-direction:column;gap:6px}
.cfield{display:flex;align-items:center;height:36px;padding:0 10px;border-radius:6px;box-shadow:0 0 0 1px var(--line),0 1px 2px #0000000d}
.crecur{margin-top:8px;font-size:12px;color:var(--muted)}
.ctotals{padding:4px 12px}
.trow{display:flex;justify-content:space-between;gap:12px;padding:8px 0}
.trow small,.tmore small{display:block;font-size:12px;font-weight:400;color:var(--muted)}
.trow s,.tmore s{margin-right:6px;color:var(--muted)}
.tmore>summary{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-radius:0}
.tmore>summary::before{content:none}
.tmore>summary:hover{background:none}
.chev{display:inline-block;margin-left:6px;color:var(--muted);transition:transform .12s}
.tmore[open] .chev{transform:rotate(180deg)}
.tpart{display:flex;justify-content:space-between;padding:2px 0 4px 10px;font-size:13px;color:var(--muted)}
.ctag{margin-right:6px;padding:0 4px;border-radius:4px;background:var(--hover);font:500 10px var(--sans);text-transform:uppercase}
.tgrand{margin-top:4px;padding-top:12px;border-top:1px solid var(--line);font-weight:600}
.cctl{display:flex;flex-direction:column;gap:8px;font-size:13px}
.crow{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.clabel{min-width:64px;font-size:12px;color:var(--muted)}
.cin,.csel{height:32px;padding:0 10px;font:inherit;color:var(--fg);background:var(--raised);border:1px solid var(--line);border-radius:6px;box-shadow:0 1px 2px #0000000d;outline:0}
.cin:focus,.csel:focus{border-color:var(--blue)}
.cin{width:140px}
.cqty{width:64px}
.csel{max-width:280px}
.cbtn{height:32px;padding:0 12px;font-weight:500;background:var(--raised);border:1px solid var(--line);border-radius:6px;box-shadow:0 1px 2px #0000000d}
.cbtn:hover{background:var(--hover)}
.cmsg{margin-left:70px;font-size:12px}
.coupon{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:6px;color:var(--green);background:color-mix(in oklab,var(--green) 10%,transparent);font:500 12px var(--sans)}
.coupon button{margin-left:4px;color:inherit}`;
