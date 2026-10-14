# Ecommerce Monolithic API — Prompt 2

REST API thương mại điện tử MVP xây dựng bằng Node.js, Express, Prisma và PostgreSQL theo kiến trúc Monolithic.

## 1. Cấu trúc project Monolithic

Toàn bộ chức năng được triển khai trong **một ứng dụng Express** và chạy như một API service. Các module được chia theo trách nhiệm để dễ quản lý; API cùng truy cập PostgreSQL qua Prisma.

```text
ecommerce-api/
├── src/
│   ├── app.js                  # Khởi tạo Express, middleware, routes, health check
│   ├── config/prisma.js        # Tạo Prisma Client dùng chung
│   ├── routes/                 # Khai báo endpoint và middleware bảo vệ
│   ├── controllers/            # Xử lý request, nghiệp vụ, response
│   └── middlewares/            # Xác thực JWT và phân quyền
├── prisma/
│   ├── schema.prisma           # Khai báo model, quan hệ, datasource
│   ├── migrations/             # Lịch sử tạo/cập nhật cấu trúc database
│   └── seed.js                 # Dữ liệu nền: role, membership
├── scripts/                    # Tiện ích quản trị, ví dụ nâng role ADMIN
├── Dockerfile                  # Đóng gói ứng dụng API
├── docker-compose.yml          # Khởi chạy API và PostgreSQL
├── .env.example                # Mẫu biến môi trường, không chứa secret thật
└── .gitignore                  # Loại .env, node_modules khỏi Git
```

**Cách giải thích khi vấn đáp:** Đây là Monolithic vì các module auth, product, order và shipment nằm trong cùng một ứng dụng Express, cùng được build/chạy như một service. Việc chia `routes`, `controllers`, `middlewares` chỉ giúp mã nguồn có tổ chức; không biến chúng thành các microservice.

## 2. Prisma ORM trong project

- `prisma/schema.prisma` khai báo PostgreSQL, các model `Role`, `MemberShip`, `User`, `Product`, `Order`, `OrderDetail`, `Shipment` và quan hệ giữa chúng.
- `OrderDetail` dùng khóa chính ghép `@@id([oid, pid])`, nên một sản phẩm không bị lặp thành nhiều dòng trong cùng một đơn.
- `prisma/migrations/` chứa SQL migration để tạo các bảng từ schema. Khi chạy Compose, `prisma migrate deploy` áp dụng migration lên PostgreSQL.
- `src/config/prisma.js` tạo Prisma Client; controllers gọi client để truy vấn database mà không phải tự viết SQL cho các thao tác thông thường.
- `prisma/seed.js` tạo role `normal`, `ADMIN` và membership `BASIC` với score `10`.
- `orderController.js` dùng `$transaction`: trừ tồn kho, tạo Order, OrderDetail và Shipment phải cùng thành công; nếu một bước lỗi, transaction rollback.

## 3. `.env`, `.gitignore` và GitHub

`.env` chứa cấu hình thật trên máy, ví dụ mật khẩu PostgreSQL và JWT secret, nên không commit lên GitHub. `.gitignore` loại `.env`, file môi trường khác và `node_modules/` khỏi Git. `.env.example` là mẫu không chứa secret thật và được commit để người khác biết cần khai báo biến nào.

Tạo `.env` từ mẫu:

```bash
node scripts/setup-env.js
```

Script tạo `.env` với mật khẩu PostgreSQL và JWT secret ngẫu nhiên, đồng bộ `DATABASE_URL`. Nếu `.env` đã tồn tại, script giữ nguyên. `.env.example` chỉ mô tả các biến; không dùng trực tiếp các giá trị trống để chạy. Sau khi database đã được tạo, đổi `.env` không tự đổi mật khẩu hoặc username trong database.

Có thể tạo JWT secret ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Chạy và kiểm tra bằng Docker Compose

Yêu cầu: Docker Desktop đang mở và hoạt động.

```bash
docker compose up -d --build --wait
docker compose ps
curl -i http://localhost:3001/health
```

Compose chờ PostgreSQL healthy, chạy Prisma migration, seed dữ liệu nền rồi khởi động API. Health check thành công trả HTTP `200`, `status: healthy`, `database: connected`. Khi PostgreSQL bị dừng, endpoint trả HTTP `503` và `database: disconnected`.

```bash
docker compose stop postgres
curl -i http://localhost:3001/health
docker compose start postgres
curl -i http://localhost:3001/health
```

API chạy tại `http://localhost:3001`.

## 5. Kiểm tra bảng và thêm Product X, Y bằng CLI

Mở psql bên trong container PostgreSQL:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Liệt kê các bảng đã được tạo theo schema:

```sql
\dt
```

Tạo hai sản phẩm X và Y:

```sql
INSERT INTO "Product" ("pname", "price", "quantity")
VALUES ('Product X', 100000, 20), ('Product Y', 200000, 30);
```

Xem mã sản phẩm để dùng trong Postman:

```sql
SELECT "pid", "pname", "price", "quantity" FROM "Product" ORDER BY "pid";
\q
```

## 6. Postman: đăng ký, đăng nhập, token

Đăng ký tài khoản mới:

`POST http://localhost:3001/api/auth/register`

Body → raw → JSON:

```json
{
  "username": "student01",
  "fullname": "Student One",
  "password": "StudentPass123"
}
```

Response phải hiển thị role `normal`, membership `BASIC`, score `10`. Đăng nhập tại:

`POST http://localhost:3001/api/auth/login`

Dùng cùng username/password. Response đăng nhập trả JWT token.

## 7. Postman: kiểm tra token, đặt hàng và Shipment

### Thử khi không có token

Gọi `POST http://localhost:3001/api/orders` với body đặt hàng nhưng chọn Authorization → **No Auth** (hoặc bỏ Bearer token). Kết quả dự kiến: HTTP `401 Unauthorized`.

### Đặt đơn có token

Gọi lại `POST http://localhost:3001/api/orders`, chọn Authorization → **Bearer Token** và dán token vừa nhận. Dùng đúng `pid` của Product X/Y lấy từ CLI:

```json
{
  "items": [
    { "pid": 1, "qty": 2 },
    { "pid": 2, "qty": 5 }
  ]
}
```

Thay `1` và `2` nếu pid thực tế khác. Response thành công phải có Order, hai OrderDetail, thời gian `createat` do database gán theo thời điểm hiện tại và Shipment trạng thái `PENDING`. Xem lại đơn bằng:

- `GET http://localhost:3001/api/orders`
- `GET http://localhost:3001/api/orders/:oid`

Hai endpoint này cũng cần token. Shipment được tạo tự động khi tạo đơn, không gọi `POST /api/shipments` thêm lần nữa cho đơn mới.

### Chuyển Shipment sang đang giao

Endpoint cập nhật Shipment yêu cầu token ADMIN:

`PATCH http://localhost:3001/api/shipments/:shipid/status`

```json
{
  "status": "SHIPPING"
}
```

Các trạng thái được hỗ trợ là `PENDING → SHIPPING → DELIVERED`.

## 8. Kiểm tra dữ liệu sau đặt hàng bằng CLI

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Trong `psql`, kiểm tra Order, OrderDetail, Product (quantity đã giảm) và Shipment:

```sql
SELECT * FROM "Order" ORDER BY "oid" DESC;
SELECT * FROM "OrderDetail" ORDER BY "oid" DESC;
SELECT * FROM "Product" ORDER BY "pid";
SELECT * FROM "Shipment" ORDER BY "shipid" DESC;
\q
```

## 9. Tạo tài khoản ADMIN

Đăng ký tài khoản trước, sau đó chuyển role bằng script:

```bash
docker compose exec api node scripts/promote-admin.js student01
```

Token chứa uid; middleware tra quyền hiện tại trong database. Có thể đăng nhập lại sau khi nâng quyền để kiểm tra response hiển thị ADMIN.

## 10. Lệnh vận hành thường dùng

```bash
docker compose logs --tail=100 api
docker compose stop
docker compose up -d
docker compose up -d --build api
```

PostgreSQL lưu dữ liệu trong volume có tên từ `POSTGRES_VOLUME` (mặc định `ecommerce-api_postgres_data`). Tránh `docker compose down -v` nếu muốn giữ dữ liệu.

## 11. Database URL

- API chạy trực tiếp trên máy: `localhost:5433` trong `DATABASE_URL`.
- API chạy trong Docker Compose: API kết nối PostgreSQL tại `postgres:5432`; Compose tạo URL nội bộ từ các biến PostgreSQL trong `.env`.

## 12. Sửa lỗi P1000 / role postgres không tồn tại (trường hợp của bản cũ)

Đây là volume đã khởi tạo bằng user/mật khẩu khác. Bản cũ dùng `pg_isready`, chỉ kiểm tra server sẵn sàng. Bản sửa dùng `psql SELECT 1` qua TCP với user/password thực để healthcheck xác nhận kết nối database.

**Nếu cần tiếp tục dùng dữ liệu cũ:** khôi phục đúng username/password/database ban đầu vào `.env`, đồng bộ `DATABASE_URL`, chạy `docker compose up -d`. Không đổi volume.

**Nếu muốn một database sạch để chấm bài, vẫn giữ volume cũ:** dùng các file của bản sửa rồi chạy tại thư mục project:

```bash
docker compose down
node scripts/setup-env.js --fresh-db
docker compose up -d --build --wait
docker compose ps
docker compose exec api npx prisma migrate status
curl -i http://localhost:3001/health
```

`--fresh-db` sao lưu `.env` cũ thành `.env.backup.<mã>`, tạo credentials mới và tên volume mới. Tài khoản/sản phẩm/đơn cũ không xuất hiện trong DB mới. Volume cũ không bị xóa; muốn quay lại cần cả cấu hình đúng của DB cũ và tên volume cũ. Không chạy lại `--fresh-db` mỗi lần mở bài.

Lần sau chỉ cần `docker compose up -d --wait`. Nếu không chạy được, dùng `docker compose ps -a` và `docker compose logs --tail=100 api`.

## 13. Kiểm tra tự động bổ sung

```bash
docker compose exec api npm run test:smoke
```

Test tạo một tài khoản, hai sản phẩm và một đơn riêng để kiểm tra: health, role normal/score 10, login, thiếu token 401, tạo đơn X=2/Y=5, Shipment PENDING, quyền xem đơn, tồn kho, rollback khi thiếu hàng. Dữ liệu test được giữ để kiểm tra bằng SQL. Mỗi lần chạy tạo dữ liệu riêng; đây là kiểm tra bổ sung, vẫn trình bày 8 mục CLI/Postman phía trên với giảng viên.

## 14. Cập nhật bản sửa trên Mac

Giữ thư mục repo `~/Documents/ecommerce-api` và `.git` hiện có. Giải nén ZIP vào một thư mục riêng, chép các file của thư mục `ecommerce-api` trong ZIP vào repo (ghi đè file mã nguồn, không xóa repo). Bản ZIP không chứa `.env`, `.git`, node_modules hay dữ liệu database.

Thực hiện mục 12 nếu đang gặp lỗi database cũ. `.dockerignore` ngăn `.env`, bản sao cấu hình và `.git` đi vào Docker image. Nếu cổng 3001 bận, dừng phiên `npm run dev` đang chạy trước khi bật Compose.

## 15. Phạm vi kiểm chứng bản sửa

Xem `KIEM_TRA_BAN_SUA.md` để biết các kiểm tra đã thực hiện và những bước cần chạy trên Docker Desktop của bạn. Chạy được hệ thống chưa tự động chứng minh đạt toàn bộ phiếu chấm; đối chiếu kết quả của từng mục với phiếu chính thức.
