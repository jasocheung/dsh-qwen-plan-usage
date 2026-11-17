// @ts-check
/**
 * dsh-qwen-plan-usage — model guidance.
 *
 * When the plugin is installed but no Qwen console cookie is configured, the
 * host registers a `systemPrompt.context` whose text is built here. The text is
 * injected into every model step until a cookie is stored, telling the agent to
 * obtain the cookie ITSELF from the user's logged-in browser (rather than asking
 * the user to copy/paste). Once a cookie is configured the text is empty and the
 * context is filtered out of the prompt.
 *
 * Pure module: no DSH imports, so it is unit-testable with `node --test`.
 */

/**
 * Build the unconfigured-cookie guidance for the agent.
 * @param {object} options
 * @param {string} [options.locale] - "zh" (default) or "en".
 * @param {string} options.scriptPath - absolute path of scripts/extract-cookie.mjs.
 * @param {string} [options.origin] - DSH Web GUI origin, e.g. http://127.0.0.1:43120.
 * @returns {string} guidance text (empty string is filtered out by the prompt registry).
 */
export function buildCookieGuidance({ locale = "zh", scriptPath, origin } = {}) {
	const zh = locale !== "en";
	const base = origin && origin.length > 0 ? origin.replace(/\/+$/, "") : "<DSH-Web-GUI-origin>";
	const script = scriptPath ?? "<plugin>/scripts/extract-cookie.mjs";
	if (zh) {
		return [
			"[dsh-qwen-plan-usage] 插件已安装，但尚未配置千问控制台 Cookie，侧边栏无法显示 Token Plan 剩余额度。",
			"请你自己从用户已登录的浏览器获取 Cookie，不要让用户手动复制粘贴。按以下步骤操作：",
			`1. 运行内置提取脚本（自动检测 Chrome/Edge，复制浏览器 profile 后用无头 CDP 解密 qianwenai.com 会话 Cookie；Windows 下若 Cookie 数据库被浏览器占用，会自动用句柄复制读取）：`,
			`   node "${script}" --domain qianwenai.com`,
			"   脚本输出一行 Cookie 串（形如 name=value; name2=value2）。加 --json 可看结构化结果；加 --browser edge|chrome 可指定浏览器。",
			`2. 把 Cookie 提交给本机插件路由（与 DSH Web GUI 同源，例如 ${base}）：`,
			`   curl -s -X POST "${base}/qwen-plan/sign-in" -H "content-type: application/json" --data "{\\"cookie\\":\\"<第1步的Cookie串>\\"}"`,
			`   返回 {"ok":true,...,"usage":{...月额度...}} 即成功；也可让脚本直接提交：node "${script}" --domain qianwenai.com --sign-in "${base}/qwen-plan/sign-in"。`,
			`3. 用 GET ${base}/qwen-plan/usage 复核剩余额度，并告知用户当前剩余 Credits 与重置时间。`,
			"前提：用户须已在浏览器登录 https://platform.qianwenai.com 。若脚本报告未找到登录态（no matching cookies / not signed in），请提示用户先在浏览器登录该控制台再重试；仅在自动提取确实不可用（无浏览器/非 Windows 且无登录态）时，才退而请用户在 设置 → 插件 → dsh-qwen-plan-usage 手动粘贴 Cookie。",
			"安全：Cookie 是用户本人控制台的会话凭据，只提交给本机 DSH 插件路由，不要外发、不要写进交付物/日志/截图。配置成功后本引导自动消失。"
		].join("\n");
	}
	return [
		"[dsh-qwen-plan-usage] The plugin is installed but no Qwen console cookie is configured, so the sidebar cannot show Token Plan remaining quota.",
		"Obtain the cookie YOURSELF from the user's logged-in browser; do not ask the user to copy/paste. Steps:",
		`1. Run the bundled extractor (auto-detects Chrome/Edge, copies the browser profile and decrypts qianwenai.com session cookies via headless CDP; on Windows it reads a browser-locked cookie DB by handle duplication):`,
		`   node "${script}" --domain qianwenai.com`,
		"   It prints one cookie header line (name=value; name2=value2). Add --json for structured output; --browser edge|chrome to pick a browser.",
		`2. Submit the cookie to the local plugin route (same origin as the DSH Web GUI, e.g. ${base}):`,
		`   curl -s -X POST "${base}/qwen-plan/sign-in" -H "content-type: application/json" --data "{\\"cookie\\":\\"<cookie line from step 1>\\"}"`,
		`   {"ok":true,...,"usage":{...monthly quota...}} means success. Or let the script submit directly: node "${script}" --domain qianwenai.com --sign-in "${base}/qwen-plan/sign-in".`,
		`3. Verify with GET ${base}/qwen-plan/usage and tell the user the remaining Credits and reset time.`,
		"Prerequisite: the user must be logged in to https://platform.qianwenai.com in their browser. If the script reports no matching cookies / not signed in, ask the user to log in to that console first, then retry. Only if automated extraction is genuinely unavailable (no browser / non-Windows without a session) fall back to asking the user to paste the cookie in Settings → Plugins → dsh-qwen-plan-usage.",
		"Security: the cookie is the user's own console session credential; submit it only to the local DSH plugin route, never exfiltrate it or write it into deliverables/logs/screenshots. This guidance disappears once a cookie is configured."
	].join("\n");
}