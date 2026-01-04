export class RateLimitDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

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

    const maxRequests = Number(payload.maxRequests) || 50; // default 50
    const windowMs = Number(payload.windowMs) || 30000; // default 30s

    // Безопасно пробуем установить alarm (ошибки не должны прерывать обработку)
    try {
      await this.ensureAlarm();
    } catch (err) {
      console.warn('[RateLimitDO] fetch: ensureAlarm failed (ignored)', err);
    }

    // Получаем состояние
    let st = (await this.state.storage.get('st')) || { count: 0, resetAt: 0 };

    // Если окно истекло — сбросить и задать новое resetAt
    if (now > st.resetAt) {
      st.count = 0;
      st.resetAt = now + windowMs;
    }

    // Если запись устарела (resetAt + буфер), удаляем её
    const DELETE_AFTER_MS = 60 * 60 * 1000; // 1 час после resetAt
    if (st.resetAt && now > (st.resetAt + DELETE_AFTER_MS)) {
      await this.state.storage.delete('st');
      st = { count: 0, resetAt: now + windowMs };
      console.log('[RateLimitDO] fetch: deleted stale state during request');
    }

    // Обработка действий
    if (payload.action === 'hit') {
      st.count = (typeof st.count === 'number' ? st.count : 0) + 1;
      await this.state.storage.put('st', st);
    } else if (payload.action === 'reset') {
      st = { count: 0, resetAt: now + windowMs };
      await this.state.storage.put('st', st);
    } // 'get' — ничего не меняем

    const allowed = st.count <= maxRequests;
    const body = {
      allowed,
      count: st.count,
      remaining: Math.max(0, maxRequests - st.count),
      resetAt: st.resetAt
    };

    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }});
  }

  // Обработчик alarm — вызывается по расписанию
  async alarm() {
    const now = Date.now();
    const st = await this.state.storage.get('st');
    if (st) {
      const DELETE_AFTER_MS = 60 * 60 * 1000; // 1 час
      if (now > (st.resetAt + DELETE_AFTER_MS)) {
        await this.state.storage.delete('st');
        console.log('[RateLimitDO] alarm: deleted stale state');
      } else {
        console.log('[RateLimitDO] alarm: state not stale', st);
      }
    } else {
      console.log('[RateLimitDO] alarm: no state to clean');
    }

    // Ставим следующий alarm через 1 час
    const NEXT_MS = 60 * 60 * 1000; // 1 час
    await this.state.setAlarm(Date.now() + NEXT_MS);
    console.log('[RateLimitDO] alarm: next alarm set for', new Date(Date.now() + NEXT_MS).toISOString());
  }

  // Надёжная реализация ensureAlarm: ставим alarm и логируем ошибки — без проверки getAlarm()
  async ensureAlarm() {
    try {
      const NEXT_MS = 60 * 60 * 1000; // 1 час
      await this.state.setAlarm(Date.now() + NEXT_MS);
      console.log('[RateLimitDO] ensureAlarm: alarm set for', new Date(Date.now() + NEXT_MS).toISOString());
    } catch (err) {
      // Не прерываем основной поток — логируем и идём дальше
      console.warn('[RateLimitDO] ensureAlarm: failed to set alarm', err);
    }
  }
}