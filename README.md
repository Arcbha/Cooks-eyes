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

Dishes appear in row order. Edits show up on the page within a few minutes
(Google refreshes published sheets periodically); tap **Reload list** to refetch.

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
| New dish not showing | Wait a few minutes, then tap Reload list |
| A button named "Other" | A row has an empty Section cell |
