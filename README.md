# Ecommerce Monolithic API — Prompt 2

REST API thương mại điện tử MVP xây dựng theo kiến trúc Monolithic bằng Node.js, Express, Prisma và PostgreSQL.

## 1. Công nghệ và chức năng

- Node.js, Express.js, Prisma ORM 6.19.0 và PostgreSQL 17.
- Đăng ký, đăng nhập bằng JWT; mật khẩu được băm bằng bcryptjs.
- Vai trò tài khoản mới: `normal`; seed tạo thêm vai trò `ADMIN`.
- Hạng mặc định `BASIC` có `score = 10`.
- Quản lý sản phẩm; tạo đơn hàng nhiều sản phẩm và trừ tồn kho trong transaction.
- Khi tạo đơn thành công, hệ thống tạo chi tiết đơn và Shipment trạng thái `PENDING` cùng transaction.
- Health check trả trạng thái kết nối PostgreSQL.

## 2. Cấu hình và chạy bằng Docker Compose

Yêu cầu: Docker Desktop đang mở và hoạt động.

Tạo file cấu hình từ mẫu:

```bash
cp .env.example .env
```

Đổi `POSTGRES_PASSWORD` và `JWT_SECRET` trong `.env`. Nếu đổi mật khẩu PostgreSQL, cập nhật cùng mật khẩu trong `DATABASE_URL`.

Tạo secret ngẫu nhiên bằng Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Khởi động các service:

```bash
docker compose up -d --build
```

Compose sẽ chờ PostgreSQL khỏe, chạy Prisma migration, seed dữ liệu nền rồi khởi động API.

Kiểm tra container và health check:

```bash
docker compose ps
curl -i http://localhost:3001/health
```

Kết quả khỏe mạnh là HTTP `200`, `status: healthy`, `database: connected`. API chạy tại `http://localhost:3001`.

## 3. Kiểm tra PostgreSQL và thêm sản phẩm bằng CLI

Mở PostgreSQL CLI trong container:

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Trong dấu nhắc `psql`, kiểm tra các bảng:

```sql
\dt
```

Thêm hai sản phẩm thử nghiệm:

```sql
INSERT INTO "Product" ("pname", "price", "quantity")
VALUES ('Product X', 100000, 20), ('Product Y', 200000, 30);
```

Xem sản phẩm và thoát:

```sql
SELECT * FROM "Product" ORDER BY "pid";
\q
```

## 4. Luồng Postman: đăng ký, đăng nhập và tạo đơn

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

Đăng ký thành công sẽ gán role `normal` và hạng `BASIC` có score `10`. Đăng nhập tại:

`POST http://localhost:3001/api/auth/login`

Dùng cùng `username` và `password`; lấy token trong response. Với API cần đăng nhập, chọn **Authorization → Bearer Token** trong Postman và dán token.

Tạo đơn tại `POST http://localhost:3001/api/orders`. Body gồm hai mã sản phẩm và số lượng, ví dụ:

```json
{
  "items": [
    { "pid": 1, "qty": 2 },
    { "pid": 2, "qty": 5 }
  ]
}
```

Dùng `pid` thực tế đang có trong bảng Product. Đơn thành công trả về Order, OrderDetail và Shipment có trạng thái `PENDING`. Xem đơn tại `GET /api/orders` hoặc `GET /api/orders/:oid`.

## 5. Shipment và phân quyền ADMIN

Shipment được tạo tự động khi tạo đơn; không cần gọi `POST /api/shipments` cho đơn mới. Endpoint này chỉ dùng khi cần tạo thủ công cho đơn cũ chưa có Shipment; API từ chối nếu đơn đã có Shipment.

Để chuyển Shipment sang giao hàng, tài khoản ADMIN gọi:

`PATCH http://localhost:3001/api/shipments/:shipid/status`

Body:

```json
{
  "status": "SHIPPING"
}
```

Chuyển tiếp trạng thái dùng `DELIVERED`. Các endpoint Shipment yêu cầu token ADMIN.

Để tạo tài khoản ADMIN, đăng ký tài khoản trước, sau đó chạy:

```bash
docker compose exec api node scripts/promote-admin.js student01
```

Đăng nhập lại tài khoản đó để lấy token mới có quyền ADMIN.

## 6. Kiểm tra dữ liệu đơn hàng bằng CLI

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Trong `psql`, kiểm tra Order, OrderDetail, Product và Shipment:

```sql
SELECT * FROM "Order" ORDER BY "oid" DESC;
SELECT * FROM "OrderDetail" ORDER BY "oid" DESC;
SELECT * FROM "Product" ORDER BY "pid";
SELECT * FROM "Shipment" ORDER BY "shipid" DESC;
\q
```

## 7. Health check khi database dừng

```bash
docker compose stop postgres
curl -i http://localhost:3001/health
docker compose start postgres
curl -i http://localhost:3001/health
```

Khi database dừng, health endpoint trả HTTP `503` và `database: disconnected`; sau khi PostgreSQL chạy lại, endpoint trả HTTP `200` và `database: connected`.

## 8. Lệnh vận hành thường dùng

```bash
docker compose logs --tail=100 api
docker compose stop
docker compose up -d
docker compose up -d --build api
```

Dữ liệu PostgreSQL được lưu trong volume `postgres_data`. Tránh `docker compose down -v` nếu muốn giữ dữ liệu.

## 9. Cấu hình database

- API chạy trực tiếp trên máy: dùng `localhost:5433` trong `DATABASE_URL`.
- API chạy trong Compose: container API kết nối `postgres:5432`; Compose tự thiết lập URL nội bộ.
- `.env` chứa cấu hình thật và đã được Git bỏ qua. `.env.example` chỉ chứa giá trị mẫu, không chứa mật khẩu thật.
