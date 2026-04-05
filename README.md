# Toolbox TodoList

这是一个基于 Node.js 的全功能工具箱应用，提供了待办事项管理、习惯追踪、AI 助手、番茄钟等多种实用工具。

## 功能特性

- **待办事项 (Todo)**：高效管理您的日常任务。
- **习惯追踪 (Habit)**：帮助您养成良好的生活习惯。
- **AI 助手 (AI)**：集成 AI 功能，提供智能建议与辅助。
- **番茄钟 (Pomodoro)**：专注力管理工具，提升工作效率。
- **密码管理 (Password)**：安全存储和管理您的个人密码。
- **笔记工具 (Notes)**：随时记录灵感与重要信息。
- **决策辅助 (Decision)**：帮助您在犹豫不决时做出选择。
- **颜色工具 (Color)**：设计师必备的颜色提取与管理工具。
- **Jupyter 集成 (Jupyter)**：支持代码实验与文档记录。

## 技术栈

- **后端**: Node.js, Express
- **前端**: HTML, CSS, JavaScript
- **其他**: CORS, dotenv, node-fetch

## 快速开始

### 1. 环境准备

确保您的系统中已安装 Node.js。

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境

在根目录创建 `.env` 文件并配置必要的环境变量：

```env
PORT=3000
# 其他配置项...
```

### 4. 运行应用

```bash
npm start
```

访问 `http://localhost:3000` 即可开始使用。

## 项目结构

- `server.js`: 后端服务器入口。
- `index.html`: 前端界面。
- `style.css`: 样式文件。
- `tools/`: 包含所有核心功能的逻辑实现。
- `toolbox-core.js` & `toolbox-config.js`: 项目核心配置与管理逻辑。

## 许可证

本项目采用 ISC 许可证。
