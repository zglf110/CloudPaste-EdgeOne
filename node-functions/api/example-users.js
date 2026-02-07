/**
 * EdgeOne Pages Edge Function: 用户管理示例端点
 * 
 * 端点：
 * - GET /api/example/users - 获取用户列表（需要认证）
 * - POST /api/example/users - 创建用户（需要管理员认证）
 * - DELETE /api/example/users/{id} - 删除用户（需要管理员认证）
 * 
 * 这是一个完整的示例，展示如何：
 * 1. 处理不同HTTP方法
 * 2. 实现认证检查
 * 3. 执行数据库操作
 * 4. 进行输入验证
 * 5. 处理错误
 * 6. 返回适当的响应
 */

import {
  logger,
  successResponse,
  errorResponse,
  handleCorsPreFlight,
  handleApiError,
  methodNotAllowed,
  createDbClient,
  closeDbClient,
  parseJsonBody,
  handleAuthHeader,
  validateRequired,
  getRequestSummary,
  getRequestHeaders,
} from '../_edgeone-utils.js';

/**
 * 验证用户是否为管理员
 * @param {Object} user - 用户信息
 * @returns {boolean}
 */
function isAdmin(user) {
  return user && user.role === 'admin';
}

/**
 * 处理GET /api/example/users
 * 获取所有用户（仅限认证用户）
 */
async function handleGetUsers(request) {
  const headers = getRequestHeaders(request);
  const authHeader = headers['authorization'];

  // 检查认证
  const user = handleAuthHeader(authHeader);
  if (!user) {
    logger.warn('[users:handleGetUsers] Unauthorized access attempt');
    return errorResponse('Unauthorized', 401);
  }

  let client;
  try {
    client = await createDbClient();

    // 普通用户只能查看自己，管理员可以查看所有
    const query = isAdmin(user)
      ? 'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
      : 'SELECT id, username, email, created_at FROM users WHERE id = $1';

    const params = isAdmin(user) ? [] : [user.userId];
    const result = await client.query(query, params);

    logger.info('[users:handleGetUsers] Users retrieved', {
      count: result.rows.length,
      isAdmin: isAdmin(user),
    });

    return successResponse({ users: result.rows });
  } catch (error) {
    return handleApiError(error, 'users:handleGetUsers');
  } finally {
    await closeDbClient(client);
  }
}

/**
 * 处理POST /api/example/users
 * 创建新用户（仅限管理员）
 */
async function handleCreateUser(request) {
  const headers = getRequestHeaders(request);
  const authHeader = headers['authorization'];

  // 检查认证
  const user = handleAuthHeader(authHeader);
  if (!user || !isAdmin(user)) {
    logger.warn('[users:handleCreateUser] Unauthorized access attempt', {
      hasToken: !!authHeader,
      isAdmin: user ? isAdmin(user) : false,
    });
    return errorResponse('Forbidden - admin access required', 403);
  }

  try {
    // 解析请求体
    const body = await parseJsonBody(request);
    logger.debug('[users:handleCreateUser] Request body parsed', {
      keys: Object.keys(body),
    });

    // 验证必需参数
    const missing = validateRequired(body, ['username', 'email', 'password']);
    if (missing) {
      return errorResponse(`Missing required fields: ${missing.join(', ')}`, 400);
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return errorResponse('Invalid email format', 400);
    }

    // 验证密码长度
    if (body.password.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    let client;
    try {
      client = await createDbClient();

      // 检查用户是否已存在
      const existsResult = await client.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [body.username, body.email]
      );

      if (existsResult.rows.length > 0) {
        return errorResponse('Username or email already exists', 409);
      }

      // 创建新用户（生产环境应该哈希密码）
      const result = await client.query(
        'INSERT INTO users (username, email, password, role, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, username, email, role, created_at',
        [body.username, body.email, body.password, body.role || 'user']
      );

      logger.info('[users:handleCreateUser] User created successfully', {
        userId: result.rows[0].id,
        username: body.username,
      });

      return successResponse(
        { user: result.rows[0] },
        201 // 201 Created
      );
    } finally {
      await closeDbClient(client);
    }
  } catch (error) {
    return handleApiError(error, 'users:handleCreateUser');
  }
}

/**
 * 处理DELETE /api/example/users/{id}
 * 删除用户（仅限管理员）
 */
async function handleDeleteUser(request) {
  const headers = getRequestHeaders(request);
  const authHeader = headers['authorization'];

  // 检查认证
  const user = handleAuthHeader(authHeader);
  if (!user || !isAdmin(user)) {
    return errorResponse('Forbidden - admin access required', 403);
  }

  try {
    // 从URL提取用户ID
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const userId = pathParts[pathParts.length - 1];

    if (!userId || isNaN(userId)) {
      return errorResponse('Invalid user ID', 400);
    }

    let client;
    try {
      client = await createDbClient();

      // 删除用户
      const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

      if (result.rows.length === 0) {
        return errorResponse('User not found', 404);
      }

      logger.info('[users:handleDeleteUser] User deleted', { userId });
      return successResponse({ message: 'User deleted successfully' });
    } finally {
      await closeDbClient(client);
    }
  } catch (error) {
    return handleApiError(error, 'users:handleDeleteUser');
  }
}

/**
 * EdgeOne Pages 请求处理器
 * @param {Object} context - EdgeOne上下文
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
  const { request } = context;
  const method = request.method;
  const url = new URL(request.url);

  logger.debug('[users] Incoming request', {
    ...getRequestSummary(request),
    pathname: url.pathname,
  });

  // 处理CORS预检
  if (method === 'OPTIONS') {
    return handleCorsPreFlight();
  }

  // 根据路径和方法路由请求
  const pathParts = url.pathname.split('/').filter(p => p);
  const lastPart = pathParts[pathParts.length - 1];

  // GET /api/example/users 或 GET /api/example/users/{id}
  if (method === 'GET') {
    return handleGetUsers(request);
  }

  // POST /api/example/users
  if (method === 'POST' && lastPart !== 'users') {
    return methodNotAllowed(method);
  }

  if (method === 'POST') {
    return handleCreateUser(request);
  }

  // DELETE /api/example/users/{id}
  if (method === 'DELETE') {
    return handleDeleteUser(request);
  }

  return methodNotAllowed(method);
}
