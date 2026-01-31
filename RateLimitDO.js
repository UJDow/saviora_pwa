// worker/src/durableObjects/RateLimitDO.js
export class RateLimitDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    
    // ✨ Инициализируем буфер просмотров и запускаем периодический flush
    this.state.blockConcurrencyWhile(async () => {
      // Загружаем буфер из storage (если был сохранён)
      this.viewsBuffer = (await this.state.storage.get('viewsBuffer')) || new Map();
      
      // Запускаем периодический flush каждую минуту
      this.flushInterval = setInterval(() => this.flushViews(), 60000);
    });
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

    // ✨ Обработка просмотров
    if (payload.action === 'increment_view') {
      return this.handleViewIncrement(payload);
    }

    // Существующая логика rate limiting
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

  // ✨ Новый метод для инкремента просмотров
  async handleViewIncrement(payload) {
    const { dreamId } = payload;

    if (!dreamId) {
      return new Response(
        JSON.stringify({ error: 'bad_request', message: 'dreamId required' }), 
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Получаем текущее значение из буфера
    const current = this.viewsBuffer.get(dreamId) || 0;
    this.viewsBuffer.set(dreamId, current + 1);

    // Сохраняем буфер в storage (для персистентности между рестартами)
    await this.state.storage.put('viewsBuffer', this.viewsBuffer);

    console.log(`[RateLimitDO] view incremented for dream ${dreamId}, buffered count: ${current + 1}`);

    return new Response(
      JSON.stringify({
        success: true,
        count: current + 1,
        bufferSize: this.viewsBuffer.size,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ✨ Периодическая запись буфера в D1
  async flushViews() {
    if (!this.viewsBuffer || this.viewsBuffer.size === 0) {
      return;
    }

    const batch = Array.from(this.viewsBuffer.entries());
    this.viewsBuffer.clear();

    console.log(`[RateLimitDO] Flushing ${batch.length} view counts to D1...`);

    try {
      // Батчевое обновление D1
      const statements = batch.map(([dreamId, count]) =>
        this.env.DB.prepare(
          'UPDATE dreams SET views_count = views_count + ? WHERE id = ?'
        ).bind(count, dreamId)
      );

      const results = await this.env.DB.batch(statements);
      
      // Очищаем буфер в storage после успешной записи
      await this.state.storage.put('viewsBuffer', this.viewsBuffer);
      
      console.log(`[RateLimitDO] Successfully flushed ${batch.length} view counts to D1`);
    } catch (error) {
      console.error('[RateLimitDO] Failed to flush views to D1:', error);
      
      // Возвращаем обратно в буфер при ошибке
      batch.forEach(([dreamId, count]) => {
        const current = this.viewsBuffer.get(dreamId) || 0;
        this.viewsBuffer.set(dreamId, current + count);
      });
      
      // Сохраняем восстановленный буфер
      await this.state.storage.put('viewsBuffer', this.viewsBuffer);
      
      console.log(`[RateLimitDO] Views returned to buffer for retry`);
    }
  }
}
