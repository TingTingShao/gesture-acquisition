# Gesture acquisition · Science Day

A single-file web app that runs a 10-minute gesture protocol and writes a timestamped label
log, so the sensor recording can be cut by label without any manual annotation.

Two gesture sets ship with it, chosen from a dropdown on the setup screen:

| set | gestures | trials | per trial |
|---|---|---|---|
| **Daily activities** | drinking, eating, opening a bottle, pouring, typing, answering the phone, combing, cutting | 9–15, drawn at random | 30 s perform, rest derived |
| **Drawing shapes** | triangle, circle, square, five-pointed star | 10, fixed | 30 s drawing, 30 s rest |

## Open it

**Live link — nothing to install:**
<https://gesture-acquisition.apps.workbuddy.host/?sharecode=FJIBYQPJ6Q>

Open it in a laptop browser (Chrome or Safari). Phone layouts work, but the protocol needs a
table, a glass, a keyboard and scissors, so a laptop is the only sensible place to run it.

Two things to know before sharing the link:

- **Records stay with whoever runs the session.** The archive lives in that browser's
  `localStorage`; nothing is uploaded and the link does not collect data centrally. If you need
  someone's session, ask them for the CSV.
- **The link is public.** Anyone holding it can run a session. There is no login.

For a study, the local file is still the better setup: one machine, one archive, one export.

## Run it locally

Open `index.html` in Chrome or Safari — double-click it, or drag it into a browser window. No
server, no install, no network: it works offline from a USB stick or from the desktop.

Do not open it inside an IDE preview panel or any other sandboxed frame: those drop every file
download silently. The page detects that case and says so, but the files never appear.

For the day itself:

1. Open the file, press `F` for fullscreen.
2. Pick the gesture set, then enter the subject ID, session number and dominant hand.
3. Start. The subject reads the screen; you only touch the controls if something goes wrong.

The set is remembered, so the second session of the day starts on the same one.

Keep the tab in the foreground. The browser is put to sleep after a while in the background,
and the session clock jumps forward when it wakes up.

## Protocol implemented

Both sets fill exactly 600 s and end on 10:00. They differ in how the schedule is derived.

### Daily activities

| | |
|---|---|
| Total | 600 s fixed, always ends at 10:00 |
| Trials | drawn at random from 9–15 at the start of every session |
| Per trial | 30 s perform window (adjustable 10–35 s) |
| Rest | follows from the draw, so the session fills exactly 600 s |
| Order | random: all 8 gestures at least once, drinking exactly twice, no gesture twice in a row, no gesture more than 3 times |

The number of trials is not chosen by hand. Each session draws `n` from 9–15, then sets the
rest so the schedule closes on the ten-minute mark:

```
rest = (600 s − n × perform) / n
```

which gives 10 s of rest at 15 trials, 16 s at 13, and 37 s at 9. Every session ends at 10:00
with no idle tail, whatever the draw.

### Drawing shapes

| | |
|---|---|
| Total | 600 s fixed, always ends at 10:00 |
| Trials | 10, fixed |
| Per trial | 30 s drawing, 30 s rest |
| Order | random: all 4 shapes at least twice, no shape twice in a row, none more than 3 times |

30 s + 30 s × 10 trials is exactly 600 s, so nothing is derived here — the draw is fixed and
the schedule falls out of it. Ten slots over four shapes means two shapes appear three times
and two appear twice; the constraints keep that spread random rather than balanced by hand.

The subject keeps drawing the same shape for the whole 30 s window, so the window stays
class-pure and any cut inside it inherits the label. A shape takes 1–3 s, so a window holds
10–20 repetitions.

### The 30 s is a repetition window, not one slow execution

The subject repeats the gesture inside the window — a drinking cycle takes 4–6 s, so a 30 s
window naturally holds five or seven repetitions. The log labels the whole window, which is
enough for training: the window is class-pure, so any sliding window cut inside it inherits
the label. If a single execution took the full 30 s, roughly 85 % of every window would be
idle and the recording would be useless.

Between trials the screen asks for the resting position: hands relaxed on the table,
forearms supported, no movement. The last three seconds of each rest turn amber and name the
next gesture, so the subject is ready but not moving early.

## On-screen illustrations

Each gesture has its own looping animation, drawn as inline SVG (no image files, nothing to
download). The point is that a subject who has not read the protocol can see what to do
without a researcher explaining it:

| gesture | what the loop shows |
|---|---|
| Drinking | glass rises from the table, tilts into the mouth, comes back down |
| Eating | almond is carried to the mouth and disappears |
| Opening a bottle | cap twists twice, lifts, and is placed on the table |
| Pouring water | bottle tilts, water stream falls, the glass fills |
| Typing | index finger taps three keys, keys light up |
| Answering the phone | phone rises to the ear, holds, returns |
| Combing hair | comb strokes down through the hair twice |
| Cutting | scissors open and close four times, the sheet feeds through |
| Triangle | the outline is drawn continuously: left side, top, right side |
| Circle | one stroke from the top, clockwise, returning to the start |
| Square | four sides in order, one stroke each |
| Star | the five strokes of a pentagram, in the order a person draws them |

The resting position has its own calm loop (hand flat on the table, slow breathing rings), and
during the three-second get-ready cue the card switches to the next gesture, tinted amber.

The animation is decorative and always secondary to the text: the instructions are complete
without it, so a subject who ignores the picture still knows what to do.

## What gets recorded

`gesture_<subject>_s<n>_<date>.csv` — one row per trial, self-contained:

| column | meaning |
|---|---|
| `session_start_iso`, `session_start_epoch_ms` | the anchor for the whole session |
| `trial_idx`, `order_pos` | position in the randomised order |
| `label`, `prop` | gesture name and the object involved |
| `planned_start_s`, `planned_end_s` | seconds from session start, exact by construction |
| `actual_start_iso`, `actual_start_epoch_ms` | measured wall-clock time, millisecond resolution |
| `actual_end_iso`, `actual_end_epoch_ms` | same for the end |
| `duration_s` | wall-clock duration of the window |
| `status` | `completed` / `skipped` / `aborted` / `not_reached` |
| `detected_lag_ms` | how late the UI noticed the boundary, normally 7–12 ms |
| `gesture_set` | `daily` or `shapes` — which set the session ran |

`gesture_<subject>_s<n>_<date>.json` — the same trials plus every state change
(`SESSION_START`, `TRIAL_START`, `TRIAL_END`, `PAUSE`, `RESUME`, `SKIP`, `REDO`,
`SESSION_END`) and the exact protocol constants.

For annotation you normally need only two things: `session_start_epoch_ms` and the
`planned_*` offsets. The `actual_*` columns are there to prove nothing drifted.

## Aligning with the sensor

Set the acquisition clock to the same machine clock, or read the session start off the
screen and offset the sensor file by it. Each transition also plays a short tone and flashes
the screen white for 90 ms, which shows up on video if you ever need to cross-check.

## Getting the records out

Nothing is emailed from the page — a browser has no mail transport, and `mailto:` only fires when a
mail client is installed *and* registered as the handler. So there is no email field to fill in:
the records are files, and they land on disk by themselves.

| at the end of a session | what you get |
|---|---|
| automatically | `gesture_<subject>_s<n>_<date>.csv` in the Downloads folder |
| **Download CSV** | the same file again, if the automatic one was missed |
| **Download JSON** | trials + every state-change event + the exact protocol constants |
| **Email draft (.eml)** | a complete RFC 822 message, CSV already attached — double-click it, add the address, Send |

At the end of the day, **Download all as one CSV** on the setup screen merges every stored session
into a single table with a `session_no` column, so twenty subjects become one attachment instead of
twenty. **Download archive (JSON)** next to it dumps everything with the event log.

Stored sessions live in `localStorage` (last 60). Clearing site data wipes them, so keep the files.

### If the download does nothing

Open `index.html` by double-clicking it, or drag it into a Chrome window. A file opened inside an
IDE preview panel, an email client's built-in viewer, or any `<iframe sandbox>` without
`allow-downloads` will drop every download silently — no error, no file. The page detects that case
and shows an amber note in the corner instead of pretending it worked.

### Optional: post every session to a URL

There is no endpoint field on the screen on purpose — a subject-facing setup page should not
carry one. If you do want true zero-touch delivery, open the file once as

```
index.html?post=https://script.google.com/macros/s/…/exec
```

and the URL is remembered from then on: every finished session POSTs its full JSON there in
addition to the local file. A failed upload never interrupts anything — the session is already
saved and downloaded by then, and the closing screen says whether the upload landed. To switch
it off again, run `localStorage.removeItem('ga_endpoint')` in the console.

The body is sent as `text/plain` on purpose: that makes it a simple CORS request with no
preflight, so it works from `file://`.

A Google Apps Script endpoint, if you want one (no server, free, and it mails you the file):

```js
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const s = data.session;
  const rows = data.trials.map(t => [
    t.idx + 1, t.label,
    t.actualStart ? new Date(t.actualStart).toISOString() : '',
    t.actualEnd ? new Date(t.actualEnd).toISOString() : '',
    t.status
  ]);
  const csv = [['trial', 'label', 'start_iso', 'end_iso', 'status'], ...rows]
    .map(r => r.join(',')).join('\n');

  MailApp.sendEmail({
    to: 'lab@university.edu',
    subject: `Gesture session ${s.subject_id} - ${s.start_iso.slice(0, 10)}`,
    body: `Subject ${s.subject_id}, session ${s.session_no}\n\n` +
          rows.map(r => r.join('\t')).join('\n'),
    attachments: [Utilities.newBlob(csv, 'text/csv',
      `gesture_${s.subject_id}_${s.session_no}.csv`)]
  });

  return ContentService.createTextOutput('ok');
}
```

Deploy it as **Web app → Execute as me → Anyone**, then use the `/exec` URL in the query string
above and every session arrives in your inbox as a message with the CSV attached. `MailApp` has a
daily quota (100 recipients on a free account), far more than a Science Day needs.

To append to a spreadsheet instead, swap `MailApp.sendEmail` for
`SpreadsheetApp.openById('…').getSheets()[0].appendRow(rows.flat())`.

## Controls

| key | action |
|---|---|
| `Space` | pause / resume (the clock stops, planned offsets stay intact) |
| `→` | skip the current trial |
| `←` | redo the current trial from the top |
| `F` | fullscreen |

**End session** asks for confirmation. Unreached trials are written as `not_reached` with
empty timestamps rather than invented ones.

## Files

- `index.html` — the whole app (HTML, CSS, JS, no dependencies)
