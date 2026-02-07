# EdgeOne 边缘函数 API 路径更新说明

## 更新概述

根据腾讯云 EdgeOne Pages 边缘函数文档要求（[https://cloud.tencent.com/document/product/1552/127419](https://cloud.tencent.com/document/product/1552/127419)），本次更新实现了 API 路径到边缘函数文件的映射。

## 主要更改

### 1. 创建边缘函数文件（32 个）

在 `node-functions/api/` 目录下创建了与 API 路径对应的 JavaScript 文件：

```
node-functions/api/
├── admin/
│   ├── login.js              → /api/admin/login
│   ├── logout.js             → /api/admin/logout
│   ├── change-password.js    → /api/admin/change-password
│   ├── cache/
│   │   ├── stats.js          → /api/admin/cache/stats
│   │   └── clear.js          → /api/admin/cache/clear
│   ├── dashboard/
│   │   └── stats.js          → /api/admin/dashboard/stats
│   ├── storage-usage/
│   │   ├── report.js         → /api/admin/storage-usage/report
│   │   └── refresh.js        → /api/admin/storage-usage/refresh
│   ├── settings.js           → /api/admin/settings
│   ├── settings/
│   │   ├── groups.js         → /api/admin/settings/groups
│   │   └── metadata.js       → /api/admin/settings/metadata
│   └── backup/
│       ├── create.js         → /api/admin/backup/create
│       ├── restore.js        → /api/admin/backup/restore
│       ├── restore/
│       │   └── preview.js    → /api/admin/backup/restore/preview
│       └── modules.js        → /api/admin/backup/modules
├── health.js                 → /api/health
├── version.js                → /api/version
├── system/
│   └── max-upload-size.js    → /api/system/max-upload-size
├── user/
│   └── cache/
│       └── clear.js          → /api/user/cache/clear
├── test/
│   └── admin-token.js        → /api/test/admin-token
├── upload/
│   └── progress.js           → /api/upload/progress
├── mount/
│   ├── list.js               → /api/mount/list
│   └── create.js             → /api/mount/create
├── storage-config/
│   ├── list.js               → /api/storage-config/list
│   └── create.js             → /api/storage-config/create
├── api-keys/
│   ├── list.js               → /api/api-keys/list
│   └── create.js             → /api/api-keys/create
├── files.js                  → /api/files
├── share/
│   └── upload.js             → /api/share/upload
├── pastes.js                 → /api/pastes
└── fs/
    ├── browse.js             → /api/fs/browse
    └── write.js              → /api/fs/write
```

### 2. 边缘函数文件结构

每个边缘函数文件都遵循统一结构：

```javascript
// EdgeOne Pages Edge Function
// This file enables EdgeOne to route requests to the appropriate handler
// Path: /api/admin/login

import app from "../../_app.js";

/**
 * EdgeOne Pages request handler
 * Forwards requests to the Hono application
 */
export async function onRequest(context) {
  return app.fetch(context.request, context.env, context);
}
```

**关键点**：
- 使用相对路径导入 `_app.js`（根据文件深度自动计算）
- 导出 `onRequest` 函数（EdgeOne Pages 要求）
- 将请求转发给 Hono 应用处理

### 3. 更新 [[default]].js

增强了默认处理器的文档说明：

```javascript
// EdgeOne Pages Function Entry Point - Catch-All Handler
// This file exports the onRequest handler required by EdgeOne Pages
//
// This is a catch-all handler that processes all requests not matched by
// specific route files in the node-functions/api/ directory.
//
// EdgeOne Pages routing priority:
// 1. Static files from public/ directory
// 2. Exact match route files (e.g., node-functions/api/admin/login.js for /api/admin/login)
// 3. This [[default]].js catch-all handler (for dynamic routes, WebDAV, etc.)
//
// For more information about EdgeOne edge functions, see:
// https://cloud.tencent.com/document/product/1552/127419
```

### 4. 自动化脚本

创建了 `scripts/generate-edge-functions.sh` 脚本，可以自动生成所有边缘函数文件：

```bash
#!/bin/bash
# 自动生成所有 API 路由对应的边缘函数文件

./scripts/generate-edge-functions.sh
```

**功能**：
- 清理现有 `node-functions/api/` 目录
- 根据 API 路由列表生成对应文件
- 自动计算正确的相对导入路径
- 提供详细的生成日志

### 5. 文档整合

**创建**：
- `EDGEONE_GUIDE.md` - 完整的 EdgeOne Pages 部署指南，包含：
  - 边缘函数路由说明
  - API 路径映射表
  - 部署步骤
  - 环境变量配置
  - 故障排查
  - 性能优化建议

**删除**（合并到新指南）：
- `README_EDGEONE.md`
- `EDGEONE_DEPLOYMENT.md`
- `EDGEONE_QUICKSTART.md`
- `EDGEONE_NODE_FUNCTIONS_MIGRATION.md`
- `EDGEONE_RESTRUCTURE_SUMMARY.md`

**更新**：
- `README.md` - 更新 EdgeOne 部署链接和说明
- `README_CN.md` - 更新 EdgeOne 部署链接和说明

## EdgeOne 路由工作原理

### 路由优先级

EdgeOne Pages 按以下顺序处理请求：

1. **静态文件** (`public/` 目录)
   - 前端页面、CSS、JS、图片等
   - 直接由 EdgeOne CDN 服务

2. **精确匹配的边缘函数**
   - 例如：`/api/admin/login` → `node-functions/api/admin/login.js`
   - 这些文件作为独立的边缘函数执行
   - 启动快速，性能优化

3. **默认处理器** (`[[default]].js`)
   - 处理所有未匹配的请求
   - 包括动态路由（如 `/api/files/:id`）
   - 包括 WebDAV 请求
   - 包括其他特殊路由

### 为什么需要独立的边缘函数文件？

根据 EdgeOne 文档要求：

> "调用边缘函数 API 的路径需要修改，比如 `/api/admin/login` 这个路径，如果想要使用，需要在 `node-functions` 中有对应路径的 js"

**优势**：
1. **性能优化**：常用路由独立部署，避免每次都通过默认处理器
2. **冷启动优化**：小文件启动更快
3. **符合规范**：满足 EdgeOne Pages 的边缘函数要求
4. **易于维护**：清晰的文件结构，便于理解和修改

### 动态路由处理

动态路由（如 `/api/files/:id`）继续由 `[[default]].js` 处理，因为：
- 无法为每个可能的 ID 创建文件
- Hono 应用内部已经有完善的路由处理
- `[[default]].js` 作为兜底方案完美支持这种场景

## 使用指南

### 首次部署

1. **生成边缘函数文件**（如果尚未生成）：
   ```bash
   ./scripts/generate-edge-functions.sh
   ```

2. **配置环境变量**：
   - 在 EdgeOne Pages 控制台配置 `CLOUD_PLATFORM=edgeone`
   - 配置 MySQL 数据库连接信息
   - 配置 `ENCRYPTION_SECRET`

3. **部署**：
   ```bash
   # 使用 EdgeOne CLI
   edgeone pages deploy

   # 或通过 EdgeOne 控制台上传代码
   ```

### 添加新的 API 路由

当添加新的 API 路由时：

1. **编辑 `scripts/generate-edge-functions.sh`**，添加新路由：
   ```bash
   create_edge_function "/api/your/new/route" "$API_DIR/your/new/route.js"
   ```

2. **重新生成边缘函数文件**：
   ```bash
   ./scripts/generate-edge-functions.sh
   ```

3. **重新部署**：
   ```bash
   edgeone pages deploy
   ```

**注意**：如果新路由是动态路由（包含 `:id` 等参数），不需要创建单独的边缘函数文件，`[[default]].js` 会自动处理。

## 验证部署

部署完成后，可以通过以下方式验证：

1. **访问静态路由**：
   ```bash
   curl https://your-domain.com/api/health
   curl https://your-domain.com/api/version
   ```

2. **访问管理员登录**：
   ```bash
   curl -X POST https://your-domain.com/api/admin/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

3. **检查动态路由**（通过 [[default]].js）：
   ```bash
   curl https://your-domain.com/api/files/some-id
   ```

## 故障排查

### 问题：404 错误

**原因**：缺少对应的边缘函数文件

**解决**：
```bash
# 重新生成边缘函数文件
./scripts/generate-edge-functions.sh

# 确认文件存在
ls -la node-functions/api/admin/login.js

# 重新部署
edgeone pages deploy
```

### 问题：导入路径错误

**错误信息**：`Cannot find module '../_app.js'`

**解决**：
```bash
# 脚本会自动计算正确的相对路径
./scripts/generate-edge-functions.sh
```

### 问题：某些 API 正常，某些返回 404

**原因**：部分路由可能没有对应的边缘函数文件

**检查**：
```bash
# 查看已创建的边缘函数文件
find node-functions/api -name "*.js" -type f

# 如果缺少某个路由，编辑脚本并重新生成
```

## 技术细节

### 文件命名规范

- API 路径：`/api/admin/login`
- 文件路径：`node-functions/api/admin/login.js`
- 规则：去掉前导 `/api/`，保持目录结构，添加 `.js` 扩展名

### 导入路径计算

脚本自动计算相对路径：

| 文件位置 | 导入路径 | 深度 |
|---------|---------|------|
| `api/health.js` | `../_app.js` | 1 |
| `api/admin/login.js` | `../../_app.js` | 2 |
| `api/admin/backup/restore/preview.js` | `../../../../_app.js` | 4 |

**计算公式**：`深度 = API 路径中的 '/' 数量`

### 请求流程

```
客户端请求 /api/admin/login
    ↓
EdgeOne Pages 路由器
    ↓
检查 public/ 目录？ 否
    ↓
检查 node-functions/api/admin/login.js？ 是
    ↓
执行 onRequest(context)
    ↓
app.fetch(request, env, context)
    ↓
Hono 应用路由
    ↓
adminRoutes.post("/api/admin/login", ...)
    ↓
返回响应
```

## 相关资源

- **EdgeOne Pages 官方文档**: [https://cloud.tencent.com/document/product/1552](https://cloud.tencent.com/document/product/1552)
- **边缘函数文档**: [https://cloud.tencent.com/document/product/1552/127419](https://cloud.tencent.com/document/product/1552/127419)
- **部署指南**: [EDGEONE_GUIDE.md](EDGEONE_GUIDE.md)
- **API 文档**: [Api-doc.md](Api-doc.md)

## 总结

本次更新完全符合腾讯云 EdgeOne Pages 的边缘函数要求，通过以下方式实现：

✅ 为所有主要 API 路由创建独立的边缘函数文件
✅ 保留 `[[default]].js` 处理动态路由和特殊场景
✅ 提供自动化脚本简化维护
✅ 整合文档提供清晰的部署指南
✅ 保持代码简洁，避免重复

项目现在可以在 EdgeOne Pages 上顺利部署和运行！🎉
