# Cook's Recipe Page

A one-page recipe list for the cook's phone. Big dish photos, grouped by
section (Breakfast, Main course, ...). Tapping a photo opens the YouTube video.

The list is managed from a Google Sheet; the page reads it every time it opens.

- **Sheet (published CSV):** https://docs.google.com/spreadsheets/d/e/2PACX-1vRaRZ5A2EKnAYddc4YnMJwi2gyr-cFIIbRKQjuaKb13MsQ1S7rd-x7Iuon-PEvmuDPhIyZVoHV7QcDR/pub?output=csv
- **Page:** `index.html` (the only file that matters)

## Sheet columns (row 1)

| Column heading | What to put | Required |
|---|---|---|
| Section | Breakfast, Main course, or any new name (adds a new button) | Yes |
| Dish name | Name shown under the photo, any language | Yes |
| YouTube link | Video link as copied from YouTube (normal, youtu.be, Shorts) | Yes |
| Image link | Your own picture, only if you don't want the YouTube photo | No |
| Show | `N` hides the dish; blank or `Y` shows it | No |
| Voice link | Google Drive link to a spoken recipe; adds a **Listen to instructions** button under the dish | No |

To show an **Edit dish list** link at the bottom of the page, paste the sheet's
normal edit link (from the browser address bar while the sheet is open) into
`SHEET_EDIT_URL` near the top of `index.html`. Only Google accounts the sheet is
shared with can edit; anyone else just sees a "request access" page.

Dishes appear in row order. The page reads the sheet directly, so edits show
up as soon as the page is opened again or **Reload list** is tapped. This needs
the sheet's sharing to stay at **Anyone with the link → Viewer**; if that is
turned off, the page falls back to the published copy, which can lag by a few
minutes and sometimes shows an older version.

## Add a dish (no sheet needed)

Open **https://arcbha.github.io/Cooks-eyes/#add** (or tap **Add a dish** at the
bottom of the recipe page):

1. **YouTube link:** tap **Paste** (or paste into the box). A preview shows the
   video's picture, title and channel, so a wrong link is caught straight away.
2. **Dish name:** in any language.
3. **Section:** tap Breakfast, Lunch/Dinner, or **+ New section** to start one
   (for example Snacks).
4. Tap **Add dish**. It is added as a new row at the bottom of the sheet and
   shows on the recipe page straight away.

If the dish is already in that section, the page says so; tapping the button
again replaces its video link (its voice note is kept). After adding, **Record
voice instructions** goes straight to the record page with the new dish picked.
Uses the same helper script and passcode as the record and plan pages.

## Today's menu

Plan what the cook should make, and the page shows it to the cook on that day.

**Planning (you):** open **https://arcbha.github.io/Cooks-eyes/#plan** (or tap
**Plan the menu** at the bottom of the recipe page). Choose **Today**,
**Tomorrow** or any date, tick the dishes for **Breakfast**, **Lunch** and
**Dinner** (each meal lists the dishes from the sections named after it, so
"Lunch/Dinner" dishes appear under both), add anything not on the list under
"Something else", add a note for the cook if you like, and tap **Save menu**.
In the evening the page picks tomorrow by itself, so planning on the 9th at
night for the 10th is the default. Opening a date that is already planned shows
its dishes ticked, so it can be changed; saving again replaces that day's plan.

**What the cook sees:** on that day the page opens on a **Today** button with
the date, your note, and the dishes under Breakfast, Lunch and Dinner, each with its photo,
video and voice note. When tomorrow is planned too, a **Tomorrow** button
appears (handy for soaking or defrosting), but the page never opens on it by
itself. A page left open overnight moves to the new day's menu when the phone
is picked up again.

**Where it's kept:** a **Menu** tab in the sheet (Date, Meal, Dish name, Note),
created on the first save. It can also be edited by hand there: write dates as
`2026-10-10` (or `10/10/2026`, day first), and use the same dish names as the
main tab so the photo, video and voice note show up. "Today" follows the date on
the cook's phone.

The plan page uses the same helper script and passcode as the record page.

## Voice instructions

Any dish can have a voice note. The cook taps **Listen to instructions** under
the photo and it plays right there; tapping again stops it. Only one plays at a
time. If a phone can't play the file in the page, the button changes to
**Open voice note**, which plays it in Google Drive instead.

### Record page (easiest: record straight from your phone)

Open the recipe site with `#record` on the end, e.g.
**https://arcbha.github.io/Cooks-eyes/#record** (there is also a small
**Record voice notes** link at the bottom of the recipe page). Pick the dish,
tap **Record**, speak, tap **Stop**, listen back, then **Save to recipe page**.
The note goes into your Google Drive and its link into the sheet; it shows on
the recipe page straight away. Recording again for the same dish
replaces the old note. You can also pick a recording that is already on the
phone (for example a WhatsApp voice note you saved).

The page asks for a passcode (it remembers it on that phone), so only people
you give it to can add notes.

**One-time setup (10 minutes, on a computer):**
1. Open the recipe sheet → **Extensions → Apps Script**. Delete what is there,
   paste in everything from `voice-notes-helper.gs`, and on the line
   `var RECORDER_PASSCODE = "change-me";` replace `change-me` with your own
   passcode (keep the quote marks). Click **Save**.
2. Click **Deploy → New deployment**. Click the gear next to "Select type" →
   **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click
   **Deploy**.
3. Google asks for permission: choose your account, then **Advanced → Go to
   (project name) → Allow**. (Google shows this warning for every script you
   write yourself.)
4. Copy the **Web app URL** (it ends in `/exec`) and paste it into
   `VOICE_UPLOAD_URL` near the top of `index.html` (or send it to Claude to do).

If you change the script later (for example a new passcode), use **Deploy →
Manage deployments → ✏️ → Version: New version → Deploy** so the address stays
the same.

### Other ways to add a voice note

**Drive folder + menu:** the same script adds a **Recipe page → Link voice
notes** menu to the sheet (reload the sheet after step 1). Name each file like
the dish (e.g. `Poha.m4a`), upload it to the Drive folder **Recipe voice
notes**, then run the menu. It fills in the **Voice link** column, makes the
files playable, and lists any file it couldn't match. (Menus need a computer,
or the phone's browser in "Desktop site" mode.)

**By hand:** upload the recording into the **Recipe voice notes** folder in
Google Drive, set **Share → General access → Anyone with the link**, copy the
link, and paste it into the dish's **Voice link** cell.

Google Drive will not play its files inside other web pages, so the recipe page
gets Drive voice notes through the helper script, which only hands out files in
the **Recipe voice notes** folder. A Drive note stored anywhere else opens in
Drive instead of playing on the page.

m4a and mp3 files play in the page on every phone; WhatsApp (opus) notes play on
Android, and on iPhone they open in Google Drive instead.

## Open it on a computer

The easiest way is to open the website link (below) in any browser.

Double-clicking `index.html` does **not** work: Google refuses to send the
sheet to a page opened as a file. To run it locally instead, use the launcher
in this folder (needs Python):

- **Windows:** double-click `start-local.bat`
- **Mac/Linux:** run `./start-local.sh`

Then open http://localhost:8000. A phone on the same Wi-Fi can open
`http://<computer's IP address>:8000` while the launcher window stays open.

## Put it online (free)

**Option A: GitHub Pages** (this repo)

1. The repo must be **public** for free GitHub Pages:
   Settings → General → Danger Zone → Change visibility → Public.
   (Nothing private is in here; the page only holds the published sheet link,
   which is already public.)
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch**,
   choose the branch holding `index.html` and folder **/ (root)** → Save.
3. After a minute the page is live at **https://arcbha.github.io/Cooks-eyes/**

**Option B: Netlify Drop** (works with a private repo)

Open https://app.netlify.com/drop and drag in a folder containing `index.html`.
Rename the site under Site settings, e.g. `our-recipes.netlify.app`.

## Add it to the cook's phone

Open the link on the phone, then:
- **Android (Chrome):** ⋮ menu → *Add to Home screen*
- **iPhone (Safari):** Share → *Add to Home Screen*

## Troubleshooting

| What you see | Fix |
|---|---|
| "Sample list" message | Sheet link not set in `index.html` (line 20) |
| "did not return a list" | Sheet not published to web as CSV |
| "needs these column headings" | Restore Section, Dish name, YouTube link in row 1 |
| Coloured letter tile instead of a photo | Link isn't a single video, or the video was removed |
| "Video link missing" | YouTube link cell is empty |
| New dish or voice note not showing | Tap Reload list; check the sheet is shared as Anyone with the link → Viewer |
| A button named "Other" | A row has an empty Section cell |
