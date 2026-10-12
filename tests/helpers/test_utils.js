/**
 * Test Utilities and Environment Mocks for PPCH Jacket Booking System Test Suite
 * Provides DOM mocks, GAS mocks, source code extractors, and assertion helpers.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Lightweight Mock DOM Element
 */
class MockElement {
  constructor(tagName = 'div', id = '', className = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = className;
    this.classList = new MockClassList(this);
    this.value = '';
    this._innerText = '';
    this._innerHTML = '';
    this.style = {};
    this.dataset = {};
    this.disabled = false;
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
  }

  get innerText() {
    return this._innerText;
  }

  set innerText(val) {
    this._innerText = String(val);
  }

  get textContent() {
    return this._innerText;
  }

  set textContent(val) {
    this._innerText = String(val);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
  }

  getAttribute(name) {
    return this.attributes[name] || null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  focus() {}
  click() {}

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  querySelectorAll(selector) {
    // Basic selector support for class or tag
    const results = [];
    const search = (node) => {
      for (const child of node.children) {
        if (selector.startsWith('.') && child.classList.contains(selector.slice(1))) {
          results.push(child);
        } else if (child.tagName.toLowerCase() === selector.toLowerCase()) {
          results.push(child);
        }
        search(child);
      }
    };
    search(this);
    return results;
  }
}

class MockClassList {
  constructor(el) {
    this.el = el;
  }

  _getClasses() {
    return (this.el.className || '').trim().split(/\s+/).filter(Boolean);
  }

  contains(cls) {
    return this._getClasses().includes(cls);
  }

  add(...classes) {
    const set = new Set(this._getClasses());
    classes.forEach(c => set.add(c));
    this.el.className = Array.from(set).join(' ');
  }

  remove(...classes) {
    const toRemove = new Set(classes);
    this.el.className = this._getClasses().filter(c => !toRemove.has(c)).join(' ');
  }

  toggle(cls, force) {
    if (force !== undefined) {
      if (force) this.add(cls);
      else this.remove(cls);
      return force;
    }
    if (this.contains(cls)) {
      this.remove(cls);
      return false;
    } else {
      this.add(cls);
      return true;
    }
  }
}

/**
 * Mock Document
 */
class MockDocument {
  constructor() {
    this.elements = new Map();
    this.body = this.createElement('body');
  }

  createElement(tag) {
    return new MockElement(tag);
  }

  getElementById(id) {
    if (!this.elements.has(id)) {
      // Auto-create or return null if requested
      const el = new MockElement('div', id);
      this.elements.set(id, el);
    }
    return this.elements.get(id);
  }

  registerElement(id, tag = 'div', className = '') {
    const el = new MockElement(tag, id, className);
    this.elements.set(id, el);
    return el;
  }

  querySelectorAll(selector) {
    const results = [];
    for (const el of this.elements.values()) {
      if (selector.startsWith('.') && el.classList.contains(selector.slice(1))) {
        results.push(el);
      } else if (selector.startsWith('#') && el.id === selector.slice(1)) {
        results.push(el);
      }
    }
    return results;
  }

  addEventListener() {}
}

/**
 * Load raw text of a project file
 */
function readProjectFile(relPath) {
  const fullPath = path.join(PROJECT_ROOT, relPath);
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Load employees dataset
 */
function loadEmployees() {
  const content = readProjectFile('data/employees.json');
  return JSON.parse(content);
}

/**
 * Load Google Apps Script (Code.gs) into isolated VM sandbox
 */
function loadGasBackend(sheetMock = null) {
  const code = readProjectFile('gas/Code.gs');
  
  // Default in-memory sheet mock if not provided
  const sheetRows = sheetMock ? sheetMock.rows : [
    [
      'รหัสการจอง', 'วันเวลาที่ลงทะเบียน', 'รหัสพนักงาน', 'ชื่อ', 'นามสกุล', 'แผนก', 'ตำแหน่ง',
      'ไซส์ M (อก 40")', 'ไซส์ L (อก 42")', 'ไซส์ XL (อก 44")', 'ไซส์ 2XL (อก 46")', 'ไซส์ 3XL (อก 48")', 'ไซส์ 4XL (อก 50")',
      'จำนวนรวม (ตัว)', 'ยอดประมาณการ (บาท)', 'สถานะ'
    ]
  ];

  const currentSheet = {
    rows: sheetRows,
    getLastRow: () => sheetRows.length,
    getLastColumn: () => (sheetRows[0] ? sheetRows[0].length : 0),
    getName: () => 'รายการสั่งจองเสื้อ',
    setName: (name) => {},
    clear: () => {
      sheetRows.length = 0;
    },
    getDataRange: () => ({
      getValues: () => sheetRows.map(r => [...r])
    }),
    getRange: (row, col, numRows = 1, numCols = 1) => {
      if (typeof row === 'string') {
        // e.g. "C:C"
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

  let lockAcquired = false;
  const mockLock = {
    tryLock: (ms) => {
      lockAcquired = true;
      return true;
    },
    waitLock: (ms) => {
      lockAcquired = true;
    },
    releaseLock: () => {
      lockAcquired = false;
    }
  };

  const sandbox = {
    SpreadsheetApp: {
      openById: (id) => ({
        getSheetByName: (name) => currentSheet,
        getSheets: () => [currentSheet],
        getActiveSpreadsheet: () => ({ getSheetByName: () => currentSheet })
      }),
      getActiveSpreadsheet: () => ({
        getSheetByName: () => currentSheet,
        getSheets: () => [currentSheet]
      }),
      flush: () => {},
      getUi: () => ({ alert: () => {} })
    },
    LockService: {
      getScriptLock: () => mockLock
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
      MimeType: {
        JSON: 'application/json'
      }
    },
    HtmlService: {
      createHtmlOutput: (html) => ({
        setWidth: () => ({ setHeight: () => ({}) })
      })
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

  vm.createContext(sandbox);
  // Expose top-level declarations to sandbox
  const augmentedCode = code + `
    this.CONFIG = CONFIG;
    this.getTargetSheet = getTargetSheet;
    this.getExpectedHeaders = getExpectedHeaders;
    this.checkAndMigrateHeaders = checkAndMigrateHeaders;
    this.applySheetHeaders = applySheetHeaders;
    this.migrateToMultiSizeColumns = migrateToMultiSizeColumns;
    this.doGet = doGet;
    this.doPost = doPost;
    this.processBooking = processBooking;
    this.handleGetRegistrations = handleGetRegistrations;
  `;

  vm.runInContext(augmentedCode, sandbox);
  return sandbox;
}

/**
 * Extract script bodies from an HTML string
 */
function extractScriptsFromHtml(html) {
  const matches = [];
  const regex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    if (m[1] && m[1].trim()) {
      matches.push(m[1]);
    }
  }
  return matches;
}

module.exports = {
  PROJECT_ROOT,
  MockElement,
  MockClassList,
  MockDocument,
  readProjectFile,
  loadEmployees,
  loadGasBackend,
  extractScriptsFromHtml,
  assert
};
