# Decision log D-01…D-20 (P3)

> **Trạng thái:** đã chốt theo lệnh của người dùng ngày 2026-10-04 ("chốt chọn tất cả question theo gợi ý của bạn"), theo phương án khuyến nghị của AI.
> **Lưu ý ghi nhận:** người dùng chốt thay cho các chủ sở hữu. Xác nhận riêng của Security / Compliance / Tech lead / Ops **chưa được ghi nhận**. Các mục đánh dấu ⚠ là chấp nhận rủi ro hoặc cần xác nhận bằng văn bản của chủ sở hữu trước G2.
> Căn cứ: `../solution-design.md` rev 3 (§ trích bên dưới) và code `feature_flag`, `feature_flag_ui`.

| ID | Quyết định | Lý do / căn cứ | Chủ sở hữu cần xác nhận |
|---|---|---|---|
| D-01 | **(c) Project là service** ở v1. Cột `service` nullable để pha 3, chỉ làm khi có nhu cầu thật. | Domain không có khái niệm service (§2.2 F16); (c) không đổi schema. | PO |
| D-02 | **Không làm thao tác hàng loạt ở v1.** Nếu sau này làm, không bao giờ áp dụng cho PROD. | Giảm bề mặt rủi ro PROD (§8.2). | PO + Security |
| D-03 ⚠ | **Giữ OWNER-only + change window ở PROD. `prodAcknowledged` chỉ là bằng chứng ghi audit, không phải kiểm soát.** Duyệt 4 mắt tách thành mục theo dõi riêng, chưa làm ở v1. | Server đã chặn OWNER-only (§8.2). Đây là **chấp nhận rủi ro SoD**: một người vẫn đề xuất và duyệt được thay đổi PROD. | Security / Compliance |
| D-04 | **Hoãn** so sánh/sao chép cấu hình giữa env. | Không thuộc phạm vi v1 (§6.1). | PO |
| D-05 | (1) Chấp nhận tên trường **`clearValue`**. (2) `version` chuyển tiếp 2 bước: BE nhận PUT thiếu `version` (ghi log cảnh báo) trong lúc UI mới triển khai; sau khi UI đã phát hành, bật bắt buộc. | Tránh phát hành đồng thời BE+UI (ADR-05, ADR-07). | Tech lead BE |
| D-06 | **Làm spike ngay**: kiểm `value` mất trên dữ liệu thật qua audit before/after. Không chặn sửa lỗi F7. | F7 xác minh bằng đọc code, chưa biết tác động dữ liệu thật. | Dev BE + QA |
| D-07 ⚠ | **Giữ `AUDIT_READ` ở mức org như hiện tại**; endpoint lịch sử theo flag không mở rộng thêm quyền. Mở mục theo dõi riêng để thu hẹp theo project. | Hành vi hiện có, mọi thành viên org đọc audit org (§8.3). Chấp nhận rủi ro need-to-know sẵn có. | Security |
| D-08 | **Giữ `DELETE /flags/{id}`** làm Archive. | Không chặn gì; tránh đổi API. | Tech lead BE |
| D-09 | Spike xác minh múi giờ JVM; sau đó **cấu hình múi giờ tường minh** qua property thay vì `systemDefaultZone` (giá trị do Ops xác nhận). | `Clock.systemDefaultZone()` ở `AppConfig.java:12`. | Tech lead BE + Ops |
| D-10 | **Giới hạn `value` 8 KB.** Chỉ cảnh báo trên UI "không đặt bí mật trong value"; **không quét mẫu bí mật** ở v1. | Đề xuất của F19; quét mẫu dễ báo nhầm. | Tech lead BE + Security |
| D-11 ⚠ | **Không ghi log truy cập đọc** cho cấu hình flag ở v1. Ghi nhận giả định: cấu hình flag không chứa dữ liệu thẻ/PII. | §8.4. Cần Compliance xác nhận giả định. | Compliance |
| D-12 | **Rate limit 60 req/phút/người dùng** cho endpoint ma trận. | Đề xuất ở F22. | Security |
| D-13 | Import phát **một thông báo gộp**, không phát theo từng flag. | Tránh tới 2000 sự kiện. | PO + Security |
| D-14 | **Kéo các cột `subject_flag_id` và `context` (nullable, chỉ thêm) của changeset 020 lên pha 0b.** Phần còn lại của 020 ở pha 2. | Mở khoá S-0.7; thay đổi schema chỉ thêm cột nullable, rủi ro thấp. | Architect |
| D-15 | **Giữ hành vi hiện tại của code: `start == end` nghĩa là không giới hạn** (mở cả ngày). Ghi tài liệu và thêm test. | `PermissionService.withinChangeWindow` hiện trả `true` khi hai giờ bằng nhau. | PO + Tech lead BE |
| D-16 | Backfill **một lần qua migration Liquibase idempotent**; không mở endpoint admin. | Tránh bề mặt tấn công mới. | Tech lead BE + Security + Ops |
| D-17 ⚠ | **Import all-or-nothing**: xung đột `@Version` → 409 và rollback toàn bộ. Cần tech lead xác nhận bằng văn bản. | ADR-07, T-IMP-2. | Tech lead BE |
| D-18 | **Phân trang theo trang (≤ 100/trang)**, không dùng "tải thêm". | Khớp endpoint ma trận phân trang. | PO + Tech lead UI |
| D-19 | Công tắc nội bộ của UI là **cờ runtime qua `window.__ENV__`**. | Cơ chế đã có ở `src/api/axios.ts:8-11`, đổi được không cần build lại. | Tech lead UI |
| D-20 | **Tối đa 6 request state đồng thời.** | Số đo được, thay cho "e.g. 6". | Tech lead UI |

## Chưa được giải quyết bởi log này
- Khoảng trống test-strategy (RTL, E2E, axe, Testcontainers/PostgreSQL) và hook PII chặn `test-strategy.md`: không thuộc D-xx.
- Chu trình S-1.1 ↔ S-1.7: cần Tech lead xử lý.
- Các quyết định ⚠ (D-03, D-07, D-11, D-17) cần chủ sở hữu xác nhận trước G2.
