/**
 * ============================================================================
 * 🧥 ระบบลงทะเบียนจองเสื้อแจ็กเก็ตโรงพยาบาลพิษณุเวช พิจิตร (PITSANUVEJ PHICHIT)
 * ประจำปี 2569 | ระยะเวลาลงทะเบียน 12 - 19 ตุลาคม 2569
 * ฝ่ายพัฒนาทรัพยากรบุคคล (HRD AI Suite)
 * ============================================================================
 */

const CONFIG = {
  SHEET_NAME: 'รายการจองเสื้อ',
  SUMMARY_SHEET_NAME: 'สรุปยอดตามไซส์',
  DEFAULT_PRICE: 500, // ราคาไม่เกิน 500 บาท / ตัว
  START_DATE: '2026-10-12',
  END_DATE: '2026-10-19',
  WEB_URL: 'https://pitsanuvejphichit.github.io/ppch-jacket-booking-2026/'
};

/**
 * เมนูเมื่อเปิด Google Sheet
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🧥 ระบบลงทะเบียนจองเสื้อ')
    .addItem('⚙️ 1. จัดรูปแบบหัวตารางอัตโนมัติ (Setup)', 'setupSheetHeaders')
    .addItem('📊 2. สรุปยอดการจองตามไซส์ (Summary)', 'showSummaryDialog')
    .addSeparator()
    .addItem('🌐 3. เปิดหน้าเว็บลงทะเบียน (GitHub Pages)', 'openWebUrl')
    .addToUi();
}

/**
 * จัดรูปแบบหัวตาราง Google Sheet
 */
function setupSheetHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME, 0);
  }
  
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
  
  SpreadsheetApp.getUi().alert('สำเร็จ', 'จัดรูปแบบหัวตารางเรียบร้อยแล้วค่ะ!', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Handle HTTP GET Requests
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'status';
  
  if (action === 'getSummary' || action === 'getRegistrations') {
    return handleGetRegistrations();
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    appName: 'PPCH Phichit Jacket Registration 2026',
    price: 'ไม่เกิน 500 บาท / ตัว',
    period: '12 - 19 ต.ค. 2569'
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle HTTP POST Requests (บันทึกข้อมูลการจอง)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  
  try {
    // รอ Lock สูงสุด 30 วินาที ป้องกันบันทึกทับซ้อน
    lock.waitLock(30000);
    
    let data;
    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter;
      }
    } else {
      data = e.parameter;
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      setupSheetHeaders();
      sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    }
    
    // ตรวจสอบข้อมูลจำเป็น
    if (!data.empId || !data.fullName || !data.size) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (รหัสพนักงาน, ชื่อ, ไซส์)'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // สร้างรหัสการจอง
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
    
    const size = String(data.size).toUpperCase();
    const chest = chestSizes[size] || 0;
    const qty = parseInt(data.qty, 10) || 1;
    const pricePerUnitDesc = 'ราคาไม่เกิน 500 บาท / ตัว';
    const totalPrice = qty * 500;
    
    // ตรวจสอบว่าเคยจองไว้แล้วหรือไม่ (ถ้าเคยจองจะอัปเดตบรรทัดเดิม)
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
      String(data.paymentStatus || 'รอสรุปยอดหลังปิดรับจอง')
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
      size: size,
      chest: chest,
      qty: qty,
      totalPrice: totalPrice,
      message: existingRow > 0 ? 'อัปเดตข้อมูลการจองเรียบร้อยแล้ว' : 'บันทึกการจองสำเร็จ'
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
 * ดึงรายการจองและสรุปผล
 */
function handleGetRegistrations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      totalCount: 0,
      items: [],
      summaryBySize: {}
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify({
      totalCount: 0,
      items: [],
      summaryBySize: {}
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  const items = [];
  const summaryBySize = { 'M': 0, 'L': 0, 'XL': 0, '2XL': 0, '3XL': 0, '4XL': 0 };
  let totalQty = 0;
  let totalAmount = 0;
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const item = {
      bookingId: row[0],
      timestamp: row[1],
      empId: row[2],
      fullName: row[3],
      department: row[4],
      position: row[5],
      size: row[6],
      chest: row[7],
      qty: row[8],
      pricePerUnit: row[9],
      totalPrice: row[10],
      paymentStatus: row[11]
    };
    items.push(item);
    
    if (summaryBySize[item.size] !== undefined) {
      summaryBySize[item.size] += Number(item.qty) || 0;
    } else {
      summaryBySize[item.size] = Number(item.qty) || 0;
    }
    
    totalQty += Number(item.qty) || 0;
    totalAmount += Number(item.totalPrice) || 0;
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const ui = SpreadsheetApp.getUi();
  
  if (!sheet) {
    ui.alert('ยังไม่มีข้อมูลการจอง');
    return;
  }
  
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    ui.alert('ยังไม่มีข้อมูลการจอง');
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
    } else {
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
  msg += `  - M (รอบอก 40"): ${summary['M']} ตัว\n`;
  msg += `  - L (รอบอก 42"): ${summary['L']} ตัว\n`;
  msg += `  - XL (รอบอก 44"): ${summary['XL']} ตัว\n`;
  msg += `  - 2XL (รอบอก 46"): ${summary['2XL']} ตัว\n`;
  msg += `  - 3XL (รอบอก 48"): ${summary['3XL']} ตัว\n`;
  msg += `  - 4XL (รอบอก 50"): ${summary['4XL']} ตัว\n`;
  
  ui.alert('สรุปยอดการจองเสื้อ', msg, ui.ButtonSet.OK);
}

function openWebUrl() {
  const html = HtmlService.createHtmlOutput(
    '<script>window.open("' + CONFIG.WEB_URL + '", "_blank");google.script.host.close();</script>'
  ).setWidth(200).setHeight(100);
  SpreadsheetApp.getUi().showModalDialog(html, 'กำลังเปิดเว็บ...');
}
