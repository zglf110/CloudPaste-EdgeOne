/**
 * MySQL Provider
 * - 使用 MySQL 数据库作为存储后端
 * - 支持腾讯云 EdgeOne Pages 等需要外部 MySQL 的环境
 * - 实现数据库初始化和迁移功能
 */

import { mysqlDialect } from "../dialects/mysqlDialect.js";
import { applyMigrations } from "../migrations/runner.js";
import { sqliteMigrations } from "../migrations/sqlite/index.js";

export const mysqlProvider = {
  name: "mysql",
  dialect: mysqlDialect,

  /**
   * 确保数据库结构可用（初始化/迁移）
   * @param {{ db:any, dialect:any, env:any, providerName:string }} runtime
   */
  async ensureReady(runtime) {
    console.log("[MySQL] 开始初始化/迁移 MySQL 数据库");

    // 复用 SQLite 迁移脚本，但使用 MySQL 方言进行转换
    // MySQLAdapter 已经在内部处理了 SQLite 到 MySQL 的语法转换
    await applyMigrations(runtime, sqliteMigrations);

    console.log("[MySQL] 数据库初始化/迁移完成");
  },
};

