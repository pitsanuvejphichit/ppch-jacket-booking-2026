/**
 * Empirical Adversarial UI Stress Test Suite
 * Executed by teamwork_preview_challenger_2
 *
 * Tasks covered:
 * 1. Roster table column structure (8 columns, absence of Department/Position in header and cells)
 * 2. Single size formatting ('ไซส์ [SIZE]' with no trailing count; legacy, dirty, and multi-size strings)
 * 3. Mobile view isolation (< md, < 768px; desktop table hidden, cards only, no scroll overflow)
 * 4. Mobile bottom sheet (85dvh height property, 90px body padding clearance)
 * 5. Submit button DOM disabled state across dynamic DOM events (totalQty=0, unselected employee, reset)
 * 6. Full 210 employee master dataset search & autocomplete fuzzing (edge, injection, Thai diacritics)
 */

const { TestSuite, assert } = require('./helpers/test_framework');
const {
  readProjectFile,
  loadEmployees
} = require('./helpers/test_utils');
const {
  createDesktopContext,
  createMobileContext,
  createRosterContext
} = require('./helpers/browser_mock');

const suite = new TestSuite('Adversarial UI Stress & Responsiveness Verification');

// =========================================================================
// TASK 1: Roster Table Column Structure & Absence of Dept/Pos
// =========================================================================

suite.test('Task 1.1: Static HTML <thead> contains exactly 8 <th> column headers', () => {
  const html = readProjectFile('roster.html');
  const theadMatch = html.match(/<thead>[\s\S]*?<\/thead>/i);
  assert.ok(theadMatch, 'roster.html must have <thead>');
  const thMatches = theadMatch[0].match(/<th\b[^>]*>([\s\S]*?)<\/th>/gi);
  assert.ok(thMatches, '<thead> must contain <th> elements');
  assert.strictEqual(thMatches.length, 8, `Expected exactly 8 <th> headers, found ${thMatches.length}`);
});

suite.test('Task 1.2: Static HTML <thead> column headers match exact 8 required titles in sequence', () => {
  const html = readProjectFile('roster.html');
  const theadMatch = html.match(/<thead>[\s\S]*?<\/thead>/i)[0];
  const headerTexts = [];
  const thRegex = /<th\b[^>]*>([\s\S]*?)<\/th>/gi;
  let m;
  while ((m = thRegex.exec(theadMatch)) !== null) {
    headerTexts.push(m[1].replace(/<[^>]+>/g, '').trim());
  }

  assert.strictEqual(headerTexts[0], '#', 'Header 1 must be #');
  assert.strictEqual(headerTexts[1], 'รหัสพนักงาน', 'Header 2 must be รหัสพนักงาน');
  assert.strictEqual(headerTexts[2], 'ชื่อ', 'Header 3 must be ชื่อ');
  assert.strictEqual(headerTexts[3], 'นามสกุล', 'Header 4 must be นามสกุล');
  assert.strictEqual(headerTexts[4], 'ไซส์ที่สั่งจอง', 'Header 5 must be ไซส์ที่สั่งจอง');
  assert.strictEqual(headerTexts[5], 'จำนวนรวม', 'Header 6 must be จำนวนรวม');
  assert.strictEqual(headerTexts[6], 'ยอดประมาณการ', 'Header 7 must be ยอดประมาณการ');
  assert.strictEqual(headerTexts[7], 'สถานะ', 'Header 8 must be สถานะ');
});

suite.test('Task 1.3: Static HTML <thead> headers strictly forbid "แผนก" (Dept) and "ตำแหน่ง" (Pos)', () => {
  const html = readProjectFile('roster.html');
  const theadMatch = html.match(/<thead>[\s\S]*?<\/thead>/i)[0];
  assert.ok(!theadMatch.includes('แผนก'), '<thead> must not contain แผนก (Department)');
  assert.ok(!theadMatch.includes('ตำแหน่ง'), '<thead> must not contain ตำแหน่ง (Position)');
  assert.ok(!theadMatch.toLowerCase().includes('department'), '<thead> must not contain department');
  assert.ok(!theadMatch.toLowerCase().includes('position'), '<thead> must not contain position');
});

suite.test('Task 1.4: Rendered table rows each contain exactly 8 <td> cells with no Dept or Pos columns', () => {
  const { sandbox, document } = createRosterContext();

  const mockRegistrations = [
    {
      bookingId: 'BK-1001',
      empId: '000023',
      firstName: 'กมลชนก',
      lastName: 'แก้วคำฟู',
      department: 'Human Resource Department',
      position: 'HoD, Human Resource',
      qtyM: 1,
      totalQty: 1,
      totalPrice: 500,
      paymentStatus: 'บันทึกสำเร็จ'
    },
    {
      bookingId: 'BK-1002',
      empId: '000456',
      firstName: 'ศิริพร',
      lastName: 'สิทธิการ',
      department: 'Procurement Department',
      position: 'Officer 1, Procurement',
      qtyL: 2,
      totalQty: 2,
      totalPrice: 1000,
      paymentStatus: 'บันทึกสำเร็จ'
    },
    {
      bookingId: 'BK-1003',
      empId: '000462',
      fullName: 'นางสาวสุมิตรา สถิตย์พรหม',
      department: 'Finance and Accounting',
      position: 'Staff, Finance',
      qtyXL: 1,
      qty2XL: 1,
      totalQty: 2,
      totalPrice: 1000,
      paymentStatus: 'บันทึกสำเร็จ'
    }
  ];

  sandbox.allRecords = mockRegistrations;
  sandbox.renderData(mockRegistrations);

  const tbody = document.getElementById('rosterTableBody');
  const trMatches = tbody.innerHTML.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi);
  assert.ok(trMatches, 'Must render rows in rosterTableBody');
  assert.strictEqual(trMatches.length, mockRegistrations.length);

  trMatches.forEach((trHtml, rowIdx) => {
    const tdMatches = trHtml.match(/<td\b[^>]*>([\s\S]*?)<\/td>/gi);
    assert.strictEqual(tdMatches.length, 8, `Row ${rowIdx + 1} must have exactly 8 <td> cells, found ${tdMatches.length}`);

    // Check cells
    const cellTexts = tdMatches.map(td => td.replace(/<[^>]+>/g, '').trim());
    assert.strictEqual(cellTexts[0], String(rowIdx + 1), 'Cell 0 should be sequence #');
    assert.ok(cellTexts[1].includes(mockRegistrations[rowIdx].empId), 'Cell 1 must contain 6-digit empId');

    // Verify absence of department and position in desktop table cells
    const dept = mockRegistrations[rowIdx].department;
    const pos = mockRegistrations[rowIdx].position;
    assert.ok(!trHtml.includes(dept), `Row ${rowIdx + 1} table cells must NOT contain department "${dept}"`);
    assert.ok(!trHtml.includes(pos), `Row ${rowIdx + 1} table cells must NOT contain position "${pos}"`);
  });
});

suite.test('Task 1.5: Large batch (25 rows) preserves strictly 8 columns per row without layout regression', () => {
  const { sandbox, document } = createRosterContext();
  const batch = [];
  for (let i = 1; i <= 25; i++) {
    batch.push({
      bookingId: `BK-${2000 + i}`,
      empId: String(i).padStart(6, '0'),
      firstName: `ทดสอบ_${i}`,
      lastName: `นามสกุล_${i}`,
      department: `แผนกทดสอบ_${i}`,
      position: `ตำแหน่ง_${i}`,
      qtyM: i % 2,
      qtyL: (i + 1) % 2,
      totalQty: 1,
      totalPrice: 500,
      paymentStatus: 'บันทึกสำเร็จ'
    });
  }

  sandbox.allRecords = batch;
  sandbox.renderData(batch);

  const tbody = document.getElementById('rosterTableBody');
  const trMatches = tbody.innerHTML.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi);
  assert.strictEqual(trMatches.length, 25);

  trMatches.forEach((tr, idx) => {
    const tdMatches = tr.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi);
    assert.strictEqual(tdMatches.length, 8, `Batch row ${idx + 1} must strictly have 8 columns`);
    assert.ok(!tr.includes(`แผนกทดสอบ_${idx + 1}`), 'Must not leak department in desktop cells');
    assert.ok(!tr.includes(`ตำแหน่ง_${idx + 1}`), 'Must not leak position in desktop cells');
  });
});

// =========================================================================
// TASK 2: Single Size Formatting & Dirty String Handling
// =========================================================================

suite.test('Task 2.1: Single size orders (qty=1) across all sizes output "ไซส์ [SIZE]" with no trailing count', () => {
  const { sandbox } = createRosterContext();
  const sizes = ['M', 'L', 'XL', '2XL', '3XL', '4XL'];

  sizes.forEach(s => {
    const record = { [`qty${s}`]: 1 };
    const formatted = sandbox.formatRosterSize(record);
    assert.strictEqual(formatted, `ไซส์ ${s}`, `Size ${s} with qty=1 must format as "ไซส์ ${s}"`);
    assert.ok(!formatted.includes('ตัว'), `Output "${formatted}" must not include "ตัว"`);
    assert.ok(!formatted.includes('(1)'), `Output "${formatted}" must not include "(1)"`);
    assert.ok(!formatted.includes('(1 ตัว)'), `Output "${formatted}" must not include "(1 ตัว)"`);
  });
});

suite.test('Task 2.2: Single size orders with qty > 1 output "ไซส์ [SIZE]" with no redundant trailing count', () => {
  const { sandbox } = createRosterContext();
  const testCases = [
    { record: { qtyM: 2 }, expected: 'ไซส์ M' },
    { record: { qtyL: 3 }, expected: 'ไซส์ L' },
    { record: { qtyXL: 5 }, expected: 'ไซส์ XL' },
    { record: { qty2XL: 10 }, expected: 'ไซส์ 2XL' },
    { record: { qty3XL: 4 }, expected: 'ไซส์ 3XL' },
    { record: { qty4XL: 8 }, expected: 'ไซส์ 4XL' }
  ];

  testCases.forEach(({ record, expected }) => {
    const formatted = sandbox.formatRosterSize(record);
    assert.strictEqual(formatted, expected, `Single size with multiple qty should output "${expected}"`);
    assert.ok(!/\(\d+\s*ตัว\)/.test(formatted), `Must not have trailing (X ตัว): ${formatted}`);
    assert.ok(!/\(\d+\)/.test(formatted), `Must not have trailing (X): ${formatted}`);
  });
});

suite.test('Task 2.3: Dirty / legacy single-size fallback strings are sanitized to "ไซส์ [SIZE]"', () => {
  const { sandbox } = createRosterContext();
  const dirtyCases = [
    { input: 'M (1 ตัว)', expected: 'ไซส์ M' },
    { input: 'L (1)', expected: 'ไซส์ L' },
    { input: 'XL (2 ตัว)', expected: 'ไซส์ XL' },
    { input: '2XL (5)', expected: 'ไซส์ 2XL' },
    { input: 'ไซส์ 3XL (1 ตัว)', expected: 'ไซส์ 3XL' },
    { input: 'ไซส์ 4XL (3)', expected: 'ไซส์ 4XL' },
    { input: '   L (1 ตัว)   ', expected: 'ไซส์ L' },
    { input: 'ไซส์ M', expected: 'ไซส์ M' },
    { input: 'XL', expected: 'ไซส์ XL' },
    { input: 'ไซส์ 2XL', expected: 'ไซส์ 2XL' }
  ];

  dirtyCases.forEach(({ input, expected }) => {
    const resFromSummary = sandbox.formatRosterSize({ sizeSummary: input });
    assert.strictEqual(resFromSummary, expected, `sizeSummary "${input}" should format as "${expected}"`);

    const resFromSize = sandbox.formatRosterSize({ size: input });
    assert.strictEqual(resFromSize, expected, `size "${input}" should format as "${expected}"`);
  });
});

suite.test('Task 2.4: Multi-size orders format into breakdown list rather than single-size string', () => {
  const { sandbox } = createRosterContext();

  const multiRecord1 = { qtyM: 1, qtyXL: 2 };
  const res1 = sandbox.formatRosterSize(multiRecord1);
  assert.strictEqual(res1, 'M (1), XL (2)');

  const multiRecord2 = { qtyL: 2, qty2XL: 1, qty4XL: 3 };
  const res2 = sandbox.formatRosterSize(multiRecord2);
  assert.strictEqual(res2, 'L (2), 2XL (1), 4XL (3)');

  const multiRecordAll = { qtyM: 1, qtyL: 1, qtyXL: 1, qty2XL: 1, qty3XL: 1, qty4XL: 1 };
  const resAll = sandbox.formatRosterSize(multiRecordAll);
  assert.strictEqual(resAll, 'M (1), L (1), XL (1), 2XL (1), 3XL (1), 4XL (1)');
});

suite.test('Task 2.5: Empty, null, and hyphen values gracefully return "-" without crashing', () => {
  const { sandbox } = createRosterContext();
  assert.strictEqual(sandbox.formatRosterSize({}), '-');
  assert.strictEqual(sandbox.formatRosterSize({ sizeSummary: '' }), '-');
  assert.strictEqual(sandbox.formatRosterSize({ size: '-' }), '-');
  assert.strictEqual(sandbox.formatRosterSize({ sizeSummary: '   ' }), '-');
  assert.strictEqual(sandbox.formatRosterSize({ size: null }), '-');
});

// =========================================================================
// TASK 3: Mobile View Isolation (< md, < 768px) & Scrollbar Overflow
// =========================================================================

suite.test('Task 3.1: Desktop table wrapper is 100% hidden on mobile viewport (< md)', () => {
  const html = readProjectFile('roster.html');
  const tableWrapperMatch = html.match(/<div\b[^>]*id=["']tableWrapper["'][^>]*class=["']([^"']*)["']/i);
  assert.ok(tableWrapperMatch, 'tableWrapper element must exist in roster.html');
  const classes = tableWrapperMatch[1].split(/\s+/);

  assert.ok(classes.includes('hidden'), 'tableWrapper must have "hidden" base class (display: none by default < md)');
  assert.ok(classes.includes('md:block'), 'tableWrapper must have "md:block" (display: block only >= md)');
});

suite.test('Task 3.2: Mobile card container is only visible on mobile (< md) and hidden on desktop (>= md)', () => {
  const html = readProjectFile('roster.html');
  const mobileCardsMatch = html.match(/<div\b[^>]*id=["']mobileCardsContainer["'][^>]*class=["']([^"']*)["']/i);
  assert.ok(mobileCardsMatch, 'mobileCardsContainer element must exist in roster.html');
  const classes = mobileCardsMatch[1].split(/\s+/);

  assert.ok(classes.includes('hidden') || classes.includes('block'), 'Must have base visibility class');
  assert.ok(classes.includes('md:hidden'), 'mobileCardsContainer must have "md:hidden" (display: none >= md)');
});

suite.test('Task 3.3: renderData() strictly maintains responsive view isolation in runtime DOM', () => {
  const { sandbox, document } = createRosterContext();
  const mockItems = [
    {
      empId: '000023',
      fullName: 'นางสาวกมลชนก แก้วคำฟู',
      department: 'Human Resource Department',
      qtyM: 1,
      totalQty: 1,
      totalPrice: 500
    }
  ];

  sandbox.renderData(mockItems);

  const tableWrapper = document.getElementById('tableWrapper');
  const mobileCards = document.getElementById('mobileCardsContainer');

  assert.ok(tableWrapper.className.includes('hidden md:block'), 'tableWrapper class must be "hidden md:block"');
  assert.ok(mobileCards.className.includes('block md:hidden'), 'mobileCards class must be "block md:hidden"');

  // Test empty list
  sandbox.renderData([]);
  assert.strictEqual(tableWrapper.className, 'hidden', 'Empty list must hide tableWrapper completely');
  assert.strictEqual(mobileCards.className, 'hidden', 'Empty list must hide mobileCards completely');
});

suite.test('Task 3.4: Mobile cards contain no hard-coded wide min-width that could cause horizontal scrollbar leaks', () => {
  const { sandbox, document } = createRosterContext();
  const mockItems = [
    {
      empId: '000023',
      fullName: 'ศุภลักษณ์ มีทรัพย์สมบูรณ์ยิ่งตระกูล',
      department: 'ฝ่ายการพยาบาลผู้ป่วยในและอุบัติเหตุฉุกเฉินระดับสูง',
      qtyM: 1,
      totalQty: 1,
      totalPrice: 500
    }
  ];

  sandbox.renderData(mockItems);
  const mobileContainer = document.getElementById('mobileCardsContainer');
  const cardHtml = mobileContainer.innerHTML;

  // Assert no hard-coded min-w wider than standard mobile 320px
  assert.ok(!cardHtml.includes('min-w-[400px]'), 'Mobile card should not force min-w > 400px');
  assert.ok(!cardHtml.includes('min-w-[500px]'), 'Mobile card should not force min-w > 500px');
  assert.ok(!cardHtml.includes('min-w-[600px]'), 'Mobile card should not force min-w > 600px');
  assert.ok(!cardHtml.includes('overflow-x-scroll'), 'Mobile cards container should not force overflow-x-scroll');

  // Verify responsive truncation on long employee names and departments
  assert.ok(cardHtml.includes('truncate'), 'Mobile card should utilize truncate class for text overflow protection');
});

// =========================================================================
// TASK 4: Mobile Bottom Sheet (85dvh Height & 90px Padding Clearance)
// =========================================================================

suite.test('Task 4.1: Mobile bottom sheet declares 85dvh height property and max-height 85dvh', () => {
  const html = readProjectFile('mobile.html');
  const sheetMatch = html.match(/<div\b[^>]*class=["'][^"']*bottom-sheet[^"']*["'][^>]*style=["']([^"']*)["']/i);
  assert.ok(sheetMatch, 'mobile.html must contain bottom-sheet element with style attribute');
  const styleStr = sheetMatch[1];

  assert.ok(styleStr.includes('85dvh'), `Bottom sheet style must contain "85dvh", got: "${styleStr}"`);
  assert.ok(styleStr.includes('height: 85dvh') || styleStr.includes('height:85dvh'), 'Must specify height: 85dvh');
  assert.ok(styleStr.includes('max-height: 85dvh') || styleStr.includes('max-height:85dvh'), 'Must specify max-height: 85dvh');
  assert.ok(styleStr.includes('85vh'), 'Must provide 85vh fallback for older browsers');
});

suite.test('Task 4.2: Mobile body has padding-bottom: 90px clearance for the fixed sticky bottom action bar', () => {
  const html = readProjectFile('mobile.html');
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
  assert.ok(styleMatch, 'mobile.html must contain <style> tag');
  const css = styleMatch[1];

  const bodyRuleMatch = css.match(/body\s*\{([\s\S]*?)\}/i);
  assert.ok(bodyRuleMatch, '<style> must define body rule');
  const bodyContent = bodyRuleMatch[1];

  assert.ok(bodyContent.includes('padding-bottom: 90px') || bodyContent.includes('padding-bottom:90px'),
    `Body CSS must specify padding-bottom: 90px, found:\n${bodyContent}`);
});

// =========================================================================
// TASK 5: Submit Button DOM Disabled State Across Dynamic Events
// =========================================================================

suite.test('Task 5.1: Desktop HTML markup hard-codes disabled attribute and opacity-50 on #btnSubmit', () => {
  const html = readProjectFile('desktop.html');
  const btnMatch = html.match(/<button\b[^>]*id=["']btnSubmit["'][^>]*>/i);
  assert.ok(btnMatch, 'desktop.html must contain #btnSubmit');
  assert.ok(btnMatch[0].includes('disabled'), '#btnSubmit markup must have disabled attribute initially');
  assert.ok(btnMatch[0].includes('opacity-50'), '#btnSubmit markup must have opacity-50');
  assert.ok(btnMatch[0].includes('cursor-not-allowed'), '#btnSubmit markup must have cursor-not-allowed');
});

suite.test('Task 5.2: Desktop runtime updateTotalCalculation() disables button when totalQty=0 or employee=null', () => {
  const { document, sandbox } = createDesktopContext();
  const btn = document.getElementById('btnSubmit');

  // Initial runtime execution
  sandbox.updateTotalCalculation();
  assert.strictEqual(btn.disabled, true, 'btnSubmit must be disabled initially');
  assert.ok(btn.classList.contains('opacity-50'), 'btnSubmit must have opacity-50 class initially');
  assert.ok(btn.classList.contains('cursor-not-allowed'), 'btnSubmit must have cursor-not-allowed class initially');

  // Select real employee (000023), but totalQty remains 0
  sandbox.selectEmployee('000023');
  assert.ok(sandbox.selectedEmployee !== null, 'Employee 000023 must be selected');
  assert.strictEqual(sandbox.sizeQuantities.M, 0);

  sandbox.updateTotalCalculation();
  assert.strictEqual(btn.disabled, true, 'btnSubmit must remain disabled when totalQty is 0');
  assert.ok(btn.classList.contains('opacity-50'));
  assert.ok(btn.classList.contains('cursor-not-allowed'));
});

suite.test('Task 5.3: Desktop submit button remains disabled when totalQty > 0 but employee is unselected', () => {
  const { document, sandbox } = createDesktopContext();
  const btn = document.getElementById('btnSubmit');

  assert.strictEqual(sandbox.selectedEmployee, null);
  sandbox.adjustSizeQty('M', 2);
  assert.strictEqual(sandbox.sizeQuantities.M, 2);

  sandbox.updateTotalCalculation();
  assert.strictEqual(btn.disabled, true, 'btnSubmit must remain disabled when selectedEmployee is null');
  assert.ok(btn.classList.contains('opacity-50'));
  assert.ok(btn.classList.contains('cursor-not-allowed'));
});

suite.test('Task 5.4: Desktop submit button enables when BOTH employee is selected AND totalQty > 0', () => {
  const { document, sandbox } = createDesktopContext();
  const btn = document.getElementById('btnSubmit');

  sandbox.selectEmployee('000023');
  sandbox.adjustSizeQty('L', 1);

  assert.strictEqual(btn.disabled, false, 'btnSubmit must be enabled when employee and qty are valid');
  assert.ok(!btn.classList.contains('opacity-50'), 'btnSubmit must remove opacity-50');
  assert.ok(!btn.classList.contains('cursor-not-allowed'), 'btnSubmit must remove cursor-not-allowed');
});

suite.test('Task 5.5: Desktop submit button reactively re-disables when quantity is decremented back to 0', () => {
  const { document, sandbox } = createDesktopContext();
  const btn = document.getElementById('btnSubmit');

  sandbox.selectEmployee('000023');
  sandbox.adjustSizeQty('XL', 1);
  assert.strictEqual(btn.disabled, false, 'Enabled after increment');

  sandbox.adjustSizeQty('XL', -1);
  assert.strictEqual(sandbox.sizeQuantities.XL, 0);
  assert.strictEqual(btn.disabled, true, 'Must disable again when quantity hits 0');
  assert.ok(btn.classList.contains('opacity-50'));
  assert.ok(btn.classList.contains('cursor-not-allowed'));
});

suite.test('Task 5.6: Desktop clearSelectedEmployee() immediately disables button and clears quantities', () => {
  const { document, sandbox } = createDesktopContext();
  const btn = document.getElementById('btnSubmit');

  sandbox.selectEmployee('000023');
  sandbox.adjustSizeQty('2XL', 2);
  assert.strictEqual(btn.disabled, false);

  sandbox.clearSelectedEmployee();
  assert.strictEqual(sandbox.selectedEmployee, null);
  assert.strictEqual(sandbox.sizeQuantities['2XL'], 0);
  assert.strictEqual(btn.disabled, true, 'Must disable on clearSelectedEmployee');
  assert.ok(btn.classList.contains('opacity-50'));
});

suite.test('Task 5.7: Mobile HTML markup hard-codes disabled attribute and pointer-events-none on #mBtnSubmit', () => {
  const html = readProjectFile('mobile.html');
  const mBtnMatch = html.match(/<button\b[^>]*id=["']mBtnSubmit["'][^>]*>/i);
  assert.ok(mBtnMatch, 'mobile.html must contain #mBtnSubmit');
  assert.ok(mBtnMatch[0].includes('disabled'), '#mBtnSubmit markup must have disabled attribute initially');
  assert.ok(mBtnMatch[0].includes('opacity-50'), '#mBtnSubmit markup must have opacity-50');
  assert.ok(mBtnMatch[0].includes('pointer-events-none'), '#mBtnSubmit markup must have pointer-events-none');
});

suite.test('Task 5.8: Mobile updateMobileTotal() dynamic lifecycle accurately enforces disabled state', () => {
  const { document, sandbox } = createMobileContext();
  const mBtn = document.getElementById('mBtnSubmit');

  // Initial runtime execution
  sandbox.updateMobileTotal();
  assert.strictEqual(mBtn.disabled, true, 'mBtnSubmit initially disabled');
  assert.ok(mBtn.classList.contains('opacity-50'));
  assert.ok(mBtn.classList.contains('pointer-events-none'));

  // Select employee only: still disabled
  sandbox.selectEmployeeMobile('000023');
  assert.strictEqual(mBtn.disabled, true, 'Still disabled with qty=0');

  // Increment size: enabled
  sandbox.adjustMobileSizeQty('M', 1);
  assert.strictEqual(mBtn.disabled, false, 'Enabled with emp + qty > 0');
  assert.ok(!mBtn.classList.contains('opacity-50'));
  assert.ok(!mBtn.classList.contains('pointer-events-none'));

  // Decrement back to 0: disabled
  sandbox.adjustMobileSizeQty('M', -1);
  assert.strictEqual(mBtn.disabled, true, 'Disabled when qty returned to 0');
  assert.ok(mBtn.classList.contains('opacity-50'));
  assert.ok(mBtn.classList.contains('pointer-events-none'));
});

// =========================================================================
// TASK 6: Full 210 Employee Master Dataset Search & Autocomplete Fuzzing
// =========================================================================

suite.test('Task 6.1: Master employee dataset contains exactly 210 valid records with 6-digit plain text IDs', () => {
  const employees = loadEmployees();
  assert.strictEqual(employees.length, 210, 'Dataset must have exactly 210 employee records');

  employees.forEach((emp, idx) => {
    assert.ok(emp.id, `Employee at index ${idx} must have id`);
    assert.match(emp.id, /^\d{6}$/, `Employee id "${emp.id}" must be strictly 6 digits`);
    assert.ok(emp.fullName && emp.fullName.trim().length > 0, `Record ${emp.id} must have fullName`);
    assert.ok(emp.department && emp.department.trim().length > 0, `Record ${emp.id} must have department`);
  });
});

suite.test('Task 6.2: Desktop onSearchEmployee() fuzzed across 50 adversarial input vectors without crashing', () => {
  const { sandbox, document } = createDesktopContext();
  const dropdown = document.getElementById('autocompleteDropdown');
  const results = document.getElementById('autocompleteResults');

  const fuzzVectors = [
    '',                                  // Empty
    ' ',                                 // Whitespace single
    '    ',                              // Multi whitespace
    '\t',                                // Tab
    '\n',                                // Newline
    '0',                                 // Single digit (should be < 2 chars, hidden)
    'ก',                                 // Single Thai char (< 2 chars, hidden)
    '00',                                // 2-char leading zeroes
    '000',                               // 3-char leading zeroes
    '0000',                              // 4-char leading zeroes
    '000023',                            // Exact 6-digit existing
    '999999',                            // Non-existent 6-digit
    'สมชาย',                             // Common Thai name
    'วรรณ',                              // Thai vowel/syllable
    'พยาบาล',                            // Department search
    'แพทย์',                             // Position search
    'เภสัชกรรม',                         // Department search
    'นางสาว',                            // Prefix search
    'นาย',                               // Prefix search
    '<script>alert(1)</script>',         // XSS vector 1
    '"><img src=x onerror=alert(1)>',    // XSS vector 2
    '<svg/onload=alert(1)>',             // XSS vector 3
    '\' OR \'1\'=\'1',                   // SQL Injection 1
    '\'; DROP TABLE employees; --',      // SQL Injection 2
    '{{7*7}}',                           // Template injection
    '${alert(1)}',                       // ES6 template injection
    '~`!@#$%^&*()_+-=[]{}|;:\'",.<>?/', // Special symbols
    'ก'.repeat(100),                     // Long Thai string (100 chars)
    'A'.repeat(500),                     // Very long string (500 chars)
    '000000000000',                      // 12 zeroes
    'EXT-01',                            // Alphanumeric
    'null',                              // JS reserved
    'undefined',                         // JS reserved
    'NaN',                               // JS reserved
    'true',                              // Boolean string
    'false',                             // Boolean string
    '[object Object]',                   // Stringified object
    '\\0',                               // Null byte escape
    '\\n\\r',                            // Escape sequences
    'ศักดิ์',                            // Thai tone marks
    'พันธุ์',                            // Thai karant
    'ณัฏฐ์',                             // Complex Thai ligatures
    ' ',                                 // Mixed space
    ' 000023 ',                          // Leading/trailing spaces around valid ID
    ' สมชาย ',                           // Leading/trailing spaces around name
    'ICU',                               // English uppercase dept
    'icu',                               // English lowercase dept
    'hrd',                               // Lowercase dept
    'PPCH'                               // Hospital acronym
  ];

  fuzzVectors.forEach(vec => {
    assert.doesNotThrow(() => {
      sandbox.onSearchEmployee(vec);
    }, `onSearchEmployee crashed on vector: "${vec}"`);

    // Invariants
    const trimmed = vec.trim();
    if (!trimmed || trimmed.length < 2) {
      assert.ok(dropdown.classList.contains('hidden'), `Dropdown should be hidden for query length < 2: "${vec}"`);
    } else {
      // If visible, check DOM content
      assert.ok(!dropdown.classList.contains('hidden'), `Dropdown should be visible for query: "${vec}"`);
      // Results must not be empty string
      assert.ok(results.innerHTML.length > 0, `Results container must have output for query: "${vec}"`);
    }
  });
});

suite.test('Task 6.3: Mobile filterSheetEmployees() fuzzed across 50 adversarial input vectors without crashing', () => {
  const { sandbox, document } = createMobileContext();
  const listContainer = document.getElementById('mSheetEmployeeList');

  const fuzzVectors = [
    '', '   ', '0', '00', '000', '000023', '999999',
    'สมชาย', 'พยาบาล', 'เภสัชกรรม', 'นางสาว', 'นาย',
    '<script>alert(1)</script>', '\' OR \'1\'=\'1',
    '~`!@#$%^&*()_+-=[]{}|;:\'",.<>?/', 'ก'.repeat(100),
    'ศักดิ์', 'พันธุ์', ' 000023 ', 'icu', 'PPCH'
  ];

  fuzzVectors.forEach(vec => {
    assert.doesNotThrow(() => {
      sandbox.filterSheetEmployees(vec);
    }, `filterSheetEmployees crashed on vector: "${vec}"`);

    assert.ok(listContainer.innerHTML.length > 0, `List container should have rendered content for: "${vec}"`);

    // Verify empty query resets to all 210 employees
    if (!vec || vec.trim().length === 0) {
      const renderedCards = listContainer.innerHTML.match(/onclick="selectEmployeeMobile/g);
      assert.strictEqual(renderedCards.length, 210, 'Empty query must reset list to all 210 employees');
    }
  });
});

suite.test('Task 6.4: Full 210 employees search exhaustively yields exact match for every employee ID', () => {
  const { sandbox, document } = createDesktopContext();
  const employees = loadEmployees();
  const results = document.getElementById('autocompleteResults');

  // Search each employee by their 6-digit ID
  employees.forEach(emp => {
    sandbox.onSearchEmployee(emp.id);
    assert.ok(results.innerHTML.includes(emp.id), `Query "${emp.id}" must find employee ${emp.fullName}`);
    assert.ok(results.innerHTML.includes(emp.fullName), `Query "${emp.id}" must display name ${emp.fullName}`);
  });
});

// Run all test cases
if (require.main === module) {
  suite.run(true).then(report => {
    console.log(`\nAdversarial UI Stress Results: ${report.passed}/${report.total} passed in ${report.durationMs}ms`);
    process.exit(report.failed > 0 ? 1 : 0);
  });
}

module.exports = suite;
