/**
 * e-REDT System - Google Apps Script Web App Backend
 * Google Sheet ID: 1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4
 * Target Drive Folder: https://drive.google.com/drive/u/2/folders/1l5ZDlXI14lgFc6WGqmZ3kQ9qB-ci-ArM
 * Root Admin: admin / caogikojt02 (Permanent System Root Account)
 * ศาลจังหวัดอุดรธานี — ระบบติดตามคำร้องขอฝากขังออนไลน์
 */

const SPREADSHEET_ID = '1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4';
const DEFAULT_DRIVE_FOLDER_ID = '1l5ZDlXI14lgFc6WGqmZ3kQ9qB-ci-ArM';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getRequests';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. GET USERS (Tab: users)
  if (action === 'getUsers') {
    const sheet = ss.getSheetByName('users') || initUsersSheet(ss);
    const rows = sheet.getDataRange().getValues();
    
    const users = [];
    let hasAdmin = false;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      if (String(r[0]) === 'admin') {
        hasAdmin = true;
        users.push({
          username: 'admin',
          password: 'caogikojt02',
          role: 'admin',
          station: '',
          name: 'ผู้ดูแลระบบสูงสุด (System Admin)',
          status: 'approved'
        });
      } else {
        users.push({
          username: String(r[0]),
          password: String(r[1]),
          role: String(r[2]),
          station: String(r[3] || ''),
          name: String(r[4]),
          status: String(r[5] || 'approved')
        });
      }
    }
    if (!hasAdmin) {
      users.unshift({
        username: 'admin',
        password: 'caogikojt02',
        role: 'admin',
        station: '',
        name: 'ผู้ดูแลระบบสูงสุด (System Admin)',
        status: 'approved'
      });
    }
    return responseJSON(users);
  }
  
  // 2. GET HOLIDAYS (Tab: holidays)
  if (action === 'getHolidays') {
    const sheet = ss.getSheetByName('holidays') || initHolidaysSheet(ss);
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return responseJSON([]);
    
    const holidays = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue;
      holidays.push({
        date: String(r[0]),
        name: String(r[1])
      });
    }
    return responseJSON(holidays);
  }
  
  // 3. GET REQUESTS (Tab: data or requests)
  const sheet = ss.getSheetByName('data') || ss.getSheetByName('requests') || initRequestsSheet(ss);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return responseJSON([]);
  
  const requests = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    
    requests.push({
      caseNumber: String(r[0]),
      type: String(r[1] || 'ฝ.'),
      startDate: String(r[2]),
      k: Number(r[3]) || 2,
      cap: Number(r[4]) || 84,
      cumulativeDays: Number(r[5]) || 12,
      station: r[6] ? String(r[6]) : null,
      officer: r[7] ? String(r[7]) : null,
      fileName: r[8] ? String(r[8]) : null,
      fileUrl: r[9] ? String(r[9]) : null,
      downloaded: r[10] === true || String(r[10]).toUpperCase() === 'TRUE',
      closed: r[11] === true || String(r[11]).toUpperCase() === 'TRUE',
      closedDate: r[12] ? String(r[12]) : null,
      courtFlag: r[13] ? parseJSON(r[13]) : null,
      returnedNote: r[14] ? parseJSON(r[14]) : null,
      history: r[15] ? parseJSON(r[15]) : [],
      createdAt: r[16] ? String(r[16]) : ''
    });
  }
  return responseJSON(requests);
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. SAVE ALL REQUESTS (Tab: data)
    if (action === 'saveRequests' || action === 'createRequest') {
      const sheet = ss.getSheetByName('data') || initRequestsSheet(ss);
      sheet.clearContents();
      sheet.appendRow(['CaseNumber', 'Type', 'StartDate', 'K', 'Cap', 'CumulativeDays', 'Station', 'Officer', 'FileName', 'FileUrl', 'Downloaded', 'Closed', 'ClosedDate', 'CourtFlag', 'ReturnedNote', 'History', 'CreatedAt']);
      
      const reqList = postData.requests || [postData];
      reqList.forEach(item => {
        if (!item.caseNumber && item.detentionNo) item.caseNumber = item.detentionNo;
        if (!item.caseNumber) return;

        sheet.appendRow([
          item.caseNumber,
          item.type || 'ฝ.',
          item.startDate || new Date().toISOString().split('T')[0],
          item.k || 2,
          item.cap || 84,
          item.cumulativeDays || 12,
          item.station || item.policeStation || '',
          item.officer || item.officerName || '',
          item.fileName || '',
          item.fileUrl || item.driveLink || '',
          item.downloaded || false,
          item.closed || false,
          item.closedDate || '',
          item.courtFlag ? JSON.stringify(item.courtFlag) : '',
          item.returnedNote ? JSON.stringify(item.returnedNote) : '',
          item.history ? JSON.stringify(item.history) : '[]',
          item.createdAt || new Date().toISOString()
        ]);
      });
      return responseJSON({ success: true, count: reqList.length });
    }

    // 2. UPLOAD PDF FILE TO GOOGLE DRIVE (Subfolder by สภ.)
    if (action === 'uploadFile') {
      let fileUrl = '';
      let fileName = postData.fileName;
      const folderId = postData.driveFolderId || DEFAULT_DRIVE_FOLDER_ID;

      if (postData.fileData && postData.fileName) {
        const bytes = Utilities.base64Decode(postData.fileData.split(',')[1] || postData.fileData);
        const blob = Utilities.newBlob(bytes, 'application/pdf', postData.fileName);
        
        let targetFolder;
        try {
          targetFolder = DriveApp.getFolderById(folderId);
        } catch (err) {
          targetFolder = DriveApp.getRootFolder();
        }
        
        const stationName = postData.station || postData.policeStation || 'ทั่วไป';
        const folders = targetFolder.getFoldersByName(stationName);
        let stationFolder;
        
        // Use existing subfolder if found, otherwise create subfolder
        if (folders.hasNext()) {
          stationFolder = folders.next();
        } else {
          stationFolder = targetFolder.createFolder(stationName);
        }
        
        const file = stationFolder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();
      }

      return responseJSON({ success: true, fileName: fileName, fileUrl: fileUrl });
    }

    // 3. SAVE USER (Tab: users)
    if (action === 'saveUser') {
      const sheet = ss.getSheetByName('users') || initUsersSheet(ss);
      const rows = sheet.getDataRange().getValues();
      let foundIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(postData.username)) {
          foundIndex = i + 1;
          break;
        }
      }
      const pass = postData.username === 'admin' ? 'caogikojt02' : postData.password;
      const role = postData.username === 'admin' ? 'admin' : postData.role;

      if (foundIndex > 0) {
        sheet.getRange(foundIndex, 2).setValue(pass);
        sheet.getRange(foundIndex, 3).setValue(role);
        sheet.getRange(foundIndex, 4).setValue(postData.station || '');
        sheet.getRange(foundIndex, 5).setValue(postData.name);
        sheet.getRange(foundIndex, 6).setValue('approved');
      } else {
        sheet.appendRow([postData.username, pass, role, postData.station || '', postData.name, 'approved']);
      }
      return responseJSON({ success: true });
    }

    // 4. SAVE HOLIDAYS (Tab: holidays)
    if (action === 'saveHolidays') {
      const sheet = ss.getSheetByName('holidays') || initHolidaysSheet(ss);
      sheet.clearContents();
      sheet.appendRow(['Date', 'Name']);
      (postData.holidays || []).forEach(h => {
        sheet.appendRow([h.date, h.name]);
      });
      return responseJSON({ success: true });
    }

    return responseJSON({ success: false, error: 'Unknown action' });

  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function initRequestsSheet(ss) {
  const s = ss.insertSheet('requests');
  s.appendRow(['CaseNumber', 'Type', 'StartDate', 'K', 'Cap', 'CumulativeDays', 'Station', 'Officer', 'FileName', 'FileUrl', 'Downloaded', 'Closed', 'ClosedDate', 'CourtFlag', 'ReturnedNote', 'History', 'CreatedAt']);
  return s;
}

function initUsersSheet(ss) {
  const s = ss.insertSheet('users');
  s.appendRow(['Username', 'Password', 'Role', 'Station', 'Name', 'Status']);
  s.appendRow(['admin', 'caogikojt02', 'admin', '', 'ผู้ดูแลระบบสูงสุด (System Admin)', 'approved']);
  return s;
}

function initHolidaysSheet(ss) {
  const s = ss.insertSheet('holidays');
  s.appendRow(['Date', 'Name']);
  return s;
}

function parseJSON(str) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch (e) {
    return null;
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
