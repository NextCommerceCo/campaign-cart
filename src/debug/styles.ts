import tsugi from '../../vendor/tsugi/tsugi.css?raw';

export const TSUGI_CSS = tsugi;

export const PANEL_CSS = `:host{all:initial;--purple:oklch(54.1% .281 293.009);--orange:oklch(64.6% .222 41.116)}
:host(.dark){--purple:#c27cf8;--orange:#ff8a3d}
.root{font:13px/1.5 var(--font-sans);color:var(--foreground);-webkit-font-smoothing:antialiased}
@layer base{button{cursor:pointer}.icon{display:inline-flex;flex-shrink:0;width:16px;height:16px}.icon svg{width:100%;height:100%}}
.fab,.menu,.panel,.hint{position:fixed;z-index:2147483646}
.fab{left:20px;bottom:20px;display:flex;align-items:center;gap:6px;height:40px;padding:4px;border-radius:999px;background:#0a0a0a;color:#fff;border:1px solid rgba(255,255,255,.16);box-shadow:0 8px 24px rgba(0,0,0,.3);transition:transform .15s}
.fab:hover{transform:scale(1.04)}
.fab .icon{width:30px;height:30px}
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
.value .icon{width:14px;height:14px}
.danger{color:var(--destructive)}
hr{margin:6px 4px;border:0;border-top:1px solid var(--border)}
.count{font-weight:600}
.red{color:var(--destructive)}.amber{color:var(--warning)}.green{color:var(--success)}.blue{color:var(--info)}.purple{color:var(--purple)}.dim,.time{color:var(--muted-foreground)}
.panel{flex-direction:column;width:min(600px,calc(100vw - 40px));height:min(640px,calc(100vh - 100px))}
.head{display:flex;align-items:center;gap:2px;padding:8px;border-bottom:1px solid var(--border)}
.head .tabs{flex:1;min-width:0;overflow-x:auto;margin-right:6px}
.head [role=tab] .badge{margin-left:2px}
.search{padding:8px;border-bottom:1px solid var(--border)}
.search .input{width:100%}
.body{flex:1;overflow:auto;padding:8px 12px 12px;font:12px/1.6 var(--font-mono)}
.body>h3{margin:14px 0 6px;font:600 11px var(--font-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}
.body>.empty{height:100%;font-family:var(--font-sans)}
.summary{margin:2px 0 8px;font-family:var(--font-sans);color:var(--muted-foreground)}
.link{margin-left:8px;color:var(--info)}
.link.danger{color:var(--destructive)}
.row,summary{padding:3px 6px;border-radius:6px;white-space:pre-wrap;word-break:break-word}
summary{list-style:none;cursor:pointer}
summary::-webkit-details-marker{display:none}
summary::before{content:'▸';display:inline-block;width:14px;color:var(--muted-foreground);transition:transform .12s}
details[open]>summary::before{transform:rotate(90deg)}
summary:hover,.row:hover{background:var(--accent)}
details details,details>.row{margin-left:14px}
.key,.name{color:var(--purple)}.s,.note{color:var(--success)}.n{color:var(--info)}.b{color:var(--warning)}
.time{margin-right:8px}
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

export const CART_CSS = `.chead{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin:2px 0 14px;font:13px var(--font-sans);color:var(--muted-foreground)}
.chead b{font-weight:600;color:var(--foreground)}
.chead>span{margin-right:auto}
.chead .link{margin-left:0}
.cline,.ctotals,.cctl{margin-bottom:14px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-md);font-family:var(--font-sans);font-size:14px;font-variant-numeric:tabular-nums}
.cline{position:relative}
.cbadges{position:absolute;top:-10px;right:12px;display:flex;gap:6px}
.cbadges .badge{background:var(--card)}
.cmain{display:flex;align-items:flex-start;gap:16px;padding:16px}
.cinfo{display:flex;flex:1;flex-direction:column;gap:4px;min-width:0}
.cinfo>b{overflow:hidden;font-weight:500;white-space:nowrap;text-overflow:ellipsis}
.cunit,.cinfo>small{color:var(--muted-foreground)}
.cinfo>small{font-size:12px}
.cunit{display:flex;align-items:center;gap:6px}
.cstep{display:inline-flex;align-items:center}
.cstep>span{min-width:24px;text-align:center;color:var(--foreground)}
.cprice{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.cprice .btn{margin-right:-10px}
.cprice s{color:var(--muted-foreground)}
.cprice b{font-weight:600}
.cprice small{font-size:12px;color:var(--warning)}
.cvars{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:16px;border-top:1px solid var(--border)}
.cvars .select{width:100%}
.crecur{padding:10px 16px;border-top:1px solid var(--border);font-size:13px;color:var(--muted-foreground)}
.trow,.tmore>summary{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-radius:0}
.trow small,.tmore small{display:block;font-size:12px;font-weight:400;color:var(--muted-foreground)}
.trow s,.tmore s{margin-right:6px;color:var(--muted-foreground)}
.tmore>summary::before{content:none}
.tmore>summary:hover{background:none}
.chev{display:inline-block;margin-left:6px;color:var(--muted-foreground);transition:transform .12s}
.tmore[open] .chev{transform:rotate(180deg)}
.tpart{display:flex;justify-content:space-between;align-items:center;padding:2px 0 4px 10px;font-size:13px;color:var(--muted-foreground)}
.tpart .badge{margin-right:6px}
.tlist{padding:10px 16px}
.tgrand{padding:16px;border-top:1px solid var(--border);font-weight:600}
.cctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;padding:16px}
.crow{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.cctl .input{flex:1;min-width:0}
.cctl .select{width:100%}
.cmsg{font-size:12px}
.picker{font-family:var(--font-sans)}
.picker>div{height:min(40rem,calc(100vh - 4rem))}
.picker section{display:flex;flex-direction:column;gap:12px;min-height:0}
.plist{flex:1;min-height:0;margin:0 -8px;overflow-y:auto}
.plist label{display:flex;align-items:center;gap:12px;padding:8px;border-radius:var(--radius-md);cursor:pointer}
.plist label:hover{background:var(--muted)}
.plist .pvariant{padding-left:60px}
.pname{display:flex;flex:1;flex-direction:column;min-width:0}
.pname>span{font-weight:500}
.pvariant .pname>span{font-weight:400}
.pname .badge{margin-left:8px}
.pname small{font-size:12px;color:var(--muted-foreground)}
.pprice{font-variant-numeric:tabular-nums}
.pempty{padding:24px 8px;text-align:center;color:var(--muted-foreground)}`;

export const JOURNEY_CSS = `.jhead{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;margin:2px 0 12px;font:13px var(--font-sans);color:var(--muted-foreground)}
.jhead b{color:var(--foreground)}
.jhead+.journey{margin-bottom:12px;font-family:var(--font-sans)}
.jpage{font-family:var(--font-sans)}
.jpage section{display:flex;flex-direction:column;gap:12px}
.jpage h3{font-size:15px;font-weight:600}
.jmeta{font-size:12px;color:var(--muted-foreground);word-break:break-all}
.jpage .stat-group{border:1px solid var(--border);border-radius:8px}
.jsent{display:flex;flex-wrap:wrap;gap:4px}
.jdone>.icon{color:var(--success)}
.jwarn{color:var(--warning)}`;
