#!/bin/bash
# ==========================================================
# Dota Floral - Script khôi phục Database PostgreSQL
# Sử dụng: ./scripts/restore.sh [đường_dẫn_file_backup.sql.gz]
# Ví dụ: ./scripts/restore.sh backups/dota_floral_20261014_120000.sql.gz
# ==========================================================

set -e

CONTAINER_NAME="dota-floral-db"
DB_USER="dota"
DB_NAME="dota_floral"

if [ -z "$1" ]; then
    echo "❌ Lỗi: Vui lòng cung cấp đường dẫn file backup!"
    echo "Cách dùng: ./scripts/restore.sh <file_backup.sql.gz>"
    echo ""
    echo "Danh sách các bản sao lưu hiện có trong thư mục backups/:"
    ls -lh backups/*.sql.gz 2>/dev/null || echo "Chưa có file backup nào."
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Lỗi: File không tồn tại: ${BACKUP_FILE}"
    exit 1
fi

echo "⚠️  CẢNH BÁO: Thao tác này sẽ ghi đè toàn bộ dữ liệu hiện tại của database '${DB_NAME}'!"
read -p "Bạn có chắc chắn muốn tiếp tục? (gõ 'yes' để xác nhận): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "🚫 Đã hủy thao tác khôi phục."
    exit 0
fi

echo "🌸 Đang khôi phục dữ liệu từ ${BACKUP_FILE}..."

# Giải nén và nạp vào database qua psql
gunzip -c "${BACKUP_FILE}" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}"

echo "✅ Khôi phục database thành công!"
echo "🌸 Khởi động lại ứng dụng nếu cần: docker compose restart app"
