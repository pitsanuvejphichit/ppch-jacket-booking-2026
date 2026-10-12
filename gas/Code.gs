/**
 * ระบบลงทะเบียนสั่งจองเสื้อคลุมแจ็กเก็ต PPCH 2569
 * โรงพยาบาลพิษณุเวช พิจิตร (PITSANUVEJ PHICHIT)
 * 
 * Google Apps Script Backend (Standalone Web App)
 * Google Sheet ID: 1E2yctLgOo3nKxcWCNyPfEVmDLKnZovPPSTVLvlq72NM
 * 
 * คุณสมบัติ:
 * 1. รองรับคอลัมน์แยกทุกไซส์ (M, L, XL, 2XL, 3XL, 4XL) รองรับการสั่งมากกว่า 1 ไซส์
 * 2. รองรับโหมด "เปลี่ยนแปลงข้อมูลการจอง" (update) และ "ต้องการสั่งเพิ่ม" (add_more)
 * 3. กฎเหล็ก: รหัสพนักงาน 6 หลักเสมอ (padStart 6 หลัก และฟอร์แมต Plain Text '@')
 * 4. แยกคอลัมน์ ชื่อ และ นามสกุล อย่างชัดเจน
 */

const CONFIG = {
  // รหัส Google Sheet ของโปรเจกต์
  SPREADSHEET_ID: '1E2yctLgOo3nKxcWCNyPfEVmDLKnZovPPSTVLvlq72NM',
  SHEET_NAME: 'รายการสั่งจองเสื้อ',
  PRICE_PER_UNIT: 500,
  WEB_URL: 'https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/'
};

/**
 * ดึง Sheet สำหรับเก็บข้อมูล
 */
function getTargetSheet() {
  let ss;
  try {
    if (CONFIG.SPREADSHEET_ID) {
      ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
  } catch (err) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  
  if (!ss) {
    throw new Error('ไม่สามารถเปิด Google Sheet ได้ กรุณาตรวจสอบสิทธิ์และ SPREADSHEET_ID');
  }
  
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName(CONFIG.SHEET_NAME);
  }
  
  // ตรวจสอบและจัดระเบียบหัวตารางให้มีคอลัมน์ครบทุกไซส์ (16 คอลัมน์)
  checkAndMigrateHeaders(sheet);
  
  return sheet;
}

/**
 * กำหนดหัวตาราง 16 คอลัมน์ (มีคอลัมน์แยกทุกไซส์)
 */
function getExpectedHeaders() {
  return [
    'รหัสการจอง',             // 0 (A)
    'วันเวลาที่ลงทะเบียน',       // 1 (B)
    'รหัสพนักงาน',            // 2 (C) - Plain Text '@' 6 หลัก
    'ชื่อ',                   // 3 (D)
    'นามสกุล',                // 4 (E)
    'แผนก',                  // 5 (F)
    'ตำแหน่ง',                // 6 (G)
    'ไซส์ M (อก 40")',        // 7 (H)
    'ไซส์ L (อก 42")',        // 8 (I)
    'ไซส์ XL (อก 44")',       // 9 (J)
    'ไซส์ 2XL (อก 46")',      // 10 (K)
    'ไซส์ 3XL (อก 48")',      // 11 (L)
    'ไซส์ 4XL (อก 50")',      // 12 (M)
    'จำนวนรวม (ตัว)',          // 13 (N)
    'ยอดประมาณการ (บาท)',     // 14 (O)
    'สถานะ'                  // 15 (P)
  ];
}

/**
 * ตรวจสอบและอัปเกรดหัวตารางเป็น 16 คอลัมน์โดยไม่สูญเสียข้อมูลเดิม
 */
function checkAndMigrateHeaders(sheet) {
  const lastRow = sheet.getLastRow();
  const headers = getExpectedHeaders();
  
  if (lastRow < 1) {
    applySheetHeaders(sheet);
    return;
  }
  
  const headerRow = sheet.getRange(1, 1, 1, Math.min(sheet.getLastColumn(), 20)).getValues()[0];
  const headerStr = headerRow.join(',');
  
  // หากมีคอลัมน์แยกไซส์ครบ 16 คอลัมน์แล้ว ไม่ต้องแปลง
  if (headerRow.length >= 16 && (headerStr.indexOf('ไซส์ M') >= 0 || headerStr.indexOf('M (อก 40")') >= 0)) {
    return;
  }
  
  // แปลงข้อมูลจากโครงสร้างเดิมมาเป็นโครงสร้าง 16 คอลัมน์ (แยกไซส์)
  migrateToMultiSizeColumns(sheet);
}

/**
 * จัดรูปแบบหัวตาราง Sheet ใหม่
 */
function applySheetHeaders(sheet) {
  const headers = getExpectedHeaders();
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground('#1E3A8A');
  range.setFontColor('#FFFFFF');
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');
  
  // กฎเหล็ก: รหัสพนักงาน (Col C) ต้องเป็น Plain Text '@' เสมอ
  sheet.getRange("C:C").setNumberFormat('@');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * แปลงข้อมูลจากโครงสร้างเดิม (1 คอลัมน์ไซส์) เป็น 16 คอลัมน์ (แยกทุกไซส์)
 */
function migrateToMultiSizeColumns(sheet) {
  const lastRow = sheet.getLastRow();
  const headers = getExpectedHeaders();
  
  if (lastRow < 2) {
    applySheetHeaders(sheet);
    return;
  }
  
  const oldData = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  const oldHeader = oldData[0];
  const is13Cols = oldHeader.length >= 13 || oldHeader[4] === 'นามสกุล';
  
  const newRows = [];
  for (let i = 1; i < oldData.length; i++) {
    const r = oldData[i];
    const rawEmp = String(r[2] || '').trim();
    const empId6 = /^\d+$/.test(rawEmp) ? rawEmp.padStart(6, '0') : rawEmp;
    
    let fName = '';
    let lName = '';
    let dept = '';
    let pos = '';
    let oldSize = '';
    let oldQty = 1;
    let oldPrice = 500;
    let oldStatus = 'จองสำเร็จ';
    
    if (is13Cols) {
      fName = r[3] || '';
      lName = r[4] || '';
      dept = r[5] || '';
      pos = r[6] || '';
      oldSize = String(r[7] || '').toUpperCase().trim();
      oldQty = Number(r[9]) || 1;
      oldPrice = Number(r[11]) || (oldQty * 500);
      oldStatus = r[12] || 'จองสำเร็จ';
    } else {
      const parts = String(r[3] || '').trim().split(/\s+/);
      fName = parts[0] || '';
      lName = parts.slice(1).join(' ') || '';
      dept = r[4] || '';
      pos = r[5] || '';
      oldSize = String(r[6] || '').toUpperCase().trim();
      oldQty = Number(r[8]) || 1;
      oldPrice = Number(r[10]) || (oldQty * 500);
      oldStatus = r[11] || 'จองสำเร็จ';
    }
    
    let m = oldSize === 'M' ? oldQty : 0;
    let l = oldSize === 'L' ? oldQty : 0;
    let xl = oldSize === 'XL' ? oldQty : 0;
    let xxl = oldSize === '2XL' ? oldQty : 0;
    let xxxl = oldSize === '3XL' ? oldQty : 0;
    let xxxxl = oldSize === '4XL' ? oldQty : 0;
    let totalQty = m + l + xl + xxl + xxxl + xxxxl;
    if (totalQty === 0 && oldQty > 0) {
      m = oldQty;
      totalQty = oldQty;
    }
    
    newRows.push([
      r[0], // bookingId
      r[1], // timestamp
      empId6, // รหัสพนักงาน 6 หลัก
      fName,
      lName,
      dept,
      pos,
      m,
      l,
      xl,
      xxl,
      xxxl,
      xxxxl,
      totalQty,
      oldPrice || (totalQty * 500),
      oldStatus
    ]);
  }
  
  sheet.clear();
  applySheetHeaders(sheet);
  
  if (newRows.length > 0) {
    sheet.getRange(2, 1, newRows.length, headers.length).setValues(newRows);
    for (let j = 0; j < newRows.length; j++) {
      sheet.getRange(2 + j, 3).setNumberFormat('@').setValue(newRows[j][2]);
    }
  }
}

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'status';
  
  if (action === 'getSummary' || action === 'getRegistrations') {
    return handleGetRegistrations();
  }
  
  if (action === 'setup') {
    const sheet = getTargetSheet();
    applySheetHeaders(sheet);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Sheet headers initialized with 16 columns successfully'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // บันทึกผ่าน GET action=book
  if (action === 'book' && e.parameter && e.parameter.empId) {
    return processBooking(e.parameter);
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    appName: 'PPCH Phichit Jacket Registration 2026',
    price: 'ไม่เกิน 500 บาท / ตัว',
    period: '12 - 19 ต.ค. 2569'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle HTTP POST Requests
 */
function doPost(e) {
  let data;
  if (e && e.postData && e.postData.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (err) {
      data = e.parameter;
    }
  } else if (e && e.parameter) {
    data = e.parameter;
  } else {
    data = {};
  }
  
  return processBooking(data);
}

/**
 * ประมวลผลและบันทึกข้อมูลการจองลง Google Sheet
 * รองรับโหมด:
 * - 'new': สั่งจองใหม่
 * - 'update': เปลี่ยนแปลงข้อมูลการจองเดิม (แทนที่ยอดเดิม)
 * - 'add_more': ต้องการสั่งเพิ่ม (บวกเพิ่มเข้าไปในไซส์เดิม)
 */
function processBooking(data) {
  const lock = LockService.getScriptLock();
  let hasLock = false;
  
  try {
    // ระบบจัดคิว (Queue): รอคิวเพื่อเข้าถึงและเขียนข้อมูลลงชีท ป้องกันการบันทึกชนกันในเวลาเดียวกัน
    hasLock = lock.tryLock(30000);
    if (!hasLock) {
      // หากยังมีคิวก่อนหน้าทำงานอยู่ ให้รอคิวเพิ่มอีก 15 วินาที
      lock.waitLock(15000);
      hasLock = true;
    }
    
    if (!data.empId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'กรุณาระบุรหัสพนักงาน'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = getTargetSheet();
    
    // กฎเหล็ก: รหัสพนักงาน 6 หลักเสมอ (เช่น 000023)
    let rawEmpId = String(data.empId || '').trim();
    const empIdStr = /^\d+$/.test(rawEmpId) ? rawEmpId.padStart(6, '0') : rawEmpId;
    
    // ค้นหาประวัติการจองเดิมในชีท (ค้นหาด้วยรหัสพนักงาน 6 หลัก Col C)
    const values = sheet.getDataRange().getValues();
    let existingRow = -1;
    let prevRowData = null;
    
    for (let i = 1; i < values.length; i++) {
      const rowEmpId = String(values[i][2] || '').trim();
      const rowEmpIdPadded = /^\d+$/.test(rowEmpId) ? rowEmpId.padStart(6, '0') : rowEmpId;
      if (rowEmpIdPadded === empIdStr) {
        existingRow = i + 1; // Row number 1-indexed
        prevRowData = values[i];
        break;
      }
    }
    
    // ชื่อ และ นามสกุล
    let firstName = String(data.firstName || '').trim();
    let lastName = String(data.lastName || '').trim();
    if (!firstName && data.fullName) {
      const parts = String(data.fullName).trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
    if (!firstName && prevRowData) {
      firstName = String(prevRowData[3] || '').trim();
      lastName = String(prevRowData[4] || '').trim();
    }
    
    if (!firstName) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'กรุณาระบุชื่อพนักงาน'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const fullNameStr = (firstName + ' ' + lastName).trim();
    
    const now = new Date();
    const timestampStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const bookingId = data.bookingId || ('JK-' + Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd-') + randomHex);
    
    // ดึงจำนวนแต่ละไซส์จาก payload
    let qtyM = parseInt(data.qtyM, 10) || 0;
    let qtyL = parseInt(data.qtyL, 10) || 0;
    let qtyXL = parseInt(data.qtyXL, 10) || 0;
    let qty2XL = parseInt(data.qty2XL, 10) || 0;
    let qty3XL = parseInt(data.qty3XL, 10) || 0;
    let qty4XL = parseInt(data.qty4XL, 10) || 0;
    
    // รองรับกรณีส่งไซส์เดี่ยวแบบเดิม size: 'M', qty: 1
    if (qtyM === 0 && qtyL === 0 && qtyXL === 0 && qty2XL === 0 && qty3XL === 0 && qty4XL === 0 && data.size) {
      const s = String(data.size).toUpperCase().trim();
      const q = parseInt(data.qty, 10) || 1;
      if (s === 'M') qtyM = q;
      else if (s === 'L') qtyL = q;
      else if (s === 'XL') qtyXL = q;
      else if (s === '2XL') qty2XL = q;
      else if (s === '3XL') qty3XL = q;
      else if (s === '4XL') qty4XL = q;
    }
    
    const bookingMode = String(data.bookingMode || 'new').toLowerCase().trim();
    
    let finalM = qtyM;
    let finalL = qtyL;
    let finalXL = qtyXL;
    let final2XL = qty2XL;
    let final3XL = qty3XL;
    let final4XL = qty4XL;
    let finalStatus = 'จองสำเร็จ';
    
    if (existingRow > 0) {
      if (bookingMode === 'add_more') {
        // โหมดสั่งเพิ่ม: บวกจำนวนใหม่เข้ากับจำนวนเดิมในชีท
        const oldM = Number(prevRowData[7]) || 0;
        const oldL = Number(prevRowData[8]) || 0;
        const oldXL = Number(prevRowData[9]) || 0;
        const old2XL = Number(prevRowData[10]) || 0;
        const old3XL = Number(prevRowData[11]) || 0;
        const old4XL = Number(prevRowData[12]) || 0;
        
        finalM = oldM + qtyM;
        finalL = oldL + qtyL;
        finalXL = oldXL + qtyXL;
        final2XL = old2XL + qty2XL;
        final3XL = old3XL + qty3XL;
        final4XL = old4XL + qty4XL;
        finalStatus = 'จองสำเร็จ (สั่งเพิ่ม)';
      } else {
        // โหมดเปลี่ยนแปลงข้อมูลการจอง (update) หรือบันทึกทับ: แทนที่ด้วยยอดใหม่
        finalStatus = 'จองสำเร็จ (แก้ไขข้อมูล)';
      }
    }
    
    const finalTotalQty = finalM + finalL + finalXL + final2XL + final3XL + final4XL;
    const finalTotalPrice = finalTotalQty * CONFIG.PRICE_PER_UNIT;
    
    if (finalTotalQty <= 0) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'กรุณาเลือกจำนวนเสื้ออย่างน้อย 1 ตัว'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const rowData = [
      existingRow > 0 ? prevRowData[0] : bookingId,
      timestampStr,
      empIdStr,
      firstName,
      lastName,
      String(data.department || (prevRowData && prevRowData[5]) || '').trim(),
      String(data.position || (prevRowData && prevRowData[6]) || '').trim(),
      finalM,
      finalL,
      finalXL,
      final2XL,
      final3XL,
      final4XL,
      finalTotalQty,
      finalTotalPrice,
      finalStatus
    ];
    
    sheet.getRange("C:C").setNumberFormat('@');
    
    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
      sheet.getRange(existingRow, 3).setNumberFormat('@').setValue(empIdStr);
    } else {
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
      sheet.getRange(newRow, 3).setNumberFormat('@').setValue(empIdStr);
    }
    
    // บันทึกและซิงค์ข้อมูลลง Google Sheet ทันที (Flush) เพื่อให้คิวถัดไปอ่านข้อมูลที่อัปเดตแล้วได้อย่างถูกต้อง
    SpreadsheetApp.flush();
    
    // สร้างข้อความสรุปไซส์ เช่น "M: 1, XL: 1"
    const sizeSummaryParts = [];
    if (finalM > 0) sizeSummaryParts.push(`M (${finalM})`);
    if (finalL > 0) sizeSummaryParts.push(`L (${finalL})`);
    if (finalXL > 0) sizeSummaryParts.push(`XL (${finalXL})`);
    if (final2XL > 0) sizeSummaryParts.push(`2XL (${final2XL})`);
    if (final3XL > 0) sizeSummaryParts.push(`3XL (${final3XL})`);
    if (final4XL > 0) sizeSummaryParts.push(`4XL (${final4XL})`);
    const sizeSummaryText = sizeSummaryParts.join(', ');
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      bookingMode: bookingMode,
      isUpdate: existingRow > 0,
      bookingId: existingRow > 0 ? prevRowData[0] : bookingId,
      timestamp: timestampStr,
      empId: empIdStr,
      firstName: firstName,
      lastName: lastName,
      fullName: fullNameStr,
      department: data.department || '-',
      position: data.position || '-',
      qtyM: finalM,
      qtyL: finalL,
      qtyXL: finalXL,
      qty2XL: final2XL,
      qty3XL: final3XL,
      qty4XL: final4XL,
      sizeSummary: sizeSummaryText,
      totalQty: finalTotalQty,
      totalPrice: finalTotalPrice,
      status: finalStatus,
      message: existingRow > 0 
        ? (bookingMode === 'add_more' ? 'สั่งเสื้อเพิ่มสำเร็จ' : 'แก้ไขข้อมูลการจองสำเร็จ')
        : 'บันทึกการจองสำเร็จ'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      queueBusy: true,
      message: 'ระบบกำลังจัดคิวบันทึกข้อมูล กรุณารอสักครู่ค่ะ',
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    try {
      SpreadsheetApp.flush();
    } catch (flushErr) {}
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch (lockErr) {}
    }
  }
}

/**
 * ดึงรายการจองและสรุปผลจาก Google Sheet
 */
function handleGetRegistrations() {
  const sheet = getTargetSheet();
  const values = sheet.getDataRange().getValues();
  
  if (values.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({
      totalBookings: 0,
      totalQty: 0,
      totalAmount: 0,
      summaryBySize: { 'M': 0, 'L': 0, 'XL': 0, '2XL': 0, '3XL': 0, '4XL': 0 },
      items: []
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const items = [];
  const summaryBySize = { 'M': 0, 'L': 0, 'XL': 0, '2XL': 0, '3XL': 0, '4XL': 0 };
  let grandTotalQty = 0;
  let grandTotalAmount = 0;
  
  const is16Cols = values[0].length >= 16;
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rawEmpId = String(row[2] || '').trim();
    const empId = /^\d+$/.test(rawEmpId) ? rawEmpId.padStart(6, '0') : rawEmpId;
    
    let firstName = String(row[3] || '').trim();
    let lastName = String(row[4] || '').trim();
    let fullName = (firstName + ' ' + lastName).trim();
    let dept = row[5] || '';
    let pos = row[6] || '';
    
    let qM = 0;
    let qL = 0;
    let qXL = 0;
    let q2XL = 0;
    let q3XL = 0;
    let q4XL = 0;
    let totalQty = 0;
    let totalPrice = 0;
    let status = 'จองสำเร็จ';
    
    if (is16Cols) {
      qM = Number(row[7]) || 0;
      qL = Number(row[8]) || 0;
      qXL = Number(row[9]) || 0;
      q2XL = Number(row[10]) || 0;
      q3XL = Number(row[11]) || 0;
      q4XL = Number(row[12]) || 0;
      totalQty = Number(row[13]) || (qM + qL + qXL + q2XL + q3XL + q4XL);
      totalPrice = Number(row[14]) || (totalQty * 500);
      status = row[15] || 'จองสำเร็จ';
    } else {
      // โครงสร้างเดิม (13 คอลัมน์)
      const oldSize = String(row[7] || '').toUpperCase().trim();
      const oldQty = Number(row[9]) || 1;
      if (oldSize === 'M') qM = oldQty;
      else if (oldSize === 'L') qL = oldQty;
      else if (oldSize === 'XL') qXL = oldQty;
      else if (oldSize === '2XL') q2XL = oldQty;
      else if (oldSize === '3XL') q3XL = oldQty;
      else if (oldSize === '4XL') q4XL = oldQty;
      else qM = oldQty;
      totalQty = oldQty;
      totalPrice = Number(row[11]) || (totalQty * 500);
      status = row[12] || 'จองสำเร็จ';
    }
    
    // สร้าง sizeBreakdown
    const sizeDetails = [];
    if (qM > 0) sizeDetails.push({ size: 'M', chest: 40, qty: qM });
    if (qL > 0) sizeDetails.push({ size: 'L', chest: 42, qty: qL });
    if (qXL > 0) sizeDetails.push({ size: 'XL', chest: 44, qty: qXL });
    if (q2XL > 0) sizeDetails.push({ size: '2XL', chest: 46, qty: q2XL });
    if (q3XL > 0) sizeDetails.push({ size: '3XL', chest: 48, qty: q3XL });
    if (q4XL > 0) sizeDetails.push({ size: '4XL', chest: 50, qty: q4XL });
    
    let sizeSummaryText = '-';
    if (sizeDetails.length === 1) {
      sizeSummaryText = `ไซส์ ${sizeDetails[0].size}`;
    } else if (sizeDetails.length > 1) {
      sizeSummaryText = sizeDetails.map(s => `${s.size} (${s.qty})`).join(', ');
    }
    
    summaryBySize['M'] += qM;
    summaryBySize['L'] += qL;
    summaryBySize['XL'] += qXL;
    summaryBySize['2XL'] += q2XL;
    summaryBySize['3XL'] += q3XL;
    summaryBySize['4XL'] += q4XL;
    
    grandTotalQty += totalQty;
    grandTotalAmount += totalPrice;
    
    items.push({
      bookingId: row[0],
      timestamp: row[1],
      empId: empId,
      firstName: firstName,
      lastName: lastName,
      fullName: fullName,
      department: dept,
      position: pos,
      qtyM: qM,
      qtyL: qL,
      qtyXL: qXL,
      qty2XL: q2XL,
      qty3XL: q3XL,
      qty4XL: q4XL,
      sizeDetails: sizeDetails,
      sizeSummary: sizeSummaryText,
      totalQty: totalQty,
      totalPrice: totalPrice,
      paymentStatus: status
    });
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    totalBookings: items.length,
    totalQty: grandTotalQty,
    totalAmount: grandTotalAmount,
    summaryBySize: summaryBySize,
    items: items
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * ป๊อปอัปสรุปยอดบน Google Sheet
 */
function showSummaryDialog() {
  const sheet = getTargetSheet();
  const values = sheet.getDataRange().getValues();
  const ui = SpreadsheetApp.getUi();
  
  if (values.length <= 1) {
    ui.alert('ยังไม่มีข้อมูลการจองในระบบ');
    return;
  }
  
  const summary = { 'M': 0, 'L': 0, 'XL': 0, '2XL': 0, '3XL': 0, '4XL': 0 };
  let totalQty = 0;
  let totalAmount = 0;
  
  for (let i = 1; i < values.length; i++) {
    const qM = Number(values[i][7]) || 0;
    const qL = Number(values[i][8]) || 0;
    const qXL = Number(values[i][9]) || 0;
    const q2XL = Number(values[i][10]) || 0;
    const q3XL = Number(values[i][11]) || 0;
    const q4XL = Number(values[i][12]) || 0;
    
    summary['M'] += qM;
    summary['L'] += qL;
    summary['XL'] += qXL;
    summary['2XL'] += q2XL;
    summary['3XL'] += q3XL;
    summary['4XL'] += q4XL;
    
    const rowQty = Number(values[i][13]) || (qM + qL + qXL + q2XL + q3XL + q4XL);
    totalQty += rowQty;
    totalAmount += (Number(values[i][14]) || rowQty * 500);
  }
  
  let msg = '📊 สรุปยอดการจองเสื้อแจ็กเก็ต PPCH Phichit\n\n';
  msg += `• รวมผู้จอง: ${values.length - 1} คน\n`;
  msg += `• รวมเสื้อทั้งหมด: ${totalQty} ตัว\n`;
  msg += `• ยอดเงินประมาณการรวม: ไม่เกิน ${totalAmount.toLocaleString()} บาท\n\n`;
  msg += 'จำแนกตามไซส์ (รอบอก):\n';
  msg += `  - M (รอบอก 40"): ${summary['M'] || 0} ตัว\n`;
  msg += `  - L (รอบอก 42"): ${summary['L'] || 0} ตัว\n`;
  msg += `  - XL (รอบอก 44"): ${summary['XL'] || 0} ตัว\n`;
  msg += `  - 2XL (รอบอก 46"): ${summary['2XL'] || 0} ตัว\n`;
  msg += `  - 3XL (รอบอก 48"): ${summary['3XL'] || 0} ตัว\n`;
  msg += `  - 4XL (รอบอก 50"): ${summary['4XL'] || 0} ตัว\n`;
  
  ui.alert('สรุปยอดการจองเสื้อ', msg, ui.ButtonSet.OK);
}

function openWebUrl() {
  const html = HtmlService.createHtmlOutput(
    '<script>window.open("' + CONFIG.WEB_URL + '", "_blank");google.script.host.close();</script>'
  ).setWidth(200).setHeight(100);
  SpreadsheetApp.getUi().showModalDialog(html, 'กำลังเปิดเว็บ...');
}
