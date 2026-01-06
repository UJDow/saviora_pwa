export class RateLimitDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  // Ожидаемый POST JSON: { action: 'hit' | 'get' | 'reset', maxRequests?: number, windowMs?: number }
  async fetch(request) {
    const now = Date.now();
    let payload = {};
    try {
      payload = await request.json();
    } catch (err) {
      return new Response(JSON.stringify({ error: 'bad_request', message: 'invalid json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const maxRequests = Number(payload.maxRequests) || 50;
    const windowMs = Number(payload.windowMs) || 30000;

    // Читаем состояние
    let st = (await this.state.storage.get('st')) || { count: 0, resetAt: 0 };

    // Если окно истекло или resetAt пустой -> сбрасываем
    if (!st.resetAt || now > st.resetAt) {
      st.count = 0;
      st.resetAt = now + windowMs;
    }

    // Обеспечим числовой тип для count
    st.count = typeof st.count === 'number' ? st.count : 0;

    if (payload.action === 'hit') {
      st.count += 1;
      await this.state.storage.put('st', st);
      console.log('[RateLimitDO] hit', { count: st.count, resetAt: new Date(st.resetAt).toISOString() });
    } else if (payload.action === 'reset') {
      st = { count: 0, resetAt: now + windowMs };
      await this.state.storage.put('st', st);
      console.log('[RateLimitDO] reset action performed');
    } else if (payload.action === 'get') {
      // только чтение, ничего не делаем
      console.log('[RateLimitDO] get', { count: st.count, resetAt: new Date(st.resetAt).toISOString() });
    } else {
      return new Response(JSON.stringify({ error: 'bad_request', message: 'unknown action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const allowed = st.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - st.count);

    const body = {
      allowed,
      count: st.count,
      remaining,
      resetAt: st.resetAt
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // alarm/ensureAlarm intentionally omitted — вернуть позже при необходимости
}