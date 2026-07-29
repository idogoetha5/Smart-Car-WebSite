# Assistive technology testing — status

Recording what has actually been done, and by whom. The accessibility
statement must not name a screen reader that has not been run against the
site, so this file is the gate on that wording.

## Completed

| # | Screen reader | Browser | OS | Environment | Date |
|---|---|---|---|---|---|
| 1 | NVDA | Microsoft Edge | Windows 11 | BrowserStack | 2026-07-29 |
| 2 | VoiceOver | Safari | macOS | BrowserStack | 2026-07-29 |
| 3 | VoiceOver | Safari | macOS | Local machine | 2026-07-29 |

All three were run against the live site. Sessions 1 and 2 were carried out
through BrowserStack, which retains session video and logs — that archive is
the durable artefact for them. Session 3 was run locally and screen-recorded.

I did not operate any of these sessions myself: a screen reader is driven by
speech, and I cannot hear its output. The records above are the test log, not
a second-hand claim.

## Not tested

| Screen reader | Browser | OS | Note |
|---|---|---|---|
| **JAWS** | — | — | **Not tested. Must not be named anywhere — statement, README or marketing.** |
| VoiceOver | Safari | iOS | Not covered by the sessions above |
| NVDA | Firefox | Windows | Only the Edge pairing was run |
| TalkBack | Chrome | Android | Not covered |

The absence of JAWS does not diminish the NVDA and VoiceOver sessions that
were run; it only bounds what may be claimed.

**What I did instead, and what it is worth.** The accessibility tree was
read programmatically on the home, contact and vehicle-booking pages: every
interactive element enumerated, its accessible name resolved the way an
assistive technology would, and form controls checked for real
label associations. That catches missing, wrong and wrongly-languaged names
— it found the unnamed date buttons, the placeholder-as-label forms and the
unnamed star rating. It does not tell you how a screen reader sequences a
page, how it announces a live region in practice, or whether a flow makes
sense to someone who cannot see it. Those need items 1–6.

## Routes each session should cover

Page title and language on entry; navigation by heading, landmark, link and
form control; the desktop and mobile menus; switching between Hebrew and
English; catalogue, filtering and vehicle selection; the gallery and vehicle
card; the booking form including date selection, add-ons and error messages;
the leasing and contact forms; the FAQ accordion; the cookie banner and
dynamic messages; the accessibility, privacy and terms pages; and complete
keyboard-only operation including focus order, focus retention and Escape.

No real booking, lead, email or payment is to be submitted. Stop before the
send action.
