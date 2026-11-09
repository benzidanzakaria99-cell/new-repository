// MAFIA WORLD server: Cloudflare Worker + one Durable Object per room.
// The Room object is the ONLY place that knows every role. Each player is sent only their own role.
const MT = ["mafia", "godfather"];
const ACT = { mafia: "kill", godfather: "kill", killer: "kill", detective: "ins", doctor: "save", bodyguard: "save" };
const AVN = ["Zakaria", "Rayan", "Sofia", "Alex", "Dreamer", "Luna", "MarocKing"];
const TTD = { role: 15, night: 45, day: 120, vote: 40, elim: 15 }; // default seconds per phase (host can change)
const TR = { night: [20, 120], day: [30, 300], vote: [15, 120], elim: [5, 30] }; // allowed ranges
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuf = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
const clean = s => String(s || "").replace(/[<>&"'`]/g, "").trim().slice(0, 14) || "Player";
const av = n => ((Math.floor(+n) || 0) % 7 + 7) % 7;
const maj = a => { const c = {}; a.forEach(x => c[x] = (c[x] || 0) + 1); const m = Math.max(...Object.values(c)); return rnd(Object.keys(c).filter(k => c[k] === m)); };

import PAGE from "./page.js";
const enc = new TextEncoder(), dec = new TextDecoder();
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
let JW = { t: 0, k: [] }, SEC = "";
// Verifies a Google ID token (RS256) against Google's public keys, our client id, issuer and expiry.
async function googleVerify(tok, cid) {
  const [h, p, s] = tok.split("."); if (!s) throw 0;
  const H = JSON.parse(dec.decode(unb64(h))); if (H.alg !== "RS256") throw 0;
  if (!JW.k.some(k => k.kid === H.kid) || Date.now() - JW.t > 36e5) { const r = await fetch("https://www.googleapis.com/oauth2/v3/certs"); JW = { t: Date.now(), k: (await r.json()).keys }; }
  const jwk = JW.k.find(k => k.kid === H.kid); if (!jwk) throw 0;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, unb64(s), enc.encode(h + "." + p))) throw 0;
  const c = JSON.parse(dec.decode(unb64(p)));
  if (!["https://accounts.google.com", "accounts.google.com"].includes(c.iss) || c.aud !== cid || c.exp * 1000 < Date.now() || !c.sub) throw 0;
  return c;
}
const acc = (env, path, body) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName("main")).fetch("https://acc" + path, { method: "POST", body: JSON.stringify(body || {}) });
async function hmac(sec, msg) { const k = await crypto.subtle.importKey("raw", enc.encode(sec), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return b64u(await crypto.subtle.sign("HMAC", k, enc.encode(msg))); }
async function secret(env) { if (!SEC) SEC = (await (await acc(env, "/secret")).json()).s; return SEC; }
async function mkSession(env, uid) { const m = uid + "." + (Date.now() + 30 * 864e5); return m + "." + await hmac(await secret(env), m); }
async function session(req, env) {
  const m = (req.headers.get("Cookie") || "").match(/(?:^|; )mw_s=([^;]+)/); if (!m) return null;
  const [u, e, sg] = m[1].split("."); if (!sg || +e < Date.now()) return null;
  return (await hmac(await secret(env), u + "." + e)) === sg ? u : null;
}
async function api(req, env, u) {
  const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...h } }), p = u.pathname;
  if (p === "/api/config") return J({ cid: env.GOOGLE_CLIENT_ID || "" });
  if (!env.GOOGLE_CLIENT_ID) return J({ e: "off" }, 404);
  const o = req.headers.get("Origin"); if (req.method === "POST" && o && o !== u.origin) return J({ e: "origin" }, 403);
  const ck = (v, age) => `mw_s=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
  if (p === "/api/logout" && req.method === "POST") return J({ ok: 1 }, 200, { "set-cookie": ck("", 0) });
  if (p === "/api/login" && req.method === "POST") {
    let c; try { c = await googleVerify(String((await req.json()).credential || ""), env.GOOGLE_CLIENT_ID); } catch (e) { return J({ e: "token" }, 401); }
    const r = await (await acc(env, "/login", { sub: c.sub, email: c.email_verified ? c.email : "", name: c.given_name || c.name || "Player" })).json();
    return J({ user: r.user }, 200, { "set-cookie": ck(await mkSession(env, r.user.id), 2592000) });
  }
  const uid = await session(req, env); if (!uid) return J({ e: "auth" }, 401);
  if (p === "/api/me" && req.method === "GET") { const r = await (await acc(env, "/get", { id: uid })).json(); return r.user ? J({ user: r.user }) : J({ e: "auth" }, 401); }
  if (p === "/api/profile" && req.method === "POST") { let b = {}; try { b = await req.json(); } catch (e) {} const r = await (await acc(env, "/update", { id: uid, nick: b.nick, av: b.av, country: b.country })).json(); return r.user ? J({ user: r.user }) : J({ e: "auth" }, 401); }
  if (p === "/api/friends" && req.method === "GET") return J(await (await acc(env, "/fr/list", { id: uid })).json());
  if (p === "/api/ping" && req.method === "POST") { let b = {}; try { b = await req.json(); } catch (e) {} await acc(env, "/ping", { id: uid, room: String(b.room || "").toUpperCase() }); return J({ ok: 1 }); }
  const fm = p.match(/^\/api\/friends\/(add|accept|decline|remove|cancel)$/);
  if (fm && req.method === "POST") { let b = {}; try { b = await req.json(); } catch (e) {} const o = await (await acc(env, fm[1] === "add" ? "/fr/add" : fm[1] === "accept" ? "/fr/acc" : "/fr/del", { id: uid, code: b.code, other: String(b.id || "") })).json(); return J(o, o.e ? 400 : 200); }
  if (p === "/api/delete" && req.method === "POST") { await acc(env, "/delete", { id: uid }); return J({ ok: 1 }, 200, { "set-cookie": ck("", 0) }); }
  return J({ e: "nf" }, 404);
}

const escH = s => String(s || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Public privacy policy page (needed for Google's consent screen). Contact email comes from the CONTACT_EMAIL variable.
function privacy(env) {
  const mail = escH(env.CONTACT_EMAIL || "(set CONTACT_EMAIL)");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MAFIA WORLD - Privacy Policy</title><style>body{font:16px/1.7 system-ui,Tahoma,sans-serif;max-width:720px;margin:auto;padding:20px;background:#0b0510;color:#f1e6d0}h1,h2{color:#f3dc8a}a{color:#f3dc8a}section{border-top:1px solid #d4af3755;margin-top:24px;padding-top:8px}</style></head><body>
<section dir="ltr"><h1>MAFIA WORLD - Privacy Policy</h1><p>MAFIA WORLD is an online multiplayer social-deduction game. This page explains what data we handle. Contact: <a href="mailto:${mail}">${mail}</a>.</p>
<h2>What we store</h2><ul><li>When you sign in with Google: your Google account identifier and verified email address.</li><li>What you choose: nickname, avatar and country.</li><li>Friend codes, friend requests and friend lists.</li><li>Presence: the last time you were active and the room code while you wait in a lobby.</li></ul>
<h2>What we do not store</h2><p>Chat messages and voice clips are relayed live to the players in your room and are not saved. We do not store passwords (sign-in is handled by Google). We do not sell your data and show no ads.</p>
<h2>Cookies and device storage</h2><p>One essential session cookie keeps you signed in (30 days). Your browser also stores audio settings and a reconnect token for your current room.</p>
<h2>Services we use</h2><p>Google (sign-in) and Cloudflare (hosting and database). Data may be processed on Cloudflare's global infrastructure.</p>
<h2>Your choices</h2><p>You can edit your profile, or permanently delete your account and all its data from Profile, My account, Delete account. You can also write to the contact email above.</p>
<h2>Children</h2><p>The game is not intended for children under 13 (or under 16 where local law requires).</p></section>
<section dir="rtl" lang="ar"><h1>MAFIA WORLD - سياسة الخصوصية</h1><p>MAFIA WORLD لعبة جماعية عبر الإنترنت. توضح هذه الصفحة البيانات التي نتعامل معها. للتواصل: <a href="mailto:${mail}">${mail}</a>.</p>
<h2>ما نحفظه</h2><ul><li>عند الدخول بحساب Google: معرّف حسابك وبريدك الموثّق.</li><li>ما تختاره أنت: اللقب والصورة والبلد.</li><li>رموز الصداقة وطلباتها وقوائم الأصدقاء.</li><li>حالة الاتصال: آخر وقت نشاط ورمز الغرفة أثناء انتظارك فيها.</li></ul>
<h2>ما لا نحفظه</h2><p>رسائل الدردشة والمقاطع الصوتية تُنقل مباشرة إلى لاعبي غرفتك ولا تُحفظ. لا نخزّن كلمات مرور (الدخول تتولاه Google). لا نبيع بياناتك ولا نعرض إعلانات.</p>
<h2>ملفات الارتباط والتخزين</h2><p>ملف ارتباط أساسي واحد يُبقيك مسجّلا (30 يوما). ويحفظ متصفحك أيضا إعدادات الصوت ورمز إعادة الاتصال بغرفتك الحالية.</p>
<h2>الخدمات المستخدمة</h2><p>Google (تسجيل الدخول) وCloudflare (الاستضافة وقاعدة البيانات). قد تُعالَج البيانات على بنية Cloudflare العالمية.</p>
<h2>خياراتك</h2><p>يمكنك تعديل ملفك أو حذف حسابك وبياناته نهائيا من: الملف الشخصي، حسابي، حذف الحساب. ويمكنك مراسلتنا على البريد أعلاه.</p>
<h2>الأطفال</h2><p>اللعبة غير موجهة للأطفال دون 13 سنة (أو دون 16 حيث يشترط القانون المحلي).</p></section></body></html>`;
}
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname === "/privacy") return new Response(privacy(env), { headers: { "content-type": "text/html; charset=utf-8" } });
    if (u.pathname.startsWith("/api/")) return api(req, env, u);
    const m = u.pathname.match(/^\/ws\/([A-Za-z0-9]{4,6})$/);
    if (!m) return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("WebSocket only", { status: 426 });
    const h = new Headers(req.headers); ["x-uid", "x-nick", "x-av", "x-country"].forEach(k => h.delete(k)); // never trust client-sent identity headers
    if (env.GOOGLE_CLIENT_ID) {
      const uid = await session(req, env); if (!uid) return new Response("login", { status: 401 });
      const r = await (await acc(env, "/get", { id: uid })).json(); if (!r.user) return new Response("login", { status: 401 });
      h.set("x-uid", r.user.id); h.set("x-nick", encodeURIComponent(r.user.nick)); h.set("x-av", String(r.user.av)); h.set("x-country", r.user.country || "");
    }
    return env.ROOM.get(env.ROOM.idFromName(m[1].toUpperCase())).fetch(new Request(req, { headers: h }));
  },
};

// Accounts live in one Durable Object with built-in SQLite. Stored: Google id, verified email, nickname, avatar, country.
const pub = u => ({ id: u.id, nick: u.nick, av: u.av, country: u.country || "", code: u.code || "" });
const FA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export class Accounts {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, sub TEXT UNIQUE, email TEXT, nick TEXT, av INTEGER, country TEXT, created INTEGER, last INTEGER)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)");
    for (const c of ["code TEXT", "seen INTEGER", "room TEXT"]) { try { this.sql.exec("ALTER TABLE users ADD COLUMN " + c); } catch (e) {} }
    this.sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS ucode ON users(code)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS fr(a TEXT, b TEXT, s TEXT, t INTEGER, PRIMARY KEY(a,b))"); // s: p = pending a->b, f = friends (stored both ways)
    this.fail = new Map();
  }
  row(q, ...b) { return this.sql.exec(q, ...b).toArray()[0]; }
  fcode() { for (;;) { const c = Array.from(crypto.getRandomValues(new Uint8Array(8)), x => FA[x % 32]).join(""); if (!this.row("SELECT 1 AS x FROM users WHERE code=?", c)) return c; } }
  ensure(u) { if (!u.code) { this.sql.exec("UPDATE users SET code=? WHERE id=?", this.fcode(), u.id); u = this.row("SELECT * FROM users WHERE id=?", u.id); } return u; }
  pf(u, now) { const on = u.seen && u.seen > now - 90000; return { id: u.id, nick: u.nick, av: u.av, country: u.country || "", online: !!on, room: on ? (u.room || "") : "" }; }
  lst(id) { const now = Date.now(), q = s => this.sql.exec(s, id).toArray().map(u => this.pf(u, now));
    return { friends: q("SELECT u.* FROM fr JOIN users u ON u.id=fr.b WHERE fr.a=? AND fr.s='f' ORDER BY u.nick"), incoming: q("SELECT u.* FROM fr JOIN users u ON u.id=fr.a WHERE fr.b=? AND fr.s='p'"), outgoing: q("SELECT u.* FROM fr JOIN users u ON u.id=fr.b WHERE fr.a=? AND fr.s='p'") }; }
  addF(id, code) {
    const f = this.fail.get(id) || [0, Date.now()]; if (Date.now() - f[1] > 6e4) { f[0] = 0; f[1] = Date.now(); }
    if (f[0] >= 10) return { e: "limit" }; // throttle code guessing
    const o = this.row("SELECT * FROM users WHERE code=?", String(code || "").toUpperCase().trim());
    if (!o) { f[0]++; this.fail.set(id, f); return { e: "nf" }; }
    if (o.id === id) return { e: "self" };
    if (this.row("SELECT 1 AS x FROM fr WHERE a=? AND b=?", id, o.id)) return { ok: 1 };
    if (this.row("SELECT 1 AS x FROM fr WHERE a=? AND b=? AND s='p'", o.id, id)) { this.sql.exec("UPDATE fr SET s='f' WHERE a=? AND b=?", o.id, id); this.sql.exec("INSERT INTO fr VALUES(?,?,'f',?)", id, o.id, Date.now()); return { ok: 1, st: "f" }; }
    if (this.row("SELECT COUNT(*) AS n FROM fr WHERE a=? AND s='p'", id).n >= 50) return { e: "limit" };
    this.sql.exec("INSERT INTO fr VALUES(?,?,'p',?)", id, o.id, Date.now()); return { ok: 1, st: "p" };
  }
  accF(id, o) { if (!this.row("SELECT 1 AS x FROM fr WHERE a=? AND b=? AND s='p'", o, id)) return { e: "nf" }; this.sql.exec("UPDATE fr SET s='f' WHERE a=? AND b=?", o, id); this.sql.exec("INSERT OR REPLACE INTO fr VALUES(?,?,'f',?)", id, o, Date.now()); return { ok: 1 }; }
  delF(id, o) { this.sql.exec("DELETE FROM fr WHERE (a=? AND b=?) OR (a=? AND b=?)", id, o, o, id); return { ok: 1 }; }
  async fetch(req) {
    const p = new URL(req.url).pathname, b = await req.json().catch(() => ({})), J = o => new Response(JSON.stringify(o));
    if (p === "/secret") { let r = this.row("SELECT v FROM kv WHERE k='secret'"); if (!r) { const s = b64u(crypto.getRandomValues(new Uint8Array(32))); this.sql.exec("INSERT INTO kv VALUES('secret',?)", s); r = { v: s }; } return J({ s: r.v }); }
    if (p === "/login") {
      let u = this.row("SELECT * FROM users WHERE sub=?", String(b.sub)); const now = Date.now();
      if (!u) { const id = crypto.randomUUID(); this.sql.exec("INSERT INTO users(id,sub,email,nick,av,country,created,last,code) VALUES(?,?,?,?,?,?,?,?,?)", id, String(b.sub), String(b.email || "").slice(0, 120), clean(String(b.name || "").split(" ")[0]), Math.floor(Math.random() * 7), "", now, now, this.fcode()); u = this.row("SELECT * FROM users WHERE id=?", id); }
      else this.sql.exec("UPDATE users SET last=? WHERE id=?", now, u.id);
      return J({ user: pub(this.ensure(this.row("SELECT * FROM users WHERE id=?", u.id))) });
    }
    if (p === "/get") { const u = this.row("SELECT * FROM users WHERE id=?", String(b.id)); return J({ user: u ? pub(this.ensure(u)) : null }); }
    if (p === "/update") {
      const u = this.row("SELECT * FROM users WHERE id=?", String(b.id)); if (!u) return J({ user: null });
      const c = String(b.country || "").toUpperCase();
      this.sql.exec("UPDATE users SET nick=?, av=?, country=? WHERE id=?", clean(b.nick), av(b.av), /^[A-Z]{2}$/.test(c) ? c : "", u.id);
      return J({ user: pub(this.ensure(this.row("SELECT * FROM users WHERE id=?", u.id))) });
    }
    if (p === "/ping") { const r = String(b.room || ""); this.sql.exec("UPDATE users SET seen=?, room=? WHERE id=?", Date.now(), /^[A-Z0-9]{4,6}$/.test(r) ? r : "", String(b.id)); return J({ ok: 1 }); }
    if (p === "/fr/list") return J(this.lst(String(b.id)));
    if (p === "/fr/add") return J(this.addF(String(b.id), b.code));
    if (p === "/fr/acc") return J(this.accF(String(b.id), String(b.other)));
    if (p === "/fr/del") return J(this.delF(String(b.id), String(b.other)));
    if (p === "/delete") { this.sql.exec("DELETE FROM fr WHERE a=? OR b=?", String(b.id), String(b.id)); this.sql.exec("DELETE FROM users WHERE id=?", String(b.id)); return J({ ok: 1 }); }
    return J({});
  }
}

export class Room {
  constructor(ctx) { this.ctx = ctx; this.reset(); }
  reset() {
    clearTimeout(this.tm); clearTimeout(this.idleT);
    Object.assign(this, { exists: false, code: "", ph: "lobby", P: [], cap: 7, bots: true, host: null, day: 0, dl: 0, act: {}, vt: {}, dead: [], el: null, w: "", seq: 0, tt: { ...TTD }, sk: new Set() });
  }
  async fetch(req) {
    const [c, s] = Object.values(new WebSocketPair());
    s.accept();
    const hu = req.headers.get("x-uid");
    s.acct = hu ? { uid: hu, nick: decodeURIComponent(req.headers.get("x-nick") || "Player"), av: +req.headers.get("x-av") || 0, country: req.headers.get("x-country") || "" } : null;
    s.addEventListener("message", e => { try { this.msg(s, e.data); } catch (x) {} });
    s.addEventListener("close", () => this.drop(s));
    s.addEventListener("error", () => this.drop(s));
    return new Response(null, { status: 101, webSocket: c });
  }
  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch (e) {} }
  err(ws, m) { this.send(ws, { t: "err", m }); }
  pl(id) { return this.P.find(p => p.id === id); }
  humans() { return this.P.filter(p => !p.bot); }
  // What THIS player is allowed to see. Other players' roles are never included while they are alive.
  view(p) {
    const end = this.ph === "end";
    return {
      t: "state", tt: this.tt, sk: this.sk.size, code: this.code, ph: this.ph, day: this.day, dl: this.dl, now: Date.now(), cap: this.cap, bots: this.bots, host: this.host, you: p.id, w: this.w,
      players: this.P.map(q => ({ id: q.id, name: q.name, av: q.av, country: q.country || "", alive: q.alive, conn: q.conn, bot: q.bot, ready: q.ready, host: q.id === this.host, role: (end || q.id === p.id || (!q.alive && this.ph !== "lobby")) ? q.role : undefined })),
      mates: MT.includes(p.role) ? this.P.filter(q => MT.includes(q.role) && q.id !== p.id).map(q => q.id) : [],
      insp: p.insp && p.insp.day === this.day ? p.insp : null,
      pick: this.act[p.id] ?? null, vote: this.vt[p.id] ?? null, dead: this.dead, el: this.el,
    };
  }
  push() { this.P.forEach(p => p.ws && this.send(p.ws, this.view(p))); }
  msg(ws, raw) {
    if (typeof raw !== "string" || raw.length > 600000) return;
    const d = JSON.parse(raw);
    if (d.t === "join") return this.join(ws, d);
    const p = this.pl(ws.pid);
    if (!p || p.ws !== ws) return;
    if (d.t === "ready" && this.ph === "lobby") { p.ready = !!d.v; this.push(); }
    else if (d.t === "cap" && this.ph === "lobby" && p.id === this.host) { this.cap = Math.min(7, Math.max(5, this.P.length, Math.floor(+d.v) || 7)); this.push(); }
    else if (d.t === "bots" && this.ph === "lobby" && p.id === this.host) { this.bots = !!d.v; this.push(); }
    else if (d.t === "tt" && this.ph === "lobby" && p.id === this.host) { const r = TR[d.k]; if (r) { this.tt[d.k] = Math.min(r[1], Math.max(r[0], Math.round(+d.v) || this.tt[d.k])); this.push(); } }
    else if (d.t === "skip") this.skip(p);
    else if (d.t === "start") this.start(ws, p);
    else if (d.t === "leave") this.leave(p);
    else if (d.t === "act") this.doAct(p, d.target);
    else if (d.t === "vote") this.doVote(p, d.target);
    else if (d.t === "chat") this.chat(ws, p, d);
  }
  join(ws, d) {
    const ac = ws.acct;
    let p = (d.token && this.P.find(x => !x.bot && x.token === d.token)) || (ac && this.P.find(x => !x.bot && x.uid === ac.uid));
    if (p) { // reconnect
      clearTimeout(p.to);
      if (p.ws && p.ws !== ws) try { p.ws.close(); } catch (e) {}
      p.ws = ws; p.conn = true; ws.pid = p.id;
      if (this.ph === "lobby") { p.name = ac ? ac.nick : clean(d.name); p.av = ac ? ac.av : av(d.av); p.country = ac ? ac.country : ""; }
    } else {
      if (d.create) {
        if (this.exists && this.humans().length) return this.err(ws, "taken");
        this.reset(); this.exists = true; this.code = String(d.code || "").toUpperCase().slice(0, 6);
      } else if (!this.exists) return this.err(ws, "notfound");
      if (this.ph !== "lobby") return this.err(ws, "started");
      if (this.P.length >= this.cap) return this.err(ws, "full");
      p = { id: "p" + (++this.seq), token: crypto.randomUUID(), name: ac ? ac.nick : clean(d.name), av: ac ? ac.av : av(d.av), uid: ac ? ac.uid : "", country: ac ? ac.country : "", ready: false, bot: false, conn: true, ws, alive: true, role: "" };
      this.P.push(p); ws.pid = p.id;
      if (!this.host) this.host = p.id;
    }
    clearTimeout(this.idleT);
    this.send(ws, { t: "welcome", id: p.id, token: p.token });
    this.push();
  }
  leave(p) {
    if (this.ph === "lobby") this.remove(p);
    else { p.conn = false; const w = p.ws; p.ws = null; try { w && w.close(); } catch (e) {} this.push(); }
  }
  remove(p) {
    this.P = this.P.filter(x => x !== p);
    if (this.host === p.id) this.host = (this.humans().find(x => x.conn) || {}).id || null;
    if (!this.humans().length) this.reset(); else this.push();
  }
  drop(ws) {
    const p = this.P.find(x => x.ws === ws);
    if (!p) return;
    p.conn = false; p.ws = null;
    if (this.ph === "lobby") {
      if (this.host === p.id) { const n = this.humans().find(x => x.conn); if (n) this.host = n.id; }
      p.to = setTimeout(() => { if (!p.conn && this.ph === "lobby" && this.P.includes(p)) this.remove(p); }, 45000);
    }
    if (!this.humans().some(x => x.conn)) { clearTimeout(this.idleT); this.idleT = setTimeout(() => { if (!this.humans().some(x => x.conn)) this.reset(); }, 300000); }
    this.push();
  }
  start(ws, p) {
    if (this.ph !== "lobby" || p.id !== this.host) return;
    if (!this.humans().filter(x => x.id !== this.host).every(x => x.ready)) return this.err(ws, "wait");
    if (this.bots) this.fillBots();
    if (this.P.length < 5) return this.err(ws, "min");
    this.begin();
  }
  fillBots() { // bots only take EMPTY seats; real players are never replaced
    while (this.P.length < this.cap) {
      const used = new Set(this.P.map(x => x.av)); let a = [0, 1, 2, 3, 4, 5, 6].find(i => !used.has(i)); if (a === undefined) a = Math.floor(Math.random() * 7);
      const nm = this.P.some(x => x.name.toLowerCase() === AVN[a].toLowerCase()) ? "Bot" + (a + 1) : AVN[a];
      this.P.push({ id: "b" + (++this.seq), name: nm, av: a, ready: true, bot: true, conn: true, ws: null, alive: true, role: "" });
    }
  }
  begin() {
    const n = this.P.length, m = Math.max(1, Math.floor(n / 3));
    let r = [n >= 7 ? "godfather" : "mafia"];
    for (let i = 1; i < m; i++) r.push("mafia");
    r.push("detective", "doctor");
    if (n >= 8) r.push("bodyguard");
    if (n >= 9) r.push("killer");
    while (r.length < n) r.push("citizen");
    r = shuf(r);
    this.P.forEach((p, i) => { p.role = r[i]; p.alive = true; p.insp = null; });
    this.day = 0; this.w = ""; this.el = null; this.dead = [];
    this.setPh("role");
  }
  setPh(ph) {
    clearTimeout(this.tm); this.ph = ph; this.dl = this.tt[ph] ? Date.now() + this.tt[ph] * 1000 : 0;
    if (ph === "night") { this.day++; this.act = {}; this.dead = []; this.el = null; }
    if (ph === "vote") { this.vt = {}; this.el = null; }
    if (ph === "day") this.sk = new Set();
    const nx = { role: () => this.setPh("night"), night: () => this.resolve(), day: () => this.setPh("vote"), vote: () => this.tally(), elim: () => this.setPh(this.w ? "end" : "night") }[ph];
    if (nx) this.tm = setTimeout(nx, this.tt[ph] * 1000);
    this.push();
  }
  skip(p) { // players can agree to end the discussion early; the server still owns the clock
    if (this.ph !== "day" || !p.alive) return;
    this.sk.add(p.id);
    if (this.P.filter(x => x.alive && !x.bot && x.conn).every(x => this.sk.has(x.id))) this.setPh("vote"); else this.push();
  }
  doAct(p, tg) {
    if (this.ph !== "night" || !p.alive) return;
    const a = ACT[p.role], t = this.pl(tg);
    if (!a || !t || !t.alive) return;
    if (a !== "save" && t.id === p.id) return;
    if (p.role === "bodyguard" && t.id === p.id) return;
    if (a === "kill" && MT.includes(p.role) && MT.includes(t.role)) return;
    if (a === "ins" && this.act[p.id] != null) return;
    this.act[p.id] = t.id;
    if (a === "ins") p.insp = { day: this.day, id: t.id, m: MT.includes(t.role) && t.role !== "godfather" };
    this.push();
  }
  doVote(p, tg) {
    if (this.ph !== "vote" || !p.alive) return;
    const t = this.pl(tg);
    if (!t || !t.alive || t.id === p.id) return;
    this.vt[p.id] = t.id;
    if (this.P.filter(x => x.alive && !x.bot && x.conn).every(x => this.vt[x.id] != null)) this.tally(); else this.push();
  }
  resolve() {
    const al = this.P.filter(p => p.alive), ok = v => v != null && al.some(q => q.id === v), kills = [], saves = [];
    const team = al.filter(p => MT.includes(p.role)), f = q => !MT.includes(q.role);
    let pk = team.map(p => this.act[p.id]).filter(v => ok(v) && f(this.pl(v)));
    if (!pk.length && team.length && team.every(p => p.bot || !p.conn)) { const c = al.filter(f); if (c.length) pk = [rnd(c).id]; }
    if (pk.length) kills.push(maj(pk));
    for (const p of al) {
      const auto = p.bot || !p.conn;
      if (p.role === "killer") { let v = this.act[p.id]; if (!ok(v) && auto) v = rnd(al.filter(q => q.id !== p.id)).id; if (ok(v)) kills.push(v); }
      if (p.role === "doctor" || p.role === "bodyguard") { let v = this.act[p.id]; if (!ok(v) && auto) v = rnd(al.filter(q => p.role === "doctor" || q.id !== p.id)).id; if (ok(v)) saves.push(v); }
    }
    const ds = [...new Set(kills)].filter(i => !saves.includes(i)).map(i => this.pl(i));
    ds.forEach(p => p.alive = false);
    this.dead = ds.map(p => ({ id: p.id, name: p.name, role: p.role }));
    this.w = this.win();
    this.setPh(this.w ? "end" : "day");
  }
  tally() {
    clearTimeout(this.tm);
    const al = this.P.filter(p => p.alive), c = {};
    for (const p of al) {
      let v = null;
      if (p.bot) { const o = al.filter(q => q.id !== p.id && !(MT.includes(p.role) && MT.includes(q.role))); const pool = o.length ? o : al.filter(q => q.id !== p.id); if (pool.length) v = rnd(pool).id; }
      else v = this.vt[p.id];
      if (v != null && v !== p.id && al.some(q => q.id === v)) c[v] = (c[v] || 0) + 1;
    }
    const ks = Object.keys(c);
    if (ks.length) { const m = Math.max(...ks.map(k => c[k])), e = this.pl(rnd(ks.filter(k => c[k] === m))); e.alive = false; this.el = { id: e.id, name: e.name, role: e.role }; } else this.el = null;
    this.w = this.win();
    this.setPh("elim");
  }
  win() {
    const a = this.P.filter(p => p.alive), m = a.filter(p => MT.includes(p.role)).length, k = a.filter(p => p.role === "killer").length;
    if (!m && !k) return "c";
    if (m && m * 2 >= a.length) return "m";
    if (!m && k && k * 2 >= a.length) return "k";
    if (m && k && (m + k) * 2 >= a.length) return "m";
    return "";
  }
  chat(ws, p, d) {
    if (this.ph === "night") return this.err(ws, "nightchat");
    if (!p.alive && this.ph !== "end" && this.ph !== "lobby") return;
    const o = { t: "chat", id: p.id, n: p.name };
    if (typeof d.a === "string" && d.a.startsWith("data:audio/") && d.a.length < 450000) o.a = d.a;
    else { const m = String(d.m || "").slice(0, 200).trim(); if (!m) return; o.m = m; }
    this.P.forEach(q => q.ws && this.send(q.ws, o));
  }
}
