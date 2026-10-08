# Release Plan Sketch (P3) — Điều hướng flag-centric

> Bản phác sơ bộ ở P3, KHÔNG phải Change Request (Change Request chỉ lập ở P6). Không có ngày, tên train hay người được gán.
> Nguồn: `../solution-design.md` (§10, §11, ADR-03, ADR-07), `.github/workflows/workflow.yml` của hai repo, `Dockerfile`/`docker-compose*.yml`.

## 1. Cơ chế release thực tế (từ cấu hình repo)

- Hai repo (`feature_flag` = BE Spring Boot + Liquibase; `feature_flag_ui` = UI/nginx) dùng cùng mô hình CI/CD một file `workflow.yml`: `test` -> (`sonar`, `scan` Trivy) -> `publish` (image lên GHCR) -> `deploy`.
- `deploy` chạy trên self-hosted runner, `environment: production`, nhóm concurrency `deploy-*-prod` (tuần tự, không huỷ giữa chừng), thực hiện pull + `compose up`, kiểm tra health, và có bước tự rollback về image trước nếu health fail (bỏ qua ở lần deploy đầu).
- Kích hoạt: push `develop` (CD liên tục), tag `v*`, hoặc `workflow_dispatch` redeploy một phiên bản GHCR đã có (`1.2.3` hoặc `sha-<short>`). Hai repo deploy độc lập, không có điều phối chung.
- BE: Liquibase chạy khi app khởi động (`spring.liquibase.enabled=true`), `ddl-auto=validate`. Migration mới tới `018`; changeset kế tiếp là `019`, `020`.
- Release train / lịch phát hành / cửa sổ thay đổi cho hệ này: **unknown** (không có tài liệu). Việc `deploy` environment `production` có required reviewer hay không (cấu hình GitHub, ngoài repo): **unknown**.
- Lưu ý: push `develop` là deploy tự động lên môi trường được gắn nhãn production; cần xác nhận đây có phải prod thật (xem mục 8).

## 2. Thứ tự pha giữa hai repo

| Thứ tự | Pha | Repo | Điều kiện trước |
|---|---|---|---|
| 1 | 0b — sửa lỗi BE (F17, F7/ADR-05, F19, F23) | BE | Không đổi schema. Làm sớm nhất, độc lập UI |
| 2 | 0 — vá UI toggle (gửi lại `value`/`rolloutPercent` mới tải) | UI | Độc lập; nên sau/cùng 0b để tránh hành vi `value` null lệch nhau |
| 3 | 1 — UI-only: route mới + redirect, ma trận từ API cũ | UI | Không cần BE mới |
| 4 | 2a — BE additive: changeset 019/020, endpoint ma trận, lịch sử theo flag, state mặc định khi tạo env, rate limit, `changeWindow*` | BE | Phải deploy và xác minh TRƯỚC khi UI dùng |
| 5 | 2b — Bật backfill state (một lần) | BE/Ops | Sau 2a, trước khi UI giả định "mọi ô đều có state" |
| 6 | 2c — UI chuyển sang endpoint mới + gửi `version` | UI | Sau 2a/2b; BE vẫn chấp nhận thiếu `version` trong giai đoạn chuyển tiếp |
| 7 | 2d — BE siết `version` bắt buộc (400 nếu thiếu) | BE | Sau khi 2c đã phủ toàn bộ client (xem mục 4) |
| 8 | 3 — tuỳ chọn (tag `service`, hàng loạt) | cả hai | Chờ Q1/Q2/Q4 |

Nguyên tắc: BE trước UI mỗi khi UI phụ thuộc endpoint/trường mới; BE luôn additive và tương thích ngược cho tới khi UI đã chuyển hết.

## 3. Tương thích ngược link cũ `/envs/:e/flags`

- Pha 1 giữ route cũ chạy được và thêm redirect sang route flag-centric với `?env=<UUID>`; không xoá route cũ trong cùng release với route mới.
- Kiểm tra `env` trong URL thuộc project (nếu không: trang 404/chọn lại, không lỗi trắng). Cần test redirect với bookmark cũ, tham số thừa, env đã xoá.
- Chỉ gỡ route cũ ở release riêng, sau khi có số liệu truy cập về 0 (nguồn số liệu: unknown, cần Ops xác nhận có hay không).

## 4. Liquibase migration, backfill và rollback

Thứ tự đề xuất (BE):
1. `019-add-flag-state-version.xml`: `version BIGINT NOT NULL DEFAULT 0`. Đề xuất chuyển tiếp: ở giai đoạn đầu **entity/PUT chấp nhận thiếu `version`** (không 400), sau đó mới "bắt buộc" ở bước 2d. Như vậy cột luôn có giá trị; "nullable -> mandatory" thực chất xảy ra ở tầng API, không ở tầng cột. (Nếu muốn cột nullable thật thì cần sửa thiết kế ADR-07 — quyết định ở mục 8.)
2. `020-add-audit-subject-flag.xml`: `subject_flag_id UUID NULL`, `context JSONB NULL`, index `(org_id, subject_flag_id, created_at)`. Không backfill; bản ghi cũ tra qua `entity_id IN stateIds`. Với bảng `audit_log` lớn, cần đánh giá khoá khi tạo index (kích thước thực: unknown).
3. Backfill state (ADR-03): job một lần tạo `enabled=false` cho mọi cặp (flag, env) còn thiếu. Yêu cầu: idempotent (chèn nếu chưa có, theo unique (flag, env)), chạy theo lô, chỉ tạo `enabled=false`, không bao giờ bật, ghi audit nguồn `BACKFILL`. Dry-run đếm số hàng trước khi chạy thật; chạy trong cửa sổ ít tải. Phải chạy SAU khi code "tạo state khi tạo env" đã lên, nếu không env tạo trong lúc chạy sẽ bị sót.

Rollback sketch:
- Cột/bảng mới là additive nên rollback app (về image trước) vẫn chạy được với schema mới; không drop cột (cột thừa vô hại). Liquibase rollback tag chỉ dùng như phương án cuối, cần được thử ở môi trường không phải prod (đã thử chưa: unknown).
- Backfill: hàng tạo ra đều `enabled=false` nên vô hại; muốn dọn thì xoá theo đánh dấu audit `BACKFILL` và `version=0` chưa từng sửa (cần chốt cách đánh dấu).
- Lưu ý: tự rollback của pipeline chỉ về image trước, KHÔNG đảo migration. Nếu image cũ + schema mới không tương thích thì phải xác minh ở staging.

## 5. Rollback theo pha

| Pha | Rollback |
|---|---|
| 0b | Redeploy image BE trước đó (`workflow_dispatch` với `sha-<short>`); không đổi schema. Lưu ý đây là sửa hành vi API (ADR-05), thông báo trong release notes |
| 0 | Redeploy image UI trước |
| 1 | Tắt feature toggle UI (mục 6) hoặc redeploy image UI trước; route cũ vẫn sống |
| 2a | Redeploy image BE trước; schema giữ nguyên (additive). Endpoint mới biến mất -> UI phải còn đường dự phòng sang API cũ |
| 2b | Dừng job; hàng đã tạo là `enabled=false`, giữ nguyên |
| 2c | Tắt toggle UI / redeploy UI trước; BE vẫn chấp nhận thiếu `version` |
| 2d | Quay lại chế độ chấp nhận thiếu `version` (cấu hình hoặc redeploy BE trước). Đây là bước rủi ro nhất vì client cũ gây 400 |
| 3 | Cột nullable, bỏ qua |

## 6. Feature toggle cho rollout UI

- Phương án: cờ phía UI (ví dụ chọn layout flag-centric vs cũ) đọc lúc chạy, không phải lúc build. Hiện UI đọc cấu hình qua `src/api/axios.ts` (`VITE_API_URL` và nguồn khác); cơ chế cấu hình lúc chạy cho cờ UI: **unknown**, cần dev UI xác nhận. Nếu chỉ có biến lúc build thì rollback = build/redeploy lại, chậm hơn.
- Phương án dogfood: dùng chính hệ feature flag này để bật giao diện mới cho một nhóm nhỏ (cần xác nhận không tạo phụ thuộc vòng khi hệ này lỗi).
- Cờ chỉ điều khiển điều hướng/hiển thị; không dùng để nới kiểm soát PROD (ProdGuardDialog, SoD vẫn luôn bật).

## 7. SoD tại deploy

- Người triển khai (kích hoạt/duyệt job `deploy` hoặc `workflow_dispatch`) phải khác tác giả PR/commit của thay đổi đó; người duyệt CAB (G3) khác cả hai. Gán người cụ thể: để P6.
- Deploy production là hành động của người qua cơ chế được kiểm soát (GitHub environment `production`, runner self-hosted); agent không tự duyệt CAB và không tự deploy prod.
- Cần xác nhận environment `production` có cấu hình required reviewers và cấm tự duyệt hay không (unknown, ngoài repo). Nếu không, đây là khoảng trống SoD cần xử lý trước P6.
- Push `develop` tự deploy làm yếu việc tách người triển khai/người phát triển; cần quyết định xem có áp bước duyệt thủ công cho các release chứa migration/backfill.
- Backfill/Liquibase chạy trên DB prod: cần người chạy và người duyệt khác nhau, có bằng chứng (số hàng dry-run, kết quả).

## 8. Cần người quyết định

1. Release train / lịch / change window cho hai dịch vụ là gì (hiện unknown). Người quyết: Release owner + Ops.
2. `develop` deploy tự động lên "production" có đúng ý không; có cần nhánh/tag riêng và duyệt thủ công cho release có migration. Ops + Security.
3. Chuyển tiếp `version` (Q5): chấp nhận thiếu `version` trong bao lâu, hay deploy BE+UI đồng thời. Tech lead BE.
4. Cột `version`: giữ `NOT NULL DEFAULT 0` hay nullable rồi siết (thay đổi ADR-07). Tech lead BE.
5. Cách chạy backfill: job khởi động app, lệnh quản trị hay script; cách đánh dấu để dọn. Tech lead BE + Ops.
6. Cơ chế cờ UI lúc chạy (mục 6). Dev UI.
7. Đã thử Liquibase rollback / kiểm tra image cũ với schema mới ở staging chưa; có môi trường staging tương đương không. QA + Ops.
8. Hậu quả với client khác ngoài UI (SDK `feature-flag-sdk`, tích hợp ngoài) khi PUT đổi hành vi (ADR-05/07). PO + Tech lead BE.
9. Q3 (4-mắt cho PROD), Q9 (múi giờ change window), Q13 (webhook khi import): ảnh hưởng nội dung release, chưa chốt.
10. Kích thước thực `flag_environment_states`/`audit_log` để ước lượng thời gian backfill và index: unknown, cần Ops/DBA.
