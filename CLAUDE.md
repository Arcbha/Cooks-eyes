# Project rules

This repo is the owner's **Home Suite**, published on GitHub Pages:

- `index.html` (site root) is **Mohna's Recipes**, the cook's page. Its address
  is on the cook's phone, so it must stay at the root, and it must never link to
  the Home Suite or the other apps (the cook does not need to see them).
- `home/index.html` is the Home Suite launcher (one tile per app, listed in its
  `CONFIG.APPS`), for the owner only.
- `todos/index.html` is **Home To-dos**: built-in checklists (Things to order,
  Home chores) and a Notes page, plus lists made on the page with + (checklist
  or note), kept in the private spreadsheet's Todos and Lists tabs.
- Each app is its own single file with all its HTML, CSS and JavaScript. A new
  app is a new folder with an `index.html`, plus one tile in `home/index.html`.
- All apps save through the one helper script (`voice-notes-helper.gs`, same web
  app address and passcode). The recipe data is in the recipe sheet, which is
  readable by link; everything else (to-dos) is in a private "Home Suite data"
  spreadsheet the script creates. The passcode is remembered per phone under the
  same browser storage key on every page.

## Updating the helper script (no copy-paste needed)

The live script can be updated from a Claude session with Google's `clasp` tool
(`npx @google/clasp@3`). The owner has turned on the Apps Script API.

- Script ID: `1K7XY80-C55UQflxq4oBOplpjFAq2yUYtpbwHHyFHCULuU0lyq0GAd43u`
- Live deployment (the web app address in every page's config):
  `AKfycbzKgqTVNnPieihSyylKKASbCG3afc_VKvxpC01BBxL57A8YLPGeYSRl2l5z2PExViO5`

Sign-in: if the environment variable `CLASPRC_JSON` is set (the owner stored the
saved clasp sign-in in the Claude environment's settings, base64-encoded),
decode it into `~/.clasprc.json` and skip logging in; the passcode is in `HOME_SUITE_PASSCODE`
when set. Never print either value or put them in the repo. Only if they are
missing or rejected: `clasp login --no-localhost` (the owner opens the link,
approves, and pastes back the `http://localhost:8888/?...` address).

Steps: `clasp clone <script id>`
into a scratch folder, compare the live `Code.js` with `voice-notes-helper.gs`,
copy the new file in with the real passcode put in place of `change-me` (ask the
owner; never commit it), keep the downloaded `appsscript.json` as it is,
`clasp push --force`, then `clasp update-deployment <deployment id> -d "<what
changed>"` so the address stays the same. Test the live address afterwards and
remove any test data. Keep the sign-in out of the repo; it lasts only for the
session.

## Mohna's Recipes

- The recipe page is for a household cook. It is one file, `index.html`,
  with all HTML, CSS and JavaScript inside it.
- The dish list comes from a published Google Sheet (CSV). The link is
  `CONFIG.SHEET_CSV_URL` at the top of `index.html`. Columns: Section,
  Dish name, YouTube link, Image link (optional), Show (optional),
  Voice link (optional, usually a Google Drive link).
- The owner is not a programmer. Keep everything in the single file. Do not
  add frameworks, npm packages, a build step, a server or a database.
- The cook uses a phone. Keep photos large, text large, one dish per row on
  phones, and no login, menus or typing.
- Dish names may be in Hindi or other Indian languages.
- After any change, open the page at 390px width and confirm that both
  sections show, tiles open the right links, and nothing scrolls sideways.
- `voice-notes-helper.gs` is an optional Google Apps Script the owner pastes
  into the sheet. Deployed as a web app (its address goes in
  `CONFIG.VOICE_UPLOAD_URL`), it receives recordings from the record page
  (site address + `#record`) and saves them to Drive and the sheet. It also
  adds a sheet menu that links Drive files to dishes by file name.
- The add page (site address + `#add`) adds a dish (YouTube or Instagram
  link, name, section, optional photo saved to the Drive folder Recipe photos) as a new row of the dish list through the same helper script; an
  existing dish in that section only has its video link replaced on a second tap.
- New to-dos send a phone notification through ntfy.sh. The private channel
  name lives only in the script's Script Properties (`NTFY_TOPIC`, set with the
  `notifySetup` request); never put it in the repo. Sending needs the script's
  external-request permission, which the owner grants by running
  `authorizeNotifications` once in the script editor.
- The day's menu lives in the sheet's "Menu" tab (Date, Meal, Dish name, Note),
  read live through the edit link. The plan page (site address + `#plan`) saves
  it through the same helper script, one group per meal in `CONFIG.MEALS`
  (Breakfast, Lunch, Dinner). The cook's page opens on "Today" when
  that day is planned and never opens on "Tomorrow" by itself.

## Everywhere

- Design guides live in `.claude/skills/` (apple-design, frontend-design,
  ui-ux-pro-max, ui-styling); read them before any visual change. These pages
  have no build step, so take the principles from ui-styling and ui-ux-pro-max,
  not their Tailwind/shadcn setup or search scripts.
- Look and feel: Apple-style, SaaS-quality. Grouped background with cards on
  soft shadows (no outlines), iOS segmented controls and filled tinted buttons,
  a frosted sticky bar, a fixed type scale with tighter tracking on large
  headings, sentence-case small labels (no tracked-out capitals), instant press
  feedback, and reduced-motion, reduced-transparency and higher-contrast
  variants. Icons are the inline line-icon set (`ICONS` / `iconSvg` in each
  page), never emoji.
- Colour: one named palette, Apple's system colours, defined at the top of each
  page's styles; never introduce a colour outside it. Light and dark values,
  following the phone's light/dark setting:
  Ink (background) #F2F2F7 / #000000, Graphite (cards) #FFFFFF / #1C1C1E,
  Slate (raised) #FFFFFF / #2C2C2E, Snow (text) #1C1C1E / #F5F5F7,
  Ash (secondary text) #6E6E73 / #98989D, Saffron #C93400 / #FF9F0A (recipes),
  Sky #007AFF / #0A84FF (to-dos, Home, links), Sun #B25000 / #FFD60A
  (breakfast), Leaf #248A3D / #30D158 (lunch, WhatsApp), Indigo #3634A3 /
  #5E5CE6 (dinner), Ember #D70015 / #FF453A (delete, errors). Each app takes
  one accent; meals keep their colour everywhere.
- After any change, also open `home/` and `todos/` at 390px width and confirm
  they load, their links work, and nothing scrolls sideways.
- Explain what you changed in plain language, without code terms.
