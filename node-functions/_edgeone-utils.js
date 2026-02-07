/**
 * EdgeOne Pages 边缘函数工具库
 * 
 * 提供以下功能：
 * - 数据库连接管理
 * - 日志记录系统
 * - 请求/响应处理（JSON、CORS）
 * - JWT 认证处理
 * - 错误处理
 * 
 * 这个文件适配 EdgeOne Pages 标准的 onRequest(context) 入口
 */

import { Client } from 'pg';
import jwt from 'jsonwebtoken';

// ============ 环境变量配置 ============

export const DB_CONFIG = {
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === 'true' 
    ? { rejectUnauthorized: false } 
    : false,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  max: parseInt(process.env.DB_POOL_MAX || '10'),
};

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';
export const ENABLE_DEBUG_LOGS = process.env.ENABLE_DEBUG_LOGS === 'true';
export const CORS_ALLOW_ORIGIN = process.env.CORS_ALLOW_ORIGIN || '*';
export const CORS_ALLOW_METHODS = process.env.CORS_ALLOW_METHODS || 'GET, POST, PUT, DELETE, OPTIONS';
export const CORS_ALLOW_HEADERS = process.env.CORS_ALLOW_HEADERS || 'Content-Type, Authorization';

// ============ 日志系统 ============

/**
 * 日志工具对象
 */
export const logger = {
  /**
   * 记录信息日志
   */
  info: (message, data) => {
    console.log(`[${new Date().toISOString()}] [INFO] ${message}`, data ? JSON.stringify(data) : '');
  },

  /**
   * 记录错误日志
   */
  error: (message, data) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, data ? JSON.stringify(data) : '');
  },

  /**
   * 记录调试日志（仅在启用调试模式时记录）
   */
  debug: (message, data) => {
    if (ENABLE_DEBUG_LOGS) {
      console.log(`[${new Date().toISOString()}] [DEBUG] ${message}`, data ? JSON.stringify(data) : '');
    }
  },

  /**
   * 记录警告日志
   */
  warn: (message, data) => {
    console.warn(`[${new Date().toISOString()}] [WARN] ${message}`, data ? JSON.stringify(data) : '');
  },
};

// 在模块加载时记录环境配置
logger.info('[_edgeone-utils] EdgeOne edge function utilities initialized', {
  debugEnabled: ENABLE_DEBUG_LOGS,
  dbHost: DB_CONFIG.host,
  dbDatabase: DB_CONFIG.database,
  hasJWTSecret: !!JWT_SECRET,
  corsOrigin: CORS_ALLOW_ORIGIN,
});

// ============ 数据库操作 ============

/**
 * 创建数据库客户端
 * @returns {Promise<Client>} 数据库客户端
 * @throws {Error} 当数据库配置不完整或连接失败时
 */
export async function createDbClient() {
  logger.debug('[createDbClient] Initializing database client', {
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    database: DB_CONFIG.database,
    timeout: DB_CONFIG.connectionTimeoutMillis,
  });

  // 验证数据库配置
  const missingFields = [];
  if (!DB_CONFIG.host) missingFields.push('DATABASE_HOST');
  if (!DB_CONFIG.database) missingFields.push('DATABASE_NAME');
  if (!DB_CONFIG.user) missingFields.push('DATABASE_USER');
  if (!DB_CONFIG.password) missingFields.push('DATABASE_PASSWORD');

  if (missingFields.length > 0) {
    const error = `Missing database configuration: ${missingFields.join(', ')}`;
    logger.error('[createDbClient] Configuration error', { missingFields });
    throw new Error(error);
  }

  try {
    const client = new Client(DB_CONFIG);
    logger.debug('[createDbClient] Connecting to database...');
    await client.connect();
    logger.debug('[createDbClient] Database connection established');
    return client;
  } catch (error) {
    logger.error('[createDbClient] Connection failed', {
      message: error.message,
      code: error.code,
      host: DB_CONFIG.host,
    });
    throw error;
  }
}

/**
 * 执行数据库查询
 * @param {Client} client - 数据库客户端
 * @param {string} query - SQL查询
 * @param {Array} params - 查询参数
 * @returns {Promise<Object>} 查询结果
 */
export async function executeQuery(client, query, params = []) {
  try {
    logger.debug('[executeQuery] Executing SQL', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      paramCount: params.length,
    });
    const result = await client.query(query, params);
    logger.debug('[executeQuery] Query successful', {
      rows: result.rowCount,
    });
    return result;
  } catch (error) {
    logger.error('[executeQuery] Query failed', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    throw error;
  }
}

/**
 * 关闭数据库连接
 * @param {Client} client - 数据库客户端
 */
export async function closeDbClient(client) {
  if (client) {
    try {
      logger.debug('[closeDbClient] Closing database connection');
      await client.end();
      logger.debug('[closeDbClient] Connection closed');
    } catch (error) {
      logger.error('[closeDbClient] Error closing connection', {
        message: error.message,
      });
    }
  }
}

// ============ 请求处理 ============

/**
 * 解析请求体
 * @param {Request} request - HTTP请求对象
 * @returns {Promise<Object>} 解析后的JSON对象
 */
export async function parseJsonBody(request) {
  try {
    const text = await request.text();
    logger.debug('[parseJsonBody] Request text received', {
      length: text.length,
      hasContent: !!text,
    });

    if (!text) {
      return {};
    }

    const parsed = JSON.parse(text);
    logger.debug('[parseJsonBody] Body parsed successfully', {
      keys: Object.keys(parsed),
    });
    return parsed;
  } catch (error) {
    logger.error('[parseJsonBody] Parse error', {
      message: error.message,
      name: error.name,
    });
    throw new Error(`Invalid JSON body: ${error.message}`);
  }
}

/**
 * 获取请求headers
 * @param {Request} request - HTTP请求对象
 * @returns {Object} headers对象
 */
export function getRequestHeaders(request) {
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

/**
 * 从Authorization header中提取token
 * @param {string} authHeader - Authorization header值
 * @returns {string|null} token或null
 */
export function extractToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// ============ 响应处理 ============

/**
 * 创建JSON响应
 * @param {*} data - 响应数据
 * @param {number} status - HTTP状态码
 * @param {Object} headers - 自定义headers
 * @returns {Response} 响应对象
 */
export function jsonResponse(data, status = 200, headers = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Max-Age': '86400',
  };

  return new Response(JSON.stringify(data), {
    status,
    headers: { ...defaultHeaders, ...headers },
  });
}

/**
 * 创建成功响应
 * @param {*} data - 响应数据
 * @param {number} status - HTTP状态码（默认200）
 * @returns {Response} 响应对象
 */
export function successResponse(data, status = 200) {
  return jsonResponse({ success: true, data }, status);
}

/**
 * 创建错误响应
 * @param {string} message - 错误消息
 * @param {number} status - HTTP状态码
 * @param {*} details - 错误详情
 * @returns {Response} 响应对象
 */
export function errorResponse(message, status = 400, details = null) {
  const error = {
    success: false,
    error: {
      message,
      timestamp: new Date().toISOString(),
    },
  };

  if (details) {
    error.error.details = details;
  }

  return jsonResponse(error, status);
}

/**
 * 处理CORS预检请求
 * @returns {Response} 204响应
 */
export function handleCorsPreFlight() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
      'Access-Control-Allow-Methods': CORS_ALLOW_METHODS,
      'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}

// ============ JWT认证 ============

/**
 * 生成JWT token
 * @param {Object} payload - token payload
 * @param {string} expiresIn - 过期时间
 * @returns {string} JWT token
 * @throws {Error} 当JWT_SECRET未配置时
 */
export function generateToken(payload, expiresIn = JWT_EXPIRE) {
  if (!JWT_SECRET) {
    logger.error('[generateToken] JWT_SECRET is not configured');
    throw new Error('JWT_SECRET is not configured');
  }

  try {
    logger.debug('[generateToken] Generating token', {
      expiresIn,
      payloadKeys: Object.keys(payload),
    });
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn });
    logger.debug('[generateToken] Token generated successfully');
    return token;
  } catch (error) {
    logger.error('[generateToken] Token generation failed', {
      message: error.message,
      name: error.name,
    });
    throw error;
  }
}

/**
 * 验证JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} 解码的payload或null
 */
export function verifyToken(token) {
  if (!JWT_SECRET) {
    logger.error('[verifyToken] JWT_SECRET is not configured');
    return null;
  }

  try {
    logger.debug('[verifyToken] Verifying token');
    const decoded = jwt.verify(token, JWT_SECRET);
    logger.debug('[verifyToken] Token verified successfully');
    return decoded;
  } catch (error) {
    logger.error('[verifyToken] Token verification failed', {
      message: error.message,
      name: error.name,
    });
    return null;
  }
}

/**
 * 处理认证header
 * @param {string} authHeader - Authorization header值
 * @returns {Object|null} 解码的用户信息或null
 */
export function handleAuthHeader(authHeader) {
  const token = extractToken(authHeader);
  if (!token) {
    logger.debug('[handleAuthHeader] No bearer token found');
    return null;
  }

  return verifyToken(token);
}

// ============ 错误处理 ============

/**
 * 处理API错误
 * @param {Error} error - 错误对象
 * @param {string} context - 错误上下文（函数名）
 * @returns {Response} 错误响应
 */
export function handleApiError(error, context = 'unknown') {
  logger.error(`[${context}] Error occurred`, {
    message: error.message,
    name: error.name,
    code: error.code,
  });

  // 数据库相关错误
  if (error.code && error.code.startsWith('PG')) {
    return errorResponse(
      'Database error occurred',
      500,
      { code: error.code, type: 'database' }
    );
  }

  // JWT相关错误
  if (error.name === 'JsonWebTokenError') {
    return errorResponse('Invalid token', 401, { type: 'auth' });
  }

  if (error.name === 'TokenExpiredError') {
    return errorResponse('Token expired', 401, { type: 'auth' });
  }

  // 验证错误
  if (error.name === 'ValidationError') {
    return errorResponse(error.message, 400, { type: 'validation' });
  }

  // 默认错误
  return errorResponse('Internal server error', 500);
}

// ============ 请求路由辅助 ============

/**
 * 检查HTTP方法
 * @param {string} method - 实际方法
 * @param {string|string[]} allowed - 允许的方法
 * @returns {boolean} 是否允许
 */
export function isMethodAllowed(method, allowed) {
  const allowedMethods = Array.isArray(allowed) ? allowed : [allowed];
  return allowedMethods.includes(method);
}

/**
 * 创建方法不允许响应
 * @param {string} method - 请求方法
 * @returns {Response} 405响应
 */
export function methodNotAllowed(method) {
  logger.warn('[methodNotAllowed] Method not allowed', { method });
  return errorResponse(`Method ${method} not allowed`, 405);
}

// ============ 验证辅助 ============

/**
 * 验证必需参数
 * @param {Object} data - 数据对象
 * @param {string[]} required - 必需字段
 * @returns {Object|null} 缺失字段对象或null
 */
export function validateRequired(data, required) {
  const missing = [];
  for (const field of required) {
    if (!data[field]) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    logger.warn('[validateRequired] Missing required fields', { missing });
    return missing;
  }

  return null;
}

/**
 * 验证环境变量
 * @param {string[]} required - 必需的环境变量名
 * @returns {string[]} 缺失的环境变量
 */
export function validateEnvironment(required) {
  const missing = [];
  for (const variable of required) {
    if (!process.env[variable]) {
      missing.push(variable);
    }
  }

  if (missing.length > 0) {
    logger.error('[validateEnvironment] Missing environment variables', { missing });
  }

  return missing;
}

/**
 * 获取请求信息摘要
 * @param {Request} request - HTTP请求对象
 * @returns {Object} 请求信息摘要
 */
export function getRequestSummary(request) {
  return {
    method: request.method,
    url: request.url,
    headers: {
      'content-type': request.headers.get('content-type'),
      'user-agent': request.headers.get('user-agent'),
      'authorization': request.headers.get('authorization') ? '[REDACTED]' : undefined,
    },
  };
}

// 导出整个日志对象便于访问
export default {
  logger,
  DB_CONFIG,
  JWT_SECRET,
  ENABLE_DEBUG_LOGS,
  createDbClient,
  closeDbClient,
  parseJsonBody,
  jsonResponse,
  successResponse,
  errorResponse,
  handleCorsPreFlight,
  generateToken,
  verifyToken,
  handleAuthHeader,
  handleApiError,
  validateRequired,
  validateEnvironment,
  methodNotAllowed,
  handleCorsPreFlight,
};
