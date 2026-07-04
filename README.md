# Web app nhật ký chấm công KPI

Dự án này dùng Google Apps Script để tạo một web app nhập nhật ký làm việc hằng ngày. Google Sheet là database, còn báo cáo tháng được tạo theo đúng format sheet mẫu `t4-2026`.

## File chính

- `Code.gs`: backend Apps Script, lưu nhật ký, đọc nhật ký, cộng dồn và tạo báo cáo tháng.
- `Index.html`: frontend web app nhập nhật ký.
- `appsscript.json`: cấu hình Apps Script.
- `tests/run-tests.js`: kiểm thử logic cộng dồn cục bộ bằng Node.js.

## Google Sheet đang dùng

Script đang trỏ tới spreadsheet:

```text
1gaQa6GI4CmyAUILOHwQmMpDm_Dvk2Gb8JKC6lZpCTG4
```

Trong `Code.gs`, cấu hình nằm ở đầu file:

```javascript
var CONFIG = {
  spreadsheetId: '1gaQa6GI4CmyAUILOHwQmMpDm_Dvk2Gb8JKC6lZpCTG4',
  journalSheetName: 'Trang tính1',
  templateSheetName: 't4-2026',
  outputSheetNamePattern: 't{month}-{year}',
  dataStartRow: 4,
};
```

Nếu bạn đổi tên tab nhật ký, sửa `journalSheetName`. Nếu bạn đổi tên sheet mẫu tháng 4, sửa `templateSheetName`.

## Cài đặt Apps Script

1. Mở Google Sheet nhật ký.
2. Vào `Extensions` -> `Apps Script`.
3. Tạo/cập nhật file `Code.gs`, dán nội dung từ file `Code.gs` trong thư mục này.
4. Tạo file HTML tên `Index`, dán nội dung từ file `Index.html`.
5. Mở phần `Project Settings`, bật `Show "appsscript.json" manifest file in editor`.
6. Cập nhật `appsscript.json` bằng nội dung file `appsscript.json` trong thư mục này.
7. Bấm `Save`.

## Deploy web app

1. Trong Apps Script, chọn `Deploy` -> `New deployment`.
2. Chọn loại deployment là `Web app`.
3. `Execute as`: chọn tài khoản của bạn.
4. `Who has access`: chọn quyền phù hợp, thường là `Anyone with the link` nếu chỉ dùng nội bộ bằng link.
5. Bấm `Deploy`, cấp quyền truy cập Google Sheet khi được hỏi.
6. Mở Web app URL để nhập nhật ký.

## Cách dùng

1. Chọn ngày.
2. Nhập số lượng từng chương trình.
3. Nhập số lượng `Truyền hình trực tiếp` theo `Trưởng ca`, `Ca viên`, `Tăng cường`.
4. Bấm `Lưu nhật ký`.
5. Khi cần tạo báo cáo, chọn tháng/năm rồi bấm `Tạo thống kê`.

Nếu ngày đã có dữ liệu, web app sẽ cập nhật dòng cũ thay vì thêm dòng mới.

## Sheet nhật ký

Script hỗ trợ layout hiện tại của sheet bạn gửi:

- Dòng 2: `Ngày tháng năm` và tên các chương trình.
- Dòng 3: vai trò của phần `Truyền hình trực tiếp`.
- Dữ liệu bắt đầu từ dòng 4.

Nếu sheet trống, script sẽ tự tạo header dạng một dòng:

- `Ngày tháng năm`
- 19 cột chương trình
- `THTT - Trưởng ca`
- `THTT - Ca viên`
- `THTT - Tăng cường`
- `Ghi chú`
- `Cập nhật lúc`

## Sheet mẫu báo cáo

Để tạo báo cáo tháng, trong cùng spreadsheet cần có sheet mẫu tên `t4-2026`. Sheet này nên được copy/import từ file `THỐNG KÊ cong viec thang.xlsx`.

Script sẽ:

- Copy sheet mẫu nếu sheet tháng chưa tồn tại.
- Ghi tổng số lượng chương trình vào cột `D` phần I.
- Ghi THTT vào `E53:E55`.
- Giữ công thức, hệ số, format và các dòng khác theo sheet mẫu.
- Đổi tiêu đề dòng 5 theo tháng/năm.

## Kiểm thử cục bộ

Chạy:

```powershell
node tests/run-tests.js
```

Kết quả mong đợi:

```text
PASS buildJournalHeaders_ creates date, programs, and live role columns
PASS normalizeJournalEntry_ fills missing quantities with zero
PASS summarizeJournalRowsForMonth_ totals only the selected month
PASS buildOutputUpdates_ writes report counts to the template cells
```
