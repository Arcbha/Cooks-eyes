# Project rules

- This is a recipe page for a household cook. It is one file, `index.html`,
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
- The add page (site address + `#add`) adds a dish (YouTube link, name,
  section) as a new row of the dish list through the same helper script; an
  existing dish in that section only has its video link replaced on a second tap.
- The day's menu lives in the sheet's "Menu" tab (Date, Meal, Dish name, Note),
  read live through the edit link. The plan page (site address + `#plan`) saves
  it through the same helper script, one group per meal in `CONFIG.MEALS`
  (Breakfast, Lunch, Dinner). The cook's page opens on "Today" when
  that day is planned and never opens on "Tomorrow" by itself.
- Explain what you changed in plain language, without code terms.
