// dsh-qwen-plan-usage — browser half.
//
// Hand-authored client bundle in the DSH module-loader factory format
// (`window.__ModuleLoader__.load({ id, factory })`). It registers a quota widget
// into the sidebar's `sidebar.footer.action` list slot and a configuration card
// into the Plugin Manager / Settings slots. Everything talks to the host's
// same-origin routes — the console cookie never enters the browser. UI strings
// are bilingual via the DSH locale service (namespace `dsh-qwen-plan-usage`).
window.__ModuleLoader__.load({
	id: "dsh-qwen-plan-usage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");

		const NS = "dsh-qwen-plan-usage";
		const BILLING_URL = "https://platform.qianwenai.com/home/analytics/token-plan/individual";

		// ── styles (injected once; themed alias tokens, light/dark safe) ──
		const CSS_ID = "dsh-qwen-plan-usage/widget.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"" + CSS_ID + "\"]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-qwen-plan-usage";
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = [
				".qpu-widget{box-sizing:border-box;width:100%;min-width:0;padding:6px 6px 4px;display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}",
				".qpu-widget:hover{background:var(--dsw-alias-interactive-bg-hover)}",
				".qpu-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;line-height:18px}",
				".qpu-refresh{cursor:pointer;border:none;background:none;padding:0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:18px}",
				".qpu-refresh:hover{color:var(--dsw-alias-label-primary)}",
				".qpu-plan{font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
				".qpu-row{display:flex;flex-direction:column;gap:3px;min-width:0}",
				".qpu-row-label{display:flex;justify-content:space-between;gap:8px;font-size:11px;line-height:15px;color:var(--dsw-alias-label-secondary)}",
				".qpu-row-label b{font-weight:500;color:var(--dsw-alias-label-primary)}",
				".qpu-meta{display:flex;align-items:center;gap:6px;min-width:0}",
				".qpu-meta .qpu-track{flex:1;min-width:0}",
				".qpu-meta>span{font-size:10px;line-height:14px;color:var(--dsw-alias-label-secondary);white-space:nowrap;flex:none}",
				".qpu-track{box-sizing:border-box;height:5px;border-radius:3px;background:var(--dsw-alias-border-l2);overflow:hidden}",
				".qpu-fill{height:100%;border-radius:3px;transition:width .4s ease}",
				".qpu-err{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
				".qpu-rail{box-sizing:border-box;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:10px;font-weight:700;color:var(--dsw-alias-label-primary);cursor:default}",
				".qpu-rail:hover{background:var(--dsw-alias-interactive-bg-hover)}",
				".qpu-config{box-sizing:border-box;display:flex;flex-direction:column;gap:10px;padding:12px;margin:0;list-style:none;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;color:var(--dsw-alias-label-primary)}",
				".qpu-config-title{font-size:14px;line-height:20px;font-weight:600}",
				".qpu-config-desc,.qpu-config-note,.qpu-config-status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
				".qpu-config-status.qpu-ok{color:var(--dsw-alias-state-success-primary)}",
				".qpu-config-status.qpu-error{color:var(--dsw-alias-state-error-primary)}",
				".qpu-config-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}",
				".qpu-config-field{display:flex;flex-direction:column;gap:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
				".qpu-config-field input,.qpu-config-field textarea{box-sizing:border-box;width:100%;min-height:30px;padding:4px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-fill-l1);color:var(--dsw-alias-label-primary);font:inherit}",
				".qpu-config-field textarea{min-height:72px;resize:vertical;font-size:12px}",
				".qpu-config-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
				".qpu-config-save{min-height:30px;padding:4px 12px;border:none;border-radius:6px;background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground);font:inherit;cursor:pointer}",
				".qpu-config-save:disabled{opacity:.45;cursor:default}",
				".qpu-config-secondary{min-height:30px;padding:4px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}",
				".qpu-config-secondary:disabled{opacity:.45;cursor:default}",
				".qpu-badge{font-size:11px;line-height:18px;padding:0 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary)}",
				".qpu-badge.qpu-ok{color:var(--dsw-alias-state-success-primary);border-color:currentColor}",
				".qpu-link{color:var(--dsw-alias-label-primary);font-size:12px;text-decoration:underline;cursor:pointer}"
			].join("");
			document.head.appendChild(tag);
		}

		// ── locale dictionaries ──
		const zh = {
			"window.weekly": "周用量",
			"window.monthly": "月用量",
			"window.fiveHour": "5小时用量",
			"time.soon": "即将重置",
			"time.minutes": "{n}分",
			"time.hours": "{n}小时{m}分",
			"time.days": "{n}天{m}小时",
			"refresh": "刷新",
			"loading": "加载中…",
			"rail.title": "Qwen 月用量 {pct}%",
			"rail.plain": "Qwen 额度",
			"widget.title": "Qwen Token Plan",
			"widget.notConnected": "未连接 · 去设置粘贴 Cookie",
			"remainingDays": "剩 {days} 天",
			"leftOf": "剩 {left}/{total}",
			"addon": "加油包",
			"addon.left": "剩 {left}/{total}",
			"error.SIGN_IN_REQUIRED": "未连接或 Cookie 已失效",
			"error.COOKIE_INVALID": "这不是浏览器 Cookie（请粘贴整条 Cookie，勿贴 API Key）",
			"error.NO_USAGE": "网关未返回用量百分比",
			"error.UPSTREAM_FAILED": "暂时读取不到用量，请重试",
			"config.title": "Qwen Token Plan 用量设置",
			"config.summary": "粘贴千问AI平台控制台 Cookie 以查询剩余额度；Cookie 仅存于本机凭据库。",
			"config.loading": "正在读取配置…",
			"config.connection": "连接",
			"config.connected": "已连接",
			"config.disconnected": "未连接",
			"config.cookie": "控制台 Cookie",
			"config.cookiePlaceholder": "从 platform.qianwenai.com 请求头里复制整条 Cookie 值",
			"config.cookieHint": "打开控制台用量页 → F12 网络 → 任一请求 → 复制 Cookie 请求头。推理 API Key 无法读取额度。",
			"config.saveCookie": "保存 Cookie",
			"config.signOut": "退出并删除 Cookie",
			"config.openConsole": "打开控制台用量页",
			"config.cacheMs": "缓存时间（毫秒）",
			"config.region": "区域",
			"config.commodityCode": "主套餐商品码",
			"config.addonCode": "加油包商品码",
			"config.csDataUrl": "额度网关（cs-data）",
			"config.homeUrl": "会话网关（home）",
			"config.consoleSite": "consoleSite",
			"config.consoleDomain": "控制台域名",
			"config.advanced": "高级（网关常量，一般无需修改）",
			"config.save": "保存设置",
			"config.saving": "保存中…",
			"config.saved": "已保存。",
			"config.cookieSaved": "Cookie 已保存并验证。",
			"config.signedOut": "已退出并删除 Cookie。",
			"config.failed": "失败：{msg}"
		};
		const en = {
			"window.weekly": "Weekly",
			"window.monthly": "Monthly",
			"window.fiveHour": "5-hour",
			"time.soon": "resets soon",
			"time.minutes": "{n}m",
			"time.hours": "{n}h{m}m",
			"time.days": "{n}d{m}h",
			"refresh": "Refresh",
			"loading": "Loading…",
			"rail.title": "Qwen monthly {pct}%",
			"rail.plain": "Qwen quota",
			"widget.title": "Qwen Token Plan",
			"widget.notConnected": "Not connected · paste cookie in Settings",
			"remainingDays": "{days} days left",
			"leftOf": "{left}/{total} left",
			"addon": "Booster",
			"addon.left": "{left}/{total} left",
			"error.SIGN_IN_REQUIRED": "Not connected or cookie expired",
			"error.COOKIE_INVALID": "Not a browser cookie (paste the whole Cookie header, not an API key)",
			"error.NO_USAGE": "Gateway returned no usage percentages",
			"error.UPSTREAM_FAILED": "Usage unavailable, please retry",
			"config.title": "Qwen Token Plan usage settings",
			"config.summary": "Paste a Qwen AI Platform console cookie to query remaining quota; the cookie stays in the local credential store.",
			"config.loading": "Loading configuration…",
			"config.connection": "Connection",
			"config.connected": "Connected",
			"config.disconnected": "Not connected",
			"config.cookie": "Console cookie",
			"config.cookiePlaceholder": "Paste the whole Cookie header from a platform.qianwenai.com request",
			"config.cookieHint": "Open the console usage page → F12 Network → any request → copy the Cookie request header. The inference API key cannot read quota.",
			"config.saveCookie": "Save cookie",
			"config.signOut": "Sign out and delete cookie",
			"config.openConsole": "Open console usage page",
			"config.cacheMs": "Cache time (milliseconds)",
			"config.region": "Region",
			"config.commodityCode": "Plan commodity code",
			"config.addonCode": "Booster commodity code",
			"config.csDataUrl": "Quota gateway (cs-data)",
			"config.homeUrl": "Session gateway (home)",
			"config.consoleSite": "consoleSite",
			"config.consoleDomain": "Console domain",
			"config.advanced": "Advanced (gateway constants; usually unchanged)",
			"config.save": "Save settings",
			"config.saving": "Saving…",
			"config.saved": "Saved.",
			"config.cookieSaved": "Cookie saved and verified.",
			"config.signedOut": "Signed out and cookie deleted.",
			"config.failed": "Failed: {msg}"
		};

		// ── helpers ──
		function timeUntil(iso, t) {
			const target = new Date(iso).getTime();
			if (!Number.isFinite(target)) return "";
			const diff = target - Date.now();
			if (diff <= 0) return t("time.soon");
			const mins = Math.floor(diff / 60000);
			if (mins < 60) return t("time.minutes", { n: mins });
			const hours = Math.floor(mins / 60);
			if (hours < 24) return t("time.hours", { n: hours, m: mins % 60 });
			return t("time.days", { n: Math.floor(hours / 24), m: hours % 24 });
		}

		function fillColor(percent) {
			if (percent >= 90) return "var(--dsw-alias-state-error-primary)";
			if (percent >= 70) return "var(--dsw-alias-state-warn-primary)";
			return "var(--dsw-alias-state-success-primary)";
		}

		function formatCount(value) {
			const numeric = Number(value);
			if (!Number.isFinite(numeric)) return "?";
			if (numeric >= 1000000) return (numeric / 1000000).toFixed(numeric % 1000000 === 0 ? 0 : 1) + "M";
			if (numeric >= 1000) return Math.round(numeric / 1000) + "K";
			return String(Math.round(numeric));
		}

		function errorText(t, code) {
			const key = "error." + code;
			const translated = t(key);
			return translated === key ? t("error.UPSTREAM_FAILED") : translated;
		}

		function requestJson(url, init) {
			return fetch(url, { cache: "no-store", credentials: "same-origin", ...init })
				.then((res) => res.json().catch(() => null).then((json) => ({ res, json })))
				.catch((error) => ({ res: { ok: false, status: 0 }, json: { ok: false, error: String((error && error.message) || error) } }));
		}

		// ── sidebar widget ──
		function Widget(props) {
			const t = props.t || ((key) => key);
			const [data, setData] = react.useState(null);
			const [error, setError] = react.useState(null);
			const [stamp, setStamp] = react.useState(0);

			react.useEffect(() => {
				let alive = true;
				const load = async () => {
					const { res, json } = await requestJson("/qwen-plan/usage");
					if (!alive) return;
					if (!res.ok || json === null || json.ok === false) {
						setError(String((json && json.error) || "HTTP " + res.status));
						setData(null);
						return;
					}
					setData(json);
					setError(null);
				};
				load();
				const timer = window.setInterval(load, 60000);
				return () => { alive = false; window.clearInterval(timer); };
			}, [stamp]);

			const usage = data && data.usage ? data.usage : null;
			const connected = data && data.configured === true;
			const monthPct = usage && typeof usage.monthPercent === "number" ? usage.monthPercent : null;
			const usageError = usage && usage.error ? errorText(t, usage.error) : null;

			if (!props.wide) {
				return react_jsx_runtime.jsx("div", {
					className: "qpu-rail",
					title: error ? ("Qwen: " + error) : (usageError ? ("Qwen: " + usageError) : (monthPct === null ? t("rail.plain") : t("rail.title", { pct: monthPct }))),
					children: monthPct === null ? "Q" : monthPct + "%"
				});
			}

			const windows = [];
			if (usage) {
				if (typeof usage.fiveHourPercent === "number") windows.push(["fiveHour", usage.fiveHourPercent, usage.fiveHourRemaining, usage.fiveHourTotal, usage.fiveHourResetAt]);
				if (typeof usage.weekPercent === "number") windows.push(["weekly", usage.weekPercent, usage.weekRemaining, usage.weekTotal, usage.weekResetAt]);
				if (typeof usage.monthPercent === "number") windows.push(["monthly", usage.monthPercent, usage.monthRemaining, usage.monthTotal, usage.monthResetAt]);
			}

			const rows = windows.map(([key, pct, left, total, reset]) => {
				const meta = [];
				if (left !== undefined && total !== undefined) meta.push(t("leftOf", { left: formatCount(left), total: formatCount(total) }));
				if (reset) meta.push(timeUntil(reset, t));
				return react_jsx_runtime.jsx("div", {
					className: "qpu-row",
					children: [
						react_jsx_runtime.jsx("div", {
							className: "qpu-row-label",
							children: [
								react_jsx_runtime.jsx("b", { children: t("window." + key) }),
								react_jsx_runtime.jsx("b", { children: pct + "%" })
							]
						}),
						react_jsx_runtime.jsx("div", {
							className: "qpu-meta",
							children: [
								react_jsx_runtime.jsx("div", {
									className: "qpu-track",
									children: react_jsx_runtime.jsx("div", { className: "qpu-fill", style: { width: Math.max(0, Math.min(100, pct)) + "%", background: fillColor(pct) } })
								}),
								react_jsx_runtime.jsx("span", { children: meta.join(" · ") })
							]
						})
					]
				}, key);
			});

			const planBits = [];
			if (usage && usage.plan) planBits.push(usage.plan);
			if (usage && usage.remainingDays !== undefined) planBits.push(t("remainingDays", { days: usage.remainingDays }));

			const addonRows = (usage && Array.isArray(usage.addons) ? usage.addons : []).map((a, i) =>
				react_jsx_runtime.jsx("div", {
					className: "qpu-plan",
					children: t("addon") + (a.name ? " " + a.name : "") + " · " + t("addon.left", { left: formatCount(a.remaining), total: formatCount(a.total) })
				}, "addon" + i));

			return react_jsx_runtime.jsx("div", {
				className: "qpu-widget",
				children: [
					react_jsx_runtime.jsx("div", {
						className: "qpu-head",
						children: [
							react_jsx_runtime.jsx("span", { children: t("widget.title") }),
							react_jsx_runtime.jsx("button", { className: "qpu-refresh", onClick: () => setStamp((s) => s + 1), children: t("refresh") })
						]
					}),
					error ? react_jsx_runtime.jsx("div", { className: "qpu-err", children: error }) : null,
					!error && !connected ? react_jsx_runtime.jsx("div", { className: "qpu-err", children: t("widget.notConnected") }) : null,
					!error && connected && usageError && rows.length === 0 ? react_jsx_runtime.jsx("div", { className: "qpu-err", children: usageError }) : null,
					!error && connected && data === null ? react_jsx_runtime.jsx("div", { className: "qpu-err", children: t("loading") }) : null,
					planBits.length > 0 ? react_jsx_runtime.jsx("div", { className: "qpu-plan", children: planBits.join(" · ") }) : null,
					rows.length > 0 ? react_jsx_runtime.jsx(react.Fragment, { children: rows }) : null,
					addonRows.length > 0 ? react_jsx_runtime.jsx(react.Fragment, { children: addonRows }) : null
				]
			});
		}

		// ── configuration card ──
		function ConfigCard(props) {
			const t = (props && props.t) || ((key) => key);
			const [saved, setSaved] = react.useState(null);
			const [draft, setDraft] = react.useState(null);
			const [cookie, setCookie] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [line, setLine] = react.useState(null);

			const applySnapshot = (json) => {
				setSaved(json);
				setDraft({
					cacheMs: String(typeof json.cacheMs === "number" ? json.cacheMs : 30000),
					region: json.region || "",
					commodityCode: json.commodityCode || "",
					addonCode: json.addonCode || "",
					csDataUrl: json.csDataUrl || "",
					homeUrl: json.homeUrl || "",
					consoleSite: json.consoleSite || "",
					consoleDomain: json.consoleDomain || ""
				});
			};

			react.useEffect(() => {
				let alive = true;
				requestJson("/dsh-qwen-plan-usage/config").then(({ res, json }) => {
					if (!alive) return;
					if (json && json.ok === true) applySnapshot(json);
					else setLine({ ok: false, text: t("config.failed", { msg: String((json && json.error) || "HTTP " + res.status) }) });
				});
				return () => { alive = false; };
			}, []);

			const setField = (name, value) => setDraft((current) => current === null ? current : { ...current, [name]: value });

			const saveCookie = async () => {
				if (busy) return;
				setBusy(true); setLine(null);
				try {
					const { res, json } = await requestJson("/qwen-plan/sign-in", {
						method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cookie })
					});
					if (!json || json.ok !== true) { setLine({ ok: false, text: t("config.failed", { msg: errorText(t, String((json && json.error) || "HTTP " + res.status)) }) }); return; }
					setCookie("");
					setSaved((s) => s === null ? s : { ...s, cookieConfigured: true });
					setLine({ ok: true, text: t("config.cookieSaved") });
				} finally { setBusy(false); }
			};

			const signOut = async () => {
				if (busy) return;
				setBusy(true); setLine(null);
				try {
					const { res, json } = await requestJson("/qwen-plan/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
					if (!json || json.ok !== true) { setLine({ ok: false, text: t("config.failed", { msg: String((json && json.error) || "HTTP " + res.status) }) }); return; }
					setSaved((s) => s === null ? s : { ...s, cookieConfigured: false });
					setLine({ ok: true, text: t("config.signedOut") });
				} finally { setBusy(false); }
			};

			const saveSettings = async () => {
				if (draft === null || busy) return;
				setBusy(true); setLine(null);
				try {
					const { res, json } = await requestJson("/dsh-qwen-plan-usage/config", {
						method: "POST", headers: { "content-type": "application/json" },
						body: JSON.stringify({
							cacheMs: Number(draft.cacheMs),
							region: draft.region.trim(),
							commodityCode: draft.commodityCode.trim(),
							addonCode: draft.addonCode.trim(),
							csDataUrl: draft.csDataUrl.trim(),
							homeUrl: draft.homeUrl.trim(),
							consoleSite: draft.consoleSite.trim(),
							consoleDomain: draft.consoleDomain.trim()
						})
					});
					if (!json || json.ok !== true) { setLine({ ok: false, text: t("config.failed", { msg: String((json && json.error) || "HTTP " + res.status) }) }); return; }
					applySnapshot(json);
					setLine({ ok: true, text: t("config.saved") });
				} finally { setBusy(false); }
			};

			if (draft === null) {
				return react_jsx_runtime.jsx("li", {
					className: "qpu-config",
					children: [
						react_jsx_runtime.jsx("div", { className: "qpu-config-title", children: t("config.title") }),
						react_jsx_runtime.jsx("div", { className: "qpu-config-desc", children: t("config.loading") })
					]
				});
			}

			const connected = saved && saved.cookieConfigured === true;
			const field = (name, labelKey, type) => react_jsx_runtime.jsx("label", {
				className: "qpu-config-field",
				children: [
					t(labelKey),
					react_jsx_runtime.jsx("input", {
						type: type || "text",
						"aria-label": t(labelKey),
						value: draft[name],
						onChange: (event) => setField(name, event.target.value),
						disabled: busy
					})
				]
			}, name);

			return react_jsx_runtime.jsx("li", {
				className: "qpu-config",
				children: [
					react_jsx_runtime.jsx("div", { className: "qpu-config-title", children: t("config.title") }),
					react_jsx_runtime.jsx("div", { className: "qpu-config-desc", children: t("config.summary") }),
					react_jsx_runtime.jsx("div", {
						className: "qpu-config-actions",
						children: [
							react_jsx_runtime.jsx("span", { className: "qpu-badge " + (connected ? "qpu-ok" : ""), children: connected ? t("config.connected") : t("config.disconnected") }),
							react_jsx_runtime.jsx("a", { className: "qpu-link", href: BILLING_URL, target: "_blank", rel: "noreferrer", children: t("config.openConsole") })
						]
					}),
					react_jsx_runtime.jsx("label", {
						className: "qpu-config-field",
						children: [
							t("config.cookie"),
							react_jsx_runtime.jsx("textarea", {
								"aria-label": t("config.cookie"),
								value: cookie,
								placeholder: t("config.cookiePlaceholder"),
								autoComplete: "off",
								spellCheck: false,
								rows: 4,
								onChange: (event) => setCookie(event.target.value),
								disabled: busy
							})
						]
					}),
					react_jsx_runtime.jsx("div", { className: "qpu-config-note", children: t("config.cookieHint") }),
					react_jsx_runtime.jsx("div", {
						className: "qpu-config-actions",
						children: [
							react_jsx_runtime.jsx("button", { className: "qpu-config-save", onClick: saveCookie, disabled: busy || cookie.trim().length === 0, children: t("config.saveCookie") }),
							connected ? react_jsx_runtime.jsx("button", { className: "qpu-config-secondary", onClick: signOut, disabled: busy, children: t("config.signOut") }) : null
						]
					}),
					react_jsx_runtime.jsx("div", { className: "qpu-config-note", children: t("config.advanced") }),
					react_jsx_runtime.jsx("div", {
						className: "qpu-config-grid",
						children: [
							field("cacheMs", "config.cacheMs", "number"),
							field("region", "config.region"),
							field("commodityCode", "config.commodityCode"),
							field("addonCode", "config.addonCode"),
							field("csDataUrl", "config.csDataUrl"),
							field("homeUrl", "config.homeUrl"),
							field("consoleSite", "config.consoleSite"),
							field("consoleDomain", "config.consoleDomain")
						]
					}),
					react_jsx_runtime.jsx("div", {
						className: "qpu-config-actions",
						children: react_jsx_runtime.jsx("button", { className: "qpu-config-save", onClick: saveSettings, disabled: busy, children: busy ? t("config.saving") : t("config.save") })
					}),
					line ? react_jsx_runtime.jsx("div", { className: "qpu-config-status " + (line.ok ? "qpu-ok" : "qpu-error"), children: line.text }) : null
				]
			});
		}

		// ── cordis plugin entry ──
		const inject = ["slots", "locale"];

		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-qwen-plan-usage: dictionaries");
			const registerWidget = () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: NS,
				order: 0,
				label: "Qwen Token Plan",
				locale: NS
			}, Widget);
			if (typeof ctx.slots.inject === "function") {
				ctx.slots.inject("sidebar.footer.action", registerWidget);
			} else {
				ctx.effect(registerWidget, "dsh-qwen-plan-usage: widget registration");
			}

			const fallback = (key) => zh[key] || key;
			const bound = typeof ctx.locale.bind === "function" ? ctx.locale.bind(NS) : fallback;
			const renderConfig = (props) => {
				const translate = typeof props?.t === "function" ? props.t : bound;
				if (props?.view === "summary") return translate("config.summary");
				return ConfigCard({ ...(props || {}), t: translate });
			};
			const registerConfig = (slot, options, label) => {
				const register = () => ctx.slots.register({ name: slot, ...options }, renderConfig);
				if (typeof ctx.slots.inject === "function") {
					ctx.effect(() => ctx.slots.inject(slot, register), label);
				} else {
					ctx.effect(register, label);
				}
			};
			registerConfig("settings.plugin.item", { key: NS }, "dsh-qwen-plan-usage: legacy configuration card");
			registerConfig("plugins.bundle.config", { key: NS, locale: NS }, "dsh-qwen-plan-usage: bundle configuration card");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
