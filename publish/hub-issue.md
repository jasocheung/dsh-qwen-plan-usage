# dsh-plugin-hub / dsh-plugin.org 加速提交 issue 模板（可选；topic 已可自动发现）
# 提交地址:
#   https://github.com/dshplugin/dsh-plugin-hub/issues/new?title=%5BPlugin%20submission%5D%20<owner>/dsh-qwen-plan-usage%20—%20Qwen%20Token%20Plan%20quota%20widget
# 说明页: https://dsh-plugin.org/submit （中文 https://dsh-plugin.org/zh/submit）
# 进 App 内 Plugin Hub 的前提: 已发布 npm（Hub 只列一步 npm 可安装插件）。

## 标题
[Plugin submission] <owner>/dsh-qwen-plan-usage — Qwen Token Plan remaining-quota sidebar widget

## 正文
**Repository**: https://github.com/<owner>/dsh-qwen-plan-usage

**One-line value**: Shows your Qwen AI Platform Token Plan remaining Credits, usage percent and reset time in the DSH sidebar; when no cookie is configured it guides the model to auto-fetch the console cookie from your browser.

**Category**: interface （侧边栏 UI 组件；hub 11 类: interface session memory tools agent workflow integration model dev knowledge fun）

**Install command**: `dsh plugin --profile web add dsh-qwen-plan-usage`

**Compatibility**:
- DSH: tested on 0.1.7-rc.2 (desktop profile); engines.dsh `>=0.1.0-rc.1 <0.3.0-0`.
- Node: >= 18.
- Profiles: web / desktop.
- Auto cookie extraction: Windows + Edge/Chrome (headless profile copy); manual paste elsewhere.

**License**: MIT

**Screenshots/demo**: （待补：侧边栏组件截图，GitHub 托管）

**Notes**: 自研插件，作者真实使用（千问 Token Plan Standard 个人版）。额度数据来自千问控制台登录态接口（cs-data.qianwenai.com），cookie 仅存 DSH 凭据库、只用于查官方额度接口。非官方插件，不冒充官方。

**Pre-submission checklist**:
- [x] 仓库公开
- [x] topic `dsh-plugin`
- [x] README 含 `dsh plugin --profile web add dsh-qwen-plan-usage`
- [x] 导出 apply(ctx)
- [x] 仓库根 package.json（name + version）
- [x] dsh.bundle.patch
- [ ] 已发布 npm（进 App Hub 必需）
- [x] 不冒充官方