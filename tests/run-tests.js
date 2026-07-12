const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const codePath = path.join(__dirname, '..', 'Code.gs');
const source = fs.readFileSync(codePath, 'utf8');
const sandbox = { console, module: { exports: {} }, exports: {} };
vm.runInNewContext(source, sandbox, { filename: codePath });

const {
  buildJournalHeaders_,
  summarizeJournalRowsForMonth_,
  buildOutputUpdates_,
  buildOutputUpdatesForReportRows_,
  reportLayoutKey_,
  normalizeJournalEntry_,
  getDisplayProgramNames_,
} = sandbox.module.exports;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

test('buildJournalHeaders_ creates date, programs, and live role columns', () => {
  const headers = buildJournalHeaders_();

  assert.strictEqual(headers[0], 'Ngày tháng năm');
  assert.ok(headers.includes('Bản tin buổi sáng'));
  assert.ok(headers.includes('Bạn hữu đường xa'));
  assert.ok(headers.includes('THTT - Trưởng ca'));
  assert.ok(headers.includes('THTT - Ca viên'));
  assert.ok(headers.includes('THTT - Tăng cường'));
});

test('getDisplayProgramNames_ returns the requested mobile entry order', () => {
  assert.strictEqual(JSON.stringify(getDisplayProgramNames_()), JSON.stringify([
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
  ]));
});


test('normalizeJournalEntry_ fills missing quantities with zero', () => {
  const normalized = normalizeJournalEntry_({
    date: '2026-07-04',
    programs: { 'Bản tin buổi sáng': '2' },
    live: { 'Ca viên': 1 },
    note: 'ca sáng',
  });

  assert.strictEqual(normalized.date, '2026-07-04');
  assert.strictEqual(normalized.programs['Bản tin buổi sáng'], 2);
  assert.strictEqual(normalized.programs['Bản tin 11g30'], 0);
  assert.strictEqual(normalized.live['Trưởng ca'], 0);
  assert.strictEqual(normalized.live['Ca viên'], 1);
  assert.strictEqual(normalized.note, 'ca sáng');
});

test('summarizeJournalRowsForMonth_ totals only the selected month', () => {
  const headers = buildJournalHeaders_();
  const rowFor = (date, morning, eleven, leader, member) => {
    const row = new Array(headers.length).fill('');
    row[headers.indexOf('Ngày tháng năm')] = date;
    row[headers.indexOf('Bản tin buổi sáng')] = morning;
    row[headers.indexOf('Bản tin 11g30')] = eleven;
    row[headers.indexOf('THTT - Trưởng ca')] = leader;
    row[headers.indexOf('THTT - Ca viên')] = member;
    return row;
  };

  const rows = [
    rowFor(new Date(2026, 6, 1), 1, 2, 1, 0),
    rowFor('2026-07-02', '3', '', 0, 2),
    rowFor(new Date(2026, 5, 30), 10, 10, 10, 10),
  ];

  const summary = summarizeJournalRowsForMonth_(headers, rows, new Date(2026, 6, 15));

  assert.strictEqual(summary.programCounts['Bản tin buổi sáng'], 4);
  assert.strictEqual(summary.programCounts['Bản tin 11g30'], 2);
  assert.strictEqual(summary.liveCounts['Trưởng ca'], 1);
  assert.strictEqual(summary.liveCounts['Ca viên'], 2);
});

test('summarizeJournalRowsForMonth_ tolerates exported merged headers from the current sheet', () => {
  const headers = [
    'Ngày tháng năm ',
    'Số lượng Bản tin buổi sáng ',
    'Bản tin 11g30 ',
    'Bản tin 20h ',
    'Góc nhìn HTV ',
    'Dự báo kinh tế ',
    '60 giây sáng ',
    '60 giây trưa ',
    '60 giây chiều ',
    'Thế giới 24h ',
    'Thế giới 24/7 ',
    'Nhìn ra thế giới ',
    'Thời tiết du ký ',
    'Ăn sạch sống khỏe ',
    'Tổng kết các sự kiện thế giới ',
    'Thể thao 365 ',
    'Vươn khơi ',
    'Sàn diễn đời và nghề ',
    'Luật sư ',
    'Bạn hữu đường xa ',
    'Truyền hình trực tiếp Trưởng ca',
    'Ca viên',
    'Tăng cường',
    'Ghi chú ',
    'Cập nhật lúc ',
  ];
  const rows = [
    ['2026-07-04', 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', '04/07/2026 22:21:37'],
    ['2026-07-01', 1, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '', '04/07/2026 22:23:03'],
  ];

  const summary = summarizeJournalRowsForMonth_(headers, rows, new Date(2026, 6, 1));

  assert.strictEqual(summary.programCounts['Bản tin buổi sáng'], 2);
  assert.strictEqual(summary.programCounts['Bản tin 11g30'], 2);
  assert.strictEqual(summary.programCounts['60 giây sáng'], 2);
  assert.strictEqual(summary.programCounts['60 giây trưa'], 2);
  assert.strictEqual(summary.programCounts['Ăn sạch sống khỏe'], 3);
});

test('buildOutputUpdates_ writes report counts to the template cells', () => {
  const updates = buildOutputUpdates_({
    programCounts: {
      'Bản tin buổi sáng': 4,
      'Bản tin 11g30': 2,
    },
    liveCounts: {
      'Trưởng ca': 1,
      'Ca viên': 2,
      'Tăng cường': 0,
    },
  });

  assert.strictEqual(updates.D10, 4);
  assert.strictEqual(updates.D11, 4);
  assert.strictEqual(updates.D12, 2);
  assert.strictEqual(updates.D13, 2);
  assert.strictEqual(updates.E53, 1);
  assert.strictEqual(updates.E54, 2);
  assert.strictEqual(updates.E55, 0);
});

test('buildOutputUpdatesForReportRows_ uses discovered compact Google Sheet rows', () => {
  const updates = buildOutputUpdatesForReportRows_(
    {
      programCounts: {
        'Bản tin buổi sáng': 2,
        'Bản tin 11g30': 2,
        '60 giây sáng': 2,
        '60 giây trưa': 2,
        'Vươn khơi': 3,
      },
      liveCounts: {
        'Trưởng ca': 0,
        'Ca viên': 0,
        'Tăng cường': 0,
      },
    },
    {
      'Bản tin buổi sáng': [2, 3],
      'Bản tin 11g30': [4, 5],
      '60 giây sáng': [12, 13],
      '60 giây trưa': [14, 15],
      'Thế giới 24/7': [20, 21],
      'Nhìn ra thế giới': [22, 23],
      'Vươn khơi': [32, 33],
    },
    {
      'Trưởng ca': 'E45',
      'Ca viên': 'E46',
      'Tăng cường': 'E47',
    }
  );

  assert.strictEqual(updates.D2, 2);
  assert.strictEqual(updates.D3, 2);
  assert.strictEqual(updates.D12, 2);
  assert.strictEqual(updates.D13, 2);
  assert.strictEqual(updates.D14, 2);
  assert.strictEqual(updates.D15, 2);
  assert.strictEqual(updates.D20, 0);
  assert.strictEqual(updates.D21, 0);
  assert.strictEqual(updates.D22, 0);
  assert.strictEqual(updates.D23, 0);
  assert.strictEqual(updates.D32, 3);
  assert.strictEqual(updates.D33, 3);
  assert.strictEqual(updates.E45, 0);
});

test('reportLayoutKey_ distinguishes full template from compact generated sheet', () => {
  function fakeSheet(values) {
    return {
      getRange(row, column) {
        return {
          getValue() {
            return values[`${row}:${column}`] || '';
          },
        };
      },
    };
  }

  assert.strictEqual(reportLayoutKey_(fakeSheet({
    '1:1': 'ĐÀI PHÁT THANH TRUYỀN HÌNH',
    '10:3': 'Bản tin buổi sáng',
  })), 'full');

  assert.strictEqual(reportLayoutKey_(fakeSheet({
    '1:1': 'STT',
    '2:3': 'Bản tin buổi sáng',
  })), 'compact');
});

test('getCoefficients_ correctly parses coefficients from mocked sheet', () => {
  const { getCoefficients_ } = sandbox.module.exports;
  const lastRow = 60;
  
  const colCValues = new Array(lastRow).fill('');
  colCValues[9] = 'Bản tin buổi sáng'; 
  colCValues[11] = 'Bản tin 11g30';    
  
  const rowValues = [];
  for (let i = 0; i < lastRow; i++) {
    rowValues.push(['', '', '']);
  }
  rowValues[50] = ['', 'Truyền hình trực tiếp', ''];
  rowValues[52] = ['', '', 'Trưởng ca'];
  rowValues[53] = ['', '', 'Ca viên'];
  
  const mockSheet = {
    getLastRow() {
      return lastRow;
    },
    getRange(row, col, numRows, numCols) {
      if (col === 3 && numCols === 1) {
        const slice = colCValues.slice(row - 1, row - 1 + numRows).map(v => [v]);
        return {
          getValues() { return slice; }
        };
      }
      if (col === 1 && numCols === 3) {
        const slice = rowValues.slice(row - 1, row - 1 + numRows);
        return {
          getValues() { return slice; }
        };
      }
      return {
        getValue() {
          if (row === 11 && col === 8) return 0.18; 
          if (row === 13 && col === 8) return 0.15; 
          if (row === 53 && col === 8) return 0.3;  
          if (row === 54 && col === 8) return 0.25; 
          return 0;
        }
      };
    }
  };

  const coeffs = getCoefficients_(mockSheet);
  
  assert.strictEqual(coeffs.programs['Bản tin buổi sáng'], 0.18);
  assert.strictEqual(coeffs.programs['Bản tin 11g30'], 0.15);
  assert.strictEqual(coeffs.live['Trưởng ca'], 0.3);
  assert.strictEqual(coeffs.live['Ca viên'], 0.25);
});

test('getMonthlyStats aggregates monthly work log records and computes sums', () => {
  const mockSheet = {
    getLastRow() { return 5; },
    setFrozenRows() {},
    clear() {},
    getRange(row, col, numRows, numCols) {
      if (row === 1 && numRows === 1) {
        return {
          getValues() { return [['', '', '', '', '', '', '', '']]; },
          getValue() { return ''; },
          setValue() {},
          setValues() {}
        };
      }
      if (row === 2 && numRows === 1) {
        return {
          getValues() {
            return [['Ngày tháng năm', 'Bản tin buổi sáng', 'Bản tin 11g30', 'Truyền hình trực tiếp', '', '', 'Ghi chú', 'Cập nhật lúc']];
          },
          getValue() { return 'Ngày tháng năm'; },
          setValue() {},
          setValues() {}
        };
      }
      if (row === 3 && numRows === 1) {
        return {
          getValues() {
            return [['', '', '', 'Trưởng ca', 'Ca viên', 'Tăng cường', '', '']];
          },
          getValue() { return ''; },
          setValue() {},
          setValues() {}
        };
      }
      if (row === 4 && numRows === 2) {
        return {
          getValues() {
            return [
              ['2026-07-01', 1, 0, 1, 0, 0, 'Ca trực sáng', ''],
              ['2026-07-02', 0, 2, 0, 1, 0, 'Ca trực chiều', '']
            ];
          },
          getValue() { return ''; },
          setValue() {},
          setValues() {}
        };
      }
      return {
        getValue() { return ''; },
        setValue() {},
        setValues() {}
      };
    }
  };

  const mockSpreadsheet = {
    getSheetByName(name) {
      if (name === 't4-2026') return null; // Force using fallback coefficients
      return mockSheet;
    }
  };

  sandbox.SpreadsheetApp = {
    openById() {
      return mockSpreadsheet;
    }
  };

  // Re-run source execution in VM so SpreadsheetApp mock is bound before function call
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const codePath = path.join(__dirname, '..', 'Code.gs');
  const source = fs.readFileSync(codePath, 'utf8');
  const testSandbox = { console, module: { exports: {} }, exports: {}, SpreadsheetApp: sandbox.SpreadsheetApp };
  vm.runInNewContext(source, testSandbox, { filename: codePath });

  const { getMonthlyStats } = testSandbox.module.exports;
  const stats = getMonthlyStats(2026, 7);

  assert.strictEqual(stats.year, 2026);
  assert.strictEqual(stats.month, 7);
  assert.strictEqual(stats.dailyEntries.length, 2); 
  
  assert.strictEqual(stats.dailyEntries[0].date, '2026-07-01');
  assert.strictEqual(stats.dailyEntries[0].totalCong, 0.48); // 0.18 (morning) + 0.3 (Trưởng ca)
  assert.strictEqual(stats.dailyEntries[0].programs[0].name, 'Bản tin buổi sáng');
  assert.strictEqual(stats.dailyEntries[0].live[0].name, 'Trưởng ca');
  assert.strictEqual(stats.dailyEntries[0].note, 'Ca trực sáng');

  assert.strictEqual(stats.dailyEntries[1].date, '2026-07-02');
  assert.strictEqual(stats.dailyEntries[1].totalCong, 0.55); // 0.15*2 (11g30) + 0.25 (Ca viên)
  assert.strictEqual(stats.dailyEntries[1].note, 'Ca trực chiều');

  assert.strictEqual(stats.summary.totalProgramsDone, 3);
  assert.strictEqual(stats.summary.totalProgramCong, 0.48);
  assert.strictEqual(stats.summary.totalLiveCong, 0.55);
  assert.strictEqual(stats.summary.totalCong, 1.03);
});
