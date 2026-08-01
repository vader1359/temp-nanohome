# Kế hoạch test–fix–retest toàn chức năng

Ngày chạy: 2026-07-31

## 1. Phạm vi và nguyên tắc an toàn

- Môi trường: local và `https://staging.nanohome.vn`.
- Thanh toán: chỉ SePay Test Mode; không gọi production payment endpoint, không dùng tiền thật.
- Không ghi secret, token, OTP, cookie value hoặc PII vào evidence.
- Side effect staging chỉ dùng fixture được chỉ định và phải ghi cleanup/reconcile.
- Mỗi case kết thúc bằng `PASS`, `FAIL` hoặc `BLOCKED`; không suy luận browser PASS từ unit test.

## 2. Preflight và cấu hình

| ID | Case | Kỳ vọng |
|---|---|---|
| `PRE-001` | Kiểm tra đầy đủ env bắt buộc, chỉ ghi tên/boolean | Không lộ value |
| `PRE-002` | Firebase/Auth providers | Phone, email, Google đúng staging domain |
| `PRE-003` | SePay mode và endpoint | Test Mode, không production |
| `PRE-004` | Supabase/AMIS/Cloudflare connectivity | Chỉ staging/test resources |
| `PRE-005` | Fixture catalog/payment | SKU `STG-AMIS-LWLFL00026-10K`, giá 10.000 VND, còn hàng |

## 3. Automation gates

| ID | Command/lane | Gate |
|---|---|---|
| `AUTO-001` | `npm run lint` | 0 error |
| `AUTO-002` | `npx tsc --noEmit` | PASS |
| `AUTO-003` | Focused auth/recovery/checkout/SePay tests | PASS |
| `AUTO-004` | `npm test` | Toàn bộ Vitest PASS |
| `AUTO-005` | Supabase clean reset + db lint + pgTAP | Toàn bộ migration/test PASS |
| `AUTO-006` | `PAYMENT_MODE=sepay_sandbox SEPAY_ENV=sandbox npm run build` | Compile/type/static routes PASS; payment không bị tắt |
| `AUTO-007` | `npm run test:e2e` | Không launch blocker; phân loại mọi assertion fail |

## 4. Browser flow công khai

| Nhóm | Cases |
|---|---|
| Home/i18n | `/`, `vi`, `en`, `ko`, invalid locale, header/footer/navigation |
| Catalog | List, product detail, brand/category/subcategory/room/status filters, sort, pagination |
| Search | Header search, catalog search, query chip/remove, zero-result state |
| Product | Fixture SKU/price/stock/images/detail, related items, locale links |
| Cart | Add, open drawer, quantity, remove, persistence/refresh, checkout handoff |
| Consent/analytics | Optional tracker before/after consent and withdrawal |
| Responsive | Desktop và mobile cho `vi`; desktop smoke cho `en`, `ko` |

## 5. Auth và email-link recovery

- Auth UI: phone OTP, email/password, Google option, validation, return-to-checkout intent.
- Session: refresh, expired session, logout, protected account routes.
- Callback matrix: `EL-001` đến `EL-020` theo
  `docs/plans/checkout-email-link-recovery-test-plan.vi.md`.
- Happy path: `EL-HAPPY-001`, `EL-HAPPY-002`, gồm topology tab gốc/callback/inbox.
- Assertions bắt buộc: URL scrub, same-origin return, cookie flags, Console/Network, refresh/replay.

## 6. One-factor checkout

- Chạy `CO-001` đến `CO-010` theo plan checkout/email-link.
- Kiểm tra email-only, phone-only, zero-factor, contact mismatch, normalize email/E.164,
  missing contact và expired session.
- Fixture duy nhất: `STG-AMIS-LWLFL00026-10K`.
- Không tạo order nếu case kỳ vọng fail.

## 7. SePay Test Mode

| ID | Case | Kỳ vọng |
|---|---|---|
| `PAY-001` | Preflight payment config | Test Mode được bật; không production URL/key |
| `PAY-002` | Checkout tạo order/payment | Một order test, amount 10.000 VND |
| `PAY-003` | VietQR render | Order code, amount và nội dung chuyển khoản đúng |
| `PAY-004` | Status poll khi pending | Không success giả, không duplicate order |
| `PAY-005` | Test webhook/IPN hợp lệ | Chuyển payment/order sang paid đúng một lần |
| `PAY-006` | Duplicate IPN | Idempotent, không double side effect |
| `PAY-007` | Invalid signature/secret | Reject, không đổi trạng thái |
| `PAY-008` | Amount/order mismatch | Reject hoặc giữ pending, không paid giả |
| `PAY-009` | Cancel flow | Trang cancel đúng, order/payment nhất quán |
| `PAY-010` | Expired/failed flow | Trang error/expired đúng, retry an toàn |
| `PAY-011` | Success page + hard refresh | Trạng thái vẫn đúng sau refresh |
| `PAY-012` | Reconcile/cleanup | Ghi ID đã redaction và cleanup fixture side effect |

## 8. Backend/integration regression

- Account/profile/cart/wishlist/orders/preferences/security API tests.
- AMIS inventory, customer pre-creation và sale-order tests.
- Supabase RLS, ownership, checkout ledger, recovery transaction replay.
- SePay repository, test-mode client, IPN, state, cancellation, reconciliation.
- Consent/analytics, chat, personalization, vision và Instagram automation lanes.

## 9. Fault injection và security

- Chạy `FI-001` đến `FI-007` theo email-link plan.
- Cross-origin mutation, external redirect, stale/replayed state, identity mismatch.
- Payment invalid IPN, duplicate callback, amount mismatch và service unavailable.
- Không có secret/PII trong URL, console, HTML, report hoặc trace.

## 10. Vòng fix và tiêu chí hoàn chỉnh

1. Chạy gate theo thứ tự preflight → automation → browser → payment.
2. Ghi bug với severity, repro, expected/actual, request sequence đã redaction.
3. Sửa lỗi code/config/test fixture thuộc repo; không sửa test để che regression.
4. Rerun focused test, sau đó full regression liên quan.
5. Release-ready chỉ khi không còn P0/P1/P2, các case bắt buộc có evidence staging,
   và mọi case còn lại có trạng thái rõ ràng.

## 11. Kết quả vòng chạy cuối

### Dữ liệu và cấu hình

- Đã fetch toàn bộ catalog, không giới hạn 50: nguồn public có 2.173 variants; AMIS có 28.193 products.
- Staging hiện có 2.182 variants; audit pagination lấy đủ 2.182/2.182, unique 2.182, duplicate 0.
- Eligibility sau import: 2.107 category-ready, 1.023 room-ready, 900 storefront/cart/payment-ready.
- Fixture `STG-AMIS-LWLFL00026-10K`: stock 100, đủ điều kiện storefront/cart/payment.
- Payment bắt buộc ở `staging-preview/sepay-sandbox`; không chạy `PAYMENT_MODE=off`, không gọi production, không dùng tiền thật.

### Lỗi đã sửa trong vòng test–fix–retest

- Pagination catalog bị thiếu/trùng do chèn featured brand vào từng trang.
- Search submit phụ thuộc hydration và aggregate search render hàng trăm kết quả; preview nay giới hạn đúng 6 kết quả có rank.
- Filter sản phẩm làm mất locale `/vi` khi cập nhật URL.
- Cart drawer còn hard-code tiếng Việt trên locale `en`/`ko`.
- Product metadata/canonical dùng nội dung LC2 tĩnh thay vì dữ liệu variant thực.
- Ảnh có `src=""`, ảnh LCP phía trên fold bị lazy và Next.js cảnh báo do URL trùng ở thumbnail/logo.
- E2E cart click vào HTML SSR ở navigation `commit`, tạo flaky; test nay chờ `load` và đã stress lại không retry.

### Gates cuối

| Gate | Kết quả |
|---|---|
| `npm run lint` | PASS, 0 lỗi |
| `npx tsc --noEmit` | PASS |
| `npx vitest run` | PASS, 261 files / 1.526 tests |
| Supabase clean reset + pgTAP | PASS, 28 files / 927 tests; Instagram 1 file / 8 tests |
| Playwright full, `--retries=0` | PASS, 25/25 |
| Cart stress, `--repeat-each=5 --retries=0` | PASS, 5/5 |
| Flaky regression stress | PASS, 21/21 với `--repeat-each=3 --retries=0` |
| `git diff --check` | PASS |
| Sandbox production build | PASS, 110/110 pages |

### Browser và thanh toán thực tế

- Browser: home/i18n, catalog, filter category/room/status/brand, pagination, search, PDP, add/update/clear cart, guest checkout redirect và cart tiếng Anh đều PASS.
- Search `Series 7`: 6 product previews, 1 brand result, khoảng 1,4 giây trong dev sau sửa; console sạch.
- Product fixture: title/canonical động đúng, không còn image source rỗng; ảnh above-fold đều eager; console sạch trên tab mới.
- Checkout tích hợp: guest redirect PASS, session exchange PASS, auto-merge PASS, checkout `201`.
- SePay Test Mode: payment `201`, QR `200`, amount 10.000 VND, environment `sandbox`, cleanup PASS.
- Không ghi secret/PII vào output; không có production write hoặc giao dịch tiền thật.

### Trạng thái phát hành

- Code và kiểm thử local/current branch: hoàn tất, không còn lỗi tái hiện trong phạm vi đã chạy.
- `staging.nanohome.vn` vẫn đang trỏ deployment cũ, không chứa các fix của worktree hiện tại. Chưa commit/push/deploy vì thao tác đó chưa được yêu cầu rõ ràng; staging-domain acceptance cần chạy lại sau deployment.
