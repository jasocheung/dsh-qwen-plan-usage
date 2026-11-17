# 发布与收录执行手册 / Publication Runbook

本手册列出把 dsh-qwen-plan-usage 开源到 GitHub、发布到 npm、并被各 DSH 插件市场收录的确切步骤。
标注【需 boss】的步骤需要 boss 的账号/凭据或授权；其余可由 agent 在授权后执行。
所有对外动作（push / publish / 提 PR / 提 issue）执行前按铁律 R7/R10 再确认一次。

## 0. 前置凭据【需 boss 提供】
- GitHub 用户名（owner）：仓库将建为 `github.com/<owner>/dsh-qwen-plan-usage`。
- GitHub 推送凭据：Personal Access Token（repo 权限）或经 credential manager 登录。
  - 注意本机 git 全局有 `url.https://gh-proxy.com/https://github.com/.insteadOf` 重写（只读代理，不能用于 push）。push 需直连 github.com 或配置可写远端。
- npm 发布凭据：npm token 或 `npm adduser`（必须对 registry.npmjs.org；本机 .npmrc 当前指向只读镜像 npmmirror.com，发布时须切回 npmjs.org）。
- git 提交身份：user.name / user.email（当前本地提交用中性占位身份，push 前按 boss 身份 amend）。

## 1. 定稿 package.json【agent，owner 已知后】
- 加 `repository`: `{ "type":"git", "url":"git+https://github.com/<owner>/dsh-qwen-plan-usage.git" }`（awesome npm↔repo 自动映射必需）。
- 加 `homepage` / `bugs.url`（可选，指回仓库）。
- 已就绪: dsh.bundle.patch ✓、dsh.client ✓、dsh.catalog 双语 ✓、keywords(dsh-plugin+deepseek-harness+cordis-plugin) ✓、exports./package.json ✓、icon≤32KiB ✓、engines.dsh `>=0.1.0-rc.1 <0.3.0-0` ✓、files ✓、license MIT ✓。
- 预构建: 本插件纯 ESM，无 build 步骤，lib/ 即源码（git 安装不跑 build，已满足）。

## 2. GitHub 建仓 + push【需 boss 授权/凭据】
1. 在 boss 账号建公开仓库 `dsh-qwen-plan-usage`（不初始化 README，避免冲突）。
2. 本地 `git remote add origin https://github.com/<owner>/dsh-qwen-plan-usage.git`。
3. 按 boss 身份 amend 提交（user.name/email）。
4. `git push -u origin main`。
5. 设仓库 **description**（feed/bruc3van 自动爬必需）+ **topics**: `dsh-plugin`（官方唯一可发现性机制，必需）、`deepseek-harness`、`cordis`、`cordis-plugin`、`qwen`、`token-plan`、`usage`。
   - topic/description 可用 GitHub API（PUT /repos/{owner}/{repo}/topics）或网页设置。

## 3. npm 发布【需 boss 授权/凭据，不可逆外发】
1. 切 registry: `npm config set registry https://registry.npmjs.org/`（或发布命令带 `--registry`）。
2. 登录: `npm adduser` 或配置 token。
3. 干跑核对: `npm pack --dry-run`（确认 files 含 lib/scripts/locale/assets/cordis.patch.yml/README/LICENSE，不含 publish/ 与测试临时物）。
4. `npm publish --access public`（无 scope 包默认 public）。
5. 验证: `npm view dsh-qwen-plan-usage`，repository 指回仓库 → awesome 自动映射。
6. 发布后把 .npmrc registry 还原为 boss 原值（npmmirror）。

## 4. awesome-dsh-plugin 主列表 PR【需 boss 授权，外发；解锁 dshmarket/galaxy/Discover】
1. 等仓库年龄 ≥1 天（CI 闸；可先提，CI hold 后自动重跑放行）。
2. fork github.com/awesome-dsh-plugin/awesome-dsh-plugin。
3. 新增 `data/plugins/<owner>__dsh-qwen-plan-usage.yml`（用 publish/awesome-entry.yml，替换 <owner>）。
4. 单独 PR，≤3 条，不改他人条目；PR 描述如实标注「作者自研 + 真实使用」。
5. CI（条目数→dsh.bundle→仓库年龄→awesome-lint+站点构建）+ 维护者审（claims-vs-code/重复/源码 sanity）。
6. held:author 时同分支 push 修复 + 留一条评论。
7. 合并后站点重建 + format-1 索引再生 → 进 Discover、dshmarket/galaxy 拾取。
8. README 加徽章: `[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)`。

## 5. dsh-plugin-hub / dsh-plugin.org【自动 + 可选加速】
- topic dsh-plugin + 公开仓库 + 根 package.json → 自动爬取（一个刷新周期收录）。
- 进 App 内 Plugin Hub 需已发 npm（步骤 3）。
- 可选加速 issue: 用 publish/hub-issue.md（替换 <owner>）。
- README 加徽章: `[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/<owner>/dsh-qwen-plan-usage)`。

## 6. dsh-plugin-shop【全自动，无提交入口】
- keywords(dsh-plugin/deepseek-harness) + topics → 每日收割，5 闸（dsh.bundle/license+源码/可安装/可信度/展示信息）。
- dsh.catalog 双语卡片已就绪。被拒查 https://LivXue.github.io/dsh-plugin-shop/v1/report.md。

## 7. feed / bruc3van【自动 + 可选自荐】
- 自动爬需 GitHub description + topic（步骤 2 已设）→ pending 队列 → 维护者 approve。
- 作者自荐 PR 需 stars>10（初期不满足，先靠自动爬）。

## 8. 官方 Discover 索引【可选，无官方提交】
- 多数插件直接依赖 awesome 索引（步骤 4），无需自建。
- 如需自托管: 用官方 apps/plugin-market-generator 生成 format-1 索引 JSON 托管 GitHub Pages，用户在 Discover（实验性 bundle，DSH 0.2.1+）添加索引 URL。

## 验证清单（交付前）
- [ ] npm view 可见，repository 指回仓库。
- [ ] GitHub 仓库公开 + topic dsh-plugin + description。
- [ ] README 含 `dsh plugin --profile web add dsh-qwen-plan-usage`。
- [ ] 本地 `DSH_HOME=temp; dsh plugin --profile web add dsh-qwen-plan-usage` 装通（或 GUI install-by-spec）。
- [ ] awesome PR 已提（≥1 天后 CI 放行）。
- [ ] 敏感临时物（cookie/key/profile 副本）已清理，不进仓库/npm 包。