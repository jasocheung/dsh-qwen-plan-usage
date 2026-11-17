// @ts-check
/**
 * dsh-qwen-plan-usage — host half.
 *
 * Shows the remaining quota of a Qwen AI Platform (platform.qianwenai.com)
 * Token Plan subscription in the DSH sidebar, plus a /qwen-plan chat command.
 *
 * The inference API key (sk-sp-…) cannot read plan quota — there is no public
 * usage REST endpoint on the token-plan gateway. Usage lives behind the console
 * session, so this plugin replays the console's own bailian gateway calls with a
 * browser cookie the user pastes once. The cookie and sec_token stay in the DSH
 * credential store and only leave this process as request headers to
 * *.qianwenai.com.
 *
 * Domestic (cn) contract verified against live console traffic (CDP capture):
 * the personal quota APIs call the BAILIAN cs-data gateway
 * cs-data.qianwenai.com /data/api.json?product=sfm_bailian&action=BroadScopeAspnGateway&api=<Api>,
 * region cn-beijing, commodityCode sfm_tokenplansolo_public_cn, cornerstoneParam
 * consoleSite QIANWENAI, xsp_lang zh-CN. The sec_token comes from the HOME gateway
 * platform-home.qianwenai.com /tool/user/info.json. Every gateway constant is
 * exposed in Config so it can be tuned without a code change.
 *
 * Routes (same-origin, browser never sees the cookie):
 *   GET  /qwen-plan/state                 — connection snapshot
 *   GET  /qwen-plan/usage[?refresh=1]     — quota proxy
 *   POST /qwen-plan/sign-in   {cookie}    — validate + store a pasted cookie
 *   POST /qwen-plan/sign-out              — delete the stored cookie
 *   GET/POST /dsh-qwen-plan-usage/config  — plugin configuration card
 *   GET  /dsh-qwen-plan-usage/client.js   — self-hosted browser bundle
 */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { QwenPlanError, normalizeCookie, assembleUsage } from "./parse.js";
import { buildCookieGuidance } from "./guidance.js";

export const name = "dsh-qwen-plan-usage";
export const namespace = "dsh-qwen-plan-usage";
/** Required services: web routes, chat commands, credentials, settings. */
export const inject = ["webServer", "commands", "credentials", "settings"];

const CREDENTIAL_KEY = "dsh-qwen-plan-usage/session";
const COOKIE_LIMIT = 32_768;
const AUTH_NEGATIVE_CACHE_MS = 5_000;

const USAGE_API = "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/usage";
const SUBSCRIPTION_API = "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/subscription";
const QUOTA_API = "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/quota-config";
const ADDON_API = "zeldaHttp.apikeyMgr./tokenplan/personal/api/v2/addon/list";

/**
 * Plugin configuration. Gateway constants default to the domestic Qwen AI
 * Platform console; they are editable so a different site/region can be reached
 * without touching code.
 */
export const Config = z.object({
	cacheMs: z.number().default(30_000),
	region: z.string().default("cn-beijing"),
	commodityCode: z.string().default("sfm_tokenplansolo_public_cn"),
	addonCode: z.string().default("sfm_tokenplansoloaddon_public_cn"),
	csDataUrl: z.string().default("https://cs-data.qianwenai.com"),
	homeUrl: z.string().default("https://platform-home.qianwenai.com"),
	consoleSite: z.string().default("QIANWENAI"),
	consoleDomain: z.string().default("platform.qianwenai.com")
});

function safeMessage(error) {
	return String(error instanceof Error ? error.message : error)
		.replace(/sk-[A-Za-z0-9._-]{6,}/g, "sk-REDACTED")
		.replace(/sec_token=[^&\s]+/gi, "sec_token=REDACTED")
		.slice(0, 180);
}

function errorCode(error) {
	if (error instanceof QwenPlanError) return error.code;
	const message = safeMessage(error);
	if (/ConsoleNeedLogin|HTTP 401|HTTP 403|HTTP 302/.test(message)) return "SIGN_IN_REQUIRED";
	return message || "UPSTREAM_FAILED";
}

async function readJson(response) {
	const text = await response.text();
	if (!text) return {};
	try { return JSON.parse(text); } catch {
		throw new QwenPlanError("UPSTREAM_FAILED", `Qwen returned non-JSON HTTP ${response.status}`);
	}
}

async function consoleGet(url, cookie) {
	const response = await fetch(url, {
		redirect: "manual",
		signal: AbortSignal.timeout(20_000),
		headers: { cookie, accept: "application/json" }
	});
	if (response.status >= 300 && response.status < 400) {
		throw new QwenPlanError("SIGN_IN_REQUIRED", `Qwen HTTP ${response.status}`);
	}
	const body = await readJson(response);
	if (!response.ok || body.code === "ConsoleNeedLogin") {
		throw new QwenPlanError(
			response.status === 401 || response.status === 403 || body.code === "ConsoleNeedLogin"
				? "SIGN_IN_REQUIRED" : "UPSTREAM_FAILED",
			`Qwen HTTP ${response.status}`
		);
	}
	return body;
}

async function secToken(cfg, cookie) {
	const body = await consoleGet(`${cfg.homeUrl.replace(/\/+$/, "")}/tool/user/info.json`, cookie);
	const token = body?.data?.secToken;
	if (typeof token !== "string" || token.length === 0) {
		throw new QwenPlanError("SIGN_IN_REQUIRED", "Qwen session has no sec_token");
	}
	return token;
}

async function callBailian(cfg, cookie, token, api, extraData = {}) {
	const params = {
		Api: api,
		V: "1.0",
		Data: {
			commodityCode: cfg.commodityCode,
			...extraData,
			cornerstoneParam: {
				domain: cfg.consoleDomain,
				consoleSite: cfg.consoleSite,
				console: "ONE_CONSOLE",
				xsp_lang: "zh-CN",
				protocol: "V2",
				productCode: "p_efm"
			}
		}
	};
	const body = new URLSearchParams({
		product: "sfm_bailian",
		action: "BroadScopeAspnGateway",
		sec_token: token,
		region: cfg.region,
		params: JSON.stringify(params)
	});
	const url = `${cfg.csDataUrl.replace(/\/+$/, "")}/data/api.json?product=sfm_bailian&action=BroadScopeAspnGateway&api=${encodeURIComponent(api)}`;
	const response = await fetch(url, {
		method: "POST",
		redirect: "manual",
		signal: AbortSignal.timeout(20_000),
		headers: {
			cookie,
			accept: "application/json",
			"content-type": "application/x-www-form-urlencoded",
			origin: `https://${cfg.consoleDomain}`,
			referer: `https://${cfg.consoleDomain}/home/billing/subscription/token-plan-individual`
		},
		body
	});
	if (response.status >= 300 && response.status < 400) {
		throw new QwenPlanError("SIGN_IN_REQUIRED", `Qwen HTTP ${response.status}`);
	}
	const payload = await readJson(response);
	if (!response.ok || payload.code === "ConsoleNeedLogin") {
		throw new QwenPlanError(
			response.status === 401 || response.status === 403 || payload.code === "ConsoleNeedLogin"
				? "SIGN_IN_REQUIRED" : "UPSTREAM_FAILED",
			`Qwen HTTP ${response.status}`
		);
	}
	return payload;
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > COOKIE_LIMIT + 4096) {
				reject(new QwenPlanError("COOKIE_INVALID", "request body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}

/** Turn Loader Config's stable references into ordinary JSON-shaped values. */
function plainConfigValue(value) {
	if (value !== null && typeof value === "object" && typeof value.get === "function") {
		return plainConfigValue(value.get());
	}
	if (Array.isArray(value)) return value.map(plainConfigValue);
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plainConfigValue(child)]));
	}
	return value;
}

/** Read another plugin's effective config (locale) across DSH settings generations. */
function settingsValue(ctx, ns) {
	try {
		if (typeof ctx.settings?.get === "function") return ctx.settings.get(ns);
		const editor = ctx.get("configEditor");
		const entry = typeof editor?.entries === "function"
			? editor.entries().find((candidate) => candidate.options?.id === ns)
			: undefined;
		return entry?.fiber?.config === undefined ? undefined : plainConfigValue(entry.fiber.config);
	} catch {
		return undefined;
	}
}

function shortHash(input) {
	return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

/** Inject one boot-graph row into index.html (`window.__DSH_BOOT__ = [...]`). */
function injectGraphRow(html, row) {
	const marker = "window.__DSH_BOOT__ = ";
	const start = html.indexOf(marker);
	if (start === -1) return html;
	const bodyStart = start + marker.length;
	const end = html.indexOf("</script>", bodyStart);
	if (end === -1) return html;
	let graph;
	try { graph = JSON.parse(html.slice(bodyStart, end).trim()); } catch { return html; }
	if (!Array.isArray(graph)) return html;
	if (graph.some((entry) => entry !== null && typeof entry === "object" && entry.id === row.id)) return html;
	graph.push(row);
	return html.slice(0, bodyStart) + JSON.stringify(graph).replaceAll("<", "\\u003c") + html.slice(end);
}

/** Localized text for the /qwen-plan command. */
function renderUsageText(data, lang) {
	const zh = lang !== "en";
	if (!data || data.signedIn === false) {
		return zh
			? "Qwen Token Plan: 未连接。请在 设置 → 插件 → dsh-qwen-plan-usage 粘贴控制台 Cookie。"
			: "Qwen Token Plan: not connected. Paste the console cookie in Settings → Plugins → dsh-qwen-plan-usage.";
	}
	if (data.error) {
		return zh ? `Qwen Token Plan: 读取失败 (${data.error})` : `Qwen Token Plan: failed (${data.error})`;
	}
	const lines = [data.plan ?? "Token Plan"];
	if (data.remainingDays !== undefined) lines.push(zh ? `剩余 ${data.remainingDays} 天` : `${data.remainingDays} days left`);
	const win = (label, pct, used, total, remaining, reset) => {
		if (pct === undefined) return;
		let s = `${label}: ${pct}%`;
		if (used !== undefined && total !== undefined) {
			const left = remaining ?? (total - used);
			s += zh ? `（已用 ${used}/${total}，剩 ${left}）` : ` (used ${used}/${total}, ${left} left)`;
		}
		if (reset) s += zh ? `，重置 ${reset}` : `, resets ${reset}`;
		lines.push(s);
	};
	win(zh ? "周用量" : "Weekly", data.weekPercent, data.weekUsed, data.weekTotal, data.weekRemaining, data.weekResetAt);
	win(zh ? "月用量" : "Monthly", data.monthPercent, data.monthUsed, data.monthTotal, data.monthRemaining, data.monthResetAt);
	win(zh ? "5小时用量" : "5-hour", data.fiveHourPercent, data.fiveHourUsed, data.fiveHourTotal, data.fiveHourRemaining, data.fiveHourResetAt);
	for (const a of data.addons ?? []) {
		lines.push(zh
			? `加油包${a.name ? " " + a.name : ""}: 剩 ${a.remaining ?? "?"}/${a.total ?? "?"}${a.expireAt ? "，到期 " + a.expireAt : ""}`
			: `Booster${a.name ? " " + a.name : ""}: ${a.remaining ?? "?"}/${a.total ?? "?"} left${a.expireAt ? ", expires " + a.expireAt : ""}`);
	}
	return lines.join("\n");
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, unknown>} rawConfig
 */
export function apply(ctx, rawConfig = {}) {
	const legacySettings = typeof ctx.settings?.register === "function" && typeof ctx.settings?.get === "function";
	if (legacySettings) ctx.settings.register(namespace, Config, { base: rawConfig });
	let loaderConfig = legacySettings ? undefined : Config(rawConfig);
	if (!legacySettings && typeof ctx.settings?.configure === "function") {
		ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber), "dsh-qwen-plan-usage: settings presentation");
	}

	const readConfig = () => {
		const stored = legacySettings ? ctx.settings.get(namespace) ?? {} : loaderConfig;
		const locale = settingsValue(ctx, "locale")?.preference ?? "zh";
		return {
			cacheMs: stored.cacheMs,
			region: stored.region,
			commodityCode: stored.commodityCode,
			addonCode: stored.addonCode,
			csDataUrl: stored.csDataUrl,
			homeUrl: stored.homeUrl,
			consoleSite: stored.consoleSite,
			consoleDomain: stored.consoleDomain,
			locale
		};
	};

	const updateOwnConfig = async (patch) => {
		if (legacySettings) {
			await ctx.settings.update(namespace, patch);
			return Config(ctx.settings.get(namespace) ?? { ...rawConfig, ...patch });
		}
		const entry = ctx.fiber?.entry;
		const editor = ctx.get("configEditor");
		if (entry !== undefined && typeof editor?.edit === "function") {
			let written;
			await editor.edit(entry, (raw) => {
				const base = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
				written = { ...base, ...structuredClone(patch) };
				Config(written);
				return written;
			});
			loaderConfig = Config(written ?? { ...loaderConfig, ...patch });
			return loaderConfig;
		}
		if (typeof ctx.settings?.update === "function") {
			const ns = ctx.fiber?.entry?.options?.id ?? namespace;
			await ctx.settings.update(ns, patch);
			loaderConfig = Config(settingsValue(ctx, ns) ?? { ...loaderConfig, ...patch });
			return loaderConfig;
		}
		throw new Error("DSH has no writable configuration service for this plugin");
	};

	/** @type {undefined | {at: number, hash: string, data: any}} */
	let cache;
	let negativeUntil = 0;

	const readCookie = async () => {
		const record = await ctx.credentials.readRecord(CREDENTIAL_KEY);
		const payload = record?.kind === "grant" ? record.payload : undefined;
		if (!payload || typeof payload !== "object" || payload.type !== "cookie") return undefined;
		if (typeof payload.cookie !== "string" || payload.cookie.length === 0) return undefined;
		return payload.cookie;
	};

	const configured = async () => {
		try {
			const record = await ctx.credentials.describeRecord(CREDENTIAL_KEY);
			return record?.configured === true;
		} catch (error) {
			ctx.logger.warn("dsh-qwen-plan-usage: failed to describe the session record");
			ctx.logger.warn(safeMessage(error));
			return false;
		}
	};

	// Connection state for the model guidance: true once a cookie is stored.
	// The systemPrompt context text is synchronous, so it reads this cached flag
	// rather than awaiting the credential store on every model step.
	let connected = false;
	const refreshConnected = async () => { connected = await configured(); };

	const saveCookie = async (cookie) => {
		await ctx.credentials.modifyRecord(CREDENTIAL_KEY, async () => ({
			kind: "grant",
			payload: { type: "cookie", cookie }
		}));
	};

	const loadUsage = async (cfg, cookie) => {
		const token = await secToken(cfg, cookie);
		const [usage, subscription, quota, addon] = await Promise.all([
			callBailian(cfg, cookie, token, USAGE_API),
			callBailian(cfg, cookie, token, SUBSCRIPTION_API, { commodityCode: cfg.commodityCode }),
			callBailian(cfg, cookie, token, QUOTA_API),
			callBailian(cfg, cookie, token, ADDON_API, { commodityCode: cfg.addonCode, status: ["ACTIVE"], pageNum: 1, pageSize: 10 }).catch(() => undefined)
		]);
		const assembled = assembleUsage({ usage, subscription, quota, addon });
		if (assembled.weekPercent === undefined && assembled.monthPercent === undefined && assembled.fiveHourPercent === undefined) {
			throw new QwenPlanError("NO_USAGE", "Qwen returned no usage percentages");
		}
		return assembled;
	};

	const usageView = async (force = false) => {
		const cfg = readConfig();
		const signedIn = await configured();
		if (!signedIn) return { signedIn: false, error: "SIGN_IN_REQUIRED", fetchedAt: Date.now() };
		const cookie = await readCookie();
		if (!cookie) return { signedIn: false, error: "SIGN_IN_REQUIRED", fetchedAt: Date.now() };
		const hash = shortHash(JSON.stringify([cfg.csDataUrl, cfg.homeUrl, cfg.region, cfg.commodityCode, cfg.consoleSite, shortHash(cookie)]));
		if (!force && cache && cache.hash === hash && Date.now() - cache.at < cfg.cacheMs) return cache.data;
		if (!force && Date.now() < negativeUntil) return { signedIn: true, error: "SIGN_IN_REQUIRED", fetchedAt: Date.now() };
		try {
			const data = { signedIn: true, ...await loadUsage(cfg, cookie), error: null, fetchedAt: Date.now() };
			cache = { at: Date.now(), hash, data };
			negativeUntil = 0;
			return data;
		} catch (error) {
			const code = errorCode(error);
			if (code === "SIGN_IN_REQUIRED") negativeUntil = Date.now() + AUTH_NEGATIVE_CACHE_MS;
			cache = undefined;
			return { signedIn: true, error: code, fetchedAt: Date.now() };
		}
	};

	const snapshot = async () => ({ configured: await configured(), status: "idle", error: null });

	const originAllowed = (req) => {
		const origin = req.headers.origin;
		if (typeof origin !== "string" || origin.length === 0) return true;
		const host = req.headers.host;
		if (typeof host !== "string" || host.length === 0) return false;
		try { return new URL(origin).host === host; } catch { return false; }
	};

	const sendJson = (res, status, body) => {
		const payload = JSON.stringify(body);
		res.writeHead(status, {
			"content-type": "application/json; charset=utf-8",
			"content-length": Buffer.byteLength(payload),
			"cache-control": "no-store"
		});
		res.end(payload);
	};

	const route = (path, handler) => {
		const wrapped = async (req, res) => {
			try {
				if (!originAllowed(req)) { sendJson(res, 403, { ok: false, error: "forbidden origin" }); return; }
				if ((req.method ?? "GET").toUpperCase() !== handler.method) { sendJson(res, 405, { ok: false, error: "method not allowed" }); return; }
				sendJson(res, 200, { ok: true, ...(await handler.run(req)) });
			} catch (error) {
				ctx.logger.warn("dsh-qwen-plan-usage: request handler failed");
				ctx.logger.warn(safeMessage(error));
				const code = error instanceof QwenPlanError ? error.code : "UPSTREAM_FAILED";
				sendJson(res, error instanceof QwenPlanError && error.code === "COOKIE_INVALID" ? 400 : 500, { ok: false, error: code });
			}
		};
		return ctx.webServer.register({ kind: "exact", path, handler: wrapped });
	};

	const configSnapshot = async () => {
		const cfg = readConfig();
		return {
			cacheMs: cfg.cacheMs,
			region: cfg.region,
			commodityCode: cfg.commodityCode,
			addonCode: cfg.addonCode,
			csDataUrl: cfg.csDataUrl,
			homeUrl: cfg.homeUrl,
			consoleSite: cfg.consoleSite,
			consoleDomain: cfg.consoleDomain,
			cookieConfigured: await configured()
		};
	};

	ctx.effect(() => {
		const disposers = [
			route("/qwen-plan/state", { method: "GET", run: snapshot }),
			route("/qwen-plan/usage", {
				method: "GET",
				run: async (req) => {
					const url = new URL(req.url ?? "/", "http://x");
					return { ...(await snapshot()), usage: await usageView(url.searchParams.get("refresh") === "1") };
				}
			}),
			route("/qwen-plan/sign-in", {
				method: "POST",
				run: async (req) => {
					const raw = await readBody(req);
					let parsed;
					try { parsed = JSON.parse(raw || "{}"); } catch { throw new QwenPlanError("COOKIE_INVALID", "sign-in body is not JSON"); }
					const cookie = normalizeCookie(parsed?.cookie);
					await loadUsage(readConfig(), cookie);
					await saveCookie(cookie);
					connected = true;
					cache = undefined;
					negativeUntil = 0;
					return { ...(await snapshot()), usage: await usageView(true) };
				}
			}),
			route("/qwen-plan/sign-out", {
				method: "POST",
				run: async () => {
					cache = undefined;
					negativeUntil = 0;
					connected = false;
					try { await ctx.credentials.deleteRecord(CREDENTIAL_KEY); } catch (error) {
						ctx.logger.warn("dsh-qwen-plan-usage: failed to delete the session record");
						ctx.logger.warn(safeMessage(error));
					}
					return snapshot();
				}
			})
		];
		return () => { for (const dispose of disposers) dispose(); };
	}, "dsh-qwen-plan-usage: host routes");

	// Configuration card endpoint (GET snapshot / POST patch).
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/dsh-qwen-plan-usage/config",
		handler: async (req, res) => {
			if (!originAllowed(req)) { sendJson(res, 403, { ok: false, error: "forbidden origin" }); return; }
			const method = (req.method ?? "GET").toUpperCase();
			try {
				if (method === "GET") { sendJson(res, 200, { ok: true, ...(await configSnapshot()) }); return; }
				if (method !== "POST") { sendJson(res, 405, { ok: false, error: "method not allowed" }); return; }
				const raw = await readBody(req);
				let parsed;
				try { parsed = JSON.parse(raw || "{}"); } catch { throw new QwenPlanError("COOKIE_INVALID", "config body is not JSON"); }
				const patch = {};
				if (parsed.cacheMs !== undefined) {
					const n = Number(parsed.cacheMs);
					if (!Number.isFinite(n) || n < 0) throw new Error("cacheMs must be a non-negative number");
					patch.cacheMs = Math.round(n);
				}
				for (const key of ["region", "commodityCode", "addonCode", "csDataUrl", "homeUrl", "consoleSite", "consoleDomain"]) {
					if (parsed[key] !== undefined) {
						if (typeof parsed[key] !== "string" || parsed[key].trim().length === 0) throw new Error(`${key} must be a non-empty string`);
						patch[key] = parsed[key].trim();
					}
				}
				await updateOwnConfig(patch);
				cache = undefined;
				sendJson(res, 200, { ok: true, ...(await configSnapshot()) });
			} catch (error) {
				ctx.logger.warn("dsh-qwen-plan-usage: config handler failed");
				ctx.logger.warn(safeMessage(error));
				sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
	}), "dsh-qwen-plan-usage: configuration route");

	// ── self-host the browser bundle + inject its boot graph row ──
	const bundlePath = new URL("./client.js", import.meta.url);
	let bundleBytes = null;
	try { bundleBytes = readFileSync(bundlePath); } catch { /* widget unavailable */ }
	if (bundleBytes !== null) {
		const rev = shortHash(bundleBytes);
		ctx.effect(() => ctx.webServer.register({
			kind: "exact",
			path: "/dsh-qwen-plan-usage/client.js",
			handler: async (_req, res) => {
				res.setHeader("content-type", "text/javascript; charset=utf-8");
				res.setHeader("cache-control", "no-cache");
				res.end(bundleBytes);
			}
		}), "dsh-qwen-plan-usage: client bundle route");
		ctx.effect(() => ctx.webServer.tapIndex((html) => injectGraphRow(html, {
			id: "dsh-qwen-plan-usage",
			url: `/dsh-qwen-plan-usage/client.js?rev=${rev}`,
			rev,
			inject: ["@deepseek-ai/dsh-client-runtime"],
			immediately: true
		})), "dsh-qwen-plan-usage: client boot graph");
	}

	// Chat command.
	ctx.effect(() => ctx.commands.register({
		name: "qwen-plan",
		description: "show Qwen Token Plan remaining quota (weekly/monthly windows + booster packs)",
		handler: async () => {
			try {
				const cfg = readConfig();
				const data = await usageView();
				return { kind: data.error ? "error" : "success", text: renderUsageText(data, cfg.locale) };
			} catch (error) {
				return { kind: "error", text: error instanceof Error ? error.message : String(error) };
			}
		}
	}), "dsh-qwen-plan-usage: usage command");

	// ── model guidance ──
	// While the plugin is installed but no cookie is configured, inject a context
	// into every model step telling the agent to fetch the cookie itself from the
	// user's browser. The text is empty (and filtered out) once connected.
	const scriptPath = fileURLToPath(new URL("../scripts/extract-cookie.mjs", import.meta.url));
	const guidanceText = () => connected ? "" : buildCookieGuidance({ locale: readConfig().locale, scriptPath });
	const registerGuidance = (systemPrompt) => systemPrompt.context({
		name: "qwen-plan-usage:cookie-guidance",
		order: 130,
		text: guidanceText
	});
	if (typeof ctx.inject === "function") {
		ctx.inject(["systemPrompt"], (scope) => {
			scope.effect(() => registerGuidance(scope.systemPrompt), "dsh-qwen-plan-usage: cookie guidance");
		});
	} else {
		const systemPrompt = ctx.get("systemPrompt");
		if (systemPrompt) ctx.effect(() => registerGuidance(systemPrompt), "dsh-qwen-plan-usage: cookie guidance");
	}

	// Keep the cached connection flag fresh (initial + periodic + sign-in/out).
	ctx.effect(() => {
		refreshConnected();
		const timer = setInterval(refreshConnected, 15_000);
		return () => clearInterval(timer);
	}, "dsh-qwen-plan-usage: connection watch");
}
