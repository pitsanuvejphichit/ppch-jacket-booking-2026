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
 * ตั้งค่าหัวตาราง Sheet
 */
function applySheetHeaders(sheet) {
  const headers = [
    'รหัสการจอง',
    'วันเวลาที่ลงทะเบียน',
    'รหัสพนักงาน',
    'ชื่อ-นามสกุล',
    'แผนก',
    'ตำแหน่ง',
    'ไซส์เสื้อ',
    'รอบอก (นิ้ว)',
    'จำนวน (ตัว)',
    'ราคาต่อตัว',
    'ยอดประมาณการ (บาท)',
    'สถานะ'
  ];
  
  const range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setBackground('#1E3A8A');
  range.setFontColor('#FFFFFF');
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');
  
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * จัดรูปแบบหัวตาราง Google Sheet ด้วยตนเอง
 */
function setupSheetHeaders() {
  const sheet = getTargetSheet();
  applySheetHeaders(sheet);
  try {
    SpreadsheetApp.getUi().alert('สำเร็จ', 'จัดรูปแบบหัวตารางเรียบร้อยแล้วค่ะ!', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {}
}

/**
 * เมนูเมื่อเปิด Google Sheet
 */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🧥 ระบบลงทะเบียนจองเสื้อ')
      .addItem('⚙️ 1. จัดรูปแบบหัวตารางอัตโนมัติ (Setup)', 'setupSheetHeaders')
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
      message: 'Sheet headers initialized successfully'
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
    
    if (!data.empId || !data.fullName || !data.size) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (รหัสพนักงาน, ชื่อ, ไซส์)'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const sheet = getTargetSheet();
    
    const now = new Date();
    const timestampStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const bookingId = data.bookingId || ('JK-' + Utilities.formatDate(now, 'Asia/Bangkok', 'yyyyMMdd-') + randomHex);
    
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
    
    // ตรวจสอบประวัติการจองเดิม หากมีรหัสพนักงานนี้แล้วให้อัปเดตบรรทัดเดิม
    const values = sheet.getDataRange().getValues();
    let existingRow = -1;
    
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][2]).trim() === String(data.empId).trim()) {
        existingRow = i + 1;
        break;
      }
    }
    
    const rowData = [
      bookingId,
      timestampStr,
      String(data.empId).trim(),
      String(data.fullName).trim(),
      String(data.department || '').trim(),
      String(data.position || '').trim(),
      size,
      chest,
      qty,
      pricePerUnitDesc,
      totalPrice,
      'รอสรุปยอดหลังปิดรับจอง'
    ];
    
    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      isUpdate: existingRow > 0,
      bookingId: bookingId,
      timestamp: timestampStr,
      empId: data.empId,
      fullName: data.fullName,
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
  let totalQty = 0;
  let totalAmount = 0;
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const size = String(row[6] || '').trim().toUpperCase();
    const qty = Number(row[8]) || 0;
    const price = Number(row[10]) || 0;
    
    const item = {
      bookingId: row[0],
      timestamp: row[1],
      empId: row[2],
      fullName: row[3],
      department: row[4],
      position: row[5],
      size: size,
      chest: row[7],
      qty: qty,
      pricePerUnit: row[9],
      totalPrice: price,
      paymentStatus: row[11] || 'รอสรุปยอด'
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
  
  const summary = { 'M': 0, 'L': 0, 'XL': 0, '2XL': 0, '3XL': 0, '4XL': 0 };
  let totalQty = 0;
  let totalAmount = 0;
  
  for (let i = 1; i < values.length; i++) {
    const size = values[i][6];
    const qty = Number(values[i][8]) || 0;
    const price = Number(values[i][10]) || 0;
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
