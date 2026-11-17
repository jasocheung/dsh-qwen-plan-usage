// @ts-check
/**
 * dsh-qwen-plan-usage — pure parsing layer (no runtime dependencies).
 *
 * Normalizes the pasted cookie and unwraps/assembles the Qwen console bailian
 * responses into one flat usage snapshot. Kept dependency-free so it can be
 * unit-tested with `node --test` without the DSH runtime or schemastery.
 */

export class QwenPlanError extends Error {
	constructor(code, message) {
		super(message ?? code);
		this.name = "QwenPlanError";
		this.code = code;
	}
}

const COOKIE_LIMIT = 32_768;

/** Clean a pasted Cookie header into a single `name=value; …` string. */
export function normalizeCookie(raw) {
	let value = String(raw ?? "").replace(/^\uFEFF/, "").trim();
	value = value.replace(/^cookie\s*:\s*/i, "").trim();
	value = value.replace(/^['"]|['"]$/g, "").trim();
	value = value.replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();
	if (value.length === 0) throw new QwenPlanError("COOKIE_INVALID", "empty cookie");
	if (value.length > COOKIE_LIMIT) throw new QwenPlanError("COOKIE_INVALID", "cookie too large");
	if (/^sk-/i.test(value)) throw new QwenPlanError("COOKIE_INVALID", "this is an API key, not a browser cookie");
	if (!value.includes("=")) throw new QwenPlanError("COOKIE_INVALID", "cookie has no name=value pair");
	return value;
}

export function asObject(value) {
	if (typeof value === "string") {
		try { return asObject(JSON.parse(value)); } catch { return undefined; }
	}
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

/** Unwrap the console bailian envelope: data → DataV2/dataV2 → data → nested data. */
export function unwrapZelda(payload) {
	const root = asObject(payload);
	const outer = asObject(root?.data) ?? root;
	const dataV2 = asObject(outer?.DataV2) ?? asObject(outer?.dataV2);
	let inner = asObject(dataV2?.data) ?? asObject(outer?.data);
	if (inner?.data !== undefined) {
		const nested = asObject(inner.data);
		if (nested) return nested;
	}
	return inner;
}

export function finiteNumber(value) {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : undefined;
}

export function usageFraction(value) {
	const numeric = finiteNumber(value);
	if (numeric === undefined || numeric < 0) return undefined;
	return Math.max(0, Math.min(1, numeric <= 1 ? numeric : numeric / 100));
}

export function usedPercent(value) {
	const fraction = usageFraction(value);
	if (fraction === undefined) return undefined;
	const percent = fraction * 100;
	return percent < 10 ? Math.round(percent * 10) / 10 : Math.round(percent);
}

export function resetIso(value) {
	const numeric = finiteNumber(value);
	if (numeric === undefined || numeric <= 0) return undefined;
	const millis = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
	const date = new Date(millis);
	return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function quotaFor(quota, specCode) {
	if (!quota) return {};
	const keys = [specCode, specCode?.toLowerCase(), specCode?.toUpperCase()].filter(Boolean);
	for (const key of keys) {
		const row = asObject(quota[key]);
		if (row) return row;
	}
	const fallback = Object.values(quota).find((value) => {
		const row = asObject(value);
		return row?.five_hour !== undefined || row?.weekly !== undefined || row?.monthly !== undefined;
	});
	return asObject(fallback) ?? {};
}

export function parseAddons(payload) {
	const root = unwrapZelda(payload);
	const list = Array.isArray(root) ? root
		: Array.isArray(root?.list) ? root.list
		: Array.isArray(root?.items) ? root.items
		: Array.isArray(root?.records) ? root.records
		: [];
	const addons = [];
	for (const item of list) {
		const o = asObject(item) ?? {};
		const total = finiteNumber(o.totalValue ?? o.totalCredits ?? o.quota ?? o.total);
		const remaining = finiteNumber(o.surplusValue ?? o.remainValue ?? o.remainingCredits ?? o.remaining ?? o.surplus);
		if (total === undefined && remaining === undefined) continue;
		addons.push({
			name: typeof o.name === "string" ? o.name : (typeof o.specCode === "string" ? o.specCode : undefined),
			total,
			remaining,
			expireAt: resetIso(o.endTime ?? o.expireTime ?? o.gmtExpired ?? o.expiredTime)
		});
	}
	return addons;
}

/** Combine the four console responses into one flat usage snapshot. */
export function assembleUsage(parts) {
	const subscription = unwrapZelda(parts.subscription) ?? {};
	const usage = unwrapZelda(parts.usage) ?? {};
	const quotaRoot = unwrapZelda(parts.quota) ?? {};
	const specCode = typeof subscription.specCode === "string" ? subscription.specCode : undefined;
	const quota = quotaFor(quotaRoot, specCode);
	const weekTotal = finiteNumber(quota.weekly ?? quota.week);
	const monthTotal = finiteNumber(quota.monthly ?? quota.month);
	const fiveTotal = finiteNumber(quota.five_hour ?? quota.fiveHour);
	const weekFraction = usageFraction(usage.per1WeekPercentage);
	const monthFraction = usageFraction(usage.per1MonthPercentage ?? usage.perMonthPercentage);
	const fiveFraction = usageFraction(usage.per5HourPercentage);
	const remainingDays = finiteNumber(subscription.remainingDays);
	const usedOf = (fraction, total) => fraction !== undefined && total !== undefined ? Math.round(total * fraction) : undefined;
	const leftOf = (used, total) => used !== undefined && total !== undefined ? Math.max(0, total - used) : undefined;
	const weekUsed = usedOf(weekFraction, weekTotal);
	const monthUsed = usedOf(monthFraction, monthTotal);
	const fiveUsed = usedOf(fiveFraction, fiveTotal);
	return {
		plan: specCode ? `Token Plan ${specCode}` : "Token Plan",
		status: typeof subscription.status === "string" ? subscription.status : undefined,
		remainingDays: remainingDays !== undefined ? Math.max(0, Math.round(remainingDays)) : undefined,
		fiveHourPercent: usedPercent(usage.per5HourPercentage),
		fiveHourResetAt: resetIso(usage.per5HourResetTime),
		fiveHourTotal: fiveTotal,
		fiveHourUsed: fiveUsed,
		fiveHourRemaining: leftOf(fiveUsed, fiveTotal),
		weekPercent: usedPercent(usage.per1WeekPercentage),
		weekResetAt: resetIso(usage.per1WeekResetTime),
		weekTotal,
		weekUsed,
		weekRemaining: leftOf(weekUsed, weekTotal),
		monthPercent: usedPercent(usage.per1MonthPercentage ?? usage.perMonthPercentage),
		monthResetAt: resetIso(usage.per1MonthResetTime ?? usage.perMonthResetTime),
		monthTotal,
		monthUsed,
		monthRemaining: leftOf(monthUsed, monthTotal),
		addons: parseAddons(parts.addon)
	};
}
