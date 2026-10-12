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
 *    "#add") adds new dishes to the dish list.
 *    The Home Suite's to-do page (site address + "todos/") keeps its lists in a
 *    separate, private "Home Suite data" spreadsheet that this script creates
 *    in your Drive the first time it is used.
 * 2. The "Recipe page > Link voice notes" menu in the sheet links sound files
 *    you upload to the folder yourself, matched by file name (e.g. "Poha.m4a").
 *
 * Setup: in the sheet, Extensions > Apps Script, paste this whole file in place
 * of what is there, change the passcode below, click Save. See README.md.
 */

// The passcode typed on the record page. Change it to something only you know.
var RECORDER_PASSCODE = "change-me";

var VOICE_FOLDER_NAME = "Recipe voice notes";

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
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
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

// The record page sends: { passcode, dish, mimeType, data (the recording, base64) }.
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse(e.postData.contents);
    if (!RECORDER_PASSCODE || RECORDER_PASSCODE === "change-me") {
      return reply({ ok: false, error: "Set a passcode in the helper script first (RECORDER_PASSCODE), then deploy again." });
    }
    if (String(req.passcode || "") !== RECORDER_PASSCODE) {
      return reply({ ok: false, error: "Wrong passcode." });
    }
    if (req.action === "plan") {
      lock.waitLock(20000);
      return savePlan(req);
    }
    if (req.action === "addDish") {
      lock.waitLock(20000);
      return addDish(req);
    }
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

    var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(req.data), type, fileName));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
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

// The add page sends: { passcode, action: "addDish", section, dish, youtube, replace }.
// Adds a row to the dish list. If that dish is already in that section, it asks
// first, and with replace: true swaps in the new video link instead.
function addDish(req) {
  var section = String(req.section || "").trim().slice(0, 60);
  var dish = String(req.dish || "").trim().slice(0, 120);
  var youtube = String(req.youtube || "").trim().slice(0, 500);
  if (!section) return reply({ ok: false, error: "Pick a section." });
  if (!dish) return reply({ ok: false, error: "Type the dish name." });
  if (!/^https?:\/\//i.test(youtube)) return reply({ ok: false, error: "Paste the YouTube link." });

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
                 ". Tap Save again to replace its video link." });
      }
      sheet.getRange(r + 1, cols.link + 1).setValue(youtube);
      if (cols.show >= 0) sheet.getRange(r + 1, cols.show + 1).setValue("Y");
      SpreadsheetApp.flush();
      return reply({ ok: true, dish: dish, section: section, replaced: true });
    }
  }

  var row = header.map(function () { return ""; });
  row[cols.section] = section;
  row[cols.name] = dish;
  row[cols.link] = youtube;
  if (cols.show >= 0) row[cols.show] = "Y";
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return reply({ ok: true, dish: dish, section: section });
}

// Columns of the dish list, found by their headings like the recipe page does.
function listColumns(header) {
  var cols = { section: -1, name: -1, link: -1, show: -1 };
  header.forEach(function (h, i) {
    h = String(h).toLowerCase();
    if (/image|photo|picture|voice|audio|sound|instruction/.test(h)) return;
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

// The to-do page sends { passcode, action, ... } with action one of:
//   "todos" (just read), "todoAdd" { id, list, task }, "todoSet" { id, done },
//   "todoDelete" { id }, "todoClearDone" { list }.
// Every answer carries the whole list, so the page always ends up in step.
function todoAction(req) {
  var sheet = suiteSheet(TODO_SHEET_NAME, TODO_HEADERS);
  var action = req.action;

  if (action === "todoAdd") {
    var task = String(req.task || "").trim().slice(0, 200);
    var list = String(req.list || "").trim().slice(0, 40);
    if (!task) return reply({ ok: false, error: "Type something to add." });
    if (!list) return reply({ ok: false, error: "Pick a list." });
    // The page makes the id, so an item can be ticked before this answer arrives.
    var id = /^[\w-]{6,40}$/.test(String(req.id || "")) ? String(req.id) : Utilities.getUuid().slice(0, 8);
    if (!todoRow(sheet, id)) sheet.appendRow([id, list, task, "", new Date(), ""]);
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
  } else if (action !== "todos") {
    return reply({ ok: false, error: "Unknown request." });
  }
  SpreadsheetApp.flush();
  return reply({ ok: true, items: readTodos(sheet) });
}

/* ---------------- plan page ---------------- */

// The plan page sends: { passcode, action: "plan", date: "2026-10-10",
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
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var s = String(v || "").trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);   // day first, as written in India
  if (m) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  return s;
}

// The recipe page asks for a voice note with "?voice=<Drive file id>" and gets the
// sound back, because Google Drive will not play its files inside other pages.
// Only files in the voice notes folder are handed out.
// Opening the web app address on its own just confirms it is running.
function doGet(e) {
  var id = e && e.parameter && e.parameter.voice;
  if (!id) return reply({ ok: true, message: "Voice note helper is running." });
  try {
    var file = DriveApp.getFileById(id);
    if (!inVoiceFolder(file)) {
      return reply({ ok: false, error: 'This file is not in the "' + VOICE_FOLDER_NAME + '" folder.' });
    }
    var blob = file.getBlob();
    return reply({ ok: true, mimeType: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) });
  } catch (err) {
    return reply({ ok: false, error: "Voice note not found." });
  }
}

function inVoiceFolder(file) {
  var folderId = voiceFolder().getId();
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) return true;
  }
  return false;
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
        added: v[4] instanceof Date ? v[4].getTime() : 0,
        doneAt: v[5] instanceof Date ? v[5].getTime() : 0
      };
    });
}

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
  var folders = DriveApp.getFoldersByName(VOICE_FOLDER_NAME);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(VOICE_FOLDER_NAME);
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
