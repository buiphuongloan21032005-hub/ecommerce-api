# Demo Prompt 2 theo 8 mục chấm

## Chuẩn bị trên Mac
Mở Docker Desktop. Giải nén vào thư mục riêng; nếu cập nhật repo cũ thì chép mã nguồn vào, giữ .git và .env đang dùng. Mở Terminal tại thư mục có docker-compose.yml.

```bash
node scripts/setup-env.js
docker compose up -d --build --wait
docker compose ps
curl -i http://localhost:3001/health
docker compose exec api npx prisma migrate status
```

Không dùng --fresh-db mỗi lần; không cần xóa volume để thêm discount. Khi lỗi, xem docker compose ps -a và docker compose logs --tail=100 api postgres.

## 1. Cấu trúc Monolithic
Mở src/app.js và các thư mục routes, controllers, middlewares. Nói: Các module auth/product/order/shipment nằm trong cùng một ứng dụng Express, cùng triển khai và dùng chung PostgreSQL qua Prisma. Hai container API và database không đồng nghĩa hai microservice nghiệp vụ.

## 2. Gitignore và env trên GitHub
Mở .gitignore và .env.example. .env chứa cấu hình thực tế, không đưa lên GitHub. .env.example mô tả biến cần khai báo. Kiểm tra:

```bash
git ls-files .env
git check-ignore .env
git ls-files .env.example
git status --short
```

Lệnh đầu không hiện gì; lệnh hai hiện .env; lệnh ba hiện .env.example. Trước thi commit/push các file mã nguồn và tài liệu đã thay đổi lên đúng repo của bạn.

## 3. Prisma ORM
Mở prisma/schema.prisma, prisma/migrations, src/config/prisma.js, prisma/seed.js và orderController.js. Schema có 7 bảng; OrderDetail có khóa ghép oid/pid. Migration mới thêm discount, giữ dữ liệu cũ. Prisma Client cung cấp thao tác database. Transaction bảo đảm đặt hàng và trừ tồn kho cùng thành công hoặc cùng rollback.

## 4. Compose và health check
Chạy các lệnh chuẩn bị ở đầu. api và postgres phải healthy; HTTP 200 và database connected; migration đã cập nhật. Có thể dùng docker ps để liệt kê thêm các container đang chạy.

## 5. PostgreSQL CLI và tạo X/Y

```bash
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Trong psql:

```sql
\dt
\d "Order"
INSERT INTO "Product" ("pname", "price", "quantity")
VALUES ('Product X',100000,20),('Product Y',200000,30) RETURNING *;
\q
```

Ghi đúng pid của X và Y vừa tạo. Bảng _prisma_migrations là bảng kỹ thuật ngoài 7 bảng nghiệp vụ.

## 6. Postman đăng ký và đăng nhập
Import postman/Prompt2.postman_collection.json. Sửa collection variables username thành tên mới, pidX/pidY theo CLI. Chạy request 1: register trả 201, role normal và score 10. Chạy request 2: login trả 200, token hiển thị trong response và tự lưu vào collection variable token. Mật khẩu demo ít nhất 8 ký tự.

## 7. Đặt hàng và Shipment
Chạy request 3 (không token) phải trả 401. Request 4 (có token) trả 201, X mua 2, Y mua 5; response có createat, discount, 2 orderDetails, 1 shipment PENDING. oid tự lưu từ response. Chạy request 5 để xem đơn cùng chi tiết và shipment. Không cần tạo shipment thủ công, không cần tài khoản ADMIN cho luồng này. createat có thể hiện UTC, chênh giờ Việt Nam 7 tiếng.

## 8. Kiểm tra sau đặt hàng bằng CLI
Vào lại psql như mục 5; thay 123 bằng oid, 11 và 12 bằng pid thực tế:

```sql
SELECT * FROM "Order" WHERE "oid"=123;
SELECT * FROM "OrderDetail" WHERE "oid"=123;
SELECT * FROM "Product" WHERE "pid" IN (11,12);
SELECT * FROM "Shipment" WHERE "oid"=123;
\q
```

Sau một lần đặt thành công: X từ 20 còn 18, Y từ 30 còn 25. OrderDetail có đúng qty 2/5; Shipment có cùng oid và trạng thái PENDING. Discount mặc định 0 khi chưa khai báo chính sách; xem README mục 16 để cấu hình ngưỡng score và phần trăm. Không giả định score 10 đương nhiên là giảm 10%.

## Kiểm tra trước thi

```bash
docker compose exec api npm test
docker compose exec api npm run test:smoke
```

Smoke test tạo dữ liệu riêng và giữ lại, nên pid không nhất thiết bắt đầu từ 1/2. Test tự động bổ sung, buổi thi vẫn thao tác CLI/Postman theo phiếu.
