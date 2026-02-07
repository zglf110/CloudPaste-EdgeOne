# CloudPaste EdgeOne Pages 迁移清单

本清单帮助将现有的 Hono/复杂框架实现转换为轻量级的 EdgeOne Pages 边缘函数。

---

## 第1阶段：准备工作

- [ ] 了解 EdgeOne Pages 函数的 `onRequest(context)` 入口点
- [ ] 阅读 `EDGEONE_BEST_PRACTICES.md` 中的标准实践
- [ ] 查看现有的 `api/health-edgeone.js` 示例
- [ ] 确认所有需要的环境变量已在 EdgeOne 控制台配置
- [ ] 设置 `ENABLE_DEBUG_LOGS=true` 进行测试

---

## 第2阶段：工具库集成

- [ ] 确认项目中有 `_edgeone-utils.js` 文件
- [ ] 验证以下导出可用：
  - [ ] `logger` - 日志工具
  - [ ] `createDbClient` / `closeDbClient` - 数据库
  - [ ] `successResponse` / `errorResponse` - 响应
  - [ ] `handleCorsPreFlight` - CORS处理
  - [ ] `handleAuthHeader` - 认证
  - [ ] `parseJsonBody` - 请求解析
  - [ ] `validateRequired` - 验证
  - [ ] `handleApiError` - 错误处理
  - [ ] 其他必需的工具函数
- [ ] 在package.json中确认依赖：
  - [ ] `pg` (PostgreSQL驱动)
  - [ ] `jsonwebtoken` (JWT处理)
  - [ ] `bcryptjs` (密码哈希，可选)

---

## 第3阶段：单个端点迁移

对于每个需要迁移的API端点，按照以下步骤：

### 3.1 识别端点

- [ ] 端点路径是什么？（例如: /api/users）
- [ ] 需要支持哪些HTTP方法？（GET, POST, PUT, DELETE）
- [ ] 需要身份验证吗？
- [ ] 需要数据库访问吗？
- [ ] 有哪些输入参数？
- [ ] 返回什么数据？

### 3.2 创建新的边缘函数文件

- [ ] 在 `node-functions/api/` 中创建新文件（例如: `users.js`）
- [ ] 添加文件头注释说明端点用途
- [ ] 导入必需的工具：
  ```javascript
  import {
    logger,
    successResponse,
    errorResponse,
    // ... 其他必需工具
  } from '../_edgeone-utils.js';
  ```
- [ ] 实现 `export async function onRequest(context)` 入口点

### 3.3 实现方法处理

对于每个支持的HTTP方法（GET, POST, PUT, DELETE, PATCH）：

- [ ] 创建对应的处理器函数（例如: `handleGet`, `handlePost`）
- [ ] 添加必要的日志：
  - [ ] 请求开始日志 (logger.debug)
  - [ ] 关键操作日志 (logger.info)
  - [ ] 错误日志 (logger.error)
- [ ] 处理请求体解析（如需要）：
  ```javascript
  const body = await parseJsonBody(request);
  ```
- [ ] 验证输入参数：
  ```javascript
  const missing = validateRequired(body, ['field1', 'field2']);
  if (missing) {
    return errorResponse(`Missing: ${missing.join(', ')}`, 400);
  }
  ```

### 3.4 实现身份验证（如需要）

- [ ] 从请求header提取token：
  ```javascript
  const authHeader = request.headers.get('authorization');
  const user = handleAuthHeader(authHeader);
  ```
- [ ] 检查用户是否已认证：
  ```javascript
  if (!user) {
    return errorResponse('Unauthorized', 401);
  }
  ```
- [ ] 检查用户权限（如需要）：
  ```javascript
  if (user.role !== 'admin') {
    return errorResponse('Forbidden', 403);
  }
  ```

### 3.5 实现数据库操作

- [ ] 创建客户端：
  ```javascript
  const client = await createDbClient();
  ```
- [ ] 使用参数化查询（防止SQL注入）：
  ```javascript
  const result = await client.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  ```
- [ ] 在 finally 中关闭连接：
  ```javascript
  finally {
    await closeDbClient(client);
  }
  ```
- [ ] 处理数据库错误：
  ```javascript
  catch (error) {
    return handleApiError(error, 'endpoint-name');
  }
  ```

### 3.6 测试端点

- [ ] 使用 curl 或 Postman 测试基本功能
- [ ] 测试所有支持的HTTP方法
- [ ] 测试有效输入和无效输入
- [ ] 测试未授权访问（如适用）
- [ ] 检查错误消息是否清晰
- [ ] 验证相应的HTTP状态码
- [ ] 检查CORS头是否正确
- [ ] 查看日志输出是否正确

---

## 第4阶段：端点迁移列表

为CloudPaste中的每个需要迁移的端点创建一个复选框：

### 健康检查和系统

- [ ] GET /api/health
  - 源文件: `_app.js` 中的 /api/health 路由
  - 目标文件: `api/health.js`
  - 优先级: 高 (基础服务)
  - 复杂度: 低

### 用户管理

- [ ] POST /api/user/register
  - 源文件: 
  - 目标文件: `api/user/register.js`
  - 优先级: 高
  - 复杂度: 中

- [ ] POST /api/user/login
  - 源文件:
  - 目标文件: `api/user/login.js`
  - 优先级: 高
  - 复杂度: 中

- [ ] GET /api/user/profile
  - 源文件:
  - 目标文件: `api/user/profile.js`
  - 优先级: 中
  - 复杂度: 低

- [ ] PUT /api/user/profile
  - 源文件:
  - 目标文件: `api/user/profile.js` (添加PUT)
  - 优先级: 中
  - 复杂度: 低

### 文件操作

- [ ] GET /api/files
  - 源文件:
  - 目标文件: `api/files/list.js`
  - 优先级: 中
  - 复杂度: 中

- [ ] POST /api/files/upload
  - 源文件:
  - 目标文件: `api/files/upload.js`
  - 优先级: 中
  - 复杂度: 高

- [ ] GET /api/files/:id
  - 源文件:
  - 目标文件: `api/files/[id].js`
  - 优先级: 中
  - 复杂度: 中

- [ ] DELETE /api/files/:id
  - 源文件:
  - 目标文件: `api/files/[id].js` (添加DELETE)
  - 优先级: 中
  - 复杂度: 低

### 文本操作 (Pastes)

- [ ] GET /api/pastes
  - 源文件:
  - 目标文件: `api/pastes/list.js`
  - 优先级: 中
  - 复杂度: 中

- [ ] POST /api/pastes
  - 源文件:
  - 目标文件: `api/pastes/create.js`
  - 优先级: 中
  - 复杂度: 中

### API密钥管理

- [ ] GET /api/admin/api-keys
  - 源文件:
  - 目标文件: `api/admin/api-keys.js`
  - 优先级: 低
  - 复杂度: 中

- [ ] POST /api/admin/api-keys
  - 源文件:
  - 目标文件: `api/admin/api-keys.js` (添加POST)
  - 优先级: 低
  - 复杂度: 中

### 管理功能

- [ ] GET /api/admin/users
  - 源文件:
  - 目标文件: `api/admin/users.js`
  - 优先级: 低
  - 复杂度: 中

- [ ] GET /api/admin/system
  - 源文件:
  - 目标文件: `api/admin/system.js`
  - 优先级: 低
  - 复杂度: 中

---

## 第5阶段：测试和验证

### 单元测试

- [ ] 创建单元测试文件
- [ ] 为每个处理器函数编写测试
- [ ] 测试成功路径
- [ ] 测试错误路径
- [ ] 测试边界情况

### 集成测试

- [ ] 创建API测试脚本
- [ ] 测试完整的端点流程
- [ ] 测试身份验证流程
- [ ] 测试数据库交互
- [ ] 测试错误处理

### 性能测试

- [ ] 使用 loadtest 或 ab 进行负载测试
- [ ] 检查响应时间
- [ ] 监控内存使用
- [ ] 检查数据库连接泄漏

```bash
# 示例：简单的负载测试
ab -n 100 -c 10 http://localhost:3000/api/health
```

---

## 第6阶段：验证和清理

### 功能验证

- [ ] 所有端点都返回正确的响应格式
- [ ] 错误消息清晰有用
- [ ] 认证/授权正常工作
- [ ] CORS头正确配置
- [ ] 日志信息充分

### 性能验证

- [ ] 冷启动时间 < 50ms
- [ ] 函数包大小 < 1MB
- [ ] 内存使用 < 128MB
- [ ] 数据库连接及时关闭
- [ ] 没有内存泄漏

### 代码质量

- [ ] 没有未使用的导入
- [ ] 代码注释充分
- [ ] 遵循统一的代码风格
- [ ] 错误处理完整
- [ ] 日志信息有用

### 清理旧代码

- [ ] 在 `_app.js` 中删除已迁移的路由
- [ ] 删除不再需要的Hono中间件
- [ ] 更新路由文档
- [ ] 更新README

---

## 第7阶段：上线部署

### 部署前准备

- [ ] 所有测试都通过
- [ ] 代码审查完成
- [ ] 环境变量已正确配置
- [ ] 备份原有代码
- [ ] 准备回滚计划

### 部署活动

- [ ] 在测试环境部署
- [ ] 运行冒烟测试
- [ ] 监控日志
- [ ] 检查错误率
- [ ] 部署到生产环境（可选：灰度部署）

### 部署后验证

- [ ] 所有端点都可访问
- [ ] 性能指标正常
- [ ] 错误率低于预期
- [ ] 用户反馈没有问题
- [ ] 监控异常没有告警

---

## 故障排查

### 常见问题

**问题：环境变量未找到**
- [ ] 检查环境变量在EdgeOne控制台的配置
- [ ] 确保变量名拼写正确
- [ ] 重新部署函数以加载新变量

**问题：数据库连接超时**
- [ ] 检查数据库主机和端口
- [ ] 验证防火墙规则
- [ ] 检查连接超时设置
- [ ] 查看进程级别的日志

**问题：JWT验证失败**
- [ ] 验证JWT_SECRET已设置并正确
- [ ] 检查token格式 (Bearer xxx)
- [ ] 验证token未过期

**问题：CORS错误**
- [ ] 检查CORS_ALLOW_ORIGIN配置
- [ ] 确保OPTIONS方法被处理
- [ ] 验证响应头设置正确

---

## 资源和参考

- EdgeOne Pages 文档: https://cloud.tencent.com/document/product/1552/
- PostgreSQL Node.js驱动: https://node-postgres.com/
- JWT参考: https://jwt.io/
- 项目文档:
  - `EDGEONE_BEST_PRACTICES.md` - 详细最佳实践
  - `EDGEONE_QUICK_START.md` - 快速参考
  - `_edgeone-utils.js` - 工具库文档
  - `api/example-users.js` - 完整示例
  - `api/template-router.js` - 路由器示例

---

## 反馈和支持

- 遇到问题？查看示例文件
- 需要帮助？查看文档中的故障排查章节
- 有建议？考虑提交改进建议

---

*创建日期：2024年2月7日*
*最后更新：2024年2月7日*
