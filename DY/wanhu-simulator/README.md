# 万户模拟器 · 向天而行

DY 的 Three.js 画面增强版。保留原试玩版的成长、碰撞、奖励和升级数值，使用 2.5D 场景强化起飞、飞行和突破高度的表现。

## 运行

需要 Node.js 22.12 或更新版本，以及 npm。

```sh
cd /workspace/codex-cloud-workspace/DY/wanhu-simulator
npm ci
npm run dev
```

在本机浏览器访问终端显示的开发服务器地址。在云端可通过可用的端口转发访问；此项目不假定特定托管平台。

云环境若不能写入默认 npm 缓存，可用 `npm --cache /tmp/dy-npm-cache ci`。依赖已锁定在 `package-lock.json`。运行时的 Three.js 随项目打包，不依赖外部 CDN、模型或贴图服务。

```sh
npm run build
npm run preview
```

`dist/` 是构建产物，可发布到静态网站服务器。新版使用 ES 模块，**不能通过双击 HTML 直接运行**；原始单文件保存在 `reference/original.html`。

## GitHub Pages 发布

用户已选择现有仓库 `dingyu6035-lang/codex-cloud-workspace` 的 GitHub Pages。工作流位于仓库根目录 `.github/workflows/dy-wanhu-pages.yml`，这是 GitHub 对工作流路径的要求；项目源码和发布辅助脚本仍位于 `DY/`。

```sh
npm run build:pages
```

产物位于被忽略的 `.pages-site/`，包含入口页及 `DY/wanhu-simulator/` 游戏目录。工作流仅在 `main` 中相关项目文件变化时自动发布，也支持从 `main` 手动触发。依赖使用锁文件安装，GitHub 官方 Actions 均固定到已核验的提交。

首次发布前，需要确认仓库没有应保留的现有 Pages 站点，再在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。此工作流发布的是完整 Pages 站点，不会自动合并此前的站点内容。以后加入其他协作者的站点，应统一扩展站点构建，不要另建互相覆盖的 Pages 工作流。

成功发布后的预期路径是 `https://dingyu6035-lang.github.io/codex-cloud-workspace/DY/wanhu-simulator/`；该路径必须经过 GitHub 部署成功及 HTTP 加载检查后，才可以当作已上线链接分享。

代码已提交并推送到 `dy/wanhu-three-visuals` 分支，当前尚未上线：环境的 GitHub API 访问被网络策略拒绝。必要的网络域名 `api.github.com` 和 `dingyu6035-lang.github.io`，以及可复用安装和启动说明，均已保存到环境配置草稿。当前工具没有发布环境的入口，需要在产品环境设置中保存并发布草稿，再继续检查 Pages 设置、创建 PR 和远端部署。现有 GitHub 凭据变量已存在；尚未验证其 API 发布权限，不应重复申请密钥。

## 操作

- 点击画面或按空格进入起飞位，再长按画面或空格完成点火。
- 起飞后自动上升；移动鼠标、触摸拖动或按左右方向键控制位置。
- 火箭当量 Lv.8 后，花费 4 钻石装配脉冲。每局使用一次，双击、Shift 或飞行中的空格触发。
- 显示时速达到 1,225 km/h，自动开启音速护盾。
- 落地结算后购买升级；GM 面板可以增加本地资源以查看后期效果。

浏览器支持 WebGL 2 时默认使用 Three.js；初始化失败或上下文丢失时退回 2D。访问时添加 `?renderer=2d` 可主动使用兼容模式。系统的“减少动态效果”设置会减少 3D 摇摆和速度线，但保持游戏所需的移动。

## 存档

继续使用 `wanhuSimulatorDemoSaveV2` 作为 localStorage 键。金币、钻石、升级、突破和最高高度保存在当前浏览器的当前站点中。原文件和新版若来自不同地址或端口，浏览器不会自动共享存档。没有账号、云同步或后端服务。

## 检查

```sh
npm run build
npm test
```

浏览器测试优先使用 `CHROMIUM_PATH` 指定的 Chromium；Linux 默认探测 `/usr/bin/chromium`，否则使用 Playwright 安装的 Chromium，可执行 `npx playwright install chromium` 安装。

测试覆盖飞行结算、升级与刷新存档、材料门槛、脉冲与护盾提示、多联火箭、触摸取消、移动布局、2D 飞行和 WebGL 上下文丢失回退。截图写入被忽略的 `test-results/`。无头环境使用软件 WebGL 进行功能验证，不能替代真机 GPU 性能测试。

## 文件与交接

- `src/game.js`：原有状态机、经济、输入、2D HUD 和备用渲染。
- `src/scene.js`：Three.js 场景、模型、粒子、光照和渲染回退。
- `src/legacy.css`：原页面基础样式；`src/style.css`：新版视觉样式。
- `reference/original.html`：上传原件，保持原样，供回归对照。
- [DESIGN.md](DESIGN.md)：类型设计分析、画面策略和后续方向。
- [../HANDOFF.md](../HANDOFF.md)：协作交接。

开发分支为 `dy/wanhu-three-visuals`。不要把构建产物、依赖目录或私人存档提交到仓库。
