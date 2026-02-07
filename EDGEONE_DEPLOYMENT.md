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

注意：某些环境变量管理界面或平台对环境变量值有严格限制（例如不允许值中包含空格、换行或制表符）。如果遇到限制，可以采用以下做法：

- 在控制台直接填写原始值（推荐，若控制台允许）。
- 在 .env 或 CI 中使用占位表示（例如将空格替换为下划线），并在应用启动时将其还原回原始格式。
- 使用 Base64 对值进行编码并在程序中解码（适用于任意二进制/复杂值）。

示例：生成 32 字节随机密钥

```bash
openssl rand -base64 32
```

#### 可选环境变量

```bash
# 日志配置（用于调试和故障排查）
DEBUG_LOG=false       # 启用详细调试日志
DEBUG_SQL=false       # 启用 SQL 查询日志
DEBUG_DB=false        # 启用数据库操作日志
LOG_LEVEL=info        # 日志级别：debug, info, warn, error

# 如果使用 Cloudflare R2 或其他 S3 存储，可以通过管理界面配置
# 这些配置通常在系统初始化后在管理界面中添加
```

说明：仓库中的示例 `.env.example` 已移除 S3_*、S3_ENDPOINT、CLOUDFLARE_* 等与平台外部 CI/服务相关的示例变量。建议在生产环境中通过 EdgeOne 管理控制台或 CloudPaste 管理界面填写存储（R2/S3/B2）凭证，而不是将此类敏感密钥写入源码或公开的环境文件。

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
| `DEBUG_LOG` | 启用详细调试日志 | `false` |
| `DEBUG_SQL` | 启用 SQL 查询日志（包括执行时间） | `false` |
| `DEBUG_DB` | 启用数据库操作日志（连接池、事务等） | `false` |
| `LOG_LEVEL` | 日志级别（debug/info/warn/error） | `info` |
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

### 启用调试日志

当遇到问题时，启用调试日志可以帮助您快速定位问题：

```bash
# 启用所有调试日志
DEBUG_LOG=true
DEBUG_SQL=true
DEBUG_DB=true
LOG_LEVEL=debug
```

**日志说明**：

- `DEBUG_LOG=true`: 启用详细的调试日志，包括操作执行时间、性能指标等
- `DEBUG_SQL=true`: 记录所有 SQL 查询及其参数、执行时间
- `DEBUG_DB=true`: 记录数据库连接池状态、事务操作等
- `LOG_LEVEL=debug`: 设置日志级别为 debug（最详细）

**日志示例**：

```
[2024-01-15T10:30:45.123Z] [MySQL] 开始初始化 MySQL 连接池 {"host":"mysql.example.com","port":3306,"database":"cloudpaste","ssl":false}
[2024-01-15T10:30:45.456Z] [MySQL/DB] 执行健康检查
[2024-01-15T10:30:45.789Z] [MySQL/DB] 健康检查通过
[2024-01-15T10:30:45.890Z] [MySQL] MySQL 连接池初始化 完成 {"duration_ms":767}
[2024-01-15T10:30:46.123Z] [MySQL/SQL]  {"sql":"SELECT * FROM users WHERE id = ?","params":[1],"duration_ms":45}
[2024-01-15T10:30:46.234Z] [MySQL/DB] SQL 执行成功 (first) {"found":true,"duration_ms":111}
```

### 常见问题

#### 1. 数据库连接失败

**错误**: `MySQL 连接失败: connect ETIMEDOUT`

**解决方案**:
- 检查 MySQL 主机地址和端口是否正确
- 确认数据库允许来自 EdgeOne Pages 的连接
- 检查防火墙和安全组配置
- 验证用户名和密码是否正确

**调试步骤**:
1. 启用调试日志查看详细连接信息：
   ```bash
   DEBUG_LOG=true
   DEBUG_DB=true
   ```
2. 查看日志输出，确认连接参数：
   ```
   [MySQL] 开始初始化 MySQL 连接池 {"host":"...","port":3306,...}
   ```
3. 测试从本地到数据库的连接：
   ```bash
   mysql -h your-host -P 3306 -u your-user -p
   ```

#### 2. 数据表创建失败

**错误**: `Table creation failed`

**解决方案**:
- 确认数据库用户具有 CREATE、ALTER 权限
- 检查数据库字符集是否为 `utf8mb4`
- 查看日志获取详细错误信息

**调试步骤**:
1. 启用 SQL 日志查看执行的 SQL 语句：
   ```bash
   DEBUG_SQL=true
   ```
2. 查看日志中的 SQL 语句和错误信息
3. 检查用户权限：
   ```sql
   GRANT ALL PRIVILEGES ON cloudpaste.* TO 'your_user'@'%';
   FLUSH PRIVILEGES;
   ```

#### 3. 环境变量未生效

**错误**: 系统仍然尝试连接 D1 数据库

**解决方案**:
- 确认已设置 `CLOUD_PLATFORM=edgeone`
- 重新部署应用以加载新的环境变量
- 检查环境变量拼写是否正确

**调试步骤**:
1. 启用调试日志确认环境检测：
   ```bash
   DEBUG_LOG=true
   ```
2. 查看日志中的环境检测信息：
   ```
   [EdgeOne/Init] 检测到 EdgeOne Pages 环境，初始化 MySQL 连接
   ```

#### 4. 存储配置问题

**错误**: 文件上传失败

**解决方案**:
- 确认 R2 或 S3 配置正确
- 检查 CORS 配置是否允许来自 EdgeOne Pages 域名的请求
- 验证 Access Key 和 Secret Key 是否有效

#### 5. SQL 查询性能问题

**问题**: 某些操作响应缓慢

**调试步骤**:
1. 启用 SQL 性能日志：
   ```bash
   DEBUG_SQL=true
   ```
2. 查看慢查询日志，找出执行时间较长的 SQL：
   ```
   [MySQL/SQL]  {"sql":"...","params":[...],"duration_ms":1234}
   ```
3. 分析慢查询并添加索引或优化查询

#### 6. 连接池耗尽

**错误**: `Too many connections` 或连接超时

**调试步骤**:
1. 启用数据库日志查看连接池状态：
   ```bash
   DEBUG_DB=true
   ```
2. 查看连接池指标：
   ```
   [MySQL/Pool] 连接池状态 {"totalConnections":10,"freeConnections":2,"queuedRequests":5}
   ```
3. 如果连接池经常耗尽，考虑：
   - 优化应用代码，确保连接及时释放
   - 增加数据库连接限制
   - 检查是否有死锁或长时间运行的查询

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
