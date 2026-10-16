#!/bin/bash
# ==========================================================
# Dota Floral - Script tự động sao lưu Database PostgreSQL
# Lưu trữ tại: /app/backups hoặc ./backups
# Giữ lại 14 bản sao lưu gần nhất (tự động xóa bản cũ hơn)
# ==========================================================

set -e

# Thư mục lưu trữ backup
BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/dota_floral_${TIMESTAMP}.sql.gz"

# Cấu hình container
CONTAINER_NAME="dota-floral-db"
DB_USER="dota"
DB_NAME="dota_floral"
DAYS_TO_KEEP=14

mkdir -p "${BACKUP_DIR}"

echo "🌸 [$(date '+%Y-%m-%d %H:%M:%S')] Bắt đầu sao lưu database..."

# Thực hiện pg_dump trong container và nén gzip
docker exec -t "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists | gzip > "${BACKUP_FILE}"

if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
    FILESIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "✅ Sao lưu thành công: ${BACKUP_FILE} (${FILESIZE})"
else
    echo "❌ Lỗi: File sao lưu rỗng hoặc không được tạo!"
    exit 1
fi

# Tự động dọn dẹp các bản sao lưu cũ hơn 14 ngày
echo "🧹 Đang dọn dẹp các bản sao lưu cũ hơn ${DAYS_TO_KEEP} ngày..."
find "${BACKUP_DIR}" -name "dota_floral_*.sql.gz" -type f -mtime +${DAYS_TO_KEEP} -exec rm -f {} \;

REMAINING_COUNT=$(find "${BACKUP_DIR}" -name "dota_floral_*.sql.gz" -type f | wc -l)
echo "📦 Tổng số bản sao lưu hiện có: ${REMAINING_COUNT}"
echo "🌸 Hoàn tất quá trình sao lưu!"
