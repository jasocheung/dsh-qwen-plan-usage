# dsh-qwen-plan-usage v0.2.0 — 发布说明 / Release Notes

## 中文

**这是什么**
一个 DeepSeek Harness（DSH）插件，在侧边栏显示你的「千问 AI 平台 Token Plan」剩余额度（Credits）、本月用量百分比与重置时间，并提供 `/qwen-plan` 聊天命令查询额度。

**核心功能**
- 侧边栏额度组件：月总额度 / 已用 / 剩余 / 用量百分比 / 重置倒计时，加油包列表。
- 同源用量代理：浏览器只请求 DSH 自己的 `/qwen-plan/usage`，由 host 携带 cookie 转发到千问控制台接口，避免跨域与凭据暴露。
- `/qwen-plan` 命令：在聊天里直接查额度。
- **模型引导（v0.2.0 新增）**：插件已安装但未配置 cookie 时，向 AI 模型注入一段引导，让模型**自动从你的浏览器获取控制台 cookie**（Windows Edge/Chrome，headless 副本方式，不触碰你正在使用的浏览器），无需手动复制粘贴。

**安装**
- GUI：Plugins 页 → install-by-spec → 粘贴 `dsh-qwen-plan-usage`（registry 选 npmjs.org 或 npmmirror.com）。
- CLI：`dsh plugin --profile web add dsh-qwen-plan-usage`。
- 源码：`dsh plugin --profile web add github:<owner>/dsh-qwen-plan-usage`。

**连接（获取额度）**
1. 前提：你已在浏览器登录 https://platform.qianwenai.com 。
2. 自动（推荐）：未配置 cookie 时，模型会按引导运行 `scripts/extract-cookie.mjs` 自动提取并注入。
3. 手动（备用）：设置 → 插件 → dsh-qwen-plan-usage → 粘贴控制台 cookie。

**为什么需要 cookie**
千问 Token Plan 没有公开的额度查询 API，推理用的 API key（sk-sp-…）无法读额度。剩余额度只在登录态的控制台接口可见，因此插件复用你的控制台会话 cookie。cookie 仅保存在 DSH 凭据库（`dsh-qwen-plan-usage/session`），只用于向千问官方接口查额度，不外发、不写入任何交付物。

**数据源**
- 会话：`GET https://platform-home.qianwenai.com/tool/user/info.json` → sec_token。
- 额度：`POST https://cs-data.qianwenai.com/data/api.json?product=sfm_bailian&action=BroadScopeAspnGateway&api=<Api>`，个人版 usage/subscription/quota-config/addon 四个接口。
- 上述契约由千问控制台前端 bundle 逆向 + 真实登录态抓包核实。

**兼容性**
- 实测运行于 DSH 0.1.7-rc.2（desktop profile）。
- Node >= 18；engines.dsh `>=0.1.0-rc.1 <0.3.0-0`。
- 自动取 cookie 脚本目前支持 Windows + Edge/Chrome；其他平台请用手动粘贴。

**许可**：MIT。

---

## English

**What it is**
A DeepSeek Harness (DSH) plugin that shows your Qwen AI Platform Token Plan remaining Credits, monthly usage percent and reset time in the sidebar, plus a `/qwen-plan` chat command.

**Features**
- Sidebar quota widget: monthly total / used / remaining / percent / reset countdown, add-on packages.
- Same-origin usage proxy: the browser only calls DSH's own `/qwen-plan/usage`; the host forwards to the Qwen console API with your cookie (no CORS, no credential exposure to the page).
- `/qwen-plan` command.
- **Model guidance (new in v0.2.0)**: when installed but no cookie is configured, the plugin injects guidance telling the AI model to **auto-fetch the console cookie from your browser** (Windows Edge/Chrome, via a headless profile copy that never touches your live browser) — no manual copy-paste.

**Install**
- GUI: Plugins → install-by-spec → paste `dsh-qwen-plan-usage`.
- CLI: `dsh plugin --profile web add dsh-qwen-plan-usage`.
- Source: `dsh plugin --profile web add github:<owner>/dsh-qwen-plan-usage`.

**Connect**
1. Be signed in to https://platform.qianwenai.com in your browser.
2. Auto (recommended): with no cookie configured, the model runs `scripts/extract-cookie.mjs` to extract and inject it.
3. Manual (fallback): Settings → Plugins → dsh-qwen-plan-usage → paste the console cookie.

**Why a cookie is needed**
Qwen Token Plan has no public quota API; the inference API key (sk-sp-…) cannot read quota. Remaining Credits are only visible through the signed-in console API, so the plugin reuses your console session cookie. The cookie is stored only in the DSH credential store (`dsh-qwen-plan-usage/session`), used solely to query Qwen's official quota endpoints, never sent elsewhere or written into deliverables.

**Compatibility**: tested on DSH 0.1.7-rc.2 (desktop profile); Node >= 18; engines.dsh `>=0.1.0-rc.1 <0.3.0-0`. Auto cookie extraction currently supports Windows + Edge/Chrome; use manual paste elsewhere.

**License**: MIT.