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
const today={open:[row({taskId:'o1',urgent:true,claimable:true,customerName:'שגיא לוי',time:'14:30:00'})],services:[row({type:'service',taskId:'s1',customerName:'מוסך יוסי',vehicleName:'Kia Picanto',licensePlate:'55-111-22',time:'11:00:00',service:{kind:'garage',kindLabel:'מוסך',reason:'תקלה',details:'נורית מנוע דולקת'}})],pickups:[row({}),row({customerName:'מיכל לוי-אברהמי עם שם ארוך מאוד',inspection:{id:'i1',status:'awaiting_signature'},navQuery:undefined,location:''})],returns:[row({type:'return',inspection:{id:'i2',status:'signed',pdfUrl:'https://x/p.pdf'}}),row({type:'return',taskStatus:'done'})]};
const SIGN={data:{inspectionId:'i1',type:'pickup',odometerKm:45210,fuelLabel:'4/8',status:'awaiting_signature',signedAt:null,customerName:'דניאל כהן',vehicleName:'טויוטה קורולה',licensePlate:'12-345-67',declaration:{he:'אני מאשר/ת כי קיבלתי את הרכב במצב המתואר.\n\nאגרות, קנסות ודוחות\nהשוכר אחראי לכל הדוחות.',en:'x'},videoReady:false,hasVideo:false,mediaReady:true,damageMarks:[{n:1,view:'front',x:0.4,y:0.5,kind:'scratch',note:'שריטה בפגוש',hasPhoto:false}],noDamage:false,sidePhotoViews:[],checklist:[{id:'spare',value:'ok'}],mediaToken:'m'}};
const pages=process.argv.slice(2).length?process.argv.slice(2):['/driver','/driver/login','/driver/manager-login','/driver/quick-booking','/driver/inspection/new?bookingId=b1&type=pickup','/driver/inspection/new?bookingId=b1&type=return','/driver/inspection/i1/sign','/driver/inspection/i2/sign','/driver/manage','/driver/manage/calendar'];
const b=await chromium.launch()
  .catch(()=>chromium.launch({channel:'chrome'}))
  .catch(()=>chromium.launch({executablePath:'/opt/pw-browsers/chromium'}));
const NOW=new Date(); const iso=(d,h)=>{const x=new Date(NOW.getTime()+d*86400000); x.setUTCHours(h,0,0,0); return x.toISOString();};
const bk=(o)=>({customer_name:'דניאל כהן',customer_phone:'0521234567',pickup_date:iso(0,9),dropoff_date:iso(3,9),pickup_time:'23:30:00',return_time:'10:00:00',pickup_location:'רחוב הרצל 12, תל אביב',dropoff_location:'לא צוין',custom_vehicle_name:null,vehicle:{make:'Toyota',model:'Corolla',license_plate:'12-345-67'},...o});
const MANAGE_TASKS=[{id:'t8',type:'pickup',status:'open',urgent:true,notes:null,assigned_driver_id:null,booking:bk({customer_name:'שגיא לוי',pickup_time:'14:30:00'}),inspection:null},{id:'t9',type:'service',status:'open',notes:'נורית מנוע דולקת',assigned_driver_id:'d2',booking:null,inspection:null,scheduled_at:iso(0,9),scheduled_time:'11:00:00',location:'הרצל 3, חולון',service_kind:'garage',service_reason:'fault',service_place:'מוסך יוסי',car:{make:'Kia',model:'Picanto',license_plate:'55-111-22'}},{id:'t1',type:'pickup',status:'open',notes:'ללקוח יש כלב, לצלצל בשער',assigned_driver_id:'d1',booking:bk({}),inspection:null},{id:'t2',type:'return',status:'done',notes:null,assigned_driver_id:'d1',booking:bk({customer_name:'מיכל לוי-אברהמי',dropoff_date:iso(0,8),return_time:'08:00:00',dropoff_location:'שדה התעופה בן גוריון'}),inspection:{id:'s1',status:'signed'}},{id:'t3',type:'pickup',status:'cancelled',notes:null,assigned_driver_id:'d1',booking:bk({customer_name:'יוסי מזרחי',pickup_location:'לא צוין'}),inspection:null},{id:'t4',type:'pickup',status:'open',notes:null,assigned_driver_id:null,booking:bk({customer_name:'רונית אלון',pickup_time:'07:00:00'}),inspection:null},{id:'t5',type:'return',status:'open',notes:null,assigned_driver_id:'d2',booking:bk({customer_name:'אורי שחר',dropoff_date:iso(1,9)}),inspection:{id:'i9',status:'awaiting_signature'}}];
const MANAGE_SIGNED=[{id:'s2',type:'return',signedAt:NOW.toISOString(),customerName:'שירה גל',vehicleName:'Kia Picanto',licensePlate:'55-111-22',address:'',driverName:'אבי',damageCount:1,pdfUrl:'https://x/p.pdf',videoUrl:null},{id:'s1',type:'pickup',signedAt:'2026-09-30T09:00:00Z',customerName:'דניאל כהן',vehicleName:'Toyota Corolla',licensePlate:'12-345-67',address:'רחוב הרצל 12, תל אביב',driverName:'דניאל',damageCount:2,pdfUrl:'https://x/p.pdf',videoUrl:'https://x/v.mp4'}];
const RENTAL_ALERTS=[{id:'s2',bookingId:'b2',signedAt:NOW.toISOString(),customerName:'שירה גל',vehicleName:'Kia Picanto',licensePlate:'55-111-22',rentalDays:8,pickupOdometerKm:43000,returnOdometerKm:44900,distanceKm:1900,allowedKm:1760,excessKm:140,pickupFuelEighths:8,returnFuelEighths:5,fuelMissingEighths:3,newDamages:[{n:1,view:'rear',x:.4,y:.5,kind:'dent',note:'מכה בפגוש האחורי'}],kinds:['mileage','fuel','damage'],isLatestRental:true,resolvedAt:null,resolvedBy:null,pdfUrl:'https://x/p.pdf',videoUrl:'https://x/v.mp4'}];
const ev=(o)=>({id:'e'+Math.random(),kind:'service',serviceKind:'garage',reason:'maintenance',place:'מוסך יוסי',note:null,status:'done',urgent:false,day:'2026-09-20',time:'10:00',at:'2026-09-20T10:00',driverName:'אבי',...o});
const FLEET=[
 {id:'v1',make:'Kia',model:'Picanto',year:2023,licensePlate:'55-111-22',testDueDate:'2026-10-20',color:'לבן',available:true,withCustomer:false,inGarage:true,toWash:false,lastKm:45210,lastWash:'2026-09-28',lastService:'2026-09-20',openTaskIds:['t9'],history:[ev({id:'t9',status:'open',reason:'fault',note:'נורית מנוע דולקת',day:'2026-10-01',time:'11:00',at:'2026-10-01T11:00',driverName:'יוסי'}),ev({serviceKind:'wash',reason:'wash',place:null,day:'2026-09-28',at:'2026-09-28T09:00'}),{id:'i9',kind:'return',day:'2026-09-25',time:null,at:'2026-09-25T12:00',driverName:'דניאל',customerName:'שירה גל',km:45210,damageCount:1},{id:'i8',kind:'pickup',day:'2026-09-18',time:null,at:'2026-09-18T09:00',driverName:'אבי',customerName:'שירה גל',km:44800,damageCount:0},ev({})]},
 {id:'v2',make:'Toyota',model:'Corolla Hybrid',year:2024,licensePlate:'12-345-67',testDueDate:'2027-03-15',color:'כסף',available:true,withCustomer:true,inGarage:false,toWash:false,lastKm:40000,lastWash:null,lastService:null,openTaskIds:[],history:[]},
 {id:'v3',make:'Hyundai',model:'i20',year:2022,licensePlate:null,testDueDate:null,color:null,available:true,withCustomer:false,inGarage:false,toWash:true,lastKm:null,lastWash:null,lastService:null,openTaskIds:[],history:[]},
];
let p;
async function newPage(viewport,mobile){
const ctx=await b.newContext({viewport,deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile,locale:'he-IL'});
await ctx.addCookies([{name:'driver_auth',value:token,url:BASE}]);
p=await ctx.newPage();
await p.route('**/api/driver/**',r=>{const u=r.request().url();
 let body={};
 if(u.endsWith('/api/driver/push')){r.fulfill({json:{publicKey:'BBw-JBD4MrJ2kJJBsx8UzFE2UbXfD8mH4_d0Rxwk8drcYGzmZTpl-29qWBnKMO-p-64dYP1WnaVqT0IIpjRVc1U'}});return;}
 if(u.includes('/today?search'))body={results:[row({awaitingReturn:true,taskStatus:'done',date:'2026-09-25',inspection:{id:'i1',status:'signed',pdfUrl:'https://x/p.pdf'}}),row({type:'return',customerName:'רונית לוי'})]}; else if(u.includes('/today'))body=today; else if(u.includes('/me'))body=p.url().includes('/manage')?{role:'manager',name:'עידו',canManage:true}:{role:'driver',name:'יוסי'}; else if(u.includes('/manage/fleet'))body={data:FLEET}; else if(u.includes('/vehicles'))body={data:FLEET.map(v=>({id:v.id,make:v.make,model:v.model,license_plate:v.licensePlate}))};
 if(u.includes('/inspections/i2'))body={data:{...SIGN.data,inspectionId:'i2',type:'return',fuelLabel:'5/8',handoverMarks:[{n:1,view:'left',x:0.3,y:0.5,kind:'dent',note:'',hasPhoto:false}],handoverOdometerKm:44800,handoverFuelLabel:'F',handoverSignedAt:'2026-09-20T10:00:00Z'}}; else if(u.includes('handover?search'))body={data:[{inspectionId:'h1',bookingId:'b1',customerName:'דניאל כהן',vehicleName:'טויוטה קורולה',licensePlate:'12-345-67',signedAt:'2026-09-20T10:00:00Z',marks:[{}],odometerKm:40000,fuelEighths:8}]}; else if(u.includes('handover'))body={data:null}; else if(u.includes('/manage/rental-alerts'))body=r.request().method()==='GET'?{data:RENTAL_ALERTS}:{ok:true}; else if(u.includes('/manage/drivers'))body={data:[{id:'d1',name:'דניאל',active:true,role:'driver',created_at:'2026-09-01'},{id:'d2',name:'אבי',active:true,role:'driver',created_at:'2026-09-01'}]}; else if(u.includes('/manage/tasks'))body={data:MANAGE_TASKS}; else if(u.includes('/manage/inspections'))body={data:MANAGE_SIGNED}; else if(u.includes('/manage/fleet'))body={data:FLEET}; else if(u.includes('/manage/'))body={data:[]}; else if(u.includes('/inspections/'))body=SIGN; r.fulfill({json:body});});
}
await newPage({width:360,height:780},true);
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
// Phone: the floating "משימה חדשה" opens a short menu; computer: the sidebar buttons.
async function act(re,tag){
 if(p.viewportSize().width<1024){
  await p.getByRole('button',{name:'משימה חדשה',exact:true}).last().click(); await p.waitForTimeout(400);
  if(tag!==undefined && !act.menuChecked){act.menuChecked=true; await check('manage_actions_menu'+tag);}
  await p.getByRole('dialog').getByRole('button',{name:re}).first().click();
 } else await p.locator('aside').getByRole('button',{name:re}).first().click();
}
async function manageFlow(tag){
   await check('manage_today'+tag);
   await p.getByRole('button',{name:/דניאל כהן/}).first().click(); await check('manage_task_sheet'+tag);
   await p.getByRole('button',{name:'שינוי',exact:true}).first().click(); await check('manage_task_reschedule'+tag);
   await p.keyboard.press('Escape');
   const chip=p.getByRole('button',{name:/באיחור/}).first(); if(await chip.count()){ await chip.click(); await check('manage_alert'+tag); }
   await act(/^משימה חדשה/,tag); await check('manage_new_task'+tag);
   await p.getByRole('button',{name:'החזרה',exact:true}).click(); await check('manage_new_task_return'+tag);
   await p.keyboard.press('Escape');
   await act(/^טיפול ברכב/,tag); await check('manage_new_task_service'+tag);
   await p.keyboard.press('Escape');
   await act(/^שטיפה/,tag); await check('manage_new_task_wash'+tag);
   await p.keyboard.press('Escape');
   await act(/^משימה להיום/,tag); await check('manage_today_task'+tag);
   await p.getByRole('button',{name:'לכל הנהגים',exact:true}).click(); await check('manage_today_task_first'+tag);
   await p.keyboard.press('Escape');
   await p.goto(BASE+'/driver/manage/vehicles',{waitUntil:'networkidle'}); await check('manage_vehicles'+tag);
   await p.getByRole('button',{name:'הוספת רכב'}).click(); await check('manage_add_vehicle'+tag);
   await p.keyboard.press('Escape');
   await p.getByRole('button',{name:/מחיקת Kia Picanto/}).click(); await check('manage_delete_vehicle'+tag);
   await p.keyboard.press('Escape');
   await p.getByRole('button',{name:/Kia Picanto/}).first().click(); await check('manage_vehicle_sheet'+tag);
   await p.keyboard.press('Escape');
   await p.getByRole('button',{name:'שטיפה',exact:true}).first().click(); await check('manage_vehicle_wash'+tag);
   await p.keyboard.press('Escape');
   await p.goto(BASE+'/driver/manage/drivers',{waitUntil:'networkidle'}); await check('manage_drivers'+tag);
   await p.getByRole('button',{name:/^דניאל/}).first().click(); await check('manage_driver_sheet'+tag);
   await p.keyboard.press('Escape');
   await p.getByRole('button',{name:'הוספת נהג'}).first().click(); await check('manage_add_driver'+tag);
   await p.keyboard.press('Escape');
   await p.goto(BASE+'/driver/manage/signed',{waitUntil:'networkidle'}); await check('manage_documents'+tag);
}
async function calendarFlow(tag){
   await p.getByRole('button',{name:/משימה ליום הזה/}).first().click(); await check('calendar_new_task'+tag);
   await p.keyboard.press('Escape');
   await p.getByRole('button',{name:'רשימה',exact:true}).click(); await check('calendar_list'+tag);
}
for(const path of pages){
 await p.goto(BASE+path,{waitUntil:'networkidle'}).catch(e=>console.log('goto',e.message));
 await check(path.replace(/\W+/g,'_'));
 if(path==='/driver'){
   await p.getByRole('button',{name:/הודעות ופעולות/}).first().click(); await check('driver_sheet');
   await p.getByText('עריכת כתובת').click(); await check('driver_sheet_edit');
   await p.getByRole('button',{name:'סגור'}).last().click();
   await p.getByRole('button',{name:'התראות',exact:true}).first().click(); await check('driver_bell');
   await p.getByRole('button',{name:'סגירה'}).first().click({force:true});
   await p.getByRole('button',{name:'חיפוש',exact:true}).click(); await p.locator('input[type=search]').fill('דני'); await p.keyboard.press('Enter'); await check('driver_search');
 }
 if(path==='/driver/quick-booking'){
   await p.getByRole('button',{name:'בדיקת החזרה'}).click(); await p.locator('#return-search').fill('דני'); await p.waitForTimeout(900); await check('quick_return');
   await p.getByRole('button',{name:/הזנת פרטים ידנית/}).click(); await check('quick_return_manual');
   await p.getByRole('button',{name:'רכב שאינו ברשימה'}).click(); await check('quick_custom_car');
 }
 if(path==='/driver/manage') await manageFlow('');
 if(path==='/driver/manage/calendar') await calendarFlow('');
 if(path.includes('inspection/new')){
   await p.locator('input[inputmode=numeric], input[type=number]').first().fill('45210'); await p.getByText('4/8').click();
   await p.getByRole('button',{name:'הבא'}).click(); await check('insp_step2');
   const skip=p.getByRole('button',{name:/דלג/}); if(await skip.count()) await skip.first().click(); else await p.getByRole('button',{name:'הבא'}).click();
   await check('insp_step3');
   await p.locator('svg[role=button]').first().click({position:{x:150,y:60},force:true}).catch(e=>console.log('diag',e.message)); await check('insp_mark');
 }
}
// Managers also work from a computer: the manager screens at desktop size.
if(pages.some((x)=>x.includes('/manage')||x.includes('manager-login'))){
  await newPage({width:1366,height:850},false);
  await p.goto(BASE+'/driver/manager-login',{waitUntil:'networkidle'}); await check('desktop_manager_login');
  await p.goto(BASE+'/driver/manage',{waitUntil:'networkidle'}); await check('desktop_manage');
  await manageFlow('_desktop');
  await p.goto(BASE+'/driver/manage/calendar',{waitUntil:'networkidle'}); await check('desktop_calendar'); await calendarFlow('_desktop');
}
await b.close();
console.log(failed?`\n${failed} screen(s) failed the mobile threshold`:'\nAll driver screens pass the mobile threshold');
process.exit(failed?1:0);
