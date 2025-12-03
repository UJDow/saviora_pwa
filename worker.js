// --- CORS настройка ---
const allowedOrigins = [
  'https://sakovvolfsnitko-e6deet01q-alexandr-snitkos-projects.vercel.app',
  'https://sakovvolfsnitko.vercel.app',
  'https://saviorasn.vercel.app',
  'https://saviorasn-alexandr-snitkos-projects.vercel.app',
  'https://vercel.com/alexandr-snitkos-projects/saviora.app/deployments',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const VALID_AVATAR_ICONS = [
  'Pets','Cloud','NightsStay','Psychology','AutoAwesome','EmojiNature',
  'WaterDrop','LocalFlorist','AcUnit','Bedtime','Palette','Circle'
];

const CACHE_TTL = 60 * 1000;
const SUMMARY_UPDATE_THRESHOLD = 6; // Обновляем rolling summary каждые 6 новых сообщений

function normalizeOrigin(o) {
  if (!o) return '';
  return o.endsWith('/') ? o.slice(0, -1) : o;
}

function buildCorsHeaders(origin) {
  const norm = normalizeOrigin(origin || '');
  const base = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };

  if (!origin) {
    return base;
  }

  if (allowedOrigins.includes(norm)) {
    base['Access-Control-Allow-Origin'] = norm;
    base['Access-Control-Allow-Credentials'] = 'true';
  } else {
    console.warn('[CORS] origin not in whitelist:', origin);
  }

  return base;
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
  const userKey = `user:${email}`;
  const userRaw = await env.USERS_KV.get(userKey);
  if (!userRaw) return false;

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return false;
  }

  const now = Date.now();
  const trialPeriod = 365 * 24 * 60 * 60 * 1000; // 1 год в миллисекундах
  return (now - user.created) < trialPeriod;
}

// --- СИСТЕМНЫЕ ПРОМПТЫ ---

const DIALOG_SYSTEM_PROMPT = `Ты — фрейдистский аналитик снов, работающий в парадигме сверхдетерминации. Каждый элемент сна (образ, число, часть тела) имеет множество взаимосвязанных значений, скрывающих вытеснённые желания и травмы. Твоя задача — раскрывать эти слои, не ограничиваясь одним толкованием.

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

Начни анализ, соблюдая все правила. Первый вопрос задай о самом ярком образе.`;

const BLOCK_INTERPRETATION_PROMPT = `Составь итоговое толкование этого блока сновидения (3–6 предложений), используя rolling summary и сам текст блока.
Не продолжай диалог, а выдай итоговое толкование блока на основе всей информации выше.
Свяжи общие мотивы: части тела, числа/цифры, запретные импульсы, детские переживания.
Не повторяй и не цитируй текст блока, не пересказывай его дословно. Не задавай вопросов.
Интерпретируй образы, чувства и скрытые мотивы, которые могут стоять за этим фрагментом сна.
Избегай любых психоаналитических понятий и специальных терминов.
Выведи только чистый текст без заголовков, без кода и без тегов.`;

const FINAL_INTERPRETATION_PROMPT = `Составь итоговое толкование всего сна (5–6 предложений), используя rolling summary по блокам и весь текст сна.
Не продолжай диалог, а выдай итоговое толкование на основе всей информации выше.
Свяжи общие мотивы: части тела, числа/цифры, запретные импульсы, детские переживания.
Не повторяй и не цитируй текст сна, не пересказывай его дословно. Не задавай вопросов.
Интерпретируй образы, чувства и скрытые мотивы, которые могут стоять за этим сном.
Избегай любых психоаналитических понятий и специальных терминов.
Выведи только чистый текст без заголовков, без кода и без тегов.`;

const SUMMARY_UPDATE_PROMPT = `Ты — ассистент, который сжимает диалоги для сохранения контекста.

ЗАДАЧА: Обнови резюме диалога, добавив ключевые моменты из новых сообщений.

ЧТО СОХРАНЯТЬ:
- Ассоциации пользователя с символами
- Эмоции и чувства
- Контекст из жизни (работа, отношения, события)
- Важные детали и воспоминания
- Инсайты и выводы

ЧТО УБИРАТЬ:
- Повторы
- Общие фразы
- Технические моменты диалога

СТИЛЬ:
- Краткое резюме (макс. 300 слов)
- Структурированно, но естественно
- От третьего лица ("Пользователь рассказал, что...")

ПРИМЕР:
"Пользователь рассказал, что красный цвет ассоциируется у него с детством и чувством тревоги. Упомянул конфликт с матерью 2 года назад. Дом во сне напоминает квартиру бабушки, где он чувствовал себя в безопасности. Отметил, что сейчас переживает похожую ситуацию на работе — чувствует давление от начальника."`;

const ARTDIALOG_SYSTEM_PROMPT = `Ты — внимательный куратор/проводник по произведениям искусства, помогающий пользователю исследовать, почему найденное произведение резонирует с его сновидением. Твоя задача — помогать пользователю раскрыть детали сходства и указать, что именно он может найти близкого себе в этом произведении — эмоции, мотивы, формальные приёмы, композиционные решения, темы, культурные или биографические коннотации.

Правила поведения:
1. Центр разговора — пользователь: ориентируй все замечания на субъективный опыт ("что ты можешь заметить/почувствовать", "на что обратить внимание"), не навязывай интерпретаций.
2. Не спойль: если обсуждение требует раскрытия ключевых сюжетных поворотов, сначала спроси разрешение: коротко предложи опцию "Показать спойлер/Без спойлера". Пока нет разрешения — избегай указания явных сюжетных концовок и ключевых поворотов.
3. Фокус на конкретике: указывай конкретные элементы произведения, которые соответствуют образам сна (цвет, свет, поза, повторяющийся мотив, звук/музыка, архитектура, отношения персонажей, символы). Приводи примеры того, что посмотреть в сценах/главе/кадре, но без раскрытия ключевых финалов.
4. Личное резонирование: всегда задавай как минимум один открытый вопрос, помогающий пользователю соотнести образ из сна и элемент произведения (например: "Какая деталь этой сцены вызывает у тебя ту же эмоцию, что и в сне?").
5. Один вопрос за раз: не задавай более одного вопроса в одном сообщении.
6. Предлагай способы исследования: короткие действия (посмотреть кадр X, прочитать абзац Y, послушать фрагмент музыки Z), пометки на что смотреть/слушать, либо мелкие задания для заметок (написать 1–2 предложения о том, что сбивает/притягивает).
7. Поддерживай тон: теплый, аккуратный, ненавязчивый — как гид, а не критик. Избегай категоричных утверждений о том, что "сон позаимствован" — вместо этого формулируй: "есть явные сюжеты/мотивы, которые перекликаются".
8. При возможности отмечай формальные параллели (ритм, композиция, повторы, контраст, цветовая палитра) и содержательные (тема утраты, вины, поиска, спасения и т.д.).
9. При необходимости используй квадратные скобки для примеров вариантов (например: [семья / работа / детство]), но не навязывай их.
10. Если пользователь хочет — предложи безопасные, краткие ссылки или понятную подсказку, где найти произведение без спойлеров (например: "посмотри 3–ю сцену, первые 2 минуты") — только с его разрешения.

Формат контента:
- Пиши коротко, одно сообщение = одно действие/вопрос/наблюдение.
- Если даёшь рекомендацию (например, "посмотри сцену X"), добавляй, почему именно это важно для сравнения со сном (1 предложение).
- Не используй академические термины и не делай окончательных психоаналитических выводов — задавай вопросы и предлагай наблюдения.`;

// --- DAILY PROMPTS ---

const DAILY_CHAT_SYSTEM_PROMPT = `Ты — дружелюбный и поддерживающий собеседник для ежедневного разговора. 
Фокусируйся на настоящем и недавних событиях пользователя — что он делал, заметил, почувствовал, чему научился или хочет запомнить. 
Избегай психоаналитического и клинического языка. Задавай простые, открытые и конкретные вопросы, чтобы пользователь мог быстро ответить.

Если пользователь делится событием, ответь:
- Кратко поддержи (1 предложение).
- Кратко резюмируй (1–2 предложения).
- Задай один конкретный вопрос или предложи небольшое действие (одно предложение).

При возможности приглашай к описанию ощущений (что видел, слышал, чувствовал), проверяй настроение (одно слово или шкала), предлагай маленький следующий шаг (растяжка, прогулка, благодарность и т.п.). Тон — теплый и практичный. Если пользователь просит конфиденциальность или резюме — уважай и предложи краткий итог или подтверждение отказа.`;

const DAILY_ARTWORK_PROMPT = `Ты создаешь описание для генерации изображения, вдохновленного моментом из дня. 
Вход: краткое описание, настроение, предпочтения по цветам и стилю (опционально). 
Выход: JSON с полями:
{
  "image_prompt": "описание для генератора изображений, 1–2 предложения, с акцентом на цвета, свет, композицию, атмосферу",
  "tags": ["тег1", "тег2", "тег3"]
}

Язык — описательный, сенсорный, без символизма и метафор. Вывод — только JSON.`;

// --- INTERPRETATION PROMPTS ---

const BLOCK_INTERPRETATION_PROMPT_DAILY = `
Проанализируй один блок диалога между пользователем и ассистентом. Ответь на русском языке в формате JSON:

{
  "summary": "Краткое содержание того, о чём говорилось в этом блоке (1–2 предложения)",
  "emotions": ["эмоция1", "эмоция2"],
  "themes": ["тема1", "тема2"],
  "insights": ["инсайт1", "инсайт2"],
  "suggestions": ["что можно обсудить дальше", "возможное действие"]
}
`;

const FINAL_INTERPRETATION_PROMPT_DAILY = `
Проанализируй всю историю диалога между пользователем и ассистентом. Ответь на русском языке в формате JSON:

{
  "overall_summary": "Общее содержание всех блоков (2–3 предложения)",
  "main_themes": ["основная тема1", "основная тема2"],
  "emotional_dynamics": ["эмоция1", "эмоция2"],
  "progression": "Как развивалась тема или настроение во времени?",
  "key_insights": ["ключевой инсайт1", "ключевой инсайт2"],
  "recommendations": ["что рекомендуется обсудить в будущем", "возможные действия"]
}
`;

const ART_BLOCK_INTERPRETATION_PROMPT = `
Проанализируй блок диалога, связанный с арт-произведением. Ответь на русском языке в формате JSON:

{
  "visual_summary": "Что изображено в арт-объекте? (1–2 предложения)",
  "emotional_response": "Какие эмоции вызывает изображение?",
  "symbolism": ["символ1", "символ2"],
  "connection_to_user": "Как изображение связано с опытом пользователя?",
  "interpretation": "Что это может значить в контексте разговора?"
}
`;

const ART_FINAL_INTERPRETATION_PROMPT = `
Проанализируй серию арт-диалогов. Ответь на русском языке в формате JSON:

{
  "visual_evolution": "Как менялись образы и темы в арт-диалогах?",
  "emotional_arc": "Как менялось настроение?",
  "recurring_motifs": ["мотив1", "мотив2"],
  "personal_meanings": ["значение1", "значение2"],
  "creative_direction": "Какие направления в творчестве или самовыражении проявляются?"
}
`;

// --- Функции для работы с rolling summary ---

// Получить summary с количеством обработанных сообщений
async function getRollingSummary(env, userEmail, dreamId, blockId) {
  const stmt = env.DB.prepare(
    'SELECT summary, last_message_count FROM dialog_summaries WHERE user = ? AND dream_id = ? AND block_id = ?'
  );
  const row = await stmt.bind(userEmail, dreamId, blockId).first();
  return row ? { 
    summary: row.summary, 
    lastMessageCount: row.last_message_count || 0 
  } : null;
}

// Сохранить summary с количеством обработанных сообщений
// --- Сохранить summary с количеством обработанных сообщений ---
async function saveRollingSummary(env, userEmail, dreamId, blockId, summaryText, messageCount) {
  const id = crypto.randomUUID();
  const now = Date.now();

  console.log('[saveRollingSummary] Saving:', { 
    userEmail, 
    dreamId, 
    blockId, 
    messageCount,
    summaryLength: summaryText?.length || 0
  });

  try {
    const stmt = env.DB.prepare(`
      INSERT INTO dialog_summaries (id, user, dream_id, block_id, summary, last_message_count, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user, dream_id, block_id) DO UPDATE SET 
        summary = excluded.summary, 
        last_message_count = excluded.last_message_count,
        updated_at = excluded.updated_at
    `);
  
    const result = await stmt.bind(
      id, userEmail, dreamId, blockId, summaryText, messageCount, now
    ).run();
  
    console.log('[saveRollingSummary] Success:', result);
    return result;
  } catch (e) {
    console.error('[saveRollingSummary] ERROR:', e);
    throw e;
  }
}

// Обновить rolling summary
// --- Обновить rolling summary ---
async function updateRollingSummary(env, userEmail, dreamId, blockId, blockText, deepseekApiKey) {
  console.log('[updateRollingSummary] START:', { userEmail, dreamId, blockId });

  const d1 = env.DB;

  // 1. Получаем текущий summary
  const currentSummary = await getRollingSummary(env, userEmail, dreamId, blockId);
  const lastMessageCount = currentSummary?.lastMessageCount || 0;

  console.log('[updateRollingSummary] Current state:', { 
    hasSummary: !!currentSummary?.summary, 
    lastMessageCount 
  });

  // 2. Получаем все сообщения
  const allMessagesRes = await d1.prepare(
    `SELECT role, content FROM messages
     WHERE user = ? AND dream_id = ? AND block_id = ?
     ORDER BY created_at ASC`
  ).bind(userEmail, dreamId, blockId).all();

  const allMessages = allMessagesRes.results || [];
  const newMessageCount = allMessages.length - lastMessageCount;

  console.log('[updateRollingSummary] Messages:', { 
    total: allMessages.length, 
    new: newMessageCount 
  });

  // 3. Проверяем, нужно ли обновлять
  if (newMessageCount < SUMMARY_UPDATE_THRESHOLD && currentSummary?.summary) {
    console.log('[updateRollingSummary] Threshold not reached, skipping');
    return currentSummary.summary;
  }

  // 4. Берём только новые сообщения
  const newMessages = allMessages.slice(lastMessageCount);

  // 5. Формируем промпт
  const prompt = currentSummary?.summary 
    ? `
      ${SUMMARY_UPDATE_PROMPT}
    
      ФРАГМЕНТ СНОВИДЕНИЯ:
      ${blockText.slice(0, 2000)}
    
      ПРЕДЫДУЩЕЕ РЕЗЮМЕ ДИАЛОГА:
      ${currentSummary.summary}
    
      НОВЫЕ СООБЩЕНИЯ:
      ${newMessages.map(m => `${m.role}: ${m.content}`).join('\n')}
    
      Обнови резюме, добавив ключевые моменты из новых сообщений.
    `
    : `
      ${SUMMARY_UPDATE_PROMPT}
    
      ФРАГМЕНТ СНОВИДЕНИЯ:
      ${blockText.slice(0, 2000)}
    
      СООБЩЕНИЯ ДИАЛОГА:
      ${newMessages.map(m => `${m.role}: ${m.content}`).join('\n')}
    
      Создай краткое резюме этого диалога.
    `;

  console.log('[updateRollingSummary] Calling DeepSeek...');

  // 6. Вызываем DeepSeek
  const deepseekRequestBody = {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0.3,
    stream: false
  };

  const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekApiKey}`
    },
    body: JSON.stringify(deepseekRequestBody)
  });

  const responseBody = await deepseekResponse.json();
  const updatedSummary = responseBody?.choices?.[0]?.message?.content || currentSummary?.summary || '';

  console.log('[updateRollingSummary] DeepSeek response length:', updatedSummary.length);

  // 7. Сохраняем обновлённый summary
  console.log('[updateRollingSummary] Saving summary, message count:', allMessages.length);
  await saveRollingSummary(env, userEmail, dreamId, blockId, updatedSummary, allMessages.length);

  console.log('[updateRollingSummary] DONE');
  return updatedSummary;
}

async function getUnprocessedMessages(env, userEmail, dreamId, blockId) {
  // Получаем summary
  const summaryRow = await env.DB.prepare(
    `SELECT summary, last_message_count FROM dialog_summaries 
     WHERE user = ? AND dream_id = ? AND block_id = ?`
  ).bind(userEmail, dreamId, blockId).first();

  const lastProcessed = summaryRow?.last_message_count || 0;

  // Получаем все сообщения
  const unprocessedRows = await env.DB.prepare(
    `SELECT role, content FROM messages 
     WHERE user = ? AND dream_id = ? AND block_id = ? 
     ORDER BY created_at ASC`
  ).bind(userEmail, dreamId, blockId).all();

  const allMessages = unprocessedRows.results || [];

  // Берём только необработанные
  const unprocessed = allMessages.slice(lastProcessed);

  return {
    rollingSummary: summaryRow?.summary || '',
    unprocessedMessages: unprocessed,
    totalCount: allMessages.length
  };
}

async function toggleMessageArtworkInsight(env, { dreamId, messageId, liked, userEmail }) {
  const statement = env.DB.prepare(`
    UPDATE messages
    SET meta = json_set(COALESCE(meta, '{}'), '$.insightArtworksLiked', ?)
    WHERE id = ? AND dream_id = ? AND user = ?
  `);

  const { success } = await statement.bind(liked ? 1 : 0, messageId, dreamId, userEmail).run();
  if (!success) throw new Error('Не удалось обновить инсайт по artwork');

  const { results } = await env.DB
    .prepare(`
      SELECT id, role, content, meta, created_at
      FROM messages
      WHERE id = ? AND dream_id = ? AND user = ?
    `)
    .bind(messageId, dreamId, userEmail)
    .all();

  return results?.[0] ?? null;
}

async function toggleMessageInsight(env, { dreamId, messageId, liked, userEmail }) {
  const statement = env.DB.prepare(`
    UPDATE messages
    SET meta = json_set(COALESCE(meta, '{}'), '$.insightLiked', ?)
    WHERE id = ? AND dream_id = ? AND user = ?
  `);

  const { success } = await statement.bind(liked ? 1 : 0, messageId, dreamId, userEmail).run();
  if (!success) throw new Error('Не удалось обновить инсайт');

  const { results } = await env.DB
    .prepare(`
      SELECT id, role, content, meta, created_at
      FROM messages
      WHERE id = ? AND dream_id = ? AND user = ?
    `)
    .bind(messageId, dreamId, userEmail)
    .all();

  return results?.[0] ?? null;
}

// --- INTERPRETATION FUNCTIONS ---

async function interpretBlock(env, blockText, blockType = 'dialog') {
  let prompt;
  if (blockType === 'art') {
    prompt = ART_BLOCK_INTERPRETATION_PROMPT;
  } else {
    prompt = BLOCK_INTERPRETATION_PROMPT_DAILY;
  }

  const deepseekRequestBody = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: blockText }
    ],
    max_tokens: 500,
    temperature: 0.5,
    stream: false
  };

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(deepseekRequestBody)
  });

  const json = await res.json();
  let content = json.choices?.[0]?.message?.content || '{}';
  content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function interpretFinal(env, notesText, blockType = 'dialog') {
  let prompt;
  if (blockType === 'art') {
    prompt = ART_FINAL_INTERPRETATION_PROMPT;
  } else {
    prompt = FINAL_INTERPRETATION_PROMPT_DAILY;
  }

  const deepseekRequestBody = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: notesText }
    ],
    max_tokens: 800,
    temperature: 0.7,
    stream: false
  };

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(deepseekRequestBody)
  });

  const json = await res.json();
  let content = json.choices?.[0]?.message?.content || '{}';
  content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// --- HELPERS FOR DAILY CONVOS INSIGHTS ---
// Вставить рядом с toggleMessageInsight/toggleMessageArtworkInsight

async function toggleDailyMessageInsight(env, { dailyConvoId, messageId, liked, userEmail }) {
  const statement = env.DB.prepare(`
    UPDATE messages
    SET meta = json_set(COALESCE(meta, '{}'), '$.insightLiked', ?)
    WHERE id = ? AND dream_id = ? AND user = ?
  `);

  const { success } = await statement.bind(liked ? 1 : 0, messageId, dailyConvoId, userEmail).run();
  if (!success) throw new Error('Не удалось обновить инсайт (daily)');
  const { results } = await env.DB.prepare(`
    SELECT id, role, content, meta, created_at
    FROM messages
    WHERE id = ? AND dream_id = ? AND user = ?
  `).bind(messageId, dailyConvoId, userEmail).all();

  return results?.[0] ?? null;
}

async function toggleDailyMessageArtworkInsight(env, { dailyConvoId, messageId, liked, userEmail }) {
  const statement = env.DB.prepare(`
    UPDATE messages
    SET meta = json_set(COALESCE(meta, '{}'), '$.insightArtworksLiked', ?)
    WHERE id = ? AND dream_id = ? AND user = ?
  `);

  const { success } = await statement.bind(liked ? 1 : 0, messageId, dailyConvoId, userEmail).run();
  if (!success) throw new Error('Не удалось обновить арт-инсайт (daily)');
  const { results } = await env.DB.prepare(`
    SELECT id, role, content, meta, created_at
    FROM messages
    WHERE id = ? AND dream_id = ? AND user = ?
  `).bind(messageId, dailyConvoId, userEmail).all();

  return results?.[0] ?? null;
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

// ===== Avatar helpers (вставить перед export default) =====
const avatar_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const avatar_MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const avatar_ALLOWED_ICONS = VALID_AVATAR_ICONS || []; // fallback на существующий список

function avatar_buildCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  return buildCorsHeaders(origin);
}

async function avatar_extractEmailFromBearer(request, env) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload?.email) return null;

  // Validate tokenVersion against USERS_KV (как в getUserEmail)
  try {
    const userRaw = await env.USERS_KV.get(`user:${payload.email}`);
    if (!userRaw) return null;
    const user = JSON.parse(userRaw);
    const currentTv = user.tokenVersion ?? 0;
    if (typeof payload.tv !== 'number' || payload.tv !== currentTv) return null;
    return payload.email;
  } catch (e) {
    console.warn('avatar_extractEmailFromBearer error:', e);
    return null;
  }
}

function avatar_generateKey(userEmail, fileType) {
  const ext = (fileType.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const ts = Date.now();
  // Используем UUID + часть рандома для уникальности
  const uuid = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${ts}-${Math.random().toString(36).slice(2,10)}`;
  // НЕ добавляем префикс 'avatars/' в сам ключ — ключ будет совпадать с тем, что ожидает /avatars/:key
  return `${encodeURIComponent(userEmail)}-${ts}-${uuid}.${ext}`;
}

async function avatar_handleUpload(request, env) {
  const corsHeaders = avatar_buildCorsHeaders(request);

  const userEmail = await avatar_extractEmailFromBearer(request, env);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized', message: 'Invalid or missing token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'invalid_content_type', message: 'Expected multipart/form-data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'invalid_form', message: 'Cannot parse form-data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const file = form.get('file');
  if (!file || !(file instanceof Blob)) {
    return new Response(JSON.stringify({ error: 'no_file', message: 'field "file" is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (!avatar_ALLOWED_TYPES.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'unsupported_file_type', message: `Allowed: ${avatar_ALLOWED_TYPES.join(', ')}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  if (file.size > avatar_MAX_SIZE) {
    return new Response(JSON.stringify({ error: 'file_too_large', message: 'Max 2MB' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    // Получаем текущего пользователя из БД (для удаления старого аватара)
    const curRow = await env.DB.prepare('SELECT avatar_image_url FROM users WHERE email = ?').bind(userEmail).first();
    if (curRow && curRow.avatar_image_url) {
      try {
        const oldUrl = curRow.avatar_image_url;
        try {
          const parsed = new URL(oldUrl);
          const oldKey = parsed.pathname.replace(/^\/avatars\//, '');
          if (oldKey) {
            await env.AVATARS.delete(oldKey);
          }
        } catch (e) {
          // если oldUrl не парсится — игнорируем
          console.warn('avatar_handleUpload: could not parse old avatar url', e);
        }
      } catch (e) {
        console.warn('avatar_handleUpload: failed to delete old avatar (ignored)', e);
      }
    }

    // Генерация ключа и заливка
    const key = avatar_generateKey(userEmail, file.type); // НЕ содержит 'avatars/' префикса
    await env.AVATARS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const origin = new URL(request.url).origin;
    const publicUrl = `${origin}/avatars/${encodeURIComponent(key)}`;

    // Обновляем users.avatar_image_url в DB
    await env.DB.prepare('UPDATE users SET avatar_image_url = ? WHERE email = ?').bind(publicUrl, userEmail).run();

    // Возвращаем обновлённую запись пользователя
    const updatedUser = await env.DB.prepare(
      'SELECT id, email, name, avatar_icon, avatar_image_url, created_at FROM users WHERE email = ?'
    ).bind(userEmail).first();

    return new Response(JSON.stringify({ ok: true, user: updatedUser }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (e) {
    console.error('avatar_handleUpload error:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e?.message || 'Upload failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

async function avatar_handleServe(request, env) {
  const corsHeaders = avatar_buildCorsHeaders(request);
  const pathname = new URL(request.url).pathname;
  const key = pathname.replace(/^\/avatars\//, '');
  if (!key) {
    return new Response('Not Found', { status: 404, headers: { ...corsHeaders } });
  }

  try {
    const object = await env.AVATARS.get(decodeURIComponent(key));
    if (!object) {
      return new Response('Not Found', { status: 404, headers: { ...corsHeaders } });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    // merge cors headers (buildCorsHeaders returns plain object)
    Object.entries(avatar_buildCorsHeaders(request)).forEach(([k, v]) => headers.set(k, v));

    // object.body is a ReadableStream
    return new Response(object.body, { status: 200, headers });
  } catch (e) {
    console.error('avatar_handleServe error:', e);
    return new Response('Internal Error', { status: 500, headers: { ...corsHeaders } });
  }
}
// ===== end Avatar helpers =====

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/me/avatar/upload' && request.method === 'POST') {
      return avatar_handleUpload(request, env);
    }
    if (url.pathname.startsWith('/avatars/') && request.method === 'GET') {
      return avatar_handleServe(request, env);
    }
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = buildCorsHeaders(origin);
    const pathParts = url.pathname.split('/').filter(Boolean);

    const JWT_SECRET = env.JWT_SECRET;

    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not set');
      return new Response(JSON.stringify({ error: 'server_misconfigured', message: 'JWT_SECRET is not set' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (request.method === 'OPTIONS') {
  const origin = request.headers.get('Origin') || '';
  const cors = buildCorsHeaders(origin);
  return new Response(null, { status: 204, headers: cors });
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
      const trialPeriod = 365 * 24 * 60 * 60 * 1000;
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

    // --- GET /me (заменить существующий блок) ---
if (url.pathname === '/me' && request.method === 'GET') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Берём метаданные из KV (регистрация, password и т.д.)
  const userRaw = await env.USERS_KV.get(`user:${userEmail}`);
  if (!userRaw) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  let kvUser = {};
  try { kvUser = JSON.parse(userRaw); } catch (e) { kvUser = {}; }

  // Берём дополнительные поля из D1 (если есть)
  const userRow = await env.DB.prepare(
    'SELECT name, avatar_icon, avatar_image_url, created_at FROM users WHERE email = ?'
  ).bind(userEmail).first();

  const name = userRow?.name ?? kvUser.name ?? null;
  const avatar_icon = userRow?.avatar_icon ?? kvUser.avatar_icon ?? null;
  const avatar_image_url = userRow?.avatar_image_url ?? kvUser.avatar_image_url ?? null;

  // Нормализуем created timestamp (KV хранит ms number, D1 может хранить ISO)
  const createdSrc = kvUser.created ?? userRow?.created_at ?? Date.now();
  const created = typeof createdSrc === 'number' ? createdSrc : (new Date(createdSrc).getTime() || Date.now());

  const now = Date.now();
  const trialPeriod = 365 * 24 * 60 * 60 * 1000;
  const msLeft = (created || now) + trialPeriod - now;
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

  return new Response(JSON.stringify({
    email: userEmail,
    created,
    trialEndsAt: (created || now) + trialPeriod,
    trialDaysLeft: daysLeft,
    name,
    avatar_icon,
    avatarIcon: avatar_icon,             // alias для фронтенда
    avatar_image_url,
    avatarImageUrl: avatar_image_url     // alias
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// --- MOODS API (multi-user) ---

    // Получить настроение за день
    if (url.pathname.endsWith('/moods') && request.method === 'GET') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const date = url.searchParams.get('date');
      if (!date) {
        return new Response(JSON.stringify({ error: 'date required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const row = await env.DB.prepare(
          'SELECT context FROM moods WHERE user_email = ? AND date = ?'
        ).bind(userEmail, date).first();
        return new Response(JSON.stringify({ context: row?.context ?? null }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        console.error('[MOODS] GET error:', e);
        return new Response(JSON.stringify({ error: 'database_error' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Установить/обновить настроение за день
    if (url.pathname.endsWith('/moods') && request.method === 'PUT') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      let body;
      try { body = await request.json(); } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const { date, context } = body;
      if (!date || !context) {
        return new Response(JSON.stringify({ error: 'date and context required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        // Используем INSERT OR REPLACE для совместимости с текущей структурой
        await env.DB.prepare(
          `INSERT OR REPLACE INTO moods (user_email, date, context, updated_at) 
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(userEmail, date, context).run();
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        console.error('[MOODS] PUT error:', e);
        return new Response(JSON.stringify({ error: 'database_error' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // Получить все настроения за месяц
    if (url.pathname.endsWith('/moods/month') && request.method === 'GET') {
      const userEmail = await getUserEmail(request);
      if (!userEmail) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const year = url.searchParams.get('year');
      const month = url.searchParams.get('month');
      if (!year || !month) {
        return new Response(JSON.stringify({ error: 'year and month required' }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      try {
        const monthStr = String(month).padStart(2, '0');
        const rows = await env.DB.prepare(
          'SELECT date, context FROM moods WHERE user_email = ? AND date LIKE ?'
        ).bind(userEmail, `${year}-${monthStr}-%`).all();
        return new Response(JSON.stringify({ moods: rows.results }), {
          status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (e) {
        console.error('[MOODS] GET /month error:', e);
        return new Response(JSON.stringify({ error: 'database_error' }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
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
      const date = Date.now();

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

    if (request.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'dreams') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const id = pathParts[1];
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing dream id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const d1 = env.DB;
    const row = await d1
      .prepare('SELECT * FROM dreams WHERE id = ? AND user = ?')
      .bind(id, userEmail)
      .first();

    if (!row) {
      return new Response(JSON.stringify({ error: 'Dream not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('Error fetching dream:', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
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

    // PUT /dreams/:dreamId/messages/:messageId/artwork_like
// pathParts example: ['dreams', '<dreamId>', 'messages', '<messageId>', 'artwork_like'] -> length === 5
if (request.method === 'PUT' && pathParts.length === 5 && pathParts[0] === 'dreams' && pathParts[2] === 'messages' && pathParts[4] === 'artwork_like') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }

  const dreamId = pathParts[1];
  const messageId = pathParts[3];

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }

  const { liked } = body || {};
  if (typeof liked !== 'boolean') {
    return new Response(JSON.stringify({ error: 'liked must be boolean' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }

  try {
    const message = await toggleMessageArtworkInsight(env, {
      dreamId,
      messageId,
      liked,
      userEmail
    });
    if (!message) {
      return new Response(JSON.stringify({ error: 'Сообщение не найдено' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    }

    return new Response(JSON.stringify({
      id: message.id,
      role: message.role,
      content: message.content,
      meta: message.meta ? JSON.parse(message.meta) : {},
      createdAt: message.created_at
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  } catch (err) {
    console.error('toggle artwork like error', err);
    return new Response(JSON.stringify({ error: 'Не удалось сохранить инсайт' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

// PUT /dreams/:dreamId/messages/:messageId/like
if (request.method === 'PUT' && pathParts.length === 5 && pathParts[0] === 'dreams' && pathParts[2] === 'messages' && pathParts[4] === 'like') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
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

  const dreamId = pathParts[1];
  const messageId = pathParts[3];

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const { liked } = body || {};
  if (typeof liked !== 'boolean') {
    return new Response(JSON.stringify({ error: 'liked must be boolean' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const message = await toggleMessageInsight(env, {
      dreamId,
      messageId,
      liked,
      userEmail
    });
    if (!message) {
      return new Response(JSON.stringify({ error: 'Сообщение не найдено' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    return new Response(JSON.stringify({
      id: message.id,
      role: message.role,
      content: message.content,
      meta: message.meta ? JSON.parse(message.meta) : {},
      createdAt: message.created_at
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (err) {
    console.error('toggle like error', err);
    return new Response(JSON.stringify({ error: 'Не удалось сохранить инсайт' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// PUT /daily_convos/:dailyConvoId/messages/:messageId/artwork_like
if (request.method === 'PUT' && pathParts.length === 5 && pathParts[0] === 'daily_convos' && pathParts[2] === 'messages' && pathParts[4] === 'artwork_like') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  const dailyConvoId = pathParts[1];
  const messageId = pathParts[3];
  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
  const { liked } = body || {};
  if (typeof liked !== 'boolean') return new Response(JSON.stringify({ error: 'liked must be boolean' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  try {
    const message = await toggleDailyMessageArtworkInsight(env, { dailyConvoId, messageId, liked, userEmail });
    if (!message) return new Response(JSON.stringify({ error: 'Сообщение не найдено' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    return new Response(JSON.stringify({ id: message.id, role: message.role, content: message.content, meta: message.meta ? JSON.parse(message.meta) : {}, createdAt: message.created_at }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  } catch (err) {
    console.error('toggle daily artwork like error', err);
    return new Response(JSON.stringify({ error: 'Не удалось сохранить инсайт' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

// PUT /daily_convos/:dailyConvoId/messages/:messageId/like
if (request.method === 'PUT' && pathParts.length === 5 && pathParts[0] === 'daily_convos' && pathParts[2] === 'messages' && pathParts[4] === 'like') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  const dailyConvoId = pathParts[1];
  const messageId = pathParts[3];
  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
  const { liked } = body || {};
  if (typeof liked !== 'boolean') return new Response(JSON.stringify({ error: 'liked must be boolean' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  try {
    const message = await toggleDailyMessageInsight(env, { dailyConvoId, messageId, liked, userEmail });
    if (!message) return new Response(JSON.stringify({ error: 'Сообщение не найдено' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    return new Response(JSON.stringify({ id: message.id, role: message.role, content: message.content, meta: message.meta ? JSON.parse(message.meta) : {}, createdAt: message.created_at }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  } catch (err) {
    console.error('toggle daily like error', err);
    return new Response(JSON.stringify({ error: 'Не удалось сохранить инсайт' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

// GET /dreams/:dreamId/insights
if (
  request.method === 'GET' &&
  pathParts.length === 3 &&
  pathParts[0] === 'dreams' &&
  pathParts[2] === 'insights'
) {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const dreamId = pathParts[1];
  const url = new URL(request.url);
  const metaKey = url.searchParams.get('metaKey');

  // Whitelist разрешённых фильтров
  const allowedFilters = {
    insightArtworksLiked: `CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1`,
    insightLiked: `CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1`,
  };

  // По умолчанию — как раньше (оба флага)
  const filterClause = allowedFilters[metaKey]
    ? `AND (${allowedFilters[metaKey]})`
    : `
      AND (
        CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1
        OR CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1
      )
    `;

  try {
    const { results } = await env.DB.prepare(`
      SELECT id, content, meta, created_at
      FROM messages
      WHERE dream_id = ?
        AND user = ?
        ${filterClause}
      ORDER BY created_at DESC
    `).bind(dreamId, userEmail).all();

    const insights = (results ?? []).map((row) => {
      const meta = row.meta ? JSON.parse(row.meta) : {};
      const createdAt =
        typeof row.created_at === 'number'
          ? new Date(row.created_at).toISOString()
          : row.created_at;

      // Для совместимости: если metaKey=insightArtworksLiked, то insightLiked = insightArtworksLiked
      const artworksFlag = Boolean(meta.insightArtworksLiked ?? meta.insight_artworks_liked ?? 0);
      const likedFlag = Boolean(
        meta.insightLiked ?? meta.insight_liked ?? meta.liked ?? meta.isFavorite ?? meta.isInsight ?? meta.favorite
      );

      return {
        messageId: row.id,
        text: row.content,
        createdAt,
        blockId: meta.blockId ?? meta.block_id ?? null,
        insightLiked: metaKey === 'insightArtworksLiked' ? artworksFlag : likedFlag,
        insightArtworksLiked: artworksFlag,
        meta,
      };
    });

    return new Response(JSON.stringify({ insights }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    console.error('fetch insights error', err);
    return new Response(JSON.stringify({ error: 'Не удалось загрузить инсайты' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// GET /daily_convos/:id/insights
if (request.method === 'GET' && pathParts.length === 3 && pathParts[0] === 'daily_convos' && pathParts[2] === 'insights') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  const dailyId = pathParts[1];
  const urlObj = new URL(request.url);
  const metaKey = urlObj.searchParams.get('metaKey');

  const allowedFilters = {
    insightArtworksLiked: `CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1`,
    insightLiked: `CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1`,
  };

  const filterClause = allowedFilters[metaKey] ? `AND (${allowedFilters[metaKey]})` : `
    AND (
      CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1
      OR CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1
    )
  `;

  try {
    const { results } = await env.DB.prepare(`
      SELECT id, content, meta, created_at
      FROM messages
      WHERE dream_id = ? AND user = ? ${filterClause}
      ORDER BY created_at DESC
    `).bind(dailyId, userEmail).all();

    const insights = (results ?? []).map(row => {
      const meta = row.meta ? JSON.parse(row.meta) : {};
      const createdAt = typeof row.created_at === 'number' ? new Date(row.created_at).toISOString() : row.created_at;
      const artworksFlag = Boolean(meta.insightArtworksLiked ?? meta.insight_artworks_liked ?? 0);
      const likedFlag = Boolean(meta.insightLiked ?? meta.insight_liked ?? meta.liked ?? meta.isFavorite ?? meta.isInsight ?? meta.favorite);
      return {
        messageId: row.id,
        text: row.content,
        createdAt,
        blockId: meta.blockId ?? meta.block_id ?? null,
        insightLiked: metaKey === 'insightArtworksLiked' ? artworksFlag : likedFlag,
        insightArtworksLiked: artworksFlag,
        meta
      };
    });

    return new Response(JSON.stringify({ insights }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  } catch (err) {
    console.error('GET /daily_convos/:id/insights error', err);
    return new Response(JSON.stringify({ error: 'Не удалось загрузить инсайты' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

// worker.js — добавить в конце fetch handler
if (url.pathname.endsWith('/mood') && request.method === 'PUT') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length < 3 || pathParts[pathParts.length - 2] !== 'dreams') {
    return new Response(JSON.stringify({ error: 'Invalid path' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const dreamId = pathParts[pathParts.length - 3];
  if (!dreamId) {
    return new Response(JSON.stringify({ error: 'Missing dreamId' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  const { context } = body;
  if (!context) {
    return new Response(JSON.stringify({ error: 'context required' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    await env.DB.prepare(
      `UPDATE dreams SET context = ? WHERE id = ? AND user = ?`
    ).bind(context, dreamId, userEmail).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (e) {
    console.error('[MOOD FOR DREAM] PUT error:', e);
    return new Response(JSON.stringify({ error: 'database_error' }), {
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

    const textChanged = existing.dreamText !== dreamText;

    await d1.prepare(
      `UPDATE dreams SET 
        title = ?, 
        dreamText = ?, 
        category = ?, 
        dreamSummary = ?, 
        globalFinalInterpretation = ?, 
        blocks = ?, 
        similarArtworks = ?, 
        context = ?,
        autoSummary = ${textChanged ? 'NULL' : 'autoSummary'}
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
      context,
      autoSummary: textChanged ? null : (existing.autoSummary ?? null)
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

// --- DAILY CONVOS CRUD ---

// GET /daily_convos (list)
if (url.pathname === '/daily_convos' && request.method === 'GET') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  try {
    const res = await env.DB.prepare('SELECT * FROM daily_convos WHERE user = ? ORDER BY date DESC').bind(userEmail).all();
    const items = (res.results || []).map(r => {
      if (r.blocks) {
        try { r.blocks = JSON.parse(r.blocks); } catch { r.blocks = []; }
      } else r.blocks = [];
      return r;
    });
    return new Response(JSON.stringify(items), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  } catch (e) {
    console.error('GET /daily_convos error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

// POST /daily_convos (create)
if (url.pathname === '/daily_convos' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
  const { notes, title } = body || {};
  if (!notes || typeof notes !== 'string') return new Response(JSON.stringify({ error: 'notes required' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  const id = crypto.randomUUID();
  const date = Date.now();
  try {
    await env.DB.prepare(`
      INSERT INTO daily_convos (id, user, title, notes, date, blocks, globalFinalInterpretation, autoSummary, context)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, userEmail, title ?? null, notes.trim(), date, JSON.stringify([]), null, null, null).run();

    const created = { id, user: userEmail, title: title ?? null, notes: notes.trim(), date, blocks: [], globalFinalInterpretation: null, autoSummary: null, context: null };
    return new Response(JSON.stringify(created), { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  } catch (e) {
    console.error('POST /daily_convos error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

// GET /daily_convos/:id
if (request.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'daily_convos') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  const id = pathParts[1];
  try {
    const row = await env.DB.prepare('SELECT * FROM daily_convos WHERE id = ? AND user = ?').bind(id, userEmail).first();
    if (!row) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    if (row.blocks) {
      try { row.blocks = JSON.parse(row.blocks); } catch { row.blocks = []; }
    } else row.blocks = [];
    return new Response(JSON.stringify(row), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  } catch (e) {
    console.error('GET /daily_convos/:id error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

// PUT /daily_convos/:id
if (request.method === 'PUT' && pathParts.length === 2 && pathParts[0] === 'daily_convos') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  const id = pathParts[1];
  let body;
  try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }); }
  const { notes, title, blocks, globalFinalInterpretation, autoSummary, context } = body || {};
  try {
    const existing = await env.DB.prepare('SELECT * FROM daily_convos WHERE id = ? AND user = ?').bind(id, userEmail).first();
    if (!existing) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }});

    // Используем старые значения, если новые не переданы
    const newNotes = typeof notes !== 'undefined' ? notes : existing.notes;
    const newTitle = typeof title !== 'undefined' ? title : existing.title;
    const newBlocks = typeof blocks !== 'undefined' ? JSON.stringify(blocks) : existing.blocks;
    const newGlobalFinalInterpretation = typeof globalFinalInterpretation !== 'undefined' ? globalFinalInterpretation : existing.globalFinalInterpretation;
    const newAutoSummary = typeof autoSummary !== 'undefined' ? autoSummary : existing.autoSummary;
    const newContext = typeof context !== 'undefined' ? context : existing.context;

    await env.DB.prepare(`
      UPDATE daily_convos SET title = ?, notes = ?, blocks = ?, globalFinalInterpretation = ?, autoSummary = ?, context = ?
      WHERE id = ? AND user = ?
    `).bind(newTitle, newNotes, newBlocks, newGlobalFinalInterpretation, newAutoSummary, newContext, id, userEmail).run();

    const row = await env.DB.prepare('SELECT * FROM daily_convos WHERE id = ? AND user = ?').bind(id, userEmail).first();
    if (row.blocks) {
      try { row.blocks = JSON.parse(row.blocks); } catch { row.blocks = []; }
    } else row.blocks = [];
    return new Response(JSON.stringify(row), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  } catch (e) {
    console.error('PUT /daily_convos/:id error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

// DELETE /daily_convos/:id
if (request.method === 'DELETE' && pathParts.length === 2 && pathParts[0] === 'daily_convos') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  const id = pathParts[1];
  try {
    const res = await env.DB.prepare('DELETE FROM daily_convos WHERE id = ? AND user = ?').bind(id, userEmail).run();
    if (res.changes === 0) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  } catch (e) {
    console.error('DELETE /daily_convos/:id error', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }});
  }
}

// --- CHAT: get history ---
if (url.pathname === '/chat' && request.method === 'GET') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  const dreamId = url.searchParams.get('dreamId');
  const blockId = url.searchParams.get('blockId');
  if (!dreamId || !blockId) {
    return new Response(JSON.stringify({ error: 'Missing dreamId or blockId' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  try {
    const d1 = env.DB;
    const res = await d1.prepare(
      `SELECT id, role, content, created_at, meta
       FROM messages
       WHERE user = ? AND dream_id = ? AND block_id = ?
       ORDER BY created_at ASC`
    ).bind(userEmail, dreamId, blockId).all();

    const messages = (res.results || []).map(r => ({
      id: r.id,
      role: r.role,
      content: r.content,
      created_at: r.created_at,
      meta: r.meta ? JSON.parse(r.meta) : undefined
    }));

    return new Response(JSON.stringify({ messages }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (e) {
    console.error('GET /chat error:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// --- CHAT: append message ---
if (url.pathname === '/chat' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  let body;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  const { id, dreamId, blockId, role, content, meta } = body || {};
  if (!dreamId || !blockId || !role || !content || !['user','assistant'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  const msgId = id || crypto.randomUUID();
  const createdAt = Date.now();
  try {
    const d1 = env.DB;
    await d1.prepare(
      `INSERT INTO messages (id, user, dream_id, block_id, role, content, created_at, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      msgId, userEmail, dreamId, blockId, role, String(content).slice(0, 12000),
      createdAt, meta ? JSON.stringify(meta) : null
    ).run();

    return new Response(JSON.stringify({
      id: msgId, role, content, created_at: createdAt, meta: meta ?? null
    }), {
      status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (e) {
    console.error('POST /chat error:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}



// --- CHAT: clear history for block ---
if (url.pathname === '/chat' && request.method === 'DELETE') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  const dreamId = url.searchParams.get('dreamId');
  const blockId = url.searchParams.get('blockId');
  if (!dreamId || !blockId) {
    return new Response(JSON.stringify({ error: 'Missing dreamId or blockId' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
  try {
    const d1 = env.DB;
    await d1.prepare(
      `DELETE FROM messages WHERE user = ? AND dream_id = ? AND block_id = ?`
    ).bind(userEmail, dreamId, blockId).run();

    await d1.prepare(
      `DELETE FROM dialog_summaries WHERE user = ? AND dream_id = ? AND block_id = ?`
    ).bind(userEmail, dreamId, blockId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (e) {
    console.error('DELETE /chat error:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// --- DAILY CHAT: GET /daily_chat?dailyConvoId=... ---
if (url.pathname === '/daily_chat' && request.method === 'GET') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const dailyConvoId = url.searchParams.get('dailyConvoId');
  if (!dailyConvoId) {
    return new Response(JSON.stringify({ error: 'Missing dailyConvoId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const res = await env.DB.prepare(
      `SELECT id, role, content, created_at, meta
       FROM messages
       WHERE user = ? AND dream_id = ?
       ORDER BY created_at ASC`
    ).bind(userEmail, dailyConvoId).all();

    const messages = (res.results || []).map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      created_at: r.created_at,
      meta: r.meta ? JSON.parse(r.meta) : undefined,
    }));

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('GET /daily_chat error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        details: e?.message || String(e)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// --- POST /daily_chat ---
if (url.pathname === '/daily_chat' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { id, dailyConvoId, role, content, meta, blockId } = body || {};
  if (!dailyConvoId || !role || !content || !['user', 'assistant'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const msgId = id || crypto.randomUUID();
  const createdAt = Date.now();

  // block_id in schema is NOT NULL — use empty string when not provided
  const safeBlockId = (typeof blockId === 'string' && blockId.length > 0) ? blockId : '';

  try {
    await env.DB.prepare(
      `INSERT INTO messages (id, user, dream_id, block_id, role, content, created_at, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        msgId,
        userEmail,
        dailyConvoId,     // <-- store dailyConvoId into existing dream_id column
        safeBlockId,      // <-- never NULL
        role,
        String(content).slice(0, 12000),
        createdAt,
        meta ? JSON.stringify(meta) : null
      )
      .run();

    return new Response(
      JSON.stringify({
        id: msgId,
        role,
        content,
        created_at: createdAt,
        meta: meta ?? null,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (e) {
    console.error('POST /daily_chat DB error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        details: e?.message || String(e)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- DELETE /daily_chat?dailyConvoId=... ---
if (url.pathname === '/daily_chat' && request.method === 'DELETE') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const dailyConvoId = url.searchParams.get('dailyConvoId');
  if (!dailyConvoId) {
    return new Response(JSON.stringify({ error: 'Missing dailyConvoId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    await env.DB.prepare(
      `DELETE FROM messages WHERE user = ? AND dream_id = ?`
    )
      .bind(userEmail, dailyConvoId)
      .run();

    await env.DB.prepare(
      `DELETE FROM dialog_summaries WHERE user = ? AND dream_id = ? AND block_id IS NULL`
    )
      .bind(userEmail, dailyConvoId)
      .run()
      .catch(() => {});

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('DELETE /daily_chat error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        details: e?.message || String(e)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

    // --- Generate Auto Summary endpoint (асинхронный) ---
if (url.pathname === '/generate_auto_summary' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
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

  const { dreamId, dreamText } = body;
  if (!dreamId || !dreamText) {
    return new Response(JSON.stringify({ error: 'Missing dreamId or dreamText' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const d1 = env.DB;
    const existing = await d1
      .prepare('SELECT dreamText, autoSummary FROM dreams WHERE id = ? AND user = ?')
      .bind(dreamId, userEmail)
      .first();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Dream not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (existing.autoSummary && existing.dreamText === dreamText) {
      return new Response(JSON.stringify({ success: true, autoSummary: existing.autoSummary }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const prompt = `Создай краткое резюме этого сновидения в 2-3 предложениях. Выдели ключевые элементы: персонажей, локации, действия и эмоции. Пиши кратко и по существу, без вопросов и обращений.\n\nТекст сна:\n${dreamText.slice(0, 4000)}`;

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Ты создаёшь краткие резюме сновидений. Пиши нейтрально, кратко, только факты и ключевые образы.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.5,
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
    let autoSummary = responseBody?.choices?.[0]?.message?.content || '';
    autoSummary = autoSummary.replace(/```[\s\S]*?```/g, '').replace(/^["'`]+|["'`]+$/g, '').trim();

    await d1.prepare('UPDATE dreams SET autoSummary = ? WHERE id = ? AND user = ?')
      .bind(autoSummary, dreamId, userEmail)
      .run();

    return new Response(JSON.stringify({ success: true, autoSummary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (e) {
    console.error('Error generating auto summary:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

    // --- Analyze endpoint (с rolling summary) ---
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
    const { blockText, lastTurns, extraSystemPrompt, dreamId, blockId } = requestData;

    // 1. Получаем rolling summary
let rollingSummary = null;
if (dreamId && blockId) {
  const summaryData = await getRollingSummary(env, userEmail, dreamId, blockId);
  rollingSummary = summaryData?.summary || null;

  console.log('[analyze] Summary state:', { 
    hasSummary: !!summaryData, 
    dreamId, 
    blockId 
  });

  // 2. Проверяем, нужно ли обновить summary
  const d1 = env.DB;
  const allMessagesRes = await d1.prepare(
    `SELECT COUNT(*) as count FROM messages WHERE user = ? AND dream_id = ? AND block_id = ?`
  ).bind(userEmail, dreamId, blockId).first();

  const currentMessageCount = allMessagesRes?.count || 0;

  console.log('[analyze] Message count:', currentMessageCount);

  // 🆕 Если summary нет, но есть хотя бы 2 сообщения — создаём
  if (!summaryData && currentMessageCount >= 2) {
    console.log('[analyze] Creating initial summary');
    try {
      rollingSummary = await updateRollingSummary(
        env, userEmail, dreamId, blockId, blockText, env.DEEPSEEK_API_KEY
      );
    } catch (e) {
      console.error('[analyze] Failed to create initial summary:', e);
    }
  } 
  // Если summary есть, проверяем порог обновления
  else if (summaryData) {
    const newMessageCount = currentMessageCount - summaryData.lastMessageCount;
  
    console.log('[analyze] New messages since last summary:', newMessageCount);
  
    if (newMessageCount >= SUMMARY_UPDATE_THRESHOLD) {
      console.log('[analyze] Updating summary');
      try {
        rollingSummary = await updateRollingSummary(
          env, userEmail, dreamId, blockId, blockText, env.DEEPSEEK_API_KEY
        );
      } catch (e) {
        console.error('[analyze] Failed to update summary:', e);
      }
    }
  }
}

    let messages = [];
    const isArtworkDialog = blockId?.startsWith('artwork__');
    const systemPrompt = isArtworkDialog ? ARTDIALOG_SYSTEM_PROMPT : DIALOG_SYSTEM_PROMPT;

messages.push({ role: 'system', content: systemPrompt });
  
    const d1 = env.DB;
    let dreamSummary = null;
    let autoSummary = null;

    if (dreamId) {
      const dreamRow = await d1.prepare(
        `SELECT dreamSummary, autoSummary FROM dreams WHERE id = ? AND user = ?`
      ).bind(dreamId, userEmail).first();
    
      if (dreamRow) {
        dreamSummary = dreamRow.dreamSummary || null;
        autoSummary = dreamRow.autoSummary || null;
      }
    }

    // Добавляем выжимку сна
    if (autoSummary) {
      messages.push({ role: 'system', content: `ВЫЖИМКА СНА:\n${autoSummary}` });
    }

    // Добавляем субъективный контекст от пользователя
    if (dreamSummary) {
      messages.push({ role: 'system', content: `СУБЪЕКТИВНЫЙ КОНТЕКСТ ОТ ПОЛЬЗОВАТЕЛЯ:\n${dreamSummary}` });
    }

    // Добавляем rolling summary диалога
    if (rollingSummary) {
      messages.push({ role: 'system', content: `ROLLING SUMMARY ДИАЛОГА:\n${rollingSummary}` });
    }
  
    // Добавляем текст текущего блока
    messages.push({ role: 'system', content: `ТЕКУЩИЙ БЛОК:\n${(blockText || '').slice(0, 4000)}` });
  
    if (Array.isArray(lastTurns) && lastTurns.length) {
      messages.push(...lastTurns);
    }
  
    if (extraSystemPrompt) {
      messages.push({ role: 'system', content: extraSystemPrompt });
    }

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

// --- Analyze daily convo (clone of /analyze, for daily_convos) ---
if (url.pathname === '/analyze_daily_convo' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Invalid content type', message: 'Content-Type must be application/json' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json();
    const { notesText, lastTurns = [], extraSystemPrompt, dailyConvoId, blockId, autoSummary } = body || {};

    if (!notesText || typeof notesText !== 'string') {
      return new Response(JSON.stringify({ error: 'No notesText' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // choose system prompt (artwork vs daily vs main)
    let systemPrompt = DIALOG_SYSTEM_PROMPT;
    if (typeof blockId === 'string' && blockId.startsWith('artwork__')) {
      systemPrompt = ARTDIALOG_SYSTEM_PROMPT;
    } else if (blockId === 'daily_chat') {
      systemPrompt = DAILY_CHAT_SYSTEM_PROMPT;
    } else if (blockId === 'daily_artwork') {
      systemPrompt = DAILY_ARTWORK_PROMPT;
    }

    const messages = [];
    messages.push({ role: 'system', content: systemPrompt });

    // autoSummary if provided
    if (autoSummary) {
      messages.push({ role: 'system', content: `ВЫЖИМКА:\n${autoSummary}` });
    }

    // rolling summary if any (reuse getRollingSummary — it expects (env, userEmail, dreamId, blockId))
    if (dailyConvoId) {
      try {
        const summaryData = await getRollingSummary(env, userEmail, dailyConvoId, blockId);
        if (summaryData?.summary) {
          messages.push({ role: 'system', content: `ROLLING SUMMARY ДИАЛОГА:\n${summaryData.summary}` });
        }
      } catch (e) {
        // non-fatal: log and continue
        console.warn('analyze_daily_convo: getRollingSummary failed', e);
      }
    }

    // main text
    messages.push({ role: 'system', content: `ТЕКСТ:\n${(notesText || '').slice(0, 4000)}` });

    if (Array.isArray(lastTurns) && lastTurns.length) {
      messages.push(...lastTurns);
    }

    if (extraSystemPrompt) {
      messages.push({ role: 'system', content: extraSystemPrompt });
    }

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
    responseBody.choices[0].message.content = content;

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    console.error('Error in /analyze_daily_convo:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// --- Generate Auto Summary for Daily Convo ---
if (url.pathname === '/generate_auto_summary_daily_convo' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders }
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

  const { dailyConvoId, notes } = body;
  if (!dailyConvoId || !notes) {
    return new Response(JSON.stringify({ error: 'Missing dailyConvoId or notes' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const d1 = env.DB;
    const existing = await d1
      .prepare('SELECT notes, autoSummary FROM daily_convos WHERE id = ? AND user = ?')
      .bind(dailyConvoId, userEmail)
      .first();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Daily convo not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (existing.autoSummary && existing.notes === notes) {
      return new Response(JSON.stringify({ success: true, autoSummary: existing.autoSummary }), {
        status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const prompt = `Создай краткое резюме этой записи в 2-3 предложениях. Выдели ключевые элементы: события, эмоции, мысли. Пиши кратко и по существу.\n\nТекст записи:\n${notes.slice(0, 4000)}`;

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Ты создаёшь краткие резюме записей. Пиши нейтрально, кратко, только факты и ключевые образы.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.5,
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
    let autoSummary = responseBody?.choices?.[0]?.message?.content || '';
    autoSummary = autoSummary.replace(/```[\s\S]*?```/g, '').replace(/^["'`]+|["'`]+$/g, '').trim();

    await d1.prepare('UPDATE daily_convos SET autoSummary = ? WHERE id = ? AND user = ?')
      .bind(autoSummary, dailyConvoId, userEmail)
      .run();

    return new Response(JSON.stringify({ success: true, autoSummary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (e) {
    console.error('Error generating auto summary for daily convo:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
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

    // --- calculateImprovementScore ---
function calculateImprovementScore(data) {
  const {
    total_dreams = 0,
    interpreted_count = 0,
    summarized_count = 0,
    artworks_count = 0,
    max_interpretation_length = 0
  } = data || {};

  if (total_dreams === 0) return 0;

  const interpretedRatio = interpreted_count / total_dreams;
  const summarizedRatio = summarized_count / total_dreams;
  const artworksRatio = artworks_count / total_dreams;

  // Нормализуем длину интерпретации (до 500 символов — макс. вес)
  const lengthScore = Math.min(1, (max_interpretation_length || 0) / 500);

  // Взвешенная оценка
  const score =
    0.4 * interpretedRatio +
    0.25 * summarizedRatio +
    0.2 * artworksRatio +
    0.15 * lengthScore;

  return Math.round(score * 100);
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
          contextParts.push(`Толкования блоков:\n${blockInterpretations.trim()}"""`);
        }

        const contextText = contextParts.join('\n\n');

        const prompt = `Ты — эксперт по искусству и психоанализу. На основе сна и его толкования подбери 5 произведений искусства, которые резонируют с образами и мотивами сна.

${contextText}

Для каждого произведения укажи:
- title: название произведения
- author: автор
- desc: краткое описание (1-2 предложения), почему это произведение связано со сном
- value: ссылка на изображение (если известна) или пустая строка
- type: тип искусства — **ОБЯЗАТЕЛЬНО** выбери ОДИН из этого списка:
  * "painting" — картина, живопись
  * "sculpture" — скульптура
  * "installation" — инсталляция
  * "book" — книга, роман, литература
  * "music" — музыка, симфония, опера
  * "movie" — фильм, кино
  * "theater" — театр, пьеса
  * "photo" — фотография
  * "drawing" — рисунок, графика
  * "story" — рассказ, новелла

**ВАЖНО:** Поле "type" должно быть СТРОГО одним из перечисленных значений! Не используй другие слова!

Пример правильного ответа:
{
  "works": [
    {"title": "Звёздная ночь", "author": "Винсент Ван Гог", "desc": "Картина о космосе и одиночестве", "value": "", "type": "painting"},
    {"title": "Война и мир", "author": "Лев Толстой", "desc": "Роман о судьбах людей", "value": "", "type": "book"},
    {"title": "Матрица", "author": "Братья Вачовски", "desc": "Фильм о реальности", "value": "", "type": "movie"}
  ]
}

Верни ответ строго в формате JSON, без комментариев и лишнего текста.`;

        const deepseekRequestBody = {
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: 'Ты эксперт по искусству. Отвечай только валидным JSON без дополнительного текста.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1500,
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

        const responseBody = await deepseekResponse.json();
        let content = responseBody?.choices?.[0]?.message?.content || '{}';
        content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch {
          parsed = { works: [] };
        }

        const works = Array.isArray(parsed.works) ? parsed.works : [];
const similarArtworks = works.slice(0, 5).map(w => ({
  title: w.title || '',
  author: w.author || '',
  desc: w.desc || '',
  value: w.value || '',
  type: w.type || 'default'  // теперь type будет передаваться!
}));

        return new Response(JSON.stringify({ similarArtworks }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } catch (e) {
        console.error('Error in /find_similar:', e);
        return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // --- Interpret block endpoint (с rolling summary + необработанные сообщения) ---
    // --- Interpret block endpoint (ИСПРАВЛЕННЫЙ) ---
if (url.pathname === '/interpret_block' && request.method === 'POST') {
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
    const { blockText, dreamId, blockId } = body;

    if (!blockText) {
      return new Response(JSON.stringify({ error: 'No blockText' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const d1 = env.DB;
    let autoSummary = '';
    let dreamSummary = '';
  
    if (dreamId) {
      const dreamRow = await d1.prepare(
        `SELECT autoSummary, dreamSummary FROM dreams WHERE id = ? AND user = ?`
      ).bind(dreamId, userEmail).first();
    
      if (dreamRow) {
        autoSummary = dreamRow.autoSummary || '';
        dreamSummary = dreamRow.dreamSummary || '';
      }
    }

    const { rollingSummary, unprocessedMessages } = await getUnprocessedMessages(
      env, userEmail, dreamId, blockId
    );

    let unprocessedContext = '';
    if (unprocessedMessages.length > 0) {
      unprocessedContext = '\n\n### Последние сообщения диалога (после summary):\n';
      unprocessedMessages.forEach(msg => {
        const label = msg.role === 'user' ? 'Пользователь' : 'Ассистент';
        unprocessedContext += `${label}: ${msg.content}\n`;
      });
    }

    const prompt = `${BLOCK_INTERPRETATION_PROMPT}

ВЫЖИМКА СНА:
${autoSummary || 'Не указана'}

СУБЪЕКТИВНЫЙ КОНТЕКСТ ОТ ПОЛЬЗОВАТЕЛЯ:
${dreamSummary || 'Не указан'}

ТЕКУЩИЙ БЛОК:
${blockText.slice(0, 4000)}

ROLLING SUMMARY ДИАЛОГА:
${rollingSummary || 'Диалог только начался'}
${unprocessedContext}

На основе ВСЕГО контекста (включая последние сообщения) дай развёрнутое толкование этого блока сна.`;

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
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

    const responseBody = await deepseekResponse.json();
    let interpretation = responseBody?.choices?.[0]?.message?.content || '';
    interpretation = interpretation.replace(/```[\s\S]*?```/g, '').replace(/^["'`]+|["'`]+$/g, '').trim();

    // 🆕 СОХРАНЯЕМ толкование блока в messages с правильным meta
if (dreamId && blockId && interpretation) {
  const msgId = crypto.randomUUID();
  const createdAt = Date.now();

  await d1.prepare(
    `INSERT INTO messages (id, user, dream_id, block_id, role, content, created_at, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    msgId,
    userEmail,
    dreamId,
    blockId,
    'assistant',
    interpretation,
    createdAt,
    JSON.stringify({ kind: 'block_interpretation' })
  ).run();

  // Также сохраняем в blocks для истории
  const dreamRow = await d1.prepare(
    `SELECT blocks FROM dreams WHERE id = ? AND user = ?`
  ).bind(dreamId, userEmail).first();

  if (dreamRow) {
    let blocks = [];
    try {
      blocks = JSON.parse(dreamRow.blocks || '[]');
    } catch {
      blocks = [];
    }
  
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    if (blockIndex !== -1) {
      blocks[blockIndex].interpretation = interpretation;
    
      await d1.prepare(
        `UPDATE dreams SET blocks = ? WHERE id = ? AND user = ?`
      ).bind(JSON.stringify(blocks), dreamId, userEmail).run();
    }
  }
}

    return new Response(JSON.stringify({ 
      interpretation,
      isBlockInterpretation: true  // 🆕 Флаг для фронтенда
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (e) {
    console.error('Error in /interpret_block:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

    // --- Interpret final endpoint (с rolling summary + необработанные сообщения по всем блокам) ---
if (url.pathname === '/interpret_final' && request.method === 'POST') {
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
    const { dreamText, blocks, dreamId } = body;

    if (!dreamText) {
      return new Response(JSON.stringify({ error: 'No dreamText' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 1. Загружаем autoSummary и dreamSummary
    const d1 = env.DB;
    let autoSummary = '';
    let dreamSummary = '';
  
    if (dreamId) {
      const dreamRow = await d1.prepare(
        `SELECT autoSummary, dreamSummary FROM dreams WHERE id = ? AND user = ?`
      ).bind(dreamId, userEmail).first();
    
      if (dreamRow) {
        autoSummary = dreamRow.autoSummary || '';
        dreamSummary = dreamRow.dreamSummary || '';
      }
    }

    // 2. Собираем контекст по всем блокам
    let blocksContext = '';
    if (dreamId && Array.isArray(blocks) && blocks.length > 0) {
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const blockId = block.id;
        const blockText = block.text;

        // Получаем rolling summary + необработанные сообщения
        const { rollingSummary, unprocessedMessages } = await getUnprocessedMessages(
          env, userEmail, dreamId, blockId
        );

        blocksContext += `\n\n### Блок ${i + 1}:\n${blockText}\n`;
      
        if (rollingSummary) {
          blocksContext += `**Контекст диалога (summary):**\n${rollingSummary}\n`;
        }

        if (unprocessedMessages.length > 0) {
          blocksContext += `**Последние сообщения:**\n`;
          unprocessedMessages.forEach(msg => {
            const label = msg.role === 'user' ? 'Пользователь' : 'Ассистент';
            blocksContext += `${label}: ${msg.content}\n`;
          });
        }
      }
    }

    // 3. Формируем промпт для итогового толкования
    const prompt = `${FINAL_INTERPRETATION_PROMPT}

ВЫЖИМКА СНА:
${autoSummary || 'Не указана'}

СУБЪЕКТИВНЫЙ КОНТЕКСТ ОТ ПОЛЬЗОВАТЕЛЯ:
${dreamSummary || 'Не указан'}

ДИАЛОГИ ПО БЛОКАМ (включая последние сообщения):
${blocksContext}

Создай целостное итоговое толкование всего сна, учитывая весь контекст диалогов (включая последние необработанные сообщения).`;

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
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

    const responseBody = await deepseekResponse.json();
    let interpretation = responseBody?.choices?.[0]?.message?.content || '';
    interpretation = interpretation.replace(/```[\s\S]*?```/g, '').replace(/^["'`]+|["'`]+$/g, '').trim();

    // 🆕 СОХРАНЯЕМ итоговое толкование в БД
    if (dreamId && interpretation) {
      await d1.prepare(`
        UPDATE dreams 
        SET globalFinalInterpretation = ?
        WHERE id = ? AND user = ?
      `).bind(interpretation, dreamId, userEmail).run();
    }

    return new Response(JSON.stringify({ interpretation }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (e) {
    console.error('Error in /interpret_final:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// --- Interpret final for daily convo (save into daily_convos.globalFinalInterpretation) ---
if (url.pathname === '/interpret_final_daily_convo' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json();
    const { notesText, dailyConvoId } = body || {};

    if (!notesText || typeof notesText !== 'string') {
      return new Response(JSON.stringify({ error: 'No notesText' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const prompt = `${FINAL_INTERPRETATION_PROMPT}\n\nТЕКСТ:\n${notesText.slice(0, 4000)}`;

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
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

    const responseBody = await deepseekResponse.json();
    let interpretation = responseBody?.choices?.[0]?.message?.content || '';
    interpretation = interpretation.replace(/```[\s\S]*?```/g, '').replace(/^["'`]+|["'`]+$/g, '').trim();

    if (dailyConvoId && interpretation) {
      try {
        await env.DB.prepare(
          `UPDATE daily_convos SET globalFinalInterpretation = ? WHERE id = ? AND user = ?`
        ).bind(interpretation, dailyConvoId, userEmail).run();
      } catch (e) {
        console.warn('interpret_final_daily_convo: failed to save interpretation', e);
      }
    }

    return new Response(JSON.stringify({ interpretation }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    console.error('Error in /interpret_final_daily_convo:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// --- Interpret block for daily convo ---
if (url.pathname === '/interpret_block_daily_convo' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json();
    const { notesText, blockType = 'dialog' } = body || {};

    if (!notesText || typeof notesText !== 'string') {
      return new Response(JSON.stringify({ error: 'No notesText' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const interpretation = await interpretBlock(env, notesText, blockType);

    return new Response(JSON.stringify({ interpretation }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    console.error('Error in /interpret_block_daily_convo:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// --- Interpret final for daily convo (NEW) ---
if (url.pathname === '/interpret_final_daily_convo_new' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const body = await request.json();
    const { notesText, blockType = 'dialog' } = body || {};

    if (!notesText || typeof notesText !== 'string') {
      return new Response(JSON.stringify({ error: 'No notesText' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const interpretation = await interpretFinal(env, notesText, blockType);

    return new Response(JSON.stringify({ interpretation }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    console.error('Error in /interpret_final_daily_convo_new:', err);
    return new Response(JSON.stringify({ error: 'internal_error', message: err?.message || String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// --- Dashboard metrics endpoint (расширенный, поддержка ?days=) ---
if (url.pathname === '/dashboard' && request.method === 'GET') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // Проверка триала
  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const d1 = env.DB;

    // Parse days param: ?days=7|30|90|365 or 0/all
    const daysParam = url.searchParams.get('days');
    const days = daysParam ? parseInt(daysParam, 10) : 90; // default 90d
    const isAll = !daysParam || days <= 0;
    const sinceTs = isAll ? 0 : Date.now() - (days * 24 * 60 * 60 * 1000);

    // --- Precomputed things used previously ---
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // 1) Всего снов (всего записей пользователя)
    const totalDreamsResult = await d1.prepare(
      'SELECT COUNT(*) as count FROM dreams WHERE user = ?'
    ).bind(userEmail).first();
    const totalDreams = totalDreamsResult?.count || 0;

    // 2) Блоков за месяц (диалогов за 30 дней)
    const monthlyBlocksResult = await d1.prepare(
      `SELECT COUNT(DISTINCT dream_id) as count 
       FROM messages 
       WHERE user = ? AND created_at > ?`
    ).bind(userEmail, thirtyDaysAgo).first();
    const monthlyBlocks = monthlyBlocksResult?.count || 0;

    // 3) Проанализировано (сны с итоговой интерпретацией)
    const interpretedResult = await d1.prepare(
      `SELECT COUNT(*) as count 
       FROM dreams 
       WHERE user = ? AND globalFinalInterpretation IS NOT NULL AND globalFinalInterpretation != ''`
    ).bind(userEmail).first();
    const interpretedCount = interpretedResult?.count || 0;

    // 4) Арт-работы (сны с artwork'ами)
    const artworksResult = await d1.prepare(
      `SELECT COUNT(*) as count 
       FROM dreams 
       WHERE user = ? AND similarArtworks IS NOT NULL AND similarArtworks != '[]' AND similarArtworks != '{}'`
    ).bind(userEmail).first();
    const artworksCount = artworksResult?.count || 0;

    // 5) Диалогов с ботом (сны, по которым велись диалоги)
    const dialogDreamsResult = await d1.prepare(
      `SELECT COUNT(DISTINCT dream_id) as count 
       FROM messages 
       WHERE user = ? AND role = 'assistant'`
    ).bind(userEmail).first();
    const dialogDreamsCount = dialogDreamsResult?.count || 0;

    // 6) Стрик (days with entries in last year)
    const dailyDreamsResult = await d1.prepare(
      `SELECT DATE(date/1000, 'unixepoch') as day, COUNT(*) as count, MIN(date) as first_ts
       FROM dreams 
       WHERE user = ? AND date > ?
       GROUP BY day
       ORDER BY day DESC`
    ).bind(userEmail, Date.now() - 365 * 24 * 60 * 60 * 1000).all();
    const dailyDreams = dailyDreamsResult.results || [];
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < dailyDreams.length; i++) {
      const dreamDate = new Date(dailyDreams[i].day);
      dreamDate.setHours(0, 0, 0, 0);

      if (i === 0) {
        const diffDays = (currentDate.getTime() - dreamDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= 1) {
          streak = 1;
          currentDate = dreamDate;
        } else {
          break;
        }
      } else {
        const expectedDate = new Date(currentDate);
        expectedDate.setDate(expectedDate.getDate() - 1);
        if (dreamDate.getTime() === expectedDate.getTime()) {
          streak++;
          currentDate = dreamDate;
        } else {
          break;
        }
      }
    }

    // 7) Данные для прогресса (как было)
    const interpretedForScoreResult = await d1.prepare(
      `SELECT COUNT(*) as count 
       FROM dreams 
       WHERE user = ? AND globalFinalInterpretation IS NOT NULL AND globalFinalInterpretation != ''`
    ).bind(userEmail).first();

    const summarizedForScoreResult = await d1.prepare(
      `SELECT COUNT(*) as count 
       FROM dreams 
       WHERE user = ? AND dreamSummary IS NOT NULL AND dreamSummary != ''`
    ).bind(userEmail).first();

    const maxLengthResult = await d1.prepare(
      `SELECT MAX(LENGTH(globalFinalInterpretation)) as maxLength 
       FROM dreams 
       WHERE user = ? AND globalFinalInterpretation IS NOT NULL`
    ).bind(userEmail).first();

    const maxLength = maxLengthResult?.maxLength || 0;

    const progressData = {
      total_dreams: totalDreams,
      interpreted_count: interpretedForScoreResult?.count || 0,
      summarized_count: summarizedForScoreResult?.count || 0,
      artworks_count: artworksCount,
      max_interpretation_length: maxLength
    };

    // 8) Базовый общий score (используем вашу функцию)
    const improvementScore = calculateImprovementScore(progressData);

    // ------------------------------
    // 9) Новая логика: история (history), score/scoreDelta, highest, breakdown, recentDreams
    // ------------------------------

    // 9.1 Aggregation per day (GROUP BY day) within requested period (or all)
    const aggSql = `
      SELECT
        DATE(date/1000, 'unixepoch') as day,
        MIN(date) as day_first_ts,
        COUNT(*) as total,
        SUM(CASE WHEN globalFinalInterpretation IS NOT NULL AND globalFinalInterpretation != '' THEN 1 ELSE 0 END) as interpreted,
        SUM(CASE WHEN dreamSummary IS NOT NULL AND dreamSummary != '' THEN 1 ELSE 0 END) as summarized,
        SUM(CASE WHEN similarArtworks IS NOT NULL AND similarArtworks != '' AND similarArtworks != '[]' THEN 1 ELSE 0 END) as artworks,
        SUM(CASE WHEN EXISTS (SELECT 1 FROM messages m WHERE m.user = dreams.user AND m.dream_id = dreams.id AND m.role = 'assistant') THEN 1 ELSE 0 END) as dialogs
      FROM dreams
      WHERE user = ? ${isAll ? '' : 'AND date >= ?'}
      GROUP BY day
      ORDER BY day ASC
    `;

    // Bind params depending on isAll
    const aggStmt = isAll ? await d1.prepare(aggSql).bind(userEmail) : await d1.prepare(aggSql).bind(userEmail, sinceTs);
    const aggRes = await aggStmt.all();
    const aggRows = aggRes.results || [];

    // 9.2 Build cumulative history (cumulative up-to-day). If you prefer per-day snapshots, use row values directly.
    let cumulative = { total: 0, interpreted: 0, summarized: 0, artworks: 0, dialogs: 0 };
    const history = [];

    // Helper: compute score for given cumulative aggregation. Prefer existing calculateImprovementScore if available.
    function computeScoreFromAgg(agg) {
      try {
        if (typeof calculateImprovementScore === 'function') {
          // CalculateImprovementScore expects an object; try passing compatible shape
          const dataForCalc = {
            total_dreams: agg.total || 0,
            interpreted_count: agg.interpreted || 0,
            summarized_count: agg.summarized || 0,
            artworks_count: agg.artworks || 0,
            max_interpretation_length: maxLength // reuse overall max length as proxy
          };
          return Math.round(calculateImprovementScore(dataForCalc));
        }
      } catch (e) {
        // fall back
      }

      // Fallback heuristic if calculateImprovementScore unavailable
      const total = agg.total || 1;
      const interpretedPct = (agg.interpreted || 0) / total;
      const dialogPct = (agg.dialogs || 0) / total;
      const artworkPct = (agg.artworks || 0) / total;
      const score = Math.round(Math.min(100, 100 * (0.55 * interpretedPct + 0.25 * dialogPct + 0.20 * artworkPct)));
      return score;
    }

    for (const r of aggRows) {
      cumulative.total += Number(r.total || 0);
      cumulative.interpreted += Number(r.interpreted || 0);
      cumulative.summarized += Number(r.summarized || 0);
      cumulative.artworks += Number(r.artworks || 0);
      cumulative.dialogs += Number(r.dialogs || 0);

      const point = {
        date: new Date(Number(r.day_first_ts || r.day)).toISOString(),
        score: computeScoreFromAgg(cumulative),
        counts: { ...cumulative }
      };
      history.push(point);
    }

    // If no history points, provide a fallback single point using current totals
    if (history.length === 0) {
      const fallbackAgg = {
        total: totalDreams,
        interpreted: interpretedCount,
        summarized: summarizedForScoreResult?.count || 0,
        artworks: artworksCount,
        dialogs: dialogDreamsCount
      };
      history.push({
        date: new Date().toISOString(),
        score: computeScoreFromAgg(fallbackAgg),
        counts: fallbackAgg
      });
    }

    // 9.3 Build historyOut (date + score)
    const historyOut = history.map(h => ({ date: h.date, score: h.score }));

    // 9.4 score, scoreDelta, highestScore
    const lastScore = historyOut.length ? historyOut[historyOut.length - 1].score : Math.round(improvementScore || 0);
    const prevScore = historyOut.length > 1 ? historyOut[historyOut.length - 2].score : null;
    const scoreDelta = prevScore === null ? 0 : lastScore - prevScore;
    const highestPoint = historyOut.reduce((acc, p) => (acc === null || p.score > acc.score ? p : acc), null);

    // 9.5 recentDreams (last N)
    const recentLimit = 12;
    const recentSql = `SELECT id, title, date, (globalFinalInterpretation IS NOT NULL AND globalFinalInterpretation != '') as interpreted
                       FROM dreams WHERE user = ? ${isAll ? '' : 'AND date >= ?'} ORDER BY date DESC LIMIT ?`;
    const recentStmt = isAll ? await d1.prepare(recentSql).bind(userEmail, recentLimit) : await d1.prepare(recentSql).bind(userEmail, sinceTs, recentLimit);
    const recentRes = await recentStmt.all();
    const recentDreams = (recentRes.results || []).map(r => ({
      id: r.id,
      title: r.title || null,
      date: new Date(Number(r.date)).toISOString(),
      interpreted: Boolean(r.interpreted)
    }));

    // 9.6 breakdownCounts & breakdownPercent (from final cumulative)
    const finalCounts = history.length ? history[history.length - 1].counts : { total: 0, interpreted: 0, summarized: 0, artworks: 0, dialogs: 0 };
    const bc = {
      interpreted: finalCounts.interpreted || 0,
      summarized: finalCounts.summarized || 0,
      artworks: finalCounts.artworks || 0,
      dialogs: finalCounts.dialogs || 0
    };
    const totalForPct = Math.max(1, finalCounts.total || 0);
    const bp = {
      interpreted: Math.round((bc.interpreted / totalForPct) * 100),
      summarized: Math.round((bc.summarized / totalForPct) * 100),
      artworks: Math.round((bc.artworks / totalForPct) * 100),
      dialogs: Math.round((bc.dialogs / totalForPct) * 100)
    };

    // =============================
    // ✅ НОВЫЙ БЛОК: АГРЕГАЦИЯ НАСТРОЕНИЙ
    // =============================

    let moodCounts = {};
    let moodTotal = 0;

    try {
      const moodsSql = isAll
        ? `SELECT context, COUNT(*) AS cnt FROM moods WHERE user_email = ? GROUP BY context`
        : `SELECT context, COUNT(*) AS cnt FROM moods WHERE user_email = ? AND date >= ? GROUP BY context`;

      const moodsStmt = isAll
        ? await d1.prepare(moodsSql).bind(userEmail)
        : await d1.prepare(moodsSql).bind(userEmail, sinceTs);

      const moodsRes = await moodsStmt.all();
      const moodRows = moodsRes?.results ?? [];

      for (const r of moodRows) {
        const key = r.context ?? 'unknown';
        const cnt = Number(r.cnt ?? 0);
        moodCounts[key] = (moodCounts[key] || 0) + cnt;
        moodTotal += cnt;
      }
    } catch (e) {
      console.warn('Failed to aggregate moods for dashboard:', e);
      moodCounts = {};
      moodTotal = 0;
    }

    // =============================
    // ✅ НОВЫЙ БЛОК: АГРЕГАЦИЯ ИНСАЙТОВ
    // =============================

    let insightsDreamsCount = 0;
    let insightsArtworksCount = 0;

    try {
      // Сначала попытка агрегировать по колонкам/JSON-полям в dreams (как раньше)
      const insightsSql = isAll
        ? `
          SELECT
            SUM(COALESCE(insightsCount, 0)) AS insights_sum_col,
            SUM(COALESCE(artworkInsightsCount, 0)) AS artwork_sum_col,
            SUM(COALESCE(json_array_length(insights), 0)) AS insights_sum_arr,
            SUM(COALESCE(json_array_length(similarArtworks), 0)) AS artwork_sum_arr
          FROM dreams
          WHERE user = ?
        `
        : `
          SELECT
            SUM(COALESCE(insightsCount, 0)) AS insights_sum_col,
            SUM(COALESCE(artworkInsightsCount, 0)) AS artwork_sum_col,
            SUM(COALESCE(json_array_length(insights), 0)) AS insights_sum_arr,
            SUM(COALESCE(json_array_length(similarArtworks), 0)) AS artwork_sum_arr
          FROM dreams
          WHERE user = ? AND date >= ?
        `;

      const insightsStmt = isAll
        ? await d1.prepare(insightsSql).bind(userEmail)
        : await d1.prepare(insightsSql).bind(userEmail, sinceTs);

      const insightsRes = await insightsStmt.first();
      const colInsights = Number(insightsRes?.insights_sum_col ?? 0);
      const arrInsights = Number(insightsRes?.insights_sum_arr ?? 0);
      const colArt = Number(insightsRes?.artwork_sum_col ?? 0);
      const arrArt = Number(insightsRes?.artwork_sum_arr ?? 0);

      insightsDreamsCount = Math.max(colInsights, arrInsights);
      insightsArtworksCount = Math.max(colArt, arrArt);

    } catch (err) {
      // fallbacks below will try other strategies
      insightsDreamsCount = 0;
      insightsArtworksCount = 0;
    }

    // Дополнительно: посчитаем инсайты по сообщениям, если там выставлены флаги
    try {
      const msgsSql = isAll
        ? `
          SELECT
            COUNT(DISTINCT CASE WHEN CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1 THEN dream_id END) AS dreams_with_insight,
            SUM(CASE WHEN CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1 THEN 1 ELSE 0 END) AS artworks_insight_messages
          FROM messages
          WHERE user = ?
        `
        : `
          SELECT
            COUNT(DISTINCT CASE WHEN CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1 THEN dream_id END) AS dreams_with_insight,
            SUM(CASE WHEN CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1 THEN 1 ELSE 0 END) AS artworks_insight_messages
          FROM messages
          WHERE user = ? AND created_at >= ?
        `;

      const msgsStmt = isAll
        ? await d1.prepare(msgsSql).bind(userEmail)
        : await d1.prepare(msgsSql).bind(userEmail, sinceTs);

      const msgsRes = await msgsStmt.first();
      const dreamsWithInsight = Number(msgsRes?.dreams_with_insight ?? 0);
      const artworksInsightMsgs = Number(msgsRes?.artworks_insight_messages ?? 0);

      // Объединяем: берём максимум между подсчитанным по dreams и подсчитанным по сообщениям,
      // т.к. структура может быть разной в базе
      insightsDreamsCount = Math.max(insightsDreamsCount || 0, dreamsWithInsight || 0);
      // Для артов — если в dreams есть массив similarArtworks, он даёт количество арт-работ;
      // сообщения дают количество лайков/инсайтов по арт-работам — сложим (или берём max по логике)
      insightsArtworksCount = Math.max(insightsArtworksCount || 0, artworksInsightMsgs || 0);

    } catch (e) {
      console.warn('Failed to aggregate insights from messages:', e);
      // уже имеющиеся значения сохраняются
    }

    // === DAILY CONVOS AGGREGATION FOR DASHBOARD ===
let totalDailyConvos = 0;
let dailyConvoInsightsCount = 0;
try {
  const dailyCountRes = await d1.prepare(`SELECT COUNT(*) AS cnt FROM daily_convos WHERE user = ?`).bind(userEmail).first();
  totalDailyConvos = Number(dailyCountRes?.cnt ?? 0);

  // Count insights from messages linked to daily_convos (dream_id used)
  const dailyInsightsRes = await d1.prepare(`
    SELECT
      COUNT(DISTINCT CASE WHEN CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1 THEN dream_id END) AS daily_convos_with_insight,
      SUM(CASE WHEN CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1 THEN 1 ELSE 0 END) AS daily_artwork_insight_msgs
    FROM messages
    WHERE user = ? AND dream_id IN (SELECT id FROM daily_convos WHERE user = ?)
  `).bind(userEmail, userEmail).first();

  dailyConvoInsightsCount = Number(dailyInsightsRes?.daily_convos_with_insight ?? 0);
} catch (e) {
  console.warn('Failed to aggregate daily_convos metrics for dashboard:', e);
  totalDailyConvos = totalDailyConvos || 0;
  dailyConvoInsightsCount = dailyConvoInsightsCount || 0;
}

    // 10) Compose response payload (includes old and new fields)
    const payload = {
      period: isAll ? 'all' : `${days}d`,
      totalDreams,
      entriesCount: totalDreams,
      score: lastScore,
      scoreDelta,
      history: historyOut,
      highestScore: highestPoint ? { value: highestPoint.score, date: highestPoint.date } : null,
      monthlyBlocks,
      interpretedCount: interpretedCount,
      interpretedPercent: totalDreams > 0 ? Math.round((interpretedCount / totalDreams) * 100) : 0,
      artworksCount,
      dialogDreamsCount,
      streak,
      improvementScore,
      breakdownCounts: bc,
      breakdownPercent: bp,
      recentDreams,
      lastUpdated: new Date().toISOString(),

      // === НОВЫЕ ПОЛЯ ===
      moodCounts,
      moodTotal,
      insightsDreamsCount,
      insightsArtworksCount
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (e) {
    console.error('Dashboard error:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// POST /me/avatar/upload (JavaScript)
if (url.pathname === '/me/avatar/upload' && request.method === 'POST') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let form;
  try {
    form = await request.formData();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid form data' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const file = form.get('file');
  // В Workers файл представлен как Blob (File может не существовать)
  if (!file || !(file instanceof Blob)) {
    return new Response(JSON.stringify({ error: 'No file provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const maxSize = 2 * 1024 * 1024; // 2MB

  if (!allowedTypes.includes(file.type)) {
    return new Response(JSON.stringify({ error: 'Unsupported file type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
  if (file.size > maxSize) {
    return new Response(JSON.stringify({ error: 'File too large (max 2MB)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // Получаем текущего пользователя для удаления старого аватара
    const currentUser = await env.DB.prepare(
      'SELECT avatar_image_url FROM users WHERE email = ?'
    ).bind(userEmail).first();

    if (currentUser && currentUser.avatar_image_url) {
      try {
        const oldKey = new URL(currentUser.avatar_image_url).pathname.replace('/avatars/', '');
        if (oldKey) {
          await env.AVATARS.delete(oldKey);
        }
      } catch (e) {
        console.warn('Failed to delete old avatar (ignored):', e);
      }
    }

    // Генерируем ключ безопасно
    const ext = (file.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
    const ts = Date.now();
    const randArr = new Uint32Array(2);
    crypto.getRandomValues(randArr);
    const rand = Array.from(randArr).map(n => n.toString(36)).join('');
    const key = `avatars/${encodeURIComponent(userEmail)}-${ts}-${rand}.${ext}`;

    // Загружаем в R2. Blob.stream() работает в Workers.
    await env.AVATARS.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const origin = new URL(request.url).origin;
    const publicUrl = `${origin}/avatars/${key}`;

    await env.DB.prepare(
      'UPDATE users SET avatar_image_url = ? WHERE email = ?'
    ).bind(publicUrl, userEmail).run();

    const updatedUser = await env.DB.prepare(
      'SELECT id, email, name, avatar_icon, avatar_image_url, created_at FROM users WHERE email = ?'
    ).bind(userEmail).first();

    return new Response(JSON.stringify({ ok: true, user: updatedUser }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('Avatar upload error:', e);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

if (url.pathname.startsWith('/avatars/') && request.method === 'GET') {
  const key = url.pathname.replace('/avatars/', '');
  if (!key) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const object = await env.AVATARS.get(key);
    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400'); // CDN кеширует 1 день

    return new Response(object.body, { status: 200, headers });
  } catch (e) {
    console.error('R2 get error:', e);
    return new Response('Internal Error', { status: 500 });
  }
}

// --- PUT /me (заменить существующий блок) ---
if ((url.pathname === '/me' || url.pathname === '/api/me') && request.method === 'PUT') {
  const userEmail = await getUserEmail(request);
  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Invalid content type', message: 'application/json expected' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let { name, avatar_icon, avatar_image_url } = body;

  if (name === undefined && avatar_icon === undefined && avatar_image_url === undefined) {
    return new Response(JSON.stringify({ error: 'At least one field (name, avatar_icon or avatar_image_url) is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (typeof name !== 'undefined' && (typeof name !== 'string' || name.length > 100)) {
    return new Response(JSON.stringify({ error: 'Invalid name (must be string up to 100 chars)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (typeof avatar_icon !== 'undefined' && (typeof avatar_icon !== 'string' || !VALID_AVATAR_ICONS.includes(avatar_icon))) {
    return new Response(JSON.stringify({ error: 'Invalid avatar_icon' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (typeof avatar_image_url !== 'undefined' && (typeof avatar_image_url !== 'string' || !(avatar_image_url.startsWith('http://') || avatar_image_url.startsWith('https://')))) {
    return new Response(JSON.stringify({ error: 'Invalid avatar_image_url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // Сформируем UPDATE-часть динамически
    const sets = [];
    const binds = [];

    if (typeof name !== 'undefined') { sets.push('name = ?'); binds.push(name); }
    if (typeof avatar_icon !== 'undefined') { sets.push('avatar_icon = ?'); binds.push(avatar_icon); }
    if (typeof avatar_image_url !== 'undefined') { sets.push('avatar_image_url = ?'); binds.push(avatar_image_url); }

    if (sets.length === 0) {
      return new Response(JSON.stringify({ error: 'Nothing to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    binds.push(userEmail);
    const sql = `UPDATE users SET ${sets.join(', ')} WHERE email = ?`;
    const res = await env.DB.prepare(sql).bind(...binds).run();

    // Проверяем, действительно ли запись существует теперь в таблице
    let userRow = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(userEmail).first();

    if (!userRow) {
      // Если строки нет — создаём её, подставляя обязательные поля из KV
      const kvRaw = await env.USERS_KV.get(`user:${userEmail}`);
      let kv = {};
      try { kv = kvRaw ? JSON.parse(kvRaw) : {}; } catch (e) { kv = {}; }

      const password_hash = kv.password ?? ''; // в вашем KV пароль хранится под ключом 'password'
      const id = kv.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}`);
      const created_at = kv.created ? new Date(kv.created).toISOString() : new Date().toISOString();

      // Выполняем INSERT (включаем обязательные поля id, email, password_hash)
      await env.DB.prepare(
        `INSERT INTO users (id, email, password_hash, name, avatar_icon, avatar_image_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, userEmail, password_hash, name ?? null, avatar_icon ?? null, avatar_image_url ?? null, created_at).run();

      // Теперь подтянем строку
      userRow = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(userEmail).first();

      if (!userRow) {
        return new Response(JSON.stringify({ error: 'User not found or insert failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // Возвращаем актуальную запись
    const userFull = await env.DB.prepare(
      'SELECT id, email, name, avatar_icon, avatar_image_url, created_at FROM users WHERE email = ?'
    ).bind(userEmail).first();

    return new Response(JSON.stringify({ ok: true, user: userFull }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (e) {
    console.error('PUT /me error:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};