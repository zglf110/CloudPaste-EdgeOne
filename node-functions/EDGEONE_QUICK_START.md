# EdgeOne Pages 边缘函数快速开始

## 基础函数模板

```javascript
/**
 * EdgeOne Pages Edge Function
 * Path: /api/example
 */

import {
  logger,
  successResponse,
  errorResponse,
  handleCorsPreFlight,
  methodNotAllowed,
  getRequestSummary,
} from '../_edgeone-utils.js';

export async function onRequest(context) {
  const { request } = context;
  const method = request.method;

  logger.debug('Request', getRequestSummary(request));

  // CORS 预检
  if (method === 'OPTIONS') {
    return handleCorsPreFlight();
  }

  // 路由
  if (method === 'GET') {
    return successResponse({ message: 'Hello' });
  }

  return methodNotAllowed(method);
}
```

## 常用导入

```javascript
import {
  logger,                    // 日志
  successResponse,           // 成功响应
  errorResponse,             // 错误响应
  handleCorsPreFlight,       // CORS处理
  createDbClient,            // 数据库连接
  closeDbClient,             // 关闭连接
  parseJsonBody,             // 解析请求体
  handleAuthHeader,          // 认证验证
  validateRequired,          // 字段验证
  methodNotAllowed,          // 方法不允许
  getRequestSummary,         // 请求摘要
  handleApiError,            // 错误处理
} from '../_edgeone-utils.js';
```

## 处理数据库查询

```javascript
let client;
try {
  client = await createDbClient();
  const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
  return successResponse({ data: result.rows });
} catch (error) {
  return handleApiError(error, 'operation-name');
} finally {
  await closeDbClient(client);
}
```

## 认证检查

```javascript
const authHeader = request.headers.get('authorization');
const user = handleAuthHeader(authHeader);

if (!user) {
  return errorResponse('Unauthorized', 401);
}

// user.userId, user.role 等
```

## 输入验证

```javascript
const body = await parseJsonBody(request);

const missing = validateRequired(body, ['name', 'email']);
if (missing) {
  return errorResponse(`Missing: ${missing.join(', ')}`, 400);
}
```

## 日志记录

```javascript
logger.info('User created', { userId: 123 });
logger.error('Operation failed', { error: e.message });
logger.debug('Debug info', { data: value }); // 仅在调试模式
logger.warn('Warning message', { detail: 'info' });
```

## HTTP 方法路由

```javascript
export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return handleCorsPreFlight();
  }

  switch (request.method) {
    case 'GET':
      return handleGet(request);
    case 'POST':
      return handlePost(request);
    case 'PUT':
      return handlePut(request);
    case 'DELETE':
      return handleDelete(request);
    default:
      return methodNotAllowed(request.method);
  }
}
```

## 错误响应示例

```javascript
// 验证错误
return errorResponse('Invalid input', 400, { field: 'email' });

// 认证错误
return errorResponse('Unauthorized', 401);

// 权限错误
return errorResponse('Forbidden', 403);

// 资源不存在
return errorResponse('Not found', 404);

// 服务器错误
return errorResponse('Internal error', 500);
```

## 成功响应示例

```javascript
// 获取成功
return successResponse({ user: userData }, 200);

// 创建成功（201）
return successResponse({ user: newData }, 201);

// 仅返回消息
return successResponse({ message: 'Operation completed' });
```

## 环境变量使用

```javascript
// 数据库配置（自动从 DB_CONFIG 导入）
// DATABASE_HOST, DATABASE_NAME, DATABASE_USER 等

// JWT密钥
import { JWT_SECRET } from '../_edgeone-utils.js';

// 访问其他变量
const maxUploadSize = process.env.MAX_UPLOAD_SIZE_MB;
```

## 设置环境变量

在 EdgeOne 控制台的函数配置中设置：

```
DATABASE_HOST=your-host
DATABASE_NAME=your-db
DATABASE_USER=your-user
DATABASE_PASSWORD=your-password
JWT_SECRET=your-secret-key
ENABLE_DEBUG_LOGS=false
```

## 测试端点

```bash
# 简单请求
curl http://localhost:3000/api/endpoint

# 带参数的GET
curl "http://localhost:3000/api/users?limit=10"

# POST请求
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com"}'

# 带认证的请求
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/protected

# 调试模式（显示内容长度等）
curl -v http://localhost:3000/api/endpoint
```

## 参考示例

- `api/health-edgeone.js` - 健康检查
- `api/example-users.js` - 完整CRUD示例
- `api/template-router.js` - 路由器用法

---

*更多详情见 EDGEONE_BEST_PRACTICES.md*
