#!/bin/bash
# Sync local MastoGale workspace to iCloud Drive
SOURCE_DIR="/Users/shuaihui/Documents/MastoGale/MastoGale"
TARGET_DIR="/Users/shuaihui/Library/Mobile Documents/com~apple~CloudDocs/应用/MastoGale"

echo "🔄 开始同步 MastoGale 扩展文件至 iCloud..."

# Ensure target directory exists
mkdir -p "$TARGET_DIR"

# Copy directories and files
rsync -av --exclude='.git' --exclude='.DS_Store' --exclude='node_modules' "$SOURCE_DIR/" "$TARGET_DIR/"

echo "✅ 同步完成！请在 Edge 扩展程序（edge://extensions/）中刷新 MastoGale 扩展进行体验。"
