# Gesture acquisition · Science Day

A single-file web app that runs the 10-minute gesture protocol and writes a timestamped
label log, so the sensor recording can be cut by label without any manual annotation.

## Run it

Open `index.html` in Chrome or Safari. No server, no install, no network: it works offline
from a USB stick or from the desktop.

For the day itself:

1. Open the file, press `F` for fullscreen.
2. Enter the subject ID, session number and dominant hand.
3. Start. The subject reads the screen; you only touch the controls if something goes wrong.

Keep the tab in the foreground. The browser is put to sleep after a while in the background,
and the session clock jumps forward when it wakes up.

## Protocol implemented

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
