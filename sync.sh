#!/bin/bash
# Sync local PREFiX-Mastodon workspace to iCloud Drive
SOURCE_DIR="/Users/shuaihui/Documents/PREFiX-Mastodon/PREFiX-Mastodon"
TARGET_DIR="/Users/shuaihui/Library/Mobile Documents/com~apple~CloudDocs/应用/PREFiX-Mastodon"

echo "🔄 开始同步文件至 iCloud..."

# Ensure target directory exists
mkdir -p "$TARGET_DIR"

# Copy directories and files
rsync -av --exclude='.git' --exclude='.DS_Store' --exclude='node_modules' "$SOURCE_DIR/" "$TARGET_DIR/"

echo "✅ 同步完成！请在 Edge 中刷新 PREFiX 扩展进行体验。"
