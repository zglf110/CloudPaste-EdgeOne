# EdgeOne 快速部署指南 (Quick Start)

本指南帮助您在 5 分钟内快速部署 CloudPaste 到腾讯云 EdgeOne Pages。

## ⚡ 快速开始

### 步骤 1: 准备 MySQL 数据库

创建一个公网可访问的 MySQL 数据库（推荐使用腾讯云 TencentDB）：

```sql
CREATE DATABASE cloudpaste CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

记录以下信息：
- 主机地址: `xxx.xxx.xxx.xxx`
- 端口: `3306`
- 用户名: `your_user`
- 密码: `your_password`
- 数据库名: `cloudpaste`

### 步骤 2: 准备 R2 存储

如果还没有 Cloudflare R2 存储桶：

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 创建 R2 存储桶
3. 生成 API Token
4. 记录：
   - 端点 URL
   - Access Key ID
   - Secret Access Key

### 步骤 3: 配置环境变量

在 EdgeOne Pages 控制台设置以下环境变量：

```bash
# ====== 必需配置 ======
CLOUD_PLATFORM=edgeone
MYSQL_HOST=你的MySQL主机地址
MYSQL_PORT=3306
MYSQL_USER=你的MySQL用户名
MYSQL_PASSWORD=你的MySQL密码
MYSQL_DATABASE=cloudpaste
ENCRYPTION_SECRET=生成一个32位随机字符串

# ====== 可选配置 ======
MYSQL_SSL=false
ADMIN_TOKEN_EXPIRY_DAYS=7

# ====== 调试日志（用于故障排查）======
DEBUG_LOG=false       # 启用详细调试日志
DEBUG_SQL=false       # 启用 SQL 查询日志
DEBUG_DB=false        # 启用数据库操作日志
LOG_LEVEL=info        # 日志级别：debug/info/warn/error
```

### 步骤 4: 构建并部署

```bash
# 1. 克隆代码
git clone https://github.com/ling-drag0n/CloudPaste.git
cd CloudPaste

# 2. 构建前端
cd frontend
npm install
npm run build

# 3. 部署后端
cd ../backend
npm install

# 4. 上传到 EdgeOne Pages
# 按照 EdgeOne Pages 控制台指引上传代码
```

### 步骤 5: 访问应用

首次访问时：
1. 系统自动创建数据库表
2. 使用默认账户登录：
   - 用户名: `admin`
   - 密码: `admin123`
3. **立即修改密码！**
4. 在管理界面配置 R2 存储

## 🎯 关键配置说明

### CLOUD_PLATFORM 环境变量

这是最重要的配置！必须设置为 `edgeone` 以启用 EdgeOne 模式。

```bash
CLOUD_PLATFORM=edgeone  # 启用 EdgeOne + MySQL 模式
```

### MySQL 连接配置

确保 MySQL 数据库：
- ✅ 可公网访问
- ✅ 允许来自 EdgeOne 的连接
- ✅ 用户具有 CREATE、ALTER 等权限

### 加密密钥生成

使用以下命令生成安全的加密密钥：

```bash
# Linux/Mac
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 📋 环境变量清单

复制以下模板，填入实际值：

```bash
# ========================================
# CloudPaste EdgeOne Pages 环境变量配置
# ========================================

# 云平台标识（必需）
CLOUD_PLATFORM=edgeone

# MySQL 数据库配置（必需）
MYSQL_HOST=your-mysql-host.example.com
MYSQL_PORT=3306
MYSQL_USER=cloudpaste_user
MYSQL_PASSWORD=your_secure_password_here
MYSQL_DATABASE=cloudpaste
MYSQL_SSL=false

# 安全配置（必需）
ENCRYPTION_SECRET=your_32_character_random_secret_key_here

# 可选配置
ADMIN_TOKEN_EXPIRY_DAYS=7

# 调试与日志配置（用于故障排查）
DEBUG_LOG=false       # 启用详细调试日志
DEBUG_SQL=false       # 启用 SQL 查询日志
DEBUG_DB=false        # 启用数据库操作日志
LOG_LEVEL=info        # 日志级别：debug/info/warn/error
DEBUG_DRIVER_CACHE=false
```

## 🔍 部署验证

部署完成后，检查以下项目：

### 1. 数据库连接

**启用日志查看详细信息**:
```bash
DEBUG_LOG=true
DEBUG_DB=true
```

查看日志，应该看到：
```
[EdgeOne/Init] 检测到 EdgeOne Pages 环境，初始化 MySQL 连接
[MySQL] 开始初始化 MySQL 连接池 {"host":"...","port":3306,...}
[MySQL/DB] 执行健康检查
[MySQL/DB] 健康检查通过
[MySQL] MySQL 连接池初始化 完成 {"duration_ms":...}
[EdgeOne/Init] MySQL 数据库连接成功，EdgeOne Pages 环境已就绪
[MySQL/Provider] 开始初始化/迁移 MySQL 数据库
[MySQL/Provider] MySQL 数据库初始化/迁移 完成 {"duration_ms":...}
```

### 2. 应用访问
访问应用 URL，应该能：
- ✅ 看到登录页面
- ✅ 使用默认账户登录
- ✅ 访问管理界面

### 3. 功能测试
- ✅ 修改管理员密码
- ✅ 添加 R2 存储配置
- ✅ 测试文件上传
- ✅ 测试文件预览

## ❌ 常见错误

### 错误 1: MySQL 连接失败

```
MySQL 连接失败: connect ETIMEDOUT
```

**解决方案**:
- 检查 MySQL 主机地址是否正确
- 确认防火墙允许外部连接
- 验证用户名密码

**调试方法**:
```bash
# 启用调试日志
DEBUG_LOG=true
DEBUG_DB=true

# 查看详细连接信息
```

### 错误 2: 数据表创建失败

```
Table creation failed: Access denied
```

**解决方案**:
```sql
GRANT ALL PRIVILEGES ON cloudpaste.* TO 'your_user'@'%';
FLUSH PRIVILEGES;
```

### 错误 3: 环境未识别

如果系统没有使用 MySQL，检查：
```bash
# 确保设置了这个变量
CLOUD_PLATFORM=edgeone

# 启用日志确认
DEBUG_LOG=true
```

查看日志应显示：
```
[EdgeOne/Init] 检测到 EdgeOne Pages 环境，初始化 MySQL 连接
```

## 🐛 调试技巧

### 启用完整调试日志

当遇到问题时，启用完整的调试日志：

```bash
DEBUG_LOG=true       # 启用详细调试日志
DEBUG_SQL=true       # 查看所有 SQL 查询和执行时间
DEBUG_DB=true        # 查看数据库连接池和事务状态
LOG_LEVEL=debug      # 设置为最详细级别
```

### 查看 SQL 执行情况

```bash
# 启用 SQL 日志
DEBUG_SQL=true
```

日志会显示：
```
[MySQL/SQL]  {"sql":"SELECT * FROM users WHERE id = ?","params":[1],"duration_ms":45}
```

### 监控连接池状态

```bash
# 启用数据库日志
DEBUG_DB=true
```

日志会显示：
```
[MySQL/Pool] 连接池状态 {"totalConnections":10,"freeConnections":8,"queuedRequests":0}
```

### 性能分析

启用性能日志查看操作耗时：
```bash
DEBUG_LOG=true
```

日志会显示每个操作的执行时间：
```
[MySQL] MySQL 连接池初始化 完成 {"duration_ms":767}
[MySQL/Provider] MySQL 数据库初始化/迁移 完成 {"duration_ms":1234}
```

## 📚 进阶配置

### 配置 WebDAV

1. 登录管理界面
2. 创建 API 密钥
3. 启用"挂载权限"
4. 使用 WebDAV 客户端连接：
   - URL: `https://your-domain.com/dav`
   - 用户名: API 密钥
   - 密码: API 密钥（相同）

### 配置多存储

在管理界面可以配置：
- Cloudflare R2
- AWS S3
- 阿里云 OSS
- 腾讯云 COS
- MinIO
- WebDAV 网盘

### 自定义域名

在 EdgeOne Pages 控制台：
1. 添加自定义域名
2. 配置 DNS 解析
3. 等待 SSL 证书生成

## 🆘 获取帮助

- 📖 完整文档: [EDGEONE_DEPLOYMENT.md](EDGEONE_DEPLOYMENT.md)
- 🔧 兼容性说明: [COMPATIBILITY.md](COMPATIBILITY.md)
- 🐛 问题反馈: [GitHub Issues](https://github.com/ling-drag0n/CloudPaste/issues)

## ✅ 部署检查清单

部署前确认：
- [ ] MySQL 数据库已创建
- [ ] MySQL 用户权限已配置
- [ ] R2 存储桶已创建
- [ ] 环境变量已正确配置
- [ ] `CLOUD_PLATFORM=edgeone` 已设置
- [ ] `ENCRYPTION_SECRET` 已生成

部署后确认：
- [ ] 应用可以访问
- [ ] 日志显示 MySQL 连接成功
- [ ] 可以登录管理界面
- [ ] 已修改默认密码
- [ ] R2 存储配置成功
- [ ] 文件上传功能正常

---

**祝您部署顺利！** 🚀

如有问题，请参考 [完整部署指南](EDGEONE_DEPLOYMENT.md) 或在 GitHub 提交 Issue。
