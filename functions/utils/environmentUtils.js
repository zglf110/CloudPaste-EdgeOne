/**
 * 环境检测和配置工具
 * 用于根据部署环境（Cloudflare Worker vs EdgeOne Pages vs Docker/Server）提供最优配置
 */

/**
 * 获取云平台类型
 * @param {any} env - 环境变量对象
 * @returns {'cloudflare'|'edgeone'|'docker'} 云平台类型
 */
export function getCloudPlatform(env = {}) {
  // 优先使用显式指定的 CLOUD_PLATFORM 环境变量
  const explicit = env?.CLOUD_PLATFORM || (typeof process !== "undefined" ? process.env?.CLOUD_PLATFORM : null);
  if (explicit) {
    const normalized = String(explicit).toLowerCase();
    if (normalized === "edgeone" || normalized === "tencent" || normalized === "tencent-edgeone") {
      return "edgeone";
    }
    if (normalized === "cloudflare" || normalized === "cf") {
      return "cloudflare";
    }
    if (normalized === "docker" || normalized === "node") {
      return "docker";
    }
  }

  // 自动检测：如果在 Node.js 环境，默认为 docker
  if (typeof process !== "undefined" && process.versions && process.versions.node) {
    return "docker";
  }

  // 自动检测：Cloudflare Workers 环境特征
  if (typeof caches !== "undefined" && typeof Response !== "undefined") {
    return "cloudflare";
  }

  // 默认返回 cloudflare（向后兼容）
  return "cloudflare";
}

/**
 * 检测当前是否运行在Cloudflare Worker环境
 * @param {any} env - 环境变量对象
 * @returns {boolean} 是否为Worker环境
 */
export function isCloudflareWorkerEnvironment(env = {}) {
  return getCloudPlatform(env) === "cloudflare";
}

/**
 * 检测当前是否运行在腾讯云EdgeOne Pages环境
 * @param {any} env - 环境变量对象
 * @returns {boolean} 是否为EdgeOne环境
 */
export function isEdgeOneEnvironment(env = {}) {
  return getCloudPlatform(env) === "edgeone";
}

/**
 * 获取环境自适应的上传配置
 * @param {any} env - 环境变量对象
 * @returns {Object} 上传配置对象
 */
export function getEnvironmentOptimizedUploadConfig(env = {}) {
  const platform = getCloudPlatform(env);

  switch (platform) {
    case "cloudflare":
      return {
        partSize: 6 * 1024 * 1024, // 6MB - Worker环境内存限制
        queueSize: 1, // 1并发 - 避免CPU时间超限
        environment: "Cloudflare Worker",
        maxConcurrency: 1, // 最大并发数
        bufferSize: 6 * 1024 * 1024, // 缓冲区大小
      };
    case "edgeone":
      return {
        partSize: 6 * 1024 * 1024, // 6MB - EdgeOne Pages类似限制
        queueSize: 2, // 2并发 - EdgeOne可能支持略高并发
        environment: "Tencent EdgeOne",
        maxConcurrency: 2, // 最大并发数
        bufferSize: 6 * 1024 * 1024, // 缓冲区大小
      };
    case "docker":
    default:
      return {
        partSize: 8 * 1024 * 1024, // 8MB - Docker环境更大分片
        queueSize: 4, // 4并发
        environment: "Docker/Server",
        maxConcurrency: 4, // 最大并发数
        bufferSize: 32 * 1024 * 1024, // 缓冲区大小
      };
  }
}

/**
 * 获取环境名称
 * @param {any} env - 环境变量对象
 * @returns {string} 环境名称
 */
export function getEnvironmentName(env = {}) {
  const platform = getCloudPlatform(env);
  switch (platform) {
    case "cloudflare":
      return "Cloudflare Worker";
    case "edgeone":
      return "Tencent EdgeOne";
    case "docker":
      return "Docker/Server";
    default:
      return "Unknown";
  }
}

/**
 * 获取推荐的分片大小
 * @param {any} env - 环境变量对象
 * @returns {number} 分片大小（字节）
 */
export function getRecommendedPartSize(env = {}) {
  const platform = getCloudPlatform(env);
  return platform === "docker" ? 8 * 1024 * 1024 : 6 * 1024 * 1024;
}

/**
 * 获取推荐的并发数
 * @param {any} env - 环境变量对象
 * @returns {number} 并发数
 */
export function getRecommendedConcurrency(env = {}) {
  const platform = getCloudPlatform(env);
  switch (platform) {
    case "cloudflare":
      return 1;
    case "edgeone":
      return 2;
    case "docker":
      return 4;
    default:
      return 1;
  }
}

/**
 * 获取加密密钥（统一入口）
 * 优先读取环境变量，回退到默认值
 * @param {import('hono').Context} c
 * @returns {string}
 */
export function getEncryptionSecret(c) {
  const secret = (c && c.env && c.env.ENCRYPTION_SECRET) || (typeof process !== "undefined" ? process.env?.ENCRYPTION_SECRET : null);
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET 未配置，请在环境变量中设置一个安全的随机密钥");
  }
  return secret;
}

/**
 * 把各种“真假值”统一转成 boolean
 *
 * @param {any} value
 * @param {boolean} [defaultValue=false]
 */
export function toBool(value, defaultValue = false) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true" || lowered === "yes" || lowered === "on") return true;
    if (lowered === "false" || lowered === "no" || lowered === "off") return false;
  }
  return defaultValue;
}

/**
 * 检测当前是否运行在Node.js环境
 * @returns {boolean} 是否为Node.js环境
 */
export function isNodeJSEnvironment() {
  return typeof process !== "undefined" && process.versions && process.versions.node;
}
