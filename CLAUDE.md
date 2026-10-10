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
  into the sheet; it links Drive voice notes to dishes by file name.
- Explain what you changed in plain language, without code terms.
