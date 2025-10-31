var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-hWmpbu/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker.js
var allowedOrigins = [
  "https://sakovvolfsnitko-e6deet01q-alexandr-snitkos-projects.vercel.app",
  "https://sakovvolfsnitko.vercel.app",
  "https://vercel.com/alexandr-snitkos-projects/saviora.app/deployments",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];
var CACHE_TTL = 60 * 1e3;
function normalizeOrigin(o) {
  if (!o) return "";
  return o.endsWith("/") ? o.slice(0, -1) : o;
}
__name(normalizeOrigin, "normalizeOrigin");
function buildCorsHeaders(origin) {
  const norm = normalizeOrigin(origin);
  if (allowedOrigins.includes(norm)) {
    return {
      "Access-Control-Allow-Origin": norm,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Requested-With, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
  }
  return {
    "Vary": "Origin"
  };
}
__name(buildCorsHeaders, "buildCorsHeaders");
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64urlEncode, "base64urlEncode");
function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
}
__name(base64urlDecode, "base64urlDecode");
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
async function sign(str, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(str));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sign, "sign");
async function createToken(payload, secret) {
  const headerObj = { alg: "HS256", typ: "JWT" };
  const header = base64urlEncode(JSON.stringify(headerObj));
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = await sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}
__name(createToken, "createToken");
async function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, signature] = parts;
  try {
    const header = JSON.parse(base64urlDecode(headerB64));
    if (header.alg !== "HS256") return null;
  } catch {
    return null;
  }
  const validSig = await sign(`${headerB64}.${bodyB64}`, secret);
  if (signature !== validSig) return null;
  try {
    const payload = JSON.parse(base64urlDecode(bodyB64));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyToken, "verifyToken");
async function isTrialActive(email, env) {
  const userRaw = await env.USERS_KV.get(`user:${email}`);
  if (!userRaw) return false;
  try {
    const user = JSON.parse(userRaw);
    const now = Date.now();
    const trialPeriod = 14 * 24 * 60 * 60 * 1e3;
    return now - user.created <= trialPeriod;
  } catch {
    return false;
  }
}
__name(isTrialActive, "isTrialActive");
function normalizeDream(d) {
  if (d.text && !d.dreamText) d.dreamText = d.text;
  if (d.created && !d.date) d.date = d.created;
  if (d.updated && !d.date) d.date = d.updated;
  if (!d.blocks) d.blocks = [];
  if (!("globalFinalInterpretation" in d)) d.globalFinalInterpretation = null;
  if (!("dreamSummary" in d)) d.dreamSummary = null;
  if (!("category" in d)) d.category = null;
  if (!("context" in d)) d.context = "";
  if (!d.similarArtworks) d.similarArtworks = [];
  return d;
}
__name(normalizeDream, "normalizeDream");
function validateDreamData(data) {
  if (!data) return { valid: false, error: "Missing dream data" };
  if (typeof data.dreamText !== "string" || data.dreamText.trim() === "") {
    return { valid: false, error: "dreamText is required and must be a non-empty string" };
  }
  if (data.title && typeof data.title !== "string") {
    return { valid: false, error: "title must be a string" };
  }
  if (data.blocks && !Array.isArray(data.blocks)) {
    return { valid: false, error: "blocks must be an array" };
  }
  if (data.similarArtworks && !Array.isArray(data.similarArtworks)) {
    return { valid: false, error: "similarArtworks must be an array" };
  }
  return { valid: true };
}
__name(validateDreamData, "validateDreamData");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = buildCorsHeaders(origin);
    const JWT_SECRET = env.JWT_SECRET;
    if (!JWT_SECRET) {
      console.error("JWT_SECRET is not set");
      return new Response(JSON.stringify({ error: "server_misconfigured", message: "JWT_SECRET is not set" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (url.pathname === "/register" && request.method === "POST") {
      const ct = request.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return new Response(JSON.stringify({ error: "Invalid content type" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const { email, password } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Missing email or password" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const userKey = `user:${email}`;
      const existing = await env.USERS_KV.get(userKey);
      if (existing) {
        return new Response(JSON.stringify({ error: "User already exists" }), {
          status: 409,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      try {
        const hash = await hashPassword(password);
        const user = { email, password: hash, created: Date.now(), tokenVersion: 0 };
        await env.USERS_KV.put(userKey, JSON.stringify(user));
        return new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        console.error("Error during registration:", e);
        return new Response(JSON.stringify({ error: "internal_error", message: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    if (url.pathname === "/login" && request.method === "POST") {
      const ct = request.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        return new Response(JSON.stringify({ error: "Invalid content type" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const { email, password } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: "Missing email or password" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const userKey = `user:${email}`;
      const userRaw = await env.USERS_KV.get(userKey);
      if (!userRaw) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      let user;
      try {
        user = JSON.parse(userRaw);
      } catch {
        return new Response(JSON.stringify({ error: "User data corrupted" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      try {
        const hash = await hashPassword(password);
        if (user.password !== hash) {
          return new Response(JSON.stringify({ error: "Invalid password" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      } catch (e) {
        console.error("Error hashing password:", e);
        return new Response(JSON.stringify({ error: "internal_error", message: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const now = Date.now();
      const trialPeriod = 14 * 24 * 60 * 60 * 1e3;
      if (now - user.created > trialPeriod) {
        return new Response(JSON.stringify({ error: "Trial expired" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const tokenVersion = user.tokenVersion ?? 0;
      const payload = { email, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1e3, tv: tokenVersion };
      const token = await createToken(payload, JWT_SECRET);
      return new Response(JSON.stringify({ token }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    async function getUserEmail(request2) {
      const auth = request2.headers.get("authorization");
      if (!auth || !auth.startsWith("Bearer ")) return null;
      const token = auth.slice(7);
      const payload = await verifyToken(token, JWT_SECRET);
      if (!payload?.email) return null;
      const userRaw = await env.USERS_KV.get(`user:${payload.email}`);
      if (!userRaw) return null;
      let user;
      try {
        user = JSON.parse(userRaw);
      } catch {
        return null;
      }
      const currentTv = user.tokenVersion ?? 0;
      if (typeof payload.tv !== "number" || payload.tv !== currentTv) return null;
      return payload.email;
    }
    __name(getUserEmail, "getUserEmail");
    if (url.pathname === "/me" && request.method === "GET") {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const userRaw = await env.USERS_KV.get(`user:${userEmail}`);
      if (!userRaw) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      let user;
      try {
        user = JSON.parse(userRaw);
      } catch {
        return new Response(JSON.stringify({ error: "User data corrupted" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const now = Date.now();
      const trialPeriod = 14 * 24 * 60 * 60 * 1e3;
      const msLeft = user.created + trialPeriod - now;
      const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1e3));
      return new Response(JSON.stringify({
        email: user.email,
        created: user.created,
        trialEndsAt: user.created + trialPeriod,
        trialDaysLeft: daysLeft
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    if (url.pathname === "/dreams" && request.method === "GET") {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (!await isTrialActive(userEmail, env)) {
        return new Response(JSON.stringify({ error: "Trial expired" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      try {
        const d1 = env.DB;
        const result = await d1.prepare("SELECT * FROM dreams WHERE user = ? ORDER BY date DESC").bind(userEmail).all();
        const dreams = result.results.map((row) => {
          if (row.blocks) {
            try {
              row.blocks = JSON.parse(row.blocks);
            } catch {
              row.blocks = [];
            }
          } else {
            row.blocks = [];
          }
          if (row.similarArtworks) {
            try {
              row.similarArtworks = JSON.parse(row.similarArtworks);
            } catch {
              row.similarArtworks = [];
            }
          } else {
            row.similarArtworks = [];
          }
          return normalizeDream(row);
        });
        return new Response(JSON.stringify(dreams), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        console.error("Error fetching dreams:", e);
        return new Response(JSON.stringify({ error: "internal_error", message: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    if (url.pathname === "/dreams" && request.method === "POST") {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (!await isTrialActive(userEmail, env)) {
        return new Response(JSON.stringify({ error: "Trial expired" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const validation = validateDreamData(body);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: "Invalid dream data", message: validation.error }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const { dreamText } = body;
      const id = crypto.randomUUID();
      const date = Math.floor(Date.now() / 1e3);
      try {
        const d1 = env.DB;
        await d1.prepare(
          `INSERT INTO dreams (id, user, title, dreamText, date, category, dreamSummary, globalFinalInterpretation, blocks, similarArtworks, context)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          userEmail,
          null,
          dreamText.trim(),
          date,
          null,
          null,
          null,
          JSON.stringify([]),
          JSON.stringify([]),
          null
        ).run();
        const dream = {
          id,
          user: userEmail,
          title: null,
          dreamText: dreamText.trim(),
          date,
          category: null,
          dreamSummary: null,
          globalFinalInterpretation: null,
          blocks: [],
          similarArtworks: [],
          context: null
        };
        return new Response(JSON.stringify(dream), {
          status: 201,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        console.error("Error inserting dream:", e);
        return new Response(JSON.stringify({ error: "internal_error", message: e instanceof Error ? e.message : String(e) }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    if (url.pathname.startsWith("/dreams/") && request.method === "GET") {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (!await isTrialActive(userEmail, env)) {
        return new Response(JSON.stringify({ error: "Trial expired" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const id = url.pathname.split("/")[2];
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing dream id" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      try {
        const d1 = env.DB;
        const row = await d1.prepare("SELECT * FROM dreams WHERE id = ? AND user = ?").bind(id, userEmail).first();
        if (!row) {
          return new Response(JSON.stringify({ error: "Dream not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        if (row.blocks) {
          try {
            row.blocks = JSON.parse(row.blocks);
          } catch {
            row.blocks = [];
          }
        } else {
          row.blocks = [];
        }
        if (row.similarArtworks) {
          try {
            row.similarArtworks = JSON.parse(row.similarArtworks);
          } catch {
            row.similarArtworks = [];
          }
        } else {
          row.similarArtworks = [];
        }
        return new Response(JSON.stringify(normalizeDream(row)), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        console.error("Error fetching dream:", e);
        return new Response(JSON.stringify({ error: "internal_error", message: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    if (url.pathname.startsWith("/dreams/") && request.method === "DELETE") {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (!await isTrialActive(userEmail, env)) {
        return new Response(JSON.stringify({ error: "Trial expired" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const id = url.pathname.split("/")[2];
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing dream id" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      try {
        const d1 = env.DB;
        const result = await d1.prepare("DELETE FROM dreams WHERE id = ? AND user = ?").bind(id, userEmail).run();
        if (result.changes === 0) {
          return new Response(JSON.stringify({ error: "Dream not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        console.error("Error deleting dream:", e);
        return new Response(JSON.stringify({ error: "internal_error", message: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    if (url.pathname.startsWith("/dreams/") && request.method === "PUT") {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (!await isTrialActive(userEmail, env)) {
        return new Response(JSON.stringify({ error: "Trial expired" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const validation = validateDreamData(body);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: "Invalid dream data", message: validation.error }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      const id = url.pathname.split("/")[2];
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing dream id" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      try {
        const d1 = env.DB;
        const existing = await d1.prepare("SELECT * FROM dreams WHERE id = ? AND user = ?").bind(id, userEmail).first();
        if (!existing) {
          return new Response(JSON.stringify({ error: "Dream not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        const {
          dreamText = existing.dreamText,
          title = existing.title,
          category = existing.category,
          dreamSummary = existing.dreamSummary,
          globalFinalInterpretation = existing.globalFinalInterpretation,
          blocks = existing.blocks ? JSON.parse(existing.blocks) : [],
          similarArtworks = existing.similarArtworks ? JSON.parse(existing.similarArtworks) : [],
          context = existing.context
        } = body;
        await d1.prepare(
          `UPDATE dreams SET 
            title = ?, 
            dreamText = ?, 
            category = ?, 
            dreamSummary = ?, 
            globalFinalInterpretation = ?, 
            blocks = ?, 
            similarArtworks = ?, 
            context = ?
          WHERE id = ? AND user = ?`
        ).bind(
          title,
          dreamText,
          category,
          dreamSummary,
          globalFinalInterpretation,
          JSON.stringify(blocks),
          JSON.stringify(similarArtworks),
          context,
          id,
          userEmail
        ).run();
        const dream = {
          id,
          user: userEmail,
          title,
          dreamText,
          date: existing.date,
          category,
          dreamSummary,
          globalFinalInterpretation,
          blocks,
          similarArtworks,
          context
        };
        return new Response(JSON.stringify(dream), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        console.error("Error updating dream:", e);
        return new Response(
          JSON.stringify({ error: "internal_error", message: e instanceof Error ? e.message : String(e) }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
    if (url.pathname === "/summarize" && request.method === "POST") {
      const userEmail = await getUserEmail(request);
      if (!userEmail) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { history, blockText, existingSummary } = body;
      const systemMessages = [
        { role: "system", content: "\u0422\u044B \u043F\u0438\u0448\u0435\u0448\u044C \u043A\u0440\u0430\u0442\u043A\u0438\u0435 \u0441\u0430\u043C\u043C\u0430\u0440\u0438 \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432 \u043F\u043E \u0430\u043D\u0430\u043B\u0438\u0437\u0443 \u0441\u043D\u043E\u0432\u0438\u0434\u0435\u043D\u0438\u0439. \u0421\u043E\u0436\u043C\u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0431\u043B\u043E\u043A\u0430 \u0438\u043B\u0438 \u0441\u043D\u0430 \u0432 1\u20133 \u0430\u0431\u0437\u0430\u0446\u0430, \u0431\u0435\u0437 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432 \u0438 \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0439, \u0442\u043E\u043B\u044C\u043A\u043E \u0444\u0430\u043A\u0442\u044B, \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u043E\u0431\u0440\u0430\u0437\u044B \u0438 \u0438\u043D\u0442\u0435\u0440\u043F\u0440\u0435\u0442\u0430\u0446\u0438\u0438. \u041F\u0438\u0448\u0438 \u043D\u0435\u0439\u0442\u0440\u0430\u043B\u044C\u043D\u043E \u0438 \u043A\u0440\u0430\u0442\u043A\u043E." }
      ];
      if (existingSummary) {
        systemMessages.push({ role: "system", content: `\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0435 \u0441\u0430\u043C\u043C\u0430\u0440\u0438: ${existingSummary} \u0423\u0447\u0442\u0438 \u0438 \u0434\u043E\u043F\u043E\u043B\u043D\u0438, \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u044F.` });
      }
      systemMessages.push({ role: "system", content: `\u0422\u0435\u043A\u0441\u0442 \u0431\u043B\u043E\u043A\u0430 \u0438\u043B\u0438 \u0441\u043D\u0430: ${(blockText || "").slice(0, 4e3)}` });
      const messages = [
        ...systemMessages,
        ...Array.isArray(history) ? history.slice(-30) : []
      ];
      const deepseekRequestBody = {
        model: "deepseek-chat",
        messages,
        max_tokens: 200,
        temperature: 0.5,
        stream: false
      };
      try {
        const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify(deepseekRequestBody)
        });
        let responseBody = await deepseekResponse.json();
        let summary = responseBody?.choices?.[0]?.message?.content || "";
        summary = summary.replace(/```[\s\S]*?```/g, "").replace(/^["'`]+|["'`]+$/g, "").trim();
        return new Response(JSON.stringify({ summary }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (e) {
        console.error("Error in summarize endpoint:", e);
        return new Response(JSON.stringify({ error: "internal_error", message: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    if (url.pathname === "/analyze" && request.method === "POST") {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({
          error: "unauthorized",
          message: "Invalid or missing authorization token"
        }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (!await isTrialActive(userEmail, env)) {
        return new Response(JSON.stringify({ error: "Trial expired" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      try {
        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          return new Response(JSON.stringify({
            error: "Invalid content type",
            message: "Content-Type must be application/json"
          }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        const requestData = await request.json();
        const { blockText, lastTurns, rollingSummary, extraSystemPrompt, dreamSummary } = requestData;
        let messages = [];
        messages.push({ role: "system", content: `\u0422\u044B \u2014 \u0444\u0440\u0435\u0439\u0434\u0438\u0441\u0442\u0441\u043A\u0438\u0439 \u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A \u0441\u043D\u043E\u0432, \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0449\u0438\u0439 \u0432 \u043F\u0430\u0440\u0430\u0434\u0438\u0433\u043C\u0435 \u0441\u0432\u0435\u0440\u0445\u0434\u0435\u0442\u0435\u0440\u043C\u0438\u043D\u0430\u0446\u0438\u0438. \u041A\u0430\u0436\u0434\u044B\u0439 \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u0441\u043D\u0430 (\u043E\u0431\u0440\u0430\u0437, \u0447\u0438\u0441\u043B\u043E, \u0447\u0430\u0441\u0442\u044C \u0442\u0435\u043B\u0430) \u0438\u043C\u0435\u0435\u0442 \u043C\u043D\u043E\u0436\u0435\u0441\u0442\u0432\u043E \u0432\u0437\u0430\u0438\u043C\u043E\u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0445 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439, \u0441\u043A\u0440\u044B\u0432\u0430\u044E\u0449\u0438\u0445 \u0432\u044B\u0442\u0435\u0441\u043D\u0451\u043D\u043D\u044B\u0435 \u0436\u0435\u043B\u0430\u043D\u0438\u044F \u0438 \u0442\u0440\u0430\u0432\u043C\u044B. \u0422\u0432\u043E\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u2014 \u0440\u0430\u0441\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u044D\u0442\u0438 \u0441\u043B\u043E\u0438, \u043D\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0432\u0430\u044F\u0441\u044C \u043E\u0434\u043D\u0438\u043C \u0442\u043E\u043B\u043A\u043E\u0432\u0430\u043D\u0438\u0435\u043C.

        \u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u0441\u043D\u0430:
      
        1. \u0414\u043B\u044F \u0447\u0430\u0441\u0442\u0435\u0439 \u0442\u0435\u043B\u0430:
        - \u0412\u0441\u0435\u0433\u0434\u0430 \u0440\u0430\u0441\u0441\u043C\u0430\u0442\u0440\u0438\u0432\u0430\u0439 \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u0434\u0432\u0430 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u0432\u044B\u0445 \u0447\u0443\u0432\u0441\u0442\u0432\u0430, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043C\u043E\u0436\u0435\u0442 \u0432\u044B\u0437\u044B\u0432\u0430\u0442\u044C \u044D\u0442\u0430 \u0447\u0430\u0441\u0442\u044C \u0442\u0435\u043B\u0430. \u041D\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0432\u0430\u0439\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0434\u043D\u043E\u0439 \u043F\u0430\u0440\u043E\u0439 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u043D\u0435 \u0442\u043E\u043B\u044C\u043A\u043E "\u043D\u0435\u0436\u043D\u043E\u0441\u0442\u044C/\u0430\u0433\u0440\u0435\u0441\u0441\u0438\u044F", \u043D\u043E \u0438 \u0434\u0440\u0443\u0433\u0438\u0435 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u044B\u0435 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u0438).
        - \u0412\u0441\u0435\u0433\u0434\u0430 \u0443\u0442\u043E\u0447\u043D\u044F\u0439, \u0441 \u043A\u0430\u043A\u0438\u043C\u0438 \u0440\u0430\u0437\u043D\u044B\u043C\u0438 \u043F\u0435\u0440\u0438\u043E\u0434\u0430\u043C\u0438 \u0436\u0438\u0437\u043D\u0438 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0441\u0432\u044F\u0437\u0430\u043D\u0430 \u044D\u0442\u0430 \u0447\u0430\u0441\u0442\u044C \u0442\u0435\u043B\u0430, \u043D\u0435 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u044B\u0432\u0430\u044F \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B, \u0430 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u044F \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u0443 \u0441\u0430\u043C\u043E\u043C\u0443 \u0432\u0441\u043F\u043E\u043C\u043D\u0438\u0442\u044C.
      
        2. \u0414\u043B\u044F \u0447\u0438\u0441\u0435\u043B \u0438 \u0446\u0438\u0444\u0440:
        - \u0412\u0441\u0435\u0433\u0434\u0430 \u0438\u0449\u0438 \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u0434\u0432\u0430 \u0440\u0430\u0437\u043D\u044B\u0445 \u0441\u043E\u0431\u044B\u0442\u0438\u044F \u0438\u043B\u0438 \u043F\u0435\u0440\u0438\u043E\u0434\u0430, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043C\u043E\u0436\u0435\u0442 \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u044F\u0442\u044C \u044D\u0442\u043E \u0447\u0438\u0441\u043B\u043E. \u041D\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0432\u0430\u0439\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u043E\u0437\u0440\u0430\u0441\u0442\u043E\u043C \u0438\u043B\u0438 \u043F\u043E\u0434\u0441\u0447\u0451\u0442\u043E\u043C \u2014 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0439 \u0440\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0438 \u0434\u0440\u0443\u0433\u0438\u0435 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u044B\u0435 \u0430\u0441\u0441\u043E\u0446\u0438\u0430\u0446\u0438\u0438 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u0434\u0430\u0442\u044B, \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043B\u044E\u0434\u0435\u0439, \u043D\u043E\u043C\u0435\u0440\u0430, \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044F).
        - \u041D\u0435 \u043F\u043E\u0434\u0442\u0430\u043B\u043A\u0438\u0432\u0430\u0439 \u043A \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u043C \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430\u043C, \u0430 \u0437\u0430\u0434\u0430\u0432\u0430\u0439 \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u0441 \u043F\u0440\u0438\u043C\u0435\u0440\u0430\u043C\u0438 \u0432 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u044B\u0445 \u0441\u043A\u043E\u0431\u043A\u0430\u0445.
      
        3. \u0414\u043B\u044F \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 \u0438 \u043E\u0431\u0440\u0430\u0437\u043E\u0432:
        - \u041A\u0430\u0436\u0434\u044B\u0439 \u043E\u0431\u0440\u0430\u0437 \u0440\u0430\u0441\u0441\u043C\u0430\u0442\u0440\u0438\u0432\u0430\u0439 \u043A\u0430\u043A \u0443\u0437\u0435\u043B \u0441\u043C\u044B\u0441\u043B\u043E\u0432: \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0439 \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u0434\u0432\u0430 \u0440\u0430\u0437\u043D\u044B\u0445 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0430 (\u0442\u0435\u043B\u0435\u0441\u043D\u044B\u0439, \u0441\u043E\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439, \u0434\u0435\u0442\u0441\u043A\u0438\u0439, \u0441\u0435\u043C\u0435\u0439\u043D\u044B\u0439, \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u0438 \u0442.\u0434.), \u043D\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0432\u0430\u044F\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u0440\u0435\u043C\u044F.
        - \u0412\u0441\u0435\u0433\u0434\u0430 \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0439 \u043E \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043B\u043E\u0436\u043D\u044B\u0445 \u0436\u0435\u043B\u0430\u043D\u0438\u044F\u0445, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043C\u043E\u0433\u0443\u0442 \u0431\u044B\u0442\u044C \u0441\u043F\u0440\u044F\u0442\u0430\u043D\u044B \u0432 \u044D\u0442\u043E\u043C \u0441\u0438\u043C\u0432\u043E\u043B\u0435, \u043D\u0435 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u044F \u0433\u043E\u0442\u043E\u0432\u044B\u0445 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432, \u0430 \u0434\u0430\u0432\u0430\u044F \u043F\u0440\u0438\u043C\u0435\u0440\u044B \u0432 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u044B\u0445 \u0441\u043A\u043E\u0431\u043A\u0430\u0445.
      
        4. \u041C\u0435\u0442\u043E\u0434 \u0440\u0430\u0431\u043E\u0442\u044B:
        - \u041F\u043E\u0441\u043B\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043E\u0442\u0432\u0435\u0442\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0443\u0442\u043E\u0447\u043D\u044F\u0439: "\u042D\u0442\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0434\u043D\u043E \u0438\u0437 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u044B\u0445 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439. \u0415\u0441\u043B\u0438 \u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u044C, \u0447\u0442\u043E \u044D\u0442\u043E\u0442 \u043E\u0431\u0440\u0430\u0437 \u2014 \u043B\u0438\u0448\u044C \u043E\u0431\u043E\u043B\u043E\u0447\u043A\u0430, \u0447\u0442\u043E \u0435\u0449\u0451 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0441\u043F\u0440\u044F\u0442\u0430\u043D\u043E \u0432\u043D\u0443\u0442\u0440\u0438?"
        - \u041F\u0440\u0438 \u0430\u0431\u0441\u0443\u0440\u0434\u043D\u044B\u0445 \u0441\u043E\u0447\u0435\u0442\u0430\u043D\u0438\u044F\u0445 \u0432\u0441\u0435\u0433\u0434\u0430 \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0439: "\u0427\u0442\u043E \u043E\u0431\u0449\u0435\u0433\u043E \u043C\u0435\u0436\u0434\u0443 \u044D\u0442\u0438\u043C\u0438, \u043A\u0430\u0437\u0430\u043B\u043E\u0441\u044C \u0431\u044B, \u043D\u0435\u0441\u043E\u0432\u043C\u0435\u0441\u0442\u0438\u043C\u044B\u043C\u0438 \u043E\u0431\u0440\u0430\u0437\u0430\u043C\u0438? \u041D\u0430 \u043A\u0430\u043A\u0443\u044E \u043E\u0434\u043D\u0443 \u0441\u043A\u0440\u044B\u0442\u0443\u044E \u043C\u044B\u0441\u043B\u044C \u043E\u043D\u0438 \u043C\u043E\u0433\u0443\u0442 \u0432\u043C\u0435\u0441\u0442\u0435 \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C?"
        - \u0414\u043B\u044F \u044D\u043C\u043E\u0446\u0438\u0439 \u0432\u0441\u0435\u0433\u0434\u0430 \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0439: "\u041A\u0430\u043A\u043E\u0435 \u0441\u043A\u0440\u044B\u0442\u043E\u0435 \u0436\u0435\u043B\u0430\u043D\u0438\u0435 \u0438\u043B\u0438 \u043F\u0430\u043C\u044F\u0442\u044C \u043C\u043E\u0433\u043B\u043E \u043F\u043E\u0440\u043E\u0434\u0438\u0442\u044C \u0438\u043C\u0435\u043D\u043D\u043E \u044D\u0442\u0443 \u0440\u0435\u0430\u043A\u0446\u0438\u044E \u043D\u0430 \u044D\u0442\u043E\u0442, \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0439 \u043E\u0431\u0440\u0430\u0437?"
        - \u0412\u0441\u0435\u0433\u0434\u0430 \u0438\u0449\u0438, \u043A\u0430\u043A \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0437\u043D\u044B\u0445 \u043B\u044E\u0434\u0435\u0439, \u0441\u043E\u0431\u044B\u0442\u0438\u0439 \u0438\u043B\u0438 \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u043E\u0432 \u043C\u043E\u0433\u043B\u0438 \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0438\u0442\u044C\u0441\u044F \u0432 \u043E\u0434\u0438\u043D \u043E\u0431\u0440\u0430\u0437. \u0421\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0439: "\u0427\u0435\u0440\u0442\u044B \u0441\u043A\u043E\u043B\u044C\u043A\u0438\u0445 \u0440\u0430\u0437\u043D\u044B\u0445 \u043B\u044E\u0434\u0435\u0439 \u0438\u043B\u0438 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u0439 \u0432\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u0440\u0430\u0437\u0433\u043B\u044F\u0434\u0435\u0442\u044C \u0432 \u044D\u0442\u043E\u043C \u043E\u0434\u043D\u043E\u043C \u043E\u0431\u0440\u0430\u0437\u0435 \u0438\u0437 \u0441\u043D\u0430?"
        - \u0412\u0441\u0435\u0433\u0434\u0430 \u0438\u0441\u0441\u043B\u0435\u0434\u0443\u0439, \u043F\u043E\u0447\u0435\u043C\u0443 \u0441\u0430\u043C\u044B\u0439 \u0441\u0438\u043B\u044C\u043D\u044B\u0439 \u044D\u043C\u043E\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0437\u0430\u0440\u044F\u0434 \u0432\u043E \u0441\u043D\u0435 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442\u0441\u044F \u043D\u0430, \u043A\u0430\u0437\u0430\u043B\u043E\u0441\u044C \u0431\u044B, \u0432\u0442\u043E\u0440\u043E\u0441\u0442\u0435\u043F\u0435\u043D\u043D\u0443\u044E \u0434\u0435\u0442\u0430\u043B\u044C. \u0421\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0439: "\u041F\u043E\u0447\u0435\u043C\u0443 \u0441\u0430\u043C\u044B\u0439 \u044F\u0440\u043A\u0438\u0439 \u0441\u0442\u0440\u0430\u0445/\u0440\u0430\u0434\u043E\u0441\u0442\u044C \u0432\u043E \u0441\u043D\u0435 \u0431\u044B\u043B\u0438 \u0441\u0432\u044F\u0437\u0430\u043D\u044B \u0438\u043C\u0435\u043D\u043D\u043E \u0441 [X], \u0430 \u043D\u0435 \u0441 [\u0431\u043E\u043B\u0435\u0435 \u043E\u0447\u0435\u0432\u0438\u0434\u043D\u044B\u0439 Y]?"
        - \u041F\u0435\u0440\u0435\u0434 \u043D\u0430\u0447\u0430\u043B\u043E\u043C \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0437\u0430\u0434\u0430\u0439 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u043E \u043D\u044B\u043D\u0435\u0448\u043D\u0435\u043C \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0435 \u0436\u0438\u0437\u043D\u0438 \u0441\u043D\u043E\u0432\u0438\u0434\u0446\u0430 (\u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u0438\u0435, \u043D\u0435\u0434\u0430\u0432\u043D\u0438\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u044F, \u0442\u0435\u043A\u0443\u0449\u0438\u0435 \u043F\u0435\u0440\u0435\u0436\u0438\u0432\u0430\u043D\u0438\u044F) \u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u044D\u0442\u0443 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E \u0432 \u043F\u043E\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u043C \u0430\u043D\u0430\u043B\u0438\u0437\u0435.
        - \u0412 \u043E\u0431\u0449\u0435\u043D\u0438\u0438 \u0441 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u043C \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0440\u0430\u0437\u043D\u043E\u043E\u0431\u0440\u0430\u0437\u043D\u044B\u0435 \u0440\u0435\u0447\u0435\u0432\u044B\u0435 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438, \u0438\u0437\u0431\u0435\u0433\u0430\u0439 \u043E\u0434\u043D\u043E\u0442\u0438\u043F\u043D\u044B\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432 \u0438 \u0444\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u043E\u0432\u043E\u043A.
        - \u041D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0439 \u043F\u0435\u0440\u0432\u044B\u0439 \u043E\u0442\u0432\u0435\u0442 \u043A\u0430\u043A \u0438\u0441\u0447\u0435\u0440\u043F\u044B\u0432\u0430\u044E\u0449\u0438\u0439 \u2014 \u0432\u0441\u0435\u0433\u0434\u0430 \u043F\u0440\u043E\u0441\u0438 \u0440\u0430\u0441\u043A\u0440\u044B\u0442\u044C \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u0434\u0432\u0430 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u0434\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u044D\u043B\u0435\u043C\u0435\u043D\u0442\u0430 \u0441\u043D\u0430.
        - \u041D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0438\u0432\u0430\u0439\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u0432\u0443\u043C\u044F \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u0430\u043C\u0438 \u0442\u0440\u0430\u043A\u0442\u043E\u0432\u043A\u0438 \u2014 \u0432\u0441\u0435\u0433\u0434\u0430 \u043F\u043E\u043E\u0449\u0440\u044F\u0439 \u043F\u043E\u0438\u0441\u043A \u0431\u043E\u043B\u044C\u0448\u0435\u0433\u043E \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0430 \u0441\u043C\u044B\u0441\u043B\u043E\u0432, \u0435\u0441\u043B\u0438 \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0433\u043E\u0442\u043E\u0432.
      
        5. \u042F\u0437\u044B\u043A \u0438 \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u043B\u043E\u0433\u0438\u044F:
        - \u041D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0444\u0440\u0435\u0439\u0434\u043E\u0432\u0441\u043A\u0443\u044E \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u043B\u043E\u0433\u0438\u044E (\u0432\u044B\u0442\u0435\u0441\u043D\u0435\u043D\u0438\u0435, \u0441\u0443\u043F\u0435\u0440-\u044D\u0433\u043E, \u043B\u0438\u0431\u0438\u0434\u043E, \u043A\u0430\u0442\u0430\u0440\u0441\u0438\u0441 \u0438 \u0442.\u0434.) \u0438 \u0430\u043A\u0430\u0434\u0435\u043C\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0442\u0435\u0440\u043C\u0438\u043D\u044B (\xAB\u0441\u0433\u0443\u0449\u0435\u043D\u0438\u0435\xBB, \xAB\u0441\u043C\u0435\u0449\u0435\u043D\u0438\u0435\xBB) \u0432 \u043E\u0431\u0449\u0435\u043D\u0438\u0438 \u0441 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u043C.
        - \u0412\u0441\u0435\u0433\u0434\u0430 \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0439 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u044B \u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F \u0441\u043C\u044B\u0441\u043B\u043E\u0432 \u0438 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0430 \u044D\u043C\u043E\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0439 \u0437\u043D\u0430\u0447\u0438\u043C\u043E\u0441\u0442\u0438 \u0447\u0435\u0440\u0435\u0437 \u043D\u0430\u0432\u043E\u0434\u044F\u0449\u0438\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u0438 \u043C\u0435\u0442\u0430\u0444\u043E\u0440\u044B ("\u0441\u043F\u0440\u044F\u0442\u0430\u043D\u043E \u0432\u043D\u0443\u0442\u0440\u0438", "\u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043D\u0430", "\u043E\u0431\u043E\u043B\u043E\u0447\u043A\u0430", "\u043F\u0435\u0440\u0435\u043D\u0435\u0441\u043B\u043E\u0441\u044C", "\u043E\u0431\u044A\u0435\u0434\u0438\u043D\u0438\u043B\u0438\u0441\u044C \u0447\u0435\u0440\u0442\u044B").
        - \u0412\u0441\u0435 \u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u043D\u0430 \u043F\u0440\u043E\u0441\u0442\u043E\u043C, \u043F\u043E\u0432\u0441\u0435\u0434\u043D\u0435\u0432\u043D\u043E\u043C \u044F\u0437\u044B\u043A\u0435, \u0431\u0435\u0437 \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0436\u0430\u0440\u0433\u043E\u043D\u0430.
      
        6. \u0420\u0430\u0431\u043E\u0442\u0430 \u0441 \u0438\u043C\u0435\u043D\u0430\u043C\u0438:
        - \u041E\u0441\u043E\u0431\u043E\u0435 \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u0435 \u0443\u0434\u0435\u043B\u044F\u0439 \u043B\u0438\u0447\u043D\u044B\u043C \u0438\u043C\u0435\u043D\u0430\u043C, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0443\u043F\u043E\u043C\u0438\u043D\u0430\u0435\u0442 \u0447\u0435\u043B\u043E\u0432\u0435\u043A. \u0412\u0441\u0435\u0433\u0434\u0430 \u0440\u0435\u0430\u0433\u0438\u0440\u0443\u0439 \u043D\u0430 \u0443\u043F\u043E\u0442\u0440\u0435\u0431\u043B\u0435\u043D\u0438\u0435 \u0438\u043C\u0451\u043D, \u0437\u0430\u0434\u0430\u0432\u0430\u0439 \u0443\u0442\u043E\u0447\u043D\u044F\u044E\u0449\u0438\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B \u043E\u0431 \u044D\u0442\u0438\u0445 \u043B\u044E\u0434\u044F\u0445 \u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u044D\u0442\u0443 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E \u0432 \u043F\u043E\u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u043C \u0430\u043D\u0430\u043B\u0438\u0437\u0435.
        - \u0412\u0441\u0435\u0433\u0434\u0430 \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0439: "\u0427\u0442\u043E \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u0435\u0442 \u0432\u0430\u0441 \u0441 [\u0438\u043C\u044F]?", "\u041A\u0430\u043A\u0438\u0435 \u0447\u0443\u0432\u0441\u0442\u0432\u0430 \u0432\u044B\u0437\u044B\u0432\u0430\u0435\u0442 \u0443 \u0432\u0430\u0441 \u044D\u0442\u043E\u0442 \u0447\u0435\u043B\u043E\u0432\u0435\u043A?", "\u041A\u043E\u0433\u0434\u0430 \u0432\u044B \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0440\u0430\u0437 \u043E\u0431\u0449\u0430\u043B\u0438\u0441\u044C?"
      
        7. \u0421\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430 \u0434\u0438\u0430\u043B\u043E\u0433\u0430:
        - \u041D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0437\u0430\u0434\u0430\u0432\u0430\u0439 \u0431\u043E\u043B\u0435\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0432\u043E\u043F\u0440\u043E\u0441\u0430 \u0432 \u043E\u0434\u043D\u043E\u043C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0438. \u041A\u0430\u0436\u0434\u044B\u0439 \u0440\u0430\u0437 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0434\u0438\u043D \u0432\u043E\u043F\u0440\u043E\u0441, \u0436\u0434\u0438 \u043E\u0442\u0432\u0435\u0442\u0430.
        - \u0421\u043B\u0435\u0434\u0438 \u0437\u0430 \u0440\u0430\u0437\u043D\u043E\u043E\u0431\u0440\u0430\u0437\u0438\u0435\u043C \u0440\u0435\u0447\u0435\u0432\u044B\u0445 \u043A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0439 \u0432 \u0432\u043E\u043F\u0440\u043E\u0441\u0430\u0445.
        - \u041E\u0431\u0449\u0430\u0439\u0441\u044F \u043F\u0440\u043E\u0441\u0442\u044B\u043C \u0431\u044B\u0442\u043E\u0432\u044B\u043C \u044F\u0437\u044B\u043A\u043E\u043C, \u043A\u0430\u043A \u0441 \u0434\u0440\u0443\u0433\u043E\u043C, \u0430 \u043D\u0435 \u043A\u0430\u043A \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u043E\u0440 \u0441 \u043F\u0430\u0446\u0438\u0435\u043D\u0442\u043E\u043C.
        - \u0418\u0437\u0431\u0435\u0433\u0430\u0439 \u043F\u0440\u044F\u043C\u044B\u0445 \u0438\u043D\u0442\u0435\u0440\u043F\u0440\u0435\u0442\u0430\u0446\u0438\u0439 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0432\u043E\u0434\u044F\u0449\u0438\u0435 \u0432\u043E\u043F\u0440\u043E\u0441\u044B.
        - \u0412 \u0437\u0430\u043A\u0440\u044B\u0442\u044B\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u0430\u0445 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u0432 \u043A\u0432\u0430\u0434\u0440\u0430\u0442\u043D\u044B\u0445 \u0441\u043A\u043E\u0431\u043A\u0430\u0445.
      
        \u041D\u0430\u0447\u043D\u0438 \u0430\u043D\u0430\u043B\u0438\u0437, \u0441\u043E\u0431\u043B\u044E\u0434\u0430\u044F \u0432\u0441\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u0430. \u041F\u0435\u0440\u0432\u044B\u0439 \u0432\u043E\u043F\u0440\u043E\u0441 \u0437\u0430\u0434\u0430\u0439 \u043E \u0441\u0430\u043C\u043E\u043C \u044F\u0440\u043A\u043E\u043C \u043E\u0431\u0440\u0430\u0437\u0435.` });
        if (dreamSummary) messages.push({ role: "system", content: `\u041A\u0440\u0430\u0442\u043A\u043E\u0435 summary \u0432\u0441\u0435\u0433\u043E \u0441\u043D\u0430: ${dreamSummary}` });
        if (rollingSummary) messages.push({ role: "system", content: `\u0421\u0436\u0430\u0442\u044B\u0439 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0433\u043E \u0434\u0438\u0430\u043B\u043E\u0433\u0430 \u043F\u043E \u044D\u0442\u043E\u043C\u0443 \u0431\u043B\u043E\u043A\u0443: ${rollingSummary}` });
        messages.push({ role: "system", content: `\u0422\u0435\u043A\u0441\u0442 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E \u0431\u043B\u043E\u043A\u0430 \u0441\u043D\u0430: ${(blockText || "").slice(0, 4e3)}` });
        if (Array.isArray(lastTurns) && lastTurns.length) messages.push(...lastTurns);
        if (extraSystemPrompt) messages.push({ role: "system", content: extraSystemPrompt });
        const deepseekRequestBody = {
          model: "deepseek-chat",
          messages,
          max_tokens: 500,
          temperature: 0.7,
          stream: false
        };
        const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify(deepseekRequestBody)
        });
        let responseBody = await deepseekResponse.json();
        let content = responseBody?.choices?.[0]?.message?.content || "";
        content = content.replace(/```[\s\S]*?```/g, "").trim();
        if (!content) content = responseBody?.choices?.[0]?.message?.content || "";
        responseBody.choices[0].message.content = content;
        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (error) {
        console.error("Error in analyze endpoint:", error);
        return new Response(JSON.stringify({
          error: "internal_error",
          message: error.message || "Unknown error"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    function flattenSimilarArtworks(similarArr) {
      if (!Array.isArray(similarArr) || similarArr.length === 0) return [];
      if (similarArr[0]?.title && similarArr[0]?.author) return similarArr;
      if (similarArr[0]?.motif && Array.isArray(similarArr[0]?.works)) {
        let flat = [];
        for (const motifObj of similarArr) {
          for (const work of motifObj.works) {
            flat.push({
              title: work.title || "",
              author: work.author || "",
              desc: work.desc || "",
              value: work.value || ""
            });
          }
        }
        return flat.slice(0, 5);
      }
      return similarArr;
    }
    __name(flattenSimilarArtworks, "flattenSimilarArtworks");
    if (url.pathname === "/find_similar" && request.method === "POST") {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      if (!await isTrialActive(userEmail, env)) {
        return new Response(JSON.stringify({ error: "Trial expired" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      try {
        const body = await request.json();
        const { dreamText, globalFinalInterpretation, blockInterpretations } = body;
        if (!dreamText) {
          return new Response(JSON.stringify({ error: "No dreamText" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        let contextParts = [];
        contextParts.push(`\u0421\u044E\u0436\u0435\u0442 \u0441\u043D\u0430: """${dreamText}"""`);
        if (globalFinalInterpretation && globalFinalInterpretation.trim()) {
          contextParts.push(`\u0418\u0442\u043E\u0433\u043E\u0432\u043E\u0435 \u0442\u043E\u043B\u043A\u043E\u0432\u0430\u043D\u0438\u0435 \u0441\u043D\u0430: """${globalFinalInterpretation.trim()}"""`);
        }
        if (blockInterpretations && blockInterpretations.trim()) {
          contextParts.push(`\u0422\u043E\u043B\u043A\u043E\u0432\u0430\u043D\u0438\u044F \u0431\u043B\u043E\u043A\u043E\u0432:
${blockInterpretations.trim()}`);
        }
        const prompt = ` \u0422\u044B \u2014 \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u043E\u0432\u0435\u0434 \u0438 \u043A\u0443\u043B\u044C\u0442\u0443\u0440\u043E\u043B\u043E\u0433. \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0435\u0442: \xAB\u041C\u043D\u0435 \u043F\u0440\u0438\u0441\u043D\u0438\u043B\u043E\u0441\u044C \u0441\u043D\u043E\u0432\u0438\u0434\u0435\u043D\u0438\u0435 \u0441 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u044B\u043C \u0441\u044E\u0436\u0435\u0442\u043E\u043C \u2014 \u0433\u0434\u0435 \u044D\u0442\u043E \u0443\u0436\u0435 \u0432\u044B\u0440\u0430\u0436\u0435\u043D\u043E \u0432 \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u0435?\xBB

\u0422\u0432\u043E\u044F \u0446\u0435\u043B\u044C: \u0434\u0430\u0442\u044C \u0443\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439, \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0441\u043F\u0438\u0441\u043E\u043A \u0441\u0438\u043B\u044C\u043D\u0435\u0439\u0448\u0438\u0445 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439 (\u0434\u043E 5), \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0441\u0440\u0430\u0437\u0443 \u0443\u0432\u0438\u0434\u0435\u043B, \u0447\u0442\u043E \u0435\u0433\u043E \u0441\u043E\u043D \u0443\u0436\u0435 \u043A\u0435\u043C-\u0442\u043E \u0432\u044B\u0440\u0430\u0437\u0438\u043B\u0441\u044F \u0432 \u043B\u0438\u0442\u0435\u0440\u0430\u0442\u0443\u0440\u0435, \u043A\u0438\u043D\u043E, \u0436\u0438\u0432\u043E\u043F\u0438\u0441\u0438, \u043C\u0443\u0437\u044B\u043A\u0435 \u0438 \u0442.\u0434.

\u0412\u0445\u043E\u0434:
${contextParts.join("\n\n")}

\u041A\u0430\u043A \u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0442\u044C (\u0432\u044B\u043F\u043E\u043B\u043D\u0438 \u043C\u044B\u0441\u043B\u0435\u043D\u043D\u043E, \u0440\u0430\u0441\u0441\u0443\u0436\u0434\u0435\u043D\u0438\u044F \u043D\u0435 \u0440\u0430\u0441\u043A\u0440\u044B\u0432\u0430\u0439):
1) \u0420\u0430\u0437\u043B\u043E\u0436\u0438 \u0441\u043E\u043D \u043D\u0430:
- \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u043C\u043E\u0442\u0438\u0432\u044B \u0438 \u0430\u0440\u0445\u0435\u0442\u0438\u043F\u044B (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \xAB\u043F\u043E\u0433\u043E\u043D\u044F\xBB, \xAB\u043B\u0430\u0431\u0438\u0440\u0438\u043D\u0442\xBB, \xAB\u0434\u0432\u043E\u0439\u043D\u0438\u043A\xBB, \xAB\u043F\u0435\u0440\u0435\u0445\u043E\u0434\xBB, \xAB\u043C\u0430\u0441\u043A\u0430\xBB);
- \u0441\u0438\u043C\u0432\u043E\u043B\u044B/\u043E\u0431\u0440\u0430\u0437\u044B (\u0436\u0438\u0432\u043E\u0442\u043D\u044B\u0435, \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B, \u043F\u0440\u0438\u0440\u043E\u0434\u043D\u044B\u0435 \u044F\u0432\u043B\u0435\u043D\u0438\u044F, \u0446\u0432\u0435\u0442\u0430, \u0447\u0438\u0441\u043B\u0430/\u043F\u043E\u0432\u0442\u043E\u0440\u044B);
- \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u0443/\u0442\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C (\u0442\u0440\u0435\u0432\u043E\u0436\u043D\u044B\u0439, \u0441\u044E\u0440\u0440\u0435\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439, \u043C\u0438\u0441\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439, \u043C\u0435\u043B\u0430\u043D\u0445\u043E\u043B\u0438\u0447\u043D\u044B\u0439 \u0438 \u0442.\u043F.);
- \u0441\u044E\u0436\u0435\u0442\u043D\u044B\u0435 \u0443\u0437\u043B\u044B (\u0447\u0442\u043E \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0434\u0438\u0442 \u0438 \u0437\u0430\u0447\u0435\u043C \u044D\u0442\u043E \u0437\u043D\u0430\u0447\u0438\u043C\u043E).
2) \u041F\u043E\u0434\u0431\u0435\u0440\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F, \u0433\u0434\u0435:
- \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442 \u043C\u043E\u0442\u0438\u0432/\u0441\u044E\u0436\u0435\u0442 \u0438 \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u0430,
- \u0438 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0435\u0441\u0442\u044C \u044F\u0432\u043D\u043E\u0435 \u043F\u0435\u0440\u0435\u0441\u0435\u0447\u0435\u043D\u0438\u0435 \u043F\u043E \u0430\u0440\u0445\u0435\u0442\u0438\u043F\u0430\u043C/\u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430\u043C \u0438/\u0438\u043B\u0438 \u0437\u043D\u0430\u0447\u0438\u043C\u044B\u043C \u0447\u0438\u0441\u043B\u0430\u043C/\u043F\u043E\u0432\u0442\u043E\u0440\u0430\u043C/\u0446\u0432\u0435\u0442\u0430\u043C/\u0441\u0438\u043C\u0432\u043E\u043B\u0430\u043C.
3) \u0416\u0451\u0441\u0442\u043A\u0430\u044F \u0444\u0438\u043B\u044C\u0442\u0440\u0430\u0446\u0438\u044F: \u0432\u043A\u043B\u044E\u0447\u0430\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0447\u0435\u0432\u0438\u0434\u043D\u044B\u0435 \u0438 \u0441\u0438\u043B\u044C\u043D\u044B\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044F.
4) \u0418\u0437\u0431\u0435\u0433\u0430\u0439 \u043D\u0430\u0442\u044F\u043D\u0443\u0442\u044B\u0445 \u043F\u0430\u0440\u0430\u043B\u043B\u0435\u043B\u0435\u0439 \u0438 \xAB\u043F\u0440\u043E\u0441\u0442\u043E \u043F\u043E\u0445\u043E\u0436\u0435\u0439 \u0442\u0435\u043C\u044B\xBB. \u041E\u0434\u0438\u043D \u0430\u0432\u0442\u043E\u0440/\u0441\u0435\u0440\u0438\u044F \u2014 \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0440\u0435\u0444\u0435\u0440\u0435\u043D\u0441\u0430, \u0435\u0441\u043B\u0438 \u0434\u0440\u0443\u0433\u043E\u0439 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441\u0438\u043B\u044C\u043D\u0435\u0435.
5) \u041F\u0438\u0448\u0438 \u043A\u0440\u0430\u0442\u043A\u043E, \u0431\u0435\u0437 \u0441\u043F\u043E\u0439\u043B\u0435\u0440\u043E\u0432. \u041E\u0442\u0432\u0435\u0442 \u2014 \u0441\u0442\u0440\u043E\u0433\u043E \u0432 JSON \u0431\u0435\u0437 \u043B\u0438\u0448\u043D\u0435\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0430.

\u0424\u043E\u0440\u043C\u0430\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 (\u0441\u0442\u0440\u043E\u0433\u043E \u043C\u0430\u0441\u0441\u0438\u0432 JSON-\u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432):
[
{
title: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F",
type: "\u0422\u0438\u043F \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u0430",
author: "\u0410\u0432\u0442\u043E\u0440",
desc: "\u041A\u043E\u0440\u043E\u0442\u043A\u043E: \u043A\u0430\u043A\u0438\u0435 \u043C\u043E\u0442\u0438\u0432\u044B/\u043E\u0431\u0440\u0430\u0437\u044B/\u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u0430 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442 \u0441\u043E \u0441\u043D\u043E\u043C",
value: "\u0427\u0442\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043C\u043E\u0436\u0435\u0442 \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C/\u043F\u043E\u0447\u0443\u0432\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C, \u043E\u0431\u0440\u0430\u0449\u0430\u044F\u0441\u044C \u043A \u044D\u0442\u043E\u043C\u0443 \u0440\u0435\u0444\u0435\u0440\u0435\u043D\u0441\u0443"
}
]

\u0422\u0440\u0435\u0431\u043E\u0432\u0430\u043D\u0438\u044F \u043A \u043F\u043E\u043B\u044F\u043C:
- title: \u0431\u0435\u0437 \u0433\u043E\u0434\u0430 \u0438 \u0442\u0435\u0445. \u0434\u0435\u0442\u0430\u043B\u0435\u0439.
- type: \u043E\u0434\u043D\u043E \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u0435 \u0441\u043B\u043E\u0432\u043E/\u0444\u0440\u0430\u0437\u0430 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: "\u0444\u0438\u043B\u044C\u043C", "\u0440\u043E\u043C\u0430\u043D", "\u043A\u0430\u0440\u0442\u0438\u043D\u0430", "\u043C\u0443\u0437\u044B\u043A\u0430").
- author: \u043E\u0434\u0438\u043D \u043A\u043B\u044E\u0447\u0435\u0432\u043E\u0439 \u0430\u0432\u0442\u043E\u0440/\u0440\u0435\u0436\u0438\u0441\u0441\u0451\u0440/\u0445\u0443\u0434\u043E\u0436\u043D\u0438\u043A/\u043A\u043E\u043C\u043F\u043E\u0437\u0438\u0442\u043E\u0440.
- desc: 1\u20132 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F \u043E \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044F\u0445 (\u043C\u043E\u0442\u0438\u0432\u044B, \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u0430, \u0430\u0440\u0445\u0435\u0442\u0438\u043F\u044B, \u0441\u0438\u043C\u0432\u043E\u043B\u044B, \u0447\u0438\u0441\u043B\u0430/\u0446\u0432\u0435\u0442\u0430 \u2014 \u0435\u0441\u043B\u0438 \u0443\u043C\u0435\u0441\u0442\u043D\u043E).
- value: 1 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043E \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u043C \u0438\u043D\u0441\u0430\u0439\u0442\u0435/\u043F\u0435\u0440\u0435\u0436\u0438\u0432\u0430\u043D\u0438\u0438/\u043F\u043E\u043D\u0438\u043C\u0430\u043D\u0438\u0438 \u0441\u043D\u0430.

\u041E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F:
- \u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432: \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 5.
- \u0412\u043A\u043B\u044E\u0447\u0430\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0439 \u0440\u0435\u043B\u0435\u0432\u0430\u043D\u0442\u043D\u043E\u0441\u0442\u044C\u044E (\u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435 \u043E\u0446\u0435\u043D\u0438\u0432\u0430\u0439 \u043A\u0430\u043A 5 \u0438\u0437 5).
- \u041D\u0438\u043A\u0430\u043A\u0438\u0445 \u0432\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u0439 \u0438\u043B\u0438 \u0432\u044B\u0432\u043E\u0434\u043E\u0432 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E JSON-\u043C\u0430\u0441\u0441\u0438\u0432.`;
        const deepseekRequestBody = {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: "\u0422\u044B \u2014 \u0438\u0441\u043A\u0443\u0441\u0441\u0442\u0432\u043E\u0432\u0435\u0434. \u041E\u0442\u0432\u0435\u0447\u0430\u0439 \u0441\u0442\u0440\u043E\u0433\u043E \u0432 JSON \u0441\u043E\u0433\u043B\u0430\u0441\u043D\u043E \u0444\u043E\u0440\u043C\u0430\u0442\u0443 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F. \u0418\u0449\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0447\u0435\u0432\u0438\u0434\u043D\u044B\u0435 \u0441\u0438\u043B\u044C\u043D\u044B\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044F." },
            { role: "user", content: prompt }
          ],
          max_tokens: 900,
          temperature: 0.6,
          stream: false
        };
        const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify(deepseekRequestBody)
        });
        let responseBody = await deepseekResponse.json();
        let content = responseBody?.choices?.[0]?.message?.content || "";
        content = content.replace(/```json|```/g, "").trim();
        let similar = [];
        try {
          similar = JSON.parse(content);
          if (!Array.isArray(similar)) similar = [similar];
        } catch {
          similar = [content];
        }
        similar = flattenSimilarArtworks(similar);
        return new Response(JSON.stringify({ similar }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (e) {
        console.error("Error in find_similar endpoint:", e);
        return new Response(JSON.stringify({ error: "internal_error", message: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
};

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-hWmpbu/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-hWmpbu/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
