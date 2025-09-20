# 上海教科书资源库

本项目是一个基于 Next.js + MUI 的上海教科书资源库，支持筛选、懒加载、下载和服务端代理，所有教科书数据均来自[上海教科书 GitHub 仓库](https://github.com/langningchen/shanghai-textbook)，通过本地 API 代理访问，解决国内网络访问问题。

## 功能介绍

- 按学段、年级、学科、版本筛选教科书
- 支持分页浏览，提升性能
- 教科书封面图片懒加载，优化加载速度
- 一键下载 PDF 教材，支持分卷下载
- 所有图片和 PDF 均通过服务端代理，避免直连 GitHub
- 响应式布局，适配桌面和移动端

## 安装与运行

1. 安装依赖：

	```bash
	pnpm install
	```

2. 启动开发服务器：

	```bash
	pnpm dev
	```

3. 访问 [http://localhost:3000](http://localhost:3000)


## 部署说明

已部署生产环境： [https://textbook.langningchen.com](https://textbook.langningchen.com)

支持 Cloudflare 部署，所有 GitHub 资源均通过服务端 API 代理，确保国内可访问。

## 数据来源

教科书数据来自上海教科书 GitHub 仓库：[https://github.com/langningchen/shanghai-textbook](https://github.com/langningchen/shanghai-textbook)

## 贡献与反馈

欢迎提交 Issue 或 PR 改进项目。如有建议或问题，请在 GitHub 仓库留言。
