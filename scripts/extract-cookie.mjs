#!/usr/bin/env node
// @ts-check
/**
 * dsh-qwen-plan-usage — extract the Qwen console session cookie from the user's
 * own logged-in browser, without asking the user to copy/paste.
 *
 * Method (proven on Windows/Edge): Chromium cookies are app-bound encrypted
 * (v20), so they cannot be decrypted offline. Instead we copy the browser profile
 * (Local State + the Cookies SQLite DB) into a throwaway directory and launch a
 * short-lived headless browser against that copy with a remote-debugging port;
 * the browser decrypts its own cookies, and CDP `Storage.getCookies` returns them
 * in plaintext. The real browser is never touched. When the running browser holds
 * the Cookies DB under an exclusive lock (Windows), dump-locked.ps1 reads it via
 * handle duplication (non-invasive, no admin).
 *
 * Usage:
 *   node extract-cookie.mjs [--domain qianwenai.com] [--browser edge|chrome|auto]
 *                           [--profile Default] [--port 9333] [--json]
 *                           [--sign-in http://127.0.0.1:43120/qwen-plan/sign-in]
 *                           [--keep]
 *
 * Output: one cookie header line "name=value; name2=value2" (or JSON with --json).
 * Exit codes: 0 ok; 2 no matching cookies / not signed in; 3 browser/CDP failure.
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir, homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const log = (...a) => console.error("[extract]", ...a);

function parseArgs(argv) {
	const out = { domain: "qianwenai.com", browser: "auto", profile: "Default", port: 9333, json: false, signIn: "", keep: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		const next = () => argv[++i];
		if (a === "--domain") out.domain = next();
		else if (a === "--browser") out.browser = next();
		else if (a === "--profile") out.profile = next();
		else if (a === "--port") out.port = Number(next());
		else if (a === "--sign-in") out.signIn = next();
		else if (a === "--json") out.json = true;
		else if (a === "--keep") out.keep = true;
		else if (a === "--help" || a === "-h") { console.log("usage: node extract-cookie.mjs [--domain d] [--browser edge|chrome|auto] [--profile Default] [--port N] [--json] [--sign-in URL] [--keep]"); process.exit(0); }
	}
	return out;
}

function browserCandidates(which) {
	const os = platform();
	const local = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
	if (os === "win32") {
		const edge = [
			join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
			join(process.env.ProgramFiles ?? "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe")
		];
		const chrome = [
			join(process.env.ProgramFiles ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
			join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
			join(local, "Google", "Chrome", "Application", "chrome.exe")
		];
		const edgeData = join(local, "Microsoft", "Edge", "User Data");
		const chromeData = join(local, "Google", "Chrome", "User Data");
		return {
			edge: { exe: edge.find(existsSync), data: edgeData, proc: "msedge" },
			chrome: { exe: chrome.find(existsSync), data: chromeData, proc: "chrome" }
		};
	}
	if (os === "darwin") {
		return {
			edge: { exe: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", data: join(homedir(), "Library", "Application Support", "Microsoft Edge"), proc: "Microsoft Edge" },
			chrome: { exe: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", data: join(homedir(), "Library", "Application Support", "Google", "Chrome"), proc: "Google Chrome" }
		};
	}
	return {
		edge: { exe: "/usr/bin/microsoft-edge", data: join(homedir(), ".config", "microsoft-edge"), proc: "msedge" },
		chrome: { exe: "/usr/bin/google-chrome", data: join(homedir(), ".config", "google-chrome"), proc: "chrome" }
	};
}

function pickBrowser(which) {
	const c = browserCandidates(which);
	const order = which === "edge" ? ["edge"] : which === "chrome" ? ["chrome"] : ["edge", "chrome"];
	for (const key of order) {
		const b = c[key];
		if (b?.exe && existsSync(b.exe) && existsSync(b.data)) return { key, ...b };
	}
	return null;
}

/** Copy the minimal profile needed for cookie decryption into a temp dir. */
function copyProfile(browser, profile, tempRoot) {
	const srcProfile = join(browser.data, profile);
	const dstProfile = join(tempRoot, profile);
	mkdirSync(join(dstProfile, "Network"), { recursive: true });
	const localState = join(browser.data, "Local State");
	if (existsSync(localState)) copyFileSync(localState, join(tempRoot, "Local State"));
	const prefs = join(srcProfile, "Preferences");
	if (existsSync(prefs)) copyFileSync(prefs, join(dstProfile, "Preferences"));
	const cookiesSrc = join(srcProfile, "Network", "Cookies");
	const cookiesDst = join(dstProfile, "Network", "Cookies");
	if (!existsSync(cookiesSrc)) throw new Error(`cookie DB not found: ${cookiesSrc}`);
	try {
		copyFileSync(cookiesSrc, cookiesDst);
	} catch (err) {
		// Running browser holds an exclusive lock (Windows). Read via handle dup.
		if (platform() !== "win32") throw err;
		log("cookie DB locked by running browser; reading via handle duplication…");
		const ps1 = join(HERE, "dump-locked.ps1");
		const psArgs = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1, "-Target", cookiesSrc, "-Out", cookiesDst, "-ProcName", browser.proc];
		let r = spawnSync("pwsh", psArgs, { encoding: "utf8", timeout: 30000 });
		if (r.error) r = spawnSync("powershell.exe", psArgs, { encoding: "utf8", timeout: 30000 });
		const line = (r.stdout ?? "").trim();
		if (!line.startsWith("OK")) throw new Error(`locked cookie DB copy failed: ${line || r.stderr || (r.error && r.error.message) || err.message}`);
	}
	return tempRoot;
}

async function cdpCookies(port, timeoutMs = 20000) {
	const deadline = Date.now() + timeoutMs;
	let wsUrl = "";
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`http://127.0.0.1:${port}/json/version`);
			if (res.ok) { wsUrl = (await res.json()).webSocketDebuggerUrl; if (wsUrl) break; }
		} catch { /* not up yet */ }
		await new Promise(r => setTimeout(r, 300));
	}
	if (!wsUrl) throw new Error("CDP endpoint never came up");
	const ws = new WebSocket(wsUrl);
	await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("CDP ws error")); });
	const cookies = await new Promise((res, rej) => {
		const timer = setTimeout(() => rej(new Error("Storage.getCookies timeout")), 10000);
		ws.onmessage = (ev) => {
			const msg = JSON.parse(ev.data);
			if (msg.id === 1) { clearTimeout(timer); res(msg.result?.cookies ?? []); }
		};
		ws.send(JSON.stringify({ id: 1, method: "Storage.getCookies" }));
	});
	try { ws.close(); } catch { /* ignore */ }
	return cookies;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	// Hard safety deadline so a stuck browser/CDP can never hang the caller.
	const bail = setTimeout(() => { log("hard timeout (45s); aborting"); process.exit(3); }, 45000);
	bail.unref?.();
	const browser = pickBrowser(args.browser);
	if (!browser) { console.error("no supported browser (Edge/Chrome) found"); process.exit(3); }
	const tempRoot = mkdtempSync(join(tmpdir(), "qpu-extract-"));
	let child;
	try {
		log(`browser=${browser.key} exe=${browser.exe}`);
		log("copying profile…");
		copyProfile(browser, args.profile, tempRoot);
		log("profile copied; launching headless browser…");
		const flags = [
			`--user-data-dir=${tempRoot}`,
			`--remote-debugging-port=${args.port}`,
			`--profile-directory=${args.profile}`,
			"--headless=new", "--no-first-run", "--no-default-browser-check",
			"--disable-extensions", "--disable-background-networking", "--disable-sync",
			"--disable-gpu", "--mute-audio", "about:blank"
		];
		child = spawn(browser.exe, flags, { stdio: "ignore", detached: false });
		log(`spawned pid=${child.pid}; waiting for CDP on :${args.port}…`);
		const all = await cdpCookies(args.port);
		log(`CDP returned ${all.length} cookies`);
		const needle = args.domain.replace(/^\./, "").toLowerCase();
		const matched = all.filter(c => (c.domain ?? "").toLowerCase().includes(needle));
		if (matched.length === 0) {
			console.error(`no cookies matching ${args.domain} — is the user logged in to the console in ${browser.key}?`);
			process.exit(2);
		}
		// De-duplicate by name, prefer the most specific domain.
		const byName = new Map();
		for (const c of matched) {
			const prev = byName.get(c.name);
			if (!prev || (c.domain ?? "").length > (prev.domain ?? "").length) byName.set(c.name, c);
		}
		const pairs = [...byName.values()].map(c => `${c.name}=${c.value}`);
		const cookieLine = pairs.join("; ");
		let signInResult = null;
		if (args.signIn) {
			const res = await fetch(args.signIn, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cookie: cookieLine }) });
			signInResult = { status: res.status, body: await res.json().catch(() => null) };
		}
		if (args.json) {
			console.log(JSON.stringify({ browser: browser.key, domain: args.domain, count: byName.size, cookie: cookieLine, signIn: signInResult }, null, 2));
		} else {
			console.log(cookieLine);
			if (signInResult) console.error(`sign-in: HTTP ${signInResult.status} ${signInResult.body?.ok ? "ok" : "failed"}`);
		}
	} catch (err) {
		console.error(`extract failed: ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 3;
	} finally {
		if (child && !child.killed) { try { child.kill(); } catch { /* ignore */ } }
		if (!args.keep) {
			// Give the browser a moment to release file handles, then remove the copy.
			await new Promise(r => setTimeout(r, 800));
			try { rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* ignore */ }
		} else {
			console.error(`kept temp profile: ${tempRoot}`);
		}
	}
}

main();