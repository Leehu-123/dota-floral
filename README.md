# 🌸 Dota Floral - Phần Mềm Quản Lý Tiệm Hoa Handmade

Hệ thống quản lý bán hàng, tồn kho nguyên vật liệu, tính giá vốn và công thức bó hoa handmade chuyên dụng cho **Dota Floral** (Bắc Hà, Lào Cai). 

Ứng dụng được thiết kế theo triết lý **Mobile-First** (tối ưu trải nghiệm sử dụng trên màn hình điện thoại 360-430px), đơn giản, nhanh chóng (nhập đơn dưới 30 giây), giao diện thân thiện, sử dụng chung đồng bộ cho 2 vợ chồng chủ tiệm.

---

## 📋 Mục lục
1. [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
2. [Cấu hình VPS đề xuất](#-cấu-hình-vps-đề-xuất)
3. [Tài khoản đăng nhập mặc định](#-tài-khoản-đăng-nhập-mặc-định)
4. [Hướng dẫn chạy thử trên máy tính (Local)](#-hướng-dẫn-chạy-thử-trên-máy-tính-local)
5. [Hướng dẫn cài đặt PWA lên điện thoại](#-hướng-dẫn-cài-đặt-pwa-lên-điện-thoại)
6. [Hướng dẫn triển khai Production trên VPS (Docker + Caddy HTTPS)](#-hướng-dẫn-triển-khai-production-trên-vps)
7. [Sao lưu & Khôi phục Database](#-sao-lưu--khôi-phục-database)
8. [Kiểm thử nghiệp vụ tự động](#-kiểm-thử-nghiệp-vụ-tự-động)

---

## 🛠 Công nghệ sử dụng

- **Frontend & Backend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui.
- **Cơ sở dữ liệu**: PostgreSQL 16 + Prisma ORM.
- **Xác thực**: NextAuth.js (Session JWT, mã hóa bcrypt).
- **Ứng dụng di động**: PWA (Progressive Web App) với Service Worker & Web App Manifest.
- **Reverse Proxy**: Caddy Server (Tự động cấp chứng chỉ SSL Let's Encrypt HTTPS miễn phí).
- **Lưu trữ ảnh đám mây**: Cloudflare R2 (S3-compatible, không tốn dung lượng ổ đĩa VPS).

---

## 🖥 Cấu hình VPS đề xuất

Do quy mô tiệm hoa gia đình (2 người dùng đồng thời, lượng truy cập nội bộ), ứng dụng rất nhẹ và tối ưu nhờ container Next.js Standalone.

### 1. Gói khuyến nghị tốt nhất (Ngon - Bổ - Rẻ):
- **Nhà cung cấp**: **Hetzner Cloud** (Server đặt tại Singapore hoặc Đức/Phần Lan)
- **Gói**: **CX22** (hoặc CPX21)
- **Cấu hình**: 2 vCPU, 4GB RAM, 40GB NVMe SSD, 20TB băng thông
- **Chi phí**: ~€3.79 - €4.35 / tháng (~**105.000 ₫ - 120.000 ₫ / tháng**)
- **Đánh giá**: Chạy cực kỳ mượt mà cho Docker + PostgreSQL + App + Caddy, chi phí rẻ nhất thị trường.

### 2. Gói máy chủ trong nước (Tốc độ cao nhất tại Việt Nam):
- **Nhà cung cấp**: **Vietnix** hoặc **TinoHost**
- **Gói**: Cloud VPS Basic 2 / Pro
- **Cấu hình**: 2 Core CPU, 2GB - 4GB RAM, 30GB SSD
- **Chi phí**: ~**120.000 ₫ - 180.000 ₫ / tháng**
- **Đánh giá**: Máy chủ đặt tại Hà Nội / TP.HCM, ping cực thấp (<10ms), hỗ trợ kỹ thuật tiếng Việt 24/7.

### 3. Cấu hình tối thiểu:
- 1 vCPU, 2GB RAM, 20GB SSD (Nếu dùng 1GB RAM cần bật thêm 2GB Swap Memory).

---

## 🔑 Tài khoản đăng nhập mặc định

Hệ thống đã được nạp sẵn (seed) 2 tài khoản quản trị ngang quyền:

| Email | Mật khẩu | Tên hiển thị |
|---|---|---|
| `anh@dotafloral.com` | `dotafloral2024` | Anh |
| `chi@dotafloral.com` | `dotafloral2024` | Chị |

*(Có thể đổi mật khẩu bất kỳ lúc nào trong mục **Thêm -> Cài đặt**)*

---

## 💻 Hướng dẫn chạy thử trên máy tính (Local)

### Bước 1: Yêu cầu môi trường
- [Node.js](https://nodejs.org/) phiên bản 18 trở lên (khuyên dùng Node 20 LTS).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) đang chạy.

### Bước 2: Cài đặt & Khởi động Database
### Khởi động nhanh (1-Click trên Windows):
- **Bật ứng dụng**: Chỉ cần bấm đúp chuột vào file **`start.bat`**. Hệ thống sẽ tự động bật database, chạy web server, tạo link kết nối cho điện thoại và tự mở trình duyệt lên cho bạn!
- **Tắt ứng dụng**: Bấm đúp chuột vào file **`stop.bat`** để dừng ứng dụng và database an toàn.

---

### Khởi động thủ công bằng dòng lệnh:
Mở Terminal / PowerShell tại thư mục dự án:

```powershell
# 1. Cài đặt các gói phụ thuộc (chỉ cần làm 1 lần đầu)
npm install

# 2. Khởi động cơ sở dữ liệu PostgreSQL
docker compose up -d

# 3. Khởi động Web App
npm run dev
```
Mở trình duyệt truy cập: **[http://localhost:3000](http://localhost:3000)** và đăng nhập với tài khoản ở trên.

---

## 📱 Hướng dẫn cài đặt PWA lên điện thoại

Ứng dụng hỗ trợ cài đặt dạng PWA (chạy full màn hình như app tải từ App Store / Google Play, có icon ngoài màn hình chính, không hiện thanh địa chỉ trình duyệt):

### Trên iPhone / iPad (Safari):
1. Dùng trình duyệt **Safari** truy cập vào địa chỉ web app của tiệm.
2. Bấm vào nút **Chia sẻ** (biểu tượng hình vuông có mũi tên trỏ lên ở giữa thanh dưới).
3. Cuộn xuống và chọn **"Thêm vào Màn hình chính"** (Add to Home Screen).
4. Đặt tên là **Dota Floral** rồi chọn **Thêm**.
5. Icon Dota Floral 🌸 sẽ xuất hiện ngay trên màn hình chính của iPhone!

### Trên điện thoại Android (Chrome / Cốc Cốc):
1. Dùng trình duyệt **Google Chrome** truy cập vào địa chỉ web app.
2. Trình duyệt sẽ tự động hiện thông báo pop-up **"Thêm Dota Floral vào Màn hình chính"**.
3. Nếu không thấy, bấm vào dấu **3 chấm (⋮)** ở góc trên bên phải -> chọn **"Cài đặt ứng dụng"** hoặc **"Thêm vào Màn hình chính"**.

---

## 🚀 Hướng dẫn triển khai Production trên VPS

Khi đã thuê VPS (Ubuntu 22.04 LTS hoặc 24.04 LTS) và có tên miền (hoặc dùng IP):

### Bước 1: Chuẩn bị máy chủ
Cài đặt Docker & Docker Compose trên VPS (nếu chưa có):
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### Bước 2: Tải mã nguồn lên VPS
```bash
git clone <link_repo_cua_ban> /var/www/dota-floral
cd /var/www/dota-floral
```

### Bước 3: Cấu hình biến môi trường
Tạo file `.env` trên VPS:
```bash
cp .env.example .env
nano .env
```
Điền các giá trị thực tế:
```env
DB_USER=dota
DB_PASSWORD=mat_khau_database_rat_manh_123!
DB_NAME=dota_floral
NEXTAUTH_SECRET=chuoi_bi_mat_ngau_nhien_dai_32_ky_tu
APP_URL=https://dotafloral.vn
APP_DOMAIN=dotafloral.vn
```

### Bước 4: Khởi chạy toàn bộ hệ thống bằng Docker Compose
Chỉ cần chạy **1 câu lệnh duy nhất**:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Hệ thống sẽ tự động:
1. Chạy container PostgreSQL 16 bảo mật.
2. Build và chạy Next.js tối ưu.
3. Chạy Caddy Reverse Proxy, **tự động gửi yêu cầu cấp chứng chỉ SSL HTTPS miễn phí** cho tên miền của bạn.
4. Tự động chuyển hướng từ `http://` sang `https://` an toàn tuyệt đối.

---

## 💾 Sao lưu & Khôi phục Database

### 1. Script sao lưu tự động hàng ngày (14 bản gần nhất)
Tất cả các bản sao lưu được lưu tại thư mục `./backups/` dưới dạng file nén `.sql.gz`. Script sẽ tự động xóa các bản cũ hơn 14 ngày để tránh đầy ổ cứng VPS.

**Chạy sao lưu thủ công:**
- Trên Linux/VPS:
  ```bash
  chmod +x scripts/backup.sh
  ./scripts/backup.sh
  ```
- Trên Windows:
  ```powershell
  powershell -ExecutionPolicy Bypass -File "scripts/backup.ps1"
  ```

**Cài đặt tự động chạy hàng ngày lúc 2:00 sáng trên VPS (Crontab):**
```bash
crontab -e
```
Thêm dòng sau vào cuối:
```cron
0 2 * * * /var/www/dota-floral/scripts/backup.sh >> /var/log/dota-backup.log 2>&1
```

### 2. Khôi phục dữ liệu (Restore)
Khi cần khôi phục lại dữ liệu từ một bản sao lưu cụ thể:
```bash
chmod +x scripts/restore.sh
./scripts/restore.sh backups/dota_floral_YYYYMMDD_HHMMSS.sql.gz
```

---

## 🧪 Kiểm thử nghiệp vụ tự động

Dự án có bộ kiểm thử tự động (Unit Tests) kiểm chứng 4 quy tắc kinh doanh quan trọng nhất:
1. **Quy đổi đơn vị**: Chuyển đổi chính xác từ đơn vị mua (túi, cuộn, bó) sang đơn vị cơ bản (bông, m, cành).
2. **Giá vốn bình quân gia quyền (Weighted Average Cost)**: Tính toán chính xác theo từng đợt nhập hàng và tự động tính lại nhất quán khi sửa/xóa phiếu nhập cũ.
3. **Trừ & hoàn kho**: Tự động trừ kho vật tư khi đơn chuyển sang "Đang làm" và hoàn kho khi hủy đơn.
4. **Snapshot giá vốn**: Giá vốn của đơn hàng đã chốt được đóng băng cố định, không bị thay đổi khi giá thị trường biến động sau này.

Chạy kiểm thử:
```bash
npm test
```
Kết quả kiểm thử: **9/9 tests pass (100%)**.
