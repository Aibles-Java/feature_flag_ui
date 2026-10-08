# Backlog (P3) — Điều hướng flag-centric cho Feature Flag UI

> **Trạng thái tài liệu: FINAL for planning; D-01…D-20 đã quyết (xem `decision-log.md`); test-strategy gaps open.** Sau khi người dùng chốt D-01…D-20 (2026-10-04, thay mặt chủ sở hữu), DoR đã được áp dụng lại nghiêm ngặt: **16 ready / 23 blocked (đều do thiếu tooling kiểm thử) / 4 deferred**. Bốn quyết định ⚠ (D-03, D-07, D-11, D-17) **cần chủ sở hữu xác nhận trước G2**. Các khoảng trống tooling (RTL, E2E, axe, Lighthouse, Testcontainers-PostgreSQL) vẫn mở; chu trình S-1.1 ↔ S-1.7 vẫn mở.
> Người soạn: requirements-analyst (Maker). Ngày: 2026-10-04. Đầu vào: `../solution-design.md` rev 3 (G1 đã được người dùng ký) và `../design-walkthrough-notes.md`.
> Tài liệu này **không tự duyệt** Definition of Ready; người duyệt: Product Owner + Tech lead (+ Security cho story đánh dấu SEC).
> Quy ước trích dẫn: `§x` = mục trong `solution-design.md`; `Fn` = phát hiện ở §2.2; `Qn` = câu hỏi mở ở §12; `ADR-n` = §9; `T-...` = test ở §11.1.
> Repo: `BE` = `feature_flag` (Spring Boot); `UI` = `feature_flag_ui` (React 19).

## A. Sprint-ready vs blocked vs deferred (kết quả sau D-01…D-20)

| Nhóm | Số story | Danh sách |
|---|---|---|
| **Sprint-ready** (đạt cả 5 tiêu chí DoR) | **16** | S-0.0, S-0.2, S-0.3, S-0.4, S-0.5, S-0.6, S-1.6, S-2.1, S-2.2, S-2.5, S-2.6, S-2.8, S-2.10, S-2.11, S-2.12, S-2.13 |
| **Blocked** (tất cả do tooling kiểm thử, trực tiếp hoặc bắc cầu) | **23** | S-0.1, S-0.7, S-1.1, S-1.2, S-1.3, S-1.4a, S-1.4b, S-1.5, S-1.7, S-1.8, S-1.9, S-1.10, S-1.11, S-2.3, S-2.4, S-2.7, S-2.9, S-2.14, S-2.15, S-2.16, S-2.17, S-2.18, S-2.19 |
| **Deferred** | **4** | S-3.1, S-3.2, S-3.3, S-3.4 |
| **Tổng giao hàng** | **43** | (cộng 20 story quyết định D-01…D-20, đã quyết, không tính vào số này) |

Mới ready so với vòng trước (10): S-0.3 (D-05), S-0.5 (D-10), S-0.6 (D-15), S-2.2 (D-05), S-2.5 và S-2.6 (D-11), S-2.10 (D-12), S-2.11 (D-09, D-15), S-2.12 (D-09; hết deferred), S-2.13 (D-17, D-15).

Ghi chú sprint-ready:
- S-2.1, S-2.2, S-2.5, S-2.8, S-2.13 mang ghi chú **"cần xác nhận PostgreSQL trước G2"** (migration/giao dịch/truy vấn phải chạy thử trên PostgreSQL thật trước G2). Việc S-2.1 và S-2.8 được coi là test được mà không cần Testcontainers dựa vào đánh giá vòng trước (DDL đơn giản / logic giao dịch); chưa xác minh được trong test-strategy, cần đối chiếu lại.
- Các story ready dựa trên quyết định ⚠ phải giữ ghi chú xác nhận trước G2: S-2.5, S-2.6 (D-11), S-2.13 (D-17). Các story ready dựa trên D-05/D-09/D-10/D-12/D-15 chưa có xác nhận riêng của chủ sở hữu (log ghi nhận).
- S-2.11/S-2.12: mã được, nhưng Ops phải xác nhận giá trị múi giờ (spike D-09) trước deploy.

### Lý do một dòng cho mỗi story không ready

| ID | Trạng thái | Lý do |
|---|---|---|
| S-0.1 | blocked: tooling | Cần RTL + mock mạng để assert body PUT / thứ tự GET→PUT. |
| S-0.7 | blocked: tooling (bắc cầu) | D-14 đã quyết (cột pha 0b) nhưng phụ thuộc S-2.3 cần Testcontainers-PostgreSQL. |
| S-1.1 | blocked: tooling | Cần RTL/router test; chu trình S-1.1 ↔ S-1.7 vẫn mở, cần Tech lead chốt thứ tự. |
| S-1.2 | blocked: tooling | Cần RTL + spy mạng cho T-UI-ENV. |
| S-1.3 | blocked: tooling | Cần RTL kiểm DOM sidebar/URL sau reload. |
| S-1.4a | blocked: tooling | Cần RTL + axe (D-20 = 6 đã chốt). |
| S-1.4b | blocked: tooling | Cần RTL kiểm DOM toggle; phụ thuộc S-1.4a. |
| S-1.5 | blocked: tooling | Cần RTL kiểm phân trang (D-18 đã chốt); F12 trên môi trường chạy còn [CHƯA XÁC MINH]. |
| S-1.7 | blocked: tooling | Cần RTL cho trang chi tiết; phụ thuộc S-1.1. |
| S-1.8 | blocked: tooling | Cần RTL + kiểm XSS render; phụ thuộc S-1.7. |
| S-1.9 | blocked: tooling | Cần RTL; ⚠ D-03 cần Security/Compliance xác nhận trước G2. |
| S-1.10 | blocked: tooling | Cần axe/Lighthouse đo tương phản (AC3). |
| S-1.11 | blocked: tooling | Cần RTL cho test điều hướng; D-19 (`window.__ENV__`) đã chốt; phụ thuộc S-1.1. |
| S-2.3 | blocked: tooling | Cần Testcontainers-PostgreSQL để test migration; gốc chặn bắc cầu S-0.7, S-2.4, S-2.7, S-2.14, S-2.19. |
| S-2.4 | blocked: tooling (bắc cầu) | Phụ thuộc S-2.3; ⚠ D-03 cần xác nhận trước G2. |
| S-2.7 | blocked: tooling (bắc cầu) | Phụ thuộc S-2.3, S-2.4, S-0.7; ⚠ D-07, D-11 cần xác nhận trước G2. |
| S-2.9 | blocked: tooling | D-16 đã chốt (Liquibase idempotent); test backfill cần Testcontainers-PostgreSQL. |
| S-2.14 | blocked: tooling (bắc cầu) | D-13 đã chốt (1 thông báo gộp); phụ thuộc S-0.7 → S-2.3. |
| S-2.15 | blocked: tooling | Cần RTL; phụ thuộc S-1.4a. |
| S-2.16 | blocked: tooling | Cần RTL; phụ thuộc S-1.8. |
| S-2.17 | blocked: tooling (bắc cầu) | Cần RTL; phụ thuộc S-2.7, S-1.7. |
| S-2.18 | blocked: tooling | Cần RTL; phụ thuộc S-1.9; ⚠ D-03. |
| S-2.19 | blocked-by-S-2.7 | Bắc cầu tooling qua S-2.7 → S-2.3. |
| S-3.1 | deferred | D-01 chọn (c) Project là service ở v1; cột `service` chỉ làm khi có nhu cầu thật (pha 3). |
| S-3.2 | deferred | D-04: hoãn so sánh/sao chép cấu hình giữa env. |
| S-3.3 | deferred | D-02: không làm thao tác hàng loạt ở v1 (không bao giờ cho PROD). |
| S-3.4 | deferred | D-08: giữ `DELETE /flags/{id}` làm Archive; story bị loại. |

Quy ước: story phụ thuộc story đang bị tooling-block cũng bị chặn bắc cầu bởi tooling (nêu ở cột Lý do khi có ý nghĩa).

### Quyết định đã chốt (D-xx) và vai trò chủ sở hữu cần xác nhận

Nguồn: `decision-log.md`. Người dùng chốt thay chủ sở hữu; xác nhận riêng của chủ sở hữu **chưa được ghi nhận**. ⚠ = chấp nhận rủi ro/cần xác nhận bằng văn bản trước G2.

| D | Nội dung ngắn (quyết định) | Chủ sở hữu cần xác nhận |
|---|---|---|
| D-01 | (c) Project là service ở v1 | Product Owner |
| D-02 | Không làm thao tác hàng loạt ở v1 | Product Owner + Security |
| D-03 ⚠ | OWNER-only + change window; `prodAcknowledged` chỉ là bằng chứng audit; 4-mắt hoãn (chấp nhận rủi ro SoD) | Security / Compliance |
| D-04 | Hoãn so sánh/sao chép giữa env | Product Owner |
| D-05 | Tên `clearValue`; `version` chuyển tiếp 2 bước | Tech lead BE |
| D-06 | Làm spike F7 ngay (không chặn) | Dev BE + QA |
| D-07 ⚠ | Giữ `AUDIT_READ` mức org; thu hẹp theo project là mục theo dõi riêng | Security |
| D-08 | Giữ `DELETE /flags/{id}` làm Archive | Tech lead BE |
| D-09 | Spike múi giờ JVM rồi cấu hình tường minh | Tech lead BE + Ops |
| D-10 | `value` tối đa 8 KB; chỉ cảnh báo UI, không quét bí mật | Tech lead BE + Security |
| D-11 ⚠ | Không log truy cập đọc ở v1 (giả định: không PII/thẻ) | Compliance |
| D-12 | Rate limit 60 req/phút/người dùng | Security |
| D-13 | Import phát một thông báo gộp | Product Owner + Security |
| D-14 | Cột `subject_flag_id`, `context` (nullable) kéo lên pha 0b | Architect |
| D-15 | `start == end` = không giới hạn (như code hiện tại) | Product Owner + Tech lead BE |
| D-16 | Backfill bằng migration Liquibase idempotent; không endpoint admin | Tech lead BE + Security + Ops |
| D-17 ⚠ | Import all-or-nothing: 409 + rollback toàn bộ; cần Tech lead xác nhận văn bản | Tech lead BE |
| D-18 | Phân trang theo trang (≤ 100/trang) | Product Owner + Tech lead UI |
| D-19 | Công tắc nội bộ = cờ runtime `window.__ENV__` | Tech lead UI |
| D-20 | Tối đa 6 request state đồng thời | Tech lead UI |

## 0. Quy ước chung

**Thang ước lượng tương đối (độ phức tạp, không phải cam kết ngày):** S = 1 điểm (~≤ 0,5 ngày-người), M = 3 điểm (~1–2 ngày), L = 8 điểm (~3–5 ngày). Story lớn hơn L phải tách. "TBD" = chưa ước lượng được vì yêu cầu chưa rõ (làm DoR không đạt).

**Phân loại dữ liệu mặc định:** cấu hình flag (key, `enabled`, `value`, `rolloutPercent`, tên env, audit before/after của state) là **không PII, không dữ liệu thẻ** (mức Internal) — ghi rõ ở từng story; Compliance xác nhận lại ở G1/G2. Ngoại lệ đã biết, không đổi bởi backlog này: `actorEmail` trong audit/webhook là dữ liệu cá nhân có sẵn (§6.4); `value` **cấm bí mật** (chính sách, không thể thực thi bằng kỹ thuật, §6.4/§8.4). Dữ liệu test: **tổng hợp (synthetic)**, tuyệt đối không dùng dữ liệu thật (xem S-0.0).

**Cột SEC:** `Y` = cần security-reviewer (ranh giới tin cậy, phân quyền, kiểm tra đầu vào, audit, rò rỉ dữ liệu). `N` = đã đánh giá, không đổi bề mặt bảo mật.

**Trạng thái:**
- `ready` = đạt DoR (5 mục); có thể còn phụ thuộc thứ tự code vào story khác (ghi ở "Phụ thuộc").
- `blocked-by-<id>` = chờ story khác đang bị chặn (chặn bắc cầu). Sau D-01…D-20, không còn story nào bị chặn bởi quyết định; **không đoán đáp án** nếu xuất hiện câu hỏi mới.
- `blocked: chờ test-strategy/tooling (DoR tiêu chí 5)` = yêu cầu rõ nhưng thiếu công cụ kiểm thử (RTL/E2E/axe/Lighthouse/Testcontainers-PostgreSQL) nên tiêu chí T chưa đạt; **không** sprint-ready.
- `deferred(lý do)` = chỉ làm nếu điều kiện nêu được thoả.

**DoR (5 mục, ký hiệu R C S E T):** R = yêu cầu rõ + kiểm thử được · C = dữ liệu đã phân loại · S = tác động bảo mật đã đánh giá · E = đã ước lượng · T = cách test xác định (deterministic, dữ liệu tổng hợp, không phụ thuộc đồng hồ/thứ tự). Dấu `✓` = đạt, `✗(lý do)` = chưa đạt.

**Pha ↔ epic:** E0 = pha 0 + 0b (§10); E1 = pha 1; E2 = pha 2; E3 = pha 3; E-D = quyết định/spike chéo pha.

## 1. Tóm tắt

| Epic | Phạm vi | Story giao hàng | ready | blocked | deferred |
|---|---|---|---|---|---|
| E-D | Quyết định / spike (D-01…D-20, **đã quyết**) | 20 (không tính vào số giao hàng) | — | — | — |
| E0 | Pha 0/0b: sửa lỗi BE có sẵn + giảm thiểu UI (+ cột audit nullable, D-14) | 8 | 6 | 2 | 0 |
| E1 | Pha 1: UI-only | 12 | 1 | 11 | 0 |
| E2 | Pha 2: BE ma trận/state/audit/@Version + UI nối vào | 19 | 9 | 10 | 0 |
| E3 | Pha 3: tuỳ chọn (service tag, so sánh, hàng loạt, archive) | 4 | 0 | 0 | 4 |
| **Tổng** | 5 epic | **43 giao hàng + 20 quyết định/spike** | **16** | **23** | **4** |

Story quyết định/spike (D-xx) ở trạng thái "đã quyết (xem decision-log.md)"; chúng không được tính là ready/blocked/deferred. Bốn mục ⚠ (D-03, D-07, D-11, D-17) vẫn **cần chủ sở hữu xác nhận trước G2**.

## 2. Khoảng trống phát hiện khi tinh chỉnh (cần Architect xử lý, không đoán)

- **D-14 (đã quyết):** các cột `subject_flag_id` và `context` (nullable, chỉ thêm) của changeset 020 được kéo lên pha 0b; index và phần còn lại của 020 ở pha 2. S-0.7 hết bị chặn bởi quyết định nhưng vẫn phụ thuộc S-2.3 (thiếu tooling).
- **D-15 (đã quyết):** `start == end` = không giới hạn (mở cả ngày), như `PermissionService.withinChangeWindow` hiện tại; cần ghi tài liệu và thêm test (S-0.6, S-2.11).
- **Khoảng trống tooling kiểm thử (mở):** RTL, E2E, axe, Lighthouse, Testcontainers-PostgreSQL chưa có trong test-strategy; người dùng quyết định không sửa vòng này. Story bị ảnh hưởng ghi `blocked: chờ test-strategy/tooling`.
- Số liệu NFR (§4: ≤ 1 000 flag/project, ≤ 20 env, p95 300 ms…) vẫn là "đề xuất cần PO xác nhận" (G1 checklist mục 3). Các story có test hiệu năng phải dùng số đã được xác nhận; story nêu số tại đây theo §4 và ghi chú "chờ PO xác nhận".

---

## 3. Epic E-D — Quyết định và spike

Mỗi story D-xx (D-01…D-20): **kết quả = một bản ghi quyết định** (ghi trong `decision-log.md`); không có mã. Phân loại dữ liệu: không áp dụng. Trạng thái chung: **đã quyết (xem decision-log.md)**; các mục ⚠ giữ **cần chủ sở hữu xác nhận trước G2**.

| ID | Loại | Quyết định (tóm tắt) | Trạng thái | Chủ sở hữu | Ảnh hưởng story |
|---|---|---|---|---|---|
| D-01 | decision | (c) Project là service ở v1; cột `service` nullable chỉ ở pha 3 khi cần | đã quyết (xem decision-log.md) | Product Owner | S-3.1 → deferred |
| D-02 | decision | Không thao tác hàng loạt ở v1; sau này cũng không áp dụng cho PROD | đã quyết (xem decision-log.md) | PO + Security | S-3.3 → deferred |
| D-03 ⚠ | decision | OWNER-only + change window ở PROD; `prodAcknowledged` chỉ là bằng chứng audit; 4-mắt hoãn. Chấp nhận rủi ro SoD | đã quyết (xem decision-log.md); **cần chủ sở hữu xác nhận trước G2** | Security / Compliance | S-1.9, S-2.4, S-2.18 |
| D-04 | decision | Hoãn so sánh/sao chép cấu hình giữa env | đã quyết (xem decision-log.md) | PO | S-3.2 → deferred |
| D-05 | decision | Chấp nhận `clearValue`; `version` chuyển tiếp 2 bước (thiếu `version` → log cảnh báo, sau đó bắt buộc) | đã quyết (xem decision-log.md) | Tech lead BE | S-0.3, S-2.2, S-2.16 |
| D-06 | spike | Làm spike ngay kiểm `value` mất trên dữ liệu thật; không chặn sửa F7 | đã quyết (xem decision-log.md) | Dev BE + QA | thông tin cho S-0.3 |
| D-07 ⚠ | decision | Giữ `AUDIT_READ` mức org; thu hẹp theo project là mục theo dõi riêng | đã quyết (xem decision-log.md); **cần chủ sở hữu xác nhận trước G2** | Security | S-2.7, S-2.17 |
| D-08 | decision | Giữ `DELETE /flags/{id}` làm Archive | đã quyết (xem decision-log.md) | Tech lead BE | S-3.4 → deferred |
| D-09 | decision + spike | Spike múi giờ JVM, rồi cấu hình tường minh qua property | đã quyết (xem decision-log.md) | Tech lead BE + Ops | S-2.11, S-2.12 (hết deferred), S-2.18 |
| D-10 | decision | `value` tối đa 8 KB; không quét mẫu bí mật; cảnh báo ở UI | đã quyết (xem decision-log.md) | Tech lead BE + Security | S-0.5, S-0.6 |
| D-11 ⚠ | decision | Không log truy cập đọc ở v1 (giả định: không PII/thẻ) | đã quyết (xem decision-log.md); **cần chủ sở hữu xác nhận trước G2** | Compliance | S-2.5, S-2.6, S-2.7 |
| D-12 | decision | Rate limit 60 req/phút/người dùng cho endpoint ma trận | đã quyết (xem decision-log.md) | Security | S-2.10 |
| D-13 | decision | Import phát một thông báo gộp | đã quyết (xem decision-log.md) | PO + Security | S-2.14 |
| D-14 | decision | Kéo cột `subject_flag_id`, `context` (nullable) của 020 lên pha 0b | đã quyết (xem decision-log.md) | Architect | S-0.7, S-2.3 |
| D-15 | decision | `start == end` = không giới hạn (như code hiện tại); ghi tài liệu + test | đã quyết (xem decision-log.md) | PO + Tech lead BE | S-0.6, S-2.11 |
| D-16 | decision | Backfill một lần bằng migration Liquibase idempotent; không endpoint admin | đã quyết (xem decision-log.md) | Tech lead BE + Security + Ops | S-2.9 |
| D-17 ⚠ | decision | Import all-or-nothing: 409 + rollback toàn bộ | đã quyết (xem decision-log.md); **cần chủ sở hữu xác nhận trước G2** (văn bản của Tech lead BE) | Tech lead BE | S-2.13 |
| D-18 | decision | Phân trang theo trang ≤ 100/trang, không "tải thêm" | đã quyết (xem decision-log.md) | PO + Tech lead UI | S-1.5 |
| D-19 | decision | Công tắc nội bộ = cờ runtime `window.__ENV__` | đã quyết (xem decision-log.md) | Tech lead UI | S-1.11 |
| D-20 | decision | Tối đa 6 request state đồng thời | đã quyết (xem decision-log.md) | Tech lead UI | S-1.4a |

---

## 4. Epic E0 — Pha 0 / 0b: sửa lỗi có sẵn (BE) + giảm thiểu UI

Mục tiêu: đóng F17, F7, F19, F23 (phần kiểm tra `value` + audit) độc lập với UI mới (§10). Rollback: revert commit; theo D-14, pha 0b có thêm hai cột nullable (`subject_flag_id`, `context`, chỉ thêm, không cần drop khi rollback code).

### S-0.0 — Bộ dữ liệu test tổng hợp đa org/project cho test BE
- Repo: BE · §: 6.3, 11.1 (T-IDOR-*), skill synthetic-test-data · Phụ thuộc: không · Ước lượng: S (1)
- Phân loại: dữ liệu test **tổng hợp**, không PII/thẻ; tên/email dạng `user-a@example.test`.
- SEC: N · Trạng thái: **ready**
- AC:
  1. Given test suite khởi động, When nạp fixture, Then có ≥ 2 org, mỗi org ≥ 2 project, mỗi project ≥ 2 env (1 PRODUCTION), ≥ 3 flag đủ 4 `valueType`, và các user với vai trò OWNER/ADMIN/VIEWER/không-grant; id cố định (UUID hằng) để kết quả lặp lại.
  2. Given fixture chạy 2 lần liên tiếp, When so sánh DB, Then trạng thái giống hệt (0 khác biệt), không phụ thuộc đồng hồ (Clock cố định).
  3. Given quét repo test, When tìm email/số thẻ thật, Then 0 kết quả.
- DoR: R✓ C✓ S✓ E✓ T✓

### S-0.1 — UI: toggle gửi kèm `value` + `rolloutPercent` vừa tải lại (giảm F7)
- Repo: UI · §: 10 (pha 0), 2.2 F7, 6.2 · Phụ thuộc: không · Ước lượng: S (1)
- Phân loại: cấu hình flag, non-PII/non-card.
- SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL + mock mạng)
- AC:
  1. Given flag STRING có `value="x"`, `rolloutPercent=40`, When người dùng toggle `enabled` trên FlagsPage, Then request PUT chứa `enabled` mới **và** `value="x"`, `rolloutPercent=40` (test mock: assert body đủ 3 trường).
  2. Given state vừa bị người khác đổi `value`, When người dùng toggle, Then UI tải lại state ngay trước khi gửi và gửi giá trị mới tải về (test mock xác nhận GET xảy ra trước PUT).
  3. Given server trả lỗi 400/403/404/5xx, When toggle, Then ô quay về giá trị cũ và hiện thông báo lỗi.
  4. Hạn chế đã biết hiển thị trong ghi chú code/PR: chưa có khoá lạc quan (F18) nên vẫn có thể ghi đè (§10).
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL trong test-strategy)

### S-0.2 — BE: khẳng định env ∈ project của flag + thứ tự kiểm tra (F17)
- Repo: BE · §: 2.2 F17, 6.3 mục 1, 8.1, 11.1 · Phụ thuộc: S-0.0 · Ước lượng: M (3)
- Phân loại: cấu hình, non-PII/non-card; **ranh giới cô lập dữ liệu** (IDOR).
- SEC: **Y** · Trạng thái: **ready**
- AC (Given/When/Then, dữ liệu fixture S-0.0):
  1. (T-IDOR-1) Given người có quyền ghi trên project A, When `PUT /flags/{flagA}/environments/{envOfB}` với envB là PRODUCTION và lặp lại với envB không phải PROD, Then cả hai đều **404** cùng mã/thông điệp, 0 dòng DB đổi, 0 bản audit mới.
  2. (T-IDOR-2) Given cùng người, When `GET /flags/{flagA}/environments/{envOfB}`, Then 404.
  3. (T-ORD-1) Given người **không** có quyền trên project A, When PUT/GET với envX ∈ A và envX ∈ project khác, Then cả hai đều **403** (không phân biệt được).
  4. Thứ tự thực thi (kiểm bằng test/xác minh code): tải flag → `check` phạm vi project (403) → khẳng định env ∈ project (404) → `check` gắn env (PROD/window, 403) (§6.3 mục 1).
  5. Hồi quy: PUT hợp lệ trên env cùng project vẫn 200 và PROD vẫn bị nâng quyền OWNER + change window như trước.
- DoR: R✓ C✓ S✓(đánh giá: tác động cao, cần reviewer) E✓ T✓

### S-0.3 — BE: `value` vắng/null = giữ nguyên; `clearValue` để xoá (ADR-05, F7)
- Repo: BE · §: 2.2 F7, 6.3 mục 4, ADR-05, 6.5, 11.1 (T-F7-1/2) · Phụ thuộc: S-0.0 · Ước lượng: M (3)
- Phân loại: cấu hình, non-PII/non-card. Thay đổi hành vi API → release notes.
- SEC: N · Trạng thái: **ready** (D-05(1) đã quyết: chấp nhận tên `clearValue`, xem decision-log.md; Tech lead BE chưa xác nhận riêng, ghi nhận)
- AC (theo D-05(1)):
  1. (T-F7-1) Given flag STRING `value="x"`, When PUT `{enabled:true}` (không có `value`), Then DB và audit `after` và payload webhook đều giữ `value="x"`.
  2. (T-F7-2) Given `{clearValue:true}`, Then `value=null`; Given `{clearValue:true, value:"y"}`, Then 400 và không ghi.
  3. `rolloutPercent` null vẫn giữ nguyên như hiện tại.
- DoR: R✓ C✓ S✓ E✓ T✓ (test BE xác định, đồng hồ/dữ liệu cố định). Ghi chú: D-06 (spike) cung cấp thông tin dữ liệu bị ảnh hưởng nhưng không chặn.

### S-0.4 — BE: bộ kiểm tra `value` dùng chung theo `valueType` cho PUT (F19, phần kiểu)
- Repo: BE · §: 2.2 F19, 6.3 mục 4 và 10 (validator dùng chung), 11.1 T-F19-1 · Phụ thuộc: S-0.0 · Ước lượng: M (3)
- Phân loại: cấu hình, non-PII/non-card. `value` đi vào audit/webhook/Slack nên cấm bí mật (chính sách).
- SEC: **Y** · Trạng thái: **ready** (phần giới hạn độ dài tách riêng ở S-0.5)
- AC:
  1. (T-F19-1) Given flag INTEGER, When PUT `value="abc"`; Given flag JSON, `value="{bad"`; Given flag BOOLEAN, `value="yes"`, Then mỗi trường hợp 400 (`InvalidRequestException`), 0 ghi DB, 0 audit.
  2. Given hợp lệ: BOOLEAN `"true"`/`"false"`/null, INTEGER `"42"` (`Long.parseLong`), JSON `{"a":1}`, STRING bất kỳ (đến giới hạn S-0.5), Then 200.
  3. Validator là một thành phần dùng chung (một lớp/hàm) mà S-0.6 gọi lại; test đơn vị cho 4 `valueType` × hợp lệ/sai.
- DoR: R✓ C✓ S✓ E✓ T✓

### S-0.5 — BE: giới hạn độ dài `value` (`@Size`) cho PUT và import
- Repo: BE · §: 2.2 F19, 6.3 mục 4/10, 6.5 (maxLength 8192), 11.1 · Phụ thuộc: S-0.4 · Ước lượng: S (1)
- Phân loại: cấu hình, non-PII/non-card.
- SEC: **Y** · Trạng thái: **ready** (D-10 đã quyết: giới hạn 8 KB, xem decision-log.md; Tech lead BE + Security chưa xác nhận riêng)
- AC (theo D-10): Given `value` dài hơn N = 8192 ký tự (khớp §6.5 `maxLength`; cấu hình trong `application.properties`, không hard-code), When PUT hoặc import, Then PUT → 400; import → mục `SKIPPED` "invalid value"; ranh giới 8192 (chấp nhận) và 8193 (từ chối) đều được test. Không quét mẫu bí mật ở v1 (D-10); cảnh báo "không đặt bí mật trong value" chỉ ở UI (S-1.8).
- DoR: R✓ C✓ S✓ E✓ T✓

### S-0.6 — BE: import áp dụng cùng kiểm tra `value`; `SKIPPED` ở dry-run và chạy thật (F23)
- Repo: BE · §: 2.2 F23, 6.3 mục 10 (gạch 1), 8.1, 11.1 (T-IMP-1, T-IMP-4) · Phụ thuộc: S-0.4 (validator), S-0.0 · Ước lượng: M (3)
- Phân loại: cấu hình, non-PII/non-card.
- SEC: **Y** · Trạng thái: **ready** (D-15 đã quyết: `start==end` = không giới hạn như code hiện tại, xem decision-log.md; khôi phục từ blocked. Kiểm tra độ dài của S-0.5 áp dụng cho import khi S-0.5 merge)
- AC:
  1. (T-IMP-1) Given import `OVERWRITE` chạy thật với mục `value` sai kiểu theo `valueType`, cho cả (a) flag có state, (b) flag có sẵn nhưng thiếu state ở env đích, (c) flag mới, Then mục đó có `outcome=SKIPPED` lý do `invalid value`, DB không đổi cho mục đó, các mục hợp lệ khác vẫn xử lý.
  2. Given cùng dữ liệu ở chế độ dry-run, Then báo cáo `SKIPPED` giống hệt chạy thật (so sánh danh sách mục).
  3. (T-IMP-4, hồi quy; theo D-15) Given ADMIN (không OWNER), hoặc OWNER khi ngoài change window với `start != end` (Clock cố định), When import vào env PROD, Then 403 và không ghi. Given `start == end` (D-15: không giới hạn, như `PermissionService.withinChangeWindow` hiện trả `true`) và OWNER, Then import được phép; ADMIN vẫn 403. Hành vi `start==end` được ghi tài liệu và có test riêng.
  4. Hình dạng `ImportResultResponse` không đổi (§6.5).
- DoR: R✓ C✓ S✓ E✓ T✓

### S-0.7 — BE: import ghi audit theo từng flag (chối bỏ, F23)
- Repo: BE · §: 2.2 F23, 6.3 mục 10 (gạch 3), 6.4, 11.1 (T-IMP-3) · Phụ thuộc: S-0.0, **S-2.3 (phần cột `subject_flag_id`/`context`, kéo lên pha 0b theo D-14)** · Ước lượng: M (3)
- Phân loại: audit chứa before/after cấu hình (non-PII/non-card) + `actorEmail`/actor id có sẵn (dữ liệu cá nhân hiện hữu, không đổi).
- SEC: **Y** · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (bắc cầu: phụ thuộc S-2.3 cần Testcontainers-PostgreSQL). D-14 đã quyết (xem decision-log.md): hai cột nullable được kéo lên pha 0b nên yêu cầu đã rõ; chỉ còn thiếu tooling.
- AC (theo D-14, đã tách rõ):
  0. Tiền đề: migration thêm `audit_log.subject_flag_id UUID NULL` và `context JSONB NULL` (chỉ thêm cột nullable) đã chạy ở pha 0b — thuộc S-2.3 (phần a). Index và phần còn lại của changeset 020 ở pha 2 (S-2.3 phần b), không thuộc S-0.7.
  1. (T-IMP-3) Given import thật làm `UPDATED` flag A và `CREATED` state của flag B, Then mỗi flag có một bản `FLAG_STATE` với `before`/`after` và `subject_flag_id = flag.id`; bản tổng `ENVIRONMENT`/`IMPORT` vẫn tồn tại làm bản cha; flag mới tạo có thêm `FEATURE_FLAG`/`CREATE`; import rollback không để lại audit mồ côi.
  2. Given cùng điều kiện, Then `context.source=IMPORT` và `importAuditId` trỏ về bản tổng.
- DoR: R✓ C✓ S✓ E✓ T✗(bắc cầu thiếu Testcontainers-PostgreSQL qua S-2.3)

---

## 5. Epic E1 — Pha 1: UI-only (không đổi BE)

Rollback (§10): bật/tắt bằng cờ nội bộ của UI hoặc revert; route cũ vẫn hoạt động. Toàn bộ dữ liệu là cấu hình flag, non-PII/non-card (trừ khi ghi chú khác).

### S-1.1 — UI: route mới + redirect route cũ
- Repo: UI · §: 6.1, ADR-01, F1 · Phụ thuộc: **S-1.7 (AC2 render Flag detail; lưu ý S-1.7 cũng cần route của S-1.1 → chu trình, Tech lead cần chốt thứ tự: S-1.1 đăng ký route trước, AC2 chỉ hoàn tất khi S-1.7 merge)** · Ước lượng: M (3) · SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL/router test)
- AC:
  1. Given người dùng mở `/orgs/:o/projects/:p/flags`, Then thấy trang Flags list của project (không cần chọn env).
  2. Given `/orgs/:o/projects/:p/flags/:flagId`, Then route khớp và truyền đúng `flagId` tới trang Flag detail do S-1.7 cung cấp (nội dung trang kiểm ở S-1.7).
  3. Given link cũ `/orgs/:o/projects/:p/envs/:e/flags`, When mở, Then redirect (replace) sang `/flags?env=:e`; test: không tạo thêm mục history.
  4. Mục Environments (`/projects/:p`) vẫn hoạt động nguyên trạng.
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL)

### S-1.2 — UI: bỏ `currentEnv` khỏi zustand; env lấy từ URL `?env=` có kiểm tra (F3, L-ENV)
- Repo: UI · §: 6.1 (Kiểm tra `?env=`), 6.1 State, ADR-01, 11.1 T-UI-ENV · Phụ thuộc: S-1.1 · Ước lượng: M (3) · SEC: **Y** (đầu vào từ URL; ranh giới thật ở server — S-0.2) · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL + spy mạng)
- AC:
  1. (T-UI-ENV) Given `?env=not-a-uuid` hoặc UUID không có trong danh sách env của project, When tải trang, Then tham số bị bỏ, hiện ma trận đầy đủ, và spy mạng xác nhận **0** request chứa giá trị đó.
  2. Given `?env=<uuid hợp lệ>`, When F5/refresh hoặc mở link chia sẻ, Then ngữ cảnh env được giữ (khắc phục F3).
  3. Given `navStore`, Then không còn `currentEnv`; không component nào đọc nó (grep = 0).
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL)

### S-1.3 — UI: AppLayout bỏ env switcher; mục "Flags" dưới project (F2)
- Repo: UI · §: 5.1 (AppLayout), F2 · Phụ thuộc: S-1.1, S-1.2 · Ước lượng: S (1) · SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL)
- AC: Given project được chọn, Then sidebar có mục "Flags" dẫn tới `/flags`; không có phần tử chọn env trong sidebar (DOM: 0). Given URL `…/flags?env=<uuid hợp lệ>`, When tải lại trang, Then URL vẫn giữ `?env=` và sidebar vẫn có mục "Flags".
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL)

### S-1.4a — UI: Flags list dạng ma trận flag × env (chỉ đọc), tải lười
- Repo: UI · §: 6.1 (Flags list), 6.2 (pha 1), F6, F11, §4 (WCAG) · Phụ thuộc: S-1.2, S-1.6 · Ước lượng: L (8) · SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL + axe). D-20 đã quyết (tối đa 6 request đồng thời, xem decision-log.md) nên không còn chặn bởi quyết định
- AC:
  1. Given project 5 flag × 3 env (mock), When mở list, Then mỗi hàng là flag, mỗi cột là env sắp DEV → STAGING → PROD; chip hiện bật/tắt (kèm văn bản/biểu tượng, **không chỉ màu**), giá trị rút gọn, `rollout%` nếu < 100; cột PROD có biểu tượng khoá.
  2. Given ô không có state (404 từ `getFlagState`), Then hiện "chưa cấu hình", không báo lỗi, **không** có nút tạo state (§6.1).
  3. Given project N flag, Then request state chỉ phát cho cột đang hiển thị, đồng thời ≤ 6 request (D-20; hằng cấu hình được, không hard-code), có `staleTime`; test đếm request (mock) khi 20 flag × 3 env ≤ 60 tổng và số request đang bay tại mọi thời điểm không vượt 6.
  4. Chip có tên truy cập (aria) mô tả trạng thái; kiểm bằng test truy cập tự động (axe).
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL/axe)

### S-1.4b — UI: chế độ tập trung `?env=` + toggle nhanh giới hạn
- Repo: UI · §: 6.1 (cuối mục Flags list), 11 (rủi ro bật nhầm PROD) · Phụ thuộc: S-1.4a, S-0.1 · Ước lượng: M (3) · SEC: **Y** (kiểm soát giảm rủi ro thao tác PROD) · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL; bắc cầu S-1.4a)
- AC:
  1. Given `?env=` hợp lệ, Then cột đó mở rộng chế độ chi tiết.
  2. Given flag BOOLEAN ở env không PROD, Then có toggle nhanh; Given flag không BOOLEAN **hoặc** env PRODUCTION, Then **không** có toggle nhanh (test DOM: 0 phần tử toggle).
  3. Toggle gửi trạng thái đầy đủ theo S-0.1.
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL)

### S-1.5 — UI: phân trang `GET /flags` (F12)
- Repo: UI · §: 2.2 F12 (đã xác minh server kẹp ≤ 100; hiện UI chỉ lấy `content`; [CHƯA XÁC MINH trên môi trường chạy]) · Phụ thuộc: không · Ước lượng: M (3) · SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL để kiểm DOM phân trang). D-18 đã quyết (phân trang theo trang ≤ 100/trang, không "tải thêm", xem decision-log.md); sự kiện F12 trên môi trường chạy vẫn [CHƯA XÁC MINH]
- AC (theo D-18): Given project 130 flag (mock phân trang size 100), When mở list, Then có điều khiển trang (trang 1: 100 flag, trang 2: 30 flag), không có nút "tải thêm"; test: tổng `totalElements` hiển thị = 130; không bị cắt ở 20; đổi trang gọi đúng `page`/`size ≤ 100`.
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL)

### S-1.6 — UI: cập nhật kiểu `FlagState` và hàm API (F8)
- Repo: UI · §: 2.2 F8, 5.1 (`api/flags.ts`) · Phụ thuộc: không · Ước lượng: S (1) · SEC: N · Trạng thái: **ready**
- AC: Given `FlagStateResponse` mock có `rolloutPercent`, `lastEvaluatedAt`, Then kiểu TS phản ánh các trường đó (biên dịch `tsc --noEmit` sạch); `version` thêm ở S-2.16. Thêm hàm chưa gọi `getFlagMatrix`/`getFlagStates`/`getFlagHistory` **không** thuộc story này (thuộc E2).
- DoR: R✓ C✓ S✓ E✓ T✓

### S-1.7 — UI: FlagDetailPage (header + lưới thẻ env, chưa có lịch sử)
- Repo: UI · §: 5.1, 6.1 (Flag detail), 10 pha 1 · Phụ thuộc: S-1.1, S-1.6 · Ước lượng: M (3) · SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL)
- AC: Given flagId hợp lệ, Then header hiện key, mô tả, loại, hết hạn, nút archive (hành vi Archive giữ nguyên, F14/D-08 không chặn); lưới thẻ cho mỗi env hiện state; thẻ thiếu state hiện "chưa cấu hình"; Given flagId không tồn tại, Then trang báo không tìm thấy (từ 404); không có tab "Lịch sử" ở pha này (§10).
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL)

### S-1.8 — UI: FlagStateEditor cho env không PROD (enabled/value theo `valueType`/rollout)
- Repo: UI · §: 5.1, 6.2 (pre-ADR-07), 8.4, F7, F8 · Phụ thuộc: S-1.7, S-1.6, S-0.1 · Ước lượng: L (8) · SEC: **Y** (hiển thị `value` người dùng nhập; XSS) · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL)
- AC:
  1. Given thẻ env không PROD, When mở editor, Then UI tải lại state ngay trước khi mở và hiện cảnh báo "có thể ghi đè thay đổi đồng thời" (vì chưa có 409, §6.2).
  2. Given flag INTEGER, nhập "abc", Then UI chặn gửi với thông báo (UX); khi bỏ qua và server trả 400, UI hiện lỗi và không đổi thẻ.
  3. Given lưu, Then PUT luôn chứa đủ `enabled`, `value`, `rolloutPercent` (assert body).
  4. Given `value` chứa `<img src=x onerror=...>`, Then hiển thị dạng văn bản đã escape; grep `dangerouslySetInnerHTML` trong code mới = 0.
  5. Thẻ PRODUCTION chỉ đọc cho tới khi S-1.9 hoàn tất.
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL)

### S-1.9 — UI: ProdGuardDialog + sửa thẻ PROD (tư vấn; server quyết định)
- Repo: UI · §: 5.1, 7, 8.2, F9, F20, M-4EYES · Phụ thuộc: S-1.8 · Ước lượng: M (3) · SEC: **Y** · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL). D-03 đã quyết (xem decision-log.md) nhưng **⚠ cần chủ sở hữu (Security/Compliance) xác nhận trước G2**: giữ OWNER-only + change window, chấp nhận rủi ro SoD (một người vẫn đề xuất và duyệt được thay đổi PROD); 4-mắt tách thành mục theo dõi riêng, không làm ở v1
- AC (theo D-03): hộp xác nhận hiện tên env, diff before/after, yêu cầu gõ key flag, nhắc cần quyền OWNER; UI nêu rõ đây là xác nhận của người dùng, **không phải** kiểm soát 4-mắt; mọi quyết định cuối cùng ở server (403 hiển thị đúng lý do); ở pha 1 chưa có `changeWindowOpenNow` nên không tự tính window theo giờ trình duyệt.
- DoR: R✓ C✓ S✓(⚠ rủi ro SoD đã chấp nhận, chờ xác nhận) E✓ T✗(thiếu RTL)

### S-1.10 — UI: thay màu hex cứng bằng token Tailwind 4 (F15)
- Repo: UI · §: 2.2 F15 · Phụ thuộc: không · Ước lượng: S (1) · SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần axe/Lighthouse để đo tương phản)
- AC:
  1. Given `FlagsPage.tsx` và component mới, Then grep mã màu hex trong phạm vi sửa = 0 (xác định, không cần tooling).
  2. Given token màu dùng cho chip, Then mỗi token có giá trị khai báo cho cả chế độ sáng và tối (kiểm bằng đọc cấu hình theme, không dùng ảnh chụp).
  3. Given chip ở cả hai chế độ, Then tỉ lệ tương phản văn bản/nền ≥ 4,5:1 (WCAG AA văn bản thường), đo bằng axe/Lighthouse.
- DoR: R✓ C✓ S✓ E✓ T✗(AC3 cần axe/Lighthouse chưa có trong test-strategy)

### S-1.11 — UI: công tắc nội bộ bật/tắt giao diện mới (rollback pha 1)
- Repo: UI · §: 10 (rollback pha 1) · Phụ thuộc: S-1.1 · Ước lượng: S (1) · SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL cho test điều hướng; bắc cầu S-1.1). D-19 đã quyết (cờ runtime qua `window.__ENV__`, cơ chế có sẵn ở `src/api/axios.ts:8-11`, xem decision-log.md)
- AC (theo D-19): Given cờ `window.__ENV__` (tên khoá do Tech lead UI đặt, đọc cùng cơ chế với `axios.ts`) tắt, Then route cũ `envs/:e/flags` hiển thị trang cũ và không redirect; Given bật, Then hành vi S-1.1; đổi cờ chỉ cần đổi cấu hình runtime, **không cần build lại**; thiếu/giá trị lạ → mặc định về hành vi cũ (an toàn); cả hai chế độ có test điều hướng.
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL cho test điều hướng)

---

## 6. Epic E2 — Pha 2: backend ma trận / state / audit / `@Version` + UI nối vào

Rollback (§10): endpoint mới additive; cột mới nullable/default; UI giữ đường dự phòng sang API cũ. Mọi endpoint mới: dữ liệu cấu hình flag non-PII/non-card (trừ `actorEmail` trong audit — có sẵn).

### S-2.1 — BE: changeset 019 + `@Version` + `FlagStateResponse.version` + handler 409 (ADR-07, F18)
- Repo: BE · §: 2.2 F18, 6.4, 5.1, ADR-07, 11.1 T-F18-1 · Phụ thuộc: S-0.0 · Ước lượng: M (3) · SEC: **Y** · Trạng thái: **ready** (ghi chú: **cần xác nhận PostgreSQL trước G2**)
- AC:
  1. Given migration `019-add-flag-state-version.xml`, When chạy trên DB có dữ liệu, Then `flag_environment_states.version BIGINT NOT NULL DEFAULT 0`, các dòng cũ = 0; rollback schema không cần drop (§10).
  2. Given `ObjectOptimisticLockingFailureException`, Then `GlobalExceptionHandler` trả **409** (không rơi vào catch-all 500).
  3. Given GET state, Then phản hồi có `version`.
  4. Việc bắt buộc `version` trong PUT **không** thuộc story này (S-2.2).
- DoR: R✓ C✓ S✓ E✓ T✓

### S-2.2 — BE: PUT bắt buộc `version`, lệch → 409 (ADR-07)
- Repo: BE · §: ADR-07, 6.3 mục 4, 6.5, 11.1 T-F18-1 · Phụ thuộc: S-2.1, S-0.3 · Ước lượng: M (3) · SEC: **Y** · Trạng thái: **ready** (D-05(2) đã quyết, xem decision-log.md; Tech lead BE chưa xác nhận riêng. Phụ thuộc S-2.1, S-0.3 đều ready; kế thừa ghi chú **cần xác nhận PostgreSQL trước G2** của S-2.1)
- AC (theo D-05(2), chuyển tiếp 2 bước):
  1. (T-F18-1) Given hai PUT cùng `version`, Then một 200, một 409 và DB giữ bản của request thắng (đồng bộ bằng điểm đồng bộ test, không sleep).
  2. Bước 1 (trong lúc UI mới triển khai): Given PUT thiếu `version`, Then 200 như hiện tại và ghi **log cảnh báo** (không chứa `value`); công tắc "bắt buộc version" cấu hình trong `application.properties`, mặc định **tắt**.
  3. Bước 2 (sau khi UI phát hành): Given công tắc bật, When PUT thiếu `version`, Then 400, 0 ghi DB, 0 audit; cả hai trạng thái công tắc đều có test.
- DoR: R✓ C✓ S✓ E✓ T✓

### S-2.3 — BE: changeset 020 `subject_flag_id` + `context` + index (ADR-06)
- Repo: BE · §: 6.4, 5.1 (AuditLog), ADR-06 · Phụ thuộc: không · Ước lượng: S (1) · SEC: **Y** · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần Testcontainers-PostgreSQL cho test migration)
- AC: Given migration `020-add-audit-subject-flag.xml`, Then `audit_log.subject_flag_id UUID NULL`, `context JSONB NULL`, index `(org_id, subject_flag_id, created_at)` tồn tại; bản ghi cũ không bị sửa (không backfill bắt buộc); entity `AuditLog` ánh xạ hai cột; test migration trên DB trống và DB có dữ liệu.
- Theo D-14 (đã quyết, xem decision-log.md): **phần a** = hai cột nullable `subject_flag_id`, `context` (+ ánh xạ entity) được kéo lên **pha 0b** (chặn S-0.7); **phần b** = index `(org_id, subject_flag_id, created_at)` và phần còn lại của 020 ở pha 2. Cả hai phần cùng cần test migration trên PostgreSQL thật.
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu Testcontainers-PostgreSQL). Story này là gốc chặn bắc cầu S-0.7, S-2.4, S-2.7, S-2.14, S-2.19.

### S-2.4 — BE: ghi `subject_flag_id` cho mọi audit FLAG_STATE/FEATURE_FLAG; ghi `prodAcknowledged`
- Repo: BE · §: 6.3 mục 4 (gạch cuối) và 6, 8.2, ADR-06 · Phụ thuộc: S-2.3 (tooling) · Ước lượng: M (3) · SEC: **Y** · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (bắc cầu: S-2.3 cần Testcontainers-PostgreSQL). D-03 đã quyết (xem decision-log.md) — **⚠ cần chủ sở hữu (Security/Compliance) xác nhận trước G2**: `prodAcknowledged` chỉ là bằng chứng ghi audit, không phải kiểm soát
- Phân loại: audit before/after non-PII/non-card + actor có sẵn.
- AC:
  1. Given PUT state thành công, Then bản `CHANGE_STATE` có `subject_flag_id = flag.id`; tạo/sửa/archive flag cũng có `subject_flag_id`.
  2. Given request có `prodAcknowledged:true`, Then `context.prodAcknowledged=true` + thời điểm; Given không gửi, Then `context` không có khoá đó; tài liệu API nêu rõ đây là **dữ liệu client tự khai**, không phải kiểm soát (§8.2).
  3. Hồi quy: audit cũ vẫn đọc được.
- DoR: R✓ C✓ S✓(⚠ D-03) E✓ T✗(bắc cầu thiếu Testcontainers-PostgreSQL qua S-2.3).

### S-2.5 — BE: `GET /flags/environment-states` (ma trận) (ADR-02)
- Repo: BE · §: 6.3 mục 2, 6.5, ADR-02, 8.1, 4 (NFR), 11.1 (T-IDOR-3, T-IDOR-4, T-PAGE-1) · Phụ thuộc: S-0.2, S-0.0 · Ước lượng: L (8) · SEC: **Y** · Trạng thái: **ready** (D-11 đã quyết: không ghi log truy cập đọc ở v1, xem decision-log.md; **⚠ cần Compliance xác nhận giả định "cấu hình flag không chứa PII/thẻ" trước G2**; ghi chú: **cần xác nhận PostgreSQL trước G2** cho truy vấn ràng buộc `f.project_id`/`e.project_id`)
- AC (theo D-11: không có yêu cầu log đọc; rate limit ở S-2.10):
  1. (T-IDOR-3) Given người không có quyền trên project B / người cùng org khác project không grant, When `?projectId=B`, Then 403.
  2. (T-IDOR-4) Given DB có state bất thường liên kết flag A với env của B (seed tổng hợp), When `?projectId=A`, Then state đó **không** xuất hiện (SQL ràng buộc `f.project_id` và `e.project_id`).
  3. (T-PAGE-1) `size=1000` → kẹp 100; mặc định 50; phân trang theo flag.
  4. NFR (số p95 ≤ 300 ms ở §4 vẫn chờ PO xác nhận, không dùng làm tiêu chí chặn): với 100 flag × 20 env, số truy vấn cố định ≤ 2 câu, kiểm bằng đếm câu SQL, không dựa vào thời gian.
- DoR: R✓ C✓ S✓ E✓ T✓

### S-2.6 — BE: `GET /flags/{flagId}/environments`
- Repo: BE · §: 6.3 mục 3, 6.5, 8.1 · Phụ thuộc: S-0.2 · Ước lượng: M (3) · SEC: **Y** · Trạng thái: **ready** (D-11 đã quyết: không log đọc; ⚠ giả định chờ Compliance xác nhận trước G2; phụ thuộc S-0.2 ready)
- AC: Given flagId, Then trả mọi state của flag, project lấy từ flag (không nhận từ client), lọc thêm `env.project_id = flag.project_id`; Given thiếu `FLAG_READ` → 403; flag không tồn tại → 404.
- DoR: R✓ C✓ S✓ E✓ T✓

### S-2.7 — BE: `GET /flags/{flagId}/audit-log` (lịch sử theo flag)
- Repo: BE · §: 6.3 mục 5, 6.5, 8.3, 11.1 (T-IDOR-5, T-IDOR-6, T-AUD-CAP) · Phụ thuộc: S-2.3, S-2.4, S-0.7 (để thấy thay đổi từ import) · Ước lượng: L (8) · SEC: **Y** · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (bắc cầu: S-2.3 → S-2.4, S-0.7 cần Testcontainers-PostgreSQL). Quyết định đã chốt (xem decision-log.md): D-07 ⚠ giữ `AUDIT_READ` mức org (**cần Security xác nhận trước G2**; thu hẹp theo project là mục theo dõi riêng), D-11 ⚠ không log đọc (cần Compliance xác nhận), D-14, D-03 ⚠
- AC (theo D-07: không mở rộng/thu hẹp quyền, dùng `AUDIT_READ` ở org của flag):
  1. (T-IDOR-5) Given thành viên chỉ của org X, When flag thuộc org Y, Then 403/404 và không lộ bản ghi org Y; `orgId` lấy từ flag, không từ path/query.
  2. (T-IDOR-6) Lịch sử flag A không chứa audit của flag khác cùng org.
  3. (T-AUD-CAP) Flag có > 20 state → **400** + log cảnh báo, không trả danh sách bị cắt.
  4. Truy vấn luôn có `org_id`; không endpoint nào nhận danh sách id từ client.
- DoR: R✓ C✓ S✓(⚠ D-07, D-11) E✓ T✗(bắc cầu thiếu Testcontainers-PostgreSQL)

### S-2.8 — BE: tạo state mặc định khi tạo env (ADR-03, F11)
- Repo: BE · §: 2.2 F11, ADR-03, 6.3 mục 7, 11.1 T-F11-1 · Phụ thuộc: S-0.0 · Ước lượng: M (3) · SEC: **Y** (tạo state `enabled=false` cho PROD; loại lazy-create) · Trạng thái: **ready** (ghi chú: **cần xác nhận PostgreSQL trước G2**)
- AC: (T-F11-1) Given project có N flag, When tạo env mới, Then đúng N state mới `enabled=false`, `rolloutPercent=100` mặc định, `version=0`; Given tạo env trên project 1 000 flag (seed tổng hợp), Then hoàn tất trong một giao dịch, ≤ 1 000 dòng; không có đường lazy-create trong PUT (test: PUT cho cặp thiếu state → 404).
- DoR: R✓ C✓ S✓ E✓ T✓

### S-2.9 — BE: job backfill một lần cho env đã có
- Repo: BE · §: ADR-03, 6.3 mục 7 · Phụ thuộc: S-2.8 · Ước lượng: M (3) · SEC: **Y** · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (backfill dữ liệu qua Liquibase cần Testcontainers-PostgreSQL để chạy trên DB có dữ liệu). D-16 đã quyết (migration Liquibase idempotent một lần, không endpoint admin, xem decision-log.md)
- AC (theo D-16): kích hoạt **chỉ** bằng changeset Liquibase (không CLI, không endpoint admin, không job lịch). Given DB tổng hợp có env thiếu state, When chạy migration, Then tạo đúng các state thiếu (`enabled=false`, `rolloutPercent=100`, `version=0`); chạy lại (hoặc changeset chạy lần 2 qua precondition/`NOT EXISTS`) → 0 thay đổi (idempotent); không đổi state đã có; số dòng tạo được ghi log. Không có chế độ dry-run qua API (không có endpoint).
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu Testcontainers-PostgreSQL)

### S-2.10 — BE: rate limit Admin cho endpoint ma trận (F22)
- Repo: BE · §: 2.2 F22, 6.3 mục 8, 4 · Phụ thuộc: S-2.5 · Ước lượng: M (3) · SEC: **Y** · Trạng thái: **ready** (D-12 đã quyết: 60 req/phút/người dùng, xem decision-log.md; Security chưa xác nhận riêng. Phụ thuộc S-2.5 ready)
- AC (theo D-12): Given giới hạn 60 req/phút/người dùng (cấu hình trong `application.properties`), When request thứ 61 trong cùng cửa sổ (Clock giả), Then 429; request thứ 60 vẫn 200; sang cửa sổ mới → 200; user khác không bị ảnh hưởng.
- DoR: R✓ C✓ S✓ E✓ T✓

### S-2.11 — BE: `EnvironmentResponse.changeWindowZone` + `changeWindowOpenNow`
- Repo: BE · §: 2.2 F20, 6.3 mục 9, 8.2 · Phụ thuộc: S-0.0, S-2.12 (múi giờ tường minh) · Ước lượng: S (1) · SEC: **Y** · Trạng thái: **ready** (D-09 và D-15 đã quyết, xem decision-log.md; D-09 cần Tech lead BE + Ops xác nhận giá trị múi giờ trước deploy)
- AC (theo D-09, D-15): Given `Clock` cố định, Then `changeWindowOpenNow` bằng đúng kết quả `withinChangeWindow`; `changeWindowZone` trả múi giờ đã cấu hình tường minh (S-2.12), không phải múi giờ mặc định của JVM; với `start==end` thì `changeWindowOpenNow = true` (D-15); UI chỉ hiển thị.
- DoR: R✓ C✓ S✓ E✓ T✓

### S-2.12 — BE: cấu hình múi giờ change window tường minh
- Repo: BE · §: Q9, 8.2, F20 · Phụ thuộc: S-0.0 (S-2.11 phụ thuộc story này) · Ước lượng: S (1) · SEC: **Y** · Trạng thái: **ready** (điều kiện hết deferred đã thoả: D-09 chọn múi giờ tường minh, xem decision-log.md). Tiền điều kiện triển khai (không phải điều kiện code): Ops hoàn tất spike xác minh múi giờ JVM và xác nhận giá trị cấu hình
- AC (theo D-09):
  1. Given property múi giờ (tên do Tech lead BE đặt, ví dụ trong `application.properties`), When app khởi động, Then bean `Clock` (hiện `Clock.systemDefaultZone()` ở `AppConfig.java:12`) dùng đúng múi giờ đó.
  2. Given giá trị không hợp lệ hoặc thiếu, Then app không khởi động (fail-fast) với thông báo rõ; không âm thầm quay về múi giờ JVM.
  3. Given `Clock` cố định ở múi giờ cấu hình, Then `withinChangeWindow` cho kết quả đúng ở ranh giới giờ bắt đầu/kết thúc (test với Clock giả, không phụ thuộc đồng hồ máy).
- DoR: R✓ C✓ S✓ E✓ T✓

### S-2.13 — BE: import đọc-ghi trong một giao dịch với `@Version`; xung đột → 409 rollback toàn bộ (F23, ADR-07)
- Repo: BE · §: 6.3 mục 10 (gạch 2), ADR-07, 6.5, 11.1 T-IMP-2 · Phụ thuộc: S-2.1, S-0.6 (bị D-15), D-17 · Ước lượng: M (3) · SEC: **Y** · Trạng thái: **ready** (D-17 và D-15 đã quyết, xem decision-log.md; phụ thuộc S-2.1, S-0.6 ready, kế thừa ghi chú **cần xác nhận PostgreSQL trước G2**). **⚠ D-17 cần Tech lead BE xác nhận bằng văn bản trước G2** (all-or-nothing, 409 + rollback toàn bộ)
- AC: (T-IMP-2) Given state ở version v, PUT thành công (v+1) xen giữa lúc import `OVERWRITE` (kiểm bằng điểm đồng bộ test, không dùng sleep), Then import trả 409, **không** ghi mục nào, giá trị của PUT được giữ; Given không xung đột, Then import ghi bình thường và `version` tăng.
- DoR: R✓ C✓ S✓(⚠ D-17) E✓ T✓

### S-2.14 — BE: import phát một thông báo webhook/Slack gộp (D-13)
- Repo: BE · §: F23, 6.3 mục 10 (gạch 4), Q13 · Phụ thuộc: S-0.7 · Ước lượng: M (3) · SEC: **Y** (dữ liệu `value` rời hệ thống) · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (bắc cầu: phụ thuộc S-0.7 → S-2.3 cần Testcontainers-PostgreSQL). D-13 và D-14 đã quyết (xem decision-log.md)
- AC (theo D-13): Given import thật thành công với K flag thay đổi (K bất kỳ, kể cả 2000), Then spy publisher nhận đúng **1** thông báo gộp (số lượng theo outcome CREATED/UPDATED/SKIPPED, tham chiếu `importAuditId`; không kèm `value` từng flag), không phải K sự kiện; Given import dry-run hoặc bị 409 rollback, Then 0 thông báo.
- DoR: R✓ C✓ S✓ E✓ T✗(bắc cầu thiếu Testcontainers-PostgreSQL qua S-0.7)

### S-2.15 — UI: FlagsPage dùng `getFlagMatrix` (1 request), invalidate key; đường dự phòng API cũ
- Repo: UI · §: 6.2 (pha 2), 4 (≤ 3 request), 10 · Phụ thuộc: S-2.5, S-1.4a · Ước lượng: M (3) · SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL; bắc cầu S-1.4a). Chặn bởi D-11 đã gỡ (S-2.5 ready)
- AC: Given 100 flag × 20 env, When mở list, Then tổng request ≤ 3 (envs, flags, matrix); lỗi matrix → quay về luồng pha 1; sau PUT thành công invalidate `flag-matrix`, `flag-states`, `flag-history`.
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL)

### S-2.16 — UI: editor gửi `version`; xử lý 409 (rollback, tải lại, diff)
- Repo: UI · §: 6.2 (sau ADR-07), 7, 6.5 · Phụ thuộc: S-2.2, S-2.6, S-1.8 · Ước lượng: M (3) · SEC: N · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL; bắc cầu S-1.8). D-05 đã quyết, D-11 đã quyết (xem decision-log.md)
- AC (theo D-05(2)): Given server trả 409, Then thẻ quay về giá trị server, hiện diff "người khác vừa sửa"; kiểu TS có `version`; UI luôn gửi `version` (để BE có thể bật bắt buộc ở bước 2 mà không phá UI mới); phát hành UI này là điều kiện để bật công tắc bắt buộc `version` ở S-2.2.
- DoR: R✓ C✓ S✓ E✓ T✗(thiếu RTL)

### S-2.17 — UI: tab "Lịch sử" trong Flag detail
- Repo: UI · §: 6.1, 10 pha 2, 6.3 mục 5 · Phụ thuộc: S-2.7, S-1.7 · Ước lượng: M (3) · SEC: **Y** (hiển thị audit, có `actorEmail`) · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL; bắc cầu S-2.7 → S-2.3 Testcontainers-PostgreSQL). D-07 ⚠ (quyền `AUDIT_READ` mức org, cần Security xác nhận trước G2), D-11 ⚠, D-14 đã quyết
- AC: hiển thị before/after, actor, thời điểm, nguồn (UI/IMPORT); 400 "vượt trần" hiển thị thông báo rõ, không hiển thị danh sách cụt; escape toàn bộ nội dung.
- DoR: R✓ C✓ S✓(⚠ D-07, D-11) E✓ T✗(thiếu RTL + bắc cầu S-2.7)

### S-2.18 — UI: ProdGuardDialog dùng `changeWindowOpenNow`/`changeWindowZone` từ server
- Repo: UI · §: 7, 8.2, 6.3 mục 9 · Phụ thuộc: S-1.9, S-2.11 · Ước lượng: S (1) · SEC: **Y** · Trạng thái: **blocked: chờ test-strategy/tooling (DoR tiêu chí 5)** (cần RTL; bắc cầu S-1.9 → S-1.8 → S-1.7 → S-1.1). D-03 ⚠ (cần Security/Compliance xác nhận trước G2), D-09, D-15 đã quyết; S-2.11 ready
- AC: Given server báo ngoài window, Then nút Lưu bị vô hiệu kèm múi giờ do server trả; UI không tính giờ theo trình duyệt (grep `new Date` trong logic này = 0); server vẫn kiểm tra lại.
- DoR: R✓ C✓ S✓(⚠ D-03) E✓ T✗(thiếu RTL)

### S-2.19 — BE: OpenAPI sinh từ code khớp §6.5
- Repo: BE · §: 6.5, 13 (G1 checklist mục 8) · Phụ thuộc: S-2.5, S-2.6, S-2.7, S-2.2 · Ước lượng: S (1) · SEC: N · Trạng thái: **blocked-by-S-2.7** (bắc cầu tooling: S-2.7 → S-2.3 cần Testcontainers-PostgreSQL; S-2.2, S-2.5, S-2.6 đã ready)
- AC: so sánh schema sinh bởi springdoc với §6.5 — 0 khác biệt về đường dẫn, tham số, mã phản hồi.
- DoR: R✓ C✓ S✓ E✓ T✗(bắc cầu: endpoint S-2.7 chưa có)

---

## 7. Epic E3 — Pha 3: tuỳ chọn

### S-3.1 — Nhóm flag theo "service" (ADR-04)
- Repo: BE + UI · §: ADR-04, F16, 6.4 (tuỳ chọn), Q1 · Phụ thuộc: S-1.4a · Ước lượng: TBD (phụ thuộc lựa chọn (a)/(b)/(c))
- Phân loại: nếu (a) cột `service` chỉ là nhãn cấu hình, non-PII/non-card (Compliance xác nhận); (b) có thể đụng ABAC.
- SEC: N (chọn (c), không đổi schema) · Trạng thái: **deferred(D-01 đã quyết (c) Project là service ở v1, xem decision-log.md; cột `service` nullable chỉ làm ở pha 3 khi có nhu cầu thật; PO cần xác nhận)**
- AC: chưa viết; nhóm theo project đã được phủ bởi Flags list (E1). Chỉ mở lại khi có nhu cầu thật.
- DoR: R✗ C✗ S✗ E✗ T✗ (không nằm trong phạm vi v1)

### S-3.2 — So sánh / sao chép cấu hình giữa env trong Flag detail
- Repo: UI (+BE nếu cần) · §: Q4, 6.1 · Phụ thuộc: S-2.16 · Ước lượng: TBD · SEC: Y (ghi sang PROD) · Trạng thái: **deferred(D-04 đã quyết: hoãn so sánh/sao chép cấu hình giữa env, ngoài phạm vi v1, xem decision-log.md)**
- AC: chưa viết. DoR: R✗ C✓ S✗ E✗ T✗

### S-3.3 — Thao tác hàng loạt (không cho PROD)
- Repo: UI + BE · §: Q2, 10 pha 3 · Phụ thuộc: S-2.2 · Ước lượng: TBD · SEC: Y · Trạng thái: **deferred(D-02 đã quyết: không làm thao tác hàng loạt ở v1; nếu sau này làm thì không bao giờ áp dụng cho PROD, xem decision-log.md)**
- AC: chưa viết. DoR: R✗ C✓ S✗ E✗ T✗

### S-3.4 — Đổi Archive từ `DELETE` sang `POST /archive`
- Repo: BE + UI · §: F14, Q8 · Phụ thuộc: D-08 · Ước lượng: S (1) · SEC: N · Trạng thái: **deferred(D-08 đã quyết: giữ `DELETE /flags/{id}` làm Archive, xem decision-log.md; story bị loại khỏi phạm vi)**
- AC: chưa viết. DoR: R✗ C✓ S✓ E✓ T✗

---

## 8. Đồ thị phụ thuộc (tóm tắt)

- Tất cả D-01…D-20 đã quyết (decision-log.md); các cạnh "D-xx ⇒" cũ không còn chặn. Chỉ còn chặn bởi tooling và thứ tự code.
- E0: S-0.0 → {S-0.2, S-0.3, S-0.4, S-0.6, S-0.7}; S-0.4 → S-0.5, S-0.6; S-2.3 (phần a, 0b) → S-0.7.
- E1: S-1.1 → S-1.2 → S-1.3; S-1.2 + S-1.6 → S-1.4a → S-1.4b (cũng cần S-0.1); S-1.6 + S-1.1 → S-1.7 → S-1.8 → S-1.9; S-1.7 → S-1.1 (AC2, **chu trình S-1.1 ↔ S-1.7 vẫn mở, cần Tech lead chốt thứ tự**); S-1.1 → S-1.11; tooling ⇒ S-0.1, S-1.1–S-1.5, S-1.7–S-1.11, S-2.3.
- E2: S-0.0 → S-2.1 → S-2.2 và S-2.13; S-2.3 → S-2.4 → S-2.7 → S-2.17, S-2.19; S-2.3 → S-0.7 → S-2.14; S-0.2 → S-2.5, S-2.6; S-2.5 → S-2.10, S-2.15, S-2.19; S-2.8 → S-2.9; S-2.1 + S-0.6 → S-2.13; S-2.12 → S-2.11 → S-2.18.
- E3: D-01 ⇒ S-3.1 (deferred); D-02 ⇒ S-3.3 (deferred); D-04 ⇒ S-3.2 (deferred); D-08 ⇒ S-3.4 (deferred).

## 9. Đề xuất thứ tự xử lý (không bắt buộc)

1. Gửi yêu cầu xác nhận bằng văn bản cho các chủ sở hữu của D-03, D-07, D-11, D-17 (⚠) trước G2; Ops chạy spike múi giờ (D-09) và D-06 song song.
2. Sprint-ready (16): S-0.0 → S-0.2, S-0.3, S-0.4 → S-0.5, S-0.6 (E0); S-1.6 (E1); S-2.1 → S-2.2, S-2.13; S-2.5 → S-2.10; S-2.6; S-2.8; S-2.12 → S-2.11 (E2). Nhớ xác nhận PostgreSQL trước G2 cho S-2.1, S-2.2, S-2.5, S-2.8, S-2.13.
3. 23 story còn lại đều chờ bổ sung tooling kiểm thử (RTL/axe/Testcontainers-PostgreSQL), ngoài phạm vi vòng này; 4 story deferred theo quyết định.

## 10. Việc không làm trong backlog này

- Không tự duyệt Gate G0 hoặc DoR; không quyết định thay Q1–Q13 hay ADR-04.
- Không sửa code, không sửa `.chapter-forge`.
- Không bịa story tooling hay cách test; các khoảng trống test-strategy để mở.
- Số liệu NFR ở §4 (p95, 1 000 flag, 20 env) vẫn là "đề xuất" tới khi PO xác nhận; 8 KB / 60 req/phút / 6 request đã được chốt ở D-10/D-12/D-20 (chưa có xác nhận riêng của chủ sở hữu).
- Không đánh dấu ready khi còn thiếu tooling kiểm thử; không tự duyệt các quyết định ⚠.
