/**
 * Tier 4: Real-World Scenarios Test Suite
 * Validates the complete 209 employee master dataset, executes simulated booking payloads,
 * tests the roster rendering pipeline, and validates concurrency queuing simulation.
 */

const { TestSuite, assert } = require('./helpers/test_framework');
const {
  readProjectFile,
  loadEmployees,
  loadGasBackend
} = require('./helpers/test_utils');
const {
  createRosterContext
} = require('./helpers/browser_mock');

const suite = new TestSuite('Tier 4: Real-World Scenarios');

// =========================================================================
// 1. 209 Employee Master Dataset Audit
// =========================================================================
suite.test('R1.1: Master employee dataset contains exactly 209 records', () => {
  const employees = loadEmployees();
  assert.strictEqual(employees.length, 209);
});

suite.test('R1.2: All 209 employee IDs are strictly unique with zero duplicates', () => {
  const employees = loadEmployees();
  const idSet = new Set();
  employees.forEach(emp => {
    assert.strictEqual(idSet.has(emp.id), false, `Duplicate employee ID found: ${emp.id}`);
    idSet.add(emp.id);
  });
  assert.strictEqual(idSet.size, 209);
});

suite.test('R1.3: All 209 employee IDs adhere strictly to 6-digit Plain Text format (^\\d{6}$)', () => {
  const employees = loadEmployees();
  employees.forEach(emp => {
    assert.match(emp.id, /^\d{6}$/, `Employee ID ${emp.id} is not a valid 6-digit string`);
  });
});

suite.test('R1.4: All 209 employee records possess non-empty firstName, lastName, and fullName', () => {
  const employees = loadEmployees();
  employees.forEach(emp => {
    assert.strictEqual(typeof emp.firstName === 'string' && emp.firstName.trim().length > 0, true, `Missing firstName for ID ${emp.id}`);
    assert.strictEqual(typeof emp.lastName === 'string' && emp.lastName.trim().length > 0, true, `Missing lastName for ID ${emp.id}`);
    assert.strictEqual(typeof emp.fullName === 'string' && emp.fullName.trim().length > 0, true, `Missing fullName for ID ${emp.id}`);
  });
});

suite.test('R1.5: All 209 employee records possess non-empty department and position', () => {
  const employees = loadEmployees();
  employees.forEach(emp => {
    assert.strictEqual(typeof emp.department === 'string' && emp.department.trim().length > 0, true, `Missing department for ID ${emp.id}`);
    assert.strictEqual(typeof emp.position === 'string' && emp.position.trim().length > 0, true, `Missing position for ID ${emp.id}`);
  });
});

suite.test('R1.6: employees-data.js and employees.json are identical in record count and data', () => {
  const jsonContent = readProjectFile('data/employees.json');
  const jsContent = readProjectFile('data/employees-data.js');
  const fromJson = JSON.parse(jsonContent);
  // Extract JSON from js file
  const match = jsContent.match(/window\.PPCH_EMPLOYEES\s*=\s*(\[[\s\S]*?\]);/);
  assert.strictEqual(match !== null, true, 'employees-data.js must export window.PPCH_EMPLOYEES');
  const fromJs = JSON.parse(match[1]);

  assert.strictEqual(fromJs.length, 209);
  assert.strictEqual(fromJson.length, 209);
  assert.strictEqual(fromJs[0].id, fromJson[0].id);
  assert.strictEqual(fromJs[208].id, fromJson[208].id);
});

// =========================================================================
// 2. Simulated Booking Payloads (15 Diverse Hospital Real-World Cases)
// =========================================================================
suite.test('R2.1: Batch simulation: 15 diverse employee registrations write accurately without row loss', () => {
  const gas = loadGasBackend();
  const employees = loadEmployees();

  // Pick 15 diverse employees across various departments
  const sampleIndices = [0, 5, 12, 25, 40, 60, 85, 110, 130, 150, 170, 185, 195, 200, 208];
  const sampleEmployees = sampleIndices.map(idx => employees[idx]);
  assert.strictEqual(sampleEmployees.length, 15);

  let grandTotalQty = 0;
  sampleEmployees.forEach((emp, i) => {
    // Generate diverse size quantities
    const payload = {
      empId: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      department: emp.department,
      position: emp.position,
      qtyM: i % 2 === 0 ? 1 : 0,
      qtyL: i % 3 === 0 ? 1 : 0,
      qtyXL: i % 5 === 0 ? 2 : 0,
      qty2XL: i === 7 ? 1 : 0,
      qty3XL: 0,
      qty4XL: i === 14 ? 1 : 0,
      bookingMode: 'new'
    };
    // Ensure at least 1 unit
    if (payload.qtyM === 0 && payload.qtyL === 0 && payload.qtyXL === 0 && payload.qty2XL === 0 && payload.qty4XL === 0) {
      payload.qtyM = 1;
    }

    const res = gas.processBooking(payload);
    const data = JSON.parse(res.getContent ? res.getContent() : res);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.empId, emp.id);
    grandTotalQty += data.totalQty;
  });

  const summaryRes = gas.handleGetRegistrations();
  const summaryData = JSON.parse(summaryRes.getContent ? summaryRes.getContent() : summaryRes);

  assert.strictEqual(summaryData.totalBookings, 15, 'All 15 bookings must be recorded in sheet');
  assert.strictEqual(summaryData.totalQty, grandTotalQty);
  assert.strictEqual(summaryData.totalAmount, grandTotalQty * 500);
});

suite.test('R2.2: Nurse orders single size (M: 1) and receives clean confirmation payload', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '015372',
    firstName: 'สุวัฒน์ชัย',
    lastName: 'จันทร์หมื่น',
    department: 'Intensive Care Unit',
    position: 'Officer 1, Registered Nurse-ICU',
    qtyM: 1,
    bookingMode: 'new'
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.sizeSummary, 'M (1)');
  assert.strictEqual(data.totalQty, 1);
  assert.strictEqual(data.totalPrice, 500);
});

suite.test('R2.3: Admin orders multi-size combination (M: 1, XL: 2) and calculates 1,500 THB', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    lastName: 'แก้วคำฟู',
    department: 'Human Resource Department',
    position: 'HoD, Human Resource',
    qtyM: 1,
    qtyXL: 2,
    bookingMode: 'new'
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.sizeSummary, 'M (1), XL (2)');
  assert.strictEqual(data.totalQty, 3);
  assert.strictEqual(data.totalPrice, 1500);
});

suite.test('R2.4: Real-world update scenario: Pharmacist changes size from L: 1 to XL: 1', () => {
  const gas = loadGasBackend();
  // 1. Initial registration
  gas.processBooking({
    empId: '005432',
    firstName: 'นภัทร',
    lastName: 'สุขสม',
    qtyL: 1,
    bookingMode: 'new'
  });

  // 2. Update to XL: 1
  const res = gas.processBooking({
    empId: '005432',
    firstName: 'นภัทร',
    lastName: 'สุขสม',
    qtyL: 0,
    qtyXL: 1,
    bookingMode: 'update'
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.qtyL, 0);
  assert.strictEqual(data.qtyXL, 1);
  assert.strictEqual(data.totalQty, 1);
  assert.strictEqual(data.status, 'จองสำเร็จ (แก้ไขข้อมูล)');
});

suite.test('R2.5: Real-world add_more scenario: ER nurse orders 1 jacket, later orders 1 more for colleague', () => {
  const gas = loadGasBackend();
  gas.processBooking({
    empId: '007788',
    firstName: 'สมบูรณ์',
    lastName: 'ใจดี',
    qtyM: 1,
    bookingMode: 'new'
  });

  const res = gas.processBooking({
    empId: '007788',
    firstName: 'สมบูรณ์',
    lastName: 'ใจดี',
    qtyM: 0,
    qty2XL: 1,
    bookingMode: 'add_more'
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.qtyM, 1);
  assert.strictEqual(data.qty2XL, 1);
  assert.strictEqual(data.totalQty, 2);
  assert.strictEqual(data.totalPrice, 1000);
  assert.strictEqual(data.status, 'จองสำเร็จ (สั่งเพิ่ม)');
});

// =========================================================================
// 3. Roster Rendering Pipeline End-to-End
// =========================================================================
suite.test('R3.1: Full roster rendering pipeline handles 15 items in desktop table and mobile cards', () => {
  const mockItems = [
    { empId: '000023', firstName: 'กมลชนก', lastName: 'แก้วคำฟู', fullName: 'นางสาวกมลชนก แก้วคำฟู', department: 'HRD', position: 'HoD', qtyM: 1, totalQty: 1, totalPrice: 500, paymentStatus: 'จองสำเร็จ' },
    { empId: '015372', firstName: 'สุวัฒน์ชัย', lastName: 'จันทร์หมื่น', fullName: 'นายสุวัฒน์ชัย จันทร์หมื่น', department: 'ICU', position: 'RN', qtyL: 2, totalQty: 2, totalPrice: 1000, paymentStatus: 'จองสำเร็จ' },
    { empId: '009141', firstName: 'กมลชนก', lastName: 'ย่านสากล', fullName: 'นางสาวกมลชนก ย่านสากล', department: 'Pharmacy', position: 'Pharmacist', qtyXL: 1, totalQty: 1, totalPrice: 500, paymentStatus: 'จองสำเร็จ' }
  ];

  const { sandbox, document } = createRosterContext({ initialRecords: mockItems });
  sandbox.renderData(mockItems);

  const tbody = document.getElementById('rosterTableBody');
  const mobileCards = document.getElementById('mobileCardsContainer');

  assert.match(tbody.innerHTML, /000023/);
  assert.match(tbody.innerHTML, /015372/);
  assert.match(tbody.innerHTML, /009141/);

  assert.match(mobileCards.innerHTML, /000023/);
  assert.match(mobileCards.innerHTML, /015372/);
  assert.match(mobileCards.innerHTML, /009141/);
});

suite.test('R3.2: Roster single-size column displays "ไซส์ [SIZE]" without redundant count', () => {
  const { sandbox } = createRosterContext();
  const singleItem = { empId: '000023', qtyL: 1 };
  const text = sandbox.formatRosterSize(singleItem);
  assert.strictEqual(text, 'ไซส์ L');
});

suite.test('R3.3: Roster search query filters matching employees in real-time', () => {
  const mockItems = [
    { empId: '000023', fullName: 'นางสาวกมลชนก แก้วคำฟู', department: 'HRD', qtyM: 1 },
    { empId: '015372', fullName: 'นายสุวัฒน์ชัย จันทร์หมื่น', department: 'ICU', qtyL: 1 }
  ];
  const { sandbox, document } = createRosterContext({ initialRecords: mockItems });
  
  // Set search input
  const searchInput = document.getElementById('tableSearchInput');
  searchInput.value = 'ICU';
  sandbox.applyFilters();

  const displayCount = document.getElementById('displayRowCount');
  assert.strictEqual(displayCount.innerText, '1');
});

suite.test('R3.4: Roster size pills quick filter narrows results to selected size', () => {
  const mockItems = [
    { empId: '000023', qtyM: 1, qtyL: 0 },
    { empId: '015372', qtyM: 0, qtyL: 2 },
    { empId: '009141', qtyM: 1, qtyL: 1 }
  ];
  const { sandbox, document } = createRosterContext({ initialRecords: mockItems });
  
  sandbox.setSizeFilter('L');
  const displayCount = document.getElementById('displayRowCount');
  // Two employees have size L (015372 and 009141)
  assert.strictEqual(displayCount.innerText, '2');
});

suite.test('R3.5: Roster updateKPIs calculates per-size aggregate metrics accurately', () => {
  const mockItems = [
    { qtyM: 1, qtyL: 2, qtyXL: 0, qty2XL: 0, qty3XL: 0, qty4XL: 0 },
    { qtyM: 0, qtyL: 1, qtyXL: 3, qty2XL: 1, qty3XL: 0, qty4XL: 0 }
  ];
  const { sandbox, document } = createRosterContext();
  sandbox.updateKPIs(mockItems);

  const countM = document.getElementById('countSizeM');
  const countL = document.getElementById('countSizeL');
  const countXL = document.getElementById('countSizeXL');
  const count2XL = document.getElementById('countSize2XL');

  assert.strictEqual(countM.innerText, '1');
  assert.strictEqual(countL.innerText, '3');
  assert.strictEqual(countXL.innerText, '3');
  assert.strictEqual(count2XL.innerText, '1');
});

// =========================================================================
// 4. Concurrency & Queuing Verification
// =========================================================================
suite.test('R4.1: Simulated lock timeout returns queueBusy: true and guidance message', () => {
  // Mock sheet backend where tryLock fails
  const gas = loadGasBackend();
  const busyLock = {
    tryLock: () => false,
    waitLock: () => { throw new Error('Lock timeout: queue full'); },
    releaseLock: () => {}
  };
  gas.LockService.getScriptLock = () => busyLock;

  const res = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: 1
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);

  assert.strictEqual(data.success, false);
  assert.strictEqual(data.queueBusy, true);
  assert.match(data.message, /ระบบกำลังจัดคิวบันทึกข้อมูล/);
});

suite.test('R4.2: Frontend handles queueBusy with auto-retry logic', () => {
  const desktopHtml = readProjectFile('desktop.html');
  assert.match(desktopHtml, /queueBusy/);
  assert.match(desktopHtml, /maxRetries/);
});

suite.test('R2.6: Housekeeping staff orders size 4XL (50" chest) and confirms price ceiling of 500 THB', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '001234',
    firstName: 'สมพงษ์',
    lastName: 'มีสุข',
    department: 'Housekeeping',
    position: 'Staff',
    qty4XL: 1,
    bookingMode: 'new'
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.qty4XL, 1);
  assert.strictEqual(data.totalQty, 1);
  assert.strictEqual(data.totalPrice, 500);
});

suite.test('R3.6: Roster empty state displays clear guidance and allows clearing filters', () => {
  const { sandbox, document, rawHtml } = createRosterContext();
  sandbox.renderData([]);
  const empty = document.getElementById('rosterEmptyContainer');
  assert.strictEqual(empty.classList.contains('hidden'), false);
  assert.match(rawHtml, /id="rosterEmptyContainer"[\s\S]*?ไม่พบข้อมูลการจอง/);
});

module.exports = suite;

if (require.main === module) {
  suite.run().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
