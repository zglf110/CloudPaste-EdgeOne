// MySQLAdapter - 在 EdgeOne Pages 环境使用外部 MySQL 数据库的适配器
// 兼容 Cloudflare D1 接口风格，用于与公网可访问的 MySQL 数据库交互

import { createLogger } from "../utils/logger.js";

/**
 * MySQL 数据库适配器
 * 模拟 D1 接口以保持代码兼容性
 */
export class MySQLAdapter {
  /**
   * @param {Object} config - MySQL 连接配置
   * @param {string} config.host - 数据库主机地址
   * @param {number} config.port - 数据库端口
   * @param {string} config.user - 数据库用户名
   * @param {string} config.password - 数据库密码
   * @param {string} config.database - 数据库名称
   * @param {boolean} [config.ssl] - 是否使用SSL连接
   * @param {any} [config.env] - 环境变量对象（用于日志配置）
   */
  constructor(config) {
    this.config = config;
    this.mysql = null;
    this.pool = null;
    this.logger = createLogger("MySQL", config.env || {});
  }

  /**
   * 初始化 MySQL 连接池
   */
  async init() {
    const startTime = Date.now();
    this.logger.info("开始初始化 MySQL 连接池", {
      host: this.config.host,
      port: this.config.port || 3306,
      database: this.config.database,
      ssl: !!this.config.ssl,
    });

    try {
      // 动态导入 mysql2，仅在需要时加载
      this.mysql = await import("mysql2/promise");

      this.pool = this.mysql.createPool({
        host: this.config.host,
        port: this.config.port || 3306,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        connectTimeout: 30000, // 30秒连接超时
        ssl: this.config.ssl ? { rejectUnauthorized: true } : undefined,
      });

      // 测试连接
      await this._healthCheck();

      this.logger.perf("MySQL 连接池初始化", startTime);
      return this;
    } catch (error) {
      this.logger.error("MySQL 连接池初始化失败", error);
      throw new Error(`MySQL 连接失败: ${error.message}`);
    }
  }

  /**
   * 健康检查 - 测试数据库连接
   * @private
   */
  async _healthCheck() {
    this.logger.db("执行健康检查");
    const connection = await this.pool.getConnection();
    try {
      await connection.ping();
      this.logger.db("健康检查通过");
    } finally {
      connection.release();
    }
  }

  /**
   * 准备 SQL 语句（模拟 D1 接口）
   * @param {string} sql - SQL 语句
   */
  prepare(sql) {
    // 将 SQLite 的 ? 占位符转换为 MySQL 的 ? 占位符（已兼容）
    // 但需要注意某些 SQL 语法差异
    const mysqlSql = this._convertSqliteToMySQL(sql);
    const logger = this.logger;

    return {
      sql: mysqlSql,
      params: [],
      _pool: this.pool,
      _logger: logger,

      bind(...args) {
        this.params = args;
        return this;
      },

      async run() {
        const startTime = Date.now();
        let connection;
        try {
          connection = await this._pool.getConnection();
          this._logger.db("执行 SQL (run)", { operation: "run" });
          this._logger.sql(this.sql, this.params);
          
          const [result] = await connection.execute(this.sql, this.params);
          const changes = result.affectedRows || 0;
          
          this._logger.sql(this.sql, this.params, Date.now() - startTime);
          this._logger.db("SQL 执行成功 (run)", { 
            changes, 
            insertId: result.insertId,
            duration_ms: Date.now() - startTime 
          });
          
          return {
            success: true,
            changes,
            meta: {
              changes,
              last_row_id: result.insertId || null,
            },
          };
        } catch (error) {
          this._logger.error("SQL 执行失败 (run)", {
            sql: this.sql,
            params: this.params,
            error: error.message,
            duration_ms: Date.now() - startTime,
          });
          throw error;
        } finally {
          if (connection) {
            connection.release();
            this._logger.db("释放数据库连接");
          }
        }
      },

      async all() {
        const startTime = Date.now();
        let connection;
        try {
          connection = await this._pool.getConnection();
          this._logger.db("执行 SQL (all)", { operation: "all" });
          this._logger.sql(this.sql, this.params);
          
          const [rows] = await connection.execute(this.sql, this.params);
          
          this._logger.sql(this.sql, this.params, Date.now() - startTime);
          this._logger.db("SQL 执行成功 (all)", { 
            rowCount: rows.length,
            duration_ms: Date.now() - startTime 
          });
          
          return { results: rows };
        } catch (error) {
          this._logger.error("SQL 执行失败 (all)", {
            sql: this.sql,
            params: this.params,
            error: error.message,
            duration_ms: Date.now() - startTime,
          });
          throw error;
        } finally {
          if (connection) {
            connection.release();
            this._logger.db("释放数据库连接");
          }
        }
      },

      async first() {
        const startTime = Date.now();
        let connection;
        try {
          connection = await this._pool.getConnection();
          this._logger.db("执行 SQL (first)", { operation: "first" });
          this._logger.sql(this.sql, this.params);
          
          const [rows] = await connection.execute(this.sql, this.params);
          const result = rows.length > 0 ? rows[0] : null;
          
          this._logger.sql(this.sql, this.params, Date.now() - startTime);
          this._logger.db("SQL 执行成功 (first)", { 
            found: !!result,
            duration_ms: Date.now() - startTime 
          });
          
          return result;
        } catch (error) {
          this._logger.error("SQL 执行失败 (first)", {
            sql: this.sql,
            params: this.params,
            error: error.message,
            duration_ms: Date.now() - startTime,
          });
          throw error;
        } finally {
          if (connection) {
            connection.release();
            this._logger.db("释放数据库连接");
          }
        }
      },
    };
  }

  /**
   * 批量执行 SQL 语句
   * @param {Array} statements - SQL 语句数组
   */
  async batch(statements) {
    const startTime = Date.now();
    const connection = await this.pool.getConnection();
    
    this.logger.db("开始批量执行 SQL", { statementCount: statements.length });
    
    try {
      await connection.beginTransaction();
      this.logger.db("事务已开始");
      
      const results = [];

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        try {
          let sql, params;

          if (typeof statement === "string") {
            sql = this._convertSqliteToMySQL(statement);
            params = [];
          } else if (statement.sql || statement.text) {
            sql = this._convertSqliteToMySQL(statement.sql || statement.text);
            params = statement.params || [];
          } else {
            throw new Error("Invalid statement format");
          }

          this.logger.sql(sql, params);
          const [result] = await connection.execute(sql, params);
          
          results.push({
            success: true,
            result,
            meta: {
              changes: result.affectedRows || 0,
              last_row_id: result.insertId || null,
            }
          });
          
          this.logger.db(`语句 ${i + 1}/${statements.length} 执行成功`, {
            changes: result.affectedRows,
            insertId: result.insertId,
          });
        } catch (error) {
          this.logger.error(`语句 ${i + 1}/${statements.length} 执行失败，回滚事务`, {
            error: error.message,
            statement: i,
          });
          await connection.rollback();
          this.logger.db("事务已回滚");
          throw error;
        }
      }

      await connection.commit();
      this.logger.perf("批量 SQL 执行完成", startTime, { 
        statementCount: statements.length,
        totalResults: results.length 
      });
      
      return results;
    } catch (error) {
      this.logger.error("批量执行失败", error);
      try {
        await connection.rollback();
        this.logger.db("事务回滚成功");
      } catch (rollbackError) {
        this.logger.error("事务回滚失败", rollbackError);
      }
      throw error;
    } finally {
      connection.release();
      this.logger.db("释放数据库连接");
    }
  }

  /**
   * 执行原始 SQL（不推荐用于生产，主要用于迁移）
   * @param {string} sql - SQL 语句
   */
  async exec(sql) {
    const startTime = Date.now();
    const connection = await this.pool.getConnection();
    
    this.logger.db("执行原始 SQL (exec)");
    
    try {
      const mysqlSql = this._convertSqliteToMySQL(sql);
      
      // exec 可能包含多条语句，需要更安全地分割
      const statements = this._splitSqlStatements(mysqlSql);
      
      this.logger.db("原始 SQL 已分割", { statementCount: statements.length });

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          this.logger.sql(statement, []);
          await connection.query(statement);
          this.logger.db(`语句 ${i + 1}/${statements.length} 执行成功`);
        }
      }

      this.logger.perf("原始 SQL 执行完成", startTime, { statementCount: statements.length });
      return { success: true };
    } catch (error) {
      this.logger.error("原始 SQL 执行失败", error);
      throw error;
    } finally {
      connection.release();
      this.logger.db("释放数据库连接");
    }
  }

  /**
   * 分割 SQL 语句 - 更安全的方式，考虑字符串中的分号
   * @private
   * @param {string} sql - 包含多条语句的 SQL
   * @returns {Array<string>} SQL 语句数组
   */
  _splitSqlStatements(sql) {
    const statements = [];
    let current = "";
    let inString = false;
    let stringChar = null;
    let escaped = false;

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];

      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        current += char;
        continue;
      }

      if ((char === "'" || char === '"') && !inString) {
        inString = true;
        stringChar = char;
        current += char;
      } else if (char === stringChar && inString) {
        inString = false;
        stringChar = null;
        current += char;
      } else if (char === ";" && !inString) {
        if (current.trim()) {
          statements.push(current.trim());
        }
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      statements.push(current.trim());
    }

    return statements;
  }

  /**
   * 转换 SQLite SQL 到 MySQL SQL
   * 处理常见的语法差异
   * @param {string} sql - SQLite SQL 语句
   * @returns {string} MySQL SQL 语句
   */
  _convertSqliteToMySQL(sql) {
    let mysqlSql = sql;

    this.logger.debug("开始转换 SQL (SQLite -> MySQL)");

    // 1. AUTOINCREMENT -> AUTO_INCREMENT
    mysqlSql = mysqlSql.replace(/AUTOINCREMENT/gi, "AUTO_INCREMENT");

    // 2. DATETIME('now') -> NOW()
    mysqlSql = mysqlSql.replace(/DATETIME\s*\(\s*['"']now['"']\s*\)/gi, "NOW()");

    // 3. 处理 TEXT 类型（MySQL 中需要明确长度或使用 TEXT）
    // SQLite 的 TEXT 在 MySQL 中可以保持为 TEXT

    // 4. IF NOT EXISTS 在 MySQL 中也支持，保持不变

    // 5. 处理布尔类型：SQLite 使用 INTEGER(0/1)，MySQL 使用 TINYINT(1)
    mysqlSql = mysqlSql.replace(/INTEGER\s+DEFAULT\s+0/gi, "TINYINT(1) DEFAULT 0");
    mysqlSql = mysqlSql.replace(/INTEGER\s+DEFAULT\s+1/gi, "TINYINT(1) DEFAULT 1");

    // 6. BLOB -> LONGBLOB (for larger binary data)
    mysqlSql = mysqlSql.replace(/\bBLOB\b/gi, "LONGBLOB");

    this.logger.debug("SQL 转换完成");

    return mysqlSql;
  }

  /**
   * 获取连接池状态
   * @returns {Object} 连接池统计信息
   */
  getPoolStatus() {
    if (!this.pool) {
      return null;
    }

    try {
      // mysql2 连接池状态（如果可用）
      const status = {
        totalConnections: this.pool._allConnections?.length || 0,
        freeConnections: this.pool._freeConnections?.length || 0,
        queuedRequests: this.pool._connectionQueue?.length || 0,
      };
      
      this.logger.pool(status);
      return status;
    } catch (error) {
      this.logger.warn("无法获取连接池状态", { error: error.message });
      return null;
    }
  }

  /**
   * 关闭连接池
   */
  async close() {
    if (this.pool) {
      this.logger.info("关闭 MySQL 连接池");
      try {
        await this.pool.end();
        this.pool = null;
        this.logger.info("MySQL 连接池已关闭");
      } catch (error) {
        this.logger.error("关闭连接池失败", error);
        throw error;
      }
    }
  }
}

/**
 * 从环境变量创建 MySQL 适配器
 * @param {Object} env - 环境变量对象
 * @returns {Promise<MySQLAdapter>} MySQL 适配器实例
 */
export async function createMySQLAdapterFromEnv(env) {
  const logger = createLogger("MySQL", env);
  
  // 支持多种环境变量命名格式
  const config = {
    host: env.MYSQL_HOST || env.DB_HOST || env.DATABASE_HOST,
    port: parseInt(env.MYSQL_PORT || env.DB_PORT || "3306", 10),
    user: env.MYSQL_USER || env.DB_USER || env.DATABASE_USER,
    password: env.MYSQL_PASSWORD || env.DB_PASSWORD || env.DATABASE_PASSWORD,
    database: env.MYSQL_DATABASE || env.DB_NAME || env.DATABASE_NAME,
    ssl: env.MYSQL_SSL === "true" || env.DB_SSL === "true",
    env, // 传递环境变量用于日志配置
  };

  logger.info("从环境变量创建 MySQL 适配器", {
    host: config.host,
    port: config.port,
    database: config.database,
    ssl: config.ssl,
  });

  // 验证必需的配置
  if (!config.host || !config.user || !config.password || !config.database) {
    const missingFields = [];
    if (!config.host) missingFields.push("MYSQL_HOST");
    if (!config.user) missingFields.push("MYSQL_USER");
    if (!config.password) missingFields.push("MYSQL_PASSWORD");
    if (!config.database) missingFields.push("MYSQL_DATABASE");
    
    logger.error("MySQL 配置不完整", { missingFields });
    throw new Error(
      `MySQL 配置不完整。缺少以下环境变量: ${missingFields.join(", ")}`
    );
  }

  const adapter = new MySQLAdapter(config);
  await adapter.init();
  return adapter;
}

/**
 * 工厂函数：创建并初始化 MySQL 适配器
 * @param {Object} config - MySQL 配置对象
 * @returns {Promise<MySQLAdapter>} MySQL 适配器实例
 */
export async function createMySQLAdapter(config) {
  const adapter = new MySQLAdapter(config);
  await adapter.init();
  return adapter;
}
