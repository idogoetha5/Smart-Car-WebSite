// Mobile usability audit for the driver app (drivers work only from phones).
// Usage: start the app (`npm run dev`), then:
//   npm i --no-save playwright && node scripts/mobile-audit/run.mjs
// Env: BASE (default http://localhost:3000). DRIVER_COOKIE_SECRET must match the
// running app (unset in dev = the dev fallback secret). Screenshots go to
// scripts/mobile-audit/out/ — LOOK at them, the numbers alone are not enough.
// Fails (exit 1) on: horizontal scroll, any tap target under 44x44px, any text
// input under 16px font (iPhone zooms in on those).
let chromium;
try { ({ chromium } = await import('playwright')); } catch { console.error('Missing playwright: npm i --no-save playwright'); process.exit(2); }
import fs from 'node:fs';
import crypto from 'node:crypto';
const BASE=process.env.BASE||'http://localhost:3000';
const OUT=new URL('./out/',import.meta.url).pathname; fs.mkdirSync(OUT,{recursive:true});
let failed=0;
const b64u=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const payload=`driver:1:cdriver1:${Math.floor(Date.now()/1000)}`;
const token=`${payload}.${b64u(crypto.createHmac('sha256',process.env.DRIVER_COOKIE_SECRET||'dev-only-insecure-driver-secret').update(payload).digest())}`;
const row=(o)=>({taskId:'t'+Math.random(),taskStatus:'open',type:'pickup',bookingId:'b1',bookingNumber:'1042',customerName:'דניאל כהן',vehicleName:'טויוטה קורולה היברידית',licensePlate:'12-345-67',location:'רחוב הרצל 12, תל אביב',navQuery:'רחוב הרצל 12 תל אביב',customerPhone:'0521234567',time:'09:30:00',inspection:null,date:'2026-10-01',...o});
const today={pickups:[row({}),row({customerName:'מיכל לוי-אברהמי עם שם ארוך מאוד',inspection:{id:'i1',status:'awaiting_signature'},navQuery:undefined,location:''})],returns:[row({type:'return',inspection:{id:'i2',status:'signed',pdfUrl:'https://x/p.pdf'}}),row({type:'return',taskStatus:'done'})]};
const SIGN={data:{inspectionId:'i1',type:'pickup',odometerKm:45210,fuelLabel:'4/8',status:'awaiting_signature',signedAt:null,customerName:'דניאל כהן',vehicleName:'טויוטה קורולה',licensePlate:'12-345-67',declaration:{he:'אני מאשר/ת כי קיבלתי את הרכב במצב המתואר.\n\nאגרות, קנסות ודוחות\nהשוכר אחראי לכל הדוחות.',en:'x'},videoReady:false,hasVideo:false,mediaReady:true,damageMarks:[{n:1,view:'front',x:0.4,y:0.5,kind:'scratch',note:'שריטה בפגוש',hasPhoto:false}],noDamage:false,sidePhotoViews:[],checklist:[{id:'spare',value:'ok'}],mediaToken:'m'}};
const pages=process.argv.slice(2).length?process.argv.slice(2):['/driver','/driver/login','/driver/manager-login','/driver/quick-booking','/driver/inspection/new?bookingId=b1&type=pickup','/driver/inspection/new?bookingId=b1&type=return','/driver/inspection/i1/sign','/driver/manage'];
const b=await chromium.launch().catch(()=>chromium.launch({executablePath:'/opt/pw-browsers/chromium'}));
const ctx=await b.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'he-IL'});
await ctx.addCookies([{name:'driver_auth',value:token,url:BASE}]);
const p=await ctx.newPage();
await p.route('**/api/driver/**',r=>{const u=r.request().url();
 let body={};
 if(u.includes('/today'))body=today; else if(u.includes('/me'))body=p.url().includes('/manage')?{role:'manager',name:'עידו',canManage:true}:{role:'driver',name:'יוסי'}; else if(u.includes('/vehicles'))body={vehicles:[]};
 if(u.includes('handover?search'))body={data:[{inspectionId:'h1',bookingId:'b1',customerName:'דניאל כהן',vehicleName:'טויוטה קורולה',licensePlate:'12-345-67',signedAt:'2026-09-20T10:00:00Z',marks:[{}],odometerKm:40000,fuelEighths:8}]}; else if(u.includes('handover'))body={data:null}; else if(u.includes('/manage/drivers'))body={data:[{id:'d1',name:'דניאל',active:true,role:'driver',created_at:'2026-09-01'}]}; else if(u.includes('/manage/'))body={data:[]}; else if(u.includes('/inspections/'))body=SIGN; r.fulfill({json:body});});
async function check(name){
 await p.waitForTimeout(800);
 const res=await p.evaluate(()=>{
  const out={overflowX:document.documentElement.scrollWidth>window.innerWidth+1,small:[],smallInputs:[]};
  for(const el of document.querySelectorAll('button,a,input,select,textarea,[role=button]')){
   const r=el.getBoundingClientRect(); if(!r.width||!r.height)continue;
   const st=getComputedStyle(el); if(st.visibility==='hidden')continue;
   if(['INPUT','SELECT','TEXTAREA'].includes(el.tagName)&&parseFloat(st.fontSize)<16&&el.type!=='checkbox'&&el.type!=='radio') out.smallInputs.push((el.placeholder||el.name||el.type)+' '+st.fontSize);
   const lab=el.closest('label'); if(lab){const lr=lab.getBoundingClientRect(); if(lr.height>=44&&lr.width>=44)continue;}
   if((r.height<44||r.width<44)&&!(el.type==='hidden')) out.small.push(`${el.tagName} "${(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return out;});
 await p.screenshot({path:`${OUT}${name}.png`,fullPage:true});
 const bad=res.overflowX||res.small.length||res.smallInputs.length; if(bad)failed++;
 console.log(bad?'FAIL':'ok  ',name,bad?JSON.stringify(res):'');
}
for(const path of pages){
 await p.goto(BASE+path,{waitUntil:'networkidle'}).catch(e=>console.log('goto',e.message));
 await check(path.replace(/\W+/g,'_'));
 if(path==='/driver'){
   await p.getByRole('button',{name:/עוד/}).first().click(); await check('driver_sheet');
   await p.getByText('עריכת כתובת').click(); await check('driver_sheet_edit');
 }
 if(path==='/driver/quick-booking'){
   await p.getByRole('button',{name:'בדיקת החזרה'}).click(); await p.locator('#return-search').fill('דני'); await p.waitForTimeout(900); await check('quick_return');
   await p.getByRole('button',{name:/הזנת פרטים ידנית/}).click(); await check('quick_return_manual');
 }
 if(path==='/driver/manage'){
   const open=p.getByRole('button',{name:/הקצאת משימה/}).first(); if(await open.count()){ await open.click(); await check('manage_assign'); await p.getByRole('button',{name:'החזרה',exact:true}).click(); await check('manage_assign_return'); }
   else console.log('manage: assign button not found');
 }
 if(path.includes('inspection/new')){
   await p.locator('input[inputmode=numeric], input[type=number]').first().fill('45210'); await p.getByText('4/8').click();
   await p.getByRole('button',{name:'הבא'}).click(); await check('insp_step2');
   const skip=p.getByRole('button',{name:/דלג/}); if(await skip.count()) await skip.first().click(); else await p.getByRole('button',{name:'הבא'}).click();
   await check('insp_step3');
   await p.locator('svg[role=button]').first().click({position:{x:150,y:60},force:true}).catch(e=>console.log('diag',e.message)); await check('insp_mark');
 }
}
await b.close();
console.log(failed?`\n${failed} screen(s) failed the mobile threshold`:'\nAll driver screens pass the mobile threshold');
process.exit(failed?1:0);
