# EdgeOne Pages 边缘函数最佳实践指南

## 概述

本指南展示如何在 CloudPaste 中实现符合 EdgeOne Pages 标准的边缘函数。EdgeOne Pages 提供轻量级的无服务器计算能力，适合实现 API 端点和动态内容处理。

---

## 1. 函数入口标准

### EdgeOne Pages 要求

每个边缘函数必须导出 `onRequest` 函数作为入口点：

```javascript
export async function onRequest(context) {
  const { request, env } = context;
  // 处理请求
  return new Response('Hello');
}
```

### 上下文对象 (context)

| 属性 | 类型 | 说明 |
|------|------|------|
| `context.request` | `Request` | HTTP请求对象 |
| `context.env` | `Object` | 环境变量对象 |
| `context.waitUntil` | `Function` | 延长请求生命周期（可选） |

---

## 2. 目录结构

推荐的 CloudPaste node-functions 目录结构：

```
node-functions/
├── _edgeone-utils.js          # 共享工具库（必需）
├── api/
│   ├── [[default]].js         # 捕获所有路由的通用处理器
│   ├── health.js              # GET /api/health
│   ├── files.js               # 文件相关端点
│   ├── pastes.js              # 文本相关端点
│   └── user/
│       ├── profile.js         # GET /api/user/profile
│       └── settings.js        # GET/PUT /api/user/settings
├── auth/
│   ├── login.js               # POST /api/auth/login
│   ├── register.js            # POST /api/auth/register
│   └── logout.js              # POST /api/auth/logout
├── admin/
│   ├── users.js               # 用户管理
│   └── system.js              # 系统管理
├── constants/
│   └── index.js               # 常量定义
├── db/
│   └── index.js               # 数据库配置和初始化
├── utils/
│   ├── logger.js              # 日志工具
│   └── validators.js          # 验证工具
└── middleware/
    ├── auth.js                # 认证中间件
    └── errorHandler.js        # 错误处理中间件
```

---

## 3. 共享工具库 (_edgeone-utils.js)

CloudPaste 提供了改进的工具库，包含以下功能：

### 3.1 日志系统

```javascript
import { logger } from './_edgeone-utils.js';

// 记录信息
logger.info('Operation completed', { userId: 123 });

// 记录错误
logger.error('Operation failed', { error: e.message });

// 记录调试信息（仅在ENABLE_DEBUG_LOGS=true时输出）
logger.debug('Detailed state', { internal: 'data' });

// 记录警告
logger.warn('Unusual condition', { detail: 'value' });
```

### 3.2 数据库操作

```javascript
import { createDbClient, closeDbClient } from './_edgeone-utils.js';

let client;
try {
  client = await createDbClient();
  const result = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
  // 处理结果...
} finally {
  await closeDbClient(client);
}
```

**重要：** 始终在 finally 块中关闭数据库连接。

### 3.3 响应处理

```javascript
import {
  successResponse,
  errorResponse,
  jsonResponse,
} from './_edgeone-utils.js';

// 成功响应
return successResponse({ user: userData }, 200);

// 错误响应
return errorResponse('Invalid input', 400, { field: 'email' });

// 自定义响应
return jsonResponse({ custom: 'data' }, 200);
```

### 3.4 认证和授权

```javascript
import { handleAuthHeader, verifyToken } from './_edgeone-utils.js';

// 从请求header提取并验证token
const authHeader = request.headers.get('authorization');
const user = handleAuthHeader(authHeader);

if (!user) {
  return errorResponse('Unauthorized', 401);
}

// 使用用户信息
console.log(user.userId, user.role);
```

### 3.5 CORS处理

```javascript
import { handleCorsPreFlight } from './_edgeone-utils.js';

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsPreFlight();
  }

  // 其他处理...
}
```

---

## 4. API 端点实现

### 4.1 基础结构

所有API端点应遵循以下模式：

```javascript
/**
 * 端点说明
 * GET /api/endpoint
 */

import {
  logger,
  successResponse,
  errorResponse,
  handleCorsPreFlight,
  getRequestSummary,
} from '../_edgeone-utils.js';

export async function onRequest(context) {
  const { request } = context;
  const method = request.method;

  logger.debug('Incoming request', getRequestSummary(request));

  // 处理CORS预检
  if (method === 'OPTIONS') {
    return handleCorsPreFlight();
  }

  // 方法路由
  if (method === 'GET') {
    return handleGet(request);
  }

  if (method === 'POST') {
    return handlePost(request);
  }

  // 不支持的方法
  return errorResponse(`Method ${method} not allowed`, 405);
}

async function handleGet(request) {
  try {
    // 处理逻辑...
    return successResponse({ data: 'value' });
  } catch (error) {
    logger.error('Get failed', { message: error.message });
    return errorResponse('Internal server error', 500);
  }
}

async function handlePost(request) {
  // 类似的处理...
}
```

### 4.2 标准 HTTP 方法处理

```javascript
// GET - 安全、幂等
async function handleGet(request) {
  // 查询参数处理
  const url = new URL(request.url);
  const query = url.searchParams.get('query');
  
  // 返回成功响应
  return successResponse({ results: [] }, 200);
}

// POST - 创建资源
async function handlePost(request) {
  const body = await parseJsonBody(request);
  // 创建逻辑...
  return successResponse({ resource }, 201); // 201 Created
}

// PUT - 完全替换资源
async function handlePut(request) {
  const body = await parseJsonBody(request);
  // 更新逻辑...
  return successResponse({ resource });
}

// DELETE - 删除资源
async function handleDelete(request) {
  // 删除逻辑...
  return successResponse({ message: 'Deleted' });
}

// PATCH - 部分更新资源
async function handlePatch(request) {
  const body = await parseJsonBody(request);
  // 部分更新逻辑...
  return successResponse({ resource });
}
```

### 4.3 认证和授权

```javascript
import { handleAuthHeader } from '../_edgeone-utils.js';

async function handleGetProfile(request) {
  // 检查认证
  const authHeader = request.headers.get('authorization');
  const user = handleAuthHeader(authHeader);

  if (!user) {
    return errorResponse('Unauthorized', 401);
  }

  // 检查权限
  if (user.role !== 'admin' && user.role !== 'moderator') {
    return errorResponse('Forbidden', 403);
  }

  // 处理请求...
  return successResponse({ user });
}
```

### 4.4 输入验证

```javascript
import { validateRequired } from '../_edgeone-utils.js';

async function handleCreateUser(request) {
  const body = await parseJsonBody(request);

  // 验证必需字段
  const missing = validateRequired(body, ['username', 'email', 'password']);
  if (missing) {
    return errorResponse(
      `Missing required fields: ${missing.join(', ')}`,
      400
    );
  }

  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return errorResponse('Invalid email format', 400);
  }

  // 验证密码强度
  if (body.password.length < 8) {
    return errorResponse('Password must be at least 8 characters', 400);
  }

  // 继续处理...
}
```

---

## 5. 错误处理

### 5.1 错误响应格式

统一的错误响应格式：

```javascript
{
  "success": false,
  "error": {
    "message": "Error description",
    "timestamp": "2024-02-07T10:30:00Z",
    "details": { /* 可选的详细信息 */ }
  }
}
```

### 5.2 常见HTTP状态码

| 代码 | 含义 | 使用场景 |
|------|------|--------|
| 200 | OK | 成功获取资源 |
| 201 | Created | 成功创建资源 |
| 204 | No Content | 成功，但无返回内容 |
| 400 | Bad Request | 客户端错误（验证失败） |
| 401 | Unauthorized | 未认证或认证失败 |
| 403 | Forbidden | 已认证但权限不足 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突（如重复） |
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器错误 |
| 503 | Service Unavailable | 服务不可用 |

### 5.3 统一错误处理

```javascript
import { handleApiError } from '../_edgeone-utils.js';

export async function onRequest(context) {
  try {
    // 处理请求...
  } catch (error) {
    return handleApiError(error, 'endpoint-name');
  }
}

// handleApiError 自动根据错误类型返回合适的响应
```

---

## 6. 环境变量配置

### 6.1 必需的环境变量

```bash
# 数据库（PostgreSQL）
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=cloudpaste
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_SSL=false

# JWT认证
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d

# 日志
ENABLE_DEBUG_LOGS=false

# CORS
CORS_ALLOW_ORIGIN=*
CORS_ALLOW_METHODS=GET, POST, PUT, DELETE, OPTIONS
CORS_ALLOW_HEADERS=Content-Type, Authorization
```

### 6.2 访问环境变量

```javascript
// 在 _edgeone-utils.js 中已经导出了常用配置
import {
  DB_CONFIG,
  JWT_SECRET,
  ENABLE_DEBUG_LOGS,
  CORS_ALLOW_ORIGIN,
} from '../_edgeone-utils.js';

// 访问其他环境变量
const customValue = process.env.CUSTOM_VARIABLE;
```

---

## 7. 数据库最佳实践

### 7.1 连接管理

```javascript
let client;
try {
  client = await createDbClient();
  
  // 执行查询...
  const result = await client.query(sql, params);
  
  return successResponse({ data: result.rows });
} catch (error) {
  // 错误处理...
  return handleApiError(error, 'operation-name');
} finally {
  // 始终关闭连接
  await closeDbClient(client);
}
```

### 7.2 参数化查询

**✅ 正确：** 使用参数化查询防止SQL注入

```javascript
const result = await client.query(
  'SELECT * FROM users WHERE id = $1 AND status = $2',
  [userId, 'active']
);
```

**❌ 错误：** 字符串拼接（易受SQL注入攻击）

```javascript
const result = await client.query(
  `SELECT * FROM users WHERE id = ${userId}`
);
```

### 7.3 事务处理

```javascript
let client;
try {
  client = await createDbClient();
  
  await client.query('BEGIN');
  
  try {
    // 多个操作...
    await client.query('INSERT INTO items...', [data1]);
    await client.query('UPDATE balance...', [data2]);
    
    await client.query('COMMIT');
    logger.info('Transaction committed');
  } catch (innerError) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: innerError.message });
    throw innerError;
  }
} finally {
  await closeDbClient(client);
}
```

---

## 8. 性能优化

### 8.1 请求超时

EdgeOne 通常有请求时间限制（如30秒）：

```javascript
// 为长时间操作添加超时处理
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Request timeout')), 25000)
);

try {
  const result = await Promise.race([
    longRunningOperation(),
    timeoutPromise
  ]);
} catch (error) {
  return errorResponse('Operation timeout', 504);
}
```

### 8.2 数据库连接池

在 DB_CONFIG 中配置连接池：

```javascript
export const DB_CONFIG = {
  // ...
  max: 10,                    // 最大连接数
  idleTimeoutMillis: 30000,   // 空闲连接超时
  connectionTimeoutMillis: 10000, // 连接超时
};
```

### 8.3 缓存策略

```javascript
// 简单的内存缓存（注意：不会在请求间持留）
const cache = new Map();

function getCached(key) {
  return cache.get(key);
}

function setCached(key, value, ttlSeconds = 60) {
  cache.set(key, value);
  setTimeout(() => cache.delete(key), ttlSeconds * 1000);
}
```

### 8.4 响应压缩

边缘环境通常自动处理压缩，但可以显式控制：

```javascript
return new Response(JSON.stringify(largeData), {
  headers: {
    'Content-Type': 'application/json',
    'Content-Encoding': 'gzip', // 让平台处理压缩
  },
});
```

---

## 9. 安全最佳实践

### 9.1 身份验证和授权

```javascript
// 验证token并检查权限
const user = handleAuthHeader(request.headers.get('authorization'));

if (!user) {
  return errorResponse('Unauthorized', 401);
}

if (user.role !== 'admin') {
  return errorResponse('Forbidden', 403);
}
```

### 9.2 输入验证和清理

```javascript
// 验证和清理用户输入
const email = body.email.trim().toLowerCase();
const username = body.username.trim().substring(0, 50);

if (!isValidEmail(email)) {
  return errorResponse('Invalid email', 400);
}
```

### 9.3 避免敏感信息泄露

```javascript
// ❌ 错误：暴露内部错误信息
return errorResponse(error.toString(), 500);

// ✅ 正确：返回通用错误消息
return errorResponse('Internal server error', 500);

// ✅ 正确：仅在调试模式下暴露详情
if (ENABLE_DEBUG_LOGS) {
  return errorResponse(error.message, 500);
}
```

### 9.4 CORS 配置

```javascript
// 为生产环境指定具体的来源
const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || 'https://yourdomain.com';

// 不要盲目信任所有来源
export const CORS_ALLOW_ORIGIN = '*'; // 仅用于开发！
```

---

## 10. 调试和测试

### 10.1 启用调试日志

```bash
# 设置环境变量
ENABLE_DEBUG_LOGS=true
```

### 10.2 使用 curl 测试

```bash
# GET 请求
curl http://localhost:3000/api/health

# POST 请求
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com"}'

# 带认证的请求
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/user/profile

# 包含所有细节的调试请求
curl -v http://localhost:3000/api/endpoint
```

### 10.3 日志查看

在 EdgeOne Pages 控制台查看实时日志：

```javascript
// 日志会输出到控制台
logger.info('Operation started', { userID: 123 });
logger.debug('Internal state', { data: 'value' });
logger.error('Error occurred', { error: e.message });
```

---

## 11. 从 Hono 框架迁移

如果现有代码使用 Hono 框架，可以逐步迁移到 EdgeOne Pages 本地函数：

### 11.1 收益

| 方面 | Hono 框架 | 边缘函数 |
|------|----------|--------|
| 冷启动 | ~100ms | ~10ms |
| 包大小 | ~100KB | ~10KB |
| 内存 | ~40MB | ~10MB |
| 复杂度 | 高 | 低 |

### 11.2 迁移步骤

1. **创建 `_edgeone-utils.js`** - 提供共享工具

2. **灵活的路由** - 使用 `[[default]].js` 和单个端点文件

3. **渐进式迁移** - 一次迁移一个端点

4. **测试** - 对每个迁移的端点进行测试

### 11.3 迁移示例

**Hono 版本：**
```javascript
// _app.js
import { Hono } from 'hono';

const app = new Hono();

app.get('/api/users', async (c) => {
  const users = await getUsers();
  return c.json({ users });
});

export default app;
```

**迁移后的 EdgeOne 版本：**
```javascript
// api/users.js
import { successResponse } from '../_edgeone-utils.js';

export async function onRequest(context) {
  if (context.request.method === 'GET') {
    const users = await getUsers();
    return successResponse({ users });
  }
  return errorResponse('Method not allowed', 405);
}
```

---

## 12. 常见问题

### Q: 边缘函数有请求大小限制吗？

**A:** 是的，通常限制为 10MB。对于大文件上传，考虑使用分块上传或直接存储到S3。

### Q: 如何实现长时间运行的任务？

**A:** 不要在请求中运行长时间任务。改用：
- WebDAV 后台处理
- 定时任务（Scheduled Functions）
- 外部任务队列

### Q: 数据库连接会在请求间保留吗？

**A:** 否。每个请求都应该管理自己的连接。考虑使用连接池。

### Q: 如何处理私有路由和认证？

**A:** 在边缘函数中实现认证逻辑，验证JWT或API密钥。

---

## 参考资源

- [EdgeOne Pages 官方文档](https://cloud.tencent.com/document/product/1552/)
- [PostgreSQL Node.js 驱动](https://node-postgres.com/)
- [JWT 认证](https://jwt.io/)

---

## 样板文件

使用提供的样板文件作为参考：

- `_edgeone-utils.js` - 完整的工具库
- `api/health-edgeone.js` - 健康检查端点示例
- `api/example-users.js` - 完整的CRUD API示例
- `api/template-router.js` - 路由器模式示例

---

*最后更新：2024年2月7日*
