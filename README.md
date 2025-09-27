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
   npm install
   # 或
   pnpm install
   ```
3. 配置数据仓库路径与网站参数，启动服务端：
   ```bash
   npm start
   # 或
   pnpm start
   ```
4. 访问示例网站：[textbook.langningchen.com](https://textbook.langningchen.com)

## 许可证

本项目采用 [GNU Affero 通用公共许可证 v3.0](https://github.com/langningchen/shanghai-textbook-server/blob/main/LICENSE) 授权。

## 已知问题

请参见 [GitHub Issues](https://github.com/langningchen/shanghai-textbook-server/issues)。
