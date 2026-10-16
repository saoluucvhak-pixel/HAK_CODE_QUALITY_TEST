# HAK Code Quality — quality gates (dự thảo)

## Code Quality
- Chạy đúng test/lint/build script hiện có của từng repository.
- Không chấp nhận regression trong các bài test quan trọng.
- Báo cáo số test pass/fail/skip và commit SHA được kiểm tra.

## Architecture Analyzer
- Liệt kê entry points, module boundaries, import graph và vòng phụ thuộc.
- Kiểm tra coupling giữa UI, nghiệp vụ và persistence.

## Observer
- Ghi nhận lỗi có thể tái hiện, thời gian thao tác và tài nguyên sử dụng bằng dữ liệu tổng hợp.
- Không thu thập mật khẩu, thông tin nhân sự hoặc dữ liệu lương nhạy cảm.

## Dashboard
- Tổng hợp build, test, lint, độ bao phủ nếu đo được, và lỗi theo P0/P1/P2.
- Mỗi chỉ số phải có nguồn đo và thời điểm đo; không tự tạo số liệu.

## Trạng thái
Chưa triển khai engine analyzer, observer hoặc dashboard. Đây là đặc tả kiểm thử để phát triển tiếp.
