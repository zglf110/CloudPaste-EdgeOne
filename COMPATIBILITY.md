# 兼容性说明 (Compatibility Notes)

本文档说明 CloudPaste 在支持腾讯云 EdgeOne Pages 部署后的兼容性保证。

## 向后兼容性保证

### Cloudflare Workers 部署

✅ **完全兼容** - 现有的 Cloudflare Workers 部署不受影响，无需任何修改即可继续使用。

- **数据库**: 继续使用 Cloudflare D1
- **环境检测**: 自动检测为 Cloudflare 环境
- **配置文件**: wrangler.toml 无需修改
- **部署方式**: 继续使用 `wrangler deploy`

### Docker 部署

✅ **完全兼容** - Docker 部署方式保持不变。

- **数据库**: 继续使用 SQLite
- **环境检测**: 自动检测为 Docker 环境
- **配置文件**: docker-compose.yml 无需修改

## 新增功能

### 腾讯云 EdgeOne Pages 支持

新增对腾讯云 EdgeOne Pages 的原生支持：

- **数据库**: MySQL (公网可访问)
- **对象存储**: Cloudflare R2 或其他 S3 兼容存储
- **环境变量**: 通过 `CLOUD_PLATFORM=edgeone` 显式指定

## 环境检测逻辑

系统采用以下优先级检测运行环境：

1. **显式指定** (最高优先级)
   - 检查 `CLOUD_PLATFORM` 环境变量
   - 支持值: `edgeone`, `cloudflare`, `docker`

2. **自动检测**
   - Node.js 环境 → Docker
   - 有 `caches` API → Cloudflare Workers
   - 默认回退 → Cloudflare Workers (向后兼容)

### 环境变量示例

```bash
# EdgeOne Pages 部署
CLOUD_PLATFORM=edgeone
MYSQL_HOST=your-mysql-host.com
MYSQL_PORT=3306
MYSQL_USER=your_user
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=cloudpaste
ENCRYPTION_SECRET=your-secret-key

# Cloudflare Workers 部署
# 无需设置 CLOUD_PLATFORM，自动检测
# 使用 wrangler.toml 配置 D1 绑定

# Docker 部署
# 无需设置 CLOUD_PLATFORM，自动检测
ENCRYPTION_SECRET=your-secret-key
DATA_DIR=/data
```

## 代码级兼容性

### 修改的核心文件

1. **environmentUtils.js**
   - 新增 `getCloudPlatform()` 函数
   - 保持 `isCloudflareWorkerEnvironment()` 签名不变（添加可选参数）
   - 向后兼容：不传参数时仍可正常工作

2. **unified-entry.js**
   - 新增 EdgeOne/MySQL 初始化逻辑
   - Cloudflare Workers 逻辑保持不变
   - Docker 环境逻辑保持不变

3. **mysqlProvider.js**
   - 新增 MySQL 数据库提供者
   - 不影响现有 SQLite 提供者

### 新增文件

- `backend/src/adapters/MySQLAdapter.js` - MySQL 数据库适配器
- `EDGEONE_DEPLOYMENT.md` - EdgeOne 部署文档

### 依赖变更

- **新增可选依赖**: `mysql2` (optionalDependencies)
- **不影响现有部署**: 仅在使用 MySQL 时需要安装

## 功能差异

| 功能 | Cloudflare Workers | EdgeOne Pages | Docker |
|-----|-------------------|---------------|--------|
| 数据库 | D1 (SQLite) | MySQL | SQLite |
| 对象存储 | R2 / S3 | R2 / S3 | R2 / S3 / Local |
| 定时任务 | ✅ Cron Triggers | ❌ 暂不支持 | ✅ node-schedule |
| 自动扩缩容 | ✅ | ✅ | ❌ |
| 冷启动 | 有 | 有 | 无 |

## 迁移指南

### 从 Cloudflare Workers 迁移到 EdgeOne Pages

如需从 Cloudflare Workers 迁移到 EdgeOne Pages：

1. **导出 D1 数据**
   ```bash
   wrangler d1 export cloudpaste-db --output=backup.sql
   ```

2. **准备 MySQL 数据库**
   - 创建 MySQL 数据库
   - 配置用户权限

3. **转换并导入数据**
   - 转换 SQLite 语法为 MySQL 语法
   - 导入到 MySQL 数据库

4. **配置环境变量**
   - 设置 `CLOUD_PLATFORM=edgeone`
   - 配置 MySQL 连接信息

5. **部署到 EdgeOne Pages**

详细步骤请参考 [EDGEONE_DEPLOYMENT.md](EDGEONE_DEPLOYMENT.md)

## 测试建议

在生产环境部署前，建议进行以下测试：

### Cloudflare Workers 环境测试

```bash
cd backend
npm install
wrangler dev --local
```

验证：
- ✅ D1 数据库正常连接
- ✅ API 功能正常
- ✅ 文件上传下载正常

### EdgeOne Pages 环境测试

1. 准备测试用 MySQL 数据库
2. 设置环境变量
3. 本地测试：
   ```bash
   export CLOUD_PLATFORM=edgeone
   export MYSQL_HOST=...
   export MYSQL_USER=...
   export MYSQL_PASSWORD=...
   export MYSQL_DATABASE=...
   export ENCRYPTION_SECRET=test-secret
   npm run docker-dev
   ```

验证：
- ✅ MySQL 数据库连接成功
- ✅ 数据表自动创建
- ✅ API 功能正常
- ✅ 文件上传下载正常

### Docker 环境测试

```bash
cd backend
npm install
npm run docker-dev
```

验证：
- ✅ SQLite 数据库正常创建
- ✅ API 功能正常
- ✅ 文件上传下载正常

## 常见问题

### Q: 我现有的 Cloudflare Workers 部署需要修改吗？

**A**: 不需要。现有部署完全兼容，无需任何修改。

### Q: 如何确认我的环境被正确识别？

**A**: 查看应用日志，启动时会输出环境信息：
- Cloudflare Workers: 不会输出特殊日志
- EdgeOne Pages: 会输出 `[EdgeOne] 检测到 EdgeOne Pages 环境`
- Docker: 会输出 `CloudPaste 后端服务运行在...`

### Q: 可以在不同环境之间迁移数据吗？

**A**: 可以，但需要注意：
- SQLite ↔ MySQL: 需要转换 SQL 语法
- 对象存储: 可以直接使用相同的 R2/S3 配置

### Q: EdgeOne Pages 支持定时任务吗？

**A**: 暂不支持。定时任务功能在 EdgeOne Pages 环境下会被跳过。

### Q: 性能有差异吗？

**A**:
- **Cloudflare Workers**: D1 查询延迟低（边缘数据库）
- **EdgeOne Pages**: MySQL 查询延迟取决于数据库地理位置
- **Docker**: 本地 SQLite，延迟最低

建议：
- EdgeOne 部署时选择同区域的 MySQL 数据库
- 生产环境使用 CDN 加速静态资源

## 技术支持

如遇到兼容性问题，请：

1. 确认环境变量配置正确
2. 查看应用日志
3. 在 [GitHub Issues](https://github.com/ling-drag0n/CloudPaste/issues) 提交问题，说明：
   - 部署环境（Cloudflare/EdgeOne/Docker）
   - 错误日志
   - 环境变量配置（隐去敏感信息）

## 版本历史

### v1.9.2 (当前版本)
- ✨ 新增 EdgeOne Pages 支持
- ✨ 新增 MySQL 数据库支持
- 🔧 优化环境检测逻辑
- 📝 新增 EdgeOne 部署文档
- ✅ 保持向后兼容

### v1.9.1 (之前版本)
- 仅支持 Cloudflare Workers 和 Docker

---

**更新日期**: 2026-02-07
