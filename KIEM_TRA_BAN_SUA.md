# Kiểm tra bản sửa

## Đã thực hiện trong môi trường chỉnh sửa
- npm ci --ignore-scripts: cài đủ dependencies theo lockfile thành công.
- npm test: đạt kiểm tra sinh credentials, URL đồng bộ, không ghi đè cấu hình mặc định, sao lưu và chọn volume riêng khi dùng --fresh-db; không in secrets.
- node --check: 17 file JavaScript hợp lệ.
- sh -n scripts/start-container.sh: hợp lệ.
- docker-compose.yml: parse YAML hợp lệ (chưa phải docker compose config).
- node scripts/check-env.js: đạt với .env sinh tự động.
- prisma validate: schema hợp lệ.
- prisma generate: sinh Prisma Client 6.19.0 thành công.

## Chưa chạy tại đây
Môi trường chỉnh sửa không có Docker/PostgreSQL. Chưa chạy build Docker, migration trên DB thật, healthcheck hay test HTTP/Postman. Cần kiểm tra trên máy bạn:

```bash
docker compose up -d --build --wait
docker compose exec api npx prisma migrate status
curl -i http://localhost:3001/health
docker compose exec api npm run test:smoke
```

Smoke test tạo hai tài khoản, hai sản phẩm và một đơn riêng, giữ dữ liệu để kiểm tra. Không dùng kết quả kiểm tra cú pháp thay cho kết quả chạy 8 mục phiếu chấm.

## Các thay đổi
- Bổ sung .dockerignore để loại .env/.git/node_modules khỏi image.
- Tạo .env bằng crypto, có quyền file 600; không lưu secret thật trong bản ZIP.
- Tùy chọn --fresh-db sao lưu .env và chọn volume mới, giữ nguyên volume cũ. Đây là khởi tạo DB trống, không phải khôi phục dữ liệu cũ.
- Compose báo thiếu biến cấu hình sớm; healthcheck PostgreSQL dùng truy vấn SELECT 1 với credentials thật.
- Startup kiểm tra cấu hình JWT/database, áp dụng migration và seed trước khi mở API; hướng dẫn rõ khi lỗi credentials.
- JSON sai cú pháp trả HTTP 400 JSON; body quá lớn trả 413 JSON.
- Bổ sung smoke test cho đăng ký/login/quyền/order/shipment/stock/rollback.
- README cập nhật quy trình sửa lỗi và phân biệt địa chỉ DB khi chạy trên Mac và trong container.
- Schema và migration gốc được giữ nguyên; dữ liệu đăng ký vẫn role normal, BASIC score 10.
