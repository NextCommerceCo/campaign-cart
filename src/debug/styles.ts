import tsugi from '../../vendor/tsugi/tsugi.css?raw';

export const TSUGI_CSS = tsugi;

export const PANEL_CSS = `:host{all:initial;--purple:oklch(54.1% .281 293.009);--orange:oklch(64.6% .222 41.116)}
:host(.dark){--purple:#c27cf8;--orange:#ff8a3d}
*{box-sizing:border-box}
[hidden]{display:none!important}
.root{font:13px/1.5 var(--font-sans);color:var(--foreground);-webkit-font-smoothing:antialiased}
@layer base{button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}input,select{font:inherit;color:inherit}}
.fab,.menu,.panel,.hint{position:fixed;z-index:2147483646}
.fab{left:20px;bottom:20px;display:flex;align-items:center;gap:6px;height:40px;padding:4px;border-radius:999px;background:#0a0a0a;color:#fff;border:1px solid rgba(255,255,255,.16);box-shadow:0 8px 24px rgba(0,0,0,.3);transition:transform .15s}
.fab:hover{transform:scale(1.04)}
.logo{display:grid;place-items:center;width:30px;height:30px}
.logo svg{width:30px;height:30px}
.issues{padding:0 10px 0 2px;font-size:12px;font-weight:600}
.issues:empty{display:none}
.issues::before{content:'';display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:currentColor}
.fab .red{color:#ff6166}.fab .amber{color:#f2a43a}
.menu,.panel{left:20px;bottom:72px;display:none;background:var(--background);border:1px solid var(--border);border-radius:12px;box-shadow:0 16px 48px rgba(0,0,0,.28)}
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
button.item:hover{background:var(--accent)}
.value{max-width:60%;overflow:hidden;color:var(--muted-foreground);font-size:12px;white-space:nowrap;text-overflow:ellipsis}
.value svg{display:block;width:14px;height:14px}
.danger{color:var(--destructive)}
hr{margin:6px 4px;border:0;border-top:1px solid var(--border)}
.count{font-weight:600}
.red{color:var(--destructive)}.amber{color:var(--warning)}.green{color:var(--success)}.blue{color:var(--info)}.purple{color:var(--purple)}.dim,.time{color:var(--muted-foreground)}
.panel{flex-direction:column;width:min(600px,calc(100vw - 40px));height:min(640px,calc(100vh - 100px))}
.head{display:flex;align-items:center;gap:4px;padding:8px;border-bottom:1px solid var(--border)}
.tabs{display:flex;flex:1;gap:2px;overflow-x:auto}
.tabs button{padding:5px 10px;border-radius:6px;color:var(--muted-foreground);white-space:nowrap}
.tabs button:hover,.tabs [aria-selected=true]{color:var(--foreground)}
.tabs [aria-selected=true]{background:var(--accent)}
.icon{display:grid;place-items:center;width:28px;height:28px;border-radius:6px;color:var(--muted-foreground)}
.icon:hover{background:var(--accent);color:var(--foreground)}
.icon svg{width:16px;height:16px}
.search{padding:8px;border-bottom:1px solid var(--border)}
input[type=search]{width:100%;padding:6px 10px;font:inherit;color:var(--foreground);background:var(--card);border:1px solid var(--border);border-radius:8px;outline:0}
input[type=search]:focus{border-color:var(--info)}
.body{flex:1;overflow:auto;padding:8px 12px 12px;font:12px/1.6 var(--font-mono)}
h3{margin:14px 0 6px;font:600 11px var(--font-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}
.summary{margin:2px 0 8px;font-family:var(--font-sans);color:var(--muted-foreground)}
.link{margin-left:8px;color:var(--info)}
.empty{display:grid;place-items:center;gap:4px;padding:56px 16px;font-family:var(--font-sans);text-align:center;color:var(--muted-foreground)}
.empty b{font-size:15px;color:var(--foreground)}
.ok b::before{content:'✓ ';color:var(--success)}
.row,summary{padding:3px 6px;border-radius:6px;white-space:pre-wrap;word-break:break-word}
summary{list-style:none;cursor:pointer}
summary::-webkit-details-marker{display:none}
summary::before{content:'▸';display:inline-block;width:14px;color:var(--muted-foreground);transition:transform .12s}
details[open]>summary::before{transform:rotate(90deg)}
summary:hover,.row:hover{background:var(--accent)}
details details,details>.row{margin-left:14px}
.key,.name{color:var(--purple)}.s,.note{color:var(--success)}.n{color:var(--info)}.b{color:var(--warning)}
.time{margin-right:8px}
.lv{display:inline-block;margin-right:8px;padding:0 6px;border-radius:4px;background:var(--accent);font-size:11px}
.lv{min-width:44px;text-align:center}
.lv.debug{color:var(--muted-foreground)}.lv.info{color:var(--info)}.lv.warn{color:var(--warning)}.lv.error{color:var(--destructive)}
.ecard{margin-bottom:6px;padding:8px 10px;background:var(--card);border:1px solid var(--border);border-radius:8px;cursor:pointer}
.ecard:hover{border-color:var(--info)}
.ecard.bad{border-left:3px solid var(--destructive)}
.tagname{font-weight:600;color:var(--info)}
.class-tag{margin-left:6px;padding:0 6px;border-radius:999px;background:var(--accent);color:var(--muted-foreground);font-size:11px}
.attr{margin-top:2px;word-break:break-word}
.attr.bad .note{color:var(--destructive)}
.hint{top:16px;left:50%;display:none;padding:8px 16px;border-radius:999px;background:#0a0a0a;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.3);white-space:nowrap;transform:translateX(-50%)}
.picking .hint{display:block}
.hint .dim{color:#a1a1a1}
.box{position:fixed;z-index:2147483645;display:none;pointer-events:none;border:2px solid #3b82f6;border-radius:3px;background:rgba(59,130,246,.12)}
.box span{position:absolute;left:-2px;top:-24px;padding:2px 6px;border-radius:4px;background:#0a0a0a;color:#fff;white-space:nowrap;font:11px var(--font-mono)}`;

export const ANALYTICS_CSS = `.wf-sum{display:flex;flex-wrap:wrap;gap:4px 14px;margin:2px 0 8px;font:13px var(--font-sans);color:var(--muted-foreground)}
.wf-sum b{font-weight:600;color:var(--foreground)}
.wf-sum .bad b{color:var(--warning)}
.alert{margin:0 0 8px;padding:6px 10px;border:1px solid var(--warning);border-radius:8px;color:var(--warning);font:12px/1.4 var(--font-sans)}
.wf{display:grid;grid-template-columns:minmax(0,210px) minmax(0,1fr);gap:10px;align-items:start;font-family:var(--font-sans)}
@media (max-width:520px){.wf{grid-template-columns:minmax(0,1fr)}}
.runs{overflow:hidden;border:1px solid var(--border);border-radius:10px}
.rhead{display:flex;justify-content:space-between;gap:8px;padding:8px 10px 2px;font:600 11px var(--font-sans);color:var(--muted-foreground)}
.rhead+.run,.run+.run{border-top:0}
.run{display:grid;grid-template-columns:16px minmax(0,1fr);gap:6px;width:100%;padding:5px 10px;border-radius:0;text-align:left}
.run:hover{background:var(--accent)}
.run.on{background:var(--accent);box-shadow:inset 3px 0 var(--info)}
.run code{font:600 12px var(--font-mono);color:var(--orange)}
.run small{display:block;overflow:hidden;font:11px var(--font-sans);color:var(--muted-foreground);white-space:nowrap;text-overflow:ellipsis}
.run.skip code,.run.skip .ricon{color:var(--muted-foreground);font-weight:400}
.ricon{text-align:center}.run.ok .ricon{color:var(--success)}.run.warn .ricon{color:var(--warning)}
.steps{position:sticky;top:0;padding:12px 12px 2px;background:var(--card);border:1px solid var(--border);border-radius:10px}
.step{position:relative;display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;padding-bottom:12px}
.step:not(:last-child)::after{content:'';position:absolute;left:10px;top:24px;bottom:0;border-left:1px solid var(--border)}
.dot{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--border);border-radius:50%;background:var(--background);font-size:12px}
.step.ok .dot{color:var(--success);border-color:var(--success)}
.step.warn .dot{color:var(--warning);border-color:var(--warning)}
.step.off .dot{color:var(--muted-foreground);border-style:dashed}
.step.skip .dot,.step.skip .stitle,.step.skip .sdetail{color:var(--muted-foreground)}
.stitle{font:600 13px var(--font-sans)}
.stitle code{margin-left:8px;font:400 12px var(--font-mono);color:var(--muted-foreground)}
.sdetail{font:12px/1.5 var(--font-sans)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.chip{padding:0 8px;border:1px solid var(--border);border-radius:999px;font:12px var(--font-sans)}
.chip.ok{color:var(--success);border-color:var(--success)}
.chip.warn{color:var(--warning);border-color:var(--warning)}
.chip.off{color:var(--muted-foreground);border-style:dashed}
.sdata>summary{padding:2px 0;font:12px var(--font-sans);color:var(--info)}
.sdata[open]{font:12px/1.6 var(--font-mono)}
.facts{display:flex;flex-wrap:wrap;gap:2px 14px}
table{width:100%;margin:6px 0;border-collapse:collapse}
th,td{padding:2px 8px 2px 0;text-align:left;border-bottom:1px solid var(--border)}
th{font:600 11px var(--font-sans);color:var(--muted-foreground)}
.more{margin-top:12px}
.more>summary{font:12px var(--font-sans);color:var(--muted-foreground)}
.flow{margin:3px 0 3px 14px;font:12px var(--font-sans)}
.flow code{font:12px var(--font-mono)}`;

export const CART_CSS = `.chead{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin:2px 0 10px;font:13px var(--font-sans);color:var(--muted-foreground)}
.chead b{font-weight:600;color:var(--foreground)}
.chead>span{margin-right:auto}
.chead .link{margin-left:0}
.cline,.ctotals,.cctl{margin-bottom:10px;font-family:var(--font-sans);font-variant-numeric:tabular-nums}
.cbadges{display:flex;justify-content:flex-end;gap:6px;margin-bottom:6px}
.cmain{display:grid;grid-template-columns:44px minmax(0,1fr) auto auto;gap:12px;align-items:center}
.cthumb{position:relative;width:44px;height:44px}
.cthumb img,.cnoimg{display:block;width:44px;height:44px;border-radius:var(--radius-md);background:var(--muted-foreground);box-shadow:0 0 0 1px var(--border);object-fit:contain}
.cbubble{position:absolute;top:-7px;right:-7px;display:grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--muted-foreground);box-shadow:0 0 0 2px var(--card);font-size:11px;font-weight:600}
.cname{overflow:hidden;font-weight:500;white-space:nowrap;text-overflow:ellipsis}
.cunit{display:flex;align-items:center;gap:4px;color:var(--muted-foreground)}
.cunit span{min-width:18px;color:var(--foreground);text-align:center}
.csource{font-size:11px;color:var(--muted-foreground)}
.cprice{display:flex;flex-direction:column;align-items:flex-end}
.cprice s{font-size:13px;color:var(--muted-foreground)}
.cprice b{font-weight:600}
.cprice small{font-size:11px;color:var(--warning)}
.cvars{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.cvar{display:flex;flex-direction:column;gap:6px}
.crecur{margin-top:8px;font-size:12px;color:var(--muted-foreground)}
.trow,.tmore>summary{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-radius:0}
.trow small,.tmore small{display:block;font-size:12px;font-weight:400;color:var(--muted-foreground)}
.trow s,.tmore s{margin-right:6px;color:var(--muted-foreground)}
.tmore>summary::before{content:none}
.tmore>summary:hover{background:none}
.chev{display:inline-block;margin-left:6px;color:var(--muted-foreground);transition:transform .12s}
.tmore[open] .chev{transform:rotate(180deg)}
.tpart{display:flex;justify-content:space-between;align-items:center;padding:2px 0 4px 10px;font-size:13px;color:var(--muted-foreground)}
.tpart .badge{margin-right:6px}
.tgrand{margin-top:4px;padding-top:10px;border-top:1px solid var(--border);font-weight:600}
.crow{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.crow+.crow,.cmsg+.crow{margin-top:8px}
.clabel{min-width:64px;font-size:12px;color:var(--muted-foreground)}
.cmsg{margin:6px 0 0 70px;font-size:12px}
.cctl .input{width:140px}
.cctl .input[type=number]{width:64px}
.cctl select{max-width:260px}`;
