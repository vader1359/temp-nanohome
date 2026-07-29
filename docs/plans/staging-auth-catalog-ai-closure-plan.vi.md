# nanoHome — Kế hoạch đóng toàn bộ Auth, Catalog, AI và UI staging

Trạng thái: **nguồn thực thi chuẩn cho giai đoạn closure**

Ngày lập: 2026-07-29

Worktree: `/Users/iant1359/Develop/staging-ai-commerce`

UI staging duy nhất: `https://staging.nanohome.vn`

Firebase staging: `temp-nanohome`

Supabase staging: `nanohome-staging` (`xtjmwpeqarmsumjspnyw`)

## 1. Kết quả bắt buộc

Kế hoạch này chỉ được xem là hoàn tất khi đồng thời đạt các kết quả sau:

1. Firebase là nhà cung cấp danh tính duy nhất trên UI:
   - Phone OTP là luồng chính;
   - Google là luồng thay thế;
   - email/password và password reset là luồng thay thế;
   - Supabase Auth không còn tham gia đăng nhập UI.
2. Sau khi đăng nhập, server tạo được Firebase `HttpOnly` session cookie, ánh xạ được
   Firebase UID sang `customer_accounts.id`, và mở được toàn bộ My Account.
3. Cart, guest-cart merge, checkout và SePay Test hoạt động bằng đúng account vừa
   xác thực; browser redirect không bao giờ tự đánh dấu đơn đã thanh toán.
4. Supabase staging có bản chụp catalog đầy đủ theo manifest, không chỉ vài fixture.
5. Trang sản phẩm hiển thị toàn bộ sản phẩm đủ điều kiện theo policy; dữ liệu bị ẩn
   hoặc chưa approved/validated vẫn phải tồn tại trong database nhưng không bị công
   khai sai.
6. AI text chat hoạt động trên staging, gọi catalog tool, trả các product card có thật
   và không tự bịa SKU, giá, tồn kho hoặc URL.
7. Antigravity chạy toàn bộ UI flow trên staging, không dùng localhost, không dừng vì
   thiếu identity/fixture/allowlist giữa chừng.
8. Production có checklist cấu hình hoàn chỉnh và rollback rõ ràng. Không bật
   production trước khi staging đạt toàn bộ gate.

Không dùng localhost hoặc emulator làm bằng chứng cuối cho Google, Phone OTP, cookie,
callback, catalog, AI hoặc checkout. Local test vẫn có thể dùng để bắt lỗi mã nhanh,
nhưng acceptance bắt buộc chạy trên HTTPS staging.

## 2. Sự thật hiện tại đã kiểm tra

### 2.1 Runtime

| Kiểm tra | Kết quả hiện tại |
|---|---|
| `https://staging.nanohome.vn/` | reachable, redirect hợp lệ |
| `/vi/account/sign-in` | HTTP 200 |
| `/api/chat` OPTIONS | HTTP 204; chưa chứng minh chat provider hoạt động |
| Firebase Admin staging | credential path đã tồn tại; phải recheck trong doctor |
| Google UI | từng quay về app nhưng chưa có bằng chứng session/account hoàn chỉnh |
| Phone UI | từng báo provider chưa bật; chưa có bằng chứng OTP staging thành công |

### 2.2 Supabase/catalog staging

Public read ngày 2026-07-29 cho thấy:

| Đối tượng | Hiện tại |
|---|---:|
| `products` | 4 rows |
| `variants` | 8 rows |
| `catalog_eligibility` | HTTP 404 |
| `search_public_chat_catalog` | HTTP 404 |

Do đó staging hiện chưa có catalog đầy đủ và AI chưa thể grounded vào contract catalog
chuẩn. Việc UI có một số card không phải bằng chứng database đã đầy đủ.

### 2.3 Env/config hiện tại

Đã có tên biến cho Supabase, Firebase browser config, Firebase Admin project/ADC,
DeepSeek API key và SePay Test. Tuy nhiên:

- `ACCOUNT_CENTER_ENABLED` chưa được khai báo tường minh, nên mặc định `false`;
- `AUTH_CSRF_SECRET` chưa có, code đang có đường fallback dùng lại service-role key;
- `AUTH_SESSION_COOKIE_NAME` và `AUTH_SESSION_TTL_SECONDS` chưa được chốt rõ;
- `CHAT_ENABLED`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`,
  `PROMPT_VERSION` chưa đủ để bật chat;
- `FIREBASE_SUPABASE_TRUST_ENABLED` có trong `.env.local` nhưng không nằm trong
  schema và không được code sử dụng;
- `AUTH_PUBLIC_ORIGIN` cũng không phải biến canonical;
- `AUTH_SESSION_COOKIE_NAME` có schema nhưng cookie name trong code vẫn hard-code;
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` và measurement ID không cần cho Auth;
- `supabase/config.toml` chưa có cấu hình Firebase third-party auth.

### 2.4 Các lỗi thiết kế phải xử lý trong cùng một batch

1. Env validation chưa bắt buộc có đúng một Firebase Admin credential mode khi
   `AUTH_PROVIDER=firebase`.
2. Account path hiện chỉ lookup `customer_firebase_principals`; Firebase user mới
   chưa có mapping sẽ bị coi như chưa đăng nhập dù Firebase session hợp lệ.
3. Protected account repository đang hard-code Supabase staging host, nên không thể
   dùng nguyên trạng cho production.
4. Legacy Supabase Auth và Firebase code cùng tồn tại, nhưng chưa có ranh giới
   runtime tuyệt đối.
5. Google redirect trên site không host bằng Firebase dễ lỗi third-party storage nếu
   không proxy Firebase auth helper về cùng origin.
6. Phone Auth thật cần HTTPS domain, Phone provider, SMS region policy, reCAPTCHA,
   quota và Blaze billing cho SMS thật.
7. Antigravity runbook cũ dùng localhost và read-only nên 32 case bị chặn do không
   cho mutation; đó không phải một E2E auth/commerce run.
8. Chat provider có endpoint hard-code trong code trong khi env lại khai báo base URL;
   phải chỉ còn một nguồn cấu hình.

## 3. Quyết định kiến trúc bắt buộc

### 3.1 Một identity authority

Luồng chuẩn:

```text
Firebase Web SDK
  -> Firebase ID token mới đăng nhập
  -> POST /api/auth/session + CSRF
  -> Firebase Admin verify ID token
  -> Firebase Admin tạo session cookie
  -> __Host-nanohome-session (Secure, HttpOnly, SameSite=Lax, Path=/)
  -> server verify cookie
  -> resolve/provision customer_accounts.id
  -> server DAL truy cập Supabase
```

Quy tắc:

- Firebase quyết định người dùng là ai.
- `customer_accounts.id` là khóa sở hữu nội bộ.
- Supabase là database/catalog/storage, không phải UI login provider.
- Firebase session cookie không được gửi làm Supabase bearer token.
- Supabase service-role key không bao giờ ra browser.
- Sau khi exchange thành công, browser Firebase session được sign out; server cookie
  là session ứng dụng duy nhất.

### 3.2 Supabase Third-Party Auth không phải cách sửa login

Code protected account hiện chạy server-side. Vì vậy login/account closure **không
được phụ thuộc** vào `FIREBASE_SUPABASE_TRUST_ENABLED`.

Trong closure hiện tại:

- public catalog dùng publishable key và public RLS/read contract;
- account/cart/order/checkout dùng server session + scoped DAL;
- Supabase Third-Party Auth chỉ bật nếu source scan chứng minh có nhu cầu browser
  truy cập trực tiếp Data API, Storage hoặc Realtime bằng Firebase ID token;
- nếu không có nhu cầu đó, xóa dead flag và không thêm custom-claim/Cloud Function
  chỉ để “có vẻ đã trust”.

Nếu một direct-browser protected path thật sự còn tồn tại, phải chọn một trong hai:

1. chuyển path đó về server DAL; đây là lựa chọn mặc định; hoặc
2. tạo lane riêng cho Supabase Firebase Third-Party Auth, gồm exact project ID,
   `role: authenticated`, token refresh, issuer/audience RLS và cross-project
   rejection tests.

Không được giữ hai kiến trúc hoạt động nửa vời.

### 3.3 Google dùng redirect cùng origin

Primary Google flow là `signInWithRedirect`, không dùng popup làm luồng chuẩn.

Vì app không host trên Firebase Hosting, staging phải dùng transparent reverse proxy:

```text
https://staging.nanohome.vn/__/auth/*
  -> https://temp-nanohome.firebaseapp.com/__/auth/*
```

Sau đó:

- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=staging.nanohome.vn`;
- Firebase Authorized domains chứa `staging.nanohome.vn`;
- OAuth redirect URI chứa chính xác
  `https://staging.nanohome.vn/__/auth/handler`;
- proxy giữ nguyên path, query, response status, headers và cookie semantics; không
  dùng 302 thay cho proxy;
- `browserSessionPersistence` chỉ dùng để sống qua redirect;
- sau server-session exchange phải sign out Firebase browser state.

Production áp dụng cùng pattern với production app domain và production Firebase
project riêng.

### 3.4 Phone OTP

- staging và production chỉ dùng domain HTTPS;
- Phone provider phải enabled;
- SMS region policy phải allow Việt Nam;
- Firebase test phone number/fixed code dùng cho E2E tự động;
- real SMS là một smoke lane riêng, có quota và cost guard;
- staging/production real SMS cần Blaze plan theo Firebase limits hiện hành;
- reCAPTCHA không được bypass ngoài Firebase test-number mechanism;
- số điện thoại chuẩn hóa E.164 trước khi gọi provider;
- OTP thật không xuất hiện trong source, prompt, log hoặc report.

### 3.5 Catalog và AI

AI không phải nguồn sự thật commerce. Model chỉ:

1. hiểu intent;
2. gọi catalog tool;
3. nhận ID ứng viên;
4. server rehydrate product/variant từ canonical catalog;
5. UI render giá, tồn kho, ảnh và URL từ server result.

Model không được tự tạo product card từ prose.

## 4. Topology staging và production

| Thành phần | Staging | Production |
|---|---|---|
| App origin | `https://staging.nanohome.vn` | exact production origin, owner-confirmed |
| Firebase project | `temp-nanohome` | project riêng, không reuse staging |
| Firebase Web App | app staging riêng | app production riêng |
| Supabase | `nanohome-staging` / `xtjmwpeqarmsumjspnyw` | exact production ref, owner-confirmed |
| Google OAuth audience | Testing, dedicated test users | Production/verified branding as required |
| Phone SMS | test number automated; real SMS bounded | real SMS with quota/budget |
| DeepSeek | staging key/budget | production key/budget riêng |
| SePay | Test only | production provider chỉ sau approval riêng |
| Antigravity | staging only | không chạy stateful suite trên production |

Không được dùng cùng Firebase project, service account, DeepSeek key hoặc Supabase
service-role key cho staging và production.

## 5. Service enablement matrix

### 5.1 Firebase staging

| Service/config | Trạng thái yêu cầu |
|---|---|
| Firebase Authentication | enabled |
| Email/Password provider | enabled |
| Google provider | enabled; support email và OAuth test users đã chốt |
| Phone provider | enabled |
| SMS region policy | allow Việt Nam; deny-by-default ngoài vùng kinh doanh |
| Authorized domain | `staging.nanohome.vn` |
| Web app config | project/app/api key khớp `temp-nanohome` |
| Identity Toolkit API | enabled; Firebase browser key allow API này |
| Firebase Admin | ADC hoặc secret-managed credential, đúng project |
| Password-reset template | branding staging, continue URL staging |
| Test phone | ít nhất một fictional number + fixed code, không trùng số thật |
| OAuth consent | Testing; chỉ dedicated test users |
| App Check | monitor-only hoặc off cho Auth closure; không enforce bất ngờ |
| Identity Platform upgrade | chỉ bật nếu cần feature cụ thể và đã duyệt billing |

Không bật Firestore, Realtime Database, Storage, Functions, MFA, tenant hoặc blocking
functions nếu app không dùng. “Bật đủ” nghĩa là bật đủ dependency, không phải bật mọi
sản phẩm Firebase.

### 5.2 Firebase production

Ngoài các mục tương đương staging:

- project production riêng;
- OAuth app name/logo/support email/privacy policy/domain ownership đã duyệt;
- production authorized domain và redirect URI chính xác;
- Phone billing/quota/budget alert đã được owner duyệt;
- production SMS region policy tối thiểu;
- hosted runtime dùng workload identity/secret manager, không dùng JSON key nằm trên
  filesystem của developer;
- email templates và continue URL chỉ về production;
- App Check chỉ chuyển enforce sau monitor window và rollback test.

### 5.3 Supabase staging

- migration ledger khớp repository;
- account/principal/cart/order/payment migrations đầy đủ;
- `catalog_eligibility` tồn tại và public contract đúng;
- `search_public_chat_catalog` tồn tại và chỉ trả projection công khai;
- RLS enabled cho mọi exposed table;
- service-role key chỉ có trên server;
- public catalog grants không mở customer/order data;
- PostgREST schema cache reload sau migration;
- backup/recovery point trước batch apply/import.

### 5.4 DeepSeek staging/production

- API key riêng từng environment;
- base URL canonical `https://api.deepseek.com`;
- model được xác minh qua provider model list trước khi enable;
- staging mặc định `deepseek-v4-flash`;
- tool calls/JSON được validate bằng schema tại server;
- timeout, retry, token ceiling, concurrency và daily cost ceiling rõ ràng;
- không gửi PII, cookie, token, AMIS raw record hoặc customer history chưa consent;
- Vision tiếp tục off.

## 6. Env contract hoàn chỉnh

### 6.1 Public, được build vào browser bundle

| Biến | Staging | Production |
|---|---|---|
| `NEXT_PUBLIC_APP_ORIGIN` | `https://staging.nanohome.vn` | exact production HTTPS origin |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | web key của `temp-nanohome` | production web key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `staging.nanohome.vn` | production app domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `temp-nanohome` | production project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | staging Web App ID | production Web App ID |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | đúng staging project | đúng production project |
| `NEXT_PUBLIC_SUPABASE_URL` | staging Supabase URL | production Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | staging publishable key | production publishable key |
| `NEXT_PUBLIC_MEDIA_URL` | public media origin dùng bởi manifest staging | production media origin |

Mọi `NEXT_PUBLIC_*` được đóng băng tại build time; vì vậy artifact staging không được
promote sang production nếu public config khác.

`NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY` chỉ xuất hiện khi App Check đã được
implement và đang ở monitor mode. Không được dùng việc thiếu biến này làm lý do chặn
Auth trước khi app thật sự khởi tạo App Check.

### 6.2 Server config bắt buộc

| Biến | Giá trị/quy tắc |
|---|---|
| `AUTH_PROVIDER` | `firebase` |
| `ACCOUNT_CENTER_ENABLED` | `true` sau khi migration/account mapping pass |
| `FIREBASE_ADMIN_PROJECT_ID` | phải bằng public Firebase project ID |
| `AUTH_SESSION_TTL_SECONDS` | explicit, 5 phút–14 ngày; đề xuất 432000 |
| `AUTH_CSRF_SECRET` | secret riêng, không fallback sang Supabase key |
| `SUPABASE_PROJECT_REF` | phải khớp hostname trong `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only, đúng environment |
| `CRON_SECRET` | server-only, riêng biệt với CSRF/provider keys |
| `CHAT_ENABLED` | `true` chỉ sau AI preflight |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` staging; production versioned |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
| `PROMPT_VERSION` | version immutable, ví dụ `public-advisor-v3` |

### 6.3 Firebase Admin credential

Chính xác một mode:

- staging connector/local host: `GOOGLE_APPLICATION_CREDENTIALS` trỏ tới file mode
  `600`, ngoài repository; hoặc
- hosted staging/production: workload identity/secret manager;
- không đồng thời khai báo ADC path và private-key env pair;
- schema phải fail startup nếu không có credential mode;
- doctor chỉ in `PRESENT/MISSING`, project ID và credential fingerprint, không in key.

### 6.4 Config bật theo tính năng

AI public advisor chỉ bật khi có đủ:

- `CHAT_ENABLED=true`;
- `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`,
  `PROMPT_VERSION`;
- `NEXT_PUBLIC_MEDIA_URL`;
- catalog manifest và `search_public_chat_catalog` đã pass. Catalog/RPC là data
  dependency, không phải env.

SePay staging chỉ bật khi có đủ:

- `PAYMENT_MODE=sepay_sandbox`;
- `SEPAY_ENV=sandbox`;
- `SEPAY_API_BASE_URL=https://userapi-sandbox.sepay.vn/...`;
- `SEPAY_API_TOKEN`;
- `SEPAY_WEBHOOK_HMAC_SECRET` tối thiểu 32 byte;
- `SEPAY_PAYMENT_METHOD=BANK_TRANSFER`.

Webhook URL, trạng thái Test Mode, account/filter, HMAC tương ứng và callback health
là cấu hình dashboard/evidence, không được giả làm env. Browser success/error/cancel
URL không được quyết định trạng thái paid; chỉ signed IPN/reconciliation server mới
được làm việc đó.

### 6.5 Test-only secrets

Không đặt trong repo, runbook hoặc chat:

- dedicated email test credential;
- Firebase fictional phone/fixed code;
- Google test identity;
- Antigravity fixture reset token;
- SePay Test secret.

Runner nhận alias như `AUTH_EMAIL_VERIFIED`, `AUTH_PHONE_TEST`,
`AUTH_GOOGLE_TEST`; resolver bảo mật cung cấp giá trị trước khi browser run.

### 6.6 Biến vận hành, không phải web-runtime readiness

- `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`, `CF_R2_ENDPOINT`,
  `CF_R2_BUCKET`: chỉ cần cho controlled catalog/media import hoặc sync. Không giữ
  trong long-running web runtime nếu không có upload path;
- Cloudflare tunnel token, tunnel ID, DNS zone/record và SePay webhook URL: nằm trong
  connector/dashboard evidence, không đưa vào `NEXT_PUBLIC_*`;
- Firebase provider enablement, Authorized domains, SMS region policy, OAuth redirect
  URI, fictional test phone/code và email template: là console state, doctor phải đọc
  sanitized evidence thay vì suy luận từ `.env.local`.

### 6.7 Biến phải loại bỏ hoặc hợp nhất

- bỏ `AUTH_PUBLIC_ORIGIN`, chỉ dùng `NEXT_PUBLIC_APP_ORIGIN`;
- bỏ `FIREBASE_SUPABASE_TRUST_ENABLED` khỏi runtime core;
- hoặc implement đầy đủ một typed third-party-auth lane, không giữ dead flag;
- làm cho `AUTH_SESSION_COOKIE_NAME` thực sự được code sử dụng hoặc xóa khỏi schema;
- không dùng `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` để suy luận Auth readiness;
- không có `NEXT_PUBLIC_*` cho service-role, Admin key, OTP, DeepSeek hoặc SePay.
- `VISION_PROVIDER=off`, mọi Vision feature flag `false`, `AMIS_WRITES_ENABLED=false`;
  không khai báo bất kỳ Kakao credential nào trong staging closure.

## 7. `staging:doctor` — gate chặn lỗi dây chuyền

Trước bất kỳ UI test nào, implement một command duy nhất:

```text
pnpm staging:doctor --target staging --json
```

Command chỉ đọc và phải trả một JSON sanitized:

```json
{
  "target": "staging",
  "ready": false,
  "checks": {
    "origin": "PASS",
    "firebaseProjectPair": "PASS",
    "firebasePublicConfig": "PASS",
    "firebaseAdmin": "PASS",
    "coreRuntime": "PASS",
    "catalogMedia": "PASS",
    "googleProvider": "PASS",
    "phoneProvider": "PASS",
    "smsRegion": "PASS",
    "authHelperProxy": "PASS",
    "sessionCookie": "PASS",
    "accountMapping": "FAIL",
    "supabaseLedger": "FAIL",
    "catalogManifest": "FAIL",
    "chatCatalogRpc": "FAIL",
    "deepseek": "BLOCKED_CONFIG",
    "sepayConfig": "BLOCKED_CONFIG",
    "antigravityFixtures": "BLOCKED_CONFIG"
  }
}
```

Doctor phải kiểm tra toàn bộ dependency chain trong một lượt:

1. exact staging hostname/TLS;
2. public Firebase config và Admin project match;
3. provider status;
4. authorized domains, SMS region và OAuth callback;
5. `/__/auth/handler` same-origin proxy;
6. Admin ID-token verification;
7. CSRF/session cookie contract;
8. account principal resolve/provision contract;
9. Supabase migration ledger/schema fingerprint;
10. products/variants/dependencies count;
11. catalog eligibility count và reason-code distribution;
12. public-chat RPC;
13. DeepSeek model/key probe;
14. Antigravity URL permissions và fixture aliases;
15. SePay Test health nếu checkout suite được bật.

Không chạy Antigravity khi `ready=false`. Không sửa từng lỗi bằng cách mở UI thử lại.

## 8. Trình tự thực hiện

### P0 — Freeze và inventory

Thực hiện:

- ghi source SHA/worktree dirty inventory;
- không xóa hoặc overwrite dirty/untracked files;
- chụp tên env + trạng thái `PRESENT/MISSING`, không chụp giá trị;
- chụp Firebase/Supabase project IDs;
- chụp migration ledger và schema fingerprint staging;
- chụp product-count manifest hiện tại;
- chụp staging route/network baseline.

Evidence:

- một sanitized inventory JSON;
- không có secret/PII;
- không có cloud write.

Exit: mọi target exact, không còn từ “current project” mơ hồ.

### P1 — Sửa env schema và runtime invariants

Thực hiện trong một batch:

- bắt buộc exactly-one Admin credential mode;
- bắt buộc explicit `AUTH_CSRF_SECRET`;
- cấm secret reuse;
- bắt buộc app origin HTTPS;
- bắt buộc Firebase public/Admin project match;
- parameterize allowed Supabase host theo target manifest thay vì hard-code staging;
- xử lý hoặc xóa mọi dead flag;
- thêm `staging:doctor`;
- cập nhật `.env.example` chỉ bằng placeholder, không có credential thật.

Tests:

- complete staging config pass;
- thiếu từng dependency trả tất cả lỗi trong cùng một report;
- staging/prod project mismatch fail;
- Supabase staging/prod mismatch fail;
- secret đặt trong `NEXT_PUBLIC_*` fail;
- credential mode zero hoặc two đều fail.

Exit: một command cho biết toàn bộ config gap, không cần chạy UI để phát hiện.

### P2 — Reconcile Supabase migrations trên staging

Trước write:

- backup/recovery point;
- compare local migration inventory với remote ledger;
- schema diff có review;
- xác định dependency order từ empty database;
- chạy complete disposable migration/pgTAP gate;
- gom tất cả migration còn thiếu thành một reviewed staging batch.

Apply:

- chỉ linked exact staging ref;
- apply migration file theo ledger, không paste SQL rời trong dashboard;
- không apply production;
- reload PostgREST schema cache;
- re-run schema fingerprint và full SQL tests.

Phải có sau P2:

- `customer_accounts`;
- `customer_firebase_principals`;
- profile/wishlist/cart/order/payment ownership objects;
- `catalog_eligibility`;
- `search_public_chat_catalog`;
- RLS/grants/functions đúng contract.

Rollback:

- restore staging recovery point hoặc additive down/repair migration đã review;
- không repair ledger bằng đánh dấu giả nếu schema thực tế chưa khớp.

### P3 — Nạp catalog đầy đủ vào staging

Nguồn:

- canonical product/catalog production read-only snapshot;
- AMIS chỉ đọc cho product code, price/stock fields được duyệt;
- CDN/R2 public product assets;
- tuyệt đối không copy customer, contact, order, payment hoặc PII.

Manifest đầu vào:

- snapshot timestamp;
- source project/ref;
- product count;
- variant count;
- brand/designer/category/collection count;
- image/reference count;
- SKU-set checksum;
- policy field coverage;
- missing-field distribution.

Import:

- validate trước khi write;
- transaction hoặc idempotent staged-upsert;
- dependency tables trước, products sau, variants/images sau cùng;
- không tự chuyển `approved/validated=true`;
- giữ hidden/excluded rows trong database;
- regenerate eligibility/search projection;
- không dùng vài fixture làm catalog staging.

Acceptance:

- staging product/variant ID set khớp source manifest;
- duplicate SKU = 0;
- orphan foreign key = 0;
- public list count bằng `storefront=true`;
- AI candidate count bằng `recommendation=true`;
- hidden Moooi policy không xóa nhầm sản phẩm khác;
- image/product URL smoke pass;
- random deterministic sample 20 SKU khớp tên, giá mode, stock policy và URL;
- manifest output không chứa secret hoặc customer data.

### P4 — Hoàn tất Firebase cloud config staging

Theo thứ tự:

1. verify project `temp-nanohome`;
2. verify Web App config;
3. enable Email/Password;
4. enable Google, support email và test-user audience;
5. enable Phone;
6. set SMS region Việt Nam;
7. add Firebase fictional test number/code;
8. add `staging.nanohome.vn` authorized domain;
9. configure OAuth redirect URI;
10. configure `/__/auth/*` same-origin proxy;
11. verify API key restrictions có Identity Toolkit;
12. verify Admin credential;
13. configure reset-email continue URL;
14. nếu cần real SMS, hoàn tất owner billing gate và budget guard trước.

Không đổi production trong P4.

Evidence:

- sanitized config snapshot;
- provider names/status;
- domain/callback list;
- không có key/token/phone/code.

### P5 — Hoàn tất session và account provisioning

Code contract:

- Google redirect chỉ consume khi marker tồn tại;
- Phone reCAPTCHA instance cleanup đúng;
- email/password yêu cầu verified email;
- ID token verify `aud`, `iss`, `sub`, provider, revocation và `auth_time`;
- CSRF independent secret;
- cookie `__Host-`, Secure, HttpOnly, SameSite=Lax, Path=/, no Domain;
- logout clear cookie và revoke theo security policy;
- mọi error map thành mã actionable, không nuốt về một `unknown`.

Account provisioning transaction:

1. verify Firebase session;
2. normalize verified identity;
3. lock theo Firebase UID;
4. lookup active principal;
5. nếu chưa có, tạo `customer_accounts`, profile tối thiểu và principal;
6. không tự link bằng unverified email;
7. verified phone dùng E.164;
8. collision chuyển thành explicit review/error, không merge im lặng;
9. retry cùng UID trả cùng account ID;
10. ghi audit metadata tối thiểu, không PII raw.

Acceptance:

- first Google login tạo/resolve đúng một account;
- repeat Google login không tạo duplicate;
- Phone test OTP tạo/resolve đúng một account;
- email verified login tạo/resolve đúng một account;
- unverified email bị từ chối;
- disabled/deleted/merged principal fail closed;
- `/api/customer/context` trả 200 sau login;
- `/vi/account`, orders, wishlist, cart, offers, preferences và security không 404;
- cross-account read/write bị từ chối.

### P6 — Dọn ranh giới Supabase Auth vs Firebase

Thực hiện:

- source scan mọi `supabase.auth.*`, auth middleware/proxy và legacy route;
- loại legacy login khỏi UI/runtime staging;
- giữ legacy user data trong rollback window, không xóa;
- protected browser code không gọi Supabase bằng Firebase session cookie;
- protected server code luôn lấy account ID từ verified Firebase session;
- service-role DAL phải filter owner trên mọi query/mutation;
- thay generic service-role query bằng narrow repository/RPC khi có thể;
- public catalog RLS không mở private account/order tables.

Nếu direct Firebase JWT → Supabase vẫn cần:

- bật Third-Party Auth đúng `temp-nanohome`;
- set `role: authenticated` bằng cơ chế idempotent;
- refresh ID token sau claim;
- RLS check exact Firebase issuer/audience;
- test token từ Firebase project khác bị reject;
- không dùng `auth.uid()` như UUID cho Firebase UID dạng string.

Exit: architecture report phải ghi đúng một active protected-data path.

### P7 — Hoàn tất grounded AI text chat

Config:

- `CHAT_ENABLED=true`;
- `DEEPSEEK_API_KEY` server-only;
- model/base URL/prompt version explicit;
- provider adapter thực sự dùng env base URL;
- Vision/Kakao remain off.

Runtime:

- input length/rate limit;
- prompt-injection boundary;
- bounded 2–3 tool rounds;
- strict schema validation cho tool arguments;
- catalog RPC only;
- candidate IDs rehydrated server-side;
- product facts không lấy từ model text;
- timeout và retry một lần cho retryable provider errors;
- deterministic fallback search khi provider outage;
- không log raw provider body hoặc user PII;
- cost/usage metrics chỉ giữ aggregate.

Staging prompt acceptance:

1. “Tìm ghế ăn phong cách tối giản” trả product card có thật;
2. prompt theo budget chỉ trả giá có trong catalog;
3. prompt theo brand/room/material trả đúng filters;
4. sản phẩm bị hidden/ineligible không xuất hiện;
5. hỏi SKU không tồn tại không được bịa;
6. mỗi card mở được PDP;
7. price/stock trên card khớp PDP;
8. tiếng Việt/Anh/Hàn không lộ raw JSON;
9. DeepSeek timeout trả fallback, UI không treo;
10. chat không gọi Vision.

### P8 — Build và publish staging

Trước publish:

- clean build;
- typecheck/lint/focused tests;
- full SQL gate;
- sanitized env doctor READY;
- migration/catalog manifest READY;
- rollback artifact/version được ghi.

Publish:

- deploy đúng staging app only;
- inject staging env/secrets;
- keep production untouched;
- verify TLS, DNS/tunnel/origin;
- verify no HMR/dev websocket dependency trên staging;
- run post-deploy doctor.

Exit: staging phải là production-like runtime; không tunnel vào `next dev` để làm bằng
chứng cuối.

### P9 — Provider smoke trên staging

Chạy thủ công có kiểm soát một lần trước Antigravity:

- Email test account login → account;
- Google test user redirect → account;
- Phone fictional test number → account;
- real SMS smoke một lần nếu billing gate đã duyệt;
- reset email tới test inbox;
- logout → route guard;
- expired/revoked cookie → route guard.

Không đưa OTP/password/token vào evidence.

### P10 — Antigravity autonomous UI suite

Chỉ bắt đầu khi `staging:doctor.ready=true`.

Chi tiết ở mục 9.

### P11 — Production readiness

Không copy staging Firebase config sang production.

Phải hoàn tất:

- production Firebase project/Web App;
- Google OAuth production consent/branding/domain;
- production Phone billing/quota/region policy;
- production Supabase ref/schema diff/backup;
- production env matrix và secret store;
- full catalog import strategy;
- production auth helper proxy;
- canary/rollback;
- monitoring và alerts.

### P12 — Production rollout

Chỉ sau owner approval riêng:

1. backup;
2. apply production migrations;
3. import/verify catalog;
4. deploy code với Firebase path canary;
5. test dedicated production smoke account;
6. tăng rollout;
7. monitor auth success/error, session exchange, mapping collision, checkout và AI;
8. giữ legacy rollback window;
9. không xóa Supabase Auth users trong rollout.

## 9. Hợp đồng Antigravity UI test

### 9.1 Browser setup

Antigravity dùng isolated Chrome profile. Trước run:

- Browser tools enabled;
- `read_url` và `execute_url` allow:
  - `staging.nanohome.vn`;
  - `accounts.google.com`;
  - exact Firebase auth helper domain;
  - exact provider hosts cần cho Firebase Auth;
- deny production app/provider domains;
- không cho terminal/source edit;
- không dùng image-generation tool;
- credential không nằm trong prompt/report.

### 9.2 Fixture setup trước run

Phải có sẵn:

| Alias | Trạng thái |
|---|---|
| `AUTH_EMAIL_VERIFIED` | dedicated staging account, verified |
| `AUTH_GOOGLE_TEST` | OAuth test user, session có trong isolated profile |
| `AUTH_PHONE_TEST` | Firebase fictional phone + fixed code |
| `ACCOUNT_EMPTY` | account sạch |
| `ACCOUNT_WITH_CART` | cart deterministic |
| `ACCOUNT_WITH_PENDING_ORDER` | SePay Test pending order |
| `CATALOG_SAMPLE` | deterministic SKU/card set |
| `AI_PROMPT_SET` | public, no PII |

Fixture resolver phải hoàn tất trước agent run. Nếu thiếu, preflight trả
`BLOCKED_FIXTURE`; không mở agent rồi mới hỏi credential.

### 9.3 Hai run thay cho runbook read-only cũ

#### Run A — stateless smoke

- public nav;
- catalog/search/filter/PDP;
- auth form validation;
- security/locale/responsive;
- AI public prompt;
- không mutation.

#### Run B — staging stateful E2E

Được phép mutation **chỉ trong staging fixtures**:

- email login/logout/reset request tới test inbox;
- Google test-user login/logout;
- Firebase test Phone OTP login/logout;
- account/profile test fields;
- wishlist/cart/guest merge;
- checkout;
- SePay Test pending/IPN/idempotency;
- cleanup/reset fixture.

Không được:

- dùng account cá nhân/customer thật;
- gửi SMS thật trong automated run;
- gọi AMIS write;
- dùng production Firebase/SePay;
- thay DNS/cloud config;
- sửa source;
- tạo ảnh.

### 9.4 English execution prompt

Prompt generated phải:

- chỉ định `https://staging.nanohome.vn`;
- yêu cầu `/browser`;
- nêu exact case IDs và thứ tự;
- nói rõ Browser Agent, không phải image generation;
- yêu cầu agent tiếp tục sau một case fail;
- timeout mỗi navigation/action 30 giây;
- retry một lần khi network transient;
- không retry OTP/payment mutation mù;
- ghi một trong:
  `PASS`, `FAIL_PRODUCT`, `BLOCKED_ENV`, `BLOCKED_FIXTURE`,
  `BLOCKED_MANUAL`, `BLOCKED_RATE_LIMIT`;
- redaction token/cookie/OTP/password/PII;
- trả text report với URL, visible assertion, safe method/path/status;
- không nhận “button exists” là login pass.

Login chỉ PASS khi đồng thời:

1. provider hoàn tất;
2. `/api/auth/session` thành công;
3. `/api/customer/context` trả authenticated;
4. account route mở;
5. refresh vẫn giữ session;
6. logout làm route guard hoạt động lại.

### 9.5 Không heartbeat/poll thủ công

Antigravity tự chạy một run đến terminal status. Coordinator không click theo từng
case. Run chỉ dừng khi:

- browser connection mất hoàn toàn;
- phát hiện production/PII/secret;
- unexpected non-fixture mutation;
- permission cần mở rộng ngoài allowlist.

Case lỗi độc lập phải được ghi và tiếp tục.

### 9.6 Chống report “pass ảo”

Mỗi case cần:

- start URL và end URL;
- visible assertion cụ thể;
- network method/path/status đã redacted;
- expected state transition;
- fixture alias;
- cleanup result nếu có mutation.

Tổng số case trong report phải bằng manifest. Thiếu case = run incomplete.

## 10. Test matrix tối thiểu

### Auth

- Google success/cancel/redirect-loop/unauthorized-domain;
- Phone test OTP success/wrong/expired/resend/rate-limit;
- one bounded real SMS smoke;
- email success/wrong/unverified/disabled;
- reset email success/unknown-email-safe response;
- CSRF missing/mismatch;
- ID token wrong issuer/audience/provider/old auth_time/revoked;
- session refresh/logout/revoke;
- unsafe `returnTo` rejection;
- duplicate first-login race;
- merged/disabled/deleted account.

### Supabase/account

- first principal provisioning;
- idempotent repeat;
- cross-account profile/order/cart denial;
- non-UUID Firebase UID;
- public key cannot read private tables;
- service-role never in client bundle/network;
- no protected `auth.uid()` UUID assumption.

### Catalog

- full manifest parity;
- eligibility reason codes;
- search/filter/pagination;
- hidden brand;
- price/stock/image/PDP parity;
- public and AI projection counts;
- no orphan/duplicate.

### AI

- grounded product cards;
- nonexistent SKU;
- hidden/ineligible item;
- multilingual;
- provider 401/429/timeout/5xx;
- malformed tool arguments;
- empty JSON/content;
- cost/time ceiling;
- no Vision call.

### Commerce

- guest cart merge;
- quantity/stock validation;
- checkout owner;
- order idempotency;
- browser return remains pending;
- valid SePay Test IPN marks paid;
- duplicate IPN idempotent;
- invalid signature/amount rejected.

## 11. Production rollback

Rollback phải có trước rollout:

- previous app artifact;
- previous env version;
- Firebase auth feature switch;
- legacy UI login rollback window;
- session-cookie compatibility/clear procedure;
- account principal mappings không bị xóa;
- additive DB repair migration hoặc restore point;
- Google auth helper proxy rollback;
- Phone provider kill switch;
- chat kill switch `CHAT_ENABLED=false`;
- catalog import manifest và prior snapshot;
- SePay production vẫn off cho tới gate riêng.

Trigger rollback:

- auth completion rate giảm;
- session exchange/mapping error tăng;
- cross-account/RLS failure;
- catalog count/checksum drift;
- AI trả product ID không có thật;
- checkout/payment truth regression.

## 12. Definition of Done

Không được dùng câu “done” nếu thiếu bất kỳ mục nào:

- [ ] `staging:doctor` READY;
- [ ] staging build/runtime production-like;
- [ ] Firebase Email, Google, Phone configured;
- [ ] Google redirect cùng origin;
- [ ] Phone test OTP pass;
- [ ] bounded real SMS pass hoặc được ghi owner billing gate rõ ràng;
- [ ] Firebase Admin/session cookie/CSRF pass;
- [ ] first-login account provisioning pass;
- [ ] My Account routes pass;
- [ ] Supabase protected-data architecture chỉ còn một path;
- [ ] full migration/SQL/RLS gate pass;
- [ ] catalog manifest đầy đủ;
- [ ] catalog list/search/PDP pass;
- [ ] chat provider preflight pass;
- [ ] grounded AI product-card prompts pass;
- [ ] cart/checkout/SePay Test pass;
- [ ] Antigravity Run A pass;
- [ ] Antigravity Run B pass;
- [ ] report không thiếu case;
- [ ] production env/service checklist hoàn chỉnh;
- [ ] production rollback rehearsal pass;
- [ ] không secret/PII trong git, log, prompt hoặc artifact;
- [ ] không production write trước approval riêng.

## 13. Nguồn kỹ thuật

Chuẩn bắt buộc:

- [Firebase Web Auth start](https://firebase.google.com/docs/auth/web/start)
- [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [Firebase Phone Auth web](https://firebase.google.com/docs/auth/web/phone-auth)
- [Firebase Auth limits](https://firebase.google.com/docs/auth/limits)
- [Firebase session cookies](https://firebase.google.com/docs/auth/admin/manage-cookies)
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
- [Firebase API-key restrictions](https://firebase.google.com/docs/projects/api-keys)
- [Firebase Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth)
- [Firebase App Check for Web](https://firebase.google.com/docs/app-check/web/recaptcha-provider)
- [Supabase Firebase Auth integration](https://supabase.com/docs/guides/auth/third-party/firebase-auth)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database testing](https://supabase.com/docs/guides/local-development/testing/overview)
- [Supabase environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase seeding](https://supabase.com/docs/guides/local-development/seeding-your-database)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Next.js rewrites](https://nextjs.org/docs/pages/api-reference/config/next-config-js/rewrites)
- [DeepSeek first API call](https://api-docs.deepseek.com/guides/function_calling/)
- [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion)
- [DeepSeek Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)
- [SePay Test Mode webhook](https://developer.sepay.vn/vi/tien-ich-khac/test-mode/tao-webhook)
- [SePay webhook security](https://developer.sepay.vn/en/sepay-webhooks/bao-mat)
- [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/)
- [Cloudflare Tunnel routing](https://developers.cloudflare.com/tunnel/routing/)
- [Antigravity Browser](https://antigravity.google/docs/browser)
- [Antigravity permissions](https://antigravity.google/docs/permissions)
- [Google OAuth app audience](https://support.google.com/cloud/answer/15549945)

Nguồn thực chiến của chính vendor:

- [Supabase: Bring your own Firebase/Auth0/Cognito](https://supabase.com/blog/third-party-auth-mfa-phone-send-hooks)
- [Supabase local development, migrations and test](https://supabase.com/blog/supabase-local-dev)
- [Supabase Branching 2.0](https://supabase.com/blog/branching-2-0)
- [Supabase security hardening](https://supabase.com/blog/hardening-supabase)
- [DeepSeek V4 release notes](https://api-docs.deepseek.com/news/news260424/)
- [Google Developers: build with Antigravity](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)
- [Google Codelab: automated UI testing with Antigravity](https://codelabs.developers.google.com/agentic-ui-automation-with-antigravity)

Docs chính thức quyết định behavior và security. Blog/codelab chỉ bổ sung cách vận
hành thực tế; khi hai nguồn khác nhau, dùng docs hiện hành.
