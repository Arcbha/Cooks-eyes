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
  app address). There is no passcode. Every sheet and Drive file is private
  (not shared by link, not published to the web); pages read the dish list,
  menu, voice notes and photos only through the helper. Reading recipes is
  open (the cook needs it); every change and every to-do read needs the
  owner's **device key**, saved on each of the owner's devices by opening the
  setup link (`home/#setup=<key>`) once, under the browser storage key
  `home-suite-device-key-v1`. The cook's phone never gets the key. The key,
  the setup link and the alert signing key must never be committed (the repo is
  public, which free GitHub Pages needs).

## Updating the helper script (no copy-paste needed)

The live script can be updated from a Claude session with Google's `clasp` tool
(`npx @google/clasp@3`). The owner has turned on the Apps Script API.

- Script ID: `1K7XY80-C55UQflxq4oBOplpjFAq2yUYtpbwHHyFHCULuU0lyq0GAd43u`
- Live deployment (the web app address in every page's config):
  `AKfycbzKgqTVNnPieihSyylKKASbCG3afc_VKvxpC01BBxL57A8YLPGeYSRl2l5z2PExViO5`

Sign-in: if the environment variable `CLASPRC_JSON` is set (the owner stored the
saved clasp sign-in in the Claude environment's settings, base64-encoded),
decode it into `~/.clasprc.json` and skip logging in; the device key is in `HOME_SUITE_DEVICE_KEY`
when set (it can also be read from the live `Code.js` after `clasp clone`). Never print either value or put them in the repo. Only if they are
missing or rejected: `clasp login --no-localhost` (the owner opens the link,
approves, and pastes back the `http://localhost:8888/?...` address).

Steps: `clasp clone <script id>`
into a scratch folder, compare the live `Code.js` with `voice-notes-helper.gs`,
copy the new file in with the device key put in place of `change-me` (never
commit it). Until the owner has run `authorizeNotifications` in the editor,
push a build without the parts between `// <external>` and `// </external>`
(they need a permission the live script does not have yet, and would break it), keep the downloaded `appsscript.json` as it is,
`clasp push --force`, then `clasp update-deployment <deployment id> -d "<what
changed>"` so the address stays the same. Test the live address afterwards and
remove any test data. Keep the sign-in out of the repo; it lasts only for the
session.

## Mohna's Recipes

- The recipe page is for a household cook. It is one file, `index.html`,
  with all HTML, CSS and JavaScript inside it.
- The dish list comes from the private recipe Google Sheet, read through the
  helper (`?recipes=1`). Columns: Section,
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
  Instagram link gets the reel's own picture automatically (the helper reads it
  from Instagram's public embed page: `reelPicture`; sheet menu "Fill Instagram
  pictures" does the same for older rows); an
  existing dish in that section only has its video link replaced on a second tap.
  Under the form, "Remove a dish" lists every dish with a bin: first tap asks
  (Remove / Keep), then the helper's `removeDish` deletes the row and returns it
  so "Undo" can put it back in place (`restoreDish`). Voice notes and photos stay
  in Drive. Home's recipe tile links here as "Add / remove".
- Every page reads the helper's answers with `readJson`: anything that is not
  JSON (an office network or security program answering instead of Google, or a
  rare Google hiccup) becomes a plain explanation instead of a raw error, and
  reads (`getJson`) are retried twice; changes are sent once. A read whose
  connection is stopped while online counts as blocked too. The message ends with
  "Details:" (status, answering address, page title) so a photo shows the cause.
  Work laptops can block Google's script service even on home Wi-Fi; a personal
  browser profile, another browser, or a phone avoids it.
- New to-dos send phone alerts as **Home Suite** itself (standard web push; no
  ntfy). Each phone turns them on from the "To-do alerts" card on Home (iPhone:
  add Home Suite to the home screen first). `manifest.webmanifest`, `sw.js` and
  `icons/` at the site root make Home Suite installable; only Home and To-dos
  link them, never the cook's page. On a new to-do the helper sends an empty push
  (signed with its VAPID key, ES256 in the script) to every saved phone except the
  one that added it (`from`); `sw.js` then asks the helper `pushNews` and shows
  "New in <list>: <task>". Keys and phone addresses live in Script Properties
  (`VAPID_PUBLIC`, `VAPID_PRIVATE`, `PUSH_SUBS`), never in the repo.
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
  Ash (secondary text) #6E6E73 / #98989D, Marigold (recipes, filled buttons and
  tabs; the owner's chosen yellow-orange) gradient #E9C35A > #E0A346 > #D47639
  with #21201C text, marigold text #A5541B / #ECB95A,
  Sky #007AFF / #0A84FF (to-dos, Home, links), Sun #B25000 / #FFD60A
  (breakfast), Leaf #248A3D / #30D158 (lunch, WhatsApp), Indigo #3634A3 /
  #5E5CE6 (dinner), Ember (record, delete, errors; Radix red) fill #E5484D, text #CE2C31 / #FF9592. Each app takes
  one accent; meals keep their colour everywhere.
- The cat is the owner's own cat: ginger tabby with a white chest, muzzle and
  paws, pink nose and ears, yellow collar (#E9C35A) and a red-and-white Poke Ball
  bell (Ginger #E0954A, stripes #B9652C). Every page has the same animated cat in
  the title row (one SVG with sit, stand and lie poses; `catLife` script): about 25
  actions (gaze, blink, lick, wash, scratch, yawn, meow, swish, knead, purr, look
  back, stand, sniff, stretch, arch, crouch, pounce, hop, turn, walk, trot,
  zoomies, loaf, sleep, dream, purr lying), each a random length, the next a
  weighted random pick; first visits start at a random spot and action. The
  cat's state is kept in browser storage (`home-suite-cat-v1`) so the next page
  carries on, and a cross-page view transition keeps the cat in place. All pages
  share one header layout (32px top line, then a 56px title row), and the cat's
  strip is pinned to the same spot of the screen on every page, not placed after
  the title, so it never shifts or resizes between pages. Only
  transforms and opacity move; it sits still for reduced motion.
- Font: SF Pro (owner has Apple's permission), shipped as one small variable
  web font, `fonts/sf-pro.woff2` (Latin only, weights 400-800), the one shared
  file outside the pages. Other scripts such as Hindi fall back to system fonts.
- After any change, also open `home/` and `todos/` at 390px width and confirm
  they load, their links work, and nothing scrolls sideways.
- Explain what you changed in plain language, without code terms.
