/**
 * Voice notes helper for Mohna's Recipes.
 *
 * Adds a "Recipe page" menu to the Google Sheet. Its "Link voice notes" item
 * looks in the Google Drive folder named below for sound files named after a
 * dish (for example "Poha.m4a"), makes each one viewable by anyone with the
 * link, and pastes its link into the "Voice link" column of that dish's row.
 *
 * Rows that already have a voice link are left alone. To replace a note,
 * clear the cell and run it again.
 *
 * Setup: in the sheet, Extensions > Apps Script, paste this whole file in place
 * of what is there, click Save, then reload the sheet. See README.md.
 */

var VOICE_FOLDER_NAME = "Recipe voice notes";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Recipe page")
    .addItem("Link voice notes", "linkVoiceNotes")
    .addToUi();
}

function linkVoiceNotes() {
  var ui = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSheet();

  var folders = DriveApp.getFoldersByName(VOICE_FOLDER_NAME);
  if (!folders.hasNext()) {
    ui.alert('No Google Drive folder named "' + VOICE_FOLDER_NAME + '" was found.\n\n' +
             "Create a folder with exactly that name in Google Drive and put the voice notes in it.");
    return;
  }
  var folder = folders.next();

  // Sound files in the folder, by dish name (file name without its ending, like ".m4a").
  var files = {};
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    files[clean(f.getName().replace(/\.[^.]+$/, ""))] = f;
  }

  var data = sheet.getDataRange().getValues();
  var header = data[0].map(function (h) { return String(h).toLowerCase(); });
  var nameCol = -1, voiceCol = -1;
  header.forEach(function (h, i) {
    if (voiceCol < 0 && /voice|audio|sound|instruction/.test(h)) voiceCol = i;
    else if (nameCol < 0 && /dish|name|item|recipe/.test(h) && !/image|photo|link/.test(h)) nameCol = i;
  });
  if (nameCol < 0) {
    ui.alert('Could not find the "Dish name" column in row 1 of this tab.');
    return;
  }
  if (voiceCol < 0) {
    voiceCol = header.length;
    sheet.getRange(1, voiceCol + 1).setValue("Voice link");
  }

  var linked = [], used = {};
  for (var r = 1; r < data.length; r++) {
    var name = clean(data[r][nameCol]);
    if (!name || !files[name]) continue;
    var current = voiceCol < data[r].length ? String(data[r][voiceCol]).trim() : "";
    if (current) continue;
    var file = files[name];
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    sheet.getRange(r + 1, voiceCol + 1).setValue(file.getUrl());
    if (linked.indexOf(String(data[r][nameCol]).trim()) < 0) linked.push(String(data[r][nameCol]).trim());
    used[name] = true;
  }

  var unmatched = Object.keys(files).filter(function (k) {
    if (used[k]) return false;
    for (var r = 1; r < data.length; r++) if (clean(data[r][nameCol]) === k) return false;
    return true;
  }).map(function (k) { return files[k].getName(); });

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

function clean(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, " ");
}
