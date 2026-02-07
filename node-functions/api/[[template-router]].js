/**
 * EdgeOne Pages Edge Function: 路由处理器基础模板
 * 
 * 这是一个可复用的模板，展示如何在EdgeOne边缘函数中实现各种路由模式
 * 
 * 特点：
 * - 清晰的方法路由
 * - 一致的错误处理
 * - 内置认证检查
 * - 完整的日志记录
 * 
 * 使用示例：
 * 创建一个新的API文件，使用这个模板作为基础
 */

import {
  logger,
  successResponse,
  errorResponse,
  handleCorsPreFlight,
  handleApiError,
  methodNotAllowed,
  parseJsonBody,
  handleAuthHeader,
  validateRequired,
  getRequestSummary,
  createDbClient,
  closeDbClient,
} from '../_edgeone-utils.js';

/**
 * API路由处理器类
 * 提供标准的路由管理和中间件支持
 */
class ApiRouter {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.routes = new Map();
  }

  /**
   * 注册GET处理器
   */
  get(path, handler) {
    const key = `GET:${path}`;
    this.routes.set(key, handler);
    return this;
  }

  /**
   * 注册POST处理器
   */
  post(path, handler) {
    const key = `POST:${path}`;
    this.routes.set(key, handler);
    return this;
  }

  /**
   * 注册PUT处理器
   */
  put(path, handler) {
    const key = `PUT:${path}`;
    this.routes.set(key, handler);
    return this;
  }

  /**
   * 注册DELETE处理器
   */
  delete(path, handler) {
    const key = `DELETE:${path}`;
    this.routes.set(key, handler);
    return this;
  }

  /**
   * 处理请求
   */
  async handle(request) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    logger.debug(`[${this.moduleName}] Route lookup`, {
      method,
      path,
    });

    // 精确匹配
    const exactKey = `${method}:${path}`;
    if (this.routes.has(exactKey)) {
      const handler = this.routes.get(exactKey);
      return handler(request);
    }

    // 检查是否有动态参数的匹配
    for (const [routeKey, handler] of this.routes.entries()) {
      const [routeMethod, routePath] = routeKey.split(':');
      if (routeMethod === method) {
        const routePattern = routePath.replace(/:[^/]+/g, '[^/]+');
        const routeRegex = new RegExp(`^${routePattern}$`);
        if (routeRegex.test(path)) {
          return handler(request);
        }
      }
    }

    return methodNotAllowed(method);
  }
}

/**
 * 认证中间件
 * 检查用户是否已认证
 */
function requireAuth(handler) {
  return async (request) => {
    const authHeader = request.headers.get('authorization');
    const user = handleAuthHeader(authHeader);

    if (!user) {
      logger.warn('[middleware] Auth required but not provided');
      return errorResponse('Unauthorized', 401);
    }

    // 将用户信息附加到请求对象
    request.user = user;
    return handler(request);
  };
}

/**
 * 管理员权限中间件
 */
function requireAdmin(handler) {
  return requireAuth(async (request) => {
    if (request.user.role !== 'admin') {
      logger.warn('[middleware] Admin required', {
        userId: request.user.userId,
        role: request.user.role,
      });
      return errorResponse('Forbidden - admin access required', 403);
    }

    return handler(request);
  });
}

/**
 * 请求日志中间件
 */
function withLogging(moduleName, handler) {
  return async (request) => {
    const startTime = Date.now();
    let response;

    try {
      response = await handler(request);
    } catch (error) {
      logger.error(`[${moduleName}] Unhandled error`, {
        message: error.message,
        stack: error.stack,
      });
      response = errorResponse('Internal server error', 500);
    }

    const duration = Date.now() - startTime;
    logger.debug(`[${moduleName}] Request completed`, {
      status: response.status,
      duration: `${duration}ms`,
    });

    return response;
  };
}

/**
 * 格式化日期
 */
function formatDate(date) {
  return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
}

// ============ 示例处理器 ============

/**
 * 获取资源列表
 */
const getItems = requireAuth(async (request) => {
  let client;
  try {
    client = await createDbClient();
    const result = await client.query('SELECT * FROM items WHERE user_id = $1 LIMIT 100', [
      request.user.userId,
    ]);

    logger.info('[example] Items retrieved', {
      userId: request.user.userId,
      count: result.rows.length,
    });

    return successResponse({
      items: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    return handleApiError(error, 'example:getItems');
  } finally {
    await closeDbClient(client);
  }
});

/**
 * 创建资源
 */
const createItem = requireAuth(async (request) => {
  try {
    const body = await parseJsonBody(request);

    // 验证
    const missing = validateRequired(body, ['title']);
    if (missing) {
      return errorResponse(`Missing required fields: ${missing.join(', ')}`, 400);
    }

    let client;
    try {
      client = await createDbClient();
      const result = await client.query(
        'INSERT INTO items (user_id, title, description, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
        [request.user.userId, body.title, body.description || null]
      );

      logger.info('[example] Item created', {
        userId: request.user.userId,
        itemId: result.rows[0].id,
      });

      return successResponse({ item: result.rows[0] }, 201);
    } finally {
      await closeDbClient(client);
    }
  } catch (error) {
    return handleApiError(error, 'example:createItem');
  }
});

/**
 * 获取用户统计信息（仅管理员）
 */
const getStats = requireAdmin(async (request) => {
  let client;
  try {
    client = await createDbClient();
    const result = await client.query('SELECT COUNT(*) as total_items FROM items');

    logger.info('[example] Stats retrieved by admin', {
      adminId: request.user.userId,
    });

    return successResponse({
      stats: {
        totalItems: parseInt(result.rows[0].total_items),
      },
    });
  } catch (error) {
    return handleApiError(error, 'example:getStats');
  } finally {
    await closeDbClient(client);
  }
});

// ============ 路由配置 ============

const router = new ApiRouter('example-api');

// 应用日志中间件到所有处理器
router
  .get('/api/example/items', withLogging('example-api', getItems))
  .post('/api/example/items', withLogging('example-api', createItem))
  .get('/api/example/stats', withLogging('example-api', getStats));

// ============ EdgeOne Pages 处理器 ============

/**
 * 主请求处理器
 */
export async function onRequest(context) {
  const { request } = context;
  const method = request.method;

  logger.debug('[example-api] Incoming request', getRequestSummary(request));

  // 处理CORS预检
  if (method === 'OPTIONS') {
    return handleCorsPreFlight();
  }

  // 使用路由器处理请求
  try {
    return await router.handle(request);
  } catch (error) {
    return handleApiError(error, 'example-api:onRequest');
  }
}

// ============ 导出用于测试 ============

export { ApiRouter, requireAuth, requireAdmin, withLogging };
