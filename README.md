# 上海教材项目 — 服务端仓库

本仓库负责读取教材数据仓库内容，并通过 API 及前端页面展示教材内容。你可以访问示例网站：[textbook.langningchen.com](https://textbook.langningchen.com)。

## 项目相关仓库

- **爬虫仓库:** [langningchen/shanghai-textbook](https://github.com/langningchen/shanghai-textbook)
- **数据仓库:** [langningchen/shanghai-textbook-data](https://github.com/langningchen/shanghai-textbook-data)
- **服务端仓库（当前仓库）:** [langningchen/shanghai-textbook-server](https://github.com/langningchen/shanghai-textbook-server)

## 功能介绍

- 读取和解析数据仓库内容
- 提供 RESTful API，供前端或第三方应用调用
- 集成前端页面，在线浏览教材内容
- 支持多学科、多年级的内容展示与搜索
- 可扩展性强，便于二次开发和集成

## 快速开始

1. 克隆仓库：
   ```bash
   git clone https://github.com/langningchen/shanghai-textbook-server.git
   cd shanghai-textbook-server
   ```
2. 安装依赖：
   ```bash
   pnpm install
   ```
3. 配置数据仓库路径与网站参数，启动服务端：
   ```bash
   pnpm dev
   ```
4. 访问示例网站：[textbook.langningchen.com](https://textbook.langningchen.com)

## 开发检查

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

DataGrid 使用固定的社区版 `@mui/x-data-grid@9.17.0`。安装时，pnpm 会自动应用
[项目补丁](patches/@mui__x-data-grid@9.17.0.patch)，启用多条件筛选，并将每页行数上限改为 500。
补丁同时覆盖 CommonJS 和 ES module，保留上游 MIT 版权与许可声明。
请使用 pnpm 安装依赖；升级 DataGrid 时需要重新核对补丁，并验证多条件筛选和 250/500 行分页。

`@typescript/native` 提供最新 TypeScript 7 的 `tsc`；`typescript` 别名提供 TypeScript 6 API，
供尚未支持 TypeScript 7 API 的 ESLint 和 Next.js 工具调用。这是 TypeScript 官方建议的并行配置。

## 许可证

本项目采用 [GNU Affero 通用公共许可证 v3.0](https://github.com/langningchen/shanghai-textbook-server/blob/main/LICENSE) 授权。

## 已知问题

请参见 [GitHub Issues](https://github.com/langningchen/shanghai-textbook-server/issues)。
