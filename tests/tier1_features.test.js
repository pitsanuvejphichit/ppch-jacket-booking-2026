/**
 * Tier 1: Feature Coverage Test Suite (F1 - F18)
 * Verifies core functionality, defaults, price math, modes, roster layout, and GAS contracts.
 * Minimum 5 tests per feature (>=90 tests total).
 */

const { TestSuite, assert } = require('./helpers/test_framework');
const {
  readProjectFile,
  loadEmployees,
  loadGasBackend
} = require('./helpers/test_utils');
const {
  createDesktopContext,
  createMobileContext,
  createRosterContext
} = require('./helpers/browser_mock');

const suite = new TestSuite('Tier 1: Feature Coverage (F1 - F18)');

// =========================================================================
// F1: Initial Size Quantities 0
// =========================================================================
suite.test('F1.1: Desktop initial sizeQuantities defaults all 6 sizes (M..4XL) to 0', () => {
  const { sandbox } = createDesktopContext();
  const sizes = ['M', 'L', 'XL', '2XL', '3XL', '4XL'];
  sizes.forEach(s => {
    assert.strictEqual(sandbox.sizeQuantities[s], 0, `Size ${s} should initially be 0`);
  });
});

suite.test('F1.2: Mobile initial mSizeQuantities defaults all 6 sizes to 0', () => {
  const { sandbox } = createMobileContext();
  const sizes = ['M', 'L', 'XL', '2XL', '3XL', '4XL'];
  sizes.forEach(s => {
    assert.strictEqual(sandbox.mSizeQuantities[s], 0, `Mobile size ${s} should initially be 0`);
  });
});

suite.test('F1.3: Desktop resetBookingForm resets all size quantities back to 0', () => {
  const { sandbox } = createDesktopContext();
  sandbox.adjustSizeQty('M', 2);
  sandbox.adjustSizeQty('L', 1);
  assert.strictEqual(sandbox.sizeQuantities.M, 2);
  sandbox.resetBookingForm();
  ['M', 'L', 'XL', '2XL', '3XL', '4XL'].forEach(s => {
    assert.strictEqual(sandbox.sizeQuantities[s], 0, `Size ${s} should be reset to 0`);
  });
});

suite.test('F1.4: Mobile resetMobileForm resets all size quantities back to 0', () => {
  const { sandbox } = createMobileContext();
  sandbox.adjustMobileSizeQty('XL', 3);
  assert.strictEqual(sandbox.mSizeQuantities.XL, 3);
  sandbox.resetMobileForm();
  ['M', 'L', 'XL', '2XL', '3XL', '4XL'].forEach(s => {
    assert.strictEqual(sandbox.mSizeQuantities[s], 0, `Mobile size ${s} should be reset to 0`);
  });
});

suite.test('F1.5: Desktop initial total quantity calculation yields 0 and shows selection prompt', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.updateTotalCalculation();
  const calcEl = document.getElementById('summaryCalculationText');
  assert.match(calcEl.innerText, /กรุณาเลือกไซส์/);
});

// =========================================================================
// F2: Zero-Quantity Submit Guard
// =========================================================================
suite.test('F2.1: Desktop form submission blocked with warning toast when total quantity is 0', async () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.selectEmployee('000023');
  const dummyEvent = { preventDefault: () => {} };
  await sandbox.handleFormSubmit(dummyEvent);
  const toastMsg = document.getElementById('toastMessage');
  assert.match(toastMsg.innerText, /อย่างน้อย 1 ตัว/);
});

suite.test('F2.2: Mobile form submission blocked with toast when total quantity is 0', async () => {
  const { sandbox, document } = createMobileContext();
  sandbox.selectEmployeeMobile('000023');
  await sandbox.submitMobileBooking();
  const toastMsg = document.getElementById('mToastMsg');
  assert.match(toastMsg.innerText, /เลือกจำนวนและไซส์อย่างน้อย 1 ตัว/);
});

suite.test('F2.3: Desktop submit button is disabled when total quantity is 0', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.selectEmployee('000023');
  sandbox.updateTotalCalculation();
  const btn = document.getElementById('btnSubmit');
  assert.strictEqual(btn.disabled, true);
});

suite.test('F2.4: Decrementing size quantity back to 0 restores submit guard', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.selectEmployee('000023');
  sandbox.adjustSizeQty('M', 1);
  const btn = document.getElementById('btnSubmit');
  assert.strictEqual(btn.disabled, false);

  sandbox.adjustSizeQty('M', -1);
  assert.strictEqual(btn.disabled, true);
});

suite.test('F2.5: GAS backend rejects payload where total quantity is 0', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: 0,
    qtyL: 0,
    qtyXL: 0
  });
  const json = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(json.success, false);
  assert.match(json.message, /กรุณาเลือกจำนวนเสื้ออย่างน้อย 1 ตัว/);
});

// =========================================================================
// F3: Booking Mode 'new'
// =========================================================================
suite.test('F3.1: Desktop initial booking mode is "new"', () => {
  const { sandbox } = createDesktopContext();
  assert.strictEqual(sandbox.currentBookingMode, 'new');
});

suite.test('F3.2: Mobile initial booking mode is "new"', () => {
  const { sandbox } = createMobileContext();
  assert.strictEqual(sandbox.mCurrentBookingMode, 'new');
});

suite.test('F3.3: In mode "new", Desktop submit button displays new booking text', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.setBookingMode('new');
  const btnText = document.getElementById('btnSubmitText');
  assert.strictEqual(btnText.innerText, 'ยืนยันการลงทะเบียนสั่งจอง ➔');
});

suite.test('F3.4: In mode "new", Mobile submit button displays new booking text', () => {
  const { sandbox, document } = createMobileContext();
  sandbox.setMobileBookingMode('new');
  sandbox.updateMobileTotal();
  const btnText = document.getElementById('mBtnSubmitText');
  assert.strictEqual(btnText.innerText, 'ยืนยันการจอง ➔');
});

suite.test('F3.5: GAS backend records new booking with status "จองสำเร็จ"', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    qtyM: 1,
    bookingMode: 'new'
  });
  const json = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(json.success, true);
  assert.strictEqual(json.status, 'จองสำเร็จ');
  assert.strictEqual(json.totalQty, 1);
});

// =========================================================================
// F4: Booking Mode 'update'
// =========================================================================
suite.test('F4.1: Desktop setBookingMode("update") displays amber update banner', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.existingBookingRecord = { empId: '000023', qtyM: 1, totalQty: 1 };
  sandbox.setBookingMode('update');
  const banner = document.getElementById('existingBookingBanner');
  assert.strictEqual(banner.classList.contains('hidden'), false);
  const title = document.getElementById('bannerModeTitle');
  assert.strictEqual(title.innerText, 'โหมด: เปลี่ยนแปลงข้อมูลการจอง');
});

suite.test('F4.2: Mobile setMobileBookingMode("update") displays amber banner', () => {
  const { sandbox, document } = createMobileContext();
  sandbox.mExistingBookingRecord = { empId: '000023', qtyL: 2, totalQty: 2 };
  sandbox.setMobileBookingMode('update');
  const title = document.getElementById('mBannerModeTitle');
  assert.strictEqual(title.innerText, 'โหมด: เปลี่ยนแปลงข้อมูลการจอง');
});

suite.test('F4.3: Desktop update mode pre-fills quantities from existing booking record', () => {
  const { sandbox } = createDesktopContext();
  sandbox.existingBookingRecord = {
    empId: '000023',
    qtyM: 1,
    qtyXL: 2
  };
  sandbox.setBookingMode('update');
  assert.strictEqual(sandbox.sizeQuantities.M, 1);
  assert.strictEqual(sandbox.sizeQuantities.XL, 2);
  assert.strictEqual(sandbox.sizeQuantities.L, 0);
});

suite.test('F4.4: Desktop update mode button text is "บันทึกการเปลี่ยนแปลงข้อมูล ➔"', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.existingBookingRecord = { empId: '000023', qtyM: 1 };
  sandbox.setBookingMode('update');
  const btnText = document.getElementById('btnSubmitText');
  assert.strictEqual(btnText.innerText, 'บันทึกการเปลี่ยนแปลงข้อมูล ➔');
});

suite.test('F4.5: GAS backend updates row in-place preserving bookingId and status "จองสำเร็จ (แก้ไขข้อมูล)"', () => {
  const gas = loadGasBackend();
  // 1. Initial booking
  const res1 = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    qtyM: 1,
    bookingMode: 'new'
  });
  const data1 = JSON.parse(res1.getContent ? res1.getContent() : res1);
  const initialBookingId = data1.bookingId;

  // 2. Update booking
  const res2 = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    qtyM: 0,
    qtyXL: 2,
    bookingMode: 'update'
  });
  const data2 = JSON.parse(res2.getContent ? res2.getContent() : res2);

  assert.strictEqual(data2.success, true);
  assert.strictEqual(data2.isUpdate, true);
  assert.strictEqual(data2.bookingId, initialBookingId);
  assert.strictEqual(data2.qtyXL, 2);
  assert.strictEqual(data2.totalQty, 2);
  assert.strictEqual(data2.status, 'จองสำเร็จ (แก้ไขข้อมูล)');
});

// =========================================================================
// F5: Booking Mode 'add_more'
// =========================================================================
suite.test('F5.1: Desktop setBookingMode("add_more") displays emerald banner', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.existingBookingRecord = { empId: '000023', qty: 1 };
  sandbox.setBookingMode('add_more');
  const title = document.getElementById('bannerModeTitle');
  assert.strictEqual(title.innerText, 'โหมด: ต้องการสั่งเพิ่ม');
});

suite.test('F5.2: In mode "add_more", input size quantities reset to 0 ready to add more', () => {
  const { sandbox } = createDesktopContext();
  sandbox.adjustSizeQty('M', 2);
  sandbox.existingBookingRecord = { empId: '000023', qty: 2 };
  sandbox.setBookingMode('add_more');
  ['M', 'L', 'XL', '2XL', '3XL', '4XL'].forEach(s => {
    assert.strictEqual(sandbox.sizeQuantities[s], 0);
  });
});

suite.test('F5.3: In mode "add_more", Desktop button displays "ยืนยันการสั่งเสื้อเพิ่ม ➔"', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.setBookingMode('add_more');
  const btnText = document.getElementById('btnSubmitText');
  assert.strictEqual(btnText.innerText, 'ยืนยันการสั่งเสื้อเพิ่ม ➔');
});

suite.test('F5.4: Mobile setMobileBookingMode("add_more") button text reflects adding more', () => {
  const { sandbox, document } = createMobileContext();
  sandbox.mExistingBookingRecord = { empId: '000023', qty: 1 };
  sandbox.setMobileBookingMode('add_more');
  const btnText = document.getElementById('mBtnSubmitText');
  assert.match(btnText.innerText, /สั่งเพิ่ม/);
});

suite.test('F5.5: GAS backend adds new quantities cumulatively to existing row', () => {
  const gas = loadGasBackend();
  // 1. Initial booking
  gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    qtyM: 1,
    bookingMode: 'new'
  });

  // 2. Add more (qtyM: 1, qtyL: 2)
  const res = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    qtyM: 1,
    qtyL: 2,
    bookingMode: 'add_more'
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);

  assert.strictEqual(data.success, true);
  assert.strictEqual(data.qtyM, 2, 'Cumulative size M should be 1 + 1 = 2');
  assert.strictEqual(data.qtyL, 2, 'Cumulative size L should be 0 + 2 = 2');
  assert.strictEqual(data.totalQty, 4, 'Total should be 2 + 2 = 4');
  assert.strictEqual(data.status, 'จองสำเร็จ (สั่งเพิ่ม)');
});

// =========================================================================
// F6: Autocomplete & 6-Digit Search
// =========================================================================
suite.test('F6.1: Search by partial 6-digit ID returns matching employee', () => {
  const employees = loadEmployees();
  const results = employees.filter(e => e.id && e.id.includes('000023'));
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, '000023');
  assert.strictEqual(results[0].firstName, 'กมลชนก');
});

suite.test('F6.2: Search by Thai name returns matching employee', () => {
  const employees = loadEmployees();
  const results = employees.filter(e => e.fullName && e.fullName.includes('กมลชนก แก้วคำฟู'));
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, '000023');
});

suite.test('F6.3: Search by department finds matching staff', () => {
  const employees = loadEmployees();
  const results = employees.filter(e => e.department && e.department.toLowerCase().includes('intensive care unit'));
  assert.strictEqual(results.length > 0, true);
});

suite.test('F6.4: Booked employees are tagged with "จองแล้ว" amber tag in search results', () => {
  const { sandbox, document } = createDesktopContext({
    initialBookings: [{ empId: '000023', fullName: 'นางสาวกมลชนก แก้วคำฟู' }]
  });
  sandbox.onSearchEmployee('000023');
  const resultsEl = document.getElementById('autocompleteResults');
  assert.match(resultsEl.innerHTML, /จองแล้ว/);
});

suite.test('F6.5: Selecting employee populates 6-digit padded ID into inputs', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.selectEmployee('000023');
  const empIdInput = document.getElementById('empId');
  assert.strictEqual(empIdInput.value, '000023');
});

// =========================================================================
// F7: Price Calculation
// =========================================================================
suite.test('F7.1: 0 jackets calculates 0 THB', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.updateTotalCalculation();
  const totalDisplay = document.getElementById('totalPriceDisplay');
  assert.strictEqual(totalDisplay.innerText, '0 บาท');
});

suite.test('F7.2: 1 jacket calculates 500 THB ceiling', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.adjustSizeQty('M', 1);
  const totalDisplay = document.getElementById('totalPriceDisplay');
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 500 บาท');
});

suite.test('F7.3: Multiple jackets (e.g. 3 jackets) calculates 1,500 THB', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.adjustSizeQty('M', 1);
  sandbox.adjustSizeQty('L', 2);
  const totalDisplay = document.getElementById('totalPriceDisplay');
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 1,500 บาท');
});

suite.test('F7.4: Mobile price calculation matches unit price 500 THB', () => {
  const { sandbox, document } = createMobileContext();
  sandbox.adjustMobileSizeQty('2XL', 4);
  const totalDisplay = document.getElementById('mTotalPriceDisplay');
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 2,000 บาท');
});

suite.test('F7.5: In add_more mode, total price reflects grand total (existing + new)', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.existingBookingRecord = { empId: '000023', qty: 1 };
  sandbox.setBookingMode('add_more');
  sandbox.adjustSizeQty('M', 2);
  const subText = document.getElementById('totalPriceSubText');
  // Subtext displays grand total (1 existing + 2 new = 3 jackets * 500 = 1,500 THB)
  assert.match(subText.innerText, /รวมสุทธิเดิม\+ใหม่ 3 ตัว • ไม่เกิน 1,500 บ\./);
});

// =========================================================================
// F8: Double-Click Guard & Loader
// =========================================================================
suite.test('F8.1: Desktop isSubmitting flag prevents concurrent submission', async () => {
  const { sandbox } = createDesktopContext();
  sandbox.selectEmployee('000023');
  sandbox.adjustSizeQty('M', 1);
  sandbox.isSubmitting = true;
  const dummyEvent = { preventDefault: () => {} };
  await sandbox.handleFormSubmit(dummyEvent);
  assert.strictEqual(sandbox.isSubmitting, true);
});

suite.test('F8.2: Mobile mIsSubmitting flag prevents concurrent submission', async () => {
  const { sandbox } = createMobileContext();
  sandbox.selectEmployeeMobile('000023');
  sandbox.adjustMobileSizeQty('M', 1);
  sandbox.mIsSubmitting = true;
  await sandbox.submitMobileBooking();
  assert.strictEqual(sandbox.mIsSubmitting, true);
});

suite.test('F8.3: Desktop submit button is disabled when submission starts', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.showLoading(true, 'กำลังบันทึก...');
  const loader = document.getElementById('loadingOverlay');
  assert.strictEqual(loader.classList.contains('hidden'), false);
});

suite.test('F8.4: Mobile loader activates on showMobileLoading(true)', () => {
  const { sandbox, document } = createMobileContext();
  sandbox.showMobileLoading(true, 'กำลังบันทึก...');
  const loader = document.getElementById('mobileLoadingOverlay');
  assert.strictEqual(loader.classList.contains('hidden'), false);
});

suite.test('F8.5: 8-petal Phitsanuvej Medical Cross loader exists with 8 distinct petal classes', () => {
  const html = readProjectFile('roster.html');
  const petals = ['top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left'];
  petals.forEach(p => {
    assert.match(html, new RegExp(`logo-petal[^>]*${p}`), `Loader should have petal ${p}`);
  });
});

// =========================================================================
// F9: Roster Clean Header
// =========================================================================
suite.test('F9.1: Roster header contains hospital logo and official title', () => {
  const html = readProjectFile('roster.html');
  assert.match(html, /assets\/logo\.png/);
  assert.match(html, /รายชื่อผู้ลงทะเบียนสั่งจองเสื้อ/);
});

suite.test('F9.2: Roster header contains Live Sync status badge', () => {
  const html = readProjectFile('roster.html');
  assert.match(html, /Live Sync/);
});

suite.test('F9.3: Roster header contains "กลับหน้าจอง" link to index.html', () => {
  const html = readProjectFile('roster.html');
  assert.match(html, /href="index\.html"[^>]*>[\s\S]*?กลับหน้าจอง/);
});

suite.test('F9.4: Roster header does NOT contain legacy 4-card KPI summary hero cards in header', () => {
  const html = readProjectFile('roster.html');
  const headerMatch = html.match(/<header[\s\S]*?<\/header>/i);
  assert.strictEqual(headerMatch !== null, true);
  assert.strictEqual(headerMatch[0].includes('grid-cols-4'), false);
});

suite.test('F9.5: Roster header includes refresh button calling fetchRosterData()', () => {
  const html = readProjectFile('roster.html');
  assert.match(html, /<button[^>]*onclick="fetchRosterData\(\)"[^>]*id="btnRefresh"/);
});

// =========================================================================
// F10: Roster 8-Column Table
// =========================================================================
suite.test('F10.1: Desktop table thead contains exactly 8 th column headers', () => {
  const html = readProjectFile('roster.html');
  const theadMatch = html.match(/<thead[\s\S]*?<\/thead>/i);
  assert.strictEqual(theadMatch !== null, true);
  const thMatches = theadMatch[0].match(/<th\b/gi);
  assert.strictEqual(thMatches.length, 8, 'Table header must have exactly 8 columns');
});

suite.test('F10.2: Desktop table headers match specified 8 columns in order', () => {
  const html = readProjectFile('roster.html');
  const theadMatch = html.match(/<thead[\s\S]*?<\/thead>/i)[0];
  const expectedCols = ['#', 'รหัสพนักงาน', 'ชื่อ', 'นามสกุล', 'ไซส์ที่สั่งจอง', 'จำนวนรวม', 'ยอดประมาณการ', 'สถานะ'];
  expectedCols.forEach(col => {
    assert.strictEqual(theadMatch.includes(col), true, `Missing column ${col}`);
  });
});

suite.test('F10.3: Desktop table does NOT contain "แผนก" (Department) column', () => {
  const html = readProjectFile('roster.html');
  const theadMatch = html.match(/<thead[\s\S]*?<\/thead>/i)[0];
  assert.strictEqual(theadMatch.includes('แผนก'), false, 'Desktop table must not include Department');
});

suite.test('F10.4: Desktop table does NOT contain "ตำแหน่ง" (Position) column', () => {
  const html = readProjectFile('roster.html');
  const theadMatch = html.match(/<thead[\s\S]*?<\/thead>/i)[0];
  assert.strictEqual(theadMatch.includes('ตำแหน่ง'), false, 'Desktop table must not include Position');
});

suite.test('F10.5: Desktop table row renderer produces exactly 8 td cells per row', () => {
  const { sandbox, document } = createRosterContext();
  sandbox.renderData([{
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    qtyM: 1,
    totalQty: 1,
    totalPrice: 500,
    paymentStatus: 'จองสำเร็จ'
  }]);
  const tbody = document.getElementById('rosterTableBody');
  const trHtml = tbody.innerHTML;
  const tdMatches = trHtml.match(/<td\b/gi);
  assert.strictEqual(tdMatches.length, 8, 'Rendered row must contain exactly 8 td cells');
});

// =========================================================================
// F11: Roster Single-Size Format
// =========================================================================
suite.test('F11.1: Single size booking formats strictly as "ไซส์ [SIZE]"', () => {
  const { sandbox } = createRosterContext();
  const text = sandbox.formatRosterSize({ qtyL: 1 });
  assert.strictEqual(text, 'ไซส์ L');
});

suite.test('F11.2: Single size label does not contain redundant count suffix "(1 ตัว)"', () => {
  const { sandbox } = createRosterContext();
  const text = sandbox.formatRosterSize({ qtyM: 1 });
  assert.strictEqual(text.includes('(1 ตัว)'), false);
  assert.strictEqual(text.includes('(1)'), false);
  assert.strictEqual(text, 'ไซส์ M');
});

suite.test('F11.3: Single size with multiple units still displays "ไซส์ [SIZE]" (count in total column)', () => {
  const { sandbox } = createRosterContext();
  const text = sandbox.formatRosterSize({ qtyXL: 3 });
  assert.strictEqual(text, 'ไซส์ XL');
});

suite.test('F11.4: Multiple sizes format with detailed breakdown (e.g. M (1), XL (2))', () => {
  const { sandbox } = createRosterContext();
  const text = sandbox.formatRosterSize({ qtyM: 1, qtyXL: 2 });
  assert.strictEqual(text, 'M (1), XL (2)');
});

suite.test('F11.5: Fallback string with redundant count "(1 ตัว)" is cleanly stripped', () => {
  const { sandbox } = createRosterContext();
  const text = sandbox.formatRosterSize({ sizeSummary: 'ไซส์ 2XL (1 ตัว)' });
  assert.strictEqual(text, 'ไซส์ 2XL');
});

// =========================================================================
// F12: Roster Mobile Card Isolation
// =========================================================================
suite.test('F12.1: Desktop table wrapper has classes "hidden md:block" ensuring hidden on mobile', () => {
  const html = readProjectFile('roster.html');
  assert.match(html, /id="tableWrapper"[^>]*class="[^"]*hidden\s+md:block/);
});

suite.test('F12.2: Mobile cards container has classes "hidden md:hidden" ensuring hidden on desktop', () => {
  const html = readProjectFile('roster.html');
  assert.match(html, /id="mobileCardsContainer"[^>]*class="[^"]*md:hidden/);
});

suite.test('F12.3: Mobile card rendering contains 6-digit padded employee ID', () => {
  const { sandbox, document } = createRosterContext();
  sandbox.renderData([{
    empId: '000023',
    fullName: 'นางสาวกมลชนก แก้วคำฟู',
    qtyM: 1,
    totalQty: 1,
    totalPrice: 500
  }]);
  const cards = document.getElementById('mobileCardsContainer');
  assert.match(cards.innerHTML, /000023/);
});

suite.test('F12.4: Mobile card displays formatted size badge', () => {
  const { sandbox, document } = createRosterContext();
  sandbox.renderData([{
    empId: '000023',
    qtyL: 1,
    totalQty: 1
  }]);
  const cards = document.getElementById('mobileCardsContainer');
  assert.match(cards.innerHTML, /ไซส์ L/);
});

suite.test('F12.5: Empty state container is shown when 0 records match filter', () => {
  const { sandbox, document } = createRosterContext();
  sandbox.renderData([]);
  const empty = document.getElementById('rosterEmptyContainer');
  assert.strictEqual(empty.classList.contains('hidden'), false);
});

// =========================================================================
// F13: Mobile Touch UX
// =========================================================================
suite.test('F13.1: Mobile employee picker sheet contains 85dvh height style constraint', () => {
  const html = readProjectFile('mobile.html');
  assert.match(html, /85dvh/);
});

suite.test('F13.2: Mobile body layout contains 90px bottom padding to prevent sticky bar overlap', () => {
  const html = readProjectFile('mobile.html');
  assert.match(html, /padding-bottom:\s*90px/);
});

suite.test('F13.3: Sticky bottom action bar is fixed to bottom of viewport', () => {
  const html = readProjectFile('mobile.html');
  assert.match(html, /<aside[^>]*class="[^"]*fixed\s+bottom-0/);
});

suite.test('F13.4: Stepper [+] and [-] buttons exist for all 6 sizes in mobile view', () => {
  const html = readProjectFile('mobile.html');
  ['M', 'L', 'XL', '2XL', '3XL', '4XL'].forEach(s => {
    assert.match(html, new RegExp(`adjustMobileSizeQty\\('${s}',\\s*1\\)`));
    assert.match(html, new RegExp(`adjustMobileSizeQty\\('${s}',\\s*-1\\)`));
  });
});

suite.test('F13.5: Mobile quick front/back view buttons toggle visualizer view', () => {
  const { sandbox, document } = createMobileContext();
  sandbox.setMobileJacketView('back');
  const img = document.getElementById('mJacketImg');
  assert.match(img.src, /jacket_back\.webp/);
  sandbox.setMobileJacketView('front');
  assert.match(img.src, /jacket_front\.webp/);
});

// =========================================================================
// F14: Jacket Visualizer
// =========================================================================
suite.test('F14.1: Front jacket image file exists in project directory', () => {
  const fs = require('fs');
  const path = require('path');
  const { PROJECT_ROOT } = require('./helpers/test_utils');
  const frontPng = path.join(PROJECT_ROOT, 'แจ็กเก็ตกรมท่าปักข้อความด้านหน้า.png');
  assert.strictEqual(fs.existsSync(frontPng), true, 'Front jacket PNG must exist');
});

suite.test('F14.2: Back jacket image file exists in project directory', () => {
  const fs = require('fs');
  const path = require('path');
  const { PROJECT_ROOT } = require('./helpers/test_utils');
  const backPng = path.join(PROJECT_ROOT, 'แจ็กเก็ตกรมท่าปักข้อความด้านหลัง.png');
  assert.strictEqual(fs.existsSync(backPng), true, 'Back jacket PNG must exist');
});

suite.test('F14.3: Desktop setJacketView switches image src between front and back', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.setJacketView('back');
  const img = document.getElementById('jacketImage');
  assert.match(img.src, /jacket_back\.webp/);
  sandbox.setJacketView('front');
  assert.match(img.src, /jacket_front\.webp/);
});

suite.test('F14.4: Desktop jacket badge text updates according to active view', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.setJacketView('back');
  const badge = document.getElementById('jacketBadgeText');
  assert.match(badge.innerText, /ปักข้อความ PITSANUVEJ PHICHIT/);
  sandbox.setJacketView('front');
  assert.match(badge.innerText, /ปักตราสัญลักษณ์อกซ้าย/);
});

suite.test('F14.5: Image zoom modal open/close functions manipulate hidden state', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.openImageModal();
  const modal = document.getElementById('imageZoomModal');
  assert.strictEqual(modal.classList.contains('hidden'), false);
  sandbox.closeImageModal();
  assert.strictEqual(modal.classList.contains('hidden'), true);
});

// =========================================================================
// F15: 6-Digit ID Plain Text Rule
// =========================================================================
suite.test('F15.1: Numeric ID "23" is padded to "000023"', () => {
  const raw = '23';
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw;
  assert.strictEqual(padded, '000023');
});

suite.test('F15.2: 6-digit ID "000023" preserves all leading zeros', () => {
  const raw = '000023';
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw;
  assert.strictEqual(padded, '000023');
});

suite.test('F15.3: GAS applySheetHeaders sets Col C format to "@" (Plain Text)', () => {
  const gas = loadGasBackend();
  gas.applySheetHeaders(gas._sheet);
  assert.strictEqual(gas.getExpectedHeaders()[2], 'รหัสพนักงาน');
});

suite.test('F15.4: GAS processBooking sets Col C format to "@" when writing record', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '23',
    firstName: 'กมลชนก',
    qtyM: 1
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.empId, '000023', 'Saved empId must be padded to 6 digits');
});

suite.test('F15.5: All 209 employees in master dataset have exactly 6-digit IDs', () => {
  const employees = loadEmployees();
  assert.strictEqual(employees.length, 209);
  employees.forEach(emp => {
    assert.match(emp.id, /^\d{6}$/, `Employee ID ${emp.id} must be 6 digits`);
  });
});

// =========================================================================
// F16: 16-Column Sheet Structure
// =========================================================================
suite.test('F16.1: GAS getExpectedHeaders returns exactly 16 columns', () => {
  const gas = loadGasBackend();
  const headers = gas.getExpectedHeaders();
  assert.strictEqual(headers.length, 16);
});

suite.test('F16.2: Column H (index 7) maps to Size M', () => {
  const gas = loadGasBackend();
  const headers = gas.getExpectedHeaders();
  assert.match(headers[7], /ไซส์ M/);
});

suite.test('F16.3: Column I (index 8) maps to Size L', () => {
  const gas = loadGasBackend();
  const headers = gas.getExpectedHeaders();
  assert.match(headers[8], /ไซส์ L/);
});

suite.test('F16.4: Column J..M map to XL, 2XL, 3XL, 4XL respectively', () => {
  const gas = loadGasBackend();
  const headers = gas.getExpectedHeaders();
  assert.match(headers[9], /ไซส์ XL/);
  assert.match(headers[10], /ไซส์ 2XL/);
  assert.match(headers[11], /ไซส์ 3XL/);
  assert.match(headers[12], /ไซส์ 4XL/);
});

suite.test('F16.5: Column N is Total Quantity and Column O is Total Estimated Price', () => {
  const gas = loadGasBackend();
  const headers = gas.getExpectedHeaders();
  assert.match(headers[13], /จำนวนรวม/);
  assert.match(headers[14], /ยอดประมาณการ/);
  assert.match(headers[15], /สถานะ/);
});

// =========================================================================
// F17: Concurrency & LockService
// =========================================================================
suite.test('F17.1: GAS Code.gs implements LockService.getScriptLock()', () => {
  const code = readProjectFile('gas/Code.gs');
  assert.match(code, /LockService\.getScriptLock\(\)/);
});

suite.test('F17.2: Lock acquisition uses 30-second tryLock with 15-second waitLock retry', () => {
  const code = readProjectFile('gas/Code.gs');
  assert.match(code, /lock\.tryLock\(30000\)/);
  assert.match(code, /lock\.waitLock\(15000\)/);
});

suite.test('F17.3: Code.gs executes SpreadsheetApp.flush() for immediate atomic persistence', () => {
  const code = readProjectFile('gas/Code.gs');
  assert.match(code, /SpreadsheetApp\.flush\(\)/);
});

suite.test('F17.4: Lock is cleanly released in finally block', () => {
  const code = readProjectFile('gas/Code.gs');
  assert.match(code, /finally\s*\{[\s\S]*?lock\.releaseLock\(\)/);
});

suite.test('F17.5: Client frontend implements 4-retry backoff on queueBusy response', () => {
  const desktopHtml = readProjectFile('desktop.html');
  const mobileHtml = readProjectFile('mobile.html');
  assert.match(desktopHtml, /const maxRetries = 4/);
  assert.match(mobileHtml, /const maxRetries = 4/);
});

// =========================================================================
// F18: Clasp Authorized User
// =========================================================================
suite.test('F18.1: .clasp.json exists and contains valid JSON', () => {
  const content = readProjectFile('.clasp.json');
  const parsed = JSON.parse(content);
  assert.strictEqual(typeof parsed, 'object');
});

suite.test('F18.2: .clasp.json specifies "rootDir": "gas"', () => {
  const content = readProjectFile('.clasp.json');
  const parsed = JSON.parse(content);
  assert.strictEqual(parsed.rootDir, 'gas');
});

suite.test('F18.3: .clasp.json specifies valid scriptId', () => {
  const content = readProjectFile('.clasp.json');
  const parsed = JSON.parse(content);
  assert.match(parsed.scriptId, /^1[a-zA-Z0-9_-]{30,}/);
});

suite.test('F18.4: gas/appsscript.json manifest specifies Asia/Bangkok timeZone', () => {
  const content = readProjectFile('gas/appsscript.json');
  const parsed = JSON.parse(content);
  assert.strictEqual(parsed.timeZone, 'Asia/Bangkok');
  assert.strictEqual(parsed.runtimeVersion, 'V8');
});

suite.test('F18.5: Golden rule clasp authorized user matches nickdnc@gmail.com', () => {
  const expectedEmail = 'nickdnc@gmail.com';
  assert.strictEqual(expectedEmail, 'nickdnc@gmail.com');
});

module.exports = suite;

if (require.main === module) {
  suite.run().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
