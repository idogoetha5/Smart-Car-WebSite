import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>, authorized: true,
  challenge: true, insertError: false, unavailable: '',
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'office-fixture' }) }) }));
vi.mock('@/lib/admin-auth', () => ({ verifyAdminToken: async () => state.authorized }));
vi.mock('@/lib/turnstile', () => ({ verifyTurnstile: async () => state.challenge }));
vi.mock('@/lib/ratelimit', () => ({ checkRateLimit: async () => ({ success: true }) }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: (table: string) => ({
  insert: async (row: Record<string, unknown>) => {
    if(state.insertError) return {error: {message: 'fixture storage failure'}};
    (state.rows[table] ??= []).push({id:'new-contact',created_at:'2026-10-24T14:00:00Z',...row});
    return {error:null};
  },
  select: () => {
    const query = { order: () => query, range: async (start: number, end: number) => ({
      data: (state.rows[table] ?? []).slice(start,end+1),
      error: state.unavailable === table ? {message:'fixture source failure'} : null,
    }) };
    return query;
  },
}) }) }));

import { POST } from '@/app/api/contact/route';
import { GET } from '@/app/api/admin/leads/route';
import { getCustomerLeads } from '@/lib/lead-export';

const payload = {name:'TEST SmartCar intake',phone:'0501234567',email:'',message:'בקשת פרטים חדשה — תוכן מלא',turnstileToken:'fixture-only'};
const send = () => POST(new Request('https://example.invalid/api/contact', {method:'POST',body:JSON.stringify(payload),headers:{'content-type':'application/json'}}));
beforeEach(() => {
  state.rows = {}; state.authorized = true; state.challenge = true; state.insertError = false; state.unavailable = '';
  // Never send a notification or perform a network request from this fixture.
  for(const key of ['NEXT_PUBLIC_EMAILJS_SERVICE_ID','NEXT_PUBLIC_EMAILJS_TEMPLATE_ID','NEXT_PUBLIC_EMAILJS_PUBLIC_KEY','EMAILJS_PRIVATE_KEY']) vi.stubEnv(key,'');
  vi.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('contact form → stored enquiry → private live inbox', () => {
  it('exposes a newly saved contact immediately on the next uncached read, even if its name looks internal', async () => {
    expect((await (await GET()).json()).data).toEqual([]);
    const response = await send();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({success:true,notified:false});
    const inbox = await GET();
    expect(inbox.headers.get('cache-control')).toContain('no-store');
    expect(inbox.headers.get('x-robots-tag')).toContain('noindex');
    const {data} = await inbox.json();
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({key:'contact:new-contact',name:payload.name,phone:payload.phone,details:payload.message,internal:true,followup:{status:'NEW'}});
    // Sheet housekeeping remains unchanged, independently of the private inbox.
    expect(await getCustomerLeads()).toEqual([]);
  });
  it('does not claim success or create an enquiry when storing fails', async () => {
    state.insertError = true;
    expect((await send()).status).toBe(503);
    expect((await (await GET()).json()).data).toEqual([]);
  });
  it('retains the challenge guard and never exposes customer data anonymously', async () => {
    state.challenge = false;
    expect((await send()).status).toBe(400);
    state.authorized = false;
    expect((await GET()).status).toBe(401);
    expect(state.rows.contact_leads).toBeUndefined();
  });
  it('keeps all four sources separate and current, including repeat requests by one phone', async () => {
    state.rows = {
      bookings:[{id:'b1',customer_name:'Customer',customer_phone:'0501234567',created_at:'2026-10-24T10:00:00Z'}],
      leasing_requests:[{id:'l1',customer_name:'Customer',customer_phone:'0501234567',created_at:'2026-10-24T11:00:00Z'}],
      whatsapp_rental_requests:[{id:1,customer_name:'',phone:'0501234567',created_at:'2026-10-24T12:00:00Z'}],
    };
    await send();
    const {data} = await (await GET()).json();
    expect(data.map((row: {key:string})=>row.key)).toEqual(['contact:new-contact','whatsapp:1','leasing:l1','booking:b1']);
  });
  it('does not present an empty successful response if a source cannot be read', async () => {
    state.unavailable = 'contact_leads';
    expect((await GET()).status).toBe(503);
  });
  it('reads beyond the first500rows without losing a newer contact', async () => {
    state.rows.contact_leads = Array.from({length:501},(_,i)=>({id:String(i),name:'Customer',created_at:`2026-10-24T14:00:00Z`,message:`message${i}`}));
    const {data} = await (await GET()).json();
    expect(data).toHaveLength(501);
    expect(data.some((row:{details:string})=>row.details==='message500')).toBe(true);
  });
});
