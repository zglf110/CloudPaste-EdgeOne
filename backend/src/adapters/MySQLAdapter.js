// MySQLAdapter - 在 EdgeOne Pages 环境使用外部 MySQL 数据库的适配器
// 兼容 Cloudflare D1 接口风格，用于与公网可访问的 MySQL 数据库交互

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
   */
  constructor(config) {
    this.config = config;
    this.mysql = null;
    this.pool = null;
  }

  /**
   * 初始化 MySQL 连接池
   */
  async init() {
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
      ssl: this.config.ssl ? { rejectUnauthorized: true } : undefined,
    });

    return this;
  }

  /**
   * 准备 SQL 语句（模拟 D1 接口）
   * @param {string} sql - SQL 语句
   */
  prepare(sql) {
    // 将 SQLite 的 ? 占位符转换为 MySQL 的 ? 占位符（已兼容）
    // 但需要注意某些 SQL 语法差异
    const mysqlSql = this._convertSqliteToMySQL(sql);

    return {
      sql: mysqlSql,
      params: [],
      _pool: this.pool,

      bind(...args) {
        this.params = args;
        return this;
      },

      async run() {
        const connection = await this._pool.getConnection();
        try {
          const [result] = await connection.execute(this.sql, this.params);
          const changes = result.affectedRows || 0;
          return {
            success: true,
            changes,
            meta: {
              changes,
              last_row_id: result.insertId || null,
            },
          };
        } finally {
          connection.release();
        }
      },

      async all() {
        const connection = await this._pool.getConnection();
        try {
          const [rows] = await connection.execute(this.sql, this.params);
          return { results: rows };
        } finally {
          connection.release();
        }
      },

      async first() {
        const connection = await this._pool.getConnection();
        try {
          const [rows] = await connection.execute(this.sql, this.params);
          return rows.length > 0 ? rows[0] : null;
        } finally {
          connection.release();
        }
      },
    };
  }

  /**
   * 批量执行 SQL 语句
   * @param {Array} statements - SQL 语句数组
   */
  async batch(statements) {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const results = [];

      for (const statement of statements) {
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

          const [result] = await connection.execute(sql, params);
          results.push({
            success: true,
            result,
            meta: {
              changes: result.affectedRows || 0,
              last_row_id: result.insertId || null,
            }
          });
        } catch (error) {
          await connection.rollback();
          throw error;
        }
      }

      await connection.commit();
      return results;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 执行原始 SQL（不推荐用于生产，主要用于迁移）
   * @param {string} sql - SQL 语句
   */
  async exec(sql) {
    const connection = await this.pool.getConnection();
    try {
      const mysqlSql = this._convertSqliteToMySQL(sql);
      // exec 可能包含多条语句，需要分割执行
      const statements = mysqlSql.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          await connection.query(statement);
        }
      }

      return { success: true };
    } finally {
      connection.release();
    }
  }

  /**
   * 转换 SQLite SQL 到 MySQL SQL
   * 处理常见的语法差异
   * @param {string} sql - SQLite SQL 语句
   * @returns {string} MySQL SQL 语句
   */
  _convertSqliteToMySQL(sql) {
    let mysqlSql = sql;

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

    return mysqlSql;
  }

  /**
   * 关闭连接池
   */
  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

/**
 * 从环境变量创建 MySQL 适配器
 * @param {Object} env - 环境变量对象
 * @returns {Promise<MySQLAdapter>} MySQL 适配器实例
 */
export async function createMySQLAdapterFromEnv(env) {
  // 支持多种环境变量命名格式
  const config = {
    host: env.MYSQL_HOST || env.DB_HOST || env.DATABASE_HOST,
    port: parseInt(env.MYSQL_PORT || env.DB_PORT || "3306", 10),
    user: env.MYSQL_USER || env.DB_USER || env.DATABASE_USER,
    password: env.MYSQL_PASSWORD || env.DB_PASSWORD || env.DATABASE_PASSWORD,
    database: env.MYSQL_DATABASE || env.DB_NAME || env.DATABASE_NAME,
    ssl: env.MYSQL_SSL === "true" || env.DB_SSL === "true",
  };

  // 验证必需的配置
  if (!config.host || !config.user || !config.password || !config.database) {
    throw new Error(
      "MySQL 配置不完整。需要设置: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE"
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
