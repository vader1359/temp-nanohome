# Kế hoạch kiểm thử checkout one-factor và Firebase email-link recovery

Ngày lập: 2026-07-31
Nhánh: `codex/ai-commerce-five-worktree-integration`
Môi trường nghiệm thu: `https://staging.nanohome.vn`
Phạm vi production: không kiểm thử có mutation

## 1. Mục tiêu nghiệm thu

Kế hoạch này xác nhận đồng thời bốn hợp đồng:

1. Checkout chỉ cần một yếu tố danh tính đã xác minh: email hoặc số điện thoại E.164.
2. Email và số điện thoại vẫn đều là dữ liệu liên hệ bắt buộc của đơn hàng.
3. Link xác minh email mở ở tab khác vẫn tạo được application session an toàn và quay về checkout mà không yêu cầu Phone OTP lần nữa chỉ vì đổi tab.
4. Callback email-link không tin query từ browser, không báo thành công giả, không rò PII/token và không thể replay recovery transaction.

Browser staging là acceptance gate bắt buộc. Unit/API test không được dùng thay cho thao tác thật trên UI đối với email-link, session cookie, redirect, checkout hoặc payment flow.

## 2. Ranh giới an toàn

- Chỉ dùng Firebase project staging `temp-nanohome`.
- Chỉ dùng Supabase staging hoặc Supabase local disposable.
- Chỉ dùng SePay Test Mode. Không gọi tài nguyên thanh toán production.
- Không sửa Firebase providers, rules, authorized domains hoặc service account trong lúc chạy suite.
- Không ghi vào AMIS source. Chỉ fixture staging được phép thay đổi khi case yêu cầu.
- Không in ID token, refresh token, OTP, service-role key, email thật hoặc số điện thoại thật vào terminal, screenshot hay bug report.
- Real SMS là lane riêng có phê duyệt quota/cost; suite chính dùng Firebase test identity.
- Các case tạo order/payment/CRM record phải ghi lại ID để cleanup hoặc đối soát sau test.

## 3. Điều kiện đầu vào

Trước khi bắt đầu browser E2E, phải có đủ:

- commit SHA/build identifier cần kiểm thử;
- migration `20260731000000_email_link_recovery_transactions.sql` đã áp trên staging;
- Firebase staging browser config và Admin credential hoạt động;
- `AUTH_CSRF_SECRET` riêng, tối thiểu 32 byte;
- Supabase service role chỉ có ở server;
- một inbox staging có thể đọc được link xác minh;
- Firebase test phone identity và fixed OTP đã được phê duyệt;
- SKU `STG-AMIS-LWLFL00026-10K`, giá `10,000 VND`, còn tồn kho staging;
- SePay Test account/config hợp lệ nếu chạy payment lane;
- Chrome profile sạch dành riêng cho staging và quyền mở DevTools/Network;
- người chạy biết rõ case nào tạo side effect và cách cleanup.

Nếu thiếu bất kỳ điều kiện nào, đánh dấu case `BLOCKED`; không đổi sang production resource để tiếp tục.

## 4. Dữ liệu kiểm thử

| Mã | Danh tính | Trạng thái mong muốn | Mục đích |
|---|---|---|---|
| `ID-EMAIL` | Email staging đã xác minh, chưa có phone đã xác minh | checkout-ready | Luồng one-factor bằng email |
| `ID-PHONE` | Phone E.164 staging đã xác minh, chưa có email đã xác minh | checkout-ready | Luồng one-factor bằng phone |
| `ID-ZERO` | Không có email/phone đã xác minh | không checkout-ready | Fail-closed |
| `ID-MISMATCH-EMAIL` | Có verified email A, form gửi email B | `409` | Chống mâu thuẫn verified factor |
| `ID-MISMATCH-PHONE` | Có verified phone A, form gửi phone B | `409` | Chống mâu thuẫn verified factor |
| `ID-RECOVERY` | User vừa đăng nhập và cần cập nhật email | recovery hợp lệ | Happy path email-link |

Không ghi giá trị thật của identity vào tài liệu. Dùng alias trên trong evidence và bug report.

## 5. Thứ tự chạy bắt buộc

### Pha A — Preflight và static gates

Chạy từ repository root:

```bash
git status --short
git diff --check
npx tsc --noEmit
npm run lint
```

Tiêu chí pass:

- không có whitespace error;
- TypeScript exit `0`;
- ESLint không có error hoặc warning;
- không xuất secret trong output.

### Pha B — Recovery/auth regression tập trung

```bash
npm test -- \
  src/lib/auth/email-link-recovery-route.server.test.ts \
  src/lib/auth/email-link-recovery-ledger.server.test.ts \
  src/lib/auth/firebase-browser-auth.test.ts \
  'src/app/[locale]/auth/email-link/page.test.tsx' \
  'src/app/[locale]/auth/email-link/email-link-recovery.test.tsx' \
  src/components/account/account-auth-flow.test.tsx \
  messages/account-parity.test.ts
```

Tiêu chí pass:

- transaction chỉ trả opaque state;
- UID/email digest phải khớp trước khi consume;
- missing, malformed, expired, tampered và replayed state fail-closed;
- một lần consume trả `consumed`, lần sau trả `replayed`;
- external `returnTo` và `auth` query noise bị loại;
- callback không có Firebase user chỉ phát non-authoritative signal;
- trạng thái invalid, expired, used và recent-login có message riêng ở `vi`, `en`, `ko`.

### Pha C — Full application regression

```bash
npm test
```

Tiêu chí pass:

- toàn bộ Vitest pass;
- email-only và phone-only checkout tests còn pass;
- zero-factor còn fail;
- order-contact normalization/mismatch tests còn pass;
- không có snapshot/log chứa token hoặc PII.

### Pha D — Database clean reset, lint và pgTAP

Docker Desktop và WSL integration phải hoạt động. Supabase CLI phải được cài hoặc truyền qua `SUPABASE_BIN`.

```bash
supabase/plan00-local/run-clean-reset.sh --full
```

Tiêu chí pass:

- clean reset áp toàn bộ migration theo đúng thứ tự;
- `supabase db lint` không báo schema error;
- toàn bộ pgTAP pass;
- `email_link_recovery_transactions_test.sql` pass đủ các assertion về privilege, TTL và replay;
- sau suite không còn container/volume disposable của harness.

### Pha E — Production build bằng cấu hình không-production

Compile-only gate có thể tắt payment trong process:

```bash
PAYMENT_MODE=off npm run build
```

Nếu cần kiểm tra SePay integration, cung cấp đầy đủ SePay Test env trong process memory; không hạ validation và không sửa `.env.local` để né lỗi.

Tiêu chí pass:

- webpack compile pass;
- TypeScript build pass;
- static generation pass;
- route `/api/auth/email-link/recovery` xuất hiện trong manifest;
- không kết nối production payment/AMIS.

### Pha F — Browser test bắt buộc

Browser suite phải được chạy sau khi Pha A–E xanh. Không đánh dấu release-ready nếu chỉ có Vitest/pgTAP/build.

Phân chia browser:

- in-app Browser hoặc browser profile sạch: callback negative cases, URL scrub, locale, accessibility và responsive;
- Chrome profile staging có persistent state: Firebase sign-in, inbox link, cross-tab recovery, session cookie và checkout;
- browser automation: các case deterministic có thể lặp lại mà không gửi SMS/email thật;
- thao tác tay có giám sát: inbox staging, hosted Firebase action và SePay Test redirect.

Mỗi case browser phải thực hiện thao tác UI thật bằng click/type/open-tab/refresh. Chỉ gọi API trực tiếp khi test case được định nghĩa là security/fault injection và phải ghi rõ trong evidence.

#### F.1. Chuẩn bị browser run

1. Ghi build SHA, deployment timestamp và run ID.
2. Xác nhận URL là `https://staging.nanohome.vn`; không chấp nhận localhost làm evidence cuối.
3. Dùng profile staging riêng, không có extension sửa request/redirect.
4. Mở Network với Preserve log và Disable cache trong lần chạy chẩn đoán.
5. Không export HAR nguyên bản nếu request có token/body nhạy cảm; chỉ ghi method/path/status/timing đã redaction.
6. Mở Console và ghi số error/warning trước khi bắt đầu.
7. Chụp trạng thái Application Storage ban đầu mà không hiển thị cookie value.
8. Với negative run, xóa app cookies/storage trước mỗi nhóm case.
9. Với cross-tab run, không xóa state giữa tab gốc và callback; hai tab phải dùng cùng profile.

#### F.2. Topology ba tab cho email-link

| Tab | Vai trò | Kiểm tra |
|---|---|---|
| A | Checkout/auth tab gốc | Identity flow, pending state, BroadcastChannel/storage listener |
| B | Inbox staging | Chỉ lấy đúng email của run hiện tại; không đưa link vào log/report |
| C | Firebase hosted action/callback | Query scrub, transaction validation, user reload, session recovery |

Trình tự bắt buộc:

1. Tab A bắt đầu verify/update email từ checkout.
2. Xác nhận UI báo đã gửi link chỉ sau khi transaction API và Firebase send đều thành công.
3. Tab B mở email mới nhất có timestamp/run identity khớp.
4. Mở link thành tab C, không paste link vào terminal.
5. Quan sát tab C đến khi callback chuyển trạng thái hoặc replace-navigation.
6. Nếu callback phát non-authoritative signal, quay lại tab A và quan sát recovery tại đó.
7. Refresh checkout sau khi hoàn tất để chứng minh session là HttpOnly server session, không chỉ React state.
8. Mở một protected account/checkout endpoint bằng UI để chứng minh session hoạt động.

#### F.3. Assertions browser cho mọi callback case

- Address bar cuối cùng không còn `state`, `oobCode`, `continueUrl`, `returnTo` hoặc `intent`.
- Back/Forward không phục hồi URL nhạy cảm hoặc chạy action lần hai.
- Không có text “verified/success” khi transaction chưa được consume và identity chưa khớp.
- Link fallback luôn là local sign-in path đúng locale.
- Không có navigation tới external origin, kể cả encoded hoặc protocol-relative URL.
- Console không có unhandled exception, hydration error hoặc missing translation.
- Network không có request lặp vô hạn.
- Recovery/session response là `private, no-store`.
- Chỉ ghi cookie name/flags; không ghi cookie value.
- Screenshot phải được chụp sau query scrub và phải redaction email/order ID nếu xuất hiện.

#### F.4. Assertions browser cho happy path

- Link mở ở tab mới nhưng không yêu cầu Phone OTP lần hai.
- Callback dùng replace-navigation, không để action URL trong history.
- Checkout vẫn authenticated sau hard refresh.
- Verified factor được khóa đúng; factor chưa verified vẫn là contact bắt buộc và editable.
- Session exchange chỉ xảy ra một lần cho recovery state.
- Mở lại cùng link cho trạng thái already-used và không tạo session/order/account claim mới.
- Firebase browser state đã sign out sau khi application session được tạo.

#### F.5. Thứ tự browser run

| Thứ tự | Nhóm | Cases |
|---:|---|---|
| 1 | Anonymous callback smoke | `EL-001` đến `EL-005` |
| 2 | Security negatives | `EL-006` đến `EL-020` |
| 3 | Cross-tab happy path | `EL-HAPPY-001` |
| 4 | No-current-user fallback | `EL-HAPPY-002` bằng integration browser harness |
| 5 | One-factor checkout | `CO-001` đến `CO-010` |
| 6 | Locale/viewport | `vi` full; `en`, `ko` smoke; desktop/mobile |
| 7 | Fault injection | `FI-001` đến `FI-007` |
| 8 | Payment acceptance | SePay Test lane, chỉ khi nằm trong release scope |

#### F.6. Evidence bắt buộc cho từng browser case

```text
Case ID / run ID / build SHA
Browser profile + version + viewport + locale
Precondition identity alias
Các thao tác click/type/open-tab/refresh đã thực hiện
URL cuối sau scrub
UI status thực tế
Request sequence đã redaction: METHOD path -> status
Console: error count / warning count
Cookie flags, không có value
Screenshot/video path đã redaction
PASS | FAIL | BLOCKED
Side effect IDs và cleanup status
```

## 6. Ma trận browser — callback và transaction

Mỗi case phải ghi: build SHA, locale, browser/profile, URL sau scrub, HTTP status chính, console error/warning, cookie/result và screenshot đã redaction.

| ID | Luồng | Thao tác chính | Kết quả bắt buộc |
|---|---|---|---|
| `EL-001` | Không có state | Mở `/{locale}/auth/email-link` | Hiện invalid; không báo verified; link về sign-in |
| `EL-002` | Legacy query độc hại | Thêm `intent=checkout&returnTo=https://evil.example` | URL lập tức sạch; không redirect external |
| `EL-003` | Fake action code | Thêm mode hợp lệ và `oobCode` giả nhưng không có state | Fail trước Firebase action; không success giả |
| `EL-004` | Malformed state | State ngắn/ký tự sai | `400`; UI invalid; cookie bị clear nếu có |
| `EL-005` | State không có cookie | Opaque state đúng format nhưng browser không có recovery cookie | `400`; UI invalid |
| `EL-006` | Cookie bị sửa | Thay một byte trong signed cookie bằng test API harness | Reject trước durable ledger |
| `EL-007` | State hết hạn | Chờ quá TTL hoặc dùng clock-controlled integration test | `410`; message expired |
| `EL-008` | State đã dùng | Mở lại callback sau session thành công | `409`; message already used |
| `EL-009` | Concurrent replay | Gửi hai consume request đồng thời | Chính xác một `200`, request còn lại `409` |
| `EL-010` | UID mismatch | Consume bằng token của user khác | `409 recovery_identity_mismatch`; ledger chưa consume |
| `EL-011` | Email mismatch | UID đúng nhưng verified email khác expected email | `409`; không trả metadata |
| `EL-012` | Email chưa verified | UID/email đúng nhưng `email_verified=false` | `409`; không tạo session |
| `EL-013` | Stale auth | `auth_time` quá 5 phút | Message recent sign-in; không tạo session |
| `EL-014` | Cross-origin POST/PUT | Gửi Origin khác app origin | `403` trước Firebase/Supabase |
| `EL-015` | Ledger unavailable | Tắt/mô phỏng RPC lỗi trước khi gửi email | `503`; không issue recovery cookie; không gửi email |
| `EL-016` | External return path | Start với URL external | Metadata server chỉ trả locale root an toàn |
| `EL-017` | Auth query noise | Start với `/checkout?step=contact&auth=login` | Destination giữ `step`, loại `auth` |
| `EL-018` | Unsupported Firebase mode | `resetPassword` hoặc mode lạ | Invalid; không gọi `checkActionCode` |
| `EL-019` | Invalid/expired action code | Custom-handler sandbox case | Message invalid/expired đúng; không session |
| `EL-020` | Locale parity | Lặp invalid/expired/used ở `vi`, `en`, `ko` | Không missing translation |

## 7. Ma trận browser — happy path email-link

### `EL-HAPPY-001` — Callback tab có matching Firebase user

1. Mở checkout bằng `ID-RECOVERY` trong Chrome profile staging.
2. Bắt đầu verify/update email.
3. Xác nhận request tạo recovery transaction trả `201` và URL email chỉ chứa opaque `state`.
4. Mở link từ inbox trong tab mới của cùng profile.
5. Theo dõi Network nhưng không lưu/copy token body.
6. Xác nhận thứ tự logic:
   - recovery state validation;
   - Firebase action completion hoặc hosted-action redirect;
   - Firebase user reload và fresh ID token;
   - atomic recovery consume;
   - CSRF GET;
   - session POST với server-authoritative `intent=checkout` và safe destination.
7. Xác nhận browser dùng replace-navigation về checkout.
8. Refresh checkout và gọi protected endpoint để chứng minh HttpOnly application session tồn tại.
9. Xác nhận Firebase browser session đã sign out sau exchange.

Pass khi không có Phone OTP lặp lại, không có redirect loop và checkout vẫn authenticated sau refresh.

### `EL-HAPPY-002` — Callback tab không có current Firebase user

Case này ưu tiên component/integration automation vì staging browser persistence thường chia sẻ user giữa các tab.

1. Giữ `identityUser` hợp lệ ở tab auth gốc.
2. Mô phỏng callback adapter trả `null` sau khi state đã được server validate.
3. Xác nhận callback chỉ phát `{type, marker, state, issuedAt}`; không chứa email, UID, return path hoặc token.
4. Xác nhận UI chỉ nói callback đã được chấp nhận, không nói email đã verified.
5. Tab gốc chỉ phản ứng với đúng opaque state đang chờ.
6. Tab gốc reload Firebase user, consume transaction và exchange session qua đường chuẩn.

Pass khi marker giả/cũ/sai state không kích hoạt recovery và marker đúng hoàn tất session mà không Phone OTP lần hai.

## 8. Ma trận checkout one-factor

| ID | Identity | Dữ liệu form | Kết quả |
|---|---|---|---|
| `CO-001` | Verified email only | Email khóa đúng verified value; phone hợp lệ nhập tay | Checkout-ready; order dùng cả hai contact |
| `CO-002` | Verified phone only | Phone khóa đúng E.164; email hợp lệ nhập tay | Checkout-ready; order dùng cả hai contact |
| `CO-003` | Zero verified factor | Email và phone chỉ là dữ liệu form | Không checkout-ready; không tạo order |
| `CO-004` | Verified email A | Gửi email B | `409 verified_contact_mismatch` |
| `CO-005` | Verified phone A | Gửi phone B | `409 verified_contact_mismatch` |
| `CO-006` | Verified email | Phone dạng `090 123 4567` | Persist dạng E.164 chuẩn hóa |
| `CO-007` | Verified phone | Email có hoa/khoảng trắng | Persist email đã normalize |
| `CO-008` | Một factor verified | Thiếu email | `400`; không order |
| `CO-009` | Một factor verified | Thiếu phone | `400`; không order |
| `CO-010` | Session hết hạn | Submit checkout | Chuyển về sign-in; không order mồ côi |

Với case tạo order thật trên staging:

- chỉ dùng SKU `STG-AMIS-LWLFL00026-10K`;
- ghi stock trước/sau;
- ghi order/payment attempt ID đã redaction;
- chỉ mở SePay Test flow;
- xác nhận browser redirect không tự đánh dấu paid;
- cleanup hoặc reconcile theo runbook staging.

## 9. Cookie, privacy và redirect assertions

Kiểm tra bằng Network/Application panel, không chụp giá trị cookie:

- recovery cookie có prefix `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` và không có `Domain`;
- session/CSRF cookie giữ nguyên contract hiện có;
- callback query bị scrub khỏi address bar và browser history;
- URL, localStorage, BroadcastChannel payload, console và analytics không có raw email, phone, UID, ID token hoặc refresh token;
- localStorage chỉ chứa opaque state/marker có TTL;
- metadata `intent`, locale và destination chỉ được tin từ signed transaction/server response;
- external, protocol-relative, encoded external và locale-confusion return paths đều fail-safe;
- mọi API response recovery có `Cache-Control: private, no-store, max-age=0` và `Vary: Cookie`.

## 10. Browser và viewport matrix

Chạy full happy path trên:

- Chrome desktop, viewport khoảng `1440x900`;
- Chrome mobile emulation, viewport khoảng `390x844`;
- locale `vi` bắt buộc;
- smoke invalid/expired/used trên `en` và `ko`.

Kiểm tra thêm:

- keyboard focus và link sign-in có thể sử dụng;
- status có `role=status`/live announcement;
- không overflow, che nút hoặc loading vô hạn;
- back/forward không phục hồi query nhạy cảm.

## 11. Network/failure injection

| ID | Fault | Kết quả mong muốn |
|---|---|---|
| `FI-001` | Mất mạng khi start transaction | Không gửi email; error có thể retry |
| `FI-002` | Firebase send email lỗi sau khi transaction đã tạo | Không báo email đã gửi; transaction tự hết TTL |
| `FI-003` | Mất mạng khi validate callback | UI không success; cho phép re-auth an toàn |
| `FI-004` | Ledger RPC lỗi khi consume | `503`; không trả trusted metadata |
| `FI-005` | Session exchange lỗi sau consume | Không success giả; yêu cầu sign-in lại |
| `FI-006` | Firebase reload/token refresh lỗi | Message network/unknown phù hợp; không session |
| `FI-007` | Tab gốc đóng | Callback đưa về sign-in an toàn; không mint session từ action code đơn lẻ |

## 12. Tiêu chí release gate

Release chỉ được đề xuất khi tất cả điều kiện sau cùng đúng:

- static/type/lint/build xanh;
- full Vitest xanh;
- clean database reset, db lint và toàn bộ pgTAP xanh;
- Pha F browser suite đã thực sự chạy; không suy luận kết quả browser từ unit/API test;
- toàn bộ case browser trong release scope có trạng thái `PASS | FAIL | BLOCKED`, không để `NOT RUN` mà vẫn release;
- `EL-001` đến `EL-005`, `EL-HAPPY-001`, `EL-007`, `EL-008`, `EL-009`, `EL-010`, `CO-001` và `CO-002` có evidence staging từ browser thật;
- smoke browser `vi` desktop/mobile và `en`, `ko` desktop xanh;
- evidence browser đã ghi URL/history sau scrub, UI state, Network, Console, cookie flags và kết quả refresh/cross-tab tương ứng;
- không có P0/P1/P2 chưa xử lý;
- không có secret/PII trong artifact;
- mọi side effect staging đã cleanup hoặc có owner nhận bàn giao;
- rollback migration/app version đã được ghi rõ;
- không có thay đổi production config hoặc production data.

## 13. Cách ghi nhận lỗi

Mỗi bug dùng mẫu:

```text
Bug ID:
Severity: P0 | P1 | P2 | P3
Build SHA:
Environment / locale / viewport:
Test case ID:
Preconditions:
Steps to reproduce:
Expected:
Actual:
HTTP status / request sequence (không kèm token/body nhạy cảm):
Console summary:
Screenshot/video đã redaction:
Data side effects và cleanup status:
Repro rate:
Suspected owner/surface:
```

Severity:

- `P0`: lộ secret/PII, production mutation, auth bypass hoặc payment truth sai.
- `P1`: session/checkout happy path hỏng, success giả, external redirect hoặc replay tạo side effect.
- `P2`: một negative path fail sai, locale/UX làm người dùng không thể tự phục hồi.
- `P3`: wording, visual hoặc console warning không ảnh hưởng correctness.

## 14. Evidence manifest

Artifacts cuối run nên gồm:

- commit SHA và timestamp;
- output tổng hợp Vitest, lint, TypeScript, build, DB reset/lint/pgTAP;
- bảng test case `PASS | FAIL | BLOCKED | NOT RUN`;
- browser run summary theo profile/version/viewport/locale;
- screenshot hoặc video sau khi URL đã scrub và đã redaction;
- bằng chứng Back/Forward, hard refresh và cross-tab cho các case áp dụng;
- request sequence chỉ gồm method/path/status/timing;
- Console error/warning count của từng browser case;
- cookie attribute checklist không có cookie value;
- order/payment/CRM cleanup ledger đã redaction;
- danh sách bug và quyết định release.

Không đưa `.env.local`, token, OTP, callback secret, service-role key hoặc raw identity vào evidence.

## 15. Baseline đã xác nhận ngày 2026-07-31

- Full Vitest: `259` files, `1512` tests pass.
- TypeScript `--noEmit`: pass.
- Full ESLint: `0` error, `0` warning.
- Production build với process-local `PAYMENT_MODE=off`: pass, `110` static pages.
- Supabase clean reset + db lint + pgTAP: `28` files / `927` tests pass.
- Instagram pgTAP lane: `1` file / `8` tests pass.
- Migration email-link recovery và test replay riêng: pass.
- Browser local negative smoke:
  - legacy external `returnTo`: fail-closed và URL scrub;
  - fake `oobCode` không state: fail-closed;
  - opaque state không cookie: fail-closed;
  - không có console error/warning trong ba case trên.

Các bằng chứng còn phải chạy trước staging acceptance cuối:

- browser staging đầy đủ theo Pha F, bao gồm Network/Console/cookie/history evidence;
- email thật trên inbox staging và cross-tab browser cho `EL-HAPPY-001`;
- session tồn tại sau hard refresh checkout trên browser;
- browser checkout staging `CO-001` và `CO-002`;
- locale/viewport browser smoke bắt buộc;
- SePay Test lane nếu release bao gồm payment;
- cleanup/reconcile các side effect staging.
