# Home Suite

| Page | Address | For |
|---|---|---|
| Home Suite (launcher) | https://arcbha.github.io/Cooks-eyes/home/ | You |
| Home To-dos | https://arcbha.github.io/Cooks-eyes/todos/ | You and family |
| Mohna's Recipes | https://arcbha.github.io/Cooks-eyes/ | The cook |

The recipe page stays at the main address (it is on the cook's phone) and has
no link to the Home Suite. Add **Home Suite** to your own phone's home screen.

**Home To-dos:** two lists, **Things to order** and **Home chores**. Type and tap
**Add**; tap an item to tick it off (it moves to **Done**); **×** deletes it;
**Clear done** empties the Done list; **Share this list on WhatsApp** sends the
open items as one message (handy for the shop). Changes save straight away and
show on other phones when the page is opened again. The lists are kept in a
private **Home Suite data** spreadsheet in your Google Drive (created the first
time the page is used), not in the recipe sheet.

**Alerts:** a new to-do (any list) pops up on your other phones as a **Home
Suite** alert, with the Home Suite icon. Turn it on once per phone from the
**To-do alerts** card at the bottom of the Home page. On Android, also tap
**Install app** there (or Chrome menu → Install app) so alerts carry the Home
Suite name. On iPhone, first tap Share → **Add to Home Screen**, open Home Suite
from the home screen, then turn alerts on. **Send a test** checks it works.

**More lists and notes:** tap **+** after the list buttons, type a name, choose
**☑ Checklist** (items to tick off) or **📝 Note** (free writing), and tap
**Create**. The built-in **📝 Notes** page and every note list are one big text
box that saves by itself a moment after typing stops (and when switching away);
the line under it shows when it was last saved, and it can be shared on
WhatsApp. Lists made with + can be removed with **Delete the list** at the
bottom of that list (the built-in lists cannot). Lists made with + and note text
are kept in a **Lists** tab of the same private spreadsheet.

**Adding another app later:** a new folder with its own `index.html`, plus one
block in `APPS` at the top of `home/index.html`.

# Cook's Recipe Page

A one-page recipe list for the cook's phone. Big dish photos, grouped by
section (Breakfast, Main course, ...). Tapping a photo opens the YouTube video.

The list is managed from a private Google Sheet; the page reads it through the
helper script every time it opens.

- **Page:** `index.html` (the only file that matters)

## Privacy

- The sheet, the voice notes and the dish photos are **private**: not shared by
  link and not published to the web. Only your Google account can open them.
- The pages read them through the helper script, which hands out only the dish
  list, the menu, and files in the **Recipe voice notes** and **Recipe photos**
  folders. Nothing else in your Drive can be reached.
- There is no passcode. Changes (plan, add a dish, record, to-dos) work only on
  devices that have opened your **setup link** once. The setup link is private:
  keep it to yourself and never send it to the cook. The cook's page has no
  links to Home or the tools.
- This code is public (free GitHub Pages needs that), but it holds no keys,
  sheet links or passwords.
- To lock a device out (for example a lost phone), ask Claude to change the
  device key; every other device then opens the new setup link once.

## Sheet columns (row 1)

| Column heading | What to put | Required |
|---|---|---|
| Section | Breakfast, Main course, or any new name (adds a new button) | Yes |
| Dish name | Name shown under the photo, any language | Yes |
| YouTube link | Video link as copied from YouTube (normal, youtu.be, Shorts) | Yes |
| Image link | Your own picture, only if you don't want the YouTube photo | No |
| Show | `N` hides the dish; blank or `Y` shows it | No |
| Voice link | Google Drive link to a spoken recipe; adds a **Listen to instructions** button under the dish | No |

Dishes appear in row order. Edits show up as soon as the page is opened again
or **Reload list** is tapped. Keep the sheet's sharing at **Restricted**.

## Add a dish (no sheet needed)

Open **https://arcbha.github.io/Cooks-eyes/#add** (or tap **Add a dish** at the
bottom of the recipe page):

1. **Video link:** a YouTube or Instagram reel link. Tap **Paste** (on a laptop,
   press Ctrl+V or ⌘V in the box). For YouTube a preview shows the video's
   picture, title and channel. For Instagram the reel's own picture is fetched
   by itself and saved in the **Recipe photos** folder (private reels can't be
   fetched; add a photo for those). For dishes added earlier, use the sheet menu
   **Recipe page → Fill Instagram pictures**.
   **Photo (optional):** only if you want your own picture; picked from the
   phone or laptop, made small, saved in **Recipe photos**, and shown instead of
   the video's own picture. Instagram dishes get a small "Reel" label for the cook.
2. **Dish name:** in any language.
3. **Section:** tap Breakfast, Lunch/Dinner, or **+ New section** to start one
   (for example Snacks).
4. Tap **Add dish** (or press Enter). It is added as a new row at the bottom of the sheet and
   shows on the recipe page straight away.

If the dish is already in that section, the page says so; tapping the button
again replaces its video link (its voice note is kept). After adding, **Record
voice instructions** goes straight to the record page with the new dish picked.
Works on your set-up devices, like the record and plan pages.

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

The plan page works on your set-up devices, like the record page.

## Voice instructions

Any dish can have a voice note. The cook taps **Listen to instructions** under
the photo and it plays right there; tapping again stops it. Only one plays at a
time. If a phone can't play the file in the page, the button changes to
**Open voice note**, which plays it in Google Drive instead.

### Record page (easiest: record straight from your phone)

Open the recipe site with `#record` on the end, e.g.
**https://arcbha.github.io/Cooks-eyes/#record** (or tap **Voice note** on the
Home page). Pick the dish,
tap **Record**, speak, tap **Stop**, listen back, then **Save to recipe page**.
The note goes into your Google Drive and its link into the sheet; it shows on
the recipe page straight away. Recording again for the same dish
replaces the old note. You can also pick a recording that is already on the
phone (for example a WhatsApp voice note you saved).

It works only on devices that have opened your setup link once.

**One-time setup (10 minutes, on a computer):**
1. Open the recipe sheet → **Extensions → Apps Script**. Delete what is there,
   paste in everything from `voice-notes-helper.gs`, and on the line
   `var OWNER_KEY = "change-me";` replace `change-me` with a long random key
   (keep the quote marks). Click **Save**. Your setup link is the Home page
   address + `#setup=` + that key.
2. Click **Deploy → New deployment**. Click the gear next to "Select type" →
   **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click
   **Deploy**.
3. Google asks for permission: choose your account, then **Advanced → Go to
   (project name) → Allow**. (Google shows this warning for every script you
   write yourself.)
4. Copy the **Web app URL** (it ends in `/exec`) and paste it into
   `VOICE_UPLOAD_URL` near the top of `index.html` (or send it to Claude to do).

If you change the script later (for example a new device key), use **Deploy →
Manage deployments → ✏️ → Version: New version → Deploy** so the address stays
the same.

### Other ways to add a voice note

**Drive folder + menu:** the same script adds a **Recipe page → Link voice
notes** menu to the sheet (reload the sheet after step 1). Name each file like
the dish (e.g. `Poha.m4a`), upload it to the Drive folder **Recipe voice
notes**, then run the menu. It fills in the **Voice link** column, makes the
files playable on the page (they stay private), and lists any file it
couldn't match. (Menus need a computer,
or the phone's browser in "Desktop site" mode.)

**By hand:** upload the recording into the **Recipe voice notes** folder in
Google Drive, copy its link (leave its sharing as **Restricted**), and paste it
into the dish's **Voice link** cell.

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
   (Nothing private is in here: no keys, passwords or sheet links.)
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
| "Could not load the list" | Helper script address wrong in `index.html`, or the script was not redeployed |
| "needs these column headings" | Restore Section, Dish name, YouTube link in row 1 |
| Coloured letter tile instead of a photo | Link isn't a single video, or the video was removed |
| "Video link missing" | YouTube link cell is empty |
| New dish or voice note not showing | Tap Reload list |
| "This device can't make changes" | Open your setup link once on that device |
| A button named "Other" | A row has an empty Section cell |
