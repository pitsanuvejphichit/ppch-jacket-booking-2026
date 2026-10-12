/**
 * Browser Environment Sandbox Loader for Desktop, Mobile, and Roster Pages
 * Evaluates the actual scripts from HTML files against a mocked DOM environment.
 */

const fs = require('fs');
const vm = require('vm');
const {
  PROJECT_ROOT,
  MockDocument,
  readProjectFile,
  loadEmployees,
  extractScriptsFromHtml
} = require('./test_utils');

/**
 * Instantiate Desktop Page Runtime Context
 */
function createDesktopContext(options = {}) {
  const html = readProjectFile('desktop.html');
  const scripts = extractScriptsFromHtml(html);
  const mainScript = scripts[1] || scripts[0];
  const doc = new MockDocument();
  const employees = options.employees || loadEmployees();

  const win = {
    PPCH_CONFIG: {
      gasEndpoint: 'https://script.google.com/macros/s/TEST/exec',
      spreadsheetId: '1E2yctLgOo3nKxcWCNyPfEVmDLKnZovPPSTVLvlq72NM',
      maxPricePerUnit: 500,
      endDate: Date.now() + 86400000,
      ...(options.config || {})
    },
    PPCH_EMPLOYEES: employees,
    document: doc,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: () => {},
    location: { search: '', replace: () => {} }
  };

  const toastCalls = [];
  const alertCalls = [];

  const sandbox = {
    window: win,
    document: doc,
    console: console,
    localStorage: {
      _data: {},
      getItem: (k) => sandbox.localStorage._data[k] || null,
      setItem: (k, v) => { sandbox.localStorage._data[k] = String(v); },
      removeItem: (k) => { delete sandbox.localStorage._data[k]; },
      clear: () => { sandbox.localStorage._data = {}; }
    },
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    fetch: options.fetchMock || (() => Promise.resolve({
      json: () => Promise.resolve({ totalBookings: 0, items: options.initialBookings || [] })
    })),
    alert: (msg) => alertCalls.push(msg),
    Date: Date,
    Math: Math,
    parseInt: parseInt,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object,
    URLSearchParams: URLSearchParams,
    _toastCalls: toastCalls,
    _alertCalls: alertCalls
  };

  vm.createContext(sandbox);

  // Expose global variables and functions to this context with reactive getters/setters
  const exportCode = `
    this.APP_CONFIG = APP_CONFIG;
    Object.defineProperty(this, 'sizeQuantities', { get: () => sizeQuantities, set: (v) => { sizeQuantities = v; } });
    Object.defineProperty(this, 'currentBookingMode', { get: () => currentBookingMode, set: (v) => { currentBookingMode = v; } });
    Object.defineProperty(this, 'selectedEmployee', { get: () => selectedEmployee, set: (v) => { selectedEmployee = v; } });
    Object.defineProperty(this, 'existingBookingRecord', { get: () => existingBookingRecord, set: (v) => { existingBookingRecord = v; } });
    Object.defineProperty(this, 'allBookings', { get: () => allBookings, set: (v) => { allBookings = v; } });
    Object.defineProperty(this, 'isSubmitting', { get: () => isSubmitting, set: (v) => { isSubmitting = v; } });
    Object.defineProperty(this, 'currentJacketView', { get: () => currentJacketView, set: (v) => { currentJacketView = v; } });

    this.adjustSizeQty = adjustSizeQty;
    this.onCardClick = onCardClick;
    this.updateSizeCardUI = updateSizeCardUI;
    this.updateAllSizeCardsUI = updateAllSizeCardsUI;
    this.updateTotalCalculation = updateTotalCalculation;
    this.onSearchEmployee = onSearchEmployee;
    this.selectEmployee = selectEmployee;
    this.clearSelectedEmployee = clearSelectedEmployee;
    this.openExistingBookingModal = openExistingBookingModal;
    this.closeExistingBookingModal = closeExistingBookingModal;
    this.confirmExistingBookingMode = confirmExistingBookingMode;
    this.toggleBookingMode = toggleBookingMode;
    this.setBookingMode = setBookingMode;
    this.handleFormSubmit = handleFormSubmit;
    this.loadBookings = loadBookings;
    this.showSuccessModal = showSuccessModal;
    this.closeSuccessModal = closeSuccessModal;
    this.resetBookingForm = resetBookingForm;
    this.showLoading = showLoading;
    this.showToast = showToast;
    this.setJacketView = setJacketView;
    this.openImageModal = openImageModal;
    this.closeImageModal = closeImageModal;
  `;

  vm.runInContext(mainScript + ';' + exportCode, sandbox);

  if (options.initialBookings) {
    sandbox.allBookings = [...options.initialBookings];
  }

  return { sandbox, document: doc, window: win, toastCalls, alertCalls, rawHtml: html };
}

/**
 * Instantiate Mobile Page Runtime Context
 */
function createMobileContext(options = {}) {
  const html = readProjectFile('mobile.html');
  const scripts = extractScriptsFromHtml(html);
  const mainScript = scripts[1] || scripts[0];
  const doc = new MockDocument();
  const employees = options.employees || loadEmployees();

  const win = {
    PPCH_CONFIG: {
      gasEndpoint: 'https://script.google.com/macros/s/TEST/exec',
      spreadsheetId: '1E2yctLgOo3nKxcWCNyPfEVmDLKnZovPPSTVLvlq72NM',
      maxPricePerUnit: 500,
      endDate: Date.now() + 86400000,
      ...(options.config || {})
    },
    PPCH_EMPLOYEES: employees,
    document: doc,
    innerWidth: 390,
    innerHeight: 844,
    addEventListener: () => {},
    location: { search: '', replace: () => {} }
  };

  const toastCalls = [];
  const alertCalls = [];

  const sandbox = {
    window: win,
    document: doc,
    console: console,
    localStorage: {
      _data: {},
      getItem: (k) => sandbox.localStorage._data[k] || null,
      setItem: (k, v) => { sandbox.localStorage._data[k] = String(v); },
      removeItem: (k) => { delete sandbox.localStorage._data[k]; },
      clear: () => { sandbox.localStorage._data = {}; }
    },
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    fetch: options.fetchMock || (() => Promise.resolve({
      json: () => Promise.resolve({ totalBookings: 0, items: options.initialBookings || [] })
    })),
    alert: (msg) => alertCalls.push(msg),
    Date: Date,
    Math: Math,
    parseInt: parseInt,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object,
    URLSearchParams: URLSearchParams,
    _toastCalls: toastCalls,
    _alertCalls: alertCalls
  };

  vm.createContext(sandbox);

  const exportCode = `
    this.MOBILE_CONFIG = MOBILE_CONFIG;
    Object.defineProperty(this, 'mSizeQuantities', { get: () => mSizeQuantities, set: (v) => { mSizeQuantities = v; } });
    Object.defineProperty(this, 'mCurrentBookingMode', { get: () => mCurrentBookingMode, set: (v) => { mCurrentBookingMode = v; } });
    Object.defineProperty(this, 'mSelectedEmployee', { get: () => mSelectedEmployee, set: (v) => { mSelectedEmployee = v; } });
    Object.defineProperty(this, 'mExistingBookingRecord', { get: () => mExistingBookingRecord, set: (v) => { mExistingBookingRecord = v; } });
    Object.defineProperty(this, 'mAllBookings', { get: () => mAllBookings, set: (v) => { mAllBookings = v; } });
    Object.defineProperty(this, 'mIsSubmitting', { get: () => mIsSubmitting, set: (v) => { mIsSubmitting = v; } });

    this.setMobileJacketView = setMobileJacketView;
    this.onMobileCardClick = onMobileCardClick;
    this.adjustMobileSizeQty = adjustMobileSizeQty;
    this.updateMobileSizeCardUI = updateMobileSizeCardUI;
    this.updateAllMobileSizeCardsUI = updateAllMobileSizeCardsUI;
    this.updateMobileTotal = updateMobileTotal;
    this.openEmployeePickerSheet = openEmployeePickerSheet;
    this.closeEmployeePickerSheet = closeEmployeePickerSheet;
    this.renderSheetEmployees = renderSheetEmployees;
    this.filterSheetEmployees = filterSheetEmployees;
    this.selectEmployeeMobile = selectEmployeeMobile;
    this.openMobileExistingBookingModal = openMobileExistingBookingModal;
    this.closeMobileExistingBookingModal = closeMobileExistingBookingModal;
    this.confirmMobileBookingMode = confirmMobileBookingMode;
    this.toggleMobileBookingMode = toggleMobileBookingMode;
    this.setMobileBookingMode = setMobileBookingMode;
    this.submitMobileBooking = submitMobileBooking;
    this.loadMobileBookings = loadMobileBookings;
    this.showMobileLoading = showMobileLoading;
    this.showMobileSuccessModal = showMobileSuccessModal;
    this.closeMobileSuccessModal = closeMobileSuccessModal;
    this.resetMobileForm = resetMobileForm;
    this.showMobileToast = showMobileToast;
  `;

  vm.runInContext(mainScript + ';' + exportCode, sandbox);

  if (options.initialBookings) {
    sandbox.mAllBookings = [...options.initialBookings];
  }

  return { sandbox, document: doc, window: win, toastCalls, alertCalls, rawHtml: html };
}

/**
 * Instantiate Roster Page Runtime Context
 */
function createRosterContext(options = {}) {
  const html = readProjectFile('roster.html');
  const scripts = extractScriptsFromHtml(html);
  const mainScript = scripts[0];
  const doc = new MockDocument();

  const win = {
    PPCH_CONFIG: {
      gasEndpoint: 'https://script.google.com/macros/s/TEST/exec',
      spreadsheetId: '1E2yctLgOo3nKxcWCNyPfEVmDLKnZovPPSTVLvlq72NM',
      ...(options.config || {})
    },
    document: doc,
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: () => {}
  };

  const sandbox = {
    window: win,
    document: doc,
    console: console,
    localStorage: {
      _data: {},
      getItem: (k) => sandbox.localStorage._data[k] || null,
      setItem: (k, v) => { sandbox.localStorage._data[k] = String(v); }
    },
    fetch: options.fetchMock || (() => Promise.resolve({
      json: () => Promise.resolve({ items: options.initialRecords || [] })
    })),
    alert: () => {},
    Date: Date,
    Math: Math,
    parseInt: parseInt,
    Number: Number,
    String: String,
    Array: Array,
    Object: Object
  };

  vm.createContext(sandbox);

  const exportCode = `
    Object.defineProperty(this, 'allRecords', { get: () => allRecords, set: (v) => { allRecords = v; } });
    Object.defineProperty(this, 'activeSizeFilter', { get: () => activeSizeFilter, set: (v) => { activeSizeFilter = v; } });
    this.fetchRosterData = fetchRosterData;
    this.formatDateTime = formatDateTime;
    this.updateKPIs = updateKPIs;
    this.onSearchFilter = onSearchFilter;
    this.clearSearch = clearSearch;
    this.setSizeFilter = setSizeFilter;
    this.applyFilters = applyFilters;
    this.formatRosterSize = formatRosterSize;
    this.renderData = renderData;
  `;

  vm.runInContext(mainScript + ';' + exportCode, sandbox);

  if (options.initialRecords) {
    sandbox.allRecords = [...options.initialRecords];
  }

  return { sandbox, document: doc, window: win, rawHtml: html };
}

module.exports = {
  createDesktopContext,
  createMobileContext,
  createRosterContext
};
