// --- CORS настройка ---
const allowedOrigins = [
  'https://sakovvolfsnitko-e6deet01q-alexandr-snitkos-projects.vercel.app',
  'https://sakovvolfsnitko.vercel.app',
  'https://vercel.com/alexandr-snitkos-projects/saviora.app/deployments',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const CACHE_TTL = 60 * 1000;

function normalizeOrigin(o) {
  if (!o) return '';
  return o.endsWith('/') ? o.slice(0, -1) : o;
}

function buildCorsHeaders(origin) {
  const norm = normalizeOrigin(origin);
  if (allowedOrigins.includes(norm)) {
    return {
      'Access-Control-Allow-Origin': norm,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
  }
  return {
    'Vary': 'Origin'
  };
}

// Base64url encode/decode для JWT
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
}

// --- Хэширование пароля через SHA-256 ---
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Подпись HMAC-SHA256 ---
async function sign(str, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(str));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Примитивный JWT (HMAC-SHA256 подпись) ---
async function createToken(payload, secret) {
  const headerObj = { alg: "HS256", typ: "JWT" };
  const header = base64urlEncode(JSON.stringify(headerObj));
  const body = base64urlEncode(JSON.stringify(payload));
  const signature = await sign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

async function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, bodyB64, signature] = parts;

  try {
    const header = JSON.parse(base64urlDecode(headerB64));
    if (header.alg !== 'HS256') return null;
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

// --- Проверка, активен ли trial ---
async function isTrialActive(email, env) {
  const userRaw = await env.USERS_KV.get(`user:${email}`);
  if (!userRaw) return false;
  try {
    const user = JSON.parse(userRaw);
    const now = Date.now();
    const trialPeriod = 14 * 24 * 60 * 60 * 1000;
    return (now - user.created) <= trialPeriod;
  } catch {
    return false;
  }
}

// --- Маппинг старых снов к новому формату ---
function normalizeDream(d) {
  if (d.text && !d.dreamText) d.dreamText = d.text;
  if (d.created && !d.date) d.date = d.created;
  if (d.updated && !d.date) d.date = d.updated;
  if (!d.blocks) d.blocks = [];
  if (!('globalFinalInterpretation' in d)) d.globalFinalInterpretation = null;
  if (!('dreamSummary' in d)) d.dreamSummary = null;
  if (!('category' in d)) d.category = null;
  if (!('context' in d)) d.context = '';
  if (!d.similarArtworks) d.similarArtworks = [];
  return d;
}

// --- Валидация данных сна ---
function validateDreamData(data) {
  if (!data) return { valid: false, error: 'Missing dream data' };
  if (typeof data.dreamText !== 'string' || data.dreamText.trim() === '') {
    return { valid: false, error: 'dreamText is required and must be a non-empty string' };
  }
  if (data.title && typeof data.title !== 'string') {
    return { valid: false, error: 'title must be a string' };
  }
  if (data.blocks && !Array.isArray(data.blocks)) {
    return { valid: false, error: 'blocks must be an array' };
  }
  if (data.similarArtworks && !Array.isArray(data.similarArtworks)) {
    return { valid: false, error: 'similarArtworks must be an array' };
  }
  return { valid: true };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = buildCorsHeaders(origin);

    const JWT_SECRET = env.JWT_SECRET;

    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not set');
      return new Response(JSON.stringify({ error: 'server_misconfigured', message: 'JWT_SECRET is not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (url.pathname === '/register' && request.method === 'POST') {
      const ct = request.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Invalid content type' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const { email, password } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Missing email or password' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const userKey = `user:${email}`;
      const existing = await env.USERS_KV.get(userKey);
      if (existing) {
        return new Response(JSON.stringify({ error: 'User already exists' }), {
          status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const hash = await hashPassword(password);
        const user = { email, password: hash, created: Date.now(), tokenVersion: 0 };
        await env.USERS_KV.put(userKey, JSON.stringify(user));
        return new Response(JSON.stringify({ success: true }), {
          status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        console.error('Error during registration:', e);
        return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    if (url.pathname === '/login' && request.method === 'POST') {
      const ct = request.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Invalid content type' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const { email, password } = body;
      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'Missing email or password' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const userKey = `user:${email}`;
      const userRaw = await env.USERS_KV.get(userKey);
      if (!userRaw) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      let user;
      try {
        user = JSON.parse(userRaw);
      } catch {
        return new Response(JSON.stringify({ error: 'User data corrupted' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const hash = await hashPassword(password);
        if (user.password !== hash) {
          return new Response(JSON.stringify({ error: 'Invalid password' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      } catch (e) {
        console.error('Error hashing password:', e);
        return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const now = Date.now();
      const trialPeriod = 14 * 24 * 60 * 60 * 1000;
      if (now - user.created > trialPeriod) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const tokenVersion = user.tokenVersion ?? 0;
      const payload = { email, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000, tv: tokenVersion };
      const token = await createToken(payload, JWT_SECRET);
      return new Response(JSON.stringify({ token }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    async function getUserEmail(request) {
      const auth = request.headers.get('authorization');
      if (!auth || !auth.startsWith('Bearer ')) return null;
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
      if (typeof payload.tv !== 'number' || payload.tv !== currentTv) return null;
      return payload.email;
    }

    if (url.pathname === '/me' && request.method === 'GET') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const userRaw = await env.USERS_KV.get(`user:${userEmail}`);
      if (!userRaw) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      let user;
      try {
        user = JSON.parse(userRaw);
      } catch {
        return new Response(JSON.stringify({ error: 'User data corrupted' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const now = Date.now();
      const trialPeriod = 14 * 24 * 60 * 60 * 1000;
      const msLeft = user.created + trialPeriod - now;
      const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
      return new Response(JSON.stringify({
        email: user.email,
        created: user.created,
        trialEndsAt: user.created + trialPeriod,
        trialDaysLeft: daysLeft
      }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // --- DREAMS API with D1 integration ---

    if (url.pathname === '/dreams' && request.method === 'GET') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (!(await isTrialActive(userEmail, env))) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const d1 = env.DB;
        const result = await d1.prepare('SELECT * FROM dreams WHERE user = ? ORDER BY date DESC').bind(userEmail).all();
        const dreams = result.results.map(row => {
          if (row.blocks) {
            try { row.blocks = JSON.parse(row.blocks); } catch { row.blocks = []; }
          } else {
            row.blocks = [];
          }
          if (row.similarArtworks) {
            try { row.similarArtworks = JSON.parse(row.similarArtworks); } catch { row.similarArtworks = []; }
          } else {
            row.similarArtworks = [];
          }
          return normalizeDream(row);
        });
        return new Response(JSON.stringify(dreams), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        console.error('Error fetching dreams:', e);
        return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    if (url.pathname === '/dreams' && request.method === 'POST') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (!(await isTrialActive(userEmail, env))) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const validation = validateDreamData(body);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: 'Invalid dream data', message: validation.error }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const { dreamText } = body;
      const id = crypto.randomUUID();
      const date = Math.floor(Date.now() / 1000);

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
          status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        console.error('Error inserting dream:', e);
        return new Response(JSON.stringify({ error: 'internal_error', message: e instanceof Error ? e.message : String(e) }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    if (url.pathname.startsWith('/dreams/') && request.method === 'GET') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (!(await isTrialActive(userEmail, env))) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const id = url.pathname.split('/')[2];
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing dream id' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const d1 = env.DB;
        const row = await d1.prepare('SELECT * FROM dreams WHERE id = ? AND user = ?').bind(id, userEmail).first();
        if (!row) {
          return new Response(JSON.stringify({ error: 'Dream not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        if (row.blocks) {
          try { row.blocks = JSON.parse(row.blocks); } catch { row.blocks = []; }
        } else {
          row.blocks = [];
        }
        if (row.similarArtworks) {
          try { row.similarArtworks = JSON.parse(row.similarArtworks); } catch { row.similarArtworks = []; }
        } else {
          row.similarArtworks = [];
        }
        return new Response(JSON.stringify(normalizeDream(row)), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        console.error('Error fetching dream:', e);
        return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    if (url.pathname.startsWith('/dreams/') && request.method === 'DELETE') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (!(await isTrialActive(userEmail, env))) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const id = url.pathname.split('/')[2];
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing dream id' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const d1 = env.DB;
        const result = await d1.prepare('DELETE FROM dreams WHERE id = ? AND user = ?').bind(id, userEmail).run();
        if (result.changes === 0) {
          return new Response(JSON.stringify({ error: 'Dream not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        console.error('Error deleting dream:', e);
        return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    if (url.pathname.startsWith('/dreams/') && request.method === 'PUT') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (!(await isTrialActive(userEmail, env))) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const validation = validateDreamData(body);
      if (!validation.valid) {
        return new Response(JSON.stringify({ error: 'Invalid dream data', message: validation.error }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      const id = url.pathname.split('/')[2];
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing dream id' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      try {
        const d1 = env.DB;
        const existing = await d1.prepare('SELECT * FROM dreams WHERE id = ? AND user = ?').bind(id, userEmail).first();
        if (!existing) {
          return new Response(JSON.stringify({ error: 'Dream not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
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
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } catch (e) {
        console.error('Error updating dream:', e);
        return new Response(
          JSON.stringify({ error: 'internal_error', message: e instanceof Error ? e.message : String(e) }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // --- Summarize endpoint ---
    if (url.pathname === '/summarize' && request.method === 'POST') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { history, blockText, existingSummary } = body;
      const systemMessages = [
        { role: 'system', content: 'Ты пишешь краткие саммари диалогов по анализу сновидений. Сожми историю блока или сна в 1–3 абзаца, без вопросов и обращений, только факты, ключевые образы и интерпретации. Пиши нейтрально и кратко.' }
      ];
      if (existingSummary) {
        systemMessages.push({ role: 'system', content: `Предыдущее саммари: ${existingSummary} Учти и дополни, не повторяя.` });
      }
      systemMessages.push({ role: 'system', content: `Текст блока или сна: ${(blockText || '').slice(0, 4000)}` });
      const messages = [
        ...systemMessages,
        ...(Array.isArray(history) ? history.slice(-30) : [])
      ];
      const deepseekRequestBody = {
        model: 'deepseek-chat',
        messages,
        max_tokens: 200,
        temperature: 0.5,
        stream: false
      };
      try {
        const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify(deepseekRequestBody)
        });
        let responseBody = await deepseekResponse.json();
        let summary = responseBody?.choices?.[0]?.message?.content || '';
        summary = summary.replace(/```[\s\S]*?```/g, '').replace(/^["'`]+|["'`]+$/g, '').trim();
        return new Response(JSON.stringify({ summary }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        console.error('Error in summarize endpoint:', e);
        return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // --- Analyze endpoint ---
    if (url.pathname === '/analyze' && request.method === 'POST') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({
          error: 'unauthorized',
          message: 'Invalid or missing authorization token'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (!(await isTrialActive(userEmail, env))) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      try {
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          return new Response(JSON.stringify({
            error: 'Invalid content type',
            message: 'Content-Type must be application/json'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const requestData = await request.json();
        const { blockText, lastTurns, rollingSummary, extraSystemPrompt, dreamSummary } = requestData;

        let messages = [];
        messages.push({ role: 'system', content: `Ты — фрейдистский аналитик снов, работающий в парадигме сверхдетерминации. Каждый элемент сна (образ, число, часть тела) имеет множество взаимосвязанных значений, скрывающих вытеснённые желания и травмы. Твоя задача — раскрывать эти слои, не ограничиваясь одним толкованием.

        Правила анализа сна:
      
        1. Для частей тела:
        - Всегда рассматривай минимум два противоречивых чувства, которые может вызывать эта часть тела. Не ограничивайся только одной парой (например, не только "нежность/агрессия", но и другие возможные противоположности).
        - Всегда уточняй, с какими разными периодами жизни может быть связана эта часть тела, не подсказывая конкретные варианты, а предлагая человеку самому вспомнить.
      
        2. Для чисел и цифр:
        - Всегда ищи минимум два разных события или периода, которые может объединять это число. Не ограничивайся только возрастом или подсчётом — предлагай рассмотреть и другие возможные ассоциации (например, даты, количество людей, номера, случайные совпадения).
        - Не подталкивай к конкретным вариантам, а задавай открытые вопросы с примерами в квадратных скобках.
      
        3. Для символов и образов:
        - Каждый образ рассматривай как узел смыслов: предлагай минимум два разных контекста (телесный, социальный, детский, семейный, рабочий и т.д.), не ограничиваясь только тремя.
        - Всегда спрашивай о противоположных желаниях, которые могут быть спрятаны в этом символе, не предлагая готовых вариантов, а давая примеры в квадратных скобках.
      
        4. Метод работы:
        - После каждого ответа обязательно уточняй: "Это только одно из возможных значений. Если представить, что этот образ — лишь оболочка, что ещё может быть спрятано внутри?"
        - При абсурдных сочетаниях всегда спрашивай: "Что общего между этими, казалось бы, несовместимыми образами? На какую одну скрытую мысль они могут вместе указывать?"
        - Для эмоций всегда спрашивай: "Какое скрытое желание или память могло породить именно эту реакцию на этот, возможно, случайный образ?"
        - Всегда ищи, как несколько разных людей, событий или конфликтов могли объединиться в один образ. Спрашивай: "Черты скольких разных людей или ситуаций вы можете разглядеть в этом одном образе из сна?"
        - Всегда исследуй, почему самый сильный эмоциональный заряд во сне приходится на, казалось бы, второстепенную деталь. Спрашивай: "Почему самый яркий страх/радость во сне были связаны именно с [X], а не с [более очевидный Y]?"
        - Перед началом анализа обязательно задай вопросы о нынешнем контексте жизни сновидца (настроение, недавние события, текущие переживания) и используй эту информацию в последующем анализе.
        - В общении с человеком используй разнообразные речевые конструкции, избегай однотипных вопросов и формулировок.
        - Никогда не принимай первый ответ как исчерпывающий — всегда проси раскрыть минимум два значения для каждого элемента сна.
        - Никогда не ограничивайся только двумя вариантами трактовки — всегда поощряй поиск большего количества смыслов, если человек готов.
      
        5. Язык и терминология:
        - Никогда не используй фрейдовскую терминологию (вытеснение, супер-эго, либидо, катарсис и т.д.) и академические термины («сгущение», «смещение») в общении с человеком.
        - Всегда объясняй процессы объединения смыслов и переноса эмоциональной значимости через наводящие вопросы и метафоры ("спрятано внутри", "указывать на", "оболочка", "перенеслось", "объединились черты").
        - Все объяснения должны быть на простом, повседневном языке, без профессионального жаргона.
      
        6. Работа с именами:
        - Особое внимание уделяй личным именам, которые упоминает человек. Всегда реагируй на употребление имён, задавай уточняющие вопросы об этих людях и используй эту информацию в последующем анализе.
        - Всегда спрашивай: "Что связывает вас с [имя]?", "Какие чувства вызывает у вас этот человек?", "Когда вы последний раз общались?"
      
        7. Структура диалога:
        - Никогда не задавай более одного вопроса в одном сообщении. Каждый раз — только один вопрос, жди ответа.
        - Следи за разнообразием речевых конструкций в вопросах.
        - Общайся простым бытовым языком, как с другом, а не как профессор с пациентом.
        - Избегай прямых интерпретаций — только наводящие вопросы.
        - В закрытых вопросах предлагай варианты в квадратных скобках.
      
        Начни анализ, соблюдая все правила. Первый вопрос задай о самом ярком образе.`});
        if (dreamSummary) messages.push({ role: 'system', content: `Краткое summary всего сна: ${dreamSummary}` });
        if (rollingSummary) messages.push({ role: 'system', content: `Сжатый контекст предыдущего диалога по этому блоку: ${rollingSummary}` });
        messages.push({ role: 'system', content: `Текст текущего блока сна: ${(blockText || '').slice(0, 4000)}` });
        if (Array.isArray(lastTurns) && lastTurns.length) messages.push(...lastTurns);
        if (extraSystemPrompt) messages.push({ role: 'system', content: extraSystemPrompt });

        const deepseekRequestBody = {
          model: 'deepseek-chat',
          messages,
          max_tokens: 500,
          temperature: 0.7,
          stream: false
        };

        const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify(deepseekRequestBody)
        });

        let responseBody = await deepseekResponse.json();
        let content = responseBody?.choices?.[0]?.message?.content || '';
        content = content.replace(/```[\s\S]*?```/g, '').trim();
        if (!content) content = responseBody?.choices?.[0]?.message?.content || '';
        responseBody.choices[0].message.content = content;
        return new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } catch (error) {
        console.error('Error in analyze endpoint:', error);
        return new Response(JSON.stringify({
          error: 'internal_error',
          message: error.message || 'Unknown error'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // --- Flatten similar artworks helper ---
    function flattenSimilarArtworks(similarArr) {
      if (!Array.isArray(similarArr) || similarArr.length === 0) return [];
      if (similarArr[0]?.title && similarArr[0]?.author) return similarArr;
      if (similarArr[0]?.motif && Array.isArray(similarArr[0]?.works)) {
        let flat = [];
        for (const motifObj of similarArr) {
          for (const work of motifObj.works) {
            flat.push({
              title: work.title || '',
              author: work.author || '',
              desc: work.desc || '',
              value: work.value || ''
            });
          }
        }
        return flat.slice(0, 5);
      }
      return similarArr;
    }

    // --- Find similar artworks endpoint ---
    if (url.pathname === '/find_similar' && request.method === 'POST') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (!(await isTrialActive(userEmail, env))) {
        return new Response(JSON.stringify({ error: 'Trial expired' }), {
          status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const body = await request.json();
        const { dreamText, globalFinalInterpretation, blockInterpretations } = body;
        if (!dreamText) {
          return new Response(JSON.stringify({ error: 'No dreamText' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        let contextParts = [];
        contextParts.push(`Сюжет сна: """${dreamText}"""`);
        if (globalFinalInterpretation && globalFinalInterpretation.trim()) {
          contextParts.push(`Итоговое толкование сна: """${globalFinalInterpretation.trim()}"""`);
        }
        if (blockInterpretations && blockInterpretations.trim()) {
          contextParts.push(`Толкования блоков:\n${blockInterpretations.trim()}`);
        }

        const prompt = ` Ты — искусствовед и культуролог. Пользователь спрашивает: «Мне приснилось сновидение с определённым сюжетом — где это уже выражено в искусстве?»

Твоя цель: дать уверенный, короткий список сильнейших совпадений (до 5), чтобы пользователь сразу увидел, что его сон уже кем-то выразился в литературе, кино, живописи, музыке и т.д.

Вход:
${contextParts.join('\n\n')}

Как сопоставлять (выполни мысленно, рассуждения не раскрывай):
1) Разложи сон на:
- ключевые мотивы и архетипы (например: «погоня», «лабиринт», «двойник», «переход», «маска»);
- символы/образы (животные, предметы, природные явления, цвета, числа/повторы);
- атмосферу/тональность (тревожный, сюрреалистический, мистический, меланхоличный и т.п.);
- сюжетные узлы (что происходит и зачем это значимо).
2) Подбери произведения, где:
- совпадают мотив/сюжет и атмосфера,
- и дополнительно есть явное пересечение по архетипам/персонажам и/или значимым числам/повторам/цветам/символам.
3) Жёсткая фильтрация: включай только очевидные и сильные совпадения.
4) Избегай натянутых параллелей и «просто похожей темы». Один автор/серия — не более одного референса, если другой совпадает сильнее.
5) Пиши кратко, без спойлеров. Ответ — строго в JSON без лишнего текста.

Формат ответа (строго массив JSON-объектов):
[
{
title: "Название произведения",
type: "Тип искусства",
author: "Автор",
desc: "Коротко: какие мотивы/образы/атмосфера совпадают со сном",
value: "Что пользователь может получить/почувствовать, обращаясь к этому референсу"
}
]

Требования к полям:
- title: без года и тех. деталей.
- type: одно короткое слово/фраза (например: "фильм", "роман", "картина", "музыка").
- author: один ключевой автор/режиссёр/художник/композитор.
- desc: 1–2 предложения о совпадениях (мотивы, атмосфера, архетипы, символы, числа/цвета — если уместно).
- value: 1 предложение о возможном инсайте/переживании/понимании сна.

Ограничения:
- Количество результатов: не более 5.
- Включай только работы с максимальной релевантностью (внутренне оценивай как 5 из 5).
- Никаких вступлений или выводов — только JSON-массив.`;

        const deepseekRequestBody = {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'Ты — искусствовед. Отвечай строго в JSON согласно формату пользователя. Ищи только очевидные сильные совпадения.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 900,
          temperature: 0.6,
          stream: false
        };

        const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify(deepseekRequestBody)
        });

        let responseBody = await deepseekResponse.json();
        let content = responseBody?.choices?.[0]?.message?.content || '';
        content = content.replace(/```json|```/g, '').trim();

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
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        console.error('Error in find_similar endpoint:', e);
        return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};