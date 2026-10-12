# Test Strategy & Test Data Plan — flag-centric (P3)

> **DRAFT — pre-G0.** Người soạn: test-engineer (Maker). Căn cứ: `../solution-design.md` rev 3 (§4 NFR, §11.1) và `../design-walkthrough-notes.md`. Chỉ là kế hoạch; chưa viết test/code. Phase = pha rollout §10 (0, 0b, 1, 2). Chưa có mã story/AC (G0) nên chưa truy vết AC được.

## 1. Hiện trạng công cụ (đã kiểm tra)

| Stack | Có | Không có (GAP) |
|---|---|---|
| BE `feature_flag` (Maven) | JUnit5 + Mockito + AssertJ (`spring-boot-starter-test`), `spring-security-test`, H2 (`MODE=PostgreSQL`, `application-test.properties`, Liquibase bật), JaCoCo (gate `jacoco.line.coverage=0.87`), Spotless. Quy ước: `XxxServiceImplTest` (Mockito), `XxxControllerTest`, `repository/*Test`, `*IntegrationTest` (SpringBootTest); `PermissionServiceTest` đã dùng `Clock` | Testcontainers/PostgreSQL thật; ArchUnit; công cụ tải (Gatling/JMeter/k6); DAST/ZAP |
| UI `feature_flag_ui` | `vitest` 4 (jsdom), `@vitest/coverage-v8`, `axios-mock-adapter`, `oxlint`; test hiện có chỉ ở `src/api` + `authStore` (`*.test.ts`) | `@testing-library/react`, MSW, Playwright/Cypress (E2E), axe (a11y), Lighthouse. `vitest.config.ts` chỉ `include: src/**/*.test.ts` (không `.tsx`) và coverage chỉ tính lớp logic; component/page bị loại |

Hệ quả: test component React (ProdGuardDialog, FlagStateEditor, FlagsPage) **chưa thể viết** nếu không bổ sung công cụ — xem §9 (gap). Không bịa công cụ; mọi dòng "tool" bên dưới chỉ dùng thứ đã có, hoặc ghi rõ GAP.

## 2. Các mức kiểm thử

| Mức | Phạm vi | Công cụ có sẵn | Pha chạy |
|---|---|---|---|
| Unit BE | Validator `value` (F19), logic giữ `value` (ADR-05), thứ tự kiểm tra (L-ORDER), `withinChangeWindow` | JUnit5/Mockito/AssertJ, `Clock.fixed` | 0b, 2 |
| Unit UI | Hàm thuần: kiểm tra `?env=` (UUID ∈ danh sách env), map ma trận → chip, build payload PUT (luôn gửi đủ trường, `version`), ánh xạ 409/403/404 | vitest + `axios-mock-adapter` (`*.test.ts`) | 1, 2 |
| SIT BE | Controller + service + repo + Liquibase trên H2: IDOR, 409, import, audit, kẹp trang | `@SpringBootTest`/`@WebMvcTest` + `spring-security-test`, H2 | 0b, 2 |
| SIT UI↔API | Hợp đồng request/response UI↔BE (pha 2) | `axios-mock-adapter` (mức hợp đồng). E2E thật: **GAP** | 1, 2 |
| UAT | Kịch bản nghiệp vụ do con người ký (không phải test-engineer): đổi trạng thái PROD, chọn env, sửa đồng thời, lịch sử | Thủ công trên STG + checklist | Trước G2 |
| Perf | Endpoint ma trận (§5) | **GAP** công cụ tải | 2 |
| Security | IDOR/authz âm (ở SIT), DAST/pentest | JUnit (authz). DAST: **GAP**; phối hợp `security-reviewer` | 0b, 2, trước G2 |

## 3. Ánh xạ test bắt buộc (§11.1)

BE-SIT = `@SpringBootTest` + MockMvc + H2 + JWT giả (`spring-security-test`). Cột Phase = pha sớm nhất test có thể chạy được.

| ID | Mức | Công cụ | Phase | Ghi chú xác định (deterministic) |
|---|---|---|---|---|
| T-IDOR-1 | SIT BE | MockMvc, 2 project + env PROD & non-PROD của B | 0b | Assert cùng status 404 và cùng body (trừ id) cho cả hai loại env; assert 0 dòng audit mới, state không đổi |
| T-IDOR-2 | SIT BE | MockMvc | 0b | `getState` 404 |
| T-IDOR-3 | SIT BE | MockMvc, user khác project/không grant | 2 | 403 cả hai kịch bản |
| T-IDOR-4 | SIT BE (repo + controller) | Seed trực tiếp bằng repository một state "bất thường" flagA↔envB (bỏ qua service) | 2 | Test repo query + endpoint; H2 không có ràng buộc chéo project nên seed được |
| T-IDOR-5 | SIT BE | 2 org X/Y | 2 | Không lộ bản ghi Y; assert body không chứa id Y |
| T-IDOR-6 | SIT BE | Seed audit cho flag A và flag B cùng org | 2 | Chỉ bản của A |
| T-F7-1 | SIT BE | MockMvc + đọc DB; kiểm `after` audit; webhook: `ArgumentCaptor` trên dispatcher/event (theo `WebhookDispatcherTest`) | 0b | Flag STRING `value="x"`; PUT không `value` |
| T-F7-2 | SIT BE | MockMvc | 0b | `clearValue` / kèm `value` → 400 (**phụ thuộc Q5 chốt tên trường**) |
| T-F18-1 | SIT BE concurrency | `ExecutorService` + `CountDownLatch` (§4) | 2 | 1×200, 1×409 |
| T-F19-1 | Unit + SIT BE | Parameterized (JUnit5 `@ParameterizedTest`) | 0b | Giới hạn lấy từ hằng số (Q10, đề xuất 8192): test ở n, n+1 |
| T-IMP-1 | SIT BE | `EnvironmentTransferServiceImpl` + MockMvc; 3 ngữ cảnh: có state, thiếu state, flag mới; dry-run vs thật | 0b | Dry-run và thật phải cùng kết quả |
| T-IMP-2 | SIT BE concurrency | Khoá đồng bộ tất định (§4) | 2 | Cần `@Version` ⇒ pha 2 |
| T-IMP-3 | SIT BE | Import thật rồi gọi `/flags/{id}/audit-log` | 2 | Assert `subject_flag_id` cần changeset 020 ⇒ pha 2. **Lệch lịch trình:** §10 xếp "audit theo flag cho import" ở pha 0b nhưng `subject_flag_id`/endpoint lịch sử ở pha 2 → ở 0b chỉ assert có bản `FLAG_STATE` theo từng flag (`entity_id`, before/after); phần `subject_flag_id`/`context.source` để pha 2. Đề nghị architect xác nhận |
| T-IMP-4 | SIT BE (hồi quy) | `EnvironmentTransferControllerTest` + `PermissionServiceTest` style, `Clock.fixed` | 0b | ADMIN không OWNER; và ngoài window → 403, 0 ghi |
| T-ORD-1 | SIT BE | MockMvc | 0b | Cả hai env cho cùng 403; so sánh bằng nhau |
| T-AUD-CAP | SIT BE | Seed 21 state tổng hợp (bỏ qua giới hạn tạo env) | 2 | 400; `OutputCaptureExtension`/appender kiểm log cảnh báo; phụ thuộc trần 20 (§4, Q?) |
| T-F11-1 | SIT BE | `EnvironmentControllerTest` style | 2 | N state, `enabled=false`; thêm: backfill idempotent chạy 2 lần |
| T-PAGE-1 | SIT BE | MockMvc `size=1000` | 2 (và 1 cho `GET /flags`, F12) | Kẹp 100 |
| T-UI-ENV | Unit UI | vitest, hàm thuần `resolveEnvParam(search, envs)` | 1 | Không phải UUID, UUID lạ, rỗng, trùng lặp `?env=a&env=b`; assert **0 lời gọi** axios (mock adapter `history` rỗng). Test render thật cần RTL → **GAP**; yêu cầu dev tách logic thành hàm thuần (testable) |

Bổ sung (không có trong §11.1, đề xuất thêm; cần architect xác nhận): rate limit ma trận → 429 (mẫu `RateLimitIntegrationTest`); ADR-03 UI chịu ô thiếu state; hồi quy webhook payload; ProdGuardDialog không cho Lưu khi `changeWindowOpenNow=false` (cần RTL — GAP).

## 4. Cách tiếp cận tất định (deterministic)

**Nguyên tắc chung:** không `Thread.sleep`, không `Instant.now()/LocalTime.now()/Date.now()` trực tiếp trong test, không phụ thuộc thứ tự test, không phụ thuộc múi giờ máy chạy CI, UUID seed cố định hoặc truy từ fixture, mỗi test tự dựng và tự dọn dữ liệu.

1. **Đồng hồ cố định (change window, F20):** `Clock.fixed(Instant, ZoneId)` truyền vào `PermissionService` (đã inject `Clock`, `AppConfig.java:12`; `PermissionServiceTest` đã có mẫu). Ma trận bắt buộc: trong window, sát biên (start-1h, start, end-1, end), ngoài window, **window vắt qua nửa đêm** (vd start=22, end=6: tại 23:00, 00:00, 05:59, 06:00, 12:00), start==end (cần architect nêu ngữ nghĩa — chưa rõ, GAP về đặc tả), env không có window. Chạy mỗi ca với ít nhất 2 `ZoneId` khác nhau để chứng minh `changeWindowZone` đi theo clock chứ không theo JVM; đặt `TimeZone.setDefault` trong test chỉ khi có `@AfterEach` khôi phục. `changeWindowOpenNow` (§6.3 mục 9) được kiểm bằng cùng clock cố định và phải bằng kết quả `check` PROD.
2. **Đồng thời (T-F18-1, T-IMP-2):** không dựa vào lịch thread. Cách tất định: (a) *Mức service:* hai transaction tách bằng `CyclicBarrier`/`CountDownLatch` — cả hai đọc `version=v`, rồi mới cùng ghi; assert đúng 1 thành công, 1 `ObjectOptimisticLockingFailureException`→409, `version` cuối = v+1, giá trị thắng khớp request thắng (không assert "request nào thắng", chỉ assert bất biến). (b) *Mức xác định hơn, ưu tiên:* ca "stale version": PUT lần 1 (v→v+1), PUT lần 2 gửi lại `version=v` ⇒ 409 — hoàn toàn tuần tự, không cần thread; coi đây là test chính, ca đa luồng là bổ sung. Với T-IMP-2: chèn PUT vào giữa bằng hook/`@SpyBean` trên repository (chặn tại `findBy…` rồi PUT, rồi cho import ghi) thay vì sleep. Chạy lặp (`@RepeatedTest(20)`) để lộ flaky; cấm retry tự động để che lỗi. **Giới hạn:** H2 (MVCC, `MODE=PostgreSQL`) không tái hiện hoàn toàn khoá của PostgreSQL → xác nhận lại trên PostgreSQL thật (GAP Testcontainers) trước G2.
3. **Không flaky khác:** thứ tự kết quả luôn có `ORDER BY` tường minh khi assert (ma trận, lịch sử); so sánh timestamp bằng clock cố định; webhook/Slack dùng mock, không gọi mạng (xem `application-test.properties` đã tắt webhook).

### 4.1 "Test approach tất định" theo loại story (dùng cho DoR check)

DoR đạt khi story nêu rõ: (1) loại story, (2) mỗi AC có ID test dự kiến, (3) nguồn thời gian/ngẫu nhiên/đồng thời được kiểm soát như dưới đây, (4) dữ liệu fixture nào dùng (§7).

| Loại story | "Tất định" nghĩa là |
|---|---|
| Sửa lỗi BE có sẵn (F17, F7, F19, F23) | Test **đỏ trước** trên mã hiện tại (tái hiện lỗi) rồi xanh sau sửa; assert trên trạng thái DB + audit + payload sự kiện, không chỉ HTTP status; không sửa assertion để qua |
| Endpoint đọc mới (ma trận, states, audit theo flag) | Fixture đa org/project cố định; assert `ORDER BY` rõ; test âm (403/404) kèm test dương; đếm số truy vấn SQL (§5) thay vì đo thời gian |
| Ghi có điều kiện thời gian (PROD, change window) | `Clock.fixed` + ma trận §4 mục 1 gồm vắt qua nửa đêm; không dùng giờ thật |
| Đồng thời / khoá lạc quan | Ca tuần tự "stale version" là test chính; ca đa luồng dùng barrier, không sleep; lặp N lần ở CI |
| Migration/Liquibase (019, 020) | Chạy changelog trên DB trống **và** trên dữ liệu trước-migration (có state + audit cũ); assert `version=0`, `subject_flag_id` NULL, bản ghi cũ vẫn truy được qua `entity_id IN stateIds`; xác nhận trên PostgreSQL thật (GAP) |
| UI logic (route, `?env=`, payload) | Hàm thuần + `axios-mock-adapter`; assert số lời gọi API và payload; không phụ thuộc timer thật (dùng `vi.useFakeTimers` nếu có debounce) |
| UI component (dialog, ma trận chip, a11y) | Chỉ khi có RTL/axe (GAP). Chưa có công cụ ⇒ story **không đạt DoR** về test tự động, phải ghi rõ "kiểm thủ công + bằng chứng" hoặc chặn đến khi bổ sung công cụ |
| Hiệu năng | Assert số truy vấn/số request (xác định) cộng đo thời gian trên môi trường cố định (không gate bằng thời gian trên máy dev) |

## 5. Kiểm thử hiệu năng — endpoint ma trận (pha 2)

Mục tiêu (§4): ≤ 3 request khi mở Flags list bất kể N,K; p95 ≤ 300 ms tại 100 flag/trang × 20 env; trang ≤ 100; rate limit ≤ 60 req/phút/người dùng (đề xuất, chưa xác nhận); quy mô ≤ 1 000 flag/project, ≤ 20 env.

| Test | Cách | Tiêu chí |
|---|---|---|
| P-1 N+1 vs một lời gọi | Hibernate Statistics (`hibernate.generate_statistics`) hoặc datasource-proxy **[chưa có trong pom — GAP, hoặc dùng Statistics sẵn trong Hibernate]**: đếm câu SQL cho trang 100 flag × 20 env | Số truy vấn **hằng số** không phụ thuộc N,K (kỳ vọng ~2–3: trang flag + state `IN`); so với baseline hiện tại 1+N (F6). Đây là gate tất định chính |
| P-2 Số request UI | Unit UI/mock adapter: đếm lời gọi khi mở Flags list | ≤ 3 |
| P-3 Kẹp trang | `size=1000` ⇒ 100 (T-PAGE-1) | |
| P-4 Độ trễ p95 | Dữ liệu tổng hợp 1 000 flag × 20 env trên **PostgreSQL thật**, phiên bản ≈ production, 100 flag/trang; đo p95 trên nhiều lần | ≤ 300 ms. **GAP:** công cụ tải + PG thật; số liệu trên H2 không có giá trị cho p95 |
| P-5 Rate limit | Vượt ngưỡng ⇒ 429, theo mẫu `RateLimitIntegrationTest` | Số cấu hình được (Q12) |
| P-6 Backfill ADR-03 | Tạo env trên project 1 000 flag | Thời gian/giao dịch chấp nhận được (ngưỡng PO/Arch chưa có — hỏi) |

LCP ≤ 2 s (§4): cần Lighthouse/đo trình duyệt — **GAP**.

## 6. Bảo mật

- Test authz/IDOR âm là JUnit SIT (bảng §3); mỗi endpoint mới/sửa nhận `envId`/`projectId`/`flagId` có ≥ 1 ca dương và ≥ 1 ca âm (NFR "0 endpoint không khẳng định sở hữu").
- Bổ sung: `value` chứa `<script>`/chuỗi dài render đúng dạng text (UI, cần RTL — GAP); log/audit không chứa PII (kiểm bằng appender); kiểm không có `dangerouslySetInnerHTML` bằng oxlint rule/grep trong CI (kiểm tra tĩnh, nếu rule chưa bật thì ghi GAP).
- DAST/pentest: phối hợp `security-reviewer` trên STG; công cụ chưa có trong repo (GAP). Test-engineer chỉ phân loại phát hiện, không tự sửa.

## 7. Kế hoạch dữ liệu tổng hợp (không PII/thẻ)

Tuân thủ skill `synthetic-test-data`. Dữ liệu sinh bằng builder/fixture trong test, không export từ môi trường thật, không có dump production.

- **Cấm tuyệt đối:** PII thật, số thẻ/PAN, email thật (dùng `*@example.test`), token/JWT/API key thật, bí mật. Khoá flag và `value` **không được là bí mật hay giống bí mật** (không `password=`, `AKIA…`, `sk_…`, JWT, chuỗi base64 dài): dùng giá trị trung tính như `"checkout-v2"`, `"blue"`, `"42"`, `{"limit":10}`. Test T-F19 cho chuỗi dài dùng `"a".repeat(n)`. JWT test tạo từ secret test trong `application-test.properties` (không dùng secret thật).
- **Quy ước đặt tên:** prefix `tst-` (org `tst-org-x`, `tst-proj-a`, flag `tst-flag-checkout`); UUID cố định ở hằng số fixture (mô-đun dùng chung) để assert 404/403 dễ đọc; không dùng random không seed.
- **Fixture đa org/đa project (IDOR):**

| Thực thể | Dữ liệu |
|---|---|
| Org X | Project A, Project B; env DEV/STG/PROD mỗi project (id khác nhau); flag A1..A3 (BOOLEAN, STRING, INTEGER, JSON), flag B1 |
| Org Y | Project C (đủ DEV/STG/PROD), flag C1, audit cho C1 |
| Người dùng | `owner-x` (OWNER org X); `admin-x` (ADMIN, không OWNER); `viewer-x` (VIEWER); `grant-a` (grant project A, member org X); `outsider-x` (member org X, không grant — trường hợp "cùng org khác project"); `member-y` (chỉ org Y); `noaccess` (không thuộc org nào) |
| Bất thường (seed trực tiếp qua repository) | State liên kết flag A1 ↔ env của B (cho T-IDOR-4); flag có 21 state (T-AUD-CAP) |

Ma trận quyền × endpoint: mỗi endpoint mới chạy với tất cả người dùng trên, kỳ vọng ghi trước trong bảng test (dương/âm).

- **Env DEV/STG/PROD + change window:** DEV không window; STG tuỳ chọn; PROD có window. Bộ cấu hình window: `[9,17)` (trong ngày), `[22,6)` **vắt qua nửa đêm**, `null` (không giới hạn), biên 0 và 23. Khoá vào `Clock.fixed` như §4.1. Trường hợp start==end: chờ đặc tả.
- **Giá trị state:** BOOLEAN `"true"/"false"`; STRING; INTEGER hợp lệ + `"abc"`; JSON hợp lệ + `{bad`; rỗng; đúng biên n, n+1 ký tự (n = giới hạn Q10); rolloutPercent 0, 1, 99, 100, ngoài miền (-1, 101). Ô thiếu state (F11) và flag lưu trữ (archived).
- **Dữ liệu import:** snapshot tổng hợp với: value sai kiểu, value quá dài, flag đã có thiếu state, flag mới, trùng key, `valueType` lệch, 2000 mục (biên trần `flags` ≤ 2000, Q13) cho test hiệu năng import.
- **Quy mô perf:** bộ sinh 1 000 flag × 20 env (≈ 20 000 state) bằng script/builder tách khỏi unit test, tên prefix `tst-perf-`, chỉ nạp vào STG/PG của test; dọn sau chạy.
- **Dọn dẹp:** mỗi `@SpringBootTest` dùng `@Transactional` hoặc xoá theo prefix; test đồng thời (không thể dùng `@Transactional`) tự xoá trong `@AfterEach`. Không chia sẻ DB giữa test song song.

## 8. Danh sách hồi quy hành vi hiện có

BE (bộ test đã có phải xanh, không sửa assertion để qua; coverage JaCoCo ≥ 0,87): `FeatureFlagControllerTest`, `EnvironmentControllerTest`, `EnvironmentTransferControllerTest`/`EnvironmentTransferServiceImplTest`, `AuditControllerTest`, `PermissionServiceTest`, `ProjectGrantServiceImplTest`, `EvaluationControllerTest` (SDK không đổi), `FlagEnvironmentStateRepositoryTest`, `AuditLogRepositoryTest`, `GlobalExceptionHandlerTest`, `WebhookDispatcherTest`/`SlackEventListenerTest`, `SecurityChainIntegrationTest`, `RateLimitIntegrationTest`. Cần thêm/kiểm lại các hành vi:
1. Tạo flag tự tạo state `enabled=false` cho mọi env (F10); tạo env mới chưa tạo state (F11, đổi ở pha 2 nên đổi kỳ vọng có chủ đích).
2. `getState` 404 khi thiếu state; `updateState` giữ nguyên `rolloutPercent` khi null.
3. Archive mềm qua `DELETE /flags/{id}` (F14), `GET /flags` mặc định 20/trang, kẹp 100.
4. Nâng quyền PROD (`FLAG_STATE_UPDATE_PRODUCTION`, OWNER) và chặn ngoài window — mọi đường ghi (PUT, import).
5. Clone env sao chép state; import dry-run/`conflictStrategy` các nhánh (SKIP/OVERWRITE) trên dữ liệu hợp lệ không đổi kết quả.
6. Audit hiện có (`GET /organisations/{orgId}/audit-log`, quyền org VIEWER) không đổi; bản `ENVIRONMENT`/`IMPORT` tổng vẫn được ghi.
7. Webhook/Slack nhận `value` đúng (before/after) cho PUT; SDK evaluation trả kết quả như cũ.
UI (vitest hiện có phải xanh): `authStore`, `auth`, `axios` (refresh/interceptor), `abac`, `audit`, `environments`, `grants`, `roles`, `apiKeys`, `problem`, `useOrgRole`. Hồi quy thủ công/UAT: route cũ `/envs/:e/flags` redirect sang `/flags?env=:e`; đăng nhập, org, project, env, API key, ABAC, audit page không đổi. Không có E2E tự động (GAP).

## 9. Gap công cụ (không tự thêm; cần quyết định)

1. UI: `@testing-library/react` (+ mở `include` thành `*.test.tsx`, và coverage cho component) cho ProdGuardDialog/FlagStateEditor/FlagsPage/T-UI-ENV render.
2. UI: E2E (Playwright/Cypress) cho UAT-support, MSW tuỳ chọn; axe/Lighthouse cho WCAG 2.1 AA và LCP.
3. BE: Testcontainers/PostgreSQL thật (H2 không đủ cho JSONB `context`, index changeset 020, hành vi khoá/p95); công cụ đếm truy vấn (Hibernate Statistics có sẵn trong Hibernate, nhưng chưa được bật/dùng trong test).
4. Công cụ tải (k6/Gatling/JMeter — chọn do team) và môi trường STG có PG.
5. DAST (ZAP hoặc tương đương) cho pentest support.
6. Đặc tả còn thiếu cho test: ngữ nghĩa `start==end` của window; Q5 (tên `clearValue`, chuyển tiếp `version`), Q9 (múi giờ), Q10 (giới hạn `value`), Q12 (rate limit), Q13 (sự kiện import); ngưỡng thời gian backfill; lệch lịch T-IMP-3 (§3).
7. Chưa có G0/story/AC ⇒ chưa truy vết test↔AC; bổ sung khi có.

## 10. Bằng chứng đề xuất cho G2 (chưa thực thi)

Báo cáo chạy toàn bộ §3 (tất cả xanh, 0 ca bị bỏ qua), JaCoCo ≥ 0,87 trên mã mới, danh sách lỗi phân loại, kết quả P-1/P-4, kết quả hồi quy §8, biên bản UAT do business ký (người), phân loại phát hiện DAST từ `security-reviewer`.
