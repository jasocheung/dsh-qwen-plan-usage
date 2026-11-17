# dsh-qwen-plan-usage

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

DeepSeek Harness (DSH) 插件：在侧边栏显示 **千问AI平台 Token Plan**（platform.qianwenai.com）的剩余额度（Credits），提供 `/qwen-plan` 聊天命令，并在**未配置 Cookie 时自动引导 AI 助手从你的浏览器取 Cookie**——无需手动复制粘贴。仿 `dsh-opencode-go-usage` 的侧边栏 widget + 配置卡风格。

## 功能

- **侧边栏额度 widget**：套餐名 / 状态 / 剩余天数、月用量进度条（百分比 + 剩余/总量 + 重置倒计时）、加油包余额。折叠态显示 36px 徽标。
- **`/qwen-plan` 命令**：在聊天里直接查剩余额度。
- **模型引导（auto-cookie）**：插件装好但还没 Cookie 时，向模型注入一段引导，让助手**自己**运行内置脚本从你已登录的浏览器提取 Cookie 并连接，而不是让你手动复制。连接成功后引导自动消失。
- **同源额度代理 + 配置卡**：Cookie 只存本机 DSH 凭据库，浏览器侧拿不到 Cookie。

## 安装

任选其一：

1. **CLI**（推荐，完整可复制）：
   ```
   dsh plugin --profile web add dsh-qwen-plan-usage
   ```
2. **DSH Plugins 页**（设置 → 插件 → 安装）按包名安装：`dsh-qwen-plan-usage`（registry 选 npmjs.org 或 npmmirror.com）。
3. **Plugin Manager 工具**：
   ```
   plugin_manager action=install_bundle target=dsh-qwen-plan-usage
   ```
   或从 GitHub 安装：`target=github:<owner>/dsh-qwen-plan-usage`；或本地目录：`target=<本目录绝对路径>`。

首次安装后**刷新 GUI 页面**（Ctrl+R）即可在侧边栏底部看到 widget；配置卡在 设置 → 插件 → dsh-qwen-plan-usage。

> **修改插件源码后需重启 DSH Desktop** 才能加载——链接安装的插件代码位于 `node_modules`，不在 DSH HMR 热重载范围内（启停 bundle 只 reconcile，不刷新 ESM 模块缓存）。

## 兼容性

- **DSH**：实测运行于 `0.1.7-rc.2`（desktop profile）；`engines.dsh` 声明 `>=0.1.0-rc.1 <0.3.0-0`。
- **Node**：`>= 18`。
- **Profiles**：web / desktop。
- **自动取 Cookie 脚本**：目前支持 Windows + Edge/Chrome（headless profile 副本）；其他平台请用手动粘贴。
- 纯 ESM，无构建步骤（git 源码安装即可用）。

## 连接

### 方式一：让助手自动取（推荐）

前提：你已在浏览器（Edge/Chrome）登录 <https://platform.qianwenai.com>。

装好插件但没配 Cookie 时，助手会收到引导并自动运行内置提取脚本：

```
node scripts/extract-cookie.mjs --domain qianwenai.com --sign-in http://127.0.0.1:43120/qwen-plan/sign-in
```

脚本自动检测 Edge/Chrome → 复制浏览器 profile 到临时目录 → 起一个**无头**浏览器副本用 CDP 解密 `qianwenai.com` 会话 Cookie → 提交给本机插件路由。**不触碰你正在用的浏览器**，无可见窗口、不加载扩展。Windows 下若 Cookie 数据库被浏览器独占锁定，脚本用句柄复制（`dump-locked.ps1`，非侵入、无需管理员）读取。

### 方式二：手动粘贴（备用）

1. 打开控制台用量页 <https://platform.qianwenai.com/home/analytics/token-plan/individual> 并登录。
2. F12 → Network → 任一请求 → 复制 **Cookie 请求头**整条值。
3. 配置卡 → 「控制台 Cookie」粘贴 → 「保存 Cookie」。插件立即验证一次后入库。

> 不要粘贴 API Key（`sk-…`）——会被拒绝。Cookie 失效后 widget 显示「未连接或 Cookie 已失效」，重新连接即可。

## 为什么需要 Cookie

推理 API Key（`sk-sp-…`）**无法**读取套餐额度——token-plan 网关没有公开的用量 REST 端点（已实测：`/compatible-mode/v1/*` 下任意未知路径都返回 `Required parameter "model" missing` 兜底，`/v1/usage`、`/api/v1/usage` 等返回 404）。剩余额度只存在于控制台会话里，因此本插件用浏览器 Cookie 重放控制台自己的 bailian 网关调用。

Cookie 与 `sec_token` 只保存在本机 DSH 凭据库（`dsh-qwen-plan-usage/session`），仅作为请求头发往 `*.qianwenai.com`，绝不出现在任何 HTTP 响应、日志或交付物里。

## 显示内容

- 套餐名 / 状态 / 剩余天数
- 月用量进度条（百分比 + 剩余/总量 + 重置倒计时）；国内个人版只返回月窗口，若网关返回周/5小时窗口则一并显示
- 加油包剩余额度与到期时间
- 折叠态：36px 徽标显示月用量百分比（或 `Q`）

进度条配色：≥90% 红、≥70% 黄、其余绿。

## 数据源（国内站契约，已用真实控制台流量 CDP 抓包 + live 验证）

- sec_token：`GET https://platform-home.qianwenai.com/tool/user/info.json`（home 网关，带 Cookie）→ `data.secToken`
- 用量：`POST https://cs-data.qianwenai.com/data/api.json?product=sfm_bailian&action=BroadScopeAspnGateway&api=<Api URL编码>`（**bailian cs-data 网关，带 `&api=`**）
  - form body：`product=sfm_bailian`、`action=BroadScopeAspnGateway`、`sec_token`、`region=cn-beijing`、`params=JSON{Api,V:'1.0',Data:{commodityCode,cornerstoneParam:{domain:'platform.qianwenai.com',consoleSite:'QIANWENAI',console:'ONE_CONSOLE',xsp_lang:'zh-CN',protocol:'V2',productCode:'p_efm'}}}`
  - 四个 Api：`zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/{usage,subscription,quota-config,addon/list}`
- 主套餐商品码 `sfm_tokenplansolo_public_cn`；加油包 `sfm_tokenplansoloaddon_public_cn`
- 返回三层嵌套：`data.DataV2.data.data` 才是真实字段（`unwrapZelda` 已解到该层）
- usage 字段：国内个人版只返回 `per1MonthPercentage`（0..1）+ `per1MonthResetTime`（ms）；无周/5小时窗口
- quota-config：按 `specCode`（如 `standard`）取 `{five_hour,monthly}` 总量；剩余 = monthly × (1 − per1MonthPercentage)

> 网关选择依据：CDP 抓取控制台用量页真实请求，个人版 usage/subscription/quota-config/addon 全部走 **cs-data 网关**（带 `&api=`）；home 网关只用于 sec_token 与账单/订单（BssOpenAPI）。实测 home 网关对这些 Api 返回空数据，故必须用 cs-data。

所有网关常量都在配置卡「高级」里可调（`csDataUrl`/`homeUrl`/`region`/`commodityCode`/`addonCode`/`consoleSite`/`consoleDomain`），换站点/区域无需改代码。

## 模型引导如何工作

`lib/index.js` 用可选注入 `ctx.inject(["systemPrompt"], …)` 注册一个 prompt context（`qwen-plan-usage:cookie-guidance`，order 130）。其文本由 `lib/guidance.js` 生成：

- 已配置 Cookie（`connected === true`）→ 返回空串，被 prompt registry 过滤，**不干扰正常会话**。
- 未配置 → 返回引导：让助手运行 `scripts/extract-cookie.mjs` 自取 Cookie → `POST /qwen-plan/sign-in` → `GET /qwen-plan/usage` 复核，并附登录前提与安全约束。

`connected` 标志在 sign-in/sign-out 时即时更新，并每 15s 轮询凭据库刷新（prompt context 文本是同步函数，不能内部 await 凭据库）。

## 路由

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/qwen-plan/state` | 连接快照 |
| GET | `/qwen-plan/usage[?refresh=1]` | 额度代理（带缓存） |
| POST | `/qwen-plan/sign-in` `{cookie}` | 校验并保存 Cookie |
| POST | `/qwen-plan/sign-out` | 删除 Cookie |
| GET/POST | `/dsh-qwen-plan-usage/config` | 配置卡 |
| GET | `/dsh-qwen-plan-usage/client.js` | 自托管浏览器 bundle |

所有路由同源校验；Cookie 不出现在任何响应里。

## 开发

```
node --test                       # 单元测试（parse + guidance，无运行时依赖）
node --check lib/index.js
node --check lib/client.js
node scripts/extract-cookie.mjs --domain qianwenai.com --json   # 手动跑提取脚本
```

- `lib/parse.js`：纯解析层（normalizeCookie / unwrapZelda / assembleUsage 等）。
- `lib/guidance.js`：纯引导文本生成（zh/en）。
- `lib/index.js`：host（路由、凭据、缓存、命令、模型引导、自托管 bundle + boot graph 注入）。
- `lib/client.js`：浏览器 bundle（module-loader factory 格式，侧边栏 widget + 配置卡，全 theme tokens）。
- `scripts/extract-cookie.mjs` + `scripts/dump-locked.ps1`：浏览器 Cookie 自动提取。

## 插件市场收录

DSH 官方没有插件 registry，也不接受「上架」提交；官方唯一的可发现性机制是给仓库加 GitHub topic **`dsh-plugin`**。本插件按 DSH bundle 规范打包（`dsh.bundle.patch` + `dsh.client` + 双语 `dsh.catalog`），keywords 含 `dsh-plugin` / `deepseek-harness` / `cordis-plugin`，`repository` 指回本仓库。发布到 npm + 加 topic 后：

- **官方 Plugins 页 / CLI** 可按包名 `dsh-qwen-plan-usage` 直接安装。
- **awesome-dsh-plugin**（策展主列表，下游 dshmarket / galaxy / 官方 Discover 索引的源头）：向 github.com/awesome-dsh-plugin/awesome-dsh-plugin 提 PR，新增 `data/plugins/<owner>__dsh-qwen-plan-usage.yml`（category `usage`）。要求开源 + 真实功能 + 持续维护 + 仓库年龄 ≥1 天。条目模板见 [`publish/awesome-entry.yml`](./publish/awesome-entry.yml)。
- **dsh-plugin-hub**（dsh-plugin.org）：公开仓库 + topic `dsh-plugin` + 根 `package.json` 自动爬取；进 App 内 Plugin Hub 需已发 npm。可选加速 issue 模板见 [`publish/hub-issue.md`](./publish/hub-issue.md)。
- **dsh-plugin-shop**：按 npm keywords（`dsh-plugin` / `deepseek-harness`）+ topics 全自动每日收割，`dsh.catalog` 双语卡片已就绪。
- **feed / bruc3van**：自动爬取（需仓库 description + topic）。

完整发布与收录步骤见 [`publish/RUNBOOK.md`](./publish/RUNBOOK.md)，发布说明见 [`publish/RELEASE-NOTES.md`](./publish/RELEASE-NOTES.md)。

## 许可

MIT