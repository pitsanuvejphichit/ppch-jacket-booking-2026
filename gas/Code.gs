/**
 * ============================================================================
 * 🧥 ระบบลงทะเบียนจองเสื้อแจ็กเก็ตโรงพยาบาลพิษณุเวช พิจิตร (PITSANUVEJ PHICHIT)
 * ประจำปี 2569 | ระยะเวลาลงทะเบียน 12 - 19 ตุลาคม 2569
 * ฝ่ายพัฒนาทรัพยากรบุคคล (HRD AI Suite)
 * ============================================================================
 */

const CONFIG = {
  SPREADSHEET_ID: '1E2yctLgOo3nKxcWCNyPfEVmDLKnZovPPSTVLvlq72NM',
  SHEET_NAME: 'รายการจองเสื้อ',
  DEFAULT_PRICE: 500, // ราคาไม่เกิน 500 บาท / ตัว
  START_DATE: '2026-10-12',
  END_DATE: '2026-10-19',
  WEB_URL: 'https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/'
};

/**
 * ดึงออบเจ็กต์ Google Spreadsheet ที่ผูกไว้
 */
function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    } catch (err) {
      console.warn('Could not open by ID, falling back to active spreadsheet:', err);
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * ดึงหรือสร้าง Sheet สำหรับบันทึกข้อมูล
 */
function getTargetSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    const sheets = ss.getSheets();
    // ถ้ามีชีตเริ่มต้นเช่น 'ชีต1' หรือ 'Sheet1' ที่ยังว่างอยู่ ให้เปลี่ยนชื่อเป็น 'รายการจองเสื้อ'
    if (sheets.length === 1 && sheets[0].getLastRow() <= 1) {
      sheet = sheets[0];
      sheet.setName(CONFIG.SHEET_NAME);
    } else {
      const defaultSheet = ss.getSheetByName('ชีต1') || ss.getSheetByName('Sheet1');
      if (defaultSheet && defaultSheet.getLastRow() <= 1) {
        sheet = defaultSheet;
        sheet.setName(CONFIG.SHEET_NAME);
      } else {
        sheet = ss.insertSheet(CONFIG.SHEET_NAME, 0);
      }
    }
  }
  
  // ตรวจสอบว่ามีหัวตารางแล้วหรือไม่
  if (sheet.getLastRow() === 0) {
    applySheetHeaders(sheet);
  }
  
  return sheet;
}

/**
 * ตั้งค่าหัวตาราง Sheet (แยกคอลัมน์ ชื่อ, นามสกุล และฟอร์แมตรหัสพนักงาน 6 หลัก)
 */
function applySheetHeaders(sheet) {
  const headers = [
    'รหัสการจอง',
    'วันเวลาที่ลงทะเบียน',
    'รหัสพนักงาน',
    'ชื่อ',
    'นามสกุล',
    'แผนก',
    'ตำแหน่ง',
    'ไซส์เสื้อ',
    'รอบอก (นิ้ว)',
    'จำนวน (ตัว)',
    'ราคาต่อตัว',
    'ยอดประมาณการ (บาท)',
    'สถานะ'
  ];
  
  // ตรวจสอบข้อมูลแถวเดิม หากเป็นโครงสร้างเก่าที่มี 'ชื่อ-นามสกุล' ให้แปลงข้อมูลเดิมอัตโนมัติ
  if (sheet.getLastRow() >= 1) {
    const maxCols = Math.max(sheet.getLastColumn(), 1);
    const headerRow = sheet.getRange(1, 1, 1, Math.min(maxCols, 15)).getValues()[0];
    if (headerRow.includes('ชื่อ-นามสกุล')) {
      migrateOldColumnsToSeparateName(sheet);
    }
  }
  
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground('#1E3A8A');
  range.setFontColor('#FFFFFF');
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');
  
  // กฎเหล็ก: กำหนดคอลัมน์ C (รหัสพนักงาน) เป็น Plain Text ('@') เสมอ เพื่อรักษาเลข 6 หลัก (เช่น 000023)
  sheet.getRange("C:C").setNumberFormat('@');
  
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * แปลงข้อมูลโครงสร้างเก่า (ชื่อ-นามสกุล คอลัมน์เดียว) เป็นแยก ชื่อ และ นามสกุล
 */
function migrateOldColumnsToSeparateName(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const allValues = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const newRows = [];
  
  for (let r = 0; r < allValues.length; r++) {
    const row = allValues[r];
    const rawEmpId = String(row[2] || '').trim();
    const empId6 = /^\d+$/.test(rawEmpId) ? rawEmpId.padStart(6, '0') : rawEmpId;
    const oldFullName = String(row[3] || '').trim();
    
    // แยกชื่อ และ นามสกุล
    const parts = oldFullName.split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    
    newRows.push([
      row[0] || '', // รหัสการจอง
      row[1] || '', // วันเวลาที่ลงทะเบียน
      empId6,       // รหัสพนักงาน (6 หลัก)
      firstName,    // ชื่อ
      lastName,     // นามสกุล
      row[4] || '', // แผนก
      row[5] || '', // ตำแหน่ง
      row[6] || '', // ไซส์เสื้อ
      row[7] || '', // รอบอก (นิ้ว)
      row[8] || '', // จำนวน (ตัว)
      row[9] || '', // ราคาต่อตัว
      row[10] || '', // ยอดประมาณการ (บาท)
      row[11] || 'จองสำเร็จ' // สถานะ
    ]);
  }
  
  sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  const targetRange = sheet.getRange(2, 1, newRows.length, 13);
  sheet.getRange(2, 3, newRows.length, 1).setNumberFormat('@');
  targetRange.setValues(newRows);
  for (let i = 0; i < newRows.length; i++) {
    sheet.getRange(2 + i, 3).setNumberFormat('@').setValue(newRows[i][2]);
  }
}

/**
 * จัดรูปแบบหัวตาราง Google Sheet ด้วยตนเอง
 */
function setupSheetHeaders() {
  const sheet = getTargetSheet();
  applySheetHeaders(sheet);
  try {
    SpreadsheetApp.getUi().alert('สำเร็จ', 'จัดรูปแบบหัวตาราง (แยก ชื่อ-นามสกุล, รหัสพนักงาน 6 หลัก) เรียบร้อยแล้วค่ะ!', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}
}

/**
 * เมนูเมื่อเปิด Google Sheet
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🧥 ระบบลงทะเบียนจองเสื้อ')
      .addItem('⚙️ 1. จัดรูปแบบหัวตารางอัตโนมัติ (Setup 13 คอลัมน์)', 'setupSheetHeaders')
      .addItem('📊 2. สรุปยอดการจองตามไซส์ (Summary)', 'showSummaryDialog')
      .addSeparator()
      .addItem('🌐 3. เปิดหน้าเว็บลงทะเบียน (GitHub Pages)', 'openWebUrl')
      .addToUi();
  } catch (e) {}
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
    setupSheetHeaders();
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Sheet headers initialized with 13 columns successfully'
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // รองรับการบันทึกผ่าน GET (กรณีบางเครือข่ายบล็อก POST)
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
 * Handle HTTP POST Requests (บันทึกข้อมูลการจองลง Google Sheet)
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
 */
function processBooking(data) {
  const lock = LockService.getScriptLock();
  
  try {
    // ล็อก 30 วินาที ป้องกันบันทึกแถวทับกัน
    lock.waitLock(30000);
    
    if (!data.empId || (!data.fullName && !data.firstName) || !data.size) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (รหัสพนักงาน, ชื่อ, ไซส์)'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = getTargetSheet();
    
    // ตรวจสอบและอัปเดตหัวตารางหากยังเป็นแบบเดิมที่มี 'ชื่อ-นามสกุล' คอลัมน์เดียว
    const maxCols = Math.max(sheet.getLastColumn(), 1);
    const headerRow = sheet.getRange(1, 1, 1, Math.min(maxCols, 15)).getValues()[0];
    if (headerRow.includes('ชื่อ-นามสกุล')) {
      applySheetHeaders(sheet);
    }
    
    const now = new Date();
    const timestampStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const bookingId = data.bookingId || ('JK-' + Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd-') + randomHex);
    
    // ⭐️ กฎเหล็ก: รหัสพนักงานต้องครบ 6 หลักเสมอ (เช่น 000023)
    let rawEmpId = String(data.empId || '').trim();
    const empIdStr = /^\d+$/.test(rawEmpId) ? rawEmpId.padStart(6, '0') : rawEmpId;
    
    // ⭐️ แยกคอลัมน์ ชื่อ และ นามสกุล
    let firstName = String(data.firstName || '').trim();
    let lastName = String(data.lastName || '').trim();
    if (!firstName && data.fullName) {
      const parts = String(data.fullName).trim().split(/\s+/);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
    const fullNameStr = (firstName + ' ' + lastName).trim();
    
    const chestSizes = {
      'M': 40,
      'L': 42,
      'XL': 44,
      '2XL': 46,
      '3XL': 48,
      '4XL': 50
    };
    
    const size = String(data.size).toUpperCase().trim();
    const chest = chestSizes[size] || parseInt(data.chest, 10) || 0;
    const qty = parseInt(data.qty, 10) || 1;
    const pricePerUnitDesc = 'ราคาไม่เกิน 500 บาท / ตัว';
    const totalPrice = qty * 500;
    
    // ตรวจสอบประวัติการจองเดิม หากมีรหัสพนักงาน 6 หลักนี้แล้วให้อัปเดตบรรทัดเดิม
    const values = sheet.getDataRange().getValues();
    let existingRow = -1;
    
    for (let i = 1; i < values.length; i++) {
      const rowEmpId = String(values[i][2] || '').trim();
      const rowEmpIdPadded = /^\d+$/.test(rowEmpId) ? rowEmpId.padStart(6, '0') : rowEmpId;
      if (rowEmpIdPadded === empIdStr) {
        existingRow = i + 1;
        break;
      }
    }
    
    const rowData = [
      bookingId,
      timestampStr,
      empIdStr,
      firstName,
      lastName,
      String(data.department || '').trim(),
      String(data.position || '').trim(),
      size,
      chest,
      qty,
      pricePerUnitDesc,
      totalPrice,
      'จองสำเร็จ'
    ];
    
    // บังคับฟอร์แมตคอลัมน์ C ให้เป็น Plain Text ก่อนบันทึก
    sheet.getRange("C:C").setNumberFormat('@');
    
    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
      sheet.getRange(existingRow, 3).setNumberFormat('@').setValue(empIdStr);
    } else {
      const newRow = sheet.getLastRow() + 1;
      sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
      sheet.getRange(newRow, 3).setNumberFormat('@').setValue(empIdStr);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      isUpdate: existingRow > 0,
      bookingId: bookingId,
      timestamp: timestampStr,
      empId: empIdStr,
      firstName: firstName,
      lastName: lastName,
      fullName: fullNameStr,
      department: data.department || '-',
      position: data.position || '-',
      size: size,
      chest: chest,
      qty: qty,
      totalPrice: totalPrice,
      message: existingRow > 0 ? 'อัปเดตข้อมูลการจองเดิมสำเร็จ' : 'บันทึกการจองสำเร็จ'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * ดึงรายการจองและสรุปผลจาก Google Sheet (รองรับทั้ง 12 และ 13 คอลัมน์)
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
  let totalQty = 0;
  let totalAmount = 0;
  
  const is13Cols = values[0].length >= 13 || values[0][4] === 'นามสกุล';
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const rawEmpId = String(row[2] || '').trim();
    const empId = /^\d+$/.test(rawEmpId) ? rawEmpId.padStart(6, '0') : rawEmpId;
    
    let firstName = '';
    let lastName = '';
    let fullName = '';
    let dept = '';
    let pos = '';
    let size = '';
    let chest = 0;
    let qty = 0;
    let pricePerUnit = '';
    let price = 0;
    let status = 'จองสำเร็จ';
    
    if (is13Cols) {
      firstName = String(row[3] || '').trim();
      lastName = String(row[4] || '').trim();
      fullName = (firstName + ' ' + lastName).trim();
      dept = row[5] || '';
      pos = row[6] || '';
      size = String(row[7] || '').trim().toUpperCase();
      chest = row[8];
      qty = Number(row[9]) || 0;
      pricePerUnit = row[10];
      price = Number(row[11]) || 0;
      status = row[12] || 'จองสำเร็จ';
    } else {
      fullName = String(row[3] || '').trim();
      dept = row[4] || '';
      pos = row[5] || '';
      size = String(row[6] || '').trim().toUpperCase();
      chest = row[7];
      qty = Number(row[8]) || 0;
      pricePerUnit = row[9];
      price = Number(row[10]) || 0;
      status = row[11] || 'จองสำเร็จ';
    }
    
    const item = {
      bookingId: row[0],
      timestamp: row[1],
      empId: empId,
      firstName: firstName,
      lastName: lastName,
      fullName: fullName,
      department: dept,
      position: pos,
      size: size,
      chest: chest,
      qty: qty,
      pricePerUnit: pricePerUnit,
      totalPrice: price,
      paymentStatus: status
    };
    items.push(item);
    
    if (summaryBySize[size] !== undefined) {
      summaryBySize[size] += qty;
    } else if (size) {
      summaryBySize[size] = qty;
    }
    
    totalQty += qty;
    totalAmount += price;
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    totalBookings: items.length,
    totalQty: totalQty,
    totalAmount: totalAmount,
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
  
  const is13Cols = values[0].length >= 13 || values[0][4] === 'นามสกุล';
  const summary = { 'M': 0, 'L': 0, 'XL': 0, '2XL': 0, '3XL': 0, '4XL': 0 };
  let totalQty = 0;
  let totalAmount = 0;
  
  for (let i = 1; i < values.length; i++) {
    const size = is13Cols ? values[i][7] : values[i][6];
    const qty = Number(is13Cols ? values[i][9] : values[i][8]) || 0;
    const price = Number(is13Cols ? values[i][11] : values[i][10]) || 0;
    if (summary[size] !== undefined) {
      summary[size] += qty;
    } else if (size) {
      summary[size] = qty;
    }
    totalQty += qty;
    totalAmount += price;
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
