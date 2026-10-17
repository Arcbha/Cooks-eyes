/**
 * Voice notes helper for Mohna's Recipes.
 *
 * Two jobs, both saving voice notes into the Google Drive folder named below
 * and putting their links into the sheet's "Voice link" column:
 *
 * 1. The record page (recipe site address + "#record") sends recordings here.
 *    For that, this script is deployed as a web app; see README.md.
 *    The plan page (site address + "#plan") also saves the day's menu here,
 *    into the "Menu" tab of the sheet, and the add page (site address +
 *    "#add") adds new dishes to the dish list (YouTube or Instagram, with an
 *    optional photo saved to the "Recipe photos" folder).
 *    The Home Suite's to-do page (site address + "todos/") keeps its lists in a
 *    separate, private "Home Suite data" spreadsheet that this script creates
 *    in your Drive the first time it is used.
 * 2. The "Recipe page > Link voice notes" menu in the sheet links sound files
 *    you upload to the folder yourself, matched by file name (e.g. "Poha.m4a").
 *
 * Setup: deployed from this file (see CLAUDE.md, "Updating the helper script"),
 * with the owner's device key put in place of "change-me" below at that moment.
 */

// The owner's device key. Nobody types it: each of the owner's phones and laptops
// gets it once from a setup link (site address + "home/#setup=<key>") and keeps it.
// The real key is put in only when the script is deployed; it is never stored in
// the public code. Anything that changes data needs it; the cook's page does not.
var OWNER_KEY = "change-me";

var VOICE_FOLDER_NAME = "Recipe voice notes";
var PHOTO_FOLDER_NAME = "Recipe photos";

// Where a tapped "new to-do" alert opens.
var TODOS_PAGE_URL = "https://arcbha.github.io/Cooks-eyes/todos/";

// The tab that holds the day-by-day menu plan. Created on first save.
var MENU_SHEET_NAME = "Menu";

// The recipe sheet (the long code in its address, between /d/ and /edit).
var SHEET_ID = "1ouaN4vlpE2kqWeJvlirBZJocowH_5f32Dr0aJBDWrCQ";

var SOUND_ENDINGS = {
  "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/x-m4a": ".m4a",
  "audio/aac": ".aac", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav"
};

/* ---------------- menu in the sheet ---------------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Recipe page")
    .addItem("Link voice notes", "linkVoiceNotes")
    .addItem("Fill Instagram pictures", "fillReelPictures")
    .addToUi();
}

function linkVoiceNotes() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();
  var folder = voiceFolder();

  // Sound files in the folder, by dish name (file name without its ending, like ".m4a").
  var files = {};
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    files[clean(f.getName().replace(/\.[^.]+$/, ""))] = f;
  }

  var data = sheet.getDataRange().getValues();
  var cols = findColumns(data[0]);
  if (cols.name < 0) {
    ui.alert('Could not find the "Dish name" column in row 1 of this tab.');
    return;
  }
  var voiceCol = ensureVoiceColumn(sheet, data[0], cols);

  var linked = [], dishNames = {};
  for (var r = 1; r < data.length; r++) {
    var name = clean(data[r][cols.name]);
    if (!name) continue;
    dishNames[name] = true;
    if (!files[name]) continue;
    var current = voiceCol < data[r].length ? String(data[r][voiceCol]).trim() : "";
    if (current) continue;
    var file = files[name];
    sheet.getRange(r + 1, voiceCol + 1).setValue(file.getUrl());
    var shown = String(data[r][cols.name]).trim();
    if (linked.indexOf(shown) < 0) linked.push(shown);
  }

  var unmatched = Object.keys(files)
    .filter(function (k) { return !dishNames[k]; })
    .map(function (k) { return files[k].getName(); });

  var msg = linked.length
    ? "Linked voice notes for: " + linked.join(", ") + "."
    : "No new voice notes to link.";
  if (unmatched.length) {
    msg += "\n\nThese files do not match any dish name, so they were skipped:\n" + unmatched.join("\n") +
           "\n\nRename each file to match the dish name exactly as written in the sheet.";
  }
  msg += "\n\nThe page shows the changes within a few minutes.";
  ui.alert(msg);
}

/* ---------------- record page ---------------- */

// Every change is a POST carrying { key, action, ... }. The record page sends:
// { key, dish, mimeType, data (the recording, base64) }.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse(e.postData.contents);
    if (!OWNER_KEY || OWNER_KEY === "change-me") {
      return reply({ ok: false, needsSetup: true, error: "The helper script has no device key yet." });
    }
    if (String(req.key || "") !== OWNER_KEY) {
      return reply({ ok: false, needsSetup: true, error: "This device is not set up for changes. Open your Home Suite setup link on it once." });
    }
    if (req.action === "plan") {
      lock.waitLock(20000);
      return savePlan(req);
    }
    if (req.action === "addDish") {
      lock.waitLock(20000);
      return addDish(req);
    }
    if (req.action === "reelPicture") {
      var pic = reelPicture(req.link);
      return reply(pic ? { ok: true, mimeType: pic.mimeType, data: pic.data }
                       : { ok: false, error: "Could not get this reel's picture." });
    }
    if (/^push/.test(String(req.action || ""))) return pushAction(req);
    if (req.action === "lockDown") return lockDown();
    if (/^todo/.test(String(req.action || ""))) {
      lock.waitLock(20000);
      return todoAction(req);
    }

    var dish = String(req.dish || "").trim();
    if (!dish || !req.data) return reply({ ok: false, error: "Nothing to save." });

    lock.waitLock(20000);

    var sheet = dishSheet();
    if (!sheet) return reply({ ok: false, error: 'No tab with a "Dish name" column was found.' });
    var data = sheet.getDataRange().getValues();
    var cols = findColumns(data[0]);
    var rows = [];
    for (var r = 1; r < data.length; r++) {
      if (clean(data[r][cols.name]) === clean(dish)) rows.push(r);
    }
    if (!rows.length) return reply({ ok: false, error: 'No dish named "' + dish + '" in the sheet.' });
    var voiceCol = ensureVoiceColumn(sheet, data[0], cols);

    // Replace any earlier recording for this dish.
    var type = String(req.mimeType || "audio/webm").split(";")[0].trim().toLowerCase();
    var fileName = dish + (SOUND_ENDINGS[type] || "");
    var folder = voiceFolder();
    var old = folder.getFiles();
    while (old.hasNext()) {
      var o = old.next();
      if (clean(o.getName().replace(/\.[^.]+$/, "")) === clean(dish)) o.setTrashed(true);
    }

    // Kept private: the recipe page plays it through this script (doGet).
    var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(req.data), type, fileName));
    rows.forEach(function (row) { sheet.getRange(row + 1, voiceCol + 1).setValue(file.getUrl()); });
    SpreadsheetApp.flush();

    return reply({ ok: true, dish: dish, link: file.getUrl() });
  } catch (err) {
    return reply({ ok: false, error: String((err && err.message) || err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) { /* lock was never taken */ }
  }
}

/* ---------------- add page ---------------- */

// The add page sends: { key, action: "addDish", section, dish, youtube, replace,
// photo: { mimeType, data } (optional) }. "youtube" is the video link: YouTube or
// Instagram. Adds a row to the dish list. If that dish is already in that section,
// it asks first, and with replace: true swaps in the new link (and photo) instead.
// An Instagram link sent without a photo gets the reel's own picture.
function addDish(req) {
  var section = String(req.section || "").trim().slice(0, 60);
  var dish = String(req.dish || "").trim().slice(0, 120);
  var youtube = String(req.youtube || "").trim().slice(0, 500);
  if (!section) return reply({ ok: false, error: "Pick a section." });
  if (!dish) return reply({ ok: false, error: "Type the dish name." });
  if (!/^https?:\/\//i.test(youtube)) return reply({ ok: false, error: "Paste the video link." });

  var sheet = dishSheet();
  if (!sheet) return reply({ ok: false, error: 'No tab with a "Dish name" column was found.' });
  var data = sheet.getDataRange().getValues();
  var header = data[0];
  var cols = listColumns(header);
  if (cols.section < 0 || cols.link < 0) {
    return reply({ ok: false, error: "The dish list needs Section and YouTube link headings in row 1." });
  }
  if (!(req.photo && req.photo.data) && isInstagram(youtube)) req.photo = reelPicture(youtube);

  for (var r = 1; r < data.length; r++) {
    if (clean(data[r][cols.name]) === clean(dish) && clean(data[r][cols.section]) === clean(section)) {
      if (!req.replace) {
        return reply({ ok: false, exists: true,
          error: String(data[r][cols.name]).trim() + " is already in " + String(data[r][cols.section]).trim() +
                 ". Press Replace to use this link instead." });
      }
      sheet.getRange(r + 1, cols.link + 1).setValue(youtube);
      if (cols.show >= 0) sheet.getRange(r + 1, cols.show + 1).setValue("Y");
      var replacedPhoto = savePhoto(sheet, header, cols, r + 1, dish, req.photo);
      SpreadsheetApp.flush();
      return reply({ ok: true, dish: dish, section: section, replaced: true, image: replacedPhoto });
    }
  }

  var row = header.map(function () { return ""; });
  row[cols.section] = section;
  row[cols.name] = dish;
  row[cols.link] = youtube;
  if (cols.show >= 0) row[cols.show] = "Y";
  sheet.appendRow(row);
  var photo = savePhoto(sheet, header, cols, sheet.getLastRow(), dish, req.photo);
  SpreadsheetApp.flush();
  return reply({ ok: true, dish: dish, section: section, image: photo });
}

// Saves a dish photo (sent from the add page, already made small) into the photos
// folder, replacing an earlier one for the same dish, and puts its link in the row.
function savePhoto(sheet, header, cols, rowNumber, dish, photo) {
  if (!photo || !photo.data) return "";
  var type = String(photo.mimeType || "image/jpeg").split(";")[0].trim().toLowerCase();
  if (!/^image\/(jpeg|png|webp)$/.test(type)) return "";
  var folder = namedFolder(PHOTO_FOLDER_NAME);
  var old = folder.getFiles();
  while (old.hasNext()) {
    var o = old.next();
    if (clean(o.getName().replace(/\.[^.]+$/, "")) === clean(dish)) o.setTrashed(true);
  }
  var ending = type === "image/png" ? ".png" : type === "image/webp" ? ".webp" : ".jpg";
  // Kept private: the recipe page shows it through this script (doGet).
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(photo.data), type, dish + ending));
  var col = cols.image;
  if (col < 0) {
    col = sheet.getLastColumn();
    sheet.getRange(1, col + 1).setValue("Image link");
  }
  sheet.getRange(rowNumber, col + 1).setValue(file.getUrl());
  return file.getUrl();
}

// Columns of the dish list, found by their headings like the recipe page does.
function listColumns(header) {
  var cols = { section: -1, name: -1, link: -1, show: -1, image: -1 };
  header.forEach(function (h, i) {
    h = String(h).toLowerCase();
    if (/image|photo|picture/.test(h)) { if (cols.image < 0) cols.image = i; return; }
    if (/voice|audio|sound|instruction/.test(h)) return;
    if (cols.show < 0 && /show|visible|active/.test(h)) cols.show = i;
    else if (cols.section < 0 && /section|category|meal/.test(h)) cols.section = i;
    else if (cols.link < 0 && /youtube|video|link|url/.test(h)) cols.link = i;
    else if (cols.name < 0 && /dish|name|item|recipe/.test(h)) cols.name = i;
  });
  return cols;
}

/* ---------------- Home Suite: to-dos ---------------- */

// To-dos live in their own spreadsheet, not the recipe sheet: the recipe sheet is
// readable by anyone with its link (the cook's page needs that), this one is not.
var SUITE_FILE_NAME = "Home Suite data";
var TODO_SHEET_NAME = "Todos";
var TODO_HEADERS = ["ID", "List", "Task", "Done", "Added", "Done at"];
// Lists made with the + button, and the text of note pages.
var LIST_SHEET_NAME = "Lists";
var LIST_HEADERS = ["Name", "Type", "Icon", "Text", "Updated"];

// The to-do page sends { key, action, ... } with action one of:
//   "todos" (just read), "todoAdd" { id, list, task }, "todoSet" { id, done },
//   "todoDelete" { id }, "todoClearDone" { list },
//   "todoListAdd" { name, type: "check" or "note", icon },
//   "todoListDelete" { name } (the list and everything in it),
//   "todoNoteSave" { name, text }.
// Every answer carries all items and lists, so the page always ends up in step.
function todoAction(req) {
  var sheet = suiteSheet(TODO_SHEET_NAME, TODO_HEADERS);
  var lists = suiteSheet(LIST_SHEET_NAME, LIST_HEADERS);
  var action = req.action;
  var name = String(req.name || "").trim().slice(0, 40);

  if (action === "todoAdd") {
    var task = String(req.task || "").trim().slice(0, 200);
    var list = String(req.list || "").trim().slice(0, 40);
    if (!task) return reply({ ok: false, error: "Type something to add." });
    if (!list) return reply({ ok: false, error: "Pick a list." });
    // The page makes the id, so an item can be ticked before this answer arrives.
    var id = /^[\w-]{6,40}$/.test(String(req.id || "")) ? String(req.id) : Utilities.getUuid().slice(0, 8);
    if (!todoRow(sheet, id)) {
      sheet.appendRow([id, list, task, "", new Date(), ""]);
      pushAll(null, String(req.from || ""));   // ring the owner's other phones
    }
  } else if (action === "todoSet" || action === "todoDelete") {
    var row = todoRow(sheet, req.id);
    if (row) {
      if (action === "todoDelete") sheet.deleteRow(row);
      else {
        sheet.getRange(row, 4).setValue(req.done ? "Y" : "");          // Done
        sheet.getRange(row, 6).setValue(req.done ? new Date() : "");   // Done at
      }
    }
  } else if (action === "todoClearDone") {
    var last = sheet.getLastRow();
    if (last > 1) {
      var vals = sheet.getRange(2, 1, last - 1, 4).getValues();
      for (var i = vals.length - 1; i >= 0; i--) {
        var inList = !req.list || String(vals[i][1]) === String(req.list);
        if (inList && isDone(vals[i][3])) sheet.deleteRow(i + 2);
      }
    }
  } else if (action === "todoListAdd") {
    if (!name) return reply({ ok: false, error: "Type a name for the list." });
    if (!listRow(lists, name)) {
      lists.appendRow([name, req.type === "note" ? "note" : "check", String(req.icon || "").slice(0, 8), "", new Date()]);
    }
  } else if (action === "todoListDelete") {
    var lr = listRow(lists, name);
    if (lr) lists.deleteRow(lr);
    var lastItem = sheet.getLastRow();
    if (name && lastItem > 1) {
      var listCol = sheet.getRange(2, 2, lastItem - 1, 1).getValues();
      for (var k = listCol.length - 1; k >= 0; k--) if (String(listCol[k][0]) === name) sheet.deleteRow(k + 2);
    }
  } else if (action === "todoNoteSave") {
    if (!name) return reply({ ok: false, error: "No note picked." });
    var text = String(req.text || "").slice(0, 40000);
    var nr = listRow(lists, name);
    if (!nr) {
      lists.appendRow([name, "note", String(req.icon || "").slice(0, 8), "", new Date()]);
      nr = lists.getLastRow();
    }
    lists.getRange(nr, 4).setNumberFormat("@");   // keep the note exactly as typed
    lists.getRange(nr, 4).setValue(text);
    lists.getRange(nr, 5).setValue(new Date());
  } else if (action !== "todos") {
    return reply({ ok: false, error: "Unknown request." });
  }
  SpreadsheetApp.flush();
  return reply({ ok: true, items: readTodos(sheet), lists: readLists(lists), push: pushInfo() });
}

/* ---------------- phone alerts (web push) ---------------- */

// What a page needs to turn alerts on: the public half of the signing key.
function pushInfo() {
  var pub = PropertiesService.getScriptProperties().getProperty("VAPID_PUBLIC");
  return pub ? { key: pub } : null;
}

// { key, action: "pushSubscribe" | "pushUnsubscribe" | "pushTest", endpoint }
// { key, action: "pushNews", since }   what is new since the phone last looked
// { key, action: "pushSetup", vapidPublic, vapidPrivate }   once, by the owner
function pushAction(req) {
  var props = PropertiesService.getScriptProperties();
  var endpoint = String(req.endpoint || "");
  if (req.action === "pushSetup") {
    if (!/^[\w-]{86,88}$/.test(String(req.vapidPublic || "")) || !/^[\w-]{42,44}$/.test(String(req.vapidPrivate || ""))) {
      return reply({ ok: false, error: "Those are not signing keys." });
    }
    props.setProperty("VAPID_PUBLIC", req.vapidPublic);
    props.setProperty("VAPID_PRIVATE", req.vapidPrivate);
    return reply({ ok: true });
  }
  if (req.action === "pushNews") {
    var since = Number(req.since) || 0, now = Date.now();
    var items = readTodos(suiteSheet(TODO_SHEET_NAME, TODO_HEADERS)).filter(function (it) {
      return !it.done && it.added > since;
    }).slice(-5);
    var test = Number(props.getProperty("PUSH_TEST_AT") || 0) > since;
    return reply({ ok: true, now: now, test: test, items: items });
  }
  if (!/^https:\/\/[\w.-]+\//.test(endpoint) || endpoint.length > 1000) return reply({ ok: false, error: "No alert address." });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (req.action === "pushSubscribe") {
      var subs = readSubs().filter(function (s) { return s.endpoint !== endpoint; });
      subs.push({ endpoint: endpoint, at: Date.now() });
      props.setProperty("PUSH_SUBS", JSON.stringify(subs.slice(-20)));
      return reply({ ok: true });
    }
    if (req.action === "pushUnsubscribe") { removeSub(endpoint); return reply({ ok: true }); }
    if (req.action === "pushTest") {
      props.setProperty("PUSH_TEST_AT", String(Date.now()));
      var codes = pushAll(endpoint);
      return reply({ ok: codes.length > 0 && codes.every(function (c) { return c >= 200 && c < 300; }), sent: codes,
                     error: codes.length ? "" : "This device has not turned alerts on yet." });
    }
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: false, error: "Unknown request." });
}

function readSubs() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("PUSH_SUBS") || "[]"); } catch (e) { return []; }
}
function removeSub(endpoint) {
  var subs = readSubs().filter(function (s) { return s.endpoint !== endpoint; });
  PropertiesService.getScriptProperties().setProperty("PUSH_SUBS", JSON.stringify(subs));
}

function listRow(sheet, name) {
  var last = sheet.getLastRow();
  if (!name || last < 2) return 0;
  var names = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < names.length; i++) if (String(names[i][0]).trim() === name) return i + 2;
  return 0;
}

function readLists(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 5).getValues()
    .filter(function (v) { return String(v[0]).trim(); })
    .map(function (v) {
      return {
        name: String(v[0]).trim(), type: String(v[1]) === "note" ? "note" : "check", icon: String(v[2] || ""),
        text: String(v[3] || ""), updated: isDate(v[4]) ? v[4].getTime() : 0
      };
    });
}

/* ---------------- Instagram pictures ---------------- */

function isInstagram(link) { return /(?:instagram\.com|instagr\.am)\//i.test(String(link || "")); }

// Sheet menu: gives every Instagram dish without a picture the reel's own picture.
function fillReelPictures() {
  var sheet = dishSheet();
  var data = sheet.getDataRange().getValues();
  var header = data[0];
  var cols = listColumns(header);
  var done = 0, failed = [];
  for (var r = 1; r < data.length; r++) {
    var link = String(data[r][cols.link] || "");
    if (!isInstagram(link) || (cols.image >= 0 && String(data[r][cols.image] || "").trim())) continue;
    var pic = reelPicture(link);
    if (pic && savePhoto(sheet, header, cols, r + 1, String(data[r][cols.name]).trim(), pic)) {
      done++;
      cols = listColumns(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
    } else failed.push(String(data[r][cols.name]).trim());
  }
  var text = done + " picture(s) added." + (failed.length ? " Could not get: " + failed.join(", ") : "");
  try { SpreadsheetApp.getUi().alert(text); } catch (e) { /* run from the editor */ }
  return text;
}

/* ---------------- reaching other websites ---------------- */

// <external>
// The cover picture of a public Instagram reel or post, taken from Instagram's own
// embed page (no login needed), about 720px wide. Returns { mimeType, data } or null.
function reelPicture(link) {
  var m = String(link || "").match(/(?:instagram\.com|instagr\.am)\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/i);
  if (!m) return null;
  try {
    var page = UrlFetchApp.fetch("https://www.instagram.com/p/" + m[1] + "/embed/captioned/", { muteHttpExceptions: true });
    if (page.getResponseCode() !== 200) return null;
    var tag = (page.getContentText().match(/<img[^>]*class="EmbeddedMediaImage"[^>]*>/) || [])[0];
    if (!tag) return null;
    var unescape = function (u) { return u.replace(/&amp;/g, "&"); };
    var src = unescape((tag.match(/\ssrc="([^"]+)"/) || [])[1] || "");
    var best = 0;
    ((tag.match(/srcset="([^"]+)"/) || [])[1] || "").split(",").forEach(function (part) {
      var bits = part.trim().split(/\s+/), w = parseInt(bits[1], 10);
      if (bits[0] && w >= 640 && (!best || w < best)) { best = w; src = unescape(bits[0]); }
    });
    if (!/^https:\/\/[\w.-]+\.(cdninstagram\.com|fbcdn\.net)\//.test(src)) return null;
    var img = UrlFetchApp.fetch(src, { muteHttpExceptions: true });
    if (img.getResponseCode() !== 200) return null;
    var type = String(img.getHeaders()["Content-Type"] || "image/jpeg").split(";")[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return null;
    return { mimeType: type, data: Utilities.base64Encode(img.getContent()) };
  } catch (e) {
    return null;
  }
}

// New to-dos ring the owner's phones as "Home Suite" (standard web push, the same
// thing apps installed from a website use). Each phone turns alerts on once from
// the Home page; this script then sends an empty "wake up" push to each of them,
// and the phone asks this script what is new (pushNews) and shows it.
// The signing key (VAPID) is kept in this script's settings, never in the code.
function pushAll(onlyEndpoint, skipEndpoint) {
  var props = PropertiesService.getScriptProperties();
  var pub = props.getProperty("VAPID_PUBLIC"), priv = props.getProperty("VAPID_PRIVATE");
  if (!pub || !priv) return [];
  var subs = readSubs().filter(function (s) {
    return onlyEndpoint ? s.endpoint === onlyEndpoint : s.endpoint !== skipEndpoint;
  });
  if (!subs.length) return [];
  var requests = subs.map(function (s) {
    return {
      url: s.endpoint, method: "post", muteHttpExceptions: true,
      headers: { Authorization: "vapid t=" + vapidJwt(s.endpoint, priv) + ", k=" + pub, TTL: "86400", Urgency: "high" },
      contentType: "application/octet-stream", payload: ""
    };
  });
  var codes = [];
  try {
    UrlFetchApp.fetchAll(requests).forEach(function (res, i) {
      var code = res.getResponseCode();
      codes.push(code);
      if (code === 404 || code === 410) removeSub(subs[i].endpoint);   // that phone turned alerts off
    });
  } catch (e) { codes.push(String(e.message || e)); }
  return codes;
}

// A signed pass for one push service (JWT, ES256), reused for up to 11 hours.
function vapidJwt(endpoint, privateKey) {
  var aud = (String(endpoint).match(/^https:\/\/[^\/]+/) || [""])[0];
  var cache = CacheService.getScriptCache(), name = "vapid-" + Utilities.base64EncodeWebSafe(aud).slice(0, 200);
  var saved = cache.get(name);
  if (saved) return saved;
  var b64 = function (bytes) { return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, ""); };
  var text = function (s) { return b64(Utilities.newBlob(s).getBytes()); };
  var input = text(JSON.stringify({ typ: "JWT", alg: "ES256" })) + "." +
              text(JSON.stringify({ aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://arcbha.github.io/Cooks-eyes/" }));
  var jwt = input + "." + b64(es256Sign(input, Utilities.base64DecodeWebSafe(padB64(privateKey))));
  cache.put(name, jwt, 11 * 3600);
  return jwt;
}

function padB64(s) { s = String(s); return s + "====".slice((s.length % 4) || 4); }

// ECDSA P-256 with SHA-256 (RFC 6979 deterministic nonce), using BigInt.
var EC_P = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff");
var EC_N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
var EC_G = [BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296"),
            BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"), BigInt(1)];

function es256Sign(message, privateBytes) {
  var d = bytesToBig(privateBytes);
  var h = bytesToBig(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, message, Utilities.Charset.UTF_8)) % EC_N;
  var k = rfc6979(d, h);
  var R = ecAffine(ecMul(k, EC_G));
  var r = R[0] % EC_N;
  var s = (ecInv(k, EC_N) * ((h + r * d) % EC_N)) % EC_N;
  return bigToBytes(r, 32).concat(bigToBytes(s, 32));
}

function rfc6979(d, h) {
  var hmac = function (key, data) { return Utilities.computeHmacSha256Signature(signed(data), signed(key)).map(function (b) { return b & 255; }); };
  var x = bigToBytes(d, 32), m = bigToBytes(h, 32);
  var V = [], K = [];
  for (var i = 0; i < 32; i++) { V.push(1); K.push(0); }
  K = hmac(K, V.concat([0], x, m)); V = hmac(K, V);
  K = hmac(K, V.concat([1], x, m)); V = hmac(K, V);
  for (;;) {
    V = hmac(K, V);
    var k = bytesToBig(V);
    if (k > BigInt(0) && k < EC_N) return k;
    K = hmac(K, V.concat([0])); V = hmac(K, V);
  }
}

function signed(bytes) { return bytes.map(function (b) { b = b & 255; return b > 127 ? b - 256 : b; }); }
function bytesToBig(bytes) {
  var hex = "0x0";
  for (var i = 0; i < bytes.length; i++) hex += ("0" + (bytes[i] & 255).toString(16)).slice(-2);
  return BigInt(hex);
}
function bigToBytes(n, len) {
  var hex = n.toString(16);
  while (hex.length < len * 2) hex = "0" + hex;
  var out = [];
  for (var i = 0; i < len; i++) out.push(parseInt(hex.substr(i * 2, 2), 16));
  return out;
}
function ecMod(a, m) { var r = a % m; return r < BigInt(0) ? r + m : r; }
function ecInv(a, m) {
  var lm = BigInt(1), hm = BigInt(0), low = ecMod(a, m), high = m;
  while (low > BigInt(1)) {
    var q = high / low, nm = hm - lm * q, nw = high - low * q;
    hm = lm; high = low; lm = nm; low = nw;
  }
  return ecMod(lm, m);
}
// Points in Jacobian form [X, Y, Z]; null is the point at infinity.
function ecDouble(P) {
  if (!P || P[1] === BigInt(0)) return null;
  var p = EC_P, X = P[0], Y = P[1], Z = P[2];
  var delta = Z * Z % p, gamma = Y * Y % p, beta = X * gamma % p;
  var alpha = BigInt(3) * ecMod(X - delta, p) % p * ((X + delta) % p) % p;
  var X3 = ecMod(alpha * alpha - BigInt(8) * beta, p);
  var Z3 = ecMod((Y + Z) * (Y + Z) - gamma - delta, p);
  var Y3 = ecMod(alpha * ecMod(BigInt(4) * beta - X3, p) - BigInt(8) * (gamma * gamma % p), p);
  return [X3, Y3, Z3];
}
function ecAdd(P, Q) {
  if (!P) return Q;
  if (!Q) return P;
  var p = EC_P;
  var Z1Z1 = P[2] * P[2] % p, Z2Z2 = Q[2] * Q[2] % p;
  var U1 = P[0] * Z2Z2 % p, U2 = Q[0] * Z1Z1 % p;
  var S1 = P[1] * Q[2] % p * Z2Z2 % p, S2 = Q[1] * P[2] % p * Z1Z1 % p;
  var H = ecMod(U2 - U1, p), r = ecMod(BigInt(2) * (S2 - S1), p);
  if (H === BigInt(0)) return r === BigInt(0) ? ecDouble(P) : null;
  var I = BigInt(4) * H * H % p, J = H * I % p, V = U1 * I % p;
  var X3 = ecMod(r * r - J - BigInt(2) * V, p);
  var Y3 = ecMod(r * ecMod(V - X3, p) - BigInt(2) * S1 * J, p);
  var Z3 = ecMod(((P[2] + Q[2]) * (P[2] + Q[2]) - Z1Z1 - Z2Z2) % p * H, p);
  return [X3, Y3, Z3];
}
function ecMul(k, P) {
  var R = null, bits = k.toString(2);
  for (var i = 0; i < bits.length; i++) {
    R = ecDouble(R);
    if (bits[i] === "1") R = ecAdd(R, P);
  }
  return R;
}
function ecAffine(P) {
  var zi = ecInv(P[2], EC_P), zi2 = zi * zi % EC_P;
  return [P[0] * zi2 % EC_P, P[1] * zi2 % EC_P * zi % EC_P];
}

// Run this once from the script editor (Run button) to let the script reach other
// websites (Instagram pictures, phone alerts).
function authorizeNotifications() {
  UrlFetchApp.fetch("https://www.google.com/generate_204");
}

// Turns off "Publish to web" for the recipe sheet (part of lockDown).
function unpublishSheet() {
  try {
    var api = "https://www.googleapis.com/drive/v3/files/" + SHEET_ID + "/revisions";
    var auth = { Authorization: "Bearer " + ScriptApp.getOAuthToken() };
    var list = JSON.parse(UrlFetchApp.fetch(api + "?fields=revisions(id,published)", { headers: auth }).getContentText());
    var n = 0;
    (list.revisions || []).forEach(function (r) {
      if (!r.published) return;
      UrlFetchApp.fetch(api + "/" + r.id, {
        method: "patch", contentType: "application/json", headers: auth,
        payload: JSON.stringify({ published: false, publishAuto: false }), muteHttpExceptions: true
      });
      n++;
    });
    return "publish to web: " + (n ? "turned off" : "was already off");
  } catch (e) {
    return "publish to web: could not change it here (" + e.message + ")";
  }
}
// </external>

/* ---------------- plan page ---------------- */

// The plan page sends: { key, action: "plan", date: "2026-10-10",
// items: [{ meal, dish }], note }. Replaces that date's plan in the Menu tab.
function savePlan(req) {
  var date = String(req.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply({ ok: false, error: "Pick a date first." });

  var items = (req.items || []).filter(function (it) {
    return it && String(it.dish || "").trim();
  }).slice(0, 60);
  var note = String(req.note || "").trim().slice(0, 1000);

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(MENU_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(MENU_SHEET_NAME);
    sheet.getRange(1, 1, 1, 4).setValues([["Date", "Meal", "Dish name", "Note"]]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  // Keep every other day's rows, then add this day's.
  var last = sheet.getLastRow();
  var kept = [];
  if (last > 1) {
    sheet.getRange(2, 1, last - 1, 4).getValues().forEach(function (row) {
      var d = planDate(row[0]);
      if (d && d !== date) kept.push([d, row[1], row[2], row[3]]);
    });
  }
  var rows = items.map(function (it, i) {
    return [date, String(it.meal || "").trim(), String(it.dish).trim(), i === 0 ? note : ""];
  });
  if (!rows.length && note) rows.push([date, "", "", note]);

  var all = kept.concat(rows).sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  if (last > 1) sheet.getRange(2, 1, last - 1, 4).clearContent();
  if (all.length) {
    var range = sheet.getRange(2, 1, all.length, 4);
    range.setNumberFormat("@");   // keep dates as typed text, e.g. 2026-10-10
    range.setValues(all);
  }
  SpreadsheetApp.flush();
  return reply({ ok: true, date: date, dishes: rows.length && rows[0][2] ? rows.length : 0 });
}

// A date cell as "yyyy-mm-dd", whether it holds text or a real date.
function planDate(v) {
  if (isDate(v)) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var s = String(v || "").trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);   // day first, as written in India
  if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  return s;
}

// Reading, for the recipe page and Home (no key needed: it is what the cook's page shows):
//   ?recipes=1      the dish list and the Menu tab, as CSV text, so the sheet itself
//                   can stay private
//   ?voice=<id>     a voice note from the voice notes folder
//   ?photo=<id>     a dish photo from the photos folder
// Only files inside those two folders are ever handed out.
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.recipes) return reply({ ok: true, dishes: dishesCsv(), menu: menuCsv() });
    var id = p.voice || p.photo;
    if (!id) return reply({ ok: true, message: "Voice note helper is running." });
    var file = DriveApp.getFileById(id);
    var folderName = p.voice ? VOICE_FOLDER_NAME : PHOTO_FOLDER_NAME;
    if (!inFolder(file, folderName)) {
      return reply({ ok: false, error: 'This file is not in the "' + folderName + '" folder.' });
    }
    var blob = file.getBlob();
    return reply({ ok: true, mimeType: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) });
  } catch (err) {
    return reply({ ok: false, error: p.recipes ? "Could not read the recipe sheet." : "File not found." });
  }
}

function dishesCsv() {
  var sheet = dishSheet();
  return sheet ? toCsv(sheet.getDataRange().getDisplayValues()) : "";
}

function menuCsv() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(MENU_SHEET_NAME);
  if (!sheet) return "";
  return toCsv(sheet.getDataRange().getValues().map(function (row, i) {
    return i === 0 ? row : [planDate(row[0])].concat(row.slice(1));
  }));
}

function toCsv(rows) {
  return rows.map(function (row) {
    return row.map(function (v) { return '"' + String(v === null || v === undefined ? "" : v).replace(/"/g, '""') + '"'; }).join(",");
  }).join("\n");
}

function inFolder(file, folderName) {
  var folderId = namedFolder(folderName).getId();
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return true;
  }
  return false;
}

// One-time privacy switch (POST { key, action: "lockDown" }): the recipe sheet and
// every voice note and photo stop being readable by link. The pages keep working,
// because they read everything through this script.
function lockDown() {
  var done = [];
  DriveApp.getFileById(SHEET_ID).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  done.push("recipe sheet: link sharing off");
  [VOICE_FOLDER_NAME, PHOTO_FOLDER_NAME].forEach(function (name) {
    var folder = namedFolder(name), n = 0;
    folder.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
    var files = folder.getFiles();
    while (files.hasNext()) { files.next().setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); n++; }
    done.push(name + ": " + n + " file(s) made private");
  });
  done.push(unpublishSheet());
  return reply({ ok: true, done: done });
}

function inVoiceFolder(file) {
  return inFolder(file, VOICE_FOLDER_NAME);
}

function todoRow(sheet, id) {
  id = String(id || "");
  var last = sheet.getLastRow();
  if (!id || last < 2) return 0;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function readTodos(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 6).getValues()
    .filter(function (v) { return String(v[0]) && String(v[2]).trim(); })
    .map(function (v) {
      return {
        id: String(v[0]), list: String(v[1]), task: String(v[2]), done: isDone(v[3]),
        added: isDate(v[4]) ? v[4].getTime() : 0,
        doneAt: isDate(v[5]) ? v[5].getTime() : 0
      };
    });
}

function isDate(v) { return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v.getTime()); }

function isDone(v) { return /^(y|yes|done|true|1|x)$/i.test(String(v).trim()) || v === true; }

// A tab in the private Home Suite spreadsheet, created (with headings) when first needed.
function suiteSheet(name, headers) {
  var props = PropertiesService.getScriptProperties();
  var ss = null, id = props.getProperty("SUITE_SHEET_ID");
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  var sheet;
  if (!ss) {
    ss = SpreadsheetApp.create(SUITE_FILE_NAME);
    props.setProperty("SUITE_SHEET_ID", ss.getId());
    sheet = ss.getSheets()[0];
    sheet.setName(name);
  } else {
    sheet = ss.getSheetByName(name);
    if (sheet) return sheet;
    sheet = ss.insertSheet(name);
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

/* ---------------- shared bits ---------------- */

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function voiceFolder() {
  return namedFolder(VOICE_FOLDER_NAME);
}

function namedFolder(name) {
  var folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

// The first tab whose row 1 has a dish name column.
function dishSheet() {
  var sheets = SpreadsheetApp.openById(SHEET_ID).getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === MENU_SHEET_NAME) continue;
    var header = sheets[i].getRange(1, 1, 1, Math.max(1, sheets[i].getLastColumn())).getValues()[0];
    if (findColumns(header).name >= 0) return sheets[i];
  }
  return null;
}

function findColumns(header) {
  var cols = { name: -1, voice: -1 };
  header.forEach(function (h, i) {
    h = String(h).toLowerCase();
    if (cols.voice < 0 && /voice|audio|sound|instruction/.test(h)) cols.voice = i;
    else if (cols.name < 0 && /dish|name|item|recipe/.test(h) && !/image|photo|link/.test(h)) cols.name = i;
  });
  return cols;
}

function ensureVoiceColumn(sheet, header, cols) {
  if (cols.voice >= 0) return cols.voice;
  var col = header.length;
  sheet.getRange(1, col + 1).setValue("Voice link");
  cols.voice = col;
  return col;
}

function clean(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, " ");
}
