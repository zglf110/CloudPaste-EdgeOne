# EdgeOne Pages 部署指南

本文档介绍如何将 CloudPaste 部署到腾讯云 EdgeOne Pages 环境。

## 概述

CloudPaste 现已支持在腾讯云 EdgeOne Pages 上部署。EdgeOne Pages 部署与 Cloudflare Workers 部署的主要区别：

- **数据库**: EdgeOne Pages 使用外部 MySQL 数据库（而非 Cloudflare D1）
- **对象存储**: EdgeOne Pages 可使用 Cloudflare R2 或其他 S3 兼容存储
- **环境检测**: 通过 `CLOUD_PLATFORM` 环境变量自动识别运行环境

## 前置准备

在开始部署前，请确保已准备：

1. **EdgeOne Pages 账号**: 注册并登录[腾讯云 EdgeOne](https://edgeone.cloud.tencent.com/)
2. **MySQL 数据库**: 一个可公网访问的 MySQL 数据库（推荐 MySQL 5.7+ 或 8.0+）
   - 数据库主机地址和端口
   - 数据库用户名和密码
   - 已创建的数据库名称
3. **对象存储**: Cloudflare R2 存储桶或其他 S3 兼容存储
   - 存储桶名称
   - Access Key ID 和 Secret Access Key
   - 端点 URL

## 部署步骤

### 1. 准备 MySQL 数据库

#### 1.1 创建数据库

如果您还没有 MySQL 数据库，可以使用：
- 腾讯云 TencentDB for MySQL
- 阿里云 RDS MySQL
- AWS RDS for MySQL
- 或任何支持公网访问的 MySQL 服务

创建一个新的数据库用于 CloudPaste：

```sql
CREATE DATABASE cloudpaste CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 1.2 配置数据库用户权限

确保数据库用户具有以下权限：

```sql
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON cloudpaste.* TO 'your_user'@'%';
FLUSH PRIVILEGES;
```

#### 1.3 配置安全组/防火墙

确保数据库允许来自 EdgeOne Pages 的连接（通常需要开放公网访问）。

### 2. 构建前端

在本地或 CI/CD 环境中构建前端：

```bash
cd frontend
npm install
npm run build
```

构建完成后，`frontend/dist` 目录将包含前端静态文件。

### 3. 配置环境变量

在 EdgeOne Pages 控制台中配置以下环境变量：

#### 必需的环境变量

```bash
# 云平台标识（重要！）
CLOUD_PLATFORM=edgeone

# 数据库配置
MYSQL_HOST=your-mysql-host.com
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=cloudpaste
MYSQL_SSL=false  # 如果需要 SSL 连接，设置为 true

# 加密密钥（必须设置一个强随机字符串）
ENCRYPTION_SECRET=your-very-secure-random-secret-key-here

# 管理员 Token 过期天数（可选，默认 7 天）
ADMIN_TOKEN_EXPIRY_DAYS=7
```

#### 可选环境变量

```bash
# 如果使用 Cloudflare R2 或其他 S3 存储，可以通过管理界面配置
# 这些配置通常在系统初始化后在管理界面中添加
```

### 4. 部署到 EdgeOne Pages

#### 4.1 上传后端代码

将整个 `backend` 目录上传到 EdgeOne Pages：

```bash
cd backend
# 确保已安装依赖
npm install

# 打包上传到 EdgeOne Pages
# 具体操作请参考 EdgeOne Pages 官方文档
```

#### 4.2 部署前端

将 `frontend/dist` 目录的内容部署为静态资源：

1. 登录 EdgeOne Pages 控制台
2. 创建新项目或选择现有项目
3. 上传 `frontend/dist` 目录中的所有文件
4. 配置路由规则，将 API 请求路由到后端服务

#### 4.3 配置路由

在 EdgeOne Pages 中配置路由规则（示例）：

```
/api/*        -> 后端服务
/dav/*        -> 后端服务（WebDAV）
/*            -> 前端静态文件
```

### 5. 初始化应用

首次访问应用时，系统会自动：

1. 连接到 MySQL 数据库
2. 创建所需的数据表结构
3. 初始化默认管理员账户

默认管理员凭据：
- 用户名: `admin`
- 密码: `admin123`

**⚠️ 重要安全提示**: 首次登录后请立即修改默认管理员密码！

### 6. 配置存储

登录管理界面后：

1. 进入"存储配置"页面
2. 添加 Cloudflare R2 或其他 S3 兼容存储：
   - 端点 URL: 您的 R2/S3 端点
   - 存储桶名称
   - Access Key ID
   - Secret Access Key
   - 区域（可选）
3. 测试连接并保存配置
4. 设置为默认存储

## 环境变量说明

### 云平台识别

| 环境变量 | 值 | 说明 |
|---------|---|------|
| `CLOUD_PLATFORM` | `edgeone` | EdgeOne Pages 环境 |
| `CLOUD_PLATFORM` | `cloudflare` | Cloudflare Workers 环境 |
| `CLOUD_PLATFORM` | `docker` | Docker/本地部署 |

**注意**: 如不设置 `CLOUD_PLATFORM`，系统会尝试自动检测，但建议显式设置以避免检测错误。

### MySQL 数据库

| 环境变量 | 必需 | 说明 | 示例 |
|---------|-----|------|------|
| `MYSQL_HOST` | ✅ | MySQL 主机地址 | `mysql.example.com` |
| `MYSQL_PORT` | ❌ | MySQL 端口 | `3306` (默认) |
| `MYSQL_USER` | ✅ | 数据库用户名 | `cloudpaste_user` |
| `MYSQL_PASSWORD` | ✅ | 数据库密码 | `your_password` |
| `MYSQL_DATABASE` | ✅ | 数据库名称 | `cloudpaste` |
| `MYSQL_SSL` | ❌ | 是否使用 SSL | `true` 或 `false` |

### 可选配置

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `ADMIN_TOKEN_EXPIRY_DAYS` | 管理员 Token 过期天数 | `7` |
| `DEBUG_DRIVER_CACHE` | 调试驱动缓存（开发用） | `false` |

## 与 Cloudflare Workers 部署的对比

| 特性 | Cloudflare Workers | EdgeOne Pages |
|-----|-------------------|---------------|
| 数据库 | Cloudflare D1 (SQLite) | MySQL |
| 对象存储 | R2 / 其他 S3 | R2 / 其他 S3 |
| 定时任务 | Cron Triggers | 暂不支持 |
| 部署方式 | Wrangler CLI | EdgeOne Console |
| 环境变量 | `CLOUD_PLATFORM=cloudflare` | `CLOUD_PLATFORM=edgeone` |

## 数据库迁移

### 从 Cloudflare D1 迁移到 MySQL

如果您已经在 Cloudflare Workers 上运行 CloudPaste 并希望迁移到 EdgeOne Pages：

1. **导出 D1 数据**:
   ```bash
   wrangler d1 export cloudpaste-db --output=backup.sql
   ```

2. **转换 SQL 格式**:
   D1 使用 SQLite 语法，需要转换为 MySQL 语法：
   - `AUTOINCREMENT` → `AUTO_INCREMENT`
   - `DATETIME('now')` → `NOW()`
   - 调整数据类型（如 `INTEGER` → `INT`）

3. **导入到 MySQL**:
   ```bash
   mysql -h your-host -u your-user -p cloudpaste < converted-backup.sql
   ```

4. **配置 EdgeOne Pages** 环境变量并部署

## 故障排查

### 常见问题

#### 1. 数据库连接失败

**错误**: `MySQL 连接失败: connect ETIMEDOUT`

**解决方案**:
- 检查 MySQL 主机地址和端口是否正确
- 确认数据库允许来自 EdgeOne Pages 的连接
- 检查防火墙和安全组配置
- 验证用户名和密码是否正确

#### 2. 数据表创建失败

**错误**: `Table creation failed`

**解决方案**:
- 确认数据库用户具有 CREATE、ALTER 权限
- 检查数据库字符集是否为 `utf8mb4`
- 查看日志获取详细错误信息

#### 3. 环境变量未生效

**错误**: 系统仍然尝试连接 D1 数据库

**解决方案**:
- 确认已设置 `CLOUD_PLATFORM=edgeone`
- 重新部署应用以加载新的环境变量
- 检查环境变量拼写是否正确

#### 4. 存储配置问题

**错误**: 文件上传失败

**解决方案**:
- 确认 R2 或 S3 配置正确
- 检查 CORS 配置是否允许来自 EdgeOne Pages 域名的请求
- 验证 Access Key 和 Secret Key 是否有效

## 性能优化建议

### 数据库优化

1. **启用连接池**: MySQLAdapter 已内置连接池，默认最多 10 个连接
2. **使用 SSL 连接**: 如果数据库支持，建议启用 SSL (`MYSQL_SSL=true`)
3. **配置索引**: 确保数据库表已正确创建索引（自动迁移已包含）

### 应用优化

1. **使用 CDN**: EdgeOne 自带 CDN 加速，无需额外配置
2. **优化分片大小**: EdgeOne Pages 支持略高的并发，分片大小已优化为 6MB
3. **缓存策略**: 静态资源自动缓存，API 响应根据业务需求配置

## 安全建议

1. **加密密钥**: 使用强随机字符串作为 `ENCRYPTION_SECRET`
2. **数据库密码**: 使用复杂密码并定期更换
3. **SSL 连接**: 生产环境建议启用 MySQL SSL 连接
4. **管理员密码**: 首次登录后立即修改默认密码
5. **访问控制**: 配置合理的 API 密钥和权限

## 后续步骤

部署完成后，您可以：

1. ✅ 配置自定义域名
2. ✅ 添加多个存储配置
3. ✅ 创建 API 密钥用于编程访问
4. ✅ 配置 WebDAV 访问
5. ✅ 导入现有数据

## 技术支持

如遇到问题，请：

1. 查看 [主 README](README_CN.md) 了解项目基础信息
2. 查看 [API 文档](Api-doc.md) 了解接口详情
3. 在 [GitHub Issues](https://github.com/ling-drag0n/CloudPaste/issues) 提交问题
4. 加入社区讨论

## 许可证

本项目使用 Apache License 2.0 许可证。详见 [LICENSE](LICENSE) 文件。

---

**祝您部署成功！如有问题，欢迎反馈。** 🎉
