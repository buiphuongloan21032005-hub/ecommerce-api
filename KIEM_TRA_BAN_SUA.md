# Kiểm chứng bản bổ sung Prompt 2 (18/10/2026)

Đã chạy thành công:
- npm ci --ignore-scripts: cài dependencies theo lockfile.
- prisma generate: Prisma Client 6.19.0.
- prisma validate: schema có discount và createat hợp lệ.
- npm test: 3 test đạt (cấu hình, ngưỡng discount, làm tròn và dữ liệu sai).
- node --check: 17 file mã nguồn JavaScript hợp lệ.
- sh -n scripts/start-container.sh: hợp lệ.

Chưa có Docker/PostgreSQL trong môi trường chỉnh sửa: chưa chạy Docker build, migration trên DB thật, API end-to-end hoặc Postman. Không dùng test đơn vị để khẳng định đã đạt cả 8 mục.

Chạy trên Mac trước thi:
```bash
node scripts/setup-env.js
docker compose up -d --build --wait
docker compose ps
curl -i http://localhost:3001/health
docker compose exec api npx prisma migrate status
docker compose exec api npm test
docker compose exec api npm run test:smoke
```

Smoke test đã bổ sung đối chiếu discount trong response và DB. Test này tạo dữ liệu riêng, không dọn các bản ghi sau khi chạy. Sau đó thực hiện từng mục trong THI_PROMPT2.md.

Bản bổ sung: schema/migration discount; chính sách score cấu hình qua DISCOUNT_POLICY; mặc định không giảm khi chưa có chính sách; tính tiền bằng Decimal; Postman collection tự lưu token/oid. Không mang các yêu cầu kiến trúc Microservices (Kafka, Redis...) vào Prompt 2.
