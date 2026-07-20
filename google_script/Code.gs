/**
 * e-REDT System - Google Apps Script Web App Backend
 * Google Sheet ID: 1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4
 * Author: e-REDT Development Team
 */

const SPREADSHEET_ID = '1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4';
const PARENT_DRIVE_FOLDER_ID = ''; // ใส่ Folder ID ของ Google Drive ได้หากต้องการย้ายเข้าโฟลเดอร์เฉพาะ

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getData';
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // 1. ดึงรายชื่อผู้ใช้งานจาก Tab: users (ยกเว้น admin)
  if (action === 'getUsers') {
    const sheet = ss.getSheetByName('users') || ss.insertSheet('users');
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return responseJSON([]);
    
    const users = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue;
      if (row[2] === 'admin') continue; // ยกเว้น admin
      users.push({
        username: String(row[0]),
        password: String(row[1]),
        role: String(row[2]),
        station: String(row[3] || ''),
        name: String(row[4]),
        status: String(row[5] || 'approved')
      });
    }
    return responseJSON(users);
  }
  
  // 2. ดึงรายการคำร้องผัดฟ้องฝากขังจาก Tab: data
  const sheet = ss.getSheetByName('data') || ss.insertSheet('data');
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return responseJSON([]);
  
  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    data.push({
      id: String(row[0]),
      detentionNo: String(row[1]),
      suspectCount: Number(row[2]) || 1,
      driveLink: String(row[3]),
      downloadStatus: row[4] === true || String(row[4]).toUpperCase() === 'TRUE',
      officerName: String(row[5] || ''),
      downloadTimestamp: String(row[6] || ''),
      policeStation: String(row[7]),
      createdBy: String(row[8]),
      createdAt: String(row[9])
    });
  }
  return responseJSON(data);
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 1. ยื่นคำร้องใหม่ + อัปโหลดไฟล์ไป Google Drive + บันทึกลง Tab: data
    if (action === 'createRequest') {
      let fileUrl = 'https://drive.google.com/file/d/1Y-OA9B8cPRwTcILCB9lmLny2GrfcEnNqR5i07lTGDM4/view';
      
      if (postData.fileData && postData.fileName) {
        const bytes = Utilities.base64Decode(postData.fileData.split(',')[1] || postData.fileData);
        const blob = Utilities.newBlob(bytes, 'application/pdf', postData.fileName);
        
        let targetFolder = DriveApp.getRootFolder();
        if (PARENT_DRIVE_FOLDER_ID) {
          try { targetFolder = DriveApp.getFolderById(PARENT_DRIVE_FOLDER_ID); } catch(err){}
        }
        
        const stationName = postData.policeStation || 'ทั่วไป';
        const folders = targetFolder.getFoldersByName(stationName);
        let stationFolder = folders.hasNext() ? folders.next() : targetFolder.createFolder(stationName);
        
        const file = stationFolder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileUrl = file.getUrl();
      }
      
      const sheet = ss.getSheetByName('data') || ss.insertSheet('data');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['ID', 'DetentionNo', 'SuspectCount', 'DriveLink', 'DownloadStatus', 'OfficerName', 'DownloadTimestamp', 'PoliceStation', 'CreatedBy', 'CreatedAt']);
      }
      
      sheet.appendRow([
        postData.id,
        postData.detentionNo,
        Number(postData.suspectCount) || 1,
        fileUrl,
        false,
        '',
        '',
        postData.policeStation,
        postData.createdBy,
        postData.createdAt
      ]);
      
      return responseJSON({ success: true, driveLink: fileUrl });
    }
    
    // 2. อัปเดตสถานะการดาวน์โหลดใน Tab: data
    if (action === 'updateDownloadStatus') {
      const sheet = ss.getSheetByName('data');
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === String(postData.id)) {
            sheet.getRange(i + 1, 5).setValue(true);
            sheet.getRange(i + 1, 6).setValue(postData.officerName);
            sheet.getRange(i + 1, 7).setValue(postData.downloadTimestamp);
            break;
          }
        }
      }
      return responseJSON({ success: true });
    }
    
    // 3. จัดการผู้ใช้งานใน Tab: users
    if (action === 'saveUser') {
      const sheet = ss.getSheetByName('users') || ss.insertSheet('users');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Username', 'Password', 'Role', 'Station', 'Name', 'Status']);
      }
      sheet.appendRow([
        postData.username,
        postData.password,
        postData.role,
        postData.station || '',
        postData.name,
        'approved'
      ]);
      return responseJSON({ success: true });
    }
    
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
