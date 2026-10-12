/**
 * Tier 5: Adversarial Stress & Concurrency Hardening Test Suite
 * Empirical verification of backend business logic, concurrency queuing,
 * row duplicate prevention, 6-digit ID boundaries, quantity exploit payloads,
 * and data contract integrity.
 */

const { TestSuite, assert } = require('./helpers/test_framework');
const { readProjectFile } = require('./helpers/test_utils');
const vm = require('vm');

const suite = new TestSuite('Tier 5: Adversarial Stress & Concurrency Hardening');

/**
 * Creates an instrumented GAS environment with customizable LockService and shared sheet
 */
function createInstrumentedGasBackend(options = {}) {
  const code = readProjectFile('gas/Code.gs');
  
  const sheetRows = options.initialRows ? options.initialRows.map(r => [...r]) : [
    [
      'รหัสการจอง', 'วันเวลาที่ลงทะเบียน', 'รหัสพนักงาน', 'ชื่อ', 'นามสกุล', 'แผนก', 'ตำแหน่ง',
      'ไซส์ M (อก 40")', 'ไซส์ L (อก 42")', 'ไซส์ XL (อก 44")', 'ไซส์ 2XL (อก 46")', 'ไซส์ 3XL (อก 48")', 'ไซส์ 4XL (อก 50")',
      'จำนวนรวม (ตัว)', 'ยอดประมาณการ (บาท)', 'สถานะ'
    ]
  ];

  let lockState = {
    isLocked: options.initiallyLocked || false,
    lockCount: 0,
    tryLockCalls: 0,
    waitLockCalls: 0,
    releaseLockCalls: 0
  };

  const sharedLock = {
    tryLock: (timeoutMs) => {
      lockState.tryLockCalls++;
      if (options.forceLockTimeout) {
        return false;
      }
      if (lockState.isLocked) {
        return false;
      }
      lockState.isLocked = true;
      lockState.lockCount++;
      return true;
    },
    waitLock: (timeoutMs) => {
      lockState.waitLockCalls++;
      if (options.forceLockTimeout) {
        throw new Error('Could not obtain lock after ' + timeoutMs + ' milliseconds');
      }
      if (lockState.isLocked) {
        throw new Error('Lock contention: could not obtain lock within timeout');
      }
      lockState.isLocked = true;
      lockState.lockCount++;
    },
    releaseLock: () => {
      lockState.releaseLockCalls++;
      lockState.isLocked = false;
    }
  };

  const currentSheet = {
    rows: sheetRows,
    getLastRow: () => sheetRows.length,
    getLastColumn: () => (sheetRows[0] ? sheetRows[0].length : 0),
    getName: () => 'รายการสั่งจองเสื้อ',
    setName: () => {},
    clear: () => { sheetRows.length = 0; },
    getDataRange: () => ({
      getValues: () => sheetRows.map(r => [...r])
    }),
    getRange: (row, col, numRows = 1, numCols = 1) => {
      if (typeof row === 'string') {
        return {
          setNumberFormat: () => ({ setValue: () => {} }),
          setValue: () => {}
        };
      }
      return {
        getValues: () => {
          const res = [];
          for (let r = 0; r < numRows; r++) {
            const rowIdx = row - 1 + r;
            const rData = sheetRows[rowIdx] || [];
            res.push(rData.slice(col - 1, col - 1 + numCols));
          }
          return res;
        },
        setValues: (vals) => {
          for (let r = 0; r < vals.length; r++) {
            const targetRow = row - 1 + r;
            if (!sheetRows[targetRow]) sheetRows[targetRow] = [];
            for (let c = 0; c < vals[r].length; c++) {
              sheetRows[targetRow][col - 1 + c] = vals[r][c];
            }
          }
        },
        setValue: (val) => {
          const targetRow = row - 1;
          if (!sheetRows[targetRow]) sheetRows[targetRow] = [];
          sheetRows[targetRow][col - 1] = val;
        },
        setNumberFormat: () => ({
          setValue: (val) => {
            const targetRow = row - 1;
            if (!sheetRows[targetRow]) sheetRows[targetRow] = [];
            sheetRows[targetRow][col - 1] = val;
          }
        }),
        setBackground: () => {},
        setFontColor: () => {},
        setFontWeight: () => {},
        setHorizontalAlignment: () => {}
      };
    },
    setFrozenRows: () => {},
    autoResizeColumns: () => {}
  };

  let flushCalls = 0;
  const sandbox = {
    SpreadsheetApp: {
      openById: () => ({
        getSheetByName: () => currentSheet,
        getSheets: () => [currentSheet],
        getActiveSpreadsheet: () => ({ getSheetByName: () => currentSheet })
      }),
      getActiveSpreadsheet: () => ({
        getSheetByName: () => currentSheet,
        getSheets: () => [currentSheet]
      }),
      flush: () => { flushCalls++; },
      getUi: () => ({ alert: () => {} })
    },
    LockService: {
      getScriptLock: () => sharedLock
    },
    Utilities: {
      formatDate: (date, tz, fmt) => {
        if (fmt.includes('yyyyMMdd-')) return '20261012-';
        return '2026-10-12 12:00:00';
      }
    },
    ContentService: {
      createTextOutput: (str) => ({
        setMimeType: () => str,
        getContent: () => str
      }),
      MimeType: { JSON: 'application/json' }
    },
    HtmlService: {
      createHtmlOutput: () => ({ setWidth: () => ({ setHeight: () => ({}) }) })
    },
    console: console,
    Math: Math,
    Date: Date,
    parseInt: parseInt,
    Number: Number,
    String: String,
    Array: Array
  };

  sandbox._sheet = currentSheet;
  sandbox._sheetRows = sheetRows;
  sandbox._lockState = lockState;
  sandbox._getFlushCalls = () => flushCalls;

  vm.createContext(sandbox);
  const augmentedCode = code + `
    this.CONFIG = CONFIG;
    this.getTargetSheet = getTargetSheet;
    this.processBooking = processBooking;
    this.handleGetRegistrations = handleGetRegistrations;
    this.doPost = doPost;
    this.doGet = doGet;
  `;
  vm.runInContext(augmentedCode, sandbox);
  return sandbox;
}

function parseRes(res) {
  return JSON.parse(res.getContent ? res.getContent() : res);
}

// =========================================================================
// Suite 1: Concurrency Queuing & Lock Contention Simulation
// =========================================================================

suite.test('ADV-1.1: Lock contention timeout triggers queueBusy: true response', () => {
  const gas = createInstrumentedGasBackend({ forceLockTimeout: true });
  const raw = gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: 1
  });
  const data = parseRes(raw);
  
  assert.strictEqual(data.success, false, 'Contended lock must return success: false');
  assert.strictEqual(data.queueBusy, true, 'Must flag queueBusy: true on lock contention');
  assert.match(data.message, /ระบบกำลังจัดคิวบันทึกข้อมูล/, 'Must return queue guidance message');
  assert.strictEqual(gas._lockState.tryLockCalls, 1, 'Must invoke tryLock');
  assert.strictEqual(gas._lockState.waitLockCalls, 1, 'Must fallback to waitLock');
  assert.strictEqual(gas._lockState.releaseLockCalls, 0, 'Must NOT release unacquired lock');
});

suite.test('ADV-1.2: Lock mutual exclusion serializes concurrent submissions', () => {
  const initialRows = [
    [
      'รหัสการจอง', 'วันเวลาที่ลงทะเบียน', 'รหัสพนักงาน', 'ชื่อ', 'นามสกุล', 'แผนก', 'ตำแหน่ง',
      'ไซส์ M (อก 40")', 'ไซส์ L (อก 42")', 'ไซส์ XL (อก 44")', 'ไซส์ 2XL (อก 46")', 'ไซส์ 3XL (อก 48")', 'ไซส์ 4XL (อก 50")',
      'จำนวนรวม (ตัว)', 'ยอดประมาณการ (บาท)', 'สถานะ'
    ]
  ];
  const gas = createInstrumentedGasBackend({ initialRows });

  const res1 = parseRes(gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: 1
  }));
  assert.strictEqual(res1.success, true);
  assert.strictEqual(gas._lockState.releaseLockCalls, 1, 'Worker 1 released lock');

  const res2 = parseRes(gas.processBooking({
    empId: '000045',
    firstName: 'วีรยุทธ',
    qtyL: 2
  }));
  assert.strictEqual(res2.success, true);
  assert.strictEqual(gas._lockState.releaseLockCalls, 2, 'Worker 2 released lock');

  assert.strictEqual(gas._sheetRows.length, 3, 'Both records written sequentially');
  assert.strictEqual(gas._getFlushCalls() >= 2, true, 'SpreadsheetApp.flush() executed for each booking');
});

suite.test('ADV-1.3: Burst concurrency simulation: 10 serialized submissions with zero row loss', () => {
  const gas = createInstrumentedGasBackend();
  const testEmployees = [
    { id: '000023', name: 'กมลชนก', size: 'qtyM', count: 1 },
    { id: '000045', name: 'วีรยุทธ', size: 'qtyL', count: 1 },
    { id: '000088', name: 'ศิริพร', size: 'qtyXL', count: 2 },
    { id: '000102', name: 'กิตติศักดิ์', size: 'qty2XL', count: 1 },
    { id: '000155', name: 'นภัสสร', size: 'qty3XL', count: 1 },
    { id: '000188', name: 'ธนากร', size: 'qty4XL', count: 1 },
    { id: '000001', name: 'สมชาย', size: 'qtyM', count: 3 },
    { id: '000002', name: 'สมหญิง', size: 'qtyL', count: 1 },
    { id: '000003', name: 'วิชัย', size: 'qtyXL', count: 1 },
    { id: '000004', name: 'พรทิพย์', size: 'qty2XL', count: 2 }
  ];

  for (const emp of testEmployees) {
    const payload = {
      empId: emp.id,
      firstName: emp.name,
      [emp.size]: emp.count
    };
    const res = parseRes(gas.processBooking(payload));
    assert.strictEqual(res.success, true);
  }

  assert.strictEqual(gas._sheetRows.length, 11, 'Sheet must have exactly 11 rows (1 header + 10 data)');
  const recordedIds = gas._sheetRows.slice(1).map(r => r[2]);
  for (const emp of testEmployees) {
    assert.strictEqual(recordedIds.includes(emp.id), true, `Employee ${emp.id} must be in sheet`);
  }
});

suite.test('ADV-1.4: Script lock releases reliably on unexpected runtime exception', () => {
  const gas = createInstrumentedGasBackend();
  gas._sheet.getDataRange = () => { throw new Error('Simulated Google Sheet API timeout'); };

  const res = parseRes(gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: 1
  }));

  assert.strictEqual(res.success, false);
  assert.strictEqual(res.queueBusy, true);
  assert.strictEqual(gas._lockState.releaseLockCalls, 1, 'Lock must be released in finally block');
});

// =========================================================================
// Suite 2: Row Duplicate Prevention (Rapid Repeated Updates & add_more)
// =========================================================================

suite.test('ADV-2.1: Rapid repeated submissions with mode "new" maintain single row in-place', () => {
  const gas = createInstrumentedGasBackend();
  const empId = '000023';

  for (let i = 1; i <= 5; i++) {
    const res = parseRes(gas.processBooking({
      empId: empId,
      firstName: 'กมลชนก',
      bookingMode: 'new',
      qtyM: i
    }));
    assert.strictEqual(res.success, true);
    if (i > 1) {
      assert.strictEqual(res.isUpdate, true, `Call ${i} must be recognized as existing row update`);
    }
  }

  const matchingRows = gas._sheetRows.filter(r => r[2] === empId);
  assert.strictEqual(matchingRows.length, 1, 'Must have zero duplicate rows for employee 000023');
  assert.strictEqual(matchingRows[0][7], 5, 'Final quantity M must be 5 (latest in-place update)');
  assert.strictEqual(matchingRows[0][13], 5, 'Final totalQty must be 5');
  assert.strictEqual(matchingRows[0][14], 2500, 'Final totalPrice must be 2,500 THB');
});

suite.test('ADV-2.2: Interleaved rapid update and add_more cycles guarantee zero duplicate rows', () => {
  const gas = createInstrumentedGasBackend();
  const empId = '000045';

  // 1. Initial booking: M: 1
  parseRes(gas.processBooking({ empId, firstName: 'วีรยุทธ', bookingMode: 'new', qtyM: 1 }));
  assert.strictEqual(gas._sheetRows.length, 2);

  // 2. Update to L: 2 (replaces M: 1)
  const r2 = parseRes(gas.processBooking({ empId, firstName: 'วีรยุทธ', bookingMode: 'update', qtyL: 2 }));
  assert.strictEqual(r2.qtyL, 2);
  assert.strictEqual(r2.qtyM, 0);
  assert.strictEqual(gas._sheetRows.length, 2, 'Row count must stay 2');

  // 3. Add more XL: 1 (adds to L: 2 -> L: 2, XL: 1)
  const r3 = parseRes(gas.processBooking({ empId, firstName: 'วีรยุทธ', bookingMode: 'add_more', qtyXL: 1 }));
  assert.strictEqual(r3.qtyL, 2);
  assert.strictEqual(r3.qtyXL, 1);
  assert.strictEqual(r3.totalQty, 3);
  assert.strictEqual(gas._sheetRows.length, 2, 'Row count must stay 2');

  // 4. Update to 2XL: 3 (replaces previous -> 2XL: 3)
  const r4 = parseRes(gas.processBooking({ empId, firstName: 'วีรยุทธ', bookingMode: 'update', qty2XL: 3 }));
  assert.strictEqual(r4.qty2XL, 3);
  assert.strictEqual(r4.totalQty, 3);
  assert.strictEqual(gas._sheetRows.length, 2, 'Row count must stay 2');

  // 5. Add more M: 2 (adds to 2XL: 3 -> M: 2, 2XL: 3, total = 5)
  const r5 = parseRes(gas.processBooking({ empId, firstName: 'วีรยุทธ', bookingMode: 'add_more', qtyM: 2 }));
  assert.strictEqual(r5.qtyM, 2);
  assert.strictEqual(r5.qty2XL, 3);
  assert.strictEqual(r5.totalQty, 5);
  assert.strictEqual(r5.totalPrice, 2500);
  assert.strictEqual(gas._sheetRows.length, 2, 'Row count must remain exactly 2');
});

suite.test('ADV-2.3: Multi-employee interleaved rapid booking stress test (20 operations)', () => {
  const gas = createInstrumentedGasBackend();
  const emps = ['000023', '000045', '000088', '000102', '000155'];

  for (const emp of emps) {
    parseRes(gas.processBooking({ empId: emp, firstName: 'Staff-' + emp, qtyM: 1 }));
  }
  assert.strictEqual(gas._sheetRows.length, 6, '5 employees + 1 header = 6 rows');

  for (let cycle = 0; cycle < 3; cycle++) {
    for (const emp of emps) {
      const mode = cycle % 2 === 0 ? 'add_more' : 'update';
      const res = parseRes(gas.processBooking({
        empId: emp,
        firstName: 'Staff-' + emp,
        bookingMode: mode,
        qtyL: 1
      }));
      assert.strictEqual(res.success, true);
    }
  }

  assert.strictEqual(gas._sheetRows.length, 6, 'Sheet must have exactly 6 rows total');
  const recordedIds = gas._sheetRows.slice(1).map(r => r[2]);
  const uniqueIds = new Set(recordedIds);
  assert.strictEqual(uniqueIds.size, 5, 'All 5 employee IDs must be unique in sheet');
});

suite.test('ADV-2.4: add_more mode properly accumulates all 6 size columns simultaneously', () => {
  const gas = createInstrumentedGasBackend();
  const empId = '000023';

  parseRes(gas.processBooking({
    empId,
    firstName: 'กมลชนก',
    qtyM: 1, qtyL: 2, qtyXL: 0, qty2XL: 3, qty3XL: 0, qty4XL: 1
  }));

  const res = parseRes(gas.processBooking({
    empId,
    firstName: 'กมลชนก',
    bookingMode: 'add_more',
    qtyM: 2, qtyL: 1, qtyXL: 3, qty2XL: 0, qty3XL: 4, qty4XL: 1
  }));

  assert.strictEqual(res.qtyM, 3, 'M: 1 + 2 = 3');
  assert.strictEqual(res.qtyL, 3, 'L: 2 + 1 = 3');
  assert.strictEqual(res.qtyXL, 3, 'XL: 0 + 3 = 3');
  assert.strictEqual(res.qty2XL, 3, '2XL: 3 + 0 = 3');
  assert.strictEqual(res.qty3XL, 4, '3XL: 0 + 4 = 4');
  assert.strictEqual(res.qty4XL, 2, '4XL: 1 + 1 = 2');
  assert.strictEqual(res.totalQty, 18, 'Total must be 18');
  assert.strictEqual(res.totalPrice, 9000, 'Total price must be 9,000 THB');

  const row = gas._sheetRows[1];
  assert.strictEqual(row[7], 3);
  assert.strictEqual(row[8], 3);
  assert.strictEqual(row[9], 3);
  assert.strictEqual(row[10], 3);
  assert.strictEqual(row[11], 4);
  assert.strictEqual(row[12], 2);
  assert.strictEqual(row[13], 18);
  assert.strictEqual(row[14], 9000);
});

// =========================================================================
// Suite 3: 6-Digit Employee ID Boundary Exploits & Sanitization
// =========================================================================

suite.test('ADV-3.1: Leading zero preservation ("000023") formatted as Plain Text (@)', () => {
  const gas = createInstrumentedGasBackend();
  const res = parseRes(gas.processBooking({ empId: '000023', firstName: 'กมลชนก', qtyM: 1 }));
  assert.strictEqual(res.empId, '000023');
  assert.strictEqual(gas._sheetRows[1][2], '000023');
});

suite.test('ADV-3.2: Short numeric IDs auto-padded with leading zeroes to 6 digits', () => {
  const gas = createInstrumentedGasBackend();
  const testCases = [
    { in: 1, expected: '000001' },
    { in: '23', expected: '000023' },
    { in: 456, expected: '000456' },
    { in: '12345', expected: '012345' },
    { in: 123456, expected: '123456' }
  ];

  for (const tc of testCases) {
    const res = parseRes(gas.processBooking({ empId: tc.in, firstName: 'Test', qtyM: 1 }));
    assert.strictEqual(res.empId, tc.expected, `Input ${tc.in} must pad to ${tc.expected}`);
  }
});

suite.test('ADV-3.3: Whitespace around numeric ID is cleanly trimmed and padded', () => {
  const gas = createInstrumentedGasBackend();
  const res = parseRes(gas.processBooking({ empId: '   000023   ', firstName: 'กมลชนก', qtyM: 1 }));
  assert.strictEqual(res.empId, '000023');
});

suite.test('ADV-3.4: Pure whitespace empId ("   ") MUST be rejected, not written as blank ID', () => {
  const gas = createInstrumentedGasBackend();
  const res = parseRes(gas.processBooking({ empId: '   ', firstName: 'กมลชนก', qtyM: 1 }));
  // Expected behavior: Must reject blank/whitespace employee ID with success: false
  assert.strictEqual(res.success, false, 'Whitespace-only empId must be rejected with success: false');
  assert.notStrictEqual(res.empId, '', 'Must not allow blank employee ID in sheet');
});

suite.test('ADV-3.5: Non-numeric script injection ("<script>alert(1)</script>") MUST be rejected', () => {
  const gas = createInstrumentedGasBackend();
  const res = parseRes(gas.processBooking({
    empId: '<script>alert(1)</script>',
    firstName: 'กมลชนก',
    qtyM: 1
  }));
  // Expected behavior: Col C is strictly for 6-digit numeric IDs; non-numeric scripts must be rejected
  assert.strictEqual(res.success, false, 'Non-numeric / script injection employee ID must be rejected');
});

// =========================================================================
// Suite 4: Quantity Payload Exploits (Negative, Decimal, NaN, Zero)
// =========================================================================

suite.test('ADV-4.1: Pure zero-quantity payload is strictly rejected with guidance', () => {
  const gas = createInstrumentedGasBackend();
  const res = parseRes(gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: 0, qtyL: 0, qtyXL: 0, qty2XL: 0, qty3XL: 0, qty4XL: 0
  }));
  assert.strictEqual(res.success, false);
  assert.match(res.message, /กรุณาเลือกจำนวนเสื้ออย่างน้อย 1 ตัว/);
});

suite.test('ADV-4.2: Pure negative quantity payload is rejected', () => {
  const gas = createInstrumentedGasBackend();
  const res = parseRes(gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: -2, qtyL: -3
  }));
  assert.strictEqual(res.success, false);
  assert.match(res.message, /กรุณาเลือกจำนวนเสื้ออย่างน้อย 1 ตัว/);
});

suite.test('ADV-4.3: Mixed negative quantity exploit (qtyM: -5, qtyL: 6) MUST be rejected', () => {
  const gas = createInstrumentedGasBackend();
  const res = parseRes(gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: -5,
    qtyL: 6
  }));
  // Expected behavior: An individual size must NOT be negative. Backend must reject negative sizes.
  assert.strictEqual(res.success, false, 'Payload containing negative size quantity (-5) must be rejected');
});

suite.test('ADV-4.4: Negative quantity in add_more mode order subtraction exploit MUST be rejected', () => {
  const gas = createInstrumentedGasBackend();
  parseRes(gas.processBooking({ empId: '000023', firstName: 'กมลชนก', qtyM: 2 }));

  // Adversary submits add_more with negative quantity to reduce confirmed order
  const res = parseRes(gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    bookingMode: 'add_more',
    qtyM: -1
  }));

  // Expected behavior: add_more mode must reject negative incremental quantities
  assert.strictEqual(res.success, false, 'Negative incremental quantity in add_more mode must be rejected');
});

suite.test('ADV-4.5: Decimal quantity (1.5, 2.9) MUST be rejected, not silently truncated', () => {
  const gas = createInstrumentedGasBackend();
  const res = parseRes(gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: 1.5,
    qtyL: 2.9
  }));
  // Expected behavior: Jackets cannot be ordered in fractional units; decimal payloads should be rejected
  assert.strictEqual(res.success, false, 'Decimal jacket quantities must be rejected as invalid input');
});

suite.test('ADV-4.6: NaN and string quantity coercion fallback', () => {
  const gas = createInstrumentedGasBackend();
  const res = parseRes(gas.processBooking({
    empId: '000023',
    firstName: 'กมลชนก',
    qtyM: NaN,
    qtyL: 'two',
    qtyXL: null,
    qty2XL: undefined,
    qty3XL: 2
  }));
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.qtyM, 0);
  assert.strictEqual(res.qtyL, 0);
  assert.strictEqual(res.qtyXL, 0);
  assert.strictEqual(res.qty2XL, 0);
  assert.strictEqual(res.qty3XL, 2);
  assert.strictEqual(res.totalQty, 2);
});

// =========================================================================
// Suite 5: Payload Contract Verification (qty vs totalQty)
// =========================================================================

suite.test('ADV-5.1: processBooking response guarantees both qty and totalQty contracts across all modes', () => {
  const gas = createInstrumentedGasBackend();
  const modes = ['new', 'update', 'add_more'];

  for (const mode of modes) {
    const res = parseRes(gas.processBooking({
      empId: '000023',
      firstName: 'กมลชนก',
      bookingMode: mode,
      qtyM: 1,
      qtyL: 2
    }));
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.qty !== undefined, true, `Mode ${mode} must include 'qty'`);
    assert.strictEqual(res.totalQty !== undefined, true, `Mode ${mode} must include 'totalQty'`);
    assert.strictEqual(res.qty, res.totalQty, `Mode ${mode}: 'qty' must equal 'totalQty'`);
    assert.strictEqual(typeof res.qty, 'number');
    assert.strictEqual(typeof res.totalQty, 'number');
  }
});

suite.test('ADV-5.2: handleGetRegistrations items contract guarantees both qty and totalQty', () => {
  const gas = createInstrumentedGasBackend();
  parseRes(gas.processBooking({ empId: '000023', firstName: 'กมลชนก', qtyM: 1, qtyL: 1 }));
  parseRes(gas.processBooking({ empId: '000045', firstName: 'วีรยุทธ', qtyXL: 2 }));

  const raw = gas.handleGetRegistrations();
  const data = parseRes(raw);

  assert.strictEqual(data.items.length, 2);
  for (const item of data.items) {
    assert.strictEqual(item.qty !== undefined, true, 'Item must have qty');
    assert.strictEqual(item.totalQty !== undefined, true, 'Item must have totalQty');
    assert.strictEqual(item.qty, item.totalQty, 'Item qty must equal totalQty');
    assert.strictEqual(typeof item.qty, 'number');
    assert.strictEqual(typeof item.totalQty, 'number');
  }
});

suite.test('ADV-5.3: handleGetRegistrations top-level summary strictly reconciles with item totals', () => {
  const gas = createInstrumentedGasBackend();
  parseRes(gas.processBooking({ empId: '000023', firstName: 'กมลชนก', qtyM: 2, qtyL: 3 }));
  parseRes(gas.processBooking({ empId: '000045', firstName: 'วีรยุทธ', qtyXL: 1, qty2XL: 4 }));

  const data = parseRes(gas.handleGetRegistrations());

  const itemsSum = data.items.reduce((acc, it) => acc + it.totalQty, 0);
  const sizeBreakdownSum = Object.values(data.summaryBySize).reduce((acc, v) => acc + v, 0);

  assert.strictEqual(data.totalQty, itemsSum, 'Top totalQty matches items sum');
  assert.strictEqual(data.totalQty, sizeBreakdownSum, 'Top totalQty matches summaryBySize sum');
  assert.strictEqual(data.totalQty, 10, 'Expected total 10 jackets');
  assert.strictEqual(data.totalAmount, 5000, 'Expected total amount 5,000 THB');
});

module.exports = suite;

if (require.main === module) {
  suite.run().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
