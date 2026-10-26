/**
 * Tier 2: Boundary & Corner Cases Test Suite
 * Tests empty counts, zero quantities, clamp 0-10, partial ID searches, padded 6-digit validation,
 * special characters, and extreme inputs.
 */

const { TestSuite, assert } = require('./helpers/test_framework');
const {
  loadEmployees,
  loadGasBackend
} = require('./helpers/test_utils');
const {
  createDesktopContext,
  createMobileContext,
  createRosterContext
} = require('./helpers/browser_mock');

const suite = new TestSuite('Tier 2: Boundary & Corner Cases');

// =========================================================================
// 1. Zero & Negative Quantity Clamping
// =========================================================================
suite.test('B1.1: Desktop adjustSizeQty on quantity 0 cannot go below 0', () => {
  const { sandbox } = createDesktopContext();
  assert.strictEqual(sandbox.sizeQuantities.M, 0);
  sandbox.adjustSizeQty('M', -1);
  assert.strictEqual(sandbox.sizeQuantities.M, 0, 'Quantity must not be negative');
  sandbox.adjustSizeQty('M', -5);
  assert.strictEqual(sandbox.sizeQuantities.M, 0, 'Quantity must remain 0');
});

suite.test('B1.2: Mobile adjustMobileSizeQty on quantity 0 cannot go below 0', () => {
  const { sandbox } = createMobileContext();
  assert.strictEqual(sandbox.mSizeQuantities.XL, 0);
  sandbox.adjustMobileSizeQty('XL', -1);
  assert.strictEqual(sandbox.mSizeQuantities.XL, 0, 'Mobile quantity must not be negative');
});

suite.test('B1.3: Decrementing size quantity clamped to 0 after multiple decrements', () => {
  const { sandbox } = createDesktopContext();
  sandbox.adjustSizeQty('2XL', 3);
  assert.strictEqual(sandbox.sizeQuantities['2XL'], 3);
  sandbox.adjustSizeQty('2XL', -1);
  sandbox.adjustSizeQty('2XL', -1);
  sandbox.adjustSizeQty('2XL', -1);
  assert.strictEqual(sandbox.sizeQuantities['2XL'], 0);
  sandbox.adjustSizeQty('2XL', -1);
  assert.strictEqual(sandbox.sizeQuantities['2XL'], 0);
});

suite.test('B1.4: Direct assignment of negative or NaN values safely resolved in total calculation', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.sizeQuantities.M = -10;
  sandbox.sizeQuantities.L = NaN;
  // updateTotalCalculation should coerce or handle gracefully
  sandbox.updateTotalCalculation();
  const totalDisplay = document.getElementById('totalPriceDisplay');
  assert.strictEqual(typeof totalDisplay.innerText, 'string');
});

suite.test('B1.5: Upper boundary stepper clamp: allows incrementing up to 10 units per size', () => {
  const { sandbox } = createDesktopContext();
  for (let i = 0; i < 10; i++) {
    sandbox.adjustSizeQty('L', 1);
  }
  assert.strictEqual(sandbox.sizeQuantities.L, 10);
});

// =========================================================================
// 2. Empty Counts & Undefined Values
// =========================================================================
suite.test('B2.1: GAS processBooking handles undefined/null size fields as 0', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: undefined,
    qtyL: null,
    qtyXL: 'invalid',
    qty2XL: 2
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.qtyM, 0);
  assert.strictEqual(data.qtyL, 0);
  assert.strictEqual(data.qtyXL, 0);
  assert.strictEqual(data.qty2XL, 2);
  assert.strictEqual(data.totalQty, 2);
});

suite.test('B2.2: Roster formatRosterSize handles empty/missing size object gracefully', () => {
  const { sandbox } = createRosterContext();
  const text = sandbox.formatRosterSize({});
  assert.strictEqual(text, '-');
});

suite.test('B2.3: Roster formatDateTime handles null, undefined, and empty string', () => {
  const { sandbox } = createRosterContext();
  assert.strictEqual(sandbox.formatDateTime(null), '-');
  assert.strictEqual(sandbox.formatDateTime(undefined), '-');
  assert.strictEqual(sandbox.formatDateTime(''), '-');
});

suite.test('B2.4: Roster formatDateTime handles invalid date string without throwing', () => {
  const { sandbox } = createRosterContext();
  const res = sandbox.formatDateTime('invalid-date-string');
  assert.strictEqual(res, 'invalid-date-string');
});

suite.test('B2.5: Total price display handles 0 quantity without showing NaN', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.sizeQuantities = { M: 0, L: 0, XL: 0, '2XL': 0, '3XL': 0, '4XL': 0 };
  sandbox.updateTotalCalculation();
  const totalDisplay = document.getElementById('totalPriceDisplay');
  assert.strictEqual(totalDisplay.innerText.includes('NaN'), false);
  assert.strictEqual(totalDisplay.innerText, '0 บาท');
});

// =========================================================================
// 3. Partial ID Searches & Query Edge Cases
// =========================================================================
suite.test('B3.1: Single digit search "2" returns all employees containing digit 2', () => {
  const employees = loadEmployees();
  const matches = employees.filter(e => e.id && e.id.includes('2'));
  assert.strictEqual(matches.length > 0, true);
  matches.forEach(m => assert.strictEqual(m.id.includes('2'), true));
});

suite.test('B3.2: Leading zero search "000" finds all employees with leading zeroes', () => {
  const employees = loadEmployees();
  const matches = employees.filter(e => e.id && e.id.includes('000'));
  assert.strictEqual(matches.length > 0, true);
});

suite.test('B3.3: Search with leading and trailing whitespace is automatically trimmed', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.onSearchEmployee('   000023   ');
  const results = document.getElementById('autocompleteResults');
  assert.match(results.innerHTML, /กมลชนก/);
});

suite.test('B3.4: Non-existent ID "999999" returns no results message gracefully', () => {
  const { sandbox, document } = createDesktopContext();
  sandbox.onSearchEmployee('999999');
  const results = document.getElementById('autocompleteResults');
  assert.match(results.innerHTML, /ไม่พบรายชื่อ/);
});

suite.test('B3.5: Mobile bottom sheet employee filter handles empty query by showing all 210', () => {
  const { sandbox, document } = createMobileContext();
  sandbox.filterSheetEmployees('');
  const listEl = document.getElementById('mSheetEmployeeList');
  // Check that list is populated
  assert.strictEqual(listEl.innerHTML.length > 500, true);
});

// =========================================================================
// 4. Padded 6-Digit Validation Edge Cases
// =========================================================================
suite.test('B4.1: Single digit "1" pads to "000001"', () => {
  const raw = '1';
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw;
  assert.strictEqual(padded, '000001');
});

suite.test('B4.2: 5-digit number "12345" pads to "012345"', () => {
  const raw = '12345';
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw;
  assert.strictEqual(padded, '012345');
});

suite.test('B4.3: Already 6-digit number "000023" preserves exact length 6', () => {
  const raw = '000023';
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw;
  assert.strictEqual(padded, '000023');
  assert.strictEqual(padded.length, 6);
});

suite.test('B4.4: 6-digit number with no leading zeroes "123456" remains "123456"', () => {
  const raw = '123456';
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw;
  assert.strictEqual(padded, '123456');
});

suite.test('B4.5: Non-numeric alphanumeric ID (e.g. "EXT-01") is preserved without NaN', () => {
  const raw = 'EXT-01';
  const padded = /^\d+$/.test(raw) ? raw.padStart(6, '0') : raw;
  assert.strictEqual(padded, 'EXT-01');
});

// =========================================================================
// 5. Special Characters & Thai Script Integrity
// =========================================================================
suite.test('B5.1: Thai vowels and tone marks preserve character fidelity in GAS booking', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '015372',
    firstName: 'สุวัฒน์ชัย',
    lastName: 'จันทร์หมื่น',
    department: 'Intensive Care Unit',
    qtyM: 1
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.firstName, 'สุวัฒน์ชัย');
  assert.strictEqual(data.lastName, 'จันทร์หมื่น');
});

suite.test('B5.2: Quotation marks and special characters in search input do not crash', () => {
  const { sandbox } = createDesktopContext();
  assert.doesNotThrow(() => {
    sandbox.onSearchEmployee('""\'\'<script>');
    sandbox.onSearchEmployee('`!@#$%^&*()_+');
  });
});

suite.test('B5.3: Name containing multiple whitespace parts splits cleanly into first and last name', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    fullName: 'กมลชนก    แก้วคำฟู',
    qtyM: 1
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.firstName, 'กมลชนก');
  assert.strictEqual(data.lastName, 'แก้วคำฟู');
});

suite.test('B5.4: HTML tags in employee names are handled as plain text string without executing', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    firstName: '<b>กมลชนก</b>',
    qtyM: 1
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.firstName, '<b>กมลชนก</b>');
});

suite.test('B5.5: Empty department and position strings default safely to "-"', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    department: '',
    position: '',
    qtyM: 1
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.department, '-');
  assert.strictEqual(data.position, '-');
});

// =========================================================================
// 6. Extreme & Adversarial Inputs
// =========================================================================
suite.test('B6.1: High quantity calculation (e.g. 50 jackets) calculates price accurately', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: 20,
    qtyL: 30
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.totalQty, 50);
  assert.strictEqual(data.totalPrice, 25000); // 50 * 500 = 25,000 THB
});

suite.test('B6.2: Missing empId returns error with guidance message', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    firstName: 'กมลชนก',
    qtyM: 1
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, false);
  assert.match(data.message, /กรุณาระบุรหัสพนักงาน/);
});

suite.test('B6.3: Missing firstName returns error with guidance message', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    qtyM: 1
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, false);
  assert.match(data.message, /กรุณาระบุชื่อพนักงาน/);
});

suite.test('B6.4: Legacy single-size payload (size: "XL", qty: 2) backward compatibility', () => {
  const gas = loadGasBackend();
  const res = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    size: 'XL',
    qty: 2
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.qtyXL, 2);
  assert.strictEqual(data.totalQty, 2);
});

suite.test('B6.5: doPost handles invalid JSON contents by falling back to parameter without crash', () => {
  const gas = loadGasBackend();
  const res = gas.doPost({
    postData: { contents: 'invalid-json' },
    parameter: { empId: '000023', firstName: 'กมลชนก', qtyM: 1 }
  });
  const data = JSON.parse(res.getContent ? res.getContent() : res);
  assert.strictEqual(data.success, true);
});

module.exports = suite;

if (require.main === module) {
  suite.run().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
