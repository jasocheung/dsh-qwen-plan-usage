// @ts-check
// Unit tests for the dependency-free parsing layer (lib/parse.js).
// Run with: node --test  (from the package root)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
	QwenPlanError, normalizeCookie, asObject, unwrapZelda, finiteNumber,
	usageFraction, usedPercent, resetIso, quotaFor, parseAddons, assembleUsage
} from "../lib/parse.js";

/** Wrap a payload the way the console bailian gateway returns it. */
const envelope = (data) => ({ data: { success: true, DataV2: { data } } });

test("normalizeCookie accepts a plain Cookie header", () => {
	assert.equal(normalizeCookie("login_aliyunid_pk=123; cookie2=abc"), "login_aliyunid_pk=123; cookie2=abc");
});

test("normalizeCookie strips BOM, cookie: prefix, quotes and newlines", () => {
	const raw = "\uFEFFCookie: \"login_aliyunid_pk=123;\r\n cookie2=abc\"";
	assert.equal(normalizeCookie(raw), "login_aliyunid_pk=123; cookie2=abc");
});

test("normalizeCookie rejects an API key", () => {
	assert.throws(() => normalizeCookie("sk-sp-abcdef123456"), (e) => e instanceof QwenPlanError && e.code === "COOKIE_INVALID");
});

test("normalizeCookie rejects empty / no-pair / oversized", () => {
	assert.throws(() => normalizeCookie(""), (e) => e.code === "COOKIE_INVALID");
	assert.throws(() => normalizeCookie("justtext"), (e) => e.code === "COOKIE_INVALID");
	assert.throws(() => normalizeCookie("a=" + "x".repeat(40_000)), (e) => e.code === "COOKIE_INVALID");
});

test("asObject parses JSON strings and rejects arrays/null", () => {
	assert.deepEqual(asObject('{"a":1}'), { a: 1 });
	assert.equal(asObject([1, 2]), undefined);
	assert.equal(asObject(null), undefined);
	assert.equal(asObject("not json"), undefined);
});

test("unwrapZelda drills data → DataV2 → data", () => {
	assert.deepEqual(unwrapZelda(envelope({ per1WeekPercentage: 0.25 })), { per1WeekPercentage: 0.25 });
});

test("unwrapZelda handles lower-case dataV2 and a nested data layer", () => {
	assert.deepEqual(unwrapZelda({ data: { dataV2: { data: { x: 1 } } } }), { x: 1 });
	assert.deepEqual(unwrapZelda({ data: { DataV2: { data: { data: { y: 2 } } } } }), { y: 2 });
});

test("usageFraction treats ≤1 as a fraction and >1 as percent", () => {
	assert.equal(usageFraction(0.25), 0.25);
	assert.equal(usageFraction(25), 0.25);
	assert.equal(usageFraction(100), 1);
	assert.equal(usageFraction(150), 1); // clamped
	assert.equal(usageFraction(-1), undefined);
	assert.equal(usageFraction(undefined), undefined);
});

test("usedPercent keeps one decimal below 10%", () => {
	assert.equal(usedPercent(0.25), 25);
	assert.equal(usedPercent(0.005), 0.5);
	assert.equal(usedPercent(0.094), 9.4);
	assert.equal(usedPercent(40), 40);
});

test("resetIso accepts seconds and milliseconds", () => {
	const secs = 1_763_000_000;
	assert.equal(resetIso(secs), new Date(secs * 1000).toISOString());
	assert.equal(resetIso(secs * 1000), new Date(secs * 1000).toISOString());
	assert.equal(resetIso(0), undefined);
	assert.equal(resetIso(undefined), undefined);
});

test("quotaFor matches specCode case-insensitively then falls back", () => {
	const quota = { STANDARD: { weekly: 12000, monthly: 54000 } };
	assert.deepEqual(quotaFor(quota, "standard"), { weekly: 12000, monthly: 54000 });
	assert.deepEqual(quotaFor({ other: { weekly: 1 } }, "standard"), { weekly: 1 });
	assert.deepEqual(quotaFor(undefined, "standard"), {});
});

test("parseAddons reads list/items/records with field aliases", () => {
	const list = [{ name: "Booster", totalValue: 20000, surplusValue: 15000, endTime: 1_763_000_000 }];
	const got = parseAddons(envelope({ list }));
	assert.equal(got.length, 1);
	assert.equal(got[0].total, 20000);
	assert.equal(got[0].remaining, 15000);
	assert.equal(got[0].name, "Booster");
	assert.ok(got[0].expireAt);
	// alternate envelope + aliases
	const alt = parseAddons(envelope({ items: [{ totalCredits: 100, remainingCredits: 40 }] }));
	assert.equal(alt[0].total, 100);
	assert.equal(alt[0].remaining, 40);
	assert.equal(parseAddons(envelope({})).length, 0);
});

test("assembleUsage builds a domestic snapshot (week + month, no 5h)", () => {
	const resetSecs = 1_763_000_000;
	const parts = {
		subscription: envelope({ specCode: "standard", status: "ACTIVE", remainingDays: 20 }),
		usage: envelope({
			per1WeekPercentage: 0.25,
			per1MonthPercentage: 0.4,
			per1WeekResetTime: resetSecs,
			per1MonthResetTime: resetSecs * 1000
		}),
		quota: envelope({ standard: { weekly: 12000, monthly: 54000, five_hour: 3000 } }),
		addon: envelope({ list: [{ name: "Booster", totalValue: 20000, surplusValue: 15000 }] })
	};
	const u = assembleUsage(parts);
	assert.equal(u.plan, "Token Plan standard");
	assert.equal(u.status, "ACTIVE");
	assert.equal(u.remainingDays, 20);
	assert.equal(u.weekPercent, 25);
	assert.equal(u.weekTotal, 12000);
	assert.equal(u.weekUsed, 3000);
	assert.equal(u.weekRemaining, 9000);
	assert.equal(u.monthPercent, 40);
	assert.equal(u.monthTotal, 54000);
	assert.equal(u.monthUsed, 21600);
	assert.equal(u.monthRemaining, 32400);
	assert.equal(u.weekResetAt, new Date(resetSecs * 1000).toISOString());
	assert.equal(u.monthResetAt, new Date(resetSecs * 1000).toISOString());
	// domestic bundle has no per5HourPercentage → 5h fields undefined
	assert.equal(u.fiveHourPercent, undefined);
	assert.equal(u.addons.length, 1);
	assert.equal(u.addons[0].remaining, 15000);
});

test("assembleUsage tolerates percent-as-0..100 and missing quota", () => {
	const u = assembleUsage({
		subscription: envelope({ specCode: "pro" }),
		usage: envelope({ per1WeekPercentage: 30, per1MonthPercentage: 55 }),
		quota: undefined,
		addon: undefined
	});
	assert.equal(u.weekPercent, 30);
	assert.equal(u.monthPercent, 55);
	assert.equal(u.weekTotal, undefined);
	assert.equal(u.weekUsed, undefined);
	assert.deepEqual(u.addons, []);
});

test("finiteNumber rejects non-numeric", () => {
	assert.equal(finiteNumber("12"), 12);
	assert.equal(finiteNumber("abc"), undefined);
	assert.equal(finiteNumber(Infinity), undefined);
});
