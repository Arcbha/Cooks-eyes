/**
 * Voice notes helper for Mohna's Recipes.
 *
 * Two jobs, both saving voice notes into the Google Drive folder named below
 * and putting their links into the sheet's "Voice link" column:
 *
 * 1. The record page (recipe site address + "#record") sends recordings here.
 *    For that, this script is deployed as a web app; see README.md.
 * 2. The "Recipe page > Link voice notes" menu in the sheet links sound files
 *    you upload to the folder yourself, matched by file name (e.g. "Poha.m4a").
 *
 * Setup: in the sheet, Extensions > Apps Script, paste this whole file in place
 * of what is there, change the passcode below, click Save. See README.md.
 */

// The passcode typed on the record page. Change it to something only you know.
var RECORDER_PASSCODE = "change-me";

var VOICE_FOLDER_NAME = "Recipe voice notes";

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

// Opening the web app address in a browser just confirms it is running.
function doGet() {
  return reply({ ok: true, message: "Voice note helper is running." });
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
