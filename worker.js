import PAGE from "./page.js";
// MAFIA WORLD server: Cloudflare Worker + one Durable Object per room.
// The Room object is the ONLY place that knows every role. Each player is sent only their own role.
const MT = ["mafia", "godfather"];
const ACT = { mafia: "kill", godfather: "kill", killer: "kill", detective: "ins", doctor: "save", bodyguard: "save" };
const AVN = ["Zakaria", "Rayan", "Sofia", "Alex", "Dreamer", "Luna", "MarocKing"];
const TT = { role: 12, night: 25, day: 25, vote: 20, elim: 7 }; // seconds per phase
const rnd = a => a[Math.floor(Math.random() * a.length)];
const shuf = a => a.map(x => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(x => x[1]);
const clean = s => String(s || "").replace(/[<>&"'`]/g, "").trim().slice(0, 14) || "Player";
const av = n => ((Math.floor(+n) || 0) % 7 + 7) % 7;
const maj = a => { const c = {}; a.forEach(x => c[x] = (c[x] || 0) + 1); const m = Math.max(...Object.values(c)); return rnd(Object.keys(c).filter(k => c[k] === m)); };

export default {
  async fetch(req, env) {
    const m = new URL(req.url).pathname.match(/^\/ws\/([A-Za-z0-9]{4,6})$/);
    if (!m) return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    if (req.headers.get("Upgrade") !== "websocket") return new Response("WebSocket only", { status: 426 });
    return env.ROOM.get(env.ROOM.idFromName(m[1].toUpperCase())).fetch(req);
  },
};

export class Room {
  constructor(ctx) { this.ctx = ctx; this.reset(); }
  reset() {
    clearTimeout(this.tm); clearTimeout(this.idleT);
    Object.assign(this, { exists: false, code: "", ph: "lobby", P: [], cap: 7, bots: true, host: null, day: 0, dl: 0, act: {}, vt: {}, dead: [], el: null, w: "", seq: 0 });
  }
  async fetch() {
    const [c, s] = Object.values(new WebSocketPair());
    s.accept();
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
      t: "state", code: this.code, ph: this.ph, day: this.day, dl: this.dl, now: Date.now(), cap: this.cap, bots: this.bots, host: this.host, you: p.id, w: this.w,
      players: this.P.map(q => ({ id: q.id, name: q.name, av: q.av, alive: q.alive, conn: q.conn, bot: q.bot, ready: q.ready, host: q.id === this.host, role: (end || q.id === p.id || (!q.alive && this.ph !== "lobby")) ? q.role : undefined })),
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
    else if (d.t === "start") this.start(ws, p);
    else if (d.t === "leave") this.leave(p);
    else if (d.t === "act") this.doAct(p, d.target);
    else if (d.t === "vote") this.doVote(p, d.target);
    else if (d.t === "chat") this.chat(ws, p, d);
  }
  join(ws, d) {
    let p = d.token && this.P.find(x => !x.bot && x.token === d.token);
    if (p) { // reconnect
      clearTimeout(p.to);
      if (p.ws && p.ws !== ws) try { p.ws.close(); } catch (e) {}
      p.ws = ws; p.conn = true; ws.pid = p.id;
      if (this.ph === "lobby") { p.name = clean(d.name); p.av = av(d.av); }
    } else {
      if (d.create) {
        if (this.exists && this.humans().length) return this.err(ws, "taken");
        this.reset(); this.exists = true; this.code = String(d.code || "").toUpperCase().slice(0, 6);
      } else if (!this.exists) return this.err(ws, "notfound");
      if (this.ph !== "lobby") return this.err(ws, "started");
      if (this.P.length >= this.cap) return this.err(ws, "full");
      p = { id: "p" + (++this.seq), token: crypto.randomUUID(), name: clean(d.name), av: av(d.av), ready: false, bot: false, conn: true, ws, alive: true, role: "" };
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
    clearTimeout(this.tm); this.ph = ph; this.dl = TT[ph] ? Date.now() + TT[ph] * 1000 : 0;
    if (ph === "night") { this.day++; this.act = {}; this.dead = []; this.el = null; }
    if (ph === "vote") { this.vt = {}; this.el = null; }
    const nx = { role: () => this.setPh("night"), night: () => this.resolve(), day: () => this.setPh("vote"), vote: () => this.tally(), elim: () => this.setPh(this.w ? "end" : "night") }[ph];
    if (nx) this.tm = setTimeout(nx, TT[ph] * 1000);
    this.push();
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
