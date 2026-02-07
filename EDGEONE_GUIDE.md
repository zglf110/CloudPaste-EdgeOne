# EdgeOne Pages 部署指南

本文档介绍如何将 CloudPaste 部署到腾讯云 EdgeOne Pages 环境。

> **重要更新**: 本项目已更新支持 EdgeOne Pages 边缘函数 API 路径要求。根据腾讯云文档 ([https://cloud.tencent.com/document/product/1552/127419](https://cloud.tencent.com/document/product/1552/127419))，API 路径需要在 `node-functions` 目录中有对应的 JavaScript 文件。

## 📋 目录

- [概述](#概述)
- [EdgeOne 边缘函数路由说明](#edgeone-边缘函数路由说明)
- [前置准备](#前置准备)
- [部署步骤](#部署步骤)
- [环境变量配置](#环境变量配置)
- [故障排查](#故障排查)
- [性能优化](#性能优化)

## 概述

CloudPaste 现已完全支持在腾讯云 EdgeOne Pages 上部署。EdgeOne Pages 部署的主要特点：

- **边缘函数路由**: 使用 EdgeOne Pages 的边缘函数架构，API 路径映射到 `node-functions/api/` 目录下的 JavaScript 文件
- **数据库**: 使用外部 MySQL 数据库（而非 Cloudflare D1）
- **对象存储**: 支持 Cloudflare R2 或其他 S3 兼容存储
- **环境检测**: 通过 `CLOUD_PLATFORM` 环境变量自动识别运行环境

## EdgeOne 边缘函数路由说明

### 路由优先级

EdgeOne Pages 按以下优先级处理请求：

1. **静态文件**: `public/` 目录中的静态资源（前端页面、CSS、JS、图片等）
2. **精确匹配的边缘函数**: `node-functions/api/` 目录下匹配路径的 `.js` 文件
3. **默认处理器**: `node-functions/[[default]].js` 处理所有未匹配的请求

### API 路径映射

根据 EdgeOne 的要求，每个 API 路径需要有对应的 JavaScript 文件：

| API 路径 | 边缘函数文件 | 说明 |
|---------|------------|------|
| `/api/admin/login` | `node-functions/api/admin/login.js` | 管理员登录 |
| `/api/admin/logout` | `node-functions/api/admin/logout.js` | 管理员登出 |
| `/api/health` | `node-functions/api/health.js` | 健康检查 |
| `/api/version` | `node-functions/api/version.js` | 版本信息 |
| 其他动态路由 | `node-functions/[[default]].js` | 默认处理器 |

### 边缘函数文件结构

每个边缘函数文件都遵循相同的结构：

```javascript
// EdgeOne Pages Edge Function
import app from "../../_app.js";

export async function onRequest(context) {
  return app.fetch(context.request, context.env, context);
}
```

这些文件作为路由入口，将请求转发给 Hono 应用处理。

### 自动生成边缘函数文件

项目包含一个脚本，可以自动生成所有需要的边缘函数文件：

```bash
# 生成所有边缘函数文件
./scripts/generate-edge-functions.sh
```

该脚本会在 `node-functions/api/` 目录下创建所有主要 API 路由对应的边缘函数文件。

## 前置准备

在开始部署前，请确保已准备：

1. **EdgeOne Pages 账号**: 注册并登录[腾讯云 EdgeOne](https://edgeone.cloud.tencent.com/)
2. **MySQL 数据库**: 一个可公网访问的 MySQL 数据库（推荐 MySQL 5.7+ 或 8.0+）
   - 数据库主机地址和端口
   - 数据库用户名和密码
   - 已创建的数据库名称
3. **对象存储**（可选）: Cloudflare R2 存储桶或其他 S3 兼容存储
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

### 2. 准备边缘函数文件

确保 `node-functions/api/` 目录下有所有必要的边缘函数文件：

```bash
# 如果还没有生成边缘函数文件，运行以下命令
./scripts/generate-edge-functions.sh
```

### 3. 构建前端

在本地或 CI/CD 环境中构建前端：

```bash
# 方式一：使用项目根目录的构建命令
npm run build:frontend

# 方式二：手动构建
cd frontend
npm install
npm run build
cd ..
# 将构建产物复制到 public/ 目录（如需要）
```

构建完成后，前端静态文件应位于 `public/` 目录。

### 4. 配置 EdgeOne Pages 环境变量

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

生成随机加密密钥：

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
```

### 5. 部署到 EdgeOne Pages

#### 方式一：通过 EdgeOne 控制台部署

1. 登录 [EdgeOne Pages 控制台](https://edgeone.cloud.tencent.com/)
2. 创建新项目或选择现有项目
3. 连接 GitHub 仓库或上传代码
4. 配置构建设置：
   - 构建命令：`npm run build:frontend`
   - 输出目录：`public`
   - 函数目录：`node-functions`
5. 配置环境变量（见上文）
6. 点击部署

#### 方式二：使用 EdgeOne CLI 部署

```bash
# 安装 EdgeOne CLI（如果还未安装）
npm install -g @edgeone/cli

# 登录
edgeone login

# 部署
edgeone pages deploy
```

### 6. 初始化应用

首次访问应用时，系统会自动：

1. 连接到 MySQL 数据库
2. 创建所需的数据表结构
3. 初始化默认管理员账户

默认管理员凭据：
- 用户名: `admin`
- 密码: `admin123`

**⚠️ 重要安全提示**: 首次登录后请立即修改默认管理员密码！

### 7. 配置存储（可选）

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

## 环境变量配置

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

### 常见问题

#### 1. API 路径 404 错误

**错误**: 访问 `/api/admin/login` 返回 404

**可能原因**:
- 缺少对应的边缘函数文件
- 文件路径不正确

**解决方案**:
```bash
# 重新生成所有边缘函数文件
./scripts/generate-edge-functions.sh

# 确认文件存在
ls -la node-functions/api/admin/login.js

# 重新部署
edgeone pages deploy
```

#### 2. 数据库连接失败

**错误**: `MySQL 连接失败: connect ETIMEDOUT`

**解决方案**:
- 检查 MySQL 主机地址和端口是否正确
- 确认数据库允许来自 EdgeOne Pages 的连接
- 检查防火墙和安全组配置
- 验证用户名和密码是否正确

**调试步骤**:
1. 启用调试日志：
   ```bash
   DEBUG_LOG=true
   DEBUG_DB=true
   ```
2. 查看日志输出，确认连接参数
3. 测试从本地到数据库的连接：
   ```bash
   mysql -h your-host -P 3306 -u your-user -p
   ```

#### 3. 导入路径错误

**错误**: `Cannot find module '../_app.js'`

**原因**: 边缘函数文件中的导入路径不正确

**解决方案**:
```bash
# 重新生成边缘函数文件（会自动计算正确的相对路径）
./scripts/generate-edge-functions.sh
```

#### 4. 环境变量未生效

**错误**: 系统仍然尝试连接 D1 数据库

**解决方案**:
- 确认已设置 `CLOUD_PLATFORM=edgeone`
- 重新部署应用以加载新的环境变量
- 检查环境变量拼写是否正确

## 性能优化

### 数据库优化

1. **启用连接池**: MySQLAdapter 已内置连接池，默认最多 10 个连接
2. **使用 SSL 连接**: 如果数据库支持，建议启用 SSL (`MYSQL_SSL=true`)
3. **配置索引**: 确保数据库表已正确创建索引（自动迁移已包含）

### 边缘函数优化

1. **静态路由优先**: 常用 API 路径已创建独立边缘函数文件，避免每次都通过 `[[default]].js`
2. **动态路由兜底**: `[[default]].js` 处理所有动态路由和 WebDAV 请求
3. **冷启动优化**: 边缘函数文件体积小，启动快速

### 应用优化

1. **使用 CDN**: EdgeOne 自带 CDN 加速，无需额外配置
2. **缓存策略**: 静态资源自动缓存，API 响应根据业务需求配置
3. **分片大小**: EdgeOne Pages 支持略高的并发，分片大小已优化为 6MB

## 与 Cloudflare Workers 部署的对比

| 特性 | Cloudflare Workers | EdgeOne Pages |
|-----|-------------------|---------------|
| 数据库 | Cloudflare D1 (SQLite) | MySQL |
| 对象存储 | R2 / 其他 S3 | R2 / 其他 S3 |
| 定时任务 | Cron Triggers | 暂不支持 |
| 部署方式 | Wrangler CLI | EdgeOne Console / CLI |
| 路由方式 | 统一入口 + 内部路由 | 边缘函数文件 + 默认处理器 |
| 环境变量 | `CLOUD_PLATFORM=cloudflare` | `CLOUD_PLATFORM=edgeone` |

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

## 相关文档

- [EdgeOne Pages 官方文档](https://cloud.tencent.com/document/product/1552)
- [EdgeOne 边缘函数文档](https://cloud.tencent.com/document/product/1552/127419)
- [主 README](README_CN.md)
- [API 文档](Api-doc.md)

## 技术支持

如遇到问题，请：

1. 查看本文档的故障排查章节
2. 在 [GitHub Issues](https://github.com/sxwzxc/CloudPaste/issues) 提交问题
3. 加入社区讨论

## 许可证

本项目使用 Apache License 2.0 许可证。详见 [LICENSE](LICENSE) 文件。

---

**祝您部署成功！如有问题，欢迎反馈。** 🎉
