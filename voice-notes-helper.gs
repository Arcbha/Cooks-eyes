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

// Notifications for new to-dos go through ntfy (free app for Android and iPhone).
// The private channel name is kept in this script's settings, not in this file:
// it is set once from a phone with the "notifySetup" request (see README.md).
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
    if (req.action === "notifySetup") return notifySetup(req);
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
      notifyNewTodo(list, task);
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
  return reply({ ok: true, items: readTodos(sheet), lists: readLists(lists) });
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

/* ---------------- notifications (ntfy) ---------------- */

// <external>
// Sends "New in Things to order: Milk" to every phone subscribed to the channel.
// A failed notification never stops the to-do from being saved.
function notifyNewTodo(list, task) {
  var topic = PropertiesService.getScriptProperties().getProperty("NTFY_TOPIC");
  if (!topic) return;
  var tags = { "things to order": "shopping_cart", "home chores": "broom" }[list.toLowerCase()] || "pushpin";
  try {
    UrlFetchApp.fetch("https://ntfy.sh", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ topic: topic, title: "New in " + list, message: task, tags: [tags], click: TODOS_PAGE_URL }),
      muteHttpExceptions: true
    });
  } catch (e) { /* no notification this time */ }
}

// { key, action: "notifySetup", topic, test } sets the private channel name
// (letters, numbers, - and _; at least 12) and can send a test notification.
function notifySetup(req) {
  var topic = String(req.topic || "").trim();
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(topic)) return reply({ ok: false, error: "Channel name must be 12-64 letters, numbers, - or _." });
  PropertiesService.getScriptProperties().setProperty("NTFY_TOPIC", topic);
  if (req.test) notifyNewTodo("Home To-dos", "Notifications are on. New to-dos will show up here.");
  return reply({ ok: true });
}

// Run this once from the script editor (Run button) to give the script
// permission to send notifications.
function authorizeNotifications() {
  UrlFetchApp.fetch("https://ntfy.sh/v1/health");
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
