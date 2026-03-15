# SnakeGame（贪吃蛇）

一个纯静态的贪吃蛇网页（Canvas），支持：

- 键盘：方向键 / WASD
- 手机：屏幕方向键
- 规则：可切换“穿墙模式”
- 空格暂停/继续，Enter 重新开始

## 本地运行

直接用浏览器打开 `index.html` 即可。

## 部署到 GitHub Pages（直接在线玩）

1. 把本仓库 push 到 GitHub（建议默认分支为 `main`）
2. 进入仓库设置：Settings → Pages
3. 在 **Build and deployment**：
   - Source：Deploy from a branch
   - Branch：`main`
   - Folder：`/ (root)`
4. 保存后等待几分钟，访问 GitHub Pages 提供的 URL

> 这个项目是纯静态文件，不需要 Node、也不需要构建步骤。

## 文件说明

- `index.html`：页面结构与按钮
- `style.css`：样式
- `game.js`：游戏逻辑
