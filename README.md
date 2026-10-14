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
cp .env.example .env
```

Trong `.env`, đổi `POSTGRES_PASSWORD` và `JWT_SECRET`. Nếu đổi mật khẩu, cập nhật mật khẩu trong `DATABASE_URL` cho trùng khớp.

Có thể tạo JWT secret ngẫu nhiên:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Chạy và kiểm tra bằng Docker Compose

Yêu cầu: Docker Desktop đang mở và hoạt động.

```bash
docker compose up -d --build
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

Đăng nhập lại để nhận token mới có role ADMIN.

## 10. Lệnh vận hành thường dùng

```bash
docker compose logs --tail=100 api
docker compose stop
docker compose up -d
docker compose up -d --build api
```

PostgreSQL lưu dữ liệu trong volume `postgres_data`. Tránh `docker compose down -v` nếu muốn giữ dữ liệu.

## 11. Database URL

- API chạy trực tiếp trên máy: `localhost:5433` trong `DATABASE_URL`.
- API chạy trong Docker Compose: API kết nối PostgreSQL tại `postgres:5432`; Compose tạo URL nội bộ từ các biến PostgreSQL trong `.env`.
