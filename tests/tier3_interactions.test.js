/**
 * Tier 3: Cross-Feature Interactions Test Suite
 * Tests mode transitions (new -> update -> add_more -> new), switching booked vs unbooked employees,
 * multi-size vs single-size combinations, and form state lifecycles.
 */

const { TestSuite, assert } = require('./helpers/test_framework');
const {
  loadGasBackend
} = require('./helpers/test_utils');
const {
  createDesktopContext,
  createMobileContext,
  createRosterContext
} = require('./helpers/browser_mock');

const suite = new TestSuite('Tier 3: Cross-Feature Interactions');

// =========================================================================
// 1. Mode Transitions Cycle (new -> update -> add_more -> update -> new)
// =========================================================================
suite.test('I1.1: Desktop mode cycle: transitions banner and button states correctly', () => {
  const { sandbox, document } = createDesktopContext();
  const banner = document.getElementById('existingBookingBanner');
  const btnText = document.getElementById('btnSubmitText');
  sandbox.existingBookingRecord = { empId: '000023', qtyM: 1, totalQty: 1 };

  // 1. Initial 'new'
  sandbox.setBookingMode('new');
  assert.strictEqual(sandbox.currentBookingMode, 'new');
  assert.strictEqual(banner.classList.contains('hidden'), true);
  assert.strictEqual(btnText.innerText, 'ยืนยันการลงทะเบียนสั่งจอง ➔');

  // 2. Transition to 'update'
  sandbox.setBookingMode('update');
  assert.strictEqual(sandbox.currentBookingMode, 'update');
  assert.strictEqual(banner.classList.contains('hidden'), false);
  assert.strictEqual(btnText.innerText, 'บันทึกการเปลี่ยนแปลงข้อมูล ➔');

  // 3. Transition to 'add_more'
  sandbox.setBookingMode('add_more');
  assert.strictEqual(sandbox.currentBookingMode, 'add_more');
  assert.strictEqual(banner.classList.contains('hidden'), false);
  assert.strictEqual(btnText.innerText, 'ยืนยันการสั่งเสื้อเพิ่ม ➔');

  // 4. Toggle back to 'update'
  sandbox.toggleBookingMode();
  assert.strictEqual(sandbox.currentBookingMode, 'update');
  assert.strictEqual(btnText.innerText, 'บันทึกการเปลี่ยนแปลงข้อมูล ➔');

  // 5. Reset to 'new'
  sandbox.setBookingMode('new');
  assert.strictEqual(sandbox.currentBookingMode, 'new');
  assert.strictEqual(banner.classList.contains('hidden'), true);
  assert.strictEqual(btnText.innerText, 'ยืนยันการลงทะเบียนสั่งจอง ➔');
});

suite.test('I1.2: Mobile mode toggle switches back and forth between update and add_more', () => {
  const { sandbox, document } = createMobileContext();
  sandbox.mExistingBookingRecord = { empId: '000023', qtyL: 1 };
  
  sandbox.setMobileBookingMode('update');
  assert.strictEqual(sandbox.mCurrentBookingMode, 'update');

  sandbox.toggleMobileBookingMode();
  assert.strictEqual(sandbox.mCurrentBookingMode, 'add_more');

  sandbox.toggleMobileBookingMode();
  assert.strictEqual(sandbox.mCurrentBookingMode, 'update');
});

// =========================================================================
// 2. Switching Booked vs Unbooked Employees
// =========================================================================
suite.test('I2.1: Selecting booked employee detects existing booking in allBookings', () => {
  const existingBookings = [
    { empId: '000023', fullName: 'นางสาวกมลชนก แก้วคำฟู', qtyM: 1, totalQty: 1 }
  ];
  const { sandbox, document } = createDesktopContext({ initialBookings: existingBookings });

  sandbox.selectEmployee('000023');
  assert.strictEqual(sandbox.existingBookingRecord !== null, true);
  assert.strictEqual(sandbox.existingBookingRecord.empId, '000023');
});

suite.test('I2.2: Selecting unbooked employee sets mode to new and clears existing record', () => {
  const existingBookings = [
    { empId: '000023', fullName: 'นางสาวกมลชนก แก้วคำฟู', qtyM: 1 }
  ];
  const { sandbox } = createDesktopContext({ initialBookings: existingBookings });

  // 1. Select booked employee
  sandbox.selectEmployee('000023');
  assert.strictEqual(sandbox.existingBookingRecord !== null, true);

  // 2. Select unbooked employee (015372)
  sandbox.selectEmployee('015372');
  assert.strictEqual(sandbox.existingBookingRecord, null);
  assert.strictEqual(sandbox.currentBookingMode, 'new');
});

suite.test('I2.3: Switching from booked to unbooked employee hides existing booking banner', () => {
  const existingBookings = [
    { empId: '000023', fullName: 'นางสาวกมลชนก แก้วคำฟู', qtyM: 1 }
  ];
  const { sandbox, document } = createDesktopContext({ initialBookings: existingBookings });

  sandbox.selectEmployee('000023');
  sandbox.setBookingMode('update');
  const banner = document.getElementById('existingBookingBanner');
  assert.strictEqual(banner.classList.contains('hidden'), false);

  sandbox.selectEmployee('015372');
  assert.strictEqual(banner.classList.contains('hidden'), true);
});

suite.test('I2.4: Clearing selected employee resets employee card and search bar', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.selectEmployee('000023');
  const card = document.getElementById('selectedEmployeeCard');
  assert.strictEqual(card.classList.contains('hidden'), false);

  sandbox.clearSelectedEmployee();
  assert.strictEqual(card.classList.contains('hidden'), true);
  assert.strictEqual(sandbox.selectedEmployee, null);
  assert.strictEqual(sandbox.currentBookingMode, 'new');
});

suite.test('I2.5: Mobile selecting booked employee updates existing booking state', () => {
  const existingBookings = [
    { empId: '000023', fullName: 'นางสาวกมลชนก แก้วคำฟู', qtyL: 2 }
  ];
  const { sandbox } = createMobileContext({ initialBookings: existingBookings });

  sandbox.selectEmployeeMobile('000023');
  assert.strictEqual(sandbox.mExistingBookingRecord !== null, true);
  assert.strictEqual(sandbox.mSelectedEmployee.id, '000023');
});

// =========================================================================
// 3. Multi-Size vs Single-Size Combinations
// =========================================================================
suite.test('I3.1: Single size transition to multiple sizes updates label from single to breakdown', () => {
  const { sandbox } = createRosterContext();

  // 1. Single size (1 L)
  let label = sandbox.formatRosterSize({ qtyL: 1 });
  assert.strictEqual(label, 'ไซส์ L');

  // 2. Transition to multi size (1 L + 1 XL)
  label = sandbox.formatRosterSize({ qtyL: 1, qtyXL: 1 });
  assert.strictEqual(label, 'L (1), XL (1)');

  // 3. Transition back to single size (2 XL)
  label = sandbox.formatRosterSize({ qtyXL: 2 });
  assert.strictEqual(label, 'ไซส์ XL');
});

suite.test('I3.2: Price and summary calculation reactivity as sizes are added and removed', () => {
  const { sandbox, document } = createDesktopContext();
  const totalDisplay = document.getElementById('totalPriceDisplay');

  // Add 1 M -> 500 THB
  sandbox.adjustSizeQty('M', 1);
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 500 บาท');

  // Add 2 L -> 3 total -> 1,500 THB
  sandbox.adjustSizeQty('L', 2);
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 1,500 บาท');

  // Add 1 4XL -> 4 total -> 2,000 THB
  sandbox.adjustSizeQty('4XL', 1);
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 2,000 บาท');

  // Remove 2 L -> 2 total -> 1,000 THB
  sandbox.adjustSizeQty('L', -2);
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 1,000 บาท');

  // Remove remaining -> 0 THB
  sandbox.adjustSizeQty('M', -1);
  sandbox.adjustSizeQty('4XL', -1);
  assert.strictEqual(totalDisplay.innerText, '0 บาท');
});

suite.test('I3.3: In update mode, changing multi-size selections recalculates price properly', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.existingBookingRecord = { empId: '000023', qtyM: 1, qtyL: 1, totalQty: 2 };
  sandbox.setBookingMode('update');

  const totalDisplay = document.getElementById('totalPriceDisplay');
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 1,000 บาท');

  // Modify to 3 XL only
  sandbox.adjustSizeQty('M', -1);
  sandbox.adjustSizeQty('L', -1);
  sandbox.adjustSizeQty('XL', 3);
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 1,500 บาท');
});

suite.test('I3.4: In add_more mode, adding multi-size jackets updates increment and grand total', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.existingBookingRecord = { empId: '000023', qty: 1 };
  sandbox.setBookingMode('add_more');

  // Add 1 L + 1 XL (2 added)
  sandbox.adjustSizeQty('L', 1);
  sandbox.adjustSizeQty('XL', 1);

  const totalDisplay = document.getElementById('totalPriceDisplay');
  const subText = document.getElementById('totalPriceSubText');

  assert.strictEqual(totalDisplay.innerText, '+1,000 บ.');
  assert.match(subText.innerText, /รวมสุทธิเดิม\+ใหม่ 3 ตัว • ไม่เกิน 1,500 บ\./);
});

// =========================================================================
// 4. Booking Submission Lifecycle & Backend Transitions
// =========================================================================
suite.test('I4.1: Full lifecycle: new booking -> update booking -> add_more booking in GAS backend', () => {
  const gas = loadGasBackend();

  // Step 1: New booking
  const res1 = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    qtyM: 1,
    bookingMode: 'new'
  });
  const data1 = JSON.parse(res1.getContent ? res1.getContent() : res1);
  assert.strictEqual(data1.success, true);
  assert.strictEqual(data1.totalQty, 1);
  assert.strictEqual(data1.status, 'จองสำเร็จ');

  // Step 2: Update booking (change M: 1 to L: 2)
  const res2 = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    qtyM: 0,
    qtyL: 2,
    bookingMode: 'update'
  });
  const data2 = JSON.parse(res2.getContent ? res2.getContent() : res2);
  assert.strictEqual(data2.success, true);
  assert.strictEqual(data2.isUpdate, true);
  assert.strictEqual(data2.qtyL, 2);
  assert.strictEqual(data2.totalQty, 2);
  assert.strictEqual(data2.status, 'จองสำเร็จ (แก้ไขข้อมูล)');

  // Step 3: Add more booking (add 1 XL)
  const res3 = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    qtyL: 0,
    qtyXL: 1,
    bookingMode: 'add_more'
  });
  const data3 = JSON.parse(res3.getContent ? res3.getContent() : res3);
  assert.strictEqual(data3.success, true);
  assert.strictEqual(data3.qtyL, 2, 'L should still be 2');
  assert.strictEqual(data3.qtyXL, 1, 'XL should now be 1');
  assert.strictEqual(data3.totalQty, 3, 'Total should be 2 + 1 = 3');
  assert.strictEqual(data3.status, 'จองสำเร็จ (สั่งเพิ่ม)');
});

suite.test('I4.2: GAS backend does not create duplicate rows when updating or adding more', () => {
  const gas = loadGasBackend();
  // New booking
  gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: 1,
    bookingMode: 'new'
  });
  const rowCountAfterNew = gas._sheet.getLastRow();

  // Update
  gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyL: 2,
    bookingMode: 'update'
  });
  const rowCountAfterUpdate = gas._sheet.getLastRow();
  assert.strictEqual(rowCountAfterUpdate, rowCountAfterNew, 'Row count must not increase on update');

  // Add more
  gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyXL: 1,
    bookingMode: 'add_more'
  });
  const rowCountAfterAddMore = gas._sheet.getLastRow();
  assert.strictEqual(rowCountAfterAddMore, rowCountAfterNew, 'Row count must not increase on add_more');
});

suite.test('I4.3: Resetting form clears selected employee, input badges, and size cards', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.selectEmployee('000023');
  sandbox.adjustSizeQty('M', 2);
  sandbox.resetBookingForm();

  assert.strictEqual(sandbox.selectedEmployee, null);
  assert.strictEqual(sandbox.sizeQuantities.M, 0);
  const cardBadgeM = document.getElementById('cardBadge_M');
  assert.strictEqual(cardBadgeM.classList.contains('hidden'), true);
});

// =========================================================================
// 5. Cross-Platform Consistency
// =========================================================================
suite.test('I5.1: Desktop and Mobile calculate price identically for 3 jackets (1,500 THB)', () => {
  const desktop = createDesktopContext();
  const mobile = createMobileContext();

  desktop.sandbox.adjustSizeQty('L', 3);
  mobile.sandbox.adjustMobileSizeQty('L', 3);

  const desktopPrice = desktop.document.getElementById('totalPriceDisplay');
  const mobilePrice = mobile.document.getElementById('mTotalPriceDisplay');

  assert.strictEqual(desktopPrice.innerText, 'ไม่เกิน 1,500 บาท');
  assert.strictEqual(mobilePrice.innerText, 'ไม่เกิน 1,500 บาท');
});

suite.test('I5.2: Desktop and Mobile both guard against zero-quantity submission', async () => {
  const desktop = createDesktopContext();
  const mobile = createMobileContext();

  desktop.sandbox.selectEmployee('000023');
  mobile.sandbox.selectEmployeeMobile('000023');

  // Both have 0 quantities selected
  const dummyEvent = { preventDefault: () => {} };
  await desktop.sandbox.handleFormSubmit(dummyEvent);
  await mobile.sandbox.submitMobileBooking();

  const desktopToast = desktop.document.getElementById('toastMessage');
  const mobileToast = mobile.document.getElementById('mToastMsg');

  assert.match(desktopToast.innerText, /อย่างน้อย 1 ตัว/);
  assert.match(mobileToast.innerText, /อย่างน้อย 1 ตัว/);
});

suite.test('I3.5: Mobile dynamic price reactivity when selecting and deselecting sizes', () => {
  const { sandbox, document } = createMobileContext();
  const totalDisplay = document.getElementById('mTotalPriceDisplay');

  sandbox.adjustMobileSizeQty('M', 1);
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 500 บาท');

  sandbox.adjustMobileSizeQty('XL', 2);
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 1,500 บาท');

  sandbox.adjustMobileSizeQty('M', -1);
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 1,000 บาท');

  sandbox.adjustMobileSizeQty('XL', -2);
  assert.strictEqual(totalDisplay.innerText, 'ไม่เกิน 0 บาท');
});

suite.test('I4.4: In Desktop update mode, resetting form resets mode to "new" and clears pre-filled quantities', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.existingBookingRecord = { empId: '000023', qtyM: 2 };
  sandbox.setBookingMode('update');
  assert.strictEqual(sandbox.sizeQuantities.M, 2);

  sandbox.resetBookingForm();
  assert.strictEqual(sandbox.currentBookingMode, 'new');
  assert.strictEqual(sandbox.sizeQuantities.M, 0);
  assert.strictEqual(document.getElementById('existingBookingBanner').classList.contains('hidden'), true);
});

suite.test('I4.5: GAS handleGetRegistrations reflects updated totals and breakdown after multi-mode bookings', () => {
  const gas = loadGasBackend();
  // Employee 1 (new, 2 L)
  gas.processBooking({ empId: '000023', firstName: 'กมลชนก', qtyL: 2, bookingMode: 'new' });
  // Employee 2 (new, 1 M)
  gas.processBooking({ empId: '015372', firstName: 'สุวัฒน์ชัย', qtyM: 1, bookingMode: 'new' });
  // Employee 2 (add_more, 1 XL)
  gas.processBooking({ empId: '015372', firstName: 'สุวัฒน์ชัย', qtyXL: 1, bookingMode: 'add_more' });

  const res = gas.handleGetRegistrations();
  const data = JSON.parse(res.getContent ? res.getContent() : res);

  assert.strictEqual(data.totalBookings, 2);
  assert.strictEqual(data.totalQty, 4, '2 L + 1 M + 1 XL = 4 total');
  assert.strictEqual(data.summaryBySize.L, 2);
  assert.strictEqual(data.summaryBySize.M, 1);
  assert.strictEqual(data.summaryBySize.XL, 1);
  assert.strictEqual(data.totalAmount, 2000);
});

suite.test('I5.3: Autocomplete query matching behaves consistently across Desktop and Mobile datasets', () => {
  const desktop = createDesktopContext();
  const mobile = createMobileContext();

  desktop.sandbox.onSearchEmployee('000023');
  mobile.sandbox.filterSheetEmployees('000023');

  const desktopResults = desktop.document.getElementById('autocompleteResults');
  const mobileList = mobile.document.getElementById('mSheetEmployeeList');

  assert.match(desktopResults.innerHTML, /กมลชนก/);
  assert.match(mobileList.innerHTML, /กมลชนก/);
});

module.exports = suite;

if (require.main === module) {
  suite.run().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
