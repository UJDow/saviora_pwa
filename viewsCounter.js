// worker/src/utils/viewsCounter.js
export async function incrementView(env, dreamId) {
  if (!dreamId) {
    console.error('[incrementView] dreamId is required');
    return false;
  }

  try {
    // Используем один DO instance для всех просмотров
    const id = env.RATE_LIMIT_DO.idFromName('views-counter');
    const obj = env.RATE_LIMIT_DO.get(id);

    const res = await obj.fetch('https://rate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'increment_view', 
        dreamId: String(dreamId) 
      }),
    });

    if (!res.ok) {
      console.error('[incrementView] DO returned error:', res.status);
      return false;
    }

    const data = await res.json();
    return data.success || false;
  } catch (error) {
    console.error('[incrementView] Error calling DO:', error);
    return false;
  }
}
