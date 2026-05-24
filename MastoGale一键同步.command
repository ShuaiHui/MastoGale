#!/bin/bash
# 双击一键同步 MastoGale 扩展至 iCloud
clear
echo "========================================="
echo "   MastoGale 首席秘书一键同步部署工具 🌸"
echo "========================================="
echo ""

# 执行 sync.sh 脚本
bash "/Users/shuaihui/Documents/MastoGale/MastoGale/sync.sh"

echo ""
echo "========================================="
echo "🎉 部署同步顺利完成！本窗口将在 3 秒后关闭..."
echo "========================================="
sleep 3
exit
