/**
 * EdgeOne Pages Catch-All Handler
 * 
 * 说明：
 * - 这是一个捕获所有未被具体路由匹配的请求的处理器
 * - EdgeOne Pages 路由优先级：
 *   1. 静态文件（public/ 目录）
 *   2. 具体路由（如 api/health.js）
 *   3. 此处的 [[default]].js 捕获所有（后备处理器）
 * 
 * 现状：
 * - CloudPaste 正在从 Hono 框架迁移到轻量级的 EdgeOne 边缘函数
 * - 所有新端点应该作为具体的路由文件实现（如 api/health.js, api/users.js）
 * - 此文件仅作为后备，处理未被覆盖的请求
 * 
 * 参考：EDGEONE_BEST_PRACTICES.md
 */

/**
 * EdgeOne Pages onRequest handler
 * 
 * @param {Object} context - EdgeOne Pages context
 * @param {Request} context.request - HTTP request
 * @param {Object} context.env - Environment variables
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 1. 处理 API 请求
  if (pathname.startsWith('/api/')) {
    // 导入最小化的响应工具
    const { errorResponse } = await import('../_edgeone-utils.js');
    
    // 如果到达这里，说明没有具体的路由文件处理此请求
    // （应该创建具体的路由文件而不是依赖此处理器）
    return errorResponse(
      `API endpoint not found: ${pathname}. 请创建具体的路由文件来处理此请求，或参考 EDGEONE_BEST_PRACTICES.md`,
      404
    );
  }

  // 2. 处理根路径，重定向到前端
  if (pathname === '/') {
    const indexUrl = new URL('/index.html', url.origin);
    const response = await fetch(indexUrl.toString());
    
    if (response.ok) {
      return response;
    }
    
    return new Response('Frontend not available', { status: 503 });
  }

  // 3. 处理其他路径（静态文件等）
  // 让 EdgeOne 平台的静态文件服务处理
  // 如果 EdgeOne 无法找到文件，它会返回 404
  return fetch(request);
}
