/**
 * EdgeOne Pages Edge Function: Health Check
 * 
 * 端点：GET /api/health
 * 功能：检查系统健康状态，包括数据库连接状态
 * 
 * 使用方式：
 * curl http://localhost:3000/api/health
 * 
 * 返回示例 (成功):
 * {
 *   "success": true,
 *   "data": {
 *     "status": "ok",
 *     "timestamp": "2024-02-07T10:30:00Z",
 *     "database": "connected",
 *     "uptime": 12345
 *   }
 * }
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
  getRequestSummary,
} from '../_edgeone-utils.js';

const startTime = Date.now();

/**
 * 检查数据库连接
 * @returns {Promise<{connected: boolean, error?: string}>}
 */
async function checkDatabase() {
  try {
    const client = await createDbClient();
    await client.query('SELECT NOW()');
    await closeDbClient(client);
    return { connected: true };
  } catch (error) {
    logger.error('[health] Database check failed', {
      message: error.message,
      code: error.code,
    });
    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * 获取系统运行时间（毫秒）
 * @returns {number}
 */
function getUptime() {
  return Date.now() - startTime;
}

/**
 * 处理GET请求
 * @param {Object} context - EdgeOne上下文
 * @returns {Promise<Response>}
 */
async function handleGet(context) {
  const detailedCheck = context.request.url.includes('detailed=true');

  try {
    const dbStatus = await checkDatabase();

    const data = {
      status: dbStatus.connected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus.connected ? 'connected' : 'disconnected',
      uptime: Math.floor(getUptime() / 1000), // 转换为秒
    };

    if (detailedCheck && !dbStatus.connected) {
      data.database_error = dbStatus.error;
    }

    const statusCode = dbStatus.connected ? 200 : 503;
    return successResponse(data, statusCode);
  } catch (error) {
    return handleApiError(error, 'health:handleGet');
  }
}

/**
 * EdgeOne Pages 请求处理器
 *
 * @param {Object} context - EdgeOne上下文对象
 * @param {Request} context.request - HTTP请求对象
 * @param {Object} context.env - 环境变量对象
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
  const { request } = context;
  const method = request.method;

  logger.debug('[health] Incoming request', getRequestSummary(request));

  // 处理CORS预检
  if (method === 'OPTIONS') {
    logger.debug('[health] Handling CORS preflight');
    return handleCorsPreFlight();
  }

  // 只允许GET
  if (method !== 'GET') {
    return methodNotAllowed(method);
  }

  // 处理GET请求
  return handleGet(context);
}
