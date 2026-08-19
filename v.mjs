import { chromium } from 'playwright';
const OUT='/tmp/claude-1000/-home-alex-git-29next-developer-docs/a1339533-a5bd-4395-ad41-6daa0d23d779/scratchpad';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1400,height:1000}});
await p.goto('http://127.0.0.1:3511/latest/cartitem/'); await p.waitForTimeout(800);
console.log('footers:', await p.evaluate(()=>document.querySelectorAll('footer').length));
const f=await p.locator('footer').boundingBox();
await p.screenshot({path:`${OUT}/footer.png`, clip:{x:0,y:f.y,width:600,height:Math.max(40,f.height)}});
await b.close();
