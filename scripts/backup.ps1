# Dota Floral - PowerShell Backup Script
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackupDir = Join-Path $ProjectRoot "backups"
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "dota_floral_$Timestamp.sql"
$ContainerName = "dota-floral-db"
$DbUser = "dota"
$DbName = "dota_floral"
$DaysToKeep = 14

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "Bat dau sao luu database..." -ForegroundColor Cyan

docker exec -t $ContainerName pg_dump -U $DbUser -d $DbName --clean --if-exists | Out-File -FilePath $BackupFile -Encoding utf8

if ((Test-Path $BackupFile) -and ((Get-Item $BackupFile).Length -gt 0)) {
    $sizeKb = [math]::Round((Get-Item $BackupFile).Length / 1KB, 2)
    Write-Host "Sao luu thanh cong: $BackupFile ($sizeKb KB)" -ForegroundColor Green
} else {
    Write-Host "Loi: File sao luu rong hoac that bai!" -ForegroundColor Red
    exit 1
}

# Clean old backups
$CutoffDate = (Get-Date).AddDays(-$DaysToKeep)
Get-ChildItem -Path $BackupDir -Filter "dota_floral_*.sql" | Where-Object { $_.LastWriteTime -lt $CutoffDate } | Remove-Item -Force

$Count = (Get-ChildItem -Path $BackupDir -Filter "dota_floral_*.sql").Count
Write-Host "Tong so ban sao luu hien co: $Count" -ForegroundColor Yellow
