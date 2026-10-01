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
const OUT=new URL('./out/review/',import.meta.url).pathname; fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(OUT,{recursive:true});
const b64u=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const payload=`driver:1:cdriver1:${Math.floor(Date.now()/1000)}`;
const token=`${payload}.${b64u(crypto.createHmac('sha256',process.env.DRIVER_COOKIE_SECRET||'dev-only-insecure-driver-secret').update(payload).digest())}`;
const row=(o)=>({taskId:'t'+Math.random(),taskStatus:'open',type:'pickup',bookingId:'b1',bookingNumber:'1042',customerName:'דניאל כהן',vehicleName:'טויוטה קורולה היברידית',licensePlate:'12-345-67',location:'רחוב הרצל 12, תל אביב',navQuery:'רחוב הרצל 12 תל אביב',customerPhone:'0521234567',time:'09:30:00',inspection:null,date:'2026-10-01',...o});
const today={open:[row({taskId:'o1',urgent:true,claimable:true,customerName:'שגיא לוי',time:'14:30:00'})],services:[row({type:'service',taskId:'s1',customerName:'מוסך יוסי',vehicleName:'Kia Picanto',licensePlate:'55-111-22',time:'11:00:00',service:{kind:'garage',kindLabel:'מוסך',reason:'תקלה',details:'נורית מנוע דולקת'}})],pickups:[row({}),row({customerName:'מיכל לוי-אברהמי עם שם ארוך מאוד',inspection:{id:'i1',status:'awaiting_signature'},navQuery:undefined,location:''})],returns:[row({type:'return',inspection:{id:'i2',status:'signed',pdfUrl:'https://x/p.pdf'}}),row({type:'return',taskStatus:'done'})]};
const SIGN={data:{inspectionId:'i1',type:'pickup',odometerKm:45210,fuelLabel:'4/8',status:'awaiting_signature',signedAt:null,customerName:'דניאל כהן',vehicleName:'טויוטה קורולה',licensePlate:'12-345-67',declaration:{he:'אני מאשר/ת כי קיבלתי את הרכב במצב המתואר.\n\nאגרות, קנסות ודוחות\nהשוכר אחראי לכל הדוחות.',en:'x'},videoReady:false,hasVideo:false,mediaReady:true,damageMarks:[{n:1,view:'front',x:0.4,y:0.5,kind:'scratch',note:'שריטה בפגוש',hasPhoto:false}],noDamage:false,sidePhotoViews:[],checklist:[{id:'spare',value:'ok'}],mediaToken:'m'}};
const b=await chromium.launch().catch(()=>chromium.launch({executablePath:'/opt/pw-browsers/chromium'}));
const NOW=new Date(); const iso=(d,h)=>{const x=new Date(NOW.getTime()+d*86400000); x.setUTCHours(h,0,0,0); return x.toISOString();};
const bk=(o)=>({customer_name:'דניאל כהן',customer_phone:'0521234567',pickup_date:iso(0,9),dropoff_date:iso(3,9),pickup_time:'23:30:00',return_time:'10:00:00',pickup_location:'רחוב הרצל 12, תל אביב',dropoff_location:'לא צוין',custom_vehicle_name:null,vehicle:{make:'Toyota',model:'Corolla',license_plate:'12-345-67'},...o});
const MANAGE_TASKS=[{id:'t8',type:'pickup',status:'open',urgent:true,notes:null,assigned_driver_id:null,booking:bk({customer_name:'שגיא לוי',pickup_time:'14:30:00'}),inspection:null},{id:'t9',type:'service',status:'open',notes:'נורית מנוע דולקת',assigned_driver_id:'d2',booking:null,inspection:null,scheduled_at:iso(0,9),scheduled_time:'11:00:00',location:'הרצל 3, חולון',service_kind:'garage',service_reason:'fault',service_place:'מוסך יוסי',car:{make:'Kia',model:'Picanto',license_plate:'55-111-22'}},{id:'t1',type:'pickup',status:'open',notes:'ללקוח יש כלב, לצלצל בשער',assigned_driver_id:'d1',booking:bk({}),inspection:null},{id:'t2',type:'return',status:'done',notes:null,assigned_driver_id:'d1',booking:bk({customer_name:'מיכל לוי-אברהמי',dropoff_date:iso(0,8),return_time:'08:00:00',dropoff_location:'שדה התעופה בן גוריון'}),inspection:{id:'s1',status:'signed'}},{id:'t3',type:'pickup',status:'cancelled',notes:null,assigned_driver_id:'d1',booking:bk({customer_name:'יוסי מזרחי',pickup_location:'לא צוין'}),inspection:null},{id:'t4',type:'pickup',status:'open',notes:null,assigned_driver_id:null,booking:bk({customer_name:'רונית אלון',pickup_time:'07:00:00'}),inspection:null},{id:'t5',type:'return',status:'open',notes:null,assigned_driver_id:'d2',booking:bk({customer_name:'אורי שחר',dropoff_date:iso(1,9)}),inspection:{id:'i9',status:'awaiting_signature'}}];
const MANAGE_SIGNED=[{id:'s2',type:'return',signedAt:NOW.toISOString(),customerName:'שירה גל',vehicleName:'Kia Picanto',licensePlate:'55-111-22',address:'',driverName:'אבי',damageCount:1,pdfUrl:'https://x/p.pdf',videoUrl:null},{id:'s1',type:'pickup',signedAt:'2026-09-30T09:00:00Z',customerName:'דניאל כהן',vehicleName:'Toyota Corolla',licensePlate:'12-345-67',address:'רחוב הרצל 12, תל אביב',driverName:'דניאל',damageCount:2,pdfUrl:'https://x/p.pdf',videoUrl:'https://x/v.mp4'}];
const ev=(o)=>({id:'e'+Math.random(),kind:'service',serviceKind:'garage',reason:'maintenance',place:'מוסך יוסי',note:null,status:'done',urgent:false,day:'2026-09-20',time:'10:00',at:'2026-09-20T10:00',driverName:'אבי',...o});
const FLEET=[
 {id:'v1',make:'Kia',model:'Picanto',year:2023,licensePlate:'55-111-22',available:true,withCustomer:false,inGarage:true,toWash:false,lastKm:45210,lastWash:'2026-09-28',lastService:'2026-09-20',openTaskIds:['t9'],history:[ev({id:'t9',status:'open',reason:'fault',note:'נורית מנוע דולקת',day:'2026-10-01',time:'11:00',at:'2026-10-01T11:00',driverName:'יוסי'}),ev({serviceKind:'wash',reason:'wash',place:null,day:'2026-09-28',at:'2026-09-28T09:00'}),{id:'i9',kind:'return',day:'2026-09-25',time:null,at:'2026-09-25T12:00',driverName:'דניאל',customerName:'שירה גל',km:45210,damageCount:1},{id:'i8',kind:'pickup',day:'2026-09-18',time:null,at:'2026-09-18T09:00',driverName:'אבי',customerName:'שירה גל',km:44800,damageCount:0},ev({})]},
 {id:'v2',make:'Toyota',model:'Corolla Hybrid',year:2024,licensePlate:'12-345-67',available:true,withCustomer:true,inGarage:false,toWash:false,lastKm:40000,lastWash:null,lastService:null,openTaskIds:[],history:[]},
 {id:'v3',make:'Hyundai',model:'i20',year:2022,licensePlate:null,available:true,withCustomer:false,inGarage:false,toWash:true,lastKm:null,lastWash:null,lastService:null,openTaskIds:[],history:[]},
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
 if(u.includes('/inspections/i2'))body={data:{...SIGN.data,inspectionId:'i2',type:'return',fuelLabel:'5/8',handoverMarks:[{n:1,view:'left',x:0.3,y:0.5,kind:'dent',note:'',hasPhoto:false}],handoverOdometerKm:44800,handoverFuelLabel:'F',handoverSignedAt:'2026-09-20T10:00:00Z'}}; else if(u.includes('handover?search'))body={data:[{inspectionId:'h1',bookingId:'b1',customerName:'דניאל כהן',vehicleName:'טויוטה קורולה',licensePlate:'12-345-67',signedAt:'2026-09-20T10:00:00Z',marks:[{}],odometerKm:40000,fuelEighths:8}]}; else if(u.includes('handover'))body={data:null}; else if(u.includes('/manage/drivers'))body={data:[{id:'d1',name:'דניאל',active:true,role:'driver',created_at:'2026-09-01'},{id:'d2',name:'אבי',active:true,role:'driver',created_at:'2026-09-01'}]}; else if(u.includes('/manage/tasks'))body={data:MANAGE_TASKS}; else if(u.includes('/manage/inspections'))body={data:MANAGE_SIGNED}; else if(u.includes('/manage/fleet'))body={data:FLEET}; else if(u.includes('/manage/'))body={data:[]}; else if(u.includes('/inspections/'))body=SIGN; r.fulfill({json:body});});
}
// Phone: the floating "משימה חדשה" opens a short menu; computer: the sidebar buttons.
async function act(re,tag){
 if(p.viewportSize().width<1024){
  await p.getByRole('button',{name:'משימה חדשה',exact:true}).last().click(); await p.waitForTimeout(400);
  if(tag!==undefined && !act.menuChecked){act.menuChecked=true; }
  await p.getByRole('dialog').getByRole('button',{name:re}).first().click();
 } else await p.locator('aside').getByRole('button',{name:re}).first().click();
}
async function shots(vp,mobile,tag){
  await newPage(vp,mobile);
  const shot=async(n)=>{await p.waitForTimeout(700); await p.screenshot({path:`${OUT}${tag}_${n}.png`});};
  await p.goto(BASE+'/driver/manage',{waitUntil:'networkidle'}); await shot('1today');
  await p.getByRole('button',{name:/דניאל כהן/}).first().click(); await shot('2task');
  await p.keyboard.press('Escape');
  await p.getByRole('button',{name:/מוסך יוסי/}).first().click(); await shot('2task_service');
  await p.keyboard.press('Escape');
  if(mobile){ await p.getByRole('button',{name:'משימה חדשה',exact:true}).last().click(); await shot('3menu'); await p.keyboard.press('Escape'); }
  await act(/^משימה חדשה/); await shot('3new'); await p.keyboard.press('Escape');
  await act(/^משימה להיום/); await shot('3today'); await p.keyboard.press('Escape');
  await act(/^שטיפה/); await shot('3wash'); await p.keyboard.press('Escape');
  await act(/^טיפול ברכב/); await shot('3service'); await p.keyboard.press('Escape');
  await p.goto(BASE+'/driver/manage/vehicles',{waitUntil:'networkidle'}); await shot('8vehicles');
  await p.getByRole('button',{name:/Kia Picanto/}).first().click(); await shot('8vehicle_sheet'); await p.keyboard.press('Escape');
  await p.goto(BASE+'/driver/manage/calendar',{waitUntil:'networkidle'}); await shot('4calendar');
  await p.goto(BASE+'/driver/manage/drivers',{waitUntil:'networkidle'}); await shot('5drivers');
  await p.getByRole('button',{name:/^דניאל/}).first().click(); await shot('6driver');
  await p.keyboard.press('Escape');
  await p.goto(BASE+'/driver/manage/signed',{waitUntil:'networkidle'}); await shot('7docs');
}

async function driverShots(){
  await newPage({width:390,height:844},true);
  const shot=async(n)=>{await p.waitForTimeout(700); await p.screenshot({path:`${OUT}drv_${n}.png`});};
  await p.goto(BASE+'/driver',{waitUntil:'networkidle'}); await shot('1home');
  await p.getByRole('button',{name:/וואטסאפ ועוד/}).first().click(); await shot('2sheet');
  await p.goto(BASE+'/driver/quick-booking',{waitUntil:'networkidle'}); await shot('3quick');
  await p.goto(BASE+'/driver/inspection/new?bookingId=b1&type=pickup',{waitUntil:'networkidle'}); await shot('4insp1');
  await p.locator('input[inputmode=numeric], input[type=number]').first().fill('45210'); await p.getByText('4/8').click();
  await p.getByRole('button',{name:'הבא'}).click(); await shot('5insp2');
  const skip=p.getByRole('button',{name:/דלג/}); if(await skip.count()) await skip.first().click(); else await p.getByRole('button',{name:'הבא'}).click();
  await shot('6insp3');
  await p.goto(BASE+'/driver/inspection/i1/sign',{waitUntil:'networkidle'}); await shot('7sign');
  await p.goto(BASE+'/driver/login',{waitUntil:'networkidle'}); await shot('8login');
}
if (process.env.ONLY==='driver') { await driverShots(); }
else { await shots({width:390,height:844},true,'m'); await shots({width:1440,height:900},false,'d'); await driverShots(); }
await b.close();
