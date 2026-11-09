# Chrome live acceptance — English existing rental: tyre light + extra day (2026-11-09)

- Channel: Claude in Chrome, https://www.smartcar.co.il/en/whatsapp-demo, public 39c3a4d. Observational fetch logger only.
- Type: new human service story. Fictional reference 778812.
- Result: **FAILED at turn 3** (explicit request looped). Stopped after turn 4.

1. C: Hi, I'm renting one of your cars right now. A yellow tyre pressure light just came on while I was on the highway near Haifa. Is it dangerous? I'm parked at a gas station now.
   B (gemini, no escalation): check/inflate tyres to recommended pressure; call the office if damaged. — **open concern**: maintenance guidance is not from approved facts and no phone number was given. Not changed here; needs owner-approved warning-light/breakdown guidance.
2. C: Ok thanks. The tyres look normal to me. Also while I have you - my flight got moved so I might need the car one more day, until Sunday instead of Saturday. How does that work?
   B: extension needs availability check and confirmation, rate may differ, original return binding. — pass (advisory, no request).
3. C: Booking number is 778812. Please go ahead and ask for the extra day, I'm sure I need it now.
   B: "...Would you like us to check availability for that extra day now?" — **FIRST FAILURE**: serviceChangeRequested=false, no review queued; reference saved.
4. C: Yes that's literally what I just asked. So is it confirmed then? And is it the same daily rate?
   B: "Not yet ... would you like us to check availability for Sunday now?" — loop repeated; still not queued.

## Local repair (unpublished)

- Selected-change detection now covers "ask/request for the extra day", "go ahead with the extension", "add one more day" and Hebrew תבקשו/תגישו/תוסיפו עוד יום/הארכה, still behind the existing hypothetical/declined guard.
- An assistant offer to check availability for the extra day/extension counts as an explicit review offer; "yes, that's (literally) what I asked" accepts it (generic availability remarks do not).
- Tests: src/lib/__tests__/whatsapp-extension-explicit-request.test.ts (11) — queued once, follow-up says not approved, no rental created, hypothetical/declined stay advisory.
