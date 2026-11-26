# Quality gates — trạng thái v0.2.0

Đã triển khai scanner tĩnh, kiểm tra cú pháp JS/Apps Script bằng AST, đối chiếu include/RPC/inline handler, cấu hình mức lỗi và báo cáo JSON/HTML có phạm vi kiểm tra. CI của công cụ chạy kiểm tra cú pháp, unit/integration tests và tự quét mã công cụ trên Node 18/20/22.

Chưa triển khai tự chạy test/build của repo đích, coverage runtime, theo dõi tài nguyên, đánh giá coupling theo miền nghiệp vụ hoặc Observer chạy nền. Không gọi kết quả static scan là đã kiểm thử ứng dụng.

Chi tiết cấu hình và mã thoát: xem README.md. File tham khảo cấu hình: .hakquality.example.json. Schema báo cáo tăng lên 2, giữ các trường cũ và bổ sung gate/coverage/appsScript/limitations.
