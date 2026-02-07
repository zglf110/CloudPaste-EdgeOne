/**
 * 统一日志工具
 * 支持通过环境变量控制日志级别和类型
 * 
 * 环境变量:
 * - DEBUG_LOG: 启用调试日志 (true/false)
 * - DEBUG_SQL: 启用 SQL 查询日志 (true/false)
 * - DEBUG_DB: 启用数据库操作日志 (true/false)
 * - LOG_LEVEL: 日志级别 (debug/info/warn/error)
 */

import { toBool } from "./environmentUtils.js";

/**
 * 日志级别定义
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * 获取当前日志级别
 * @param {any} env - 环境变量对象
 * @returns {string} 日志级别
 */
function getLogLevel(env = {}) {
  const level = env?.LOG_LEVEL || (typeof process !== "undefined" ? process.env?.LOG_LEVEL : null) || "info";
  return level.toLowerCase();
}

/**
 * 检查是否应该输出特定级别的日志
 * @param {string} level - 要检查的日志级别
 * @param {any} env - 环境变量对象
 * @returns {boolean} 是否应该输出
 */
function shouldLog(level, env = {}) {
  const currentLevel = getLogLevel(env);
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * 检查是否启用了 SQL 日志
 * @param {any} env - 环境变量对象
 * @returns {boolean} 是否启用
 */
function isSqlLogEnabled(env = {}) {
  const envValue = env?.DEBUG_SQL || (typeof process !== "undefined" ? process.env?.DEBUG_SQL : null);
  return toBool(envValue, false);
}

/**
 * 检查是否启用了数据库日志
 * @param {any} env - 环境变量对象
 * @returns {boolean} 是否启用
 */
function isDbLogEnabled(env = {}) {
  const envValue = env?.DEBUG_DB || (typeof process !== "undefined" ? process.env?.DEBUG_DB : null);
  return toBool(envValue, false);
}

/**
 * 检查是否启用了调试日志
 * @param {any} env - 环境变量对象
 * @returns {boolean} 是否启用
 */
function isDebugLogEnabled(env = {}) {
  const envValue = env?.DEBUG_LOG || (typeof process !== "undefined" ? process.env?.DEBUG_LOG : null);
  return toBool(envValue, false);
}

/**
 * 格式化日志消息
 * @param {string} category - 日志类别
 * @param {string} message - 日志消息
 * @param {Object} [data] - 附加数据
 * @returns {string} 格式化后的消息
 */
function formatMessage(category, message, data = null) {
  const timestamp = new Date().toISOString();
  let formatted = `[${timestamp}] [${category}] ${message}`;
  
  if (data && Object.keys(data).length > 0) {
    formatted += ` ${JSON.stringify(data)}`;
  }
  
  return formatted;
}

/**
 * Logger 类 - 提供环境感知的日志功能
 */
export class Logger {
  /**
   * @param {string} category - 日志类别（如 "MySQL", "EdgeOne"）
   * @param {any} env - 环境变量对象
   */
  constructor(category, env = {}) {
    this.category = category;
    this.env = env;
  }

  /**
   * 调试日志
   * @param {string} message - 日志消息
   * @param {Object} [data] - 附加数据
   */
  debug(message, data = null) {
    if (shouldLog("debug", this.env) || isDebugLogEnabled(this.env)) {
      console.log(formatMessage(this.category, message, data));
    }
  }

  /**
   * 信息日志
   * @param {string} message - 日志消息
   * @param {Object} [data] - 附加数据
   */
  info(message, data = null) {
    if (shouldLog("info", this.env)) {
      console.log(formatMessage(this.category, message, data));
    }
  }

  /**
   * 警告日志
   * @param {string} message - 日志消息
   * @param {Object} [data] - 附加数据
   */
  warn(message, data = null) {
    if (shouldLog("warn", this.env)) {
      console.warn(formatMessage(this.category, message, data));
    }
  }

  /**
   * 错误日志
   * @param {string} message - 日志消息
   * @param {Object|Error} [data] - 附加数据或错误对象
   */
  error(message, data = null) {
    if (shouldLog("error", this.env)) {
      if (data instanceof Error) {
        console.error(formatMessage(this.category, message, {
          error: data.message,
          stack: data.stack,
        }));
      } else {
        console.error(formatMessage(this.category, message, data));
      }
    }
  }

  /**
   * SQL 查询日志（仅在 DEBUG_SQL=true 时输出）
   * @param {string} sql - SQL 语句
   * @param {Array} [params] - 查询参数
   * @param {number} [duration] - 执行时间（毫秒）
   */
  sql(sql, params = [], duration = null) {
    if (isSqlLogEnabled(this.env)) {
      const data = { sql };
      if (params && params.length > 0) {
        data.params = params;
      }
      if (duration !== null) {
        data.duration_ms = duration;
      }
      console.log(formatMessage(`${this.category}/SQL`, "", data));
    }
  }

  /**
   * 数据库操作日志（仅在 DEBUG_DB=true 时输出）
   * @param {string} operation - 操作类型
   * @param {Object} [data] - 附加数据
   */
  db(operation, data = null) {
    if (isDbLogEnabled(this.env)) {
      console.log(formatMessage(`${this.category}/DB`, operation, data));
    }
  }

  /**
   * 性能日志 - 记录操作执行时间
   * @param {string} operation - 操作名称
   * @param {number} startTime - 开始时间（Date.now()）
   * @param {Object} [data] - 附加数据
   */
  perf(operation, startTime, data = null) {
    if (isDebugLogEnabled(this.env)) {
      const duration = Date.now() - startTime;
      this.debug(`${operation} 完成`, { ...data, duration_ms: duration });
    }
  }

  /**
   * 连接池状态日志
   * @param {Object} poolStats - 连接池统计信息
   */
  pool(poolStats) {
    if (isDbLogEnabled(this.env)) {
      console.log(formatMessage(`${this.category}/Pool`, "连接池状态", poolStats));
    }
  }
}

/**
 * 创建 Logger 实例
 * @param {string} category - 日志类别
 * @param {any} env - 环境变量对象
 * @returns {Logger} Logger 实例
 */
export function createLogger(category, env = {}) {
  return new Logger(category, env);
}

/**
 * 辅助函数：测量异步操作执行时间
 * @param {Function} fn - 异步函数
 * @param {Logger} logger - Logger 实例
 * @param {string} operationName - 操作名称
 * @returns {Promise<any>} 操作结果
 */
export async function measureAsync(fn, logger, operationName) {
  const startTime = Date.now();
  try {
    const result = await fn();
    logger.perf(operationName, startTime);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`${operationName} 失败`, { duration_ms: duration, error: error.message });
    throw error;
  }
}
