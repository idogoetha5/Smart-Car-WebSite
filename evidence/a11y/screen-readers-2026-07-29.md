# Assistive technology testing — status

Recording what has actually been done, and by whom. The accessibility
statement must not name a screen reader that has not been run against the
site, so this file is the gate on that wording.

## Completed

| # | Screen reader | Browser | OS | Date | Run by | Result | Artefact |
|---|---|---|---|---|---|---|---|
| 1 | VoiceOver | Safari | macOS | 2026-07-29 | Site owner, with a blind participant | Reported as working well across the flows exercised | Screen recording, `~/Downloads/הקלטת מסך 2026-07-29 ב-19.21.32.mov` (39 MB) |

Recorded as reported by the owner. I did not run this session and cannot
attest to what the recording contains; the artefact is the evidence, and it
is held locally rather than in the repository because of its size.

## Not yet done

| # | Screen reader | Browser | OS | Blocker |
|---|---|---|---|---|
| 2 | VoiceOver | Safari | iOS | Needs a physical iPhone |
| 3 | NVDA | Chrome | Windows | No Windows environment available here |
| 4 | NVDA | Firefox | Windows | Same |
| 5 | JAWS | Chrome or Edge | Windows | Same, plus a licence — the trial runs in 40-minute sessions |
| 6 | TalkBack | Chrome | Android | Needs a physical Android device |

**What I can and cannot do.** I have no Windows machine and no Android
device, so 3–6 cannot be run from here. BrowserStack would cover them and
its Live plan includes real screen readers, but it needs an account sign-in
and a paid plan — that is a sign-in and a payment decision for the owner,
not something to work around. I also cannot run VoiceOver myself: it is
driven by speech, and I cannot hear its output, which is why item 1 is
attributed to the owner rather than claimed as mine.

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
