var CONFIG = {
  spreadsheetId: '1gaQa6GI4CmyAUILOHwQmMpDm_Dvk2Gb8JKC6lZpCTG4',
  journalSheetName: 'Trang tính1',
  templateSheetName: 't4-2026',
  outputSheetNamePattern: 't{month}-{year}',
  dataStartRow: 4,
};

var PROGRAMS = [
  { name: 'Bản tin buổi sáng', rows: [10, 11] },
  { name: 'Bản tin 11g30', rows: [12, 13] },
  { name: 'Bản tin 20h', rows: [14, 15] },
  { name: 'Góc nhìn HTV', rows: [16, 17] },
  { name: 'Dự báo kinh tế', rows: [18, 19] },
  { name: '60 giây sáng', rows: [20, 21] },
  { name: '60 giây trưa', rows: [22, 23] },
  { name: '60 giây chiều', rows: [24, 25] },
  { name: 'Thế giới 24h', rows: [26, 27] },
  { name: 'Thế giới 24/7', rows: [28, 29] },
  { name: 'Nhìn ra thế giới', rows: [30, 31] },
  { name: 'Thời tiết du ký', rows: [32, 33] },
  { name: 'Ăn sạch sống khỏe', rows: [34, 35] },
  { name: 'Tổng kết các sự kiện thế giới', rows: [36, 37] },
  { name: 'Thể thao 365', rows: [38, 39] },
  { name: 'Vươn khơi', rows: [40, 41] },
  { name: 'Sàn diễn đời và nghề', rows: [42, 43] },
  { name: 'Luật sư', rows: [44, 45] },
  { name: 'Bạn hữu đường xa', rows: [46, 47] },
];

var LIVE_ROLES = [
  { name: 'Trưởng ca', cell: 'E53' },
  { name: 'Ca viên', cell: 'E54' },
  { name: 'Tăng cường', cell: 'E55' },
];

var DISPLAY_PROGRAM_ORDER = [
  'Bản tin buổi sáng',
  'Bản tin 11g30',
  '60 giây sáng',
  '60 giây trưa',
  '60 giây chiều',
  'Thể thao 365',
  'Thế giới 24h',
  'Bản tin 20h',
  'Góc nhìn HTV',
  'Dự báo kinh tế',
  'Nhìn ra thế giới',
  'Thế giới 24/7',
  'Tổng kết các sự kiện thế giới',
  'Sàn diễn đời và nghề',
  'Luật sư',
  'Bạn hữu đường xa',
  'Thời tiết du ký',
  'Vươn khơi',
  'Ăn sạch sống khỏe',
];

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Nhật ký chấm công KPI')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Chấm công KPI')
    .addItem('Mở app nhập nhật ký', 'showWebAppHelp')
    .addItem('Tạo/cập nhật tháng hiện tại', 'createCurrentMonthReport')
    .addItem('Tạo/cập nhật tháng trước', 'createPreviousMonthReport')
    .addToUi();
}

function showWebAppHelp() {
  SpreadsheetApp.getUi().alert('Vào Extensions > Apps Script > Deploy > New deployment > Web app để lấy link nhập nhật ký.');
}

function getInitialData() {
  return {
    today: formatDateKey_(new Date()),
    programs: getDisplayProgramNames_(),
    liveRoles: LIVE_ROLES.map(function(role) { return role.name; }),
  };
}

function getDisplayProgramNames_() {
  var programNames = PROGRAMS.map(function(program) { return program.name; });
  var ordered = DISPLAY_PROGRAM_ORDER.filter(function(name) {
    return programNames.indexOf(name) >= 0;
  });
  programNames.forEach(function(name) {
    if (ordered.indexOf(name) < 0) {
      ordered.push(name);
    }
  });
  return ordered;
}

function getEntryForDate(dateKey) {
  var sheet = ensureJournalSheet_();
  var headers = getJournalHeaders_(sheet);
  var rowNumber = findJournalRowByDate_(sheet, dateKey);

  if (!rowNumber) {
    return normalizeJournalEntry_({ date: dateKey });
  }

  var values = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  return journalRowToEntry_(headers, values);
}

function saveJournalEntry(payload) {
  var entry = normalizeJournalEntry_(payload);
  var sheet = ensureJournalSheet_();
  var headers = getJournalHeaders_(sheet);
  var rowNumber = findJournalRowByDate_(sheet, entry.date);
  var row = journalEntryToRow_(headers, entry);

  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return {
    ok: true,
    message: 'Đã lưu nhật ký ngày ' + entry.date,
    entry: entry,
  };
}

function createCurrentMonthReport() {
  return createReportForMonth_(new Date());
}

function createPreviousMonthReport() {
  var now = new Date();
  return createReportForMonth_(new Date(now.getFullYear(), now.getMonth() - 1, 1));
}

function createReportFromWeb(year, month) {
  var monthDate = new Date(Number(year), Number(month) - 1, 1);
  return {
    ok: true,
    sheetName: createReportForMonth_(monthDate),
  };
}

function createReportForMonth_(monthDate) {
  var spreadsheet = getSpreadsheet_();
  var journalSheet = ensureJournalSheet_();
  var templateSheet = spreadsheet.getSheetByName(CONFIG.templateSheetName);

  if (!templateSheet) {
    throw new Error('Không tìm thấy sheet mẫu "' + CONFIG.templateSheetName + '". Hãy copy/import sheet mẫu tháng 4 vào file Google Sheet.');
  }

  var headers = getJournalHeaders_(journalSheet);
  var rows = getJournalDataRows_(journalSheet, headers.length);
  var summary = summarizeJournalRowsForMonth_(headers, rows, monthDate);
  var outputSheet = getOrCreateOutputSheet_(spreadsheet, templateSheet, monthDate);

  applyReportSummary_(outputSheet, summary);
  updateReportTitle_(outputSheet, monthDate);

  return outputSheet.getName();
}

function ensureJournalSheet_() {
  var spreadsheet = getSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(CONFIG.journalSheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.journalSheetName);
  }

  var expectedHeaders = buildJournalHeaders_();
  var layout = getJournalLayout_(sheet);

  if (!layout.hasUsableHeaders) {
    sheet.clear();
    sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
    sheet.setFrozenRows(1);
  } else {
    ensureTrailingJournalHeaders_(sheet, layout);
  }

  return sheet;
}

function buildJournalHeaders_() {
  var headers = ['Ngày tháng năm'];
  PROGRAMS.forEach(function(program) {
    headers.push(program.name);
  });
  LIVE_ROLES.forEach(function(role) {
    headers.push('THTT - ' + role.name);
  });
  headers.push('Ghi chú');
  headers.push('Cập nhật lúc');
  return headers;
}

function getJournalHeaders_(sheet) {
  return getJournalLayout_(sheet).headers;
}

function getJournalDataRows_(sheet, headerLength) {
  var layout = getJournalLayout_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < layout.dataStartRow) {
    return [];
  }
  return sheet.getRange(layout.dataStartRow, 1, lastRow - layout.dataStartRow + 1, headerLength).getValues();
}

function getJournalLayout_(sheet) {
  var headerLength = buildJournalHeaders_().length;
  var firstRow = sheet.getRange(1, 1, 1, headerLength).getValues()[0];
  if (normalizeText_(firstRow[0]) === normalizeText_('Ngày tháng năm')) {
    firstRow[headerLength - 2] = firstRow[headerLength - 2] || 'Ghi chú';
    firstRow[headerLength - 1] = firstRow[headerLength - 1] || 'Cập nhật lúc';
    return {
      hasUsableHeaders: true,
      headers: firstRow,
      headerRow: 1,
      dataStartRow: 2,
    };
  }

  var secondRow = sheet.getRange(2, 1, 1, headerLength).getValues()[0];
  var thirdRow = sheet.getRange(3, 1, 1, headerLength).getValues()[0];
  if (normalizeText_(secondRow[0]) === normalizeText_('Ngày tháng năm')) {
    return {
      hasUsableHeaders: true,
      headers: secondRow.map(function(header, index) {
        var roleName = findLiveRoleNameByHeader_(thirdRow[index]);
        if (roleName) {
          return 'THTT - ' + roleName;
        }
        if (index === headerLength - 2) {
          return header || 'Ghi chú';
        }
        if (index === headerLength - 1) {
          return header || 'Cập nhật lúc';
        }
        return header;
      }),
      headerRow: 2,
      dataStartRow: CONFIG.dataStartRow,
    };
  }

  return {
    hasUsableHeaders: false,
    headers: buildJournalHeaders_(),
    headerRow: 1,
    dataStartRow: 2,
  };
}

function ensureTrailingJournalHeaders_(sheet, layout) {
  var headerLength = buildJournalHeaders_().length;
  var noteColumn = headerLength - 1;
  var updatedColumn = headerLength;

  if (!sheet.getRange(layout.headerRow, noteColumn).getValue()) {
    sheet.getRange(layout.headerRow, noteColumn).setValue('Ghi chú');
  }
  if (!sheet.getRange(layout.headerRow, updatedColumn).getValue()) {
    sheet.getRange(layout.headerRow, updatedColumn).setValue('Cập nhật lúc');
  }
}

function normalizeJournalEntry_(payload) {
  var dateKey = payload && payload.date ? String(payload.date) : formatDateKey_(new Date());
  var normalized = {
    date: dateKey,
    programs: {},
    live: {},
    note: payload && payload.note ? String(payload.note) : '',
  };

  PROGRAMS.forEach(function(program) {
    normalized.programs[program.name] = parseQuantity_(payload && payload.programs ? payload.programs[program.name] : 0);
  });
  LIVE_ROLES.forEach(function(role) {
    normalized.live[role.name] = parseQuantity_(payload && payload.live ? payload.live[role.name] : 0);
  });

  return normalized;
}

function journalEntryToRow_(headers, entry) {
  return headers.map(function(header) {
    if (normalizeText_(header) === normalizeText_('Ngày tháng năm')) {
      return entry.date;
    }
    if (normalizeText_(header) === normalizeText_('Ghi chú')) {
      return entry.note || '';
    }
    if (normalizeText_(header) === normalizeText_('Cập nhật lúc')) {
      return new Date();
    }

    var programName = findProgramNameByHeader_(header);
    if (programName) {
      return entry.programs[programName] || 0;
    }

    var roleName = findLiveRoleNameByHeader_(header);
    if (roleName) {
      return entry.live[roleName] || 0;
    }

    return '';
  });
}

function journalRowToEntry_(headers, row) {
  var entry = normalizeJournalEntry_({ date: formatDateKey_(row[0]) });
  headers.forEach(function(header, index) {
    var programName = findProgramNameByHeader_(header);
    var roleName = findLiveRoleNameByHeader_(header);

    if (programName) {
      entry.programs[programName] = parseQuantity_(row[index]);
    } else if (roleName) {
      entry.live[roleName] = parseQuantity_(row[index]);
    } else if (normalizeText_(header) === normalizeText_('Ghi chú')) {
      entry.note = row[index] || '';
    }
  });
  return entry;
}

function summarizeJournalRowsForMonth_(headers, rows, monthDate) {
  var summary = {
    programCounts: {},
    liveCounts: {},
  };

  PROGRAMS.forEach(function(program) {
    summary.programCounts[program.name] = 0;
  });
  LIVE_ROLES.forEach(function(role) {
    summary.liveCounts[role.name] = 0;
  });

  rows.forEach(function(row) {
    if (!isSameMonth_(row[0], monthDate)) {
      return;
    }

    headers.forEach(function(header, index) {
      var programName = findProgramNameByHeader_(header);
      var roleName = findLiveRoleNameByHeader_(header);

      if (programName) {
        summary.programCounts[programName] += parseQuantity_(row[index]);
      } else if (roleName) {
        summary.liveCounts[roleName] += parseQuantity_(row[index]);
      }
    });
  });

  return summary;
}

function buildOutputUpdates_(summary) {
  var updates = {};

  PROGRAMS.forEach(function(program) {
    var count = summary.programCounts[program.name] || 0;
    program.rows.forEach(function(rowNumber) {
      updates['D' + rowNumber] = count;
    });
  });

  LIVE_ROLES.forEach(function(role) {
    updates[role.cell] = summary.liveCounts[role.name] || 0;
  });

  return updates;
}

function buildOutputUpdatesForReportRows_(summary, programRows, liveCells) {
  var updates = {};

  PROGRAMS.forEach(function(program) {
    var count = summary.programCounts[program.name] || 0;
    var rows = programRows[program.name] || program.rows;
    rows.forEach(function(rowNumber) {
      updates['D' + rowNumber] = count;
    });
  });

  LIVE_ROLES.forEach(function(role) {
    var cell = liveCells[role.name] || role.cell;
    updates[cell] = summary.liveCounts[role.name] || 0;
  });

  return updates;
}

function applyReportSummary_(sheet, summary) {
  var programRows = findReportProgramRows_(sheet);
  var liveCells = findReportLiveCells_(sheet);
  applyOutputUpdates_(sheet, buildOutputUpdatesForReportRows_(summary, programRows, liveCells));
}

function applyOutputUpdates_(sheet, updates) {
  Object.keys(updates).forEach(function(a1Notation) {
    sheet.getRange(a1Notation).setValue(updates[a1Notation]);
  });
}

function updateReportTitle_(sheet, monthDate) {
  var title = 'THỐNG KÊ CÔNG VIỆC KỸ THUẬT THÁNG ' + (monthDate.getMonth() + 1) + ' - ' + monthDate.getFullYear();
  var maxRows = Math.min(sheet.getLastRow(), 12);

  if (normalizeText_(sheet.getRange(1, 1).getValue()) === normalizeText_('STT')) {
    for (var compactRow = 1; compactRow <= maxRows; compactRow += 1) {
      if (normalizeText_(sheet.getRange(compactRow, 1).getValue()).indexOf(normalizeText_('THỐNG KÊ CÔNG VIỆC KỸ THUẬT THÁNG')) >= 0) {
        sheet.getRange(compactRow, 1).clearContent();
      }
    }
    return;
  }

  for (var row = 1; row <= maxRows; row += 1) {
    var value = sheet.getRange(row, 1).getValue();
    if (normalizeText_(value).indexOf(normalizeText_('THỐNG KÊ CÔNG VIỆC KỸ THUẬT THÁNG')) >= 0) {
      sheet.getRange(row, 1).setValue(title);
      return;
    }
  }
}

function findReportProgramRows_(sheet) {
  var rowsByProgram = {};
  var lastRow = sheet.getLastRow();
  var names = sheet.getRange(1, 3, lastRow, 1).getValues();

  PROGRAMS.forEach(function(program) {
    var exactRow = 0;
    var containsRow = 0;
    var normalizedProgram = normalizeText_(program.name);

    for (var i = 0; i < names.length; i += 1) {
      var normalizedName = normalizeText_(names[i][0]);
      if (!normalizedName) {
        continue;
      }
      if (normalizedName === normalizedProgram) {
        exactRow = i + 1;
        break;
      }
      if (!containsRow && normalizedName.indexOf(normalizedProgram) >= 0) {
        containsRow = i + 1;
      }
    }

    var rowNumber = exactRow || containsRow;
    if (rowNumber) {
      rowsByProgram[program.name] = [rowNumber, rowNumber + 1];
    }
  });

  return rowsByProgram;
}

function findReportLiveCells_(sheet) {
  var cellsByRole = {};
  var lastRow = sheet.getLastRow();
  var values = sheet.getRange(1, 1, lastRow, 3).getValues();
  var inLiveSection = false;

  for (var i = 0; i < values.length; i += 1) {
    var rowNumber = i + 1;
    var taskName = normalizeText_(values[i][1]);
    var description = normalizeText_(values[i][2]);

    if (taskName.indexOf(normalizeText_('Truyền hình trực tiếp')) >= 0) {
      inLiveSection = true;
    } else if (inLiveSection && taskName && taskName.indexOf(normalizeText_('Truyền hình trực tiếp')) < 0) {
      inLiveSection = false;
    }

    if (!inLiveSection) {
      continue;
    }

    LIVE_ROLES.forEach(function(role) {
      if (!cellsByRole[role.name] && description === normalizeText_(role.name)) {
        cellsByRole[role.name] = 'E' + rowNumber;
      }
    });
  }

  return cellsByRole;
}

function getOrCreateOutputSheet_(spreadsheet, templateSheet, monthDate) {
  var sheetName = CONFIG.outputSheetNamePattern
    .replace('{month}', String(monthDate.getMonth() + 1))
    .replace('{year}', String(monthDate.getFullYear()));
  var existing = spreadsheet.getSheetByName(sheetName);

  if (existing) {
    if (reportLayoutKey_(existing) !== reportLayoutKey_(templateSheet)) {
      spreadsheet.deleteSheet(existing);
    } else {
      return existing;
    }
  }

  var recreated = spreadsheet.getSheetByName(sheetName);
  if (recreated) {
    return recreated;
  }

  var newSheet = templateSheet.copyTo(spreadsheet).setName(sheetName);
  spreadsheet.setActiveSheet(newSheet);
  spreadsheet.moveActiveSheet(spreadsheet.getNumSheets());
  return newSheet;
}

function reportLayoutKey_(sheet) {
  var firstCell = normalizeText_(sheet.getRange(1, 1).getValue());
  var tenthProgram = normalizeText_(sheet.getRange(10, 3).getValue());
  var secondProgram = normalizeText_(sheet.getRange(2, 3).getValue());

  if (firstCell === normalizeText_('STT')) {
    return 'compact';
  }
  if (tenthProgram === normalizeText_('Bản tin buổi sáng')) {
    return 'full';
  }
  if (secondProgram === normalizeText_('Bản tin buổi sáng')) {
    return 'compact';
  }
  return 'unknown:' + firstCell + ':' + tenthProgram + ':' + secondProgram;
}

function findJournalRowByDate_(sheet, dateKey) {
  var layout = getJournalLayout_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < layout.dataStartRow) {
    return 0;
  }

  var values = sheet.getRange(layout.dataStartRow, 1, lastRow - layout.dataStartRow + 1, 1).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (formatDateKey_(values[i][0]) === dateKey) {
      return i + layout.dataStartRow;
    }
  }
  return 0;
}

function findProgramNameByHeader_(header) {
  var normalizedHeader = normalizeText_(header);
  for (var i = 0; i < PROGRAMS.length; i += 1) {
    var normalizedProgram = normalizeText_(PROGRAMS[i].name);
    if (normalizedHeader === normalizedProgram || normalizedHeader.indexOf(normalizedProgram) >= 0) {
      return PROGRAMS[i].name;
    }
  }
  return '';
}

function findLiveRoleNameByHeader_(header) {
  var normalizedHeader = normalizeText_(header);
  for (var i = 0; i < LIVE_ROLES.length; i += 1) {
    var normalizedRole = normalizeText_(LIVE_ROLES[i].name);
    if (normalizedHeader === normalizeText_('THTT - ' + LIVE_ROLES[i].name) || normalizedHeader === normalizedRole || normalizedHeader.indexOf(normalizedRole) >= 0) {
      return LIVE_ROLES[i].name;
    }
  }
  return '';
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(CONFIG.spreadsheetId);
}

function isSameMonth_(value, monthDate) {
  var date = parseDate_(value);
  return date && date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth();
}

function parseDate_(value) {
  if (!value) {
    return null;
  }
  if (typeof value.getFullYear === 'function') {
    return value;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    var parts = String(value).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  var parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateKey_(value) {
  var date = parseDate_(value) || new Date();
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1);
  var day = String(date.getDate());
  return year + '-' + pad2_(month) + '-' + pad2_(day);
}

function pad2_(value) {
  return String(value).length === 1 ? '0' + value : String(value);
}

function parseQuantity_(value) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  var parsed = parseFloat(String(value).replace(',', '.').trim());
  return isNaN(parsed) ? 0 : parsed;
}

function normalizeText_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

var FALLBACK_COEFFICIENTS = {
  programs: {
    'Bản tin buổi sáng': 0.18,
    'Bản tin 11g30': 0.15,
    'Bản tin 20h': 0.25,
    'Góc nhìn HTV': 0.07,
    'Dự báo kinh tế': 0.1,
    '60 giây sáng': 0.2,
    '60 giây trưa': 0.2,
    '60 giây chiều': 0.2,
    'Thế giới 24h': 0.12,
    'Thế giới 24/7': 0.04,
    'Nhìn ra thế giới': 0.04,
    'Thời tiết du ký': 0.02,
    'Ăn sạch sống khỏe': 0.03,
    'Tổng kết các sự kiện thế giới': 0.5,
    'Thể thao 365': 0.13,
    'Vươn khơi': 0.09,
    'Sàn diễn đời và nghề': 0.22,
    'Luật sư': 0.15,
    'Bạn hữu đường xa': 0.22
  },
  live: {
    'Trưởng ca': 0.3,
    'Ca viên': 0.25,
    'Tăng cường': 0.25
  }
};

function getCoefficients_(sheet) {
  var programRows = findReportProgramRows_(sheet);
  var liveCells = findReportLiveCells_(sheet);
  
  var coefficients = {
    programs: {},
    live: {}
  };
  
  PROGRAMS.forEach(function(program) {
    var rows = programRows[program.name] || program.rows;
    if (rows && rows.length > 1) {
      var coeffRow = rows[1];
      coefficients.programs[program.name] = parseQuantity_(sheet.getRange(coeffRow, 8).getValue());
    } else {
      coefficients.programs[program.name] = 0;
    }
  });
  
  LIVE_ROLES.forEach(function(role) {
    var cell = liveCells[role.name] || role.cell;
    var rowNumber = Number(cell.replace(/[A-Z]/gi, ''));
    coefficients.live[role.name] = parseQuantity_(sheet.getRange(rowNumber, 8).getValue());
  });
  
  return coefficients;
}

function getMonthlyStats(year, month) {
  var spreadsheet = getSpreadsheet_();
  var journalSheet = ensureJournalSheet_();
  var headers = getJournalHeaders_(journalSheet);
  var rows = getJournalDataRows_(journalSheet, headers.length);
  
  var monthDate = new Date(Number(year), Number(month) - 1, 1);
  
  var coefficients = FALLBACK_COEFFICIENTS;
  try {
    var templateSheet = spreadsheet.getSheetByName(CONFIG.templateSheetName);
    if (templateSheet) {
      var extracted = getCoefficients_(templateSheet);
      if (extracted && Object.keys(extracted.programs).length > 0) {
        coefficients = extracted;
      }
    }
  } catch (e) {
    // If it fails to load template, fall back silently
  }
  
  var dailyEntries = [];
  var totalProgramsDone = 0;
  var totalProgramCong = 0;
  var totalLiveCong = 0;
  
  rows.forEach(function(row) {
    if (!isSameMonth_(row[0], monthDate)) {
      return;
    }
    
    var entry = journalRowToEntry_(headers, row);
    
    var programsLogged = [];
    var liveRolesLogged = [];
    var programCountForDay = 0;
    var liveCountForDay = 0;
    
    var entryProgramCong = 0;
    var entryLiveCong = 0;
    
    Object.keys(entry.programs).forEach(function(name) {
      var qty = entry.programs[name];
      if (qty > 0) {
        programCountForDay += qty;
        var coeff = coefficients.programs[name] || 0;
        entryProgramCong += qty * coeff;
        programsLogged.push({ name: name, qty: qty, coeff: coeff });
      }
    });
    
    Object.keys(entry.live).forEach(function(name) {
      var qty = entry.live[name];
      if (qty > 0) {
        liveCountForDay += qty;
        var coeff = coefficients.live[name] || 0;
        entryLiveCong += qty * coeff;
        liveRolesLogged.push({ name: name, qty: qty, coeff: coeff });
      }
    });
    
    if (programCountForDay > 0 || liveCountForDay > 0 || entry.note) {
      dailyEntries.push({
        date: entry.date,
        programs: programsLogged,
        live: liveRolesLogged,
        note: entry.note || '',
        programCong: entryProgramCong,
        liveCong: entryLiveCong,
        totalCong: entryProgramCong + entryLiveCong
      });
      
      totalProgramsDone += programCountForDay;
      totalProgramCong += entryProgramCong;
      totalLiveCong += entryLiveCong;
    }
  });
  
  dailyEntries.sort(function(a, b) {
    return a.date.localeCompare(b.date);
  });
  
  return {
    year: Number(year),
    month: Number(month),
    dailyEntries: dailyEntries,
    summary: {
      totalProgramsDone: totalProgramsDone,
      totalProgramCong: Number(totalProgramCong.toFixed(4)),
      totalLiveCong: Number(totalLiveCong.toFixed(4)),
      totalCong: Number((totalProgramCong + totalLiveCong).toFixed(4)),
      totalWorkingDays: dailyEntries.length
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildJournalHeaders_: buildJournalHeaders_,
    normalizeJournalEntry_: normalizeJournalEntry_,
    summarizeJournalRowsForMonth_: summarizeJournalRowsForMonth_,
    buildOutputUpdates_: buildOutputUpdates_,
    buildOutputUpdatesForReportRows_: buildOutputUpdatesForReportRows_,
    reportLayoutKey_: reportLayoutKey_,
    normalizeText_: normalizeText_,
    getDisplayProgramNames_: getDisplayProgramNames_,
    getCoefficients_: getCoefficients_,
    getMonthlyStats: getMonthlyStats,
    FALLBACK_COEFFICIENTS: FALLBACK_COEFFICIENTS
  };
}
