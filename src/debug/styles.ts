import tsugi from '../../vendor/tsugi/tsugi.css?raw';

export const TSUGI_CSS = tsugi;

export const PANEL_CSS = `:host{all:initial;color-scheme:light;--purple:oklch(54.1% .281 293.009);--orange:oklch(64.6% .222 41.116)}
:host(.dark){color-scheme:dark;--purple:#c27cf8;--orange:#ff8a3d}
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
.menu{width:304px;max-height:calc(100vh - 92px);max-height:calc(100dvh - 92px);overflow:hidden auto;overscroll-behavior:contain;scrollbar-width:thin}
.mhead{display:flex;align-items:flex-start;gap:8px;padding:12px 8px 10px 14px;border-bottom:1px solid var(--border)}
.mhead>div{flex:1;min-width:0}.mhead b{display:-webkit-box;overflow:hidden;font-weight:600;line-height:1.35;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.mhead small{display:block;margin-top:2px;font-size:12px;color:var(--muted-foreground)}
.mtop{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--border)}
.mtop b{font-weight:600}.mswitch{position:relative;display:block;width:28px;height:16px;border-radius:8px;background:var(--input)}.mswitch::after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--background);transition:transform .15s}[aria-checked=true] .mswitch{background:var(--primary)}[aria-checked=true] .mswitch::after{transform:translateX(12px)}.mlist{display:flex;flex-direction:column;padding:4px}
.mval{min-width:0;margin-inline-start:auto;overflow:hidden;text-overflow:ellipsis;padding-inline-start:12px;font-size:12px;color:var(--muted-foreground)}
.mtry{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 0;padding:8px 14px;border-bottom:1px solid var(--border);background:color-mix(in oklab,var(--warning) 12%,transparent);font-size:12px}
.mtry .link{margin-left:10px}
.mdot{display:inline-block;width:7px;height:7px;margin-left:6px;border-radius:50%;background:var(--warning);vertical-align:1px}
.geo{position:absolute;top:52px;right:8px;z-index:2;width:min(360px,calc(100% - 16px));max-height:calc(100% - 64px);overflow:hidden auto;padding:12px;background:var(--background);border:1px solid var(--border);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.22);transform-origin:top right}


.mnote{padding:8px 12px 10px;border-top:1px solid var(--border);font-size:12px;color:var(--muted-foreground)}
.mnote.red{color:var(--destructive)}
.danger{color:var(--destructive)}
hr{margin:6px 4px;border:0;border-top:1px solid var(--border)}
.red{color:var(--destructive)}.amber{color:var(--warning)}.green{color:var(--success)}.dim,.time{color:var(--muted-foreground)}
.panel{flex-direction:column;width:min(640px,calc(100vw - 40px));height:min(640px,calc(100vh - 140px));container:panel/inline-size}
.head{display:flex;align-items:center;gap:2px;padding:8px;border-bottom:1px solid var(--border)}
.dmenu{position:absolute;top:44px;display:flex;flex-direction:column;max-width:280px;z-index:3;min-width:220px;border:1px solid var(--border);border-radius:10px;background:var(--background);box-shadow:0 12px 32px rgba(0,0,0,.24);transform-origin:top left}.dmenu[hidden]{display:none}.dmenu [aria-current=true]{background:var(--accent)}.dinfo{padding:8px 12px 10px;border-top:1px solid var(--border);font:11px/1.6 var(--font-mono);color:var(--muted-foreground);overflow-wrap:anywhere}
.lswitch{position:absolute;bottom:100%;right:0;display:flex;gap:6px;margin-bottom:8px}.root:not(.right) .lswitch{right:auto;left:0}
.lpill{position:relative;display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:1px solid var(--border);border-radius:999px;background:var(--background);box-shadow:0 6px 18px rgba(0,0,0,.2);font:600 12px var(--font-sans);color:var(--foreground);cursor:pointer}.lpill:hover{background:var(--accent)}.lpill[data-warn]{border-color:var(--warning)}.lpill>.icon{width:14px;height:14px;color:var(--muted-foreground)}.lpill>.icon:last-of-type{width:12px;height:12px}.lpill .mdot{margin:0}.lpill>select{position:absolute;inset:0;width:100%;opacity:0;cursor:pointer}.lpill option{background:var(--background);color:var(--foreground)}.lpill:has(select:disabled){cursor:default;opacity:.7}
.head .tabs{flex:1;min-width:0;margin-right:6px;overflow-x:auto;scrollbar-width:none}
.head [role=tab]{padding-inline:6px}
.dev [data-tab=elements]{position:relative;margin-inline-start:9px}
.dev [data-tab=elements]::before{content:'';position:absolute;inset-block:5px;left:-6px;width:1px;background:var(--border)}
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

export const LOCALE_CSS = `.lwhere{display:flex;align-items:center;gap:8px;min-width:0;padding:2px 2px 10px;font-size:13px}.lwhere b{font-weight:600}.lwhere .dim{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.lwarn{color:var(--warning)}
.lflag{flex-shrink:0;width:24px;height:18px;border-radius:3px;object-fit:cover;box-shadow:0 0 0 1px var(--border)}
.lrows{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 16px;padding:10px 2px 2px;border-top:1px solid var(--border);font-size:13px}.lrows>dt{color:var(--muted-foreground)}.lrows>dd{overflow-wrap:anywhere}.lrows a{color:var(--info)}.lrows a:hover{text-decoration:underline}`;

export const CONFIG_CSS = `.cmodal{font-family:var(--font-sans)}
.cmodal>div{max-width:min(560px,100% - 2rem);height:min(44rem,calc(100vh - 2rem));padding:0;gap:0}
.cmodal>div>header{padding:16px 48px 14px 20px;border-bottom:1px solid var(--border)}
.cmodal h2{display:flex;align-items:center;gap:8px;font-size:16px}
.cmodal>div>footer{flex-direction:row;flex-wrap:wrap;justify-content:flex-end;align-items:center;padding:12px 20px;border-top:1px solid var(--border)}
.cmodal>div>footer>:first-child{margin-right:auto}
.cbody{display:flex;flex-direction:column;min-height:0}
.ctabs{padding:12px 20px 0}
.cedit{flex:1;min-height:0;overflow-y:auto;padding:0 20px 16px}
.cgroup{padding:14px 0 10px;border-bottom:1px solid var(--border)}
.cgroup:last-child{border-bottom:0}.chead{margin-bottom:4px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}
.crow{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px;padding:4px 0}
.crow>.input[type=text],.crow>.select{flex-shrink:0;width:50%}
.clabel{display:flex;flex-direction:column;gap:1px;min-width:0}
.clabel>span{font-weight:500}.cfrom{display:flex;flex-wrap:wrap;align-items:center;gap:4px;font:11px/1.4 var(--font-mono);color:var(--muted-foreground)}
.cfrom:empty{display:none}.cfrom b{font-weight:500;color:var(--info)}
.cval{max-width:55%;overflow:hidden;font:12px/1.5 var(--font-mono);color:var(--muted-foreground);white-space:nowrap;text-overflow:ellipsis}
.cnote{display:flex;gap:6px;margin-top:8px;font-size:12px;line-height:1.5;color:var(--muted-foreground)}
.cnote[data-tone=warn]{padding:8px 10px;border-radius:var(--radius-md);background:color-mix(in oklab,var(--warning) 10%,transparent);color:var(--warning)}
.cnote>.icon{width:14px;height:14px;margin-top:2px}
.csnip{display:flex;flex:1;flex-direction:column;min-height:0;margin:12px 20px 16px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--muted)}
.csnip>small{padding:10px 14px 4px;font-size:12px;color:var(--muted-foreground)}
.ccode{flex:1;min-height:0;overflow:auto;padding:4px 14px 12px;font:12px/1.6 var(--font-mono);white-space:pre}
.csnip>.cnote{margin:0;padding:10px 14px;border-top:1px solid var(--border)}
.csnip[hidden],.cedit[hidden]{display:none}`;

export const ANALYTICS_CSS = `.anote{display:flex;align-items:center;gap:8px;margin:2px 0 10px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--muted);font:13px var(--font-sans);color:var(--muted-foreground)}
.anote[data-tone=warn]{border-color:color-mix(in oklab,var(--warning) 40%,transparent);background:color-mix(in oklab,var(--warning) 10%,transparent);color:var(--warning)}
.aplaces li{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)}
.anoted{margin-bottom:6px;font-size:12px;color:var(--muted-foreground)}.aplaces li:last-child{border-bottom:0}.aplaces .icon{width:16px;height:16px}
.aplaces code{font:12px var(--font-mono);color:var(--muted-foreground)}
.astate{margin-left:auto;font-size:12px}
.aplaces [data-tone=ok] .astate{color:var(--success)}.aplaces [data-tone=warn] .astate{color:var(--warning)}.aplaces [data-tone=bad] .astate{color:var(--destructive)}
.aplaces [data-tone=off]{color:var(--muted-foreground)}.aplaces [data-tone=off] .icon{opacity:.5}
.aprobs{margin-top:14px;padding:8px 12px 8px 28px;border-radius:var(--radius-md);background:color-mix(in oklab,var(--destructive) 10%,transparent);color:var(--destructive);font-size:12px;list-style:disc}`;

export const BENCH_CSS = `.bmtiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:2px 0 8px;font-family:var(--font-sans)}.bmtile{display:flex;flex-direction:column;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-md)}.bmtile small{font-size:11px;color:var(--muted-foreground)}.bmtile b{font-size:18px;font-weight:600;font-variant-numeric:tabular-nums}.bmtile[data-tone=good] b{color:var(--success)}.bmtile[data-tone=work] b{color:var(--warning)}.bmtile[data-tone=poor] b{color:var(--destructive)}
.bmhead{margin:16px 0 8px;font:600 11px var(--font-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}.bmwf{display:grid;grid-template-columns:minmax(0,150px) minmax(0,1fr) 56px;align-items:center;gap:3px 10px;font-size:12px}.bmname{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.bmms{text-align:right;color:var(--muted-foreground);font-variant-numeric:tabular-nums}
.bmtrack{position:relative;height:12px;border-radius:2px;background:color-mix(in oklab,var(--muted) 60%,transparent)}.bmbar{position:absolute;top:2px;height:8px;min-width:2px;border-radius:2px;background:var(--muted-foreground)}.bmbar[data-kind=file]{background:var(--purple)}.bmbar[data-kind=call]{background:var(--info)}.bmdot{position:absolute;top:1px;width:9px;height:9px;margin-left:-4px;border-radius:2px;background:var(--muted-foreground);transform:rotate(45deg)}.bmdot[data-main]{background:var(--success)}
.bmlegend{display:flex;gap:14px;margin-top:8px;font:11px var(--font-sans);color:var(--muted-foreground)}.bmlegend>span{display:inline-flex;align-items:center;gap:6px}.bmlegend .bmbar,.bmlegend .bmdot{position:static;margin:0}.bmlegend .bmbar{width:10px}.bmnote{margin-top:6px;font:12px var(--font-sans);color:var(--muted-foreground)}
.bmcalls{width:100%;border-collapse:collapse;font-size:12px}.bmcalls th{padding:4px 0;border-bottom:1px solid var(--border);font:500 12px var(--font-sans);text-align:left;color:var(--muted-foreground)}.bmcalls td{padding:4px 0;border-bottom:1px solid var(--border);overflow-wrap:anywhere}.bmcalls :is(th,td):nth-child(2){width:60px}.bmcalls :is(th,td):last-child{width:70px;text-align:right}`;

export const STREAM_CSS = `.schips{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:2px 0 8px;font-family:var(--font-sans)}.sextra{margin-inline-start:auto}
.srow{display:grid;grid-template-columns:86px 84px minmax(0,1fr) auto 14px;align-items:center;gap:0 8px;width:100%;min-height:28px;padding:3px 6px;border-radius:6px;font-family:var(--font-sans);text-align:left;white-space:nowrap}.srow:hover{background:var(--accent)}.srow .time{margin:0}
.stag{justify-self:start;max-width:100%;overflow:hidden;padding:0 7px;border-radius:999px;background:var(--muted);color:var(--muted-foreground);font-size:11px;line-height:18px;text-overflow:ellipsis}.sdot{display:inline-block;width:7px;height:7px;border-radius:50%;background:currentColor;color:var(--muted-foreground)}
:is(.stag,.sdot):is([data-tag=cart],[data-tag=api]){color:var(--info)}:is(.stag,.sdot):is([data-tag=selector],[data-tag=product],[data-tag=products],[data-tag=analytics]){color:var(--purple)}:is(.stag,.sdot):is([data-tag=checkout],[data-tag=payment],[data-tag=address],[data-tag=user]){color:var(--success)}:is(.stag,.sdot):is([data-tag=order],[data-tag=upsell],[data-tag=GA4],[data-tag=Meta],[data-tag=RudderStack]){color:var(--orange)}:is(.stag,.sdot):is([data-tag=coupon],[data-tag=shipping],[data-tag=promotion],[data-tag=warnings]){color:var(--warning)}
.sdesc{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden}.sdesc>:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis}.sname{font:600 12px var(--font-mono);color:var(--foreground)}.smeta{display:flex;align-items:center;gap:8px}.sms{min-width:52px;text-align:right;font:12px var(--font-mono);color:var(--muted-foreground)}.sgo{display:inline-flex;color:var(--muted-foreground);transform:rotate(-90deg)}.sgo .icon{width:14px;height:14px}
.spill{padding:0 6px;border-radius:4px;background:var(--muted);color:var(--muted-foreground);font-size:11px;line-height:16px}.spill[data-tone=ok]{color:var(--success)}.spill[data-tone=bad]{color:var(--destructive)}.spill[data-tone=warn]{color:var(--warning)}
.srow[data-level=warn]{box-shadow:inset 3px 0 var(--warning);background:color-mix(in oklab,var(--warning) 9%,transparent)}.srow[data-level=error]{box-shadow:inset 3px 0 var(--destructive);background:color-mix(in oklab,var(--destructive) 9%,transparent)}
.sgroup>summary{display:flex;align-items:center;gap:8px;padding:3px 6px;font-family:var(--font-sans);white-space:nowrap}.sgcount{margin-left:auto;font-size:11px}
.smodal{font-family:var(--font-sans)}.smodal>div{max-width:min(600px,100% - 2rem);max-height:calc(100vh - 2rem);padding:0;gap:0}.smodal>div>header{padding:16px 48px 14px 20px;border-bottom:1px solid var(--border)}.smodal h2{display:flex;align-items:center;gap:8px;font:600 15px var(--font-mono)}.smodal header p{margin-top:2px;font-size:12px;color:var(--muted-foreground)}
.smbody{overflow-y:auto;padding:4px 20px 20px;font-size:13px}.smbody>.btn{margin-top:12px}.shead{margin:16px 0 6px;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted-foreground)}.sfull{white-space:pre-wrap;overflow-wrap:anywhere}
.sfields{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 16px}.sfields dt{color:var(--muted-foreground)}.sfields dd{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.sitems{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}.sitems th{padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;font-weight:500;text-align:left;color:var(--muted-foreground)}.sitems td{padding:6px 0;border-bottom:1px solid var(--border)}.sitems :is(th,td):not(:first-child){padding-left:12px;text-align:right;white-space:nowrap}.sitems td small{display:block;font-size:12px;color:var(--muted-foreground)}.sitems s{margin-right:6px;color:var(--muted-foreground)}
.stotals{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 0;margin:10px 0 4px;font-size:13px}.stotals dt{color:var(--muted-foreground)}.stotals dd{padding-left:16px;text-align:right}.stotals>:nth-last-child(-n+2){margin-top:4px;padding-top:6px;border-top:1px solid var(--border);font-weight:600;color:var(--foreground)}.spane{display:flex;flex-direction:column;gap:2px;margin-top:8px;font:12px/1.6 var(--font-mono)}.spane>.btn{align-self:flex-end;font-family:var(--font-sans)}`;

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

export const JOURNEY_CSS = `.jsum{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:2px 0 14px;padding:8px 12px;border-radius:var(--radius-md);background:var(--muted);font:12px var(--font-sans)}.jsum .link{margin:0}.jchain{flex:1;min-width:0}.jstate{font-weight:600}
.jmap{font-family:var(--font-sans)}.jtags{display:flex;flex-wrap:wrap;gap:6px}.jtags:empty{display:none}.jtags .badge{gap:3px;white-space:normal}.jtags .icon{width:12px;height:12px}.jmoms{display:flex;flex-direction:column;gap:1px}.jnote{font-size:13px;color:var(--muted-foreground)}.jnote .link{margin-left:8px}
.jmom{display:grid;grid-template-columns:62px minmax(0,1fr);gap:8px;padding:3px 8px;border-radius:6px;font-size:12px}.jmom .time{margin:0}.jmom .icon{width:13px;height:13px;margin-right:6px;vertical-align:-2px;color:var(--success)}.jmom[data-tone=warn]{box-shadow:inset 3px 0 var(--warning);background:color-mix(in oklab,var(--warning) 9%,transparent)}.jmom[data-tone=error]{box-shadow:inset 3px 0 var(--destructive);background:color-mix(in oklab,var(--destructive) 9%,transparent)}
.jcarry{margin-top:4px;font-size:12px;color:var(--success)}.jcarry[data-tone=warn]{color:var(--warning)}.jcarry[data-tone=error]{color:var(--destructive)}
.jpage{font-family:var(--font-sans)}.jpage section{display:flex;flex-direction:column;gap:12px}.jpage h3{font-size:15px;font-weight:600}.jmeta{font-size:12px;color:var(--muted-foreground);overflow-wrap:anywhere}
.jstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px 16px;padding:10px 12px;border:1px solid var(--border);border-radius:8px}.jstats dt{font-size:12px;color:var(--muted-foreground)}.jstats dd{font-weight:500}.jstats dd>.icon{width:14px;height:14px;margin-right:4px;vertical-align:-2px}.jsent{display:flex;flex-wrap:wrap;gap:4px}
.jparams{width:100%;border-collapse:collapse;font-size:12px}.jparams th{padding:6px 8px 6px 0;border-bottom:1px solid var(--border);font-weight:500;text-align:left;color:var(--muted-foreground)}.jparams td{padding:6px 8px 6px 0;border-bottom:1px solid var(--border);vertical-align:top}.jparams td:nth-child(2){overflow-wrap:anywhere}.jparams td small{display:block;font-size:11px}.jparams td .badge{margin:0 4px 2px 0}
.jgroup th{padding-top:12px;font-size:11px;color:var(--foreground)}.jacts{display:flex;flex-wrap:wrap;gap:6px}.jlink>div:first-child{display:flex;gap:6px}.jlinkres{font-size:12px}`;

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
