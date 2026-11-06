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
@media (prefers-reduced-motion:reduce){.pop{animation:none}.fab,.mtrack,.mtrack::after{transition:none}}
.menu{width:304px;overflow:hidden}
.mhead{display:flex;align-items:flex-start;gap:8px;padding:12px 8px 10px 14px;border-bottom:1px solid var(--border)}
.mhead>div{flex:1;min-width:0}
.mhead b{display:-webkit-box;overflow:hidden;font-weight:600;line-height:1.35;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.mhead small{display:block;margin-top:2px;font-size:12px;color:var(--muted-foreground)}
.mlist{padding:6px}
.mlist+.mlist,.minfo+.mlist{border-top:1px solid var(--border)}
.item{display:flex;align-items:center;gap:12px;width:100%;padding:7px 8px;border-radius:8px;text-align:left}
.item:hover,.mswitch:hover{background:var(--accent)}
.label{display:inline-flex;flex-shrink:0;align-items:center;gap:10px;white-space:nowrap}
.label>.icon{width:15px;height:15px;color:var(--muted-foreground)}
.value{flex:1;min-width:0;overflow:hidden;color:var(--muted-foreground);font-size:12px;text-align:right;white-space:nowrap;text-overflow:ellipsis}
.go{display:inline-flex;margin-left:-6px;color:var(--muted-foreground);transform:rotate(-90deg)}
.go>.icon{width:14px;height:14px}
.minfo{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 12px;padding:8px 14px;border-top:1px solid var(--border);font-size:12px}
.minfo dt{color:var(--muted-foreground)}
.minfo dd{overflow:hidden;font:11px/1.6 var(--font-mono);text-align:right;white-space:nowrap;text-overflow:ellipsis}
.mswitch{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:12px;width:100%;padding:7px 8px;border-radius:8px;text-align:left}
.mswitch>small{grid-row:2;font-size:12px;color:var(--muted-foreground)}
.mtrack{grid-row:1/3;grid-column:2;position:relative;width:32px;height:18px;border-radius:999px;background:color-mix(in oklab,var(--muted-foreground) 40%,transparent);transition:background .15s}
.mtrack::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
[aria-checked=true]>.mtrack{background:var(--primary)}
[aria-checked=true]>.mtrack::after{transform:translateX(14px)}
.mfoot{padding:10px 12px 12px;border-top:1px solid var(--border)}
.mfoot>div{display:flex;gap:6px}
.mfoot .btn{flex:1}
.mfoot>p{margin-top:8px;font-size:12px;color:var(--muted-foreground)}
.mfoot>p.red{color:var(--destructive)}
.danger{color:var(--destructive)}
hr{margin:6px 4px;border:0;border-top:1px solid var(--border)}
.reach{display:inline-flex;gap:4px;margin-left:8px;vertical-align:-2px}.reach .icon,.dest .icon{width:14px;height:14px}
.dest{display:inline-flex;align-items:center;gap:6px}
.red{color:var(--destructive)}.amber{color:var(--warning)}.green{color:var(--success)}.dim,.time{color:var(--muted-foreground)}
.panel{flex-direction:column;width:min(600px,calc(100vw - 40px));height:min(640px,calc(100vh - 100px));container:panel/inline-size}
.head{display:flex;align-items:center;gap:2px;padding:8px;border-bottom:1px solid var(--border)}
.head .tabs{flex:1;min-width:0;margin-right:6px}
.tabpick{display:none;flex:1;min-width:0;margin-right:6px}
@container panel (max-width:560px){.head .tabs{display:none}.tabpick{display:block}}
.head [role=tab] .badge{margin-left:2px}
.search{padding:8px;border-bottom:1px solid var(--border)}
.search .input{width:100%}
.body{flex:1;overflow:auto;padding:8px 12px 12px;font:12px/1.6 var(--font-mono)}
.body>h3{margin:14px 0 6px;font:600 11px var(--font-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}
.body>.empty{height:100%;font-family:var(--font-sans)}
.summary{margin:2px 0 8px;font-family:var(--font-sans);color:var(--muted-foreground)}
.link{margin-left:8px;color:var(--info)}
.link.danger{color:var(--destructive)}
.root:not(.dev) .devonly{display:none}
.vhead{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:2px 0 14px;font:13px var(--font-sans);color:var(--muted-foreground)}
.vhead b{font-weight:600;color:var(--foreground)}
.vhead>span{margin-right:auto}
.vhead .link{margin-left:0}
@container panel (max-width:560px){.vhead>span{flex-basis:100%}.vhead .btn:first-of-type{margin-left:auto}}
.bhead{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:6px 12px;padding:14px 16px;border-bottom:1px solid var(--border)}
.bhead h4{font-size:15px;font-weight:600}
.bhead p{font-size:13px;color:var(--muted-foreground)}
.bact{display:flex;align-items:center;gap:12px}
.bact .link{margin:0}
.block{overflow:hidden;margin-bottom:14px;background:var(--card);border:1px solid var(--border);border-radius:var(--radius-md);font-family:var(--font-sans);font-size:14px;font-variant-numeric:tabular-nums}
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

export const CART_CSS = `.ctable{font-size:14px}
.cfield{display:flex;flex-direction:column;gap:8px;width:100%}
.cfield>*{width:100%}
.cfield>label{width:fit-content;font-size:14px;font-weight:500;line-height:1}
.cth,.cline{display:grid;grid-template-columns:minmax(0,1fr) 104px 112px 28px;grid-template-areas:'pkg qty price x';align-items:center;gap:8px 12px;padding:10px 16px}
.cth{padding-block:8px;background:var(--muted);border-bottom:1px solid var(--border);font-size:13px;color:var(--muted-foreground)}
.cth>:nth-child(2){text-align:center}
.cth>:nth-child(3){text-align:right}
.cline+.cline{border-top:1px solid var(--border)}
.cpkg{grid-area:pkg;display:flex;align-items:center;gap:12px;min-width:0}
.cinfo{display:flex;flex-direction:column;gap:2px;min-width:0}
.cname{display:flex;align-items:center;gap:4px;max-width:100%;font-weight:500;text-align:left}
.cname>span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.cname:hover>span{text-decoration:underline}
.cname>.icon{width:14px;height:14px;color:var(--muted-foreground);transition:transform .15s}
.open .cname>.icon{transform:rotate(180deg)}
.cinfo>small{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;font-size:12px;color:var(--muted-foreground)}
.qty{grid-area:qty;justify-self:center;display:inline-flex;align-items:center;height:32px;border:1px solid var(--border);border-radius:var(--radius-md)}
.qty>button{width:30px;height:100%;color:var(--muted-foreground)}
.qty>button:hover{background:var(--accent);color:var(--foreground)}
.qty>span{min-width:32px;height:100%;padding-top:5px;border-inline:1px solid var(--border);text-align:center}
.cprice{grid-area:price;display:flex;flex-direction:column;align-items:flex-end;text-align:right;white-space:nowrap}
.cprice s{margin-right:6px;font-size:12px;color:var(--muted-foreground)}
.cprice b{font-weight:500}
.cprice small{font-size:12px;color:var(--muted-foreground)}
.cline>.btn{grid-area:x}
.cmore{grid-column:1/-1;display:flex;flex-direction:column;gap:12px;padding:4px 0 6px 52px}
.cvars{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.cvars .select{width:100%}
.cmore dl,.ctot{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 16px;font-size:13px}
.cmore dt{color:var(--muted-foreground)}
.cmore dd,.ctot dd{text-align:right}
.cadd{display:flex;align-items:center;gap:8px;padding:8px 16px 12px;border-top:1px solid var(--border)}
.cadd .link{display:inline-flex;align-items:center;gap:6px;margin:0;font-weight:500}
.cadd small{font-size:12px;color:var(--muted-foreground)}
.cempty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 16px;text-align:center}
.cempty>.icon{width:40px;height:40px;padding:10px;border-radius:var(--radius-lg);background:var(--muted);color:var(--muted-foreground)}
.cempty small{color:var(--muted-foreground)}
.cempty .btn{margin-top:6px}
.csplit{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:20px;padding:16px;border-top:1px solid var(--border)}
.cform{display:flex;flex-direction:column;gap:14px}
.cvoucher{display:flex;gap:6px}
.cvoucher .input{flex:1;min-width:0;text-transform:uppercase}
.ccodes{display:flex;flex-wrap:wrap;gap:4px}
.cform .select{width:100%}
.cmsg{font-size:12px}
.ctot{align-content:start;gap:8px 16px;font-size:14px}
.ctot dt{color:var(--muted-foreground)}
.ctot .small{font-size:12px}
.ctot .badge{margin-right:6px}
.cfoot{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px;padding:14px 16px;border-top:1px solid var(--border)}
.cfoot>span{font-weight:500}
.cfoot>b{font-size:24px;font-weight:600;letter-spacing:-.01em}
.cmath{flex-basis:100%;text-align:right;font:11px var(--font-mono);color:var(--muted-foreground)}
@container panel (max-width:560px){.cth{display:none}.cline{grid-template-columns:minmax(0,1fr) auto 28px;grid-template-areas:'pkg pkg x' 'qty price price'}.qty{justify-self:start;margin-left:52px}.cmore{padding-left:0}.csplit{grid-template-columns:minmax(0,1fr)}}
.picker{font-family:var(--font-sans)}
.picker>div{height:min(45rem,calc(100vh - 2rem));padding:0;gap:0}
.picker>div>header{padding:16px;border-bottom:1px solid var(--border)}
.picker section{display:flex;flex-direction:column;min-height:0}
.ptools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--border)}
.ptools>.input{flex:1;min-width:200px}
.plist{flex:1;min-height:0;padding:6px;overflow-y:auto}
.prow{display:grid;grid-template-columns:36px minmax(0,1fr) auto 112px;grid-template-areas:'thumb info price qty';align-items:center;gap:12px;padding:8px;border-radius:var(--radius-md)}
.prow.on{background:color-mix(in oklab,var(--primary) 6%,transparent)}
.prow.active{background:var(--accent)}
.pthumb{grid-area:thumb;flex-shrink:0;display:grid;place-items:center;width:36px;height:36px;overflow:hidden;background:var(--muted);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--muted-foreground)}
.pthumb img{width:100%;height:100%;object-fit:cover;background:var(--color-white)}
.pinfo{grid-area:info;display:flex;flex-direction:column;min-width:0}
.pinfo>span{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px}
.pinfo b{font-weight:500}
.pinfo small{overflow:hidden;font-size:12px;white-space:nowrap;text-overflow:ellipsis;color:var(--muted-foreground)}
.pprice{grid-area:price;display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums}
.pprice s{font-size:12px;color:var(--muted-foreground)}
.prow>.qty,.prow>.btn{grid-area:qty;justify-self:end}
.pempty{padding:24px 8px;text-align:center;color:var(--muted-foreground)}
.picker>div>footer{flex-direction:row;flex-wrap:wrap;justify-content:flex-end;align-items:center;padding:10px 12px;border-top:1px solid var(--border)}
.pfoot{display:flex;flex:1;flex-wrap:wrap;align-items:center;gap:4px 12px;font-size:13px;color:var(--muted-foreground)}
.pfoot b{font-weight:500;color:var(--foreground)}
.phint{display:inline-flex;align-items:center;gap:4px;font-size:12px}
@media (max-width:560px){.prow{grid-template-columns:36px minmax(0,1fr) auto;grid-template-areas:'thumb info qty' 'thumb price qty';gap:2px 12px}.pprice{flex-direction:row;align-items:baseline;gap:6px}.pfoot{flex-basis:100%}.phint{display:none}}`;

export const JOURNEY_CSS = `.jhead{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px;margin:2px 0 12px;font:13px var(--font-sans);color:var(--muted-foreground)}
.jhead b{color:var(--foreground)}
.jhead+.journey{margin-bottom:12px;font-family:var(--font-sans)}
.jpage{font-family:var(--font-sans)}
.jpage section{display:flex;flex-direction:column;gap:12px}
.jpage h3{font-size:15px;font-weight:600}
.jmeta{font-size:12px;color:var(--muted-foreground);overflow-wrap:anywhere}
.jpage .stat-group{border:1px solid var(--border);border-radius:8px}
.jsent{display:flex;flex-wrap:wrap;gap:4px}
.jdone>.icon{color:var(--success)}
.jwarn{color:var(--warning)}`;

export const CHECKOUT_CSS = `.ksteps>.kstep+.kstep{border-top:1px solid var(--border)}
.kstep{display:grid;grid-template-columns:20px minmax(0,1fr);gap:2px 10px;padding:10px 16px}
.kstep>.icon{grid-row:span 2;width:20px;height:20px;margin-top:1px}
.kstep>b{font-weight:500}
.kstep>small{font-size:13px;color:var(--muted-foreground)}
.kstep>small>span{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px}
.kstep.done>.icon{color:var(--success)}
.kstep.bad>.icon,.kstep.bad>small{color:var(--destructive)}
.kstep.warn>.icon,.kstep.warn>small{color:var(--warning)}
.kstep.todo>.icon{color:var(--muted-foreground)}
.kicons{display:inline-flex;gap:3px}
.kicons .payment-icon{height:18px}
.krows{display:grid;grid-template-columns:minmax(116px,30%) minmax(0,1fr)}
.krows>*{padding:8px 16px;border-bottom:1px solid var(--border)}
.krows>dd{overflow-wrap:anywhere}
.krows>dt{color:var(--muted-foreground)}
.krows dd .badge{margin-left:8px}
.kaddrs{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;padding:12px 16px 16px}
.kaddr{display:flex;flex-direction:column;gap:6px;min-width:0;font-size:14px;line-height:1.5;overflow-wrap:anywhere}
.kaddr address{font-style:normal}
.ksub{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-foreground)}
.kerrs{display:flex;flex-wrap:wrap;gap:4px}
.knote{margin:-4px 2px 14px;font:13px var(--font-sans);color:var(--muted-foreground)}`;
