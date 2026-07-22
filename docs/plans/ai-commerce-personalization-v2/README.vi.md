# Hướng dẫn tổng quan tiếng Việt — nanoHome AI Commerce v2

Trạng thái: chỉ lập kế hoạch, chưa triển khai code và chưa tạo worktree mới

Ngày chốt kiến trúc: 2026-07-20

Tài liệu kỹ thuật gốc: [README.md](./README.md)

## Kết luận ngắn

Trong giai đoạn hiện tại, nanoHome nên tiếp tục dùng **Next.js + Supabase + AMIS + ZaloPay**, không thêm Medusa, Vendure, Saleor hay một commerce platform khác.

**ZaloPay là gateway online duy nhất trong kế hoạch.** Không triển khai gateway khác hoặc màn hình chọn gateway.

Lý do chính:

- sản phẩm premium, số lượng tồn rất ít;
- đơn online trả tiền chưa nhiều;
- hàng online và offline dùng chung tồn kho vật lý trong AMIS;
- chấp nhận trường hợp hiếm phải hủy/hoàn tiền thủ công;
- Supabase hiện đã đủ để quản lý cart, online order, payment audit và các soft hold ngắn;
- thêm commerce platform vẫn không ngăn được nhân viên bán món hàng đó offline trong AMIS nếu không có API giữ tồn kho nguyên tử;
- thêm platform lúc này tạo thêm một nguồn dữ liệu và một màn hình vận hành cần đồng bộ.

Kiến trúc đề xuất:

| Phần | Hệ thống chịu trách nhiệm |
| --- | --- |
| Nội dung sản phẩm, brand, designer, hình ảnh, website visibility | Supabase |
| Giá và tồn kho vật lý | AMIS; đồng bộ để hiển thị và kiểm tra live lúc thanh toán |
| Cart và online order | Supabase |
| Sale Order vận hành, bán offline, fulfillment | AMIS |
| Kết quả thanh toán và hoàn tiền online | ZaloPay |
| Log/idempotency/reconciliation/refund case | Supabase |
| Khách hàng, contact, lịch sử mua offline | AMIS |
| Customer memory an toàn cho website | Projection tối thiểu trong Supabase |
| Chat text và giải thích | DeepSeek |
| Đọc ảnh phòng | Vision provider riêng |
| Tìm ảnh sản phẩm gần giống | Image embedding model + pgvector |
| Xếp hạng sản phẩm | Recommendation service của nanoHome |

## 1. Cart, order, AMIS và payment

### Cart

Cart chuẩn nằm trong Supabase. Local storage chỉ dùng để UI phản hồi nhanh, không phải nguồn sự thật.

Server phải quản lý:

- guest cart bằng token ngẫu nhiên HttpOnly;
- cart của tài khoản đăng nhập;
- merge guest cart sau khi đăng nhập;
- chọn một phần cart để checkout;
- version/optimistic concurrency;
- kiểm tra lại SKU, giá, visibility và commercial mode ở mỗi mutation quan trọng.

Client không được quyết định giá, tồn kho hay tổng tiền.

### Online order

Supabase tạo `WEB-*` order number cố định trước khi gọi hệ thống ngoài. Một idempotency key chỉ được tạo một online order. Order snapshot giữ nguyên SKU, tên, giá, số lượng, thông tin giao hàng và attribution tại thời điểm checkout.

Không gom mọi thứ vào một status. Phải tách:

- business order status;
- inventory status;
- AMIS export status;
- payment status;
- refund status.

Nhờ vậy có thể phân biệt “đã trả tiền nhưng đang chờ xác nhận tồn”, “AMIS request chưa rõ có thành công”, và “đã yêu cầu hoàn tiền nhưng tiền chưa về”.

### Kiểm tra tồn ngay

Trước payment:

1. server đọc lại cart và giá hiện tại;
2. gọi AMIS để lấy tồn kho của đúng kho fulfillment đã chọn;
3. join bằng **raw SKU chính xác**, không normalize hoặc đoán theo tên;
4. nếu SKU thiếu, trùng, malformed, stale hoặc không đủ: không cho paid checkout;
5. ghi snapshot kiểm tra tồn vào Supabase;
6. tạo soft hold ngắn trong Supabase để hai khách online không cùng checkout một món.

Soft hold chỉ chống online-vs-online. Nó không khóa được nhân viên đang bán offline trong AMIS. Đây là giới hạn không thể che giấu.

### Gọi API tạo đơn trên AMIS

Có, nên gọi AMIS để tạo Sale Order draft, nhưng chỉ qua một adapter rất hẹp:

- chỉ cho `POST /api/v2/SaleOrders`;
- dùng cùng `WEB-*` order number;
- mỗi line dùng raw SKU chính xác;
- dùng đúng kho, unit, tax, customer/employee/layout đã test trên tenant;
- nếu timeout thì tra lại bằng order code, không POST mù lần nữa;
- không mở generic POST/PUT/PATCH/DELETE cho AMIS;
- không tự tạo/sửa Customer, Contact, note hoặc thẻ tư vấn.

Phải test trong tenant thật xem Sale Order ở trạng thái draft có trừ/giữ tồn hay không. Không được mặc định rằng tạo draft đồng nghĩa reserve hàng.

### Workflow ZaloPay duy nhất

ZaloPay v2 được triển khai theo flow **thanh toán ngay**:

```text
check tồn live
-> tạo Supabase order + soft hold
-> tạo/reconcile AMIS draft
-> tạo ZaloPay order có app_trans_id riêng
-> khách thanh toán trên ZaloPay
-> callback hợp lệ sau khi kiểm tra HMAC bằng Key2
-> recheck/xác nhận hàng
-> confirm order
```

Redirect về website chỉ để hiển thị trạng thái, không chứng minh đã trả tiền. Nếu chưa nhận callback, hệ thống phải gọi ZaloPay `/v2/query` bằng đúng `app_trans_id`; không được tạo payment attempt mới một cách mù quáng.

Nếu khách đóng trang hoặc rời luồng thanh toán, không được lập tức coi là hủy: query ZaloPay trước, chỉ release soft hold khi giao dịch đã được xác định chắc chắn là chưa thanh toán hoặc đã hết hạn. Vì v1 không tự động sửa/xóa AMIS Sale Order, các `WEB-*` draft chưa thanh toán phải vào exception queue để nhân viên xử lý theo SLA; không để draft treo âm thầm.

Nếu đúng lúc đó hàng đã bán offline:

```text
stock_conflict
-> refund_pending
-> gọi ZaloPay /v2/refund
-> query /v2/query_refund đến trạng thái cuối
-> nếu API fail/quá SLA: manual_refund_required
-> ghi m_refund_id hoặc chứng từ/người xử lý/thời hạn
-> chỉ đổi thành refunded khi đã xác minh tiền
```

Các phương thức hiển thị bên trong cổng ZaloPay—ví, tài khoản ngân hàng, ATM/thẻ hoặc VietQR nếu merchant account được bật—vẫn là một integration ZaloPay. nanoHome không tích hợp trực tiếp từng mạng thanh toán.

Với sản phẩm premium, đơn ít và chấp nhận manual refund hiếm, flow này hợp lý nếu có exception queue và SLA rõ. Trước production phải test sandbox đầy đủ: create, callback, query, full refund, query-refund, transaction limit, settlement và một refund drill thật.

Chi tiết: [02-commerce-payment-amis.md](./02-commerce-payment-amis.md)

## 2. Khách hàng, Contact, thẻ tư vấn và note từ AMIS

Public AMIS CRM Connect v2 hiện có các API đọc Customers, Contacts và SaleOrders. Giao diện AMIS có call, meeting, task, note và `Thẻ tư vấn`, nhưng các object này không xuất hiện trong public OpenAPI đã kiểm tra.

Vì vậy không nên giả định có thể query toàn bộ trao đổi. Các option đúng là:

1. xin MISA cấp API/webhook riêng có tài liệu;
2. dùng custom field trên Customer/Contact nếu tenant thực sự trả về field đó;
3. tạo “AI-safe customer brief” do nhân viên duyệt;
4. import định kỳ có kiểm soát trong giai đoạn tạm;
5. nếu không có cách an toàn, chatbot chỉ handoff để nhân viên mở lịch sử trong AMIS.

`AI-safe customer brief` nên chỉ có:

- phòng/dự án đang quan tâm;
- brand/designer ưa thích;
- các canonical SKU/product đã trao đổi;
- budget band nếu khách chủ động cung cấp cho mục đích tư vấn;
- project stage;
- cách liên hệ mong muốn;
- một tóm tắt ngắn được phép hiển thị lại cho khách;
- người duyệt và ngày review/expire.

Không copy raw note, email, call transcript, attachment, địa chỉ riêng, giấy tờ, bank/debt, nhận xét nội bộ hoặc full Customer object vào AI.

Website account chỉ được link với AMIS Customer/Contact sau khi xác minh hoặc nhân viên chọn chính xác. Không fuzzy match bằng tên, email hoặc số điện thoại.

Ba scope phải tách riêng:

- public assistant: không CRM;
- authenticated concierge: chỉ memory của chính khách đã link;
- staff assistant sau này: sản phẩm nội bộ riêng, RBAC/audit/prompt riêng.

Chi tiết: [03-amis-customer-memory.md](./03-amis-customer-memory.md)

## 3. DeepSeek chatbot và câu trả lời có hình

DeepSeek hosted API dùng text; không nên gửi ảnh phòng cho DeepSeek. Tuy vậy chatbot vẫn có thể trả câu trả lời “có visual”:

- product cards;
- gallery ảnh canonical;
- bảng so sánh;
- recommendation rail;
- link đến trang sản phẩm/brand/designer/policy;
- room summary đã được vision provider phân tích;
- nút handoff cho nhân viên.

DeepSeek chỉ chọn tool và soạn giải thích. Server quyết định quyền, gọi dữ liệu, validate ID và render card. Giá, tồn kho, URL và ảnh luôn lấy lại từ record canonical; model không được tự viết các giá trị này.

Chia knowledge thành hai nhóm:

- live tools cho sản phẩm, giá, tồn, order, recommendation, room scene, customer memory;
- RAG corpus được duyệt cho nội dung website, brand/designer, vật liệu, hướng dẫn chăm sóc, chính sách và editorial.

Chatbot phải từ chối/handoff khi thiếu kích thước thật, không biết delivery date/discount, câu hỏi an toàn/pháp lý, dữ liệu CRM nội bộ hoặc yêu cầu thay đổi cart/order/payment.

Chi tiết: [04-grounded-visual-chatbot.md](./04-grounded-visual-chatbot.md)

## 4. DeepSeek có nhìn ảnh phòng không?

Không qua hosted chat API trong kiến trúc này. Cần provider vision riêng:

```text
ảnh phòng private
-> strip EXIF + normalize
-> vision provider
-> RoomScene có confidence/uncertainty
-> khách xác nhận/sửa và nhập số đo
-> recommender lọc/xếp hạng catalog
-> DeepSeek giải thích bằng text
```

Ảnh dùng Supabase Storage private, signed URL ngắn, consent riêng và thời hạn xóa. Không suy ra kích thước chính xác từ một ảnh. Nếu fit/đường vận chuyển quan trọng, phải hỏi khách tự đo.

Chi tiết: [06-vision-intelligence.md](./06-vision-intelligence.md)

## 5. Tìm sản phẩm có visual gần giống

Có thể làm bằng image embedding:

1. tạo embedding offline cho từng ảnh sản phẩm canonical;
2. lưu vector cùng image hash, model, version và dimensions;
3. khi khách chọn/crop một vật thể, tạo query embedding bằng cùng model;
4. tìm nearest neighbors bằng `pgvector`;
5. lọc lại category, material, kích thước, giá, visibility và stock;
6. dedupe/diversify rồi trả canonical variant IDs;
7. DeepSeek chỉ giải thích vì sao giống.

Không dùng whole-room embedding so trực tiếp với ảnh ghế rồi gọi đó là “hợp phòng”. Room fit và visual similarity là hai bài toán khác nhau.

## 6. Recommendation system

Thứ tự nên làm:

1. merchandiser pin/ban/boost;
2. catalog similarity: category, room, designer, brand, collection, style, material, color, price band;
3. complementary-category rules;
4. text embedding nếu benchmark tốt hơn baseline;
5. visual similarity từ vision worktree;
6. behavior/customer affinity sau khi event đủ tin cậy;
7. learning-to-rank chỉ khi có đủ traffic và experiment data.

Mỗi kết quả phải có reason code thật như `same_collection`, `similar_material`, `complements_current_item`, `visually_similar`, `matches_explicit_preference`. Tất cả candidate phải qua chung một eligibility filter.

Chi tiết: [05-product-recommendations.md](./05-product-recommendations.md)

## 7. Personalization

Triển khai theo tầng:

1. curated default cho mọi người;
2. recently viewed/continue shopping trong session;
3. preference khách tự chọn: room, category, style, material, brand, designer, budget;
4. customer memory đã xác minh từ AMIS;
5. room project/scene do khách xác nhận;
6. behavior affinity có consent và đủ support;
7. experiment/adaptive ranking sau này.

Khách phải xem/sửa/reset/disconnect được các preference quan trọng. Logout hoặc đổi account không được lộ module đã cache của khách trước. Raw event, raw CRM note và room photo không được đưa vào personalization decision log.

Chi tiết: [07-customer-personalization.md](./07-customer-personalization.md)

## 8. Có thể chạy nhiều worktree song song không?

Có, nhưng không tạo tất cả ngay từ `main` hiện tại.

Thứ tự an toàn:

```text
Plan 00: reconcile database + freeze contract + commit base
-> Plan 01: identity/consent/events/capability foundation
-> ghi FOUNDATION_SHA
-> chạy song song 5 worktree:
   02 commerce/payment/AMIS
   03 AMIS customer memory
   04 chatbot
   05 recommendations
   06 vision
-> 07 personalization sau khi contract của 03 và 05 ổn định
-> 08 integration chạy serial cuối cùng
```

Mỗi worktree phải:

- branch từ cùng SHA dependency;
- dùng migration range riêng;
- có namespace/file ownership riêng;
- không cùng sửa generated DB types, env schema, translations, global providers, lockfile hoặc schedules;
- giao một handoff manifest cho integration;
- có `.env`, port, local database/queue và build output tách biệt.

Hiện chưa nên tạo worktree vì repo đang có `docs/` và `outputs/` untracked, `main` ahead remote, và migration prefix bị trùng. Plan 00 phải xử lý/ghi nhận các vấn đề này trước.

Lệnh mẫu và merge/rollout đầy đủ: [08-integration-rollout.md](./08-integration-rollout.md)

## 9. Thứ tự triển khai thực tế đề xuất

Không cần bật toàn bộ cùng lúc:

1. database baseline + consent/identity;
2. deterministic recommendations trên PDP;
3. public grounded chatbot;
4. server cart/order ledger và AMIS stock shadow;
5. explicit preferences/recently viewed;
6. AMIS customer memory cho vài account đã review;
7. room-photo internal test rồi opt-in beta;
8. AMIS Sale Order export canary với ZaloPay off;
9. ZaloPay sandbox: create/callback/query/refund/query-refund và refund drill;
10. paid SKU canary rất nhỏ;
11. behavior signals khi event đủ dữ liệu.

Đây là thứ tự rollout theo rủi ro; thứ tự merge kỹ thuật nằm trong Plan 08.

## 10. Khi nào mới nên cân nhắc Medusa/Vendure/Saleor?

Đánh giá lại khi có bằng chứng:

- order volume/ops không còn phù hợp với workflow nhỏ;
- promotion, gift card, tax/shipping phức tạp, subscription hoặc multi-currency trở thành core;
- cần RMA/return automation;
- nhiều online channel cần một commerce admin;
- AMIS có API reserve/event nguyên tử hoặc doanh nghiệp quyết định chuyển inventory authority;
- đội dev đang phải xây lặp lại quá nhiều chức năng commerce platform đã có.

Khi đó phải quyết định rõ platform nào là authority. Không nên thêm một hệ thống chỉ để trở thành bản copy cart/order thứ ba.

## Danh sách plan

- [00-program-base-and-contracts.md](./00-program-base-and-contracts.md)
- [01-customer-data-foundation.md](./01-customer-data-foundation.md)
- [02-commerce-payment-amis.md](./02-commerce-payment-amis.md)
- [03-amis-customer-memory.md](./03-amis-customer-memory.md)
- [04-grounded-visual-chatbot.md](./04-grounded-visual-chatbot.md)
- [05-product-recommendations.md](./05-product-recommendations.md)
- [06-vision-intelligence.md](./06-vision-intelligence.md)
- [07-customer-personalization.md](./07-customer-personalization.md)
- [08-integration-rollout.md](./08-integration-rollout.md)
