#!/bin/bash
# d1-to-mysql-migration.sh
# 将 Cloudflare D1 数据库迁移到 MySQL 的辅助脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}CloudPaste D1 到 MySQL 数据迁移工具${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# 检查必需的工具
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}错误: 未找到 $1 命令${NC}"
        echo -e "${YELLOW}请安装 $1 后重试${NC}"
        exit 1
    fi
}

echo "检查必需工具..."
check_tool "wrangler"
check_tool "mysql"
check_tool "sed"

# 步骤 1: 导出 D1 数据
echo ""
echo -e "${GREEN}步骤 1: 导出 Cloudflare D1 数据${NC}"
read -p "请输入 D1 数据库名称 (默认: cloudpaste-db): " D1_DB_NAME
D1_DB_NAME=${D1_DB_NAME:-cloudpaste-db}

BACKUP_FILE="d1-backup-$(date +%Y%m%d-%H%M%S).sql"
echo "正在导出 D1 数据到 $BACKUP_FILE ..."
wrangler d1 export $D1_DB_NAME --output=$BACKUP_FILE

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}错误: D1 数据导出失败${NC}"
    exit 1
fi

echo -e "${GREEN}✓ D1 数据导出成功${NC}"

# 步骤 2: 转换 SQL 语法
echo ""
echo -e "${GREEN}步骤 2: 转换 SQLite 语法为 MySQL 语法${NC}"
CONVERTED_FILE="mysql-import-$(date +%Y%m%d-%H%M%S).sql"

echo "正在转换 SQL 语法..."

# 创建转换后的文件
cp $BACKUP_FILE $CONVERTED_FILE

# 1. AUTOINCREMENT -> AUTO_INCREMENT
sed -i 's/AUTOINCREMENT/AUTO_INCREMENT/gi' $CONVERTED_FILE

# 2. DATETIME('now') -> NOW()
sed -i "s/DATETIME(['\"]now['\"])/NOW()/gi" $CONVERTED_FILE

# 3. INTEGER DEFAULT 0/1 -> TINYINT(1) DEFAULT 0/1
sed -i 's/INTEGER DEFAULT 0/TINYINT(1) DEFAULT 0/gi' $CONVERTED_FILE
sed -i 's/INTEGER DEFAULT 1/TINYINT(1) DEFAULT 1/gi' $CONVERTED_FILE

# 4. BLOB -> LONGBLOB
sed -i 's/\bBLOB\b/LONGBLOB/gi' $CONVERTED_FILE

# 5. 移除 SQLite 特定语法
sed -i '/PRAGMA/d' $CONVERTED_FILE
sed -i '/sqlite_sequence/d' $CONVERTED_FILE

# 6. 添加 MySQL 特定设置
cat > temp_header.sql << 'EOF'
-- CloudPaste MySQL 导入脚本
-- 生成时间: $(date)
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

EOF

cat temp_header.sql $CONVERTED_FILE > temp_final.sql
mv temp_final.sql $CONVERTED_FILE
rm temp_header.sql

echo -e "${GREEN}✓ SQL 语法转换完成${NC}"
echo -e "${YELLOW}转换后的文件: $CONVERTED_FILE${NC}"

# 步骤 3: 导入到 MySQL
echo ""
echo -e "${GREEN}步骤 3: 导入数据到 MySQL${NC}"
echo -e "${YELLOW}请提供 MySQL 连接信息:${NC}"

read -p "MySQL 主机 (默认: localhost): " MYSQL_HOST
MYSQL_HOST=${MYSQL_HOST:-localhost}

read -p "MySQL 端口 (默认: 3306): " MYSQL_PORT
MYSQL_PORT=${MYSQL_PORT:-3306}

read -p "MySQL 用户名: " MYSQL_USER
if [ -z "$MYSQL_USER" ]; then
    echo -e "${RED}错误: MySQL 用户名不能为空${NC}"
    exit 1
fi

read -sp "MySQL 密码: " MYSQL_PASSWORD
echo ""
if [ -z "$MYSQL_PASSWORD" ]; then
    echo -e "${RED}错误: MySQL 密码不能为空${NC}"
    exit 1
fi

read -p "MySQL 数据库名 (默认: cloudpaste): " MYSQL_DATABASE
MYSQL_DATABASE=${MYSQL_DATABASE:-cloudpaste}

# 测试连接
echo ""
echo "测试 MySQL 连接..."
if ! mysql -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER -p$MYSQL_PASSWORD -e "SELECT 1;" &> /dev/null; then
    echo -e "${RED}错误: 无法连接到 MySQL 数据库${NC}"
    echo -e "${YELLOW}请检查连接信息是否正确${NC}"
    exit 1
fi

echo -e "${GREEN}✓ MySQL 连接测试成功${NC}"

# 创建数据库（如果不存在）
echo "检查/创建数据库..."
mysql -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER -p$MYSQL_PASSWORD -e "CREATE DATABASE IF NOT EXISTS $MYSQL_DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 询问是否清空现有数据
echo ""
read -p "是否清空 MySQL 数据库中的现有数据? (y/N): " CLEAR_DB
if [ "$CLEAR_DB" = "y" ] || [ "$CLEAR_DB" = "Y" ]; then
    echo -e "${YELLOW}警告: 即将清空数据库 $MYSQL_DATABASE 中的所有数据${NC}"
    read -p "确认清空? (yes/no): " CONFIRM
    if [ "$CONFIRM" = "yes" ]; then
        echo "清空数据库..."
        mysql -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE -e "
        SET FOREIGN_KEY_CHECKS = 0;
        SELECT CONCAT('DROP TABLE IF EXISTS \`', table_name, '\`;')
        FROM information_schema.tables
        WHERE table_schema = '$MYSQL_DATABASE';
        SET FOREIGN_KEY_CHECKS = 1;
        " | grep "DROP TABLE" | mysql -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE
        echo -e "${GREEN}✓ 数据库已清空${NC}"
    fi
fi

# 导入数据
echo ""
echo "开始导入数据到 MySQL..."
if mysql -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < $CONVERTED_FILE; then
    echo -e "${GREEN}✓ 数据导入成功${NC}"
else
    echo -e "${RED}错误: 数据导入失败${NC}"
    echo -e "${YELLOW}请检查 $CONVERTED_FILE 文件中的 SQL 语句${NC}"
    exit 1
fi

# 验证导入
echo ""
echo "验证导入结果..."
TABLE_COUNT=$(mysql -h$MYSQL_HOST -P$MYSQL_PORT -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE -e "
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '$MYSQL_DATABASE';
" -sN)

echo -e "${GREEN}✓ 已导入 $TABLE_COUNT 个数据表${NC}"

# 步骤 4: 生成环境变量配置
echo ""
echo -e "${GREEN}步骤 4: 生成 EdgeOne Pages 环境变量配置${NC}"

ENV_FILE="edgeone-env-$(date +%Y%m%d-%H%M%S).txt"

cat > $ENV_FILE << EOF
# ========================================
# CloudPaste EdgeOne Pages 环境变量配置
# 生成时间: $(date)
# ========================================

# 云平台标识
CLOUD_PLATFORM=edgeone

# MySQL 数据库配置
MYSQL_HOST=$MYSQL_HOST
MYSQL_PORT=$MYSQL_PORT
MYSQL_USER=$MYSQL_USER
MYSQL_PASSWORD=$MYSQL_PASSWORD
MYSQL_DATABASE=$MYSQL_DATABASE
MYSQL_SSL=false

# 加密密钥（请替换为您自己的密钥）
ENCRYPTION_SECRET=请生成一个32位随机字符串

# 可选配置
ADMIN_TOKEN_EXPIRY_DAYS=7
EOF

echo -e "${GREEN}✓ 环境变量配置已保存到: $ENV_FILE${NC}"

# 完成
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}迁移完成！${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "生成的文件:"
echo "  - D1 备份: $BACKUP_FILE"
echo "  - MySQL 导入脚本: $CONVERTED_FILE"
echo "  - 环境变量配置: $ENV_FILE"
echo ""
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 生成安全的 ENCRYPTION_SECRET:"
echo "   openssl rand -base64 32"
echo ""
echo "2. 编辑 $ENV_FILE，填入正确的 ENCRYPTION_SECRET"
echo ""
echo "3. 在 EdgeOne Pages 控制台配置环境变量"
echo ""
echo "4. 部署 CloudPaste 到 EdgeOne Pages"
echo ""
echo -e "${GREEN}完成后，您的 CloudPaste 将使用 MySQL 数据库运行！${NC}"
echo ""
echo -e "${YELLOW}注意: 请妥善保管生成的文件，包含敏感信息${NC}"
