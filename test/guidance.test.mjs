import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCookieGuidance } from "../lib/guidance.js";

const scriptPath = "C:\\plugins\\dsh-qwen-plan-usage\\scripts\\extract-cookie.mjs";
const origin = "http://127.0.0.1:43120";

test("zh guidance: mentions extractor, sign-in route, prerequisite and security", () => {
	const text = buildCookieGuidance({ locale: "zh", scriptPath, origin });
	assert.ok(text.includes(scriptPath), "includes the extractor script path");
	assert.ok(text.includes("extract-cookie.mjs"));
	assert.ok(text.includes(`${origin}/qwen-plan/sign-in`), "includes the sign-in route on the given origin");
	assert.ok(text.includes("platform.qianwenai.com"), "names the console to log in to");
	assert.ok(text.includes("不要让用户手动复制"), "tells the agent not to make the user copy/paste");
	assert.ok(text.includes("外发"), "includes the no-exfiltration security note");
});

test("en guidance: same actionable content in English", () => {
	const text = buildCookieGuidance({ locale: "en", scriptPath, origin });
	assert.ok(text.includes(scriptPath));
	assert.ok(text.includes(`${origin}/qwen-plan/sign-in`));
	assert.ok(text.includes("do not ask the user to copy/paste"));
	assert.ok(text.includes("platform.qianwenai.com"));
});

test("origin trailing slash is normalized; missing origin uses placeholder", () => {
	const a = buildCookieGuidance({ locale: "zh", scriptPath, origin: "http://127.0.0.1:43120/" });
	assert.ok(a.includes("http://127.0.0.1:43120/qwen-plan/sign-in"));
	assert.ok(!a.includes("43120//qwen-plan"));
	const b = buildCookieGuidance({ locale: "zh", scriptPath });
	assert.ok(b.includes("<DSH-Web-GUI-origin>/qwen-plan/sign-in"));
});

test("default locale is zh; unknown locale falls back to zh", () => {
	assert.ok(buildCookieGuidance({ scriptPath }).includes("插件已安装"));
	assert.ok(buildCookieGuidance({ locale: "fr", scriptPath }).includes("插件已安装"));
});