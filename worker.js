import { RateLimitDO } from './RateLimitDO.js';
import { incrementView } from './viewsCounter.js';

export { RateLimitDO };

// --- CORS настройка ---
const allowedOrigins = [
  'https://sakovvolfsnitko-e6deet01q-alexandr-snitkos-projects.vercel.app',
  'https://sakovvolfsnitko.vercel.app',
  'https://saviorasn.vercel.app',
  'https://saviorasn-alexandr-snitkos-projects.vercel.app',
  'https://vercel.com/alexandr-snitkos-projects/saviora.app/deployments',
  'https://saviora-pwa-alexandr-snitkos-projects.vercel.app',
  'https://saviora-pwa.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://telegram.bot',
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

function buildRateHeaders(rateLimitResult, corsHeaders, fallbackLimit, fallbackWindowMs) {
  const limit = rateLimitResult?.limit ?? fallbackLimit;
  const resetAt = rateLimitResult?.resetAt ?? (Date.now() + (fallbackWindowMs ?? 60000));
  const remaining = Math.max(0, rateLimitResult?.remaining ?? 0);

  return {
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetAt),
    ...corsHeaders,
  };
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

const DIALOG_SYSTEM_PROMPT = `Ты — аналитик снов, работающий с принципом многослойности смыслов. Каждый элемент сна может иметь несколько разных значений. Твоя задача — помочь человеку самому раскрыть эти слои через простые вопросы.

⚠️ ЖЕЛЕЗНОЕ ПРАВИЛО: ОДИН ВОПРОС = ОДНО СООБЩЕНИЕ
═══════════════════════════════════════════

═══════════════════════════════════════════
🎯 РАБОТА ТОЛЬКО С ЗАДАННЫМ ФРАГМЕНТОМ
═══════════════════════════════════════════

✅ Задавай вопросы ТОЛЬКО о элементах, которые ЕСТЬ в этом фрагменте
❌ НЕ используй информацию из других частей сна
❌ НЕ придумывай элементы или эмоции

Пример ОШИБКИ:
Фрагмент: "Тяжёлые пакеты с батоном. Вдалеке старая электричка."
❌ "Почему продукты для бабушки?" — бабушки НЕТ в фрагменте!
❌ "Что ты боялся испортить?" — человек НЕ говорил о страхе!
✅ "Что для тебя значит тяжесть пакетов?" — есть в фрагменте

═══════════════════════════════════════════
🎯 РАЗНООБРАЗИЕ ТИПОВ ВОПРОСОВ
═══════════════════════════════════════════

⚠️ Использование одного шаблона 3 раза подряд = ОШИБКА

10 типов для чередования:
1. "Что для тебя значит [образ]?"
2. "Какие ощущения вызывает [образ]?"
3. "Что ты чувствовал, когда [действие]?"
4. "С чем у тебя связан [образ]?"
5. "Кто для тебя [персонаж]?"
6. "Что происходит с тобой, когда [событие]?"
7. "Как бы ты описал [ощущение]?"
8. "Почему именно [Х], а не [другое]?" — ТОЛЬКО для выборов
9. "Какие воспоминания всплывают с [образ]?"
10. "Где ещё в жизни ты встречал [ощущение]?"

⚠️ "ПОЧЕМУ?" — ОСТОРОЖНО:
❌ НЕ для характеристик: "Почему старая?", "Почему синий?"
✅ Только для выборов: "Почему именно батон был важен?"
✅ Для характеристик используй: "Что для тебя означает старость?", "С чем связан синий цвет?"

═══════════════════════════════════════════
🎯 РАБОТА С БОГАТЫМИ ОТВЕТАМИ — КЛЮЧЕВОЕ ПРАВИЛО!
═══════════════════════════════════════════

Признаки богатого ответа:
✓ Сильные эмоции (страх, злость, радость)
✓ Противоречие ("хочу и боюсь")
✓ Несколько тем в одном ответе
✓ Яркие метафоры
✓ Длиннее 15 слов с деталями

АЛГОРИТМ:
1. ОСТАНОВИСЬ — не спеши к новому элементу!
2. Выдели 1-2 самые важные темы из ответа
3. Задай 1-2 углубляющих вопроса РАЗНЫМИ типами
4. ПОТОМ переходи к новому элементу фрагмента

❌ ПЛОХО:
Человек: "Безразличие, будто меня не существует, но если обратит внимание — накажут"
Система: "Почему электричка старая?" [игнор богатого ответа]

✅ ПРАВИЛЬНО:
Человек: "Безразличие, будто меня не существует, но если обратит внимание — накажут"
Система: "Что происходит с тобой, когда ты невидим?" [ТИП 6: развитие темы]
Человек: [ответ]
Система: "Где ещё ты чувствовал страх наказания?" [ТИП 10: вторая тема]
Человек: [ответ]
Система: "С чем у тебя связана старость электрички?" [ТИП 4: теперь новый элемент]

═══════════════════════════════════════════
🎯 СВЯЗЫВАНИЕ ОБРАЗОВ
═══════════════════════════════════════════

После 3-4 элементов задай 1-2 вопроса о СВЯЗЯХ:

• "Как для тебя связаны [А] и [Б]?"
• "Есть что-то общее между [А] и [Б]?"
• "Что объединяет [ощущение от А] и [ощущение от Б]?"

⚠️ Используй слова САМОГО человека:
✅ "Как связаны скользкий перрон и то, что ты подвёл бабушку?" [человек говорил "подвёл"]
❌ "Как связаны скользкий перрон и твоя вина?" [человек не говорил "вина"]

═══════════════════════════════════════════
🎯 АБСОЛЮТНЫЕ ЗАПРЕТЫ
═══════════════════════════════════════════

❌ 1. НЕ ДАВАЙ ГОТОВЫХ ПЕРЕВОДОВ В ЖИЗНЬ:
Плохо: "Что в работе похоже на тяжёлые пакеты?"
Хорошо: "Какие ощущения вызывают тяжёлые пакеты?"

❌ 2. НЕ ПРИПИСЫВАЙ ЭМОЦИИ/СМЫСЛЫ:
Плохо: "Почему самый яркий страх был..." [человек не говорил о страхе]
Хорошо: "Что ты чувствовал в тот момент?"

❌ 3. НЕ ИСПОЛЬЗУЙ ПРЕАМБУЛЫ/ОЦЕНКИ:
Плохо: "Отлично! Контроль — это ключ. А теперь..."
Хорошо: Сразу вопрос без вступлений

❌ 4. НЕ ИСПОЛЬЗУЙ ПСИХОЛОГИЧЕСКИЙ ЖАРГОН:
Плохо: "Это только одна из возможных оболочек...", "скрытая мысль", "вина"
Хорошо: Простой язык: "Что для тебя...", "Какие ощущения..."

❌ 5. НЕ НАВЯЗЫВАЙ ГОТОВЫЕ МЕТАФОРЫ:
Плохо: "Скользкий перрон = трудно двигаться. Где ещё так?"
Хорошо: "Что для тебя значит скользить?"

═══════════════════════════════════════════
🎯 РАБОТА С ОТВЕТАМИ ПРО ЖИЗНЬ
═══════════════════════════════════════════

Если человек САМ дал связь с жизнью:

ЖЁСТКИЙ АЛГОРИТМ:
1. Задай МАКСИМУМ 1-2 вопроса про эту связь (разными типами)
2. ОБЯЗАТЕЛЬНО вернись к элементам ФРАГМЕНТА сна

❌ ПЛОХО (Диалог 2):
Человек: "На работе присваивают успехи"
Система: "Как реагируешь?" → "Что важнее — признание или справедливость?" → "Что в карьере тяжёлое?" [3 вопроса про работу!]

✅ ПРАВИЛЬНО:
Человек: "На работе присваивают успехи"
Система: "Что чувствуешь в такие моменты?" [1 вопрос]
Человек: [ответ]
Система: "Что происходит с тобой, когда голос пропадает?" [ВОЗВРАТ К СНУ]

═══════════════════════════════════════════
🎯 РАБОТА С "НЕ ЗНАЮ"
═══════════════════════════════════════════

При 1-м "не знаю": Переключись на ДРУГОЙ элемент фрагмента + ДРУГОЙ тип вопроса
При 2-м "не знаю": Вопрос о физическом ощущении или связи образов
При 3-м "не знаю": Признак закольцовывания

Пример:
Человек: "Не знаю"
✅ Система: "Какие ощущения вызывает синий цвет?" [новый элемент + другой тип]

═══════════════════════════════════════════
🎯 ЧТО ИССЛЕДОВАТЬ (ЧЕКЛИСТ ФРАГМЕНТА)
═══════════════════════════════════════════

□ Основные образы (транспорт, здания, предметы)
□ Люди и персонажи (характеристики, действия)
□ Места (характер, атмосфера)
□ Физические ощущения (тяжесть, скольжение)
□ Действия и результаты
□ ЦВЕТА! (особенно важно)
□ Размеры и состояния (старый, пустой)
□ Конкретные предметы
□ Эмоции в моменте
□ Голос и коммуникация
□ Числа
□ Части тела
□ Связи между образами (после 3-4 элементов)

═══════════════════════════════════════════
🎯 СТРАТЕГИЯ АНАЛИЗА
═══════════════════════════════════════════

ФАЗА 1 (4-5 вопросов): Исследуй РАЗНЫЕ элементы, разными типами. Если ответ богатый — останавливайся, углубляй.

ФАЗА 2 (3-4 вопроса): Вернись к элементам с НАИБОЛЬШИМ эмоциональным откликом. Если связь с жизнью — макс 1-2 вопроса, потом возврат к сну.

ФАЗА 3 (2-3 вопроса): Связывай образы. "Как для тебя связаны [А] и [Б]?"

ФАЗА 4: Исследуй оставшиеся элементы фрагмента.

═══════════════════════════════════════════
🎯 ПРОВЕРКА ПЕРЕД КАЖДЫМ ВОПРОСОМ
═══════════════════════════════════════════

1. ✅ Это ОДИН вопрос?
2. ✅ Элемент ЕСТЬ в фрагменте?
3. ✅ НЕ использовал этот тип в последних 2 сообщениях?
4. ✅ Если ответ богатый — развил его (1-2 вопроса)?
5. ✅ НЕ даю готовой интерпретации?
6. ✅ НЕ приписываю эмоции/смыслы?
7. ✅ БЕЗ преамбул и оценок?
8. ✅ После 3-4 элементов — спросил о связях?
9. ✅ Связь с жизнью — макс 1-2 вопроса, потом возврат к сну?

═══════════════════════════════════════════

ТВОЯ ЗАДАЧА: Помочь человеку раскрыть слои смысла через короткие, разнообразные вопросы о ФРАГМЕНТЕ. Развивай богатые ответы. Связывай образы. Не интерпретируй — только спрашивай.`;


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

const BLOCK_INTERPRETATION_PROMPT_DAILY = `Составь итоговое толкование этого блока повседневной беседы (3–6 предложений), используя rolling summary и сам текст блока.
Не продолжай диалог, а выдай итоговое толкование блока на основе всей доступной информации.
Кратко обозначь, о чём был разговор, какой в нём эмоциональный фон и какие возникли важные мысли или внутренние противоречия.
Мягко предложи возможные направления для дальнейших размышлений или обсуждения, если это уместно.
Не повторяй и не цитируй текст блока, не пересказывай его дословно. Не задавай пользователю вопросов.
Избегай любых психоаналитических понятий и сложного профессионального жаргона.
Выведи только чистый связный текст без заголовков, без кода, без тегов, без списков и без JSON.`;

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
Ты — внимательный психолог и арт‑терапевт. 
Твоя задача — помочь человеку осмыслить произведение искусства в контексте его внутреннего мира и текущего диалога.

Правила ответа:
- Пиши на русском языке.
- Отвечай обычным связным текстом, без JSON, без списков, без разметки кода.
- Можно использовать абзацы, но не делай маркированных списков.
- Не повторяй дословно формулировки инструкций, говори естественно и по‑человечески.

В ответе обязательно:
1) Кратко опиши, что за образ перед тобой и какая в нём атмосфера.
2) Опиши возможные эмоции и внутренние состояния, которые может отражать это произведение.
3) Поговори о возможной символике (что могут означать цвета, композиция, сюжет).
4) Свяжи произведение с внутренним миром пользователя и тем, о чём шёл диалог.
5) Заверши мягкой, поддерживающей мыслью или вопросом, который помогает двинуться глубже.
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

// =============================
// 🏆 СИСТЕМА БЕЙДЖЕЙ
// =============================

const BADGES = {
  // Категория: Первые шаги
  first_dream: {
    id: 'first_dream',
    name: 'Первый сон',
    emoji: '🎯',
    category: 'first_steps',
    description: 'Записал первый сон',
    condition: (data) => data.totalDreams >= 1,
  },
  first_interpretation: {
    id: 'first_interpretation',
    name: 'Первая мысль',
    emoji: '💭',
    category: 'first_steps',
    description: 'Первая интерпретация',
    condition: (data) => data.breakdownCounts.interpreted >= 1,
  },
  first_artwork: {
    id: 'first_artwork',
    name: 'Первый образ',
    emoji: '🎨',
    category: 'first_steps',
    description: 'Первый артворк',
    condition: (data) => data.breakdownCounts.artworks >= 1,
  },
  first_dialog: {
    id: 'first_dialog',
    name: 'Первый диалог',
    emoji: '💬',
    category: 'first_steps',
    description: 'Первый диалог с AI',
    condition: (data) => data.breakdownCounts.dialogs >= 1,
  },
  first_insight: {
    id: 'first_insight',
    name: 'Первый инсайт',
    emoji: '📊',
    category: 'first_steps',
    description: 'Получил первый инсайт',
    condition: (data) => data.insights >= 1,
  },

  // Категория: Постоянство
  streak_7: {
    id: 'streak_7',
    name: 'Неделя силы',
    emoji: '🔥',
    category: 'consistency',
    description: 'Стрик 7 дней',
    condition: (data) => data.streak >= 7,
  },
  streak_30: {
    id: 'streak_30',
    name: 'Месяц мастерства',
    emoji: '🌟',
    category: 'consistency',
    description: 'Стрик 30 дней',
    condition: (data) => data.streak >= 30,
  },
  habit_10: {
    id: 'habit_10',
    name: 'Привычка',
    emoji: '💪',
    category: 'consistency',
    description: '10 снов за месяц',
    condition: (data) => data.totalDreams >= 10,
  },

  // Категория: Глубина
  analyst_10: {
    id: 'analyst_10',
    name: 'Аналитик',
    emoji: '🧠',
    category: 'depth',
    description: '10 интерпретаций',
    condition: (data) => data.breakdownCounts.interpreted >= 10,
  },
  philosopher_10: {
    id: 'philosopher_10',
    name: 'Философ',
    emoji: '🎭',
    category: 'depth',
    description: '10 диалогов',
    condition: (data) => data.breakdownCounts.dialogs >= 10,
  },
  visionary_10: {
    id: 'visionary_10',
    name: 'Визионер',
    emoji: '🖼️',
    category: 'depth',
    description: '10 артворков',
    condition: (data) => data.breakdownCounts.artworks >= 10,
  },
  collector_20: {
    id: 'collector_20',
    name: 'Коллекционер',
    emoji: '💎',
    category: 'depth',
    description: '20 инсайтов',
    condition: (data) => data.insights >= 20,
  },
  philosopher_50: {
  id: 'philosopher_50',
  name: 'Великий мыслитель',
  emoji: '🏛️',
  category: 'depth',
  description: '50 диалогов с AI',
  condition: (data) => data.breakdownCounts.dialogs >= 50,
},
visionary_50: {
  id: 'visionary_50',
  name: 'Мастер образов',
  emoji: '🌌',
  category: 'depth',
  description: '50 артворков',
  condition: (data) => data.breakdownCounts.artworks >= 50,
},
collector_100: {
  id: 'collector_100',
  name: 'Хранитель мудрости',
  emoji: '📜',
  category: 'depth',
  description: '100 инсайтов',
  condition: (data) => data.insights >= 100,
},

  // Категория: Мастерство
  perfectionist: {
    id: 'perfectionist',
    name: 'Перфекционист',
    emoji: '🏆',
    category: 'mastery',
    description: 'Depth Score 100% за неделю',
    condition: (data) => data.depthScore >= 100,
  },
  full_immersion: {
    id: 'full_immersion',
    name: 'Полное погружение',
    emoji: '🌈',
    category: 'mastery',
    description: 'Использовал все фичи за период',
    condition: (data) => 
      data.breakdownCounts.interpreted > 0 &&
      data.breakdownCounts.artworks > 0 &&
      data.breakdownCounts.dialogs > 0 &&
      data.insights > 0,
  },
  guru: {
    id: 'guru',
    name: 'Гуру',
    emoji: '🎓',
    category: 'mastery',
    description: '50 снов + 50 интерпретаций',
    condition: (data) => 
      data.totalDreams >= 50 && 
      data.breakdownCounts.interpreted >= 50,
  },
};

// Уровни
const LEVELS = [
  { min: 0, max: 100, name: 'Новичок', emoji: '🌱', color: '#9CA3AF' },
  { min: 101, max: 300, name: 'Мечтатель', emoji: '🌙', color: '#3B82F6' },
  { min: 301, max: 600, name: 'Исследователь', emoji: '🔍', color: '#8B5CF6' },
  { min: 601, max: 1000, name: 'Аналитик', emoji: '✨', color: '#F59E0B' },
  { min: 1001, max: 1500, name: 'Философ', emoji: '🧠', color: '#EC4899' },
  { min: 1501, max: 2000, name: 'Визионер', emoji: '👁️', color: '#8B5CF6' },
  { min: 2001, max: 2500, name: 'Мастер', emoji: '🧘', color: '#10B981' },
  { min: 2501, max: 3000, name: 'Гуру', emoji: '🌟', color: '#FBBF24' },
];

// =============================
// 📊 РАСЧЁТ DEPTH SCORE
// =============================

function calculateDepthScore(data) {
  const { totalDreamsInPeriod, breakdownCounts, streak } = data;

  if (totalDreamsInPeriod === 0) return 0;

  // Базовые очки за каждый сон
  let score = totalDreamsInPeriod * 50; // 3 сна × 50 = 150

  // Бонусы за интерпретации (очень важно)
  score += (breakdownCounts.interpreted || 0) * 100; // 0 × 100 = 0

  // Бонусы за диалоги (важно)
  score += (breakdownCounts.dialogs || 0) * 80; // 3 × 80 = 240

  // Бонусы за артворки (средне)
  score += (breakdownCounts.artworks || 0) * 60; // 2 × 60 = 120

  // Бонусы за стрик (мотивация)
  score += streak * 20; // 0 × 20 = 0

  // Бонусы за саммари (если есть)
  score += (breakdownCounts.summarized || 0) * 40;

  return Math.min(Math.round(score), 3000); // максимум 3000
}

// =============================
// 🎯 ОПРЕДЕЛЕНИЕ УРОВНЯ
// =============================

function getLevel(depthScore) {
  return LEVELS.find(level => depthScore >= level.min && depthScore <= level.max) || LEVELS[0];
}

// =============================
// 🏆 ПРОВЕРКА И РАЗБЛОКИРОВКА БЕЙДЖЕЙ
// =============================

async function checkAndUnlockBadges(d1, userEmail, dashboardData) {
  const now = Date.now();
  const unlockedBadges = [];
  const newBadges = [];

  const existingBadgesRes = await d1
    .prepare('SELECT badge_id, unlocked_at, seen_at FROM user_badges WHERE user_email = ?')
    .bind(userEmail)
    .all();

  const existingBadgeIds = new Set(
    (existingBadgesRes?.results || []).map(r => r.badge_id)
  );

  const unseenBadgeIds = (existingBadgesRes?.results || [])
    .filter(r => r.seen_at === null)
    .map(r => r.badge_id);

  // ✅ объявляем Map ДО цикла
  const unlockedAtById = new Map(
    (existingBadgesRes?.results || []).map(r => [r.badge_id, r.unlocked_at ?? null])
  );

  for (const [badgeId, badge] of Object.entries(BADGES)) {
    const isUnlocked = badge.condition(dashboardData);

    if (isUnlocked) {
      unlockedBadges.push(badgeId);

      if (!existingBadgeIds.has(badgeId)) {
        await d1
          .prepare('INSERT INTO user_badges (user_email, badge_id, unlocked_at) VALUES (?, ?, ?)')
          .bind(userEmail, badgeId, now)
          .run();

        newBadges.push(badgeId);
        unlockedAtById.set(badgeId, now);
      }
    }
  }

  return {
    unlocked: unlockedBadges,
    new: newBadges,
    unseen: unseenBadgeIds,
    unlockedAtById,
  };
}

// =============================
// 🎯 ОПРЕДЕЛЕНИЕ СЛЕДУЮЩЕЙ ЦЕЛИ
// =============================

function getNextGoal(level, unlockedBadges, dashboardData) {
  const unlockedSet = new Set(unlockedBadges);

  const goalPriority = {
  'Новичок': ['first_interpretation', 'first_artwork', 'first_dialog'],
  'Мечтатель': ['streak_7', 'habit_10', 'first_dialog'],
  'Исследователь': ['philosopher_10', 'collector_20', 'analyst_10'],
  'Аналитик': ['full_immersion', 'perfectionist', 'visionary_10'],
  'Философ': ['guru', 'streak_30', 'philosopher_50'],
  'Визионер': ['visionary_50', 'collector_100', 'perfectionist'],
  'Мастер': ['guru', 'streak_30', 'full_immersion'],
  'Гуру': ['guru', 'perfectionist', 'streak_30'],
};

  const priorities = goalPriority[level.name] || [];

  for (const badgeId of priorities) {
    if (!unlockedSet.has(badgeId)) {
      const badge = BADGES[badgeId];
      return {
        badgeId,
        name: badge.name,
        emoji: badge.emoji,
        description: badge.description,
        progress: calculateBadgeProgress(badgeId, dashboardData),
      };
    }
  }

  for (const [badgeId, badge] of Object.entries(BADGES)) {
    if (!unlockedSet.has(badgeId)) {
      return {
        badgeId,
        name: badge.name,
        emoji: badge.emoji,
        description: badge.description,
        progress: calculateBadgeProgress(badgeId, dashboardData),
      };
    }
  }

  return null;
}

// =============================
// 📈 РАСЧЁТ ПРОГРЕССА ДО БЕЙДЖА
// =============================

function calculateBadgeProgress(badgeId, data) {
  const progressMap = {
    first_dream: { current: data.totalDreams, target: 1 },
    first_interpretation: { current: data.breakdownCounts.interpreted, target: 1 },
    first_artwork: { current: data.breakdownCounts.artworks, target: 1 },
    first_dialog: { current: data.breakdownCounts.dialogs, target: 1 },
    first_insight: { current: data.insights, target: 1 },
    streak_7: { current: data.streak, target: 7 },
    streak_30: { current: data.streak, target: 30 },
    habit_10: { current: data.totalDreams, target: 10 },
    analyst_10: { current: data.breakdownCounts.interpreted, target: 10 },
    philosopher_10: { current: data.breakdownCounts.dialogs, target: 10 },
    visionary_10: { current: data.breakdownCounts.artworks, target: 10 },
    collector_20: { current: data.insights, target: 20 },
    philosopher_50: { current: data.breakdownCounts.dialogs, target: 50 },
    visionary_50: { current: data.breakdownCounts.artworks, target: 50 },
    collector_100: { current: data.insights, target: 100 },
    perfectionist: { current: data.depthScore, target: 100 }, // ✅ оставляем один
    full_immersion: { 
      current: [
        data.breakdownCounts.interpreted > 0,
        data.breakdownCounts.artworks > 0,
        data.breakdownCounts.dialogs > 0,
        data.insights > 0,
      ].filter(Boolean).length,
      target: 4,
    },
    guru: { 
      current: Math.min(data.totalDreams, data.breakdownCounts.interpreted),
      target: 50,
    },
  };

  return progressMap[badgeId] || { current: 0, target: 1 };
}

// =============================
// 💡 ГЕНЕРАЦИЯ СОВЕТА
// =============================

function generateAdvice(level, nextGoal, dashboardData) {
  const adviceMap = {
    first_interpretation: 'Интерпретация помогает понять смысл сна. Попробуй проанализировать свой последний сон!',
    first_artwork: 'Визуализация снов помогает лучше их запомнить. Создай артворк для своего сна!',
    first_dialog: 'Диалоги помогают раскрыть скрытые смыслы снов. Задай вопросы AI о своём сне!',
    first_insight: 'Инсайты показывают паттерны в твоих снах. Исследуй раздел "Инсайты"!',
    streak_7: 'Записывай сны каждое утро — это поможет лучше их запоминать и сформирует привычку.',
    streak_30: 'Ты на пути к мастерству! Продолжай записывать сны каждый день.',
    habit_10: 'Регулярная запись снов помогает лучше понимать себя. Продолжай в том же духе!',
    analyst_10: 'Глубокий анализ снов раскрывает их истинный смысл. Интерпретируй больше снов!',
    philosopher_10: 'Диалоги помогают задать правильные вопросы. Общайся с AI чаще!',
    visionary_10: 'Визуальное мышление развивает креативность. Создавай больше артворков!',
    collector_20: 'Инсайты помогают найти паттерны. Исследуй свои сны глубже!',
    perfectionist: 'Используй все инструменты для каждого сна — это даст максимальную пользу.',
    full_immersion: 'Попробуй использовать все инструменты для одного сна: интерпретацию, артворк, диалог и инсайты.',
    guru: 'Ты почти мастер! Продолжай исследовать свои сны с помощью всех инструментов.',
  };

  return nextGoal ? adviceMap[nextGoal.badgeId] || 'Продолжай исследовать свои сны!' : 'Ты разблокировал все достижения! 🎉';
}

// --- Функции для работы с rolling summary ---

// Получить summary с количеством обработанных сообщений
async function getRollingSummary(env, user, dreamId, blockId, artworkId = null) {
  let sql = `
    SELECT summary, last_message_count
    FROM dialog_summaries
    WHERE user = ? AND dream_id = ? AND block_id = ?
  `;
  const params = [user, dreamId, blockId];

  if (artworkId) {
    sql += ` AND artwork_id = ?`;
    params.push(artworkId);
  }

  const row = await env.DB.prepare(sql).bind(...params).first();

  return row
    ? {
        summary: row.summary,
        lastMessageCount: row.last_message_count || 0,
      }
    : null;
}

// Сохранить summary с количеством обработанных сообщений
// --- Сохранить summary с количеством обработанных сообщений ---
async function saveRollingSummary(env, user, dreamId, blockId, summary, lastMessageCount, artworkId = null) {
  console.log("[saveRollingSummary] Saving:", { user, dreamId, blockId, artworkId, lastMessageCount });
  const d1 = env.DB;
  const now = Date.now();

  // ✅ ВКЛЮЧАЕМ artworkId в уникальный ключ
  const uniqueId = artworkId 
    ? `${user}__${dreamId}__${blockId}__${artworkId}`
    : `${user}__${dreamId}__${blockId}`;

  try {
    const result = await d1.prepare(
      `INSERT INTO dialog_summaries (id, user, dream_id, block_id, summary, updated_at, last_message_count, artwork_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         summary = excluded.summary,
         updated_at = excluded.updated_at,
         last_message_count = excluded.last_message_count,
         artwork_id = excluded.artwork_id`
    ).bind(
      uniqueId,           // ✅ используем новый uniqueId
      user,
      dreamId,
      blockId,
      summary,
      now,
      lastMessageCount,
      artworkId
    ).run();

    console.log("[saveRollingSummary] Success:", result);
    return result;
  } catch (e) {
    console.error("[saveRollingSummary] ERROR:", e);
    throw e;
  }
}

// Обновить rolling summary
async function updateRollingSummary(
  env,
  user,
  dreamId,
  blockId,
  baseText,
  apiKey,          // используем как DeepSeek API key
  artworkId
) {
  console.log("[updateRollingSummary] START:", { user, dreamId, blockId, artworkId });
  const d1 = env.DB;

  // 1. Текущее summary
  const currentSummary = await getRollingSummary(env, user, dreamId, blockId, artworkId);
  const lastMessageCount = currentSummary?.lastMessageCount || 0;

  console.log("[updateRollingSummary] Current state:", {
    hasSummary: !!currentSummary?.summary,
    lastMessageCount
  });

  // 2. Берём все сообщения для этого диалога
  let query = `
    SELECT role, content
    FROM messages
    WHERE user = ? AND dream_id = ? AND block_id = ?
  `;
  const params = [user, dreamId, blockId];

  if (artworkId) {
    query += ` AND artwork_id = ?`;
    params.push(artworkId);
  }

  query += ` ORDER BY created_at ASC`;

  const allMessagesRes = await d1.prepare(query).bind(...params).all();
  const allMessages = allMessagesRes.results || [];
  const newMessageCount = allMessages.length - lastMessageCount;

  console.log("[updateRollingSummary] Messages:", {
    total: allMessages.length,
    new: newMessageCount
  });

  // 3. Проверяем порог, если он у тебя где-то объявлен
  if (typeof SUMMARY_UPDATE_THRESHOLD === "number" &&
      newMessageCount < SUMMARY_UPDATE_THRESHOLD &&
      currentSummary?.summary) {
    console.log("[updateRollingSummary] Threshold not reached, skipping");
    return currentSummary.summary;
  }

  if (allMessages.length === 0) {
    console.log("[updateRollingSummary] No messages, skipping");
    return currentSummary?.summary || "";
  }

  // 4. Берём только новые сообщения
  const newMessages = allMessages.slice(lastMessageCount);

  if (newMessages.length === 0 && currentSummary?.summary) {
    console.log("[updateRollingSummary] No new messages, skipping");
    return currentSummary.summary;
  }

  // 5. Текст блока
  const blockText = baseText || "";

  // 6. Формируем промпт
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

  console.log("[updateRollingSummary] Calling DeepSeek...");

  // 7. Вызываем DeepSeek
  const deepseekRequestBody = {
    model: "deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 300,
    temperature: 0.3,
    stream: false
  };

  const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}` // apiKey как deepseekApiKey
    },
    body: JSON.stringify(deepseekRequestBody)
  });

  if (!deepseekResponse.ok) {
    const text = await deepseekResponse.text();
    console.error("[updateRollingSummary] DeepSeek error:", deepseekResponse.status, text);
    return currentSummary?.summary || "";
  }

  const responseBody = await deepseekResponse.json();
  const updatedSummary =
    (responseBody &&
      responseBody.choices &&
      responseBody.choices[0] &&
      responseBody.choices[0].message &&
      responseBody.choices[0].message.content &&
      responseBody.choices[0].message.content.trim()) ||
    currentSummary?.summary ||
    "";

  console.log("[updateRollingSummary] DeepSeek response length:", updatedSummary.length);

  // 8. Сохраняем обновлённый summary
  console.log("[updateRollingSummary] Saving summary, message count:", allMessages.length);

  await saveRollingSummary(
    env,
    user,
    dreamId,
    blockId,
    updatedSummary,
    allMessages.length,
    artworkId
  );

  console.log("[updateRollingSummary] DONE");
  return updatedSummary;
}

async function getUnprocessedMessages(env, user, dreamId, blockId, artworkId = null) {
  // 1) Берём записанное summary
  let summarySql = `
    SELECT summary, last_message_count
    FROM dialog_summaries
    WHERE user = ? AND dream_id = ? AND block_id = ?
  `;
  const summaryParams = [user, dreamId, blockId];

  if (artworkId) {
    summarySql += ` AND artwork_id = ?`;
    summaryParams.push(artworkId);
  }

  const summaryRow = await env.DB.prepare(summarySql).bind(...summaryParams).first();
  const lastProcessed = summaryRow?.last_message_count || 0;

  // 2) Берём все сообщения
  let msgSql = `
    SELECT role, content
    FROM messages
    WHERE user = ? AND dream_id = ? AND block_id = ?
  `;
  const msgParams = [user, dreamId, blockId];

  if (artworkId) {
    msgSql += ` AND artwork_id = ?`;
    msgParams.push(artworkId);
  }

  msgSql += ` ORDER BY created_at ASC`;

  const unprocessedRows = await env.DB.prepare(msgSql).bind(...msgParams).all();
  const allMessages = unprocessedRows.results || [];
  const unprocessed = allMessages.slice(lastProcessed);

  return {
    rollingSummary: summaryRow?.summary || "",
    unprocessedMessages: unprocessed,
    totalCount: allMessages.length,
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
  let systemPrompt;
  if (blockType === 'art') {
    systemPrompt = ART_BLOCK_INTERPRETATION_PROMPT;
  } else {
    systemPrompt = BLOCK_INTERPRETATION_PROMPT_DAILY;
  }

  const deepseekRequestBody = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
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
  let content = json.choices?.[0]?.message?.content || '';

  content = content.replace(/```[\s\S]*?```/g, '').trim();

  if (blockType === 'art') {
    let cleaned = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*$/g, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch {
      return {};
    }
  }
  content = content.replace(/^["'`]+|["'`]+$/g, '').trim();
  return content;
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

async function getOrCreateUserRowByEmail(env, email) {
  if (!email) {
    console.warn('[getOrCreateUserRowByEmail] email is empty');
    return null;
  }

  // Нормализация email
  email = email.trim().toLowerCase();
  console.log('[getOrCreateUserRowByEmail] Normalized email:', email);

  // 1) пробуем найти в D1
  let row = await env.DB
    .prepare('SELECT id, email, password_hash, created_at FROM users WHERE LOWER(email) = ?')
    .bind(email)
    .first();

  console.log('[getOrCreateUserRowByEmail] D1 row:', row);

  if (row && row.id) {
    return row;
  }

  // 2) если нет — достаём из KV
  const userRaw = await env.USERS_KV.get(`user:${email}`);
  console.log('[getOrCreateUserRowByEmail] KV lookup:', userRaw ? 'found' : 'NOT FOUND');

  if (!userRaw) {
    console.warn('[getOrCreateUserRowByEmail] User not in KV:', email);
    return null;
  }

  let kv;
  try {
    kv = JSON.parse(userRaw);
  } catch (e) {
    console.error('[getOrCreateUserRowByEmail] KV parse error:', e);
    kv = {};
  }

  const password_hash = kv.password ?? '';
  const createdMs = kv.created ?? Date.now();
  const created_at = new Date(createdMs).toISOString();

  // 🆕 Генерация UUID
  const id = crypto.randomUUID();

  console.log('[getOrCreateUserRowByEmail] Attempting insert:', { id, email });

  // 3) создаём запись в D1
  try {
    await env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, name, avatar_icon, avatar_image_url, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, ?)`
    )
      .bind(id, email, password_hash, created_at)
      .run();

    console.log('[getOrCreateUserRowByEmail] Insert successful');
  } catch (e) {
    console.error('[getOrCreateUserRowByEmail] Insert error:', e);
    const msg = String(e?.message || e);
    if (!msg.includes('UNIQUE constraint failed: users.email')) {
      throw e;
    }
    console.log('[getOrCreateUserRowByEmail] UNIQUE conflict, will re-read');
  }

  // 4) возвращаем актуальную строку из D1
  row = await env.DB
    .prepare('SELECT id, email, password_hash, created_at FROM users WHERE LOWER(email) = ?')
    .bind(email)
    .first();

  console.log('[getOrCreateUserRowByEmail] Final row:', row);

  if (!row || !row.id) {
    console.error('[getOrCreateUserRowByEmail] CRITICAL: Failed to create/retrieve user');
    return null;
  }

  return row;
}

// ----------------------------
// Subscription helpers
// ----------------------------
async function getVisiblePlans(env) {
  const res = await env.DB.prepare(
    `SELECT id, plan_code, title, description, price, emoji, visible, created_at, updated_at
     FROM subscription_plans
     WHERE visible = 1
     ORDER BY CAST(price AS REAL) ASC`
  ).all();
  return (res?.results || []);
}

async function createSubscriptionChoice(env, userEmail, payload = {}) {
  // payload: { plan_id, plan_code, chosen_emoji, chosen_price, is_custom_price, trial_days_left, source, notes }
  const id = crypto.randomUUID();
  const now = Date.now();

  const {
    plan_id = null,
    plan_code = null,
    chosen_emoji = null,
    chosen_price = null,
    is_custom_price = 0,
    trial_days_left = null,
    source = null,
    notes = null
  } = payload;

  await env.DB.prepare(`
    INSERT INTO user_subscription_choices
      (id, user_id, plan_id, plan_code, chosen_emoji, chosen_price, is_custom_price, trial_days_left, modal_open_count, selection_count, confirmed_purchase, purchase_timestamp, purchase_amount, source, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    userEmail,
    plan_id,
    plan_code,
    chosen_emoji,
    chosen_price,
    is_custom_price ? 1 : 0,
    trial_days_left,
    0,    // modal_open_count
    1,    // selection_count (first selection)
    0,    // confirmed_purchase
    null, // purchase_timestamp
    null, // purchase_amount
    source,
    notes,
    now,
    now
  ).run();

  const row = await env.DB.prepare('SELECT * FROM user_subscription_choices WHERE id = ?').bind(id).first();
  return row ?? null;
}

async function incrementModalOpenCount(env, userEmail, opts = {}) {
  // opts: { choice_id } -- если есть, инкрементим ту запись; иначе создаём lightweight запись "modal_open"
  if (opts.choice_id) {
    const res = await env.DB.prepare(`
      UPDATE user_subscription_choices
      SET modal_open_count = COALESCE(modal_open_count, 0) + 1, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).bind(Date.now(), opts.choice_id, userEmail).run();
    return res;
  } else {
    const id = crypto.randomUUID();
    const now = Date.now();
    await env.DB.prepare(`
      INSERT INTO user_subscription_choices
        (id, user_id, plan_id, plan_code, chosen_emoji, chosen_price, is_custom_price, trial_days_left, modal_open_count, selection_count, confirmed_purchase, purchase_timestamp, purchase_amount, source, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userEmail,
      null,
      'modal_open',
      null,
      null,
      0,
      null,
      1,   // modal_open_count
      0,   // selection_count
      0,   // confirmed_purchase
      null,
      null,
      'modal', // source
      null,
      now,
      now
    ).run();
    const row = await env.DB.prepare('SELECT * FROM user_subscription_choices WHERE id = ?').bind(id).first();
    return row ?? null;
  }
}

async function confirmPurchaseForChoice(env, userEmail, choiceId, purchaseAmountText) {
  const ts = Date.now();
  const res = await env.DB.prepare(`
    UPDATE user_subscription_choices
    SET confirmed_purchase = 1, purchase_timestamp = ?, purchase_amount = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).bind(ts, purchaseAmountText, ts, choiceId, userEmail).run();
  return res;
}

async function getUserSubscriptionChoices(env, userEmail, limit = 50) {
  const res = await env.DB.prepare(`
    SELECT * FROM user_subscription_choices
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(userEmail, limit).all();
  return res?.results || [];
}

// ===== Personal goals helpers =====

async function getUserIdByEmail(env, email) {
  const row = await getOrCreateUserRowByEmail(env, email);
  return row?.id || null;
}

async function createGoal(env, userEmail, body) {
  const userId = await getUserIdByEmail(env, userEmail);
  if (!userId) throw new Error('User not found in DB');

  const id = crypto.randomUUID();
  const {
    title,
    description,
    category,
    goalType,
    targetCount,
    unit,
    period,
    startDate,
    dueDate
  } = body;

  await env.DB.prepare(
    `INSERT INTO personal_goals
     (id, user_id, title, description, category, goal_type, target_count, unit, period, start_date, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    userId,
    title,
    description ?? null,
    category ?? null,
    goalType,
    targetCount ?? null,
    unit ?? null,
    period ?? null,
    startDate,
    dueDate ?? null
  ).run();

  return { id };
}

async function getGoalsWithProgress(env, userEmail) {
  const userId = await getUserIdByEmail(env, userEmail);
  if (!userId) throw new Error('User not found in DB');

  const stmt = env.DB.prepare(
    `SELECT
       g.id          AS goal_id,
       g.title,
       g.description,
       g.category,
       g.goal_type,
       g.target_count,
       g.unit,
       g.period,
       g.start_date,
       g.due_date,
       g.status,
       g.created_at,
       g.updated_at,
       COALESCE(SUM(e.amount), 0) AS total_done,
       CASE
         WHEN g.target_count IS NOT NULL AND g.target_count > 0
           THEN ROUND(100.0 * COALESCE(SUM(e.amount), 0) / g.target_count, 1)
         ELSE NULL
       END AS progress_percent
     FROM personal_goals g
     LEFT JOIN personal_goal_events e
       ON e.goal_id = g.id
       AND e.user_id = g.user_id
     WHERE g.user_id = ?
     GROUP BY g.id
     ORDER BY g.created_at DESC`
  );

  const res = await stmt.bind(userId).all();
  return res.results ?? [];
}

async function addGoalEvent(env, userEmail, goalId, body) {
  const userId = await getUserIdByEmail(env, userEmail);
  if (!userId) throw new Error('User not found in DB');

  const amount = body.amount ?? 1;
  const eventDate = body.eventDate ?? Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    `INSERT INTO personal_goal_events
     (goal_id, user_id, event_date, amount)
     VALUES (?, ?, ?, ?)`
  ).bind(goalId, userId, eventDate, amount).run();

  return { ok: true };
}

async function getGoalsTimeline(env, userEmail, range) {
  const now = Math.floor(Date.now() / 1000); // секунды
  let from;

  switch (range) {
    case '7d':
      from = now - 7 * 24 * 3600;
      break;
    case '30d':
      from = now - 30 * 24 * 3600;
      break;
    case '60d':
      from = now - 60 * 24 * 3600;
      break;
    case '90d':
      from = now - 90 * 24 * 3600;
      break;
    case '365d':
      from = now - 365 * 24 * 3600;
      break;
    case 'all':
    default:
      from = 0;
  }

  const userId = await getUserIdByEmail(env, userEmail);
  if (!userId) throw new Error('User not found in DB');

  const totalTargetRow = await env.DB
    .prepare(
      `SELECT COALESCE(SUM(target_count), 0) AS total_target
       FROM personal_goals
       WHERE user_id = ?
         AND (status IS NULL OR status != 'archived')`
    )
    .bind(userId)
    .first();

  const totalTarget = Number(totalTargetRow?.total_target || 0);

  const stmt = env.DB.prepare(
    `WITH daily AS (
       SELECT
         DATE(event_date, 'unixepoch') AS d,
         SUM(amount) AS daily_amount
       FROM personal_goal_events
       WHERE user_id = ?
         AND event_date BETWEEN ? AND ?
       GROUP BY DATE(event_date, 'unixepoch')
     ),
     cum AS (
       SELECT
         d,
         SUM(daily_amount) OVER (ORDER BY d) AS cumulative_amount
       FROM daily
     )
     SELECT d AS date, cumulative_amount
     FROM cum
     ORDER BY d`
  );

  const res = await stmt.bind(userId, from, now).all();
  const rows = res.results ?? [];

  if (totalTarget > 0) {
    return rows.map(r => ({
      date: r.date,
      cumulative_amount: r.cumulative_amount,
      percent: Math.max(
        0,
        Math.min(100, Math.round((r.cumulative_amount / totalTarget) * 100)),
      ),
    }));
  }

  return rows;
}

// =============================
// ✅ AUTHENTICATION HELPER
// =============================

/**
 * Извлекает email пользователя из Bearer-токена и проверяет tokenVersion
 * @param {Request} request
 * @param {Object} env - Cloudflare env (с USERS_KV)
 * @returns {Promise<string|null>} - email или null
 */
async function getUserEmail(request, env) {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  let payload;
  try {
    payload = await verifyToken(token, env.JWT_SECRET);
  } catch (e) {
    console.error('[getUserEmail] verifyToken error:', e);
    return null;
  }

  if (!payload?.email) return null;

  // Проверяем tokenVersion
  const userRaw = await env.USERS_KV.get(`user:${payload.email}`);
  if (!userRaw) return null;

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return null;
  }

  const currentTv = user.tokenVersion ?? 0;
  if (typeof payload.tv !== 'number' || payload.tv !== currentTv) {
    return null; // токен устарел
  }

  return payload.email;
}

// robust DO client
async function checkRateLimitDO(env, key, maxRequests, windowMs) {
  const fallback = () => ({
    error: true,
    allowed: true, // чтобы старый код не ломался, если где-то не учитывается error
    count: 0,
    remaining: maxRequests,
    resetAt: Date.now() + windowMs,
  });

  if (!key) {
    // без ключа — как раньше, но без error
    return {
      allowed: true,
      count: 0,
      remaining: maxRequests,
      resetAt: Date.now() + windowMs,
    };
  }

  const normalized = String(key).trim().toLowerCase();
  const id = env.RATE_LIMIT_DO.idFromName(normalized);
  const obj = env.RATE_LIMIT_DO.get(id);

  try {
    const res = await obj.fetch('https://rate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hit', maxRequests, windowMs }),
    });

    if (!res.ok) {
      console.error('[checkRateLimitDO] DO returned non-ok status', res.status);
      return fallback();
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      console.error('[checkRateLimitDO] failed to parse DO response JSON', e);
      return fallback();
    }

    return {
      allowed: Boolean(data.allowed),
      count: Number.isFinite(data.count) ? data.count : 0,
      remaining: Number.isFinite(data.remaining)
        ? data.remaining
        : Math.max(0, maxRequests - (data.count || 0)),
      resetAt: Number.isFinite(data.resetAt) ? data.resetAt : Date.now() + windowMs,
    };
  } catch (e) {
    console.error('[checkRateLimitDO] error contacting DO:', e);
    return fallback();
  }
}

// middleware
async function withAuthAndRateLimit(request, env, corsHeaders = {}, options = {}) {
  const {
    skipTrial = false,
    maxRequests = 50,
    windowMs = 30000,
    requireRateLimit = false,
    rateKey,            // кастомный ключ, если нужно
    scope = 'endpoint', // 'endpoint' | 'user' | 'custom'
  } = options;

  // 1. Авторизация
  const userEmail = await getUserEmail(request, env);
  if (!userEmail) {
    return new Response(
      JSON.stringify({
        error: 'unauthorized',
        message: 'Invalid or missing authorization token',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  // 2. Trial
  if (!skipTrial && !(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  // 3. Формируем ключ для rate limit
  let key;
  if (rateKey) {
    key = rateKey;
  } else if (scope === 'user') {
    key = `user:${userEmail}`;
  } else {
    // scope === 'endpoint' по умолчанию: лимит на (user + endpoint)
    const url = new URL(request.url);
    key = `user:${userEmail}:${request.method}:${url.pathname}`;
  }

  // 4. Rate limit via DO
  const rateLimitResult = await checkRateLimitDO(env, key, maxRequests, windowMs);

  // 4a. DO сломался, а для эндпоинта требуем рабочий лимитер → fail-close, не зовём DeepSeek
  if (rateLimitResult.error && requireRateLimit) {
    return new Response(
      JSON.stringify({
        error: 'rate_limiter_unavailable',
        message: 'Rate limiter is temporarily unavailable, please try again later',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  // 4b. Превышен лимит
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'rate_limit_exceeded',
        message: 'Too many requests',
        resetAt: rateLimitResult.resetAt,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult.remaining || 0)
          ),
          'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          'Retry-After': String(
            Math.max(
              0,
              Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
            )
          ),
          ...corsHeaders,
        },
      }
    );
  }

  // Всё ОК — возвращаем userEmail и rateLimitResult
  return { userEmail, rateLimitResult };
}

// ===== end Personal goals helpers =====

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // ✅ 1. ОБРАБОТКА OPTIONS (PREFLIGHT) — ПЕРВЫМ ДЕЛОМ!
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin') || '';
      const cors = buildCorsHeaders(origin);
      return new Response(null, { status: 204, headers: cors });
    }

    // ✅ 2. Теперь buildCorsHeaders для остальных запросов
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

    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // === PERSONAL GOALS API ===

    // GET /goals - список целей с прогрессом
if (url.pathname === '/goals' && request.method === 'GET') {
  // Мягкий лимит: 60 запросов за 60 секунд
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const goals = await getGoalsWithProgress(env, userEmail);

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ goals }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('GET /goals error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

    // POST /goals - создать цель
if (url.pathname === '/goals' && request.method === 'POST') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Invalid content type' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { title, goalType, startDate } = body || {};
  if (!title || !goalType || !startDate) {
    return new Response(
      JSON.stringify({
        error: 'title, goalType and startDate are required',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const resCreate = await createGoal(env, userEmail, body);

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ id: resCreate.id }), {
      status: 201,
      headers,
    });
  } catch (e) {
    console.error('POST /goals error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

    // POST /goals/:id/event - добавить событие (Сделать)
if (
  request.method === 'POST' &&
  pathParts.length === 3 &&
  pathParts[0] === 'goals' &&
  pathParts[2] === 'event'
) {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const goalId = pathParts[1];

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const resAdd = await addGoalEvent(env, userEmail, goalId, body || {});

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(resAdd), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('POST /goals/:id/event error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

    // PUT /goals/:id - обновить цель (включая target_count)
if (
  request.method === 'PUT' &&
  pathParts.length === 2 &&
  pathParts[0] === 'goals'
) {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const goalId = pathParts[1];

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const userId = await getUserIdByEmail(env, userEmail);
  if (!userId) {
    return new Response(JSON.stringify({ error: 'User not found in DB' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const {
    title,
    description,
    category,
    targetCount,
    unit,
    period,
    dueDate,
    status,
  } = body || {};

  try {
    const sets = [];
    const binds = [];

    if (typeof title !== 'undefined') {
      sets.push('title = ?');
      binds.push(title);
    }
    if (typeof description !== 'undefined') {
      sets.push('description = ?');
      binds.push(description);
    }
    if (typeof category !== 'undefined') {
      sets.push('category = ?');
      binds.push(category);
    }
    if (typeof targetCount !== 'undefined') {
      sets.push('target_count = ?');
      binds.push(targetCount);
    }
    if (typeof unit !== 'undefined') {
      sets.push('unit = ?');
      binds.push(unit);
    }
    if (typeof period !== 'undefined') {
      sets.push('period = ?');
      binds.push(period);
    }
    if (typeof dueDate !== 'undefined') {
      sets.push('due_date = ?');
      binds.push(dueDate);
    }
    if (typeof status !== 'undefined') {
      sets.push('status = ?');
      binds.push(status);
    }

    sets.push('updated_at = ?');
    binds.push(Date.now());

    binds.push(goalId, userId);

    const sql = `UPDATE personal_goals SET ${sets.join(
      ', '
    )} WHERE id = ? AND user_id = ?`;
    await env.DB.prepare(sql).bind(...binds).run();

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('PUT /goals/:id error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// DELETE /goals/:id - удалить цель
if (
  request.method === 'DELETE' &&
  pathParts.length === 2 &&
  pathParts[0] === 'goals'
) {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const goalId = pathParts[1];

  try {
    const userId = await getUserIdByEmail(env, userEmail);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'User not found in DB' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      });
    }

    // Удаляем все события цели
    await env.DB.prepare(
      'DELETE FROM personal_goal_events WHERE goal_id = ? AND user_id = ?'
    )
      .bind(goalId, userId)
      .run();

    // Удаляем саму цель
    const res = await env.DB.prepare(
      'DELETE FROM personal_goals WHERE id = ? AND user_id = ?'
    )
      .bind(goalId, userId)
      .run();

    if (res.changes === 0) {
      return new Response(JSON.stringify({ error: 'Goal not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('DELETE /goals/:id error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

    // GET /goals/timeline?range=7d
if (url.pathname === '/goals/timeline' && request.method === 'GET') {
  // Мягкий лимит: 60 запросов за 60 секунд
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const range = url.searchParams.get('range') || '30d';

  try {
    const points = await getGoalsTimeline(env, userEmail, range);

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ points }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('GET /goals/timeline error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}
    // --- AUTH: REGISTER ---
if (url.pathname === '/register' && request.method === 'POST') {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Invalid content type' }), {
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

  const { email, password } = body || {};
  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: 'Missing email or password' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  // Нормализуем email так же, как в checkRateLimitDO
  const normalizedEmail = String(email).trim().toLowerCase();

  // Лимит регистраций: 5 запросов за 60 секунд на один email
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimitDO(env, normalizedEmail, 5, 60000);
  } catch (e) {
    console.error('[REGISTER] rate limit error:', e);
    // fail-open: если DO лёг, не блокируем регистрацию
    rateLimitResult = {
      allowed: true,
      remaining: 5,
      resetAt: Date.now() + 60000,
    };
  }

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'rate_limit_exceeded',
        message: 'Too many registration attempts, please try again later.',
        resetAt: rateLimitResult.resetAt,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  const userKey = `user:${normalizedEmail}`;
  const existing = await env.USERS_KV.get(userKey);
  if (existing) {
    return new Response(JSON.stringify({ error: 'User already exists' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const hash = await hashPassword(password);
    const user = {
      email: normalizedEmail,
      password: hash,
      created: Date.now(),
      tokenVersion: 0,
    };
    await env.USERS_KV.put(userKey, JSON.stringify(user));

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers,
    });
  } catch (e) {
    console.error('Error during registration:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

    // --- AUTH: LOGIN ---
if (url.pathname === '/login' && request.method === 'POST') {
  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Invalid content type' }), {
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

  const { email, password } = body || {};
  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: 'Missing email or password' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  // Нормализуем email так же, как в /register
  const normalizedEmail = String(email).trim().toLowerCase();

  // Лимит логинов: 10 попыток за 60 секунд на один email
  let rateLimitResult;
  try {
    rateLimitResult = await checkRateLimitDO(env, normalizedEmail, 5, 60000);
  } catch (e) {
    console.error('[LOGIN] rate limit error:', e);
    // fail-open: не хотим ломать логин, если DO недоступен
    rateLimitResult = {
      allowed: true,
      remaining: 10,
      resetAt: Date.now() + 60000,
    };
  }

  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        error: 'rate_limit_exceeded',
        message: 'Too many login attempts, please try again later.',
        resetAt: rateLimitResult.resetAt,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  const userKey = `user:${normalizedEmail}`;
  const userRaw = await env.USERS_KV.get(userKey);
  if (!userRaw) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  let user;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return new Response(JSON.stringify({ error: 'User data corrupted' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const hash = await hashPassword(password);
    if (user.password !== hash) {
      return new Response(JSON.stringify({ error: 'Invalid password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  } catch (e) {
    console.error('Error hashing password:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  const now = Date.now();
  const trialPeriod = 365 * 24 * 60 * 60 * 1000;
  if (now - user.created > trialPeriod) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const tokenVersion = user.tokenVersion ?? 0;
  const payload = {
    email: normalizedEmail,
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    tv: tokenVersion,
  };
  const token = await createToken(payload, JWT_SECRET);

  const headers = {
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': String(
      Math.max(0, rateLimitResult.remaining ?? 0)
    ),
    'X-RateLimit-Reset': String(
      rateLimitResult.resetAt ?? Date.now() + 60000
    ),
    ...corsHeaders,
  };

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers,
  });
}

    // --- GET /me (заменить существующий блок) ---
if (url.pathname === '/me' && request.method === 'GET') {
  // Мягкий лимит: 60 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  // Берём метаданные из KV (регистрация, password и т.д.)
  const userRaw = await env.USERS_KV.get(`user:${userEmail}`);
  if (!userRaw) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  let kvUser = {};
  try {
    kvUser = JSON.parse(userRaw);
  } catch (e) {
    kvUser = {};
  }

  // Берём дополнительные поля из D1 (если есть)
  const userRow = await env.DB.prepare(
    'SELECT name, avatar_icon, avatar_image_url, created_at FROM users WHERE email = ?'
  )
    .bind(userEmail)
    .first();

  const name = userRow?.name ?? kvUser.name ?? null;
  const avatar_icon = userRow?.avatar_icon ?? kvUser.avatar_icon ?? null;
  const avatar_image_url =
    userRow?.avatar_image_url ?? kvUser.avatar_image_url ?? null;

  // Нормализуем created timestamp (KV хранит ms number, D1 может хранить ISO)
  const createdSrc = kvUser.created ?? userRow?.created_at ?? Date.now();
  const created =
    typeof createdSrc === 'number'
      ? createdSrc
      : new Date(createdSrc).getTime() || Date.now();

  const now = Date.now();
  const trialPeriod = 365 * 24 * 60 * 60 * 1000;
  const msLeft = (created || now) + trialPeriod - now;
  const daysLeft = Math.ceil(
    msLeft / (24 * 60 * 60 * 1000)
  );

  // Получаем последнюю подписку пользователя
  const subscriptionChoice = await env.DB.prepare(
    `
    SELECT usc.plan_id, sp.title, sp.emoji, sp.price
    FROM user_subscription_choices usc
    LEFT JOIN subscription_plans sp ON sp.id = usc.plan_id
    WHERE usc.user_id = ?
    ORDER BY usc.created_at DESC
    LIMIT 1
  `
  )
    .bind(userEmail)
    .first();

  const subscription_plan_id = subscriptionChoice?.plan_id ?? null;
  const subscription_plan_title = subscriptionChoice?.title ?? null;
  const subscription = subscriptionChoice
    ? {
        id: subscriptionChoice.plan_id,
        title: subscriptionChoice.title,
        emoji: subscriptionChoice.emoji,
        price: subscriptionChoice.price,
      }
    : null;

  const headers = {
    'Content-Type': 'application/json',
    'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
    'X-RateLimit-Remaining': String(
      Math.max(0, rateLimitResult?.remaining ?? 0)
    ),
    'X-RateLimit-Reset': String(
      rateLimitResult?.resetAt ?? Date.now() + 60000
    ),
    ...corsHeaders,
  };

  return new Response(
    JSON.stringify({
      email: userEmail,
      created,
      trialEndsAt: (created || now) + trialPeriod,
      trialDaysLeft: daysLeft,
      name,
      displayName: name, // ✅ ДОБАВЛЕНО: для совместимости с комментариями/лентой
      avatar_icon,
      avatarIcon: avatar_icon, // alias для фронтенда
      avatar_image_url,
      avatarImageUrl: avatar_image_url, // alias
      avatar: avatar_image_url || avatar_icon, // ✅ ДОБАВЛЕНО: приоритет image → icon для комментариев
      subscription_plan_id,
      subscription_plan_title,
      subscription,
    }),
    {
      status: 200,
      headers,
    }
  );
}

// ----------------------------
// SUBSCRIPTION API
// ----------------------------

// GET /plans
if (url.pathname === '/plans' && request.method === 'GET') {
  // Мягкий лимит: 60 запросов за 60 секунд
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { rateLimitResult } = authResult;

  try {
    const plans = await getVisiblePlans(env);

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ plans }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('GET /plans error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// POST /subscription/choice
if (url.pathname === '/subscription/choice' && request.method === 'POST') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Invalid content type' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  try {
    // expected body: { plan_id, plan_code, chosen_emoji, chosen_price, is_custom_price, trial_days_left, source, notes }
    const choice = await createSubscriptionChoice(env, userEmail, body || {});

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ ok: true, choice }), {
      status: 201,
      headers,
    });
  } catch (e) {
    console.error(
      'POST /subscription/choice error',
      e && (e.stack || e.message || e)
    );
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// POST /subscription/modal-open
if (url.pathname === '/subscription/modal-open' && request.method === 'POST') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    const row = await incrementModalOpenCount(env, userEmail, {
      choice_id: body?.choice_id || null,
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ ok: true, row }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error(
      'POST /subscription/modal-open error',
      e && (e.stack || e.message || e)
    );
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// POST /subscription/confirm
if (url.pathname === '/subscription/confirm' && request.method === 'POST') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { choiceId, purchaseAmount } = body || {};
  if (!choiceId) {
    return new Response(JSON.stringify({ error: 'choiceId required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  try {
    await confirmPurchaseForChoice(
      env,
      userEmail,
      choiceId,
      purchaseAmount ?? null
    );

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error(
      'POST /subscription/confirm error',
      e && (e.stack || e.message || e)
    );
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}
// GET /subscription/choices
if (url.pathname === '/subscription/choices' && request.method === 'GET') {
  // Мягкий лимит: 60 запросов за 60 секунд
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const choices = await getUserSubscriptionChoices(env, userEmail, 50);

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ choices }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error(
      'GET /subscription/choices error',
      e && (e.stack || e.message || e)
    );
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// --- MOODS API (multi-user) ---

    // Получить настроение за день
if (url.pathname.endsWith('/moods') && request.method === 'GET') {
  // Мягкий лимит: 60 запросов за 60 секунд
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const date = url.searchParams.get('date');
  if (!date) {
    return new Response(JSON.stringify({ error: 'date required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  try {
    const row = await env.DB.prepare(
      'SELECT context FROM moods WHERE user_email = ? AND date = ?'
    )
      .bind(userEmail, date)
      .first();

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(
      JSON.stringify({ context: row?.context ?? null }),
      {
        status: 200,
        headers,
      }
    );
  } catch (e) {
    console.error('[MOODS] GET error:', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'database_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}

    // Установить/обновить настроение за день
if (url.pathname.endsWith('/moods') && request.method === 'PUT') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { date, context } = body || {};
  if (!date || !context) {
    return new Response(
      JSON.stringify({ error: 'date and context required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    // Используем INSERT OR REPLACE для совместимости с текущей структурой
    await env.DB.prepare(
      `INSERT OR REPLACE INTO moods (user_email, date, context, updated_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    )
      .bind(userEmail, date, context)
      .run();

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('[MOODS] PUT error:', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'database_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}

    // Получить все настроения за месяц
if (url.pathname.endsWith('/moods/month') && request.method === 'GET') {
  // Мягкий лимит: 60 запросов за 60 секунд
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');
  if (!year || !month) {
    return new Response(
      JSON.stringify({ error: 'year and month required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const monthStr = String(month).padStart(2, '0');
    const rows = await env.DB.prepare(
      'SELECT date, context FROM moods WHERE user_email = ? AND date LIKE ?'
    )
      .bind(userEmail, `${year}-${monthStr}-%`)
      .all();

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ moods: rows.results }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('[MOODS] GET /month error:', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'database_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}
    // --- DREAMS API with D1 integration ---

if (url.pathname === '/dreams' && request.method === 'GET') {
  // Мягкий лимит: 60 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  try {
    const d1 = env.DB;
    const result = await d1
      .prepare('SELECT * FROM dreams WHERE user = ? ORDER BY date DESC')
      .bind(userEmail)
      .all();

    const dreams = await Promise.all(
      result.results.map(async (row) => {
        // Парсим blocks
        if (row.blocks) {
          try {
            row.blocks = JSON.parse(row.blocks);
          } catch {
            row.blocks = [];
          }
        } else {
          row.blocks = [];
        }

        // Загружаем similarArtworks из dream_similar_artworks + artworks
        const similarRes = await d1
          .prepare(
            `
          SELECT
            a.id AS artworkId,
            a.title,
            a.author,
            a.desc,
            a.value,
            a.type,
            dsa.position AS rank
          FROM dream_similar_artworks dsa
          JOIN artworks a ON dsa.artwork_id = a.id
          WHERE dsa.dream_id = ?
          ORDER BY dsa.position ASC
        `
          )
          .bind(row.id)
          .all();

        row.similarArtworks = (similarRes.results || []).map((art) => ({
          artworkId: art.artworkId,
          title: art.title,
          author: art.author,
          desc: art.desc,
          value: art.value,
          type: art.type,
          rank: art.rank,
          imageUrl: art.value, // для совместимости
        }));

        return normalizeDream(row);
      })
    );

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(dreams), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Error fetching dreams:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

if (url.pathname === '/dreams' && request.method === 'POST') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const validation = validateDreamData(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({
        error: 'Invalid dream data',
        message: validation.error,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  const { dreamText } = body;
  const id = crypto.randomUUID();
  const date = body.date && typeof body.date === 'number' && body.date > 0
  ? body.date
  : Date.now();
  try {
    const d1 = env.DB;
    await d1
      .prepare(
        `INSERT INTO dreams (id, user, title, dreamText, date, category, dreamSummary, globalFinalInterpretation, blocks, similarArtworks, context)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        userEmail,
        null,
        dreamText.trim(),
        date,
        null,
        null,
        null,
        JSON.stringify([]),
        JSON.stringify([]), // не используется, но оставляем для совместимости
        null
      )
      .run();

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
      similarArtworks: [], // будет заполнено при GET
      context: null,
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(dream), {
      status: 201,
      headers,
    });
  } catch (e) {
    console.error('Error inserting dream:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

if (request.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'dreams') {
  // Мягкий лимит: 60 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const id = pathParts[1];
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing dream id' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
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
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      });
    }

    // Парсим blocks
    if (row.blocks) {
      try {
        row.blocks = JSON.parse(row.blocks);
      } catch {
        row.blocks = [];
      }
    } else {
      row.blocks = [];
    }

    // Загружаем similarArtworks из dream_similar_artworks + artworks
    const similarRes = await d1
      .prepare(
        `
      SELECT
        a.id AS artworkId,
        a.title,
        a.author,
        a.desc,
        a.value,
        a.type,
        dsa.position AS rank
      FROM dream_similar_artworks dsa
      JOIN artworks a ON dsa.artwork_id = a.id
      WHERE dsa.dream_id = ?
      ORDER BY dsa.position ASC
    `
      )
      .bind(id)
      .all();

    row.similarArtworks = (similarRes.results || []).map((art) => ({
      artworkId: art.artworkId,
      title: art.title,
      author: art.author,
      desc: art.desc,
      value: art.value,
      type: art.type,
      rank: art.rank,
      imageUrl: art.value, // для совместимости
    }));

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(normalizeDream(row)), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Error fetching dream:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

if (url.pathname.match(/^\/dreams\/[^/]+$/) && request.method === 'DELETE') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const id = url.pathname.split('/')[2];
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing dream id' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  try {
    const d1 = env.DB;
    const result = await d1
      .prepare('DELETE FROM dreams WHERE id = ? AND user = ?')
      .bind(id, userEmail)
      .run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: 'Dream not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Error deleting dream:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

    // PUT /dreams/:dreamId/messages/:messageId/artwork_like
// pathParts example: ['dreams', '<dreamId>', 'messages', '<messageId>', 'artwork_like'] -> length === 5
if (
  request.method === 'PUT' &&
  pathParts.length === 5 &&
  pathParts[0] === 'dreams' &&
  pathParts[2] === 'messages' &&
  pathParts[4] === 'artwork_like'
) {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const dreamId = pathParts[1];
  const messageId = pathParts[3];

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { liked } = body || {};
  if (typeof liked !== 'boolean') {
    return new Response(
      JSON.stringify({ error: 'liked must be boolean' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const message = await toggleMessageArtworkInsight(env, {
      dreamId,
      messageId,
      liked,
      userEmail,
    });

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Сообщение не найдено' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
            'X-RateLimit-Remaining': String(
              Math.max(0, rateLimitResult?.remaining ?? 0)
            ),
            'X-RateLimit-Reset': String(
              rateLimitResult?.resetAt ?? Date.now() + 60000
            ),
            ...corsHeaders,
          },
        }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(
      JSON.stringify({
        id: message.id,
        role: message.role,
        content: message.content,
        meta: message.meta ? JSON.parse(message.meta) : {},
        createdAt: message.created_at,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error('toggle artwork like error', err && (err.stack || err.message || err));
    return new Response(
      JSON.stringify({ error: 'Не удалось сохранить инсайт' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// PUT /dreams/:dreamId/messages/:messageId/like
if (
  request.method === 'PUT' &&
  pathParts.length === 5 &&
  pathParts[0] === 'dreams' &&
  pathParts[2] === 'messages' &&
  pathParts[4] === 'like'
) {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const dreamId = pathParts[1];
  const messageId = pathParts[3];

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { liked } = body || {};
  if (typeof liked !== 'boolean') {
    return new Response(
      JSON.stringify({ error: 'liked must be boolean' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const message = await toggleMessageInsight(env, {
      dreamId,
      messageId,
      liked,
      userEmail,
    });

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Сообщение не найдено' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
            'X-RateLimit-Remaining': String(
              Math.max(0, rateLimitResult?.remaining ?? 0)
            ),
            'X-RateLimit-Reset': String(
              rateLimitResult?.resetAt ?? Date.now() + 60000
            ),
            ...corsHeaders,
          },
        }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(
      JSON.stringify({
        id: message.id,
        role: message.role,
        content: message.content,
        meta: message.meta ? JSON.parse(message.meta) : {},
        createdAt: message.created_at,
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (err) {
    console.error('toggle like error', err && (err.stack || err.message || err));
    return new Response(
      JSON.stringify({ error: 'Не удалось сохранить инсайт' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}
// PUT /daily_convos/:dailyConvoId/messages/:messageId/artwork_like
if (
  request.method === 'PUT' &&
  pathParts.length === 5 &&
  pathParts[0] === 'daily_convos' &&
  pathParts[2] === 'messages' &&
  pathParts[4] === 'artwork_like'
) {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const dailyConvoId = pathParts[1];
  const messageId = pathParts[3];

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { liked } = body || {};
  if (typeof liked !== 'boolean') {
    return new Response(
      JSON.stringify({ error: 'liked must be boolean' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const message = await toggleDailyMessageArtworkInsight(env, {
      dailyConvoId,
      messageId,
      liked,
      userEmail,
    });

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Сообщение не найдено' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
            'X-RateLimit-Remaining': String(
              Math.max(0, rateLimitResult?.remaining ?? 0)
            ),
            'X-RateLimit-Reset': String(
              rateLimitResult?.resetAt ?? Date.now() + 60000
            ),
            ...corsHeaders,
          },
        }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(
      JSON.stringify({
        id: message.id,
        role: message.role,
        content: message.content,
        meta: message.meta ? JSON.parse(message.meta) : {},
        createdAt: message.created_at,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error(
      'toggle daily artwork like error',
      err && (err.stack || err.message || err)
    );
    return new Response(
      JSON.stringify({ error: 'Не удалось сохранить инсайт' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}
// PUT /daily_convos/:dailyConvoId/messages/:messageId/like
if (
  request.method === 'PUT' &&
  pathParts.length === 5 &&
  pathParts[0] === 'daily_convos' &&
  pathParts[2] === 'messages' &&
  pathParts[4] === 'like'
) {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const dailyConvoId = pathParts[1];
  const messageId = pathParts[3];

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { liked } = body || {};
  if (typeof liked !== 'boolean') {
    return new Response(
      JSON.stringify({ error: 'liked must be boolean' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const message = await toggleDailyMessageInsight(env, {
      dailyConvoId,
      messageId,
      liked,
      userEmail,
    });

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Сообщение не найдено' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
            'X-RateLimit-Remaining': String(
              Math.max(0, rateLimitResult?.remaining ?? 0)
            ),
            'X-RateLimit-Reset': String(
              rateLimitResult?.resetAt ?? Date.now() + 60000
            ),
            ...corsHeaders,
          },
        }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(
      JSON.stringify({
        id: message.id,
        role: message.role,
        content: message.content,
        meta: message.meta ? JSON.parse(message.meta) : {},
        createdAt: message.created_at,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error(
      'toggle daily like error',
      err && (err.stack || err.message || err)
    );
    return new Response(
      JSON.stringify({ error: 'Не удалось сохранить инсайт' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// GET /dreams/:dreamId/insights
if (
  request.method === 'GET' &&
  pathParts.length === 3 &&
  pathParts[0] === 'dreams' &&
  pathParts[2] === 'insights'
) {
  // Мягкий лимит: 60 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const dreamId = pathParts[1];
  const urlObj = new URL(request.url);
  const metaKey = urlObj.searchParams.get('metaKey');

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
    const { results } = await env.DB.prepare(
      `
      SELECT id, content, meta, created_at
      FROM messages
      WHERE dream_id = ?
        AND user = ?
        ${filterClause}
      ORDER BY created_at DESC
    `
    )
      .bind(dreamId, userEmail)
      .all();

    const insights = (results ?? []).map((row) => {
      const meta = row.meta ? JSON.parse(row.meta) : {};
      const createdAt =
        typeof row.created_at === 'number'
          ? new Date(row.created_at).toISOString()
          : row.created_at;

      // Для совместимости: если metaKey=insightArtworksLiked, то insightLiked = insightArtworksLiked
      const artworksFlag = Boolean(
        meta.insightArtworksLiked ?? meta.insight_artworks_liked ?? 0
      );
      const likedFlag = Boolean(
        meta.insightLiked ??
          meta.insight_liked ??
          meta.liked ??
          meta.isFavorite ??
          meta.isInsight ??
          meta.favorite
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

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ insights }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('fetch insights error', err && (err.stack || err.message || err));
    return new Response(
      JSON.stringify({ error: 'Не удалось загрузить инсайты' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// GET /daily_convos/:id/insights
if (
  request.method === 'GET' &&
  pathParts.length === 3 &&
  pathParts[0] === 'daily_convos' &&
  pathParts[2] === 'insights'
) {
  // Мягкий лимит: 60 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const dailyId = pathParts[1];
  const urlObj = new URL(request.url);
  const metaKey = urlObj.searchParams.get('metaKey');

  const allowedFilters = {
    insightArtworksLiked: `CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1`,
    insightLiked: `CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1`,
  };

  const filterClause = allowedFilters[metaKey]
    ? `AND (${allowedFilters[metaKey]})`
    : `
    AND (
      CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1
      OR CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1
    )
  `;

  try {
    const { results } = await env.DB.prepare(
      `
      SELECT id, content, meta, created_at
      FROM messages
      WHERE dream_id = ? AND user = ? ${filterClause}
      ORDER BY created_at DESC
    `
    )
      .bind(dailyId, userEmail)
      .all();

    const insights = (results ?? []).map((row) => {
      const meta = row.meta ? JSON.parse(row.meta) : {};
      const createdAt =
        typeof row.created_at === 'number'
          ? new Date(row.created_at).toISOString()
          : row.created_at;

      const artworksFlag = Boolean(
        meta.insightArtworksLiked ?? meta.insight_artworks_liked ?? 0
      );
      const likedFlag = Boolean(
        meta.insightLiked ??
          meta.insight_liked ??
          meta.liked ??
          meta.isFavorite ??
          meta.isInsight ??
          meta.favorite
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

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ insights }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error(
      'GET /daily_convos/:id/insights error',
      err && (err.stack || err.message || err)
    );
    return new Response(
      JSON.stringify({ error: 'Не удалось загрузить инсайты' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}
// worker.js — добавить в конце fetch handler
if (url.pathname.endsWith('/mood') && request.method === 'PUT') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts.length < 3 || pathParts[pathParts.length - 2] !== 'dreams') {
    return new Response(JSON.stringify({ error: 'Invalid path' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const dreamId = pathParts[pathParts.length - 3];
  if (!dreamId) {
    return new Response(JSON.stringify({ error: 'Missing dreamId' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { context } = body || {};
  if (!context) {
    return new Response(JSON.stringify({ error: 'context required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  try {
    await env.DB.prepare(
      `UPDATE dreams SET context = ? WHERE id = ? AND user = ?`
    )
      .bind(context, dreamId, userEmail)
      .run();

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('[MOOD FOR DREAM] PUT error:', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'database_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}

    // PUT /dreams/:dreamId
if (url.pathname.match(/^\/dreams\/[^/]+$/) && request.method === 'PUT') {
  // Лимит: 60 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const validation = validateDreamData(body);
  if (!validation.valid) {
    return new Response(
      JSON.stringify({
        error: 'Invalid dream data',
        message: validation.error,
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  const id = url.pathname.split('/')[2];
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing dream id' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  try {
    const d1 = env.DB;
    const existing = await d1
      .prepare('SELECT * FROM dreams WHERE id = ? AND user = ?')
      .bind(id, userEmail)
      .first();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Dream not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      });
    }

    const {
  dreamText = existing.dreamText,
  title = existing.title,
  category = existing.category,
  dreamSummary = existing.dreamSummary,
  globalFinalInterpretation = existing.globalFinalInterpretation,
  blocks = existing.blocks ? JSON.parse(existing.blocks) : [],
  similarArtworks = undefined, // ✅ как раньше: можно передать из body
  context = existing.context,
} = body;

// ✅ Нормализация: в API массив, в DB строка
let similarArtworksArr = [];
if (Array.isArray(similarArtworks)) {
  similarArtworksArr = similarArtworks;
} else {
  // если клиент не прислал — берём из existing
  try {
    const parsed = JSON.parse(existing.similarArtworks || '[]');
    similarArtworksArr = Array.isArray(parsed) ? parsed : [];
  } catch {
    similarArtworksArr = [];
  }
}

const similarArtworksDb = JSON.stringify(similarArtworksArr);
const textChanged = existing.dreamText !== dreamText;

    await env.DB
      .prepare(
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
      )
      .bind(
        title,
        dreamText,
        category,
        dreamSummary,
        globalFinalInterpretation,
        JSON.stringify(blocks),
similarArtworksDb,
context,
        id,
        userEmail
      )
      .run();

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
similarArtworks: similarArtworksArr,      context,
      autoSummary: textChanged ? null : existing.autoSummary ?? null,
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(dream), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Error updating dream:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// --- DAILY CONVOS CRUD ---

// GET /daily_convos (list)
if (url.pathname === '/daily_convos' && request.method === 'GET') {
  // Мягкий лимит: 60 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const res = await env.DB
      .prepare(
        'SELECT * FROM daily_convos WHERE user = ? ORDER BY date DESC'
      )
      .bind(userEmail)
      .all();

    const items = (res.results || []).map((r) => {
      if (r.blocks) {
        try {
          r.blocks = JSON.parse(r.blocks);
        } catch {
          r.blocks = [];
        }
      } else {
        r.blocks = [];
      }
      return r;
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(items), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('GET /daily_convos error', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}

// POST /daily_convos (create)
if (url.pathname === '/daily_convos' && request.method === 'POST') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { notes, title } = body || {};
  if (!notes || typeof notes !== 'string') {
    return new Response(JSON.stringify({ error: 'notes required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const id = crypto.randomUUID();
  const date = Date.now();

  try {
    await env.DB.prepare(
      `
      INSERT INTO daily_convos (id, user, title, notes, date, blocks, globalFinalInterpretation, autoSummary, context)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        id,
        userEmail,
        title ?? null,
        notes.trim(),
        date,
        JSON.stringify([]),
        null,
        null,
        null
      )
      .run();

    const created = {
      id,
      user: userEmail,
      title: title ?? null,
      notes: notes.trim(),
      date,
      blocks: [],
      globalFinalInterpretation: null,
      autoSummary: null,
      context: null,
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(created), {
      status: 201,
      headers,
    });
  } catch (e) {
    console.error('POST /daily_convos error', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}

// GET /daily_convos/:id
if (
  request.method === 'GET' &&
  pathParts.length === 2 &&
  pathParts[0] === 'daily_convos'
) {
  // Мягкий лимит: 60 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const id = pathParts[1];

  try {
    const row = await env.DB.prepare(
      'SELECT * FROM daily_convos WHERE id = ? AND user = ?'
    )
      .bind(id, userEmail)
      .first();

    if (!row) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
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

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(row), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('GET /daily_convos/:id error', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 60),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}

// PUT /daily_convos/:id
if (
  request.method === 'PUT' &&
  pathParts.length === 2 &&
  pathParts[0] === 'daily_convos'
) {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const id = pathParts[1];

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const {
    notes,
    title,
    blocks,
    globalFinalInterpretation,
    autoSummary,
    context,
  } = body || {};

  try {
    const existing = await env.DB
      .prepare('SELECT * FROM daily_convos WHERE id = ? AND user = ?')
      .bind(id, userEmail)
      .first();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      });
    }

    // Используем старые значения, если новые не переданы
    const newNotes =
      typeof notes !== 'undefined' ? notes : existing.notes;
    const newTitle =
      typeof title !== 'undefined' ? title : existing.title;
    const newBlocks =
      typeof blocks !== 'undefined'
        ? JSON.stringify(blocks)
        : existing.blocks;
    const newGlobalFinalInterpretation =
      typeof globalFinalInterpretation !== 'undefined'
        ? globalFinalInterpretation
        : existing.globalFinalInterpretation;
    const newAutoSummary =
      typeof autoSummary !== 'undefined'
        ? autoSummary
        : existing.autoSummary;
    const newContext =
      typeof context !== 'undefined' ? context : existing.context;

    await env.DB
      .prepare(
        `
      UPDATE daily_convos
      SET title = ?, notes = ?, blocks = ?, globalFinalInterpretation = ?, autoSummary = ?, context = ?
      WHERE id = ? AND user = ?
    `
      )
      .bind(
        newTitle,
        newNotes,
        newBlocks,
        newGlobalFinalInterpretation,
        newAutoSummary,
        newContext,
        id,
        userEmail
      )
      .run();

    const row = await env.DB
      .prepare('SELECT * FROM daily_convos WHERE id = ? AND user = ?')
      .bind(id, userEmail)
      .first();

    if (row.blocks) {
      try {
        row.blocks = JSON.parse(row.blocks);
      } catch {
        row.blocks = [];
      }
    } else {
      row.blocks = [];
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(row), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('PUT /daily_convos/:id error', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}
// DELETE /daily_convos/:id
if (
  request.method === 'DELETE' &&
  pathParts.length === 2 &&
  pathParts[0] === 'daily_convos'
) {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;
  const id = pathParts[1];

  try {
    const res = await env.DB
      .prepare('DELETE FROM daily_convos WHERE id = ? AND user = ?')
      .bind(id, userEmail)
      .run();

    if (res.changes === 0) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('DELETE /daily_convos/:id error', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}

// --- CHAT: get history ---
if (url.pathname === '/chat' && request.method === 'GET') {
  // Мягкий лимит чтения: 50 запросов за 60 секунд
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 50,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const dreamId = url.searchParams.get('dreamId');
  const blockId = url.searchParams.get('blockId');

  if (!dreamId || !blockId) {
    return new Response(
      JSON.stringify({ error: 'Missing dreamId or blockId' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  try {
    const res = await env.DB.prepare(
      `SELECT id, role, content, created_at, meta
       FROM messages
       WHERE user = ? AND dream_id = ? AND block_id = ?
       ORDER BY created_at ASC`
    )
      .bind(userEmail, dreamId, blockId)
      .all();

    const messages = (res.results || []).map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      created_at: r.created_at,
      meta: r.meta ? JSON.parse(r.meta) : undefined,
    }));

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 50),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('GET /chat error:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- CHAT: append message ---
if (url.pathname === '/chat' && request.method === 'POST') {
  // Лимит: 25 запросов за 30 секунд, как /daily_chat и /art_chat
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 25,
    windowMs: 30000,
    requireRateLimit: true,
    // skipTrial: false
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { id, dreamId, blockId, role, content, meta } = body || {};
  if (!dreamId || !blockId || !role || !content || !['user', 'assistant'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const msgId = id || crypto.randomUUID();
  const createdAt = Date.now();

  try {
    await env.DB.prepare(
      `INSERT INTO messages (id, user, dream_id, block_id, role, content, created_at, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        msgId,
        userEmail,
        dreamId,
        blockId,
        role,
        String(content).slice(0, 12000),
        createdAt,
        meta ? JSON.stringify(meta) : null
      )
      .run();

    // >>> rolling summary for dream_chat: обновляем только на ответах ассистента
    if (role === 'assistant') {
      try {
        // Берём текст сна как базовый контекст
        const dreamRow = await env.DB.prepare(
          'SELECT dreamText FROM dreams WHERE id = ? AND user = ?'
        )
          .bind(dreamId, userEmail)
          .first();

        const dreamText = dreamRow?.dreamText || '';

        await updateRollingSummary(
          env,
          userEmail,
          dreamId,   // dream_id
          blockId,   // block_id
          dreamText, // базовый контекст сна
          env.DEEPSEEK_API_KEY,
          null       // artwork_id для обычного dream-чата всегда null
        );
      } catch (e) {
        console.warn('[POST /chat] Failed to update rolling summary:', e);
        // не ломаем ответ пользователю, просто логируем
      }
    }
    // <<< rolling summary for dream_chat

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 25, 30000);

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
        headers,
      }
    );
  } catch (e) {
    console.error('POST /chat error:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- CHAT: clear history for block ---
if (url.pathname === '/chat' && request.method === 'DELETE') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const dreamId = url.searchParams.get('dreamId');
  const blockId = url.searchParams.get('blockId');

  if (!dreamId || !blockId) {
    return new Response(
      JSON.stringify({ error: 'Missing dreamId or blockId' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const d1 = env.DB;

    await d1
      .prepare(
        `DELETE FROM messages WHERE user = ? AND dream_id = ? AND block_id = ?`
      )
      .bind(userEmail, dreamId, blockId)
      .run();

    await d1
      .prepare(
        `DELETE FROM dialog_summaries WHERE user = ? AND dream_id = ? AND block_id = ?`
      )
      .bind(userEmail, dreamId, blockId)
      .run();

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('DELETE /chat error:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// --- DAILY CHAT: GET /daily_chat?dailyConvoId=... ---
if (url.pathname === '/daily_chat' && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 50,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const dailyConvoId = url.searchParams.get('dailyConvoId');
  if (!dailyConvoId) {
    return new Response(JSON.stringify({ error: 'Missing dailyConvoId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    const res = await env.DB.prepare(
      `SELECT id, role, content, created_at, meta, artwork_id
       FROM messages
       WHERE user = ? AND dream_id = ?
       ORDER BY created_at ASC`
    )
      .bind(userEmail, dailyConvoId)
      .all();

    const messages = (res.results || []).map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      created_at: r.created_at,
      meta: r.meta ? JSON.parse(r.meta) : undefined,
      artworkId: r.artwork_id || null,
    }));

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 50),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('GET /daily_chat error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        details: e?.message || String(e),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- POST /daily_chat ---
if (url.pathname === '/daily_chat' && request.method === 'POST') {
  // Лимит: 25 запросов за 30 секунд
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 25,
    windowMs: 30000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

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
  const safeBlockId =
    typeof blockId === 'string' && blockId.length > 0 ? blockId : '';

  try {
    await env.DB.prepare(
      `INSERT INTO messages (id, user, dream_id, block_id, role, content, created_at, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        msgId,
        userEmail,
        dailyConvoId,
        safeBlockId,
        role,
        String(content).slice(0, 12000),
        createdAt,
        meta ? JSON.stringify(meta) : null
      )
      .run();

    // Обновляем rolling summary только для сообщений ассистента
    if (role === 'assistant') {
      try {
        const dailyRow = await env.DB.prepare(
          'SELECT notes FROM daily_convos WHERE id = ? AND user = ?'
        )
          .bind(dailyConvoId, userEmail)
          .first();

        const notesText = dailyRow?.notes || '';

        await updateRollingSummary(
          env,
          userEmail,
          dailyConvoId, // dream_id
          safeBlockId,  // block_id
          notesText,    // контекст
          env.DEEPSEEK_API_KEY,
          null          // artwork_id (null для daily_chat)
        );
      } catch (e) {
        console.warn('[POST /daily_chat] Failed to update summary:', e);
      }
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': '25',
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 30000
      ),
      ...corsHeaders,
    };

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
        headers,
      }
    );
  } catch (e) {
    console.error(
      'POST /daily_chat DB error',
      e && (e.stack || e.message || e)
    );
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        details: e?.message || String(e),
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
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const dailyConvoId = url.searchParams.get('dailyConvoId');
  if (!dailyConvoId) {
    return new Response(
      JSON.stringify({ error: 'Missing dailyConvoId' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
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

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('DELETE /daily_chat error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        details: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

   // --- Generate Auto Summary endpoint (асинхронный) ---
if (url.pathname === '/generate_auto_summary' && request.method === 'POST') {
  // Вызов middleware с rate limiting (жёстко требуем рабочий rate limiter)
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 5, // изменено с 3 на 5
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) {
    // Ошибка авторизации, trial, лимита или недоступен rate limiter
    return authResult;
  }

  const { userEmail, rateLimitResult } = authResult;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { dreamId, dreamText } = body;
  if (!dreamId || !dreamText) {
    return new Response(JSON.stringify({ error: 'Missing dreamId or dreamText' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Если уже есть autoSummary и текст сна не менялся — используем кэш,
    // но всё равно возвращаем актуальные rate-limit заголовки.
    if (existing.autoSummary && existing.dreamText === dreamText) {
      const headers = buildRateHeaders(rateLimitResult, corsHeaders, 5, 30000); // изменено с 3 на 5
      return new Response(JSON.stringify({ success: true, autoSummary: existing.autoSummary }), {
        status: 200,
        headers,
      });
    }

    const prompt = `Создай краткое резюме этого сновидения в 2-3 предложениях. Выдели ключевые элементы: персонажей, локации, действия и эмоции. Пиши кратко и по существу, без вопросов и обращений.\n\nТекст сна:\n${dreamText.slice(0, 4000)}`;

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'Ты создаёшь краткие резюме сновидений. Пиши нейтрально, кратко, только факты и ключевые образы.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.5,
      stream: false,
    };

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepseekRequestBody),
    });

    let responseBody = await deepseekResponse.json();
    let autoSummary = responseBody?.choices?.[0]?.message?.content || '';
    autoSummary = autoSummary
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim();

    await d1
      .prepare('UPDATE dreams SET autoSummary = ? WHERE id = ? AND user = ?')
      .bind(autoSummary, dreamId, userEmail)
      .run();

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 5, 30000); // изменено с 3 на 5
    return new Response(JSON.stringify({ success: true, autoSummary }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Error generating auto summary:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

/// --- Analyze endpoint (с rolling summary) ---
if (url.pathname === '/analyze' && request.method === 'POST') {
  // Вызов middleware с rate limiting (жёстко требуем рабочий rate limiter)
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 10, // изменено с 5 на 10
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) {
    // Ошибка авторизации, trial, лимита или недоступен rate limiter
    return authResult;
  }

  const { userEmail, rateLimitResult } = authResult;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({
          error: 'Invalid content type',
          message: 'Content-Type must be application/json',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const requestData = await request.json();
    const { blockText, lastTurns, extraSystemPrompt, dreamId, blockId, artworkId } = requestData;

    // Получаем rolling summary (с учетом artworkId)
    let rollingSummary = null;
    if (dreamId && blockId) {
      const summaryData = await getRollingSummary(env, userEmail, dreamId, blockId, artworkId ?? null);
      rollingSummary = summaryData?.summary || null;

      console.log('[analyze] Summary state:', {
        hasSummary: !!summaryData,
        dreamId,
        blockId,
        artworkId: artworkId ?? null,
      });

      // Проверяем, нужно ли обновить summary
      const d1 = env.DB;
      let countQuery =
        'SELECT COUNT(*) as count FROM messages WHERE user = ? AND dream_id = ? AND block_id = ?';
      const countParams = [userEmail, dreamId, blockId];

      if (artworkId) {
        countQuery += ' AND artwork_id = ?';
        countParams.push(artworkId);
      }

      const allMessagesRes = await d1.prepare(countQuery).bind(...countParams).first();
      const currentMessageCount = allMessagesRes?.count || 0;

      console.log('[analyze] Message count:', currentMessageCount);

      if (!summaryData && currentMessageCount >= 2) {
        console.log('[analyze] Creating initial summary');
        try {
          rollingSummary = await updateRollingSummary(
            env,
            userEmail,
            dreamId,
            blockId,
            blockText,
            env.DEEPSEEK_API_KEY,
            artworkId ?? null
          );
        } catch (e) {
          console.error('[analyze] Failed to create initial summary:', e);
        }
      } else if (summaryData) {
        const newMessageCount = currentMessageCount - summaryData.lastMessageCount;

        console.log('[analyze] New messages since last summary:', newMessageCount);

        if (newMessageCount >= SUMMARY_UPDATE_THRESHOLD) {
          console.log('[analyze] Updating summary');
          try {
            rollingSummary = await updateRollingSummary(
              env,
              userEmail,
              dreamId,
              blockId,
              blockText,
              env.DEEPSEEK_API_KEY,
              artworkId ?? null
            );
          } catch (e) {
            console.error('[analyze] Failed to update summary:', e);
          }
        }
      }
    }

    const isArtworkDialog = blockId?.startsWith('artwork__');
    const systemPrompt = isArtworkDialog ? ARTDIALOG_SYSTEM_PROMPT : DIALOG_SYSTEM_PROMPT;

    const messages = [];
    messages.push({ role: 'system', content: systemPrompt });

    const d1 = env.DB;
    let dreamSummary = null;
    let autoSummary = null;

    if (dreamId) {
      const dreamRow = await d1
        .prepare('SELECT dreamSummary, autoSummary FROM dreams WHERE id = ? AND user = ?')
        .bind(dreamId, userEmail)
        .first();

      if (dreamRow) {
        dreamSummary = dreamRow.dreamSummary || null;
        autoSummary = dreamRow.autoSummary || null;
      }
    }

    if (autoSummary) {
      messages.push({ role: 'system', content: `ВЫЖИМКА СНА:\n${autoSummary}` });
    }

    if (dreamSummary) {
      messages.push({
        role: 'system',
        content: `СУБЪЕКТИВНЫЙ КОНТЕКСТ ОТ ПОЛЬЗОВАТЕЛЯ:\n${dreamSummary}`,
      });
    }

    if (rollingSummary) {
      messages.push({ role: 'system', content: `ROLLING SUMMARY ДИАЛОГА:\n${rollingSummary}` });
    }

    messages.push({
      role: 'system',
      content: `ТЕКУЩИЙ БЛОК:\n${(blockText || '').slice(0, 4000)}`,
    });

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
      stream: false,
    };

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepseekRequestBody),
    });

    let responseBody = await deepseekResponse.json();
    let content = responseBody?.choices?.[0]?.message?.content || '';
    content = content.replace(/```[\s\S]*?```/g, '').trim();
    if (!content) content = responseBody?.choices?.[0]?.message?.content || '';
    responseBody.choices[0].message.content = content;

    // Корректные заголовки rate limit
    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 10, 30000); // изменено с 5 на 10

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error in analyze endpoint:', error);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: error.message || 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- Analyze daily convo (clone of /analyze, for daily_convos) ---
if (url.pathname === '/analyze_daily_convo' && request.method === 'POST') {
  // Вызов middleware с rate limiting (жёстко требуем рабочий rate limiter; trial пропускаем)
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    skipTrial: true,
    maxRequests: 10, // изменено с 5 на 10
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) {
    // Ошибка авторизации, лимита или недоступен rate limiter
    return authResult;
  }

  const { userEmail, rateLimitResult } = authResult;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({
          error: 'Invalid content type',
          message: 'Content-Type must be application/json',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const body = await request.json();
    const {
      notesText,
      lastTurns = [],
      extraSystemPrompt,
      dailyConvoId,
      blockId,
      autoSummary,
    } = body || {};

    if (!notesText || typeof notesText !== 'string') {
      return new Response(JSON.stringify({ error: 'No notesText' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
          messages.push({
            role: 'system',
            content: `ROLLING SUMMARY ДИАЛОГА:\n${summaryData.summary}`,
          });
        }
      } catch (e) {
        // non-fatal: log and continue
        console.warn('analyze_daily_convo: getRollingSummary failed', e);
      }
    }

    // main text
    messages.push({
      role: 'system',
      content: `ТЕКСТ:\n${(notesText || '').slice(0, 4000)}`,
    });

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
      stream: false,
    };

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepseekRequestBody),
    });

    let responseBody = await deepseekResponse.json();
    let content = responseBody?.choices?.[0]?.message?.content || '';
    content = content.replace(/```[\s\S]*?```/g, '').trim();
    responseBody.choices[0].message.content = content;

    // Корректные заголовки rate limit
    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 10, 30000); // изменено с 5 на 10

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('Error in /analyze_daily_convo:', err);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- Generate Auto Summary for Daily Convo ---
if (url.pathname === '/generate_auto_summary_daily_convo' && request.method === 'POST') {
  // Вызов middleware с rate limiting (жёстко требуем рабочий rate limiter)
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 5, // изменено с 3 на 5
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) {
    // Ошибка авторизации, trial, лимита или недоступен rate limiter
    return authResult;
  }

  const { userEmail, rateLimitResult } = authResult;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { dailyConvoId, notes } = body;
  if (!dailyConvoId || !notes) {
    return new Response(JSON.stringify({ error: 'Missing dailyConvoId or notes' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Если уже есть autoSummary и текст не менялся — возвращаем кэш, но с актуальными rate-limit заголовками
    if (existing.autoSummary && existing.notes === notes) {
      const headers = buildRateHeaders(rateLimitResult, corsHeaders, 5, 30000); // изменено с 3 на 5
      return new Response(JSON.stringify({ success: true, autoSummary: existing.autoSummary }), {
        status: 200,
        headers,
      });
    }

    const prompt = `Создай краткое резюме этой записи в 2-3 предложениях. Выдели ключевые элементы: события, эмоции, мысли. Пиши кратко и по существу.\n\nТекст записи:\n${notes.slice(
      0,
      4000
    )}`;

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'Ты создаёшь краткие резюме записей. Пиши нейтрально, кратко, только факты и ключевые образы.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.5,
      stream: false,
    };

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepseekRequestBody),
    });

    let responseBody = await deepseekResponse.json();
    let autoSummary = responseBody?.choices?.[0]?.message?.content || '';
    autoSummary = autoSummary
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim();

    await d1
      .prepare('UPDATE daily_convos SET autoSummary = ? WHERE id = ? AND user = ?')
      .bind(autoSummary, dailyConvoId, userEmail)
      .run();

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 5, 30000); // изменено с 3 на 5
    return new Response(JSON.stringify({ success: true, autoSummary }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Error generating auto summary for daily convo:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
  // Вызов middleware с rate limiting (жёстко требуем рабочий rate limiter)
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 2,
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) {
    // Ошибка авторизации, trial, лимита или недоступен rate limiter
    return authResult;
  }

  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json();
    const { dreamText, globalFinalInterpretation, blockInterpretations, dreamId } = body;

    if (!dreamText) {
      return new Response(JSON.stringify({ error: 'No dreamText' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const contextParts = [];
    contextParts.push(`Сюжет сна: """${dreamText}"`);
    if (globalFinalInterpretation && globalFinalInterpretation.trim()) {
      contextParts.push(`Итоговое толкование сна: """${globalFinalInterpretation.trim()}"`);
    }
    if (blockInterpretations && blockInterpretations.trim()) {
      contextParts.push(`Толкования блоков:\n${blockInterpretations.trim()}"`);
    }

    const contextText = contextParts.join('\n\n');

    const prompt = `Ты — эксперт по искусству и психоанализу. Всегда отвечай на ЧИСТОМ РУССКОМ ЯЗЫКЕ. На основе сна и его толкования подбери 5 произведений искусства, которые резонируют с образами и мотивами сна.

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
        {
          role: 'system',
          content: 'Ты эксперт по искусству. Отвечай только валидным JSON без дополнительного текста.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.7,
      stream: false,
    };

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepseekRequestBody),
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

    const similarArtworksRaw = works.slice(0, 5).map((w) => ({
      title: w.title || '',
      author: w.author || '',
      desc: w.desc || '',
      value: '',
      type: w.type || 'default',
    }));

    let similarArtworks = [];

    if (dreamId) {
      const d1 = env.DB;

      // Удаляем старые записи перед вставкой новых
      await d1
        .prepare(`DELETE FROM dream_similar_artworks WHERE dream_id = ?`)
        .bind(dreamId)
        .run();

      for (let i = 0; i < similarArtworksRaw.length; i++) {
        const art = similarArtworksRaw[i];

        // 1) Ищем или создаём artwork
        let artworkRow = await d1
          .prepare(`SELECT id FROM artworks WHERE title = ? AND author = ? AND type = ?`)
          .bind(art.title, art.author, art.type)
          .first();

        let artworkId;
        if (artworkRow) {
          artworkId = artworkRow.id;
        } else {
          artworkId = crypto.randomUUID();
          await d1
            .prepare(
              `INSERT INTO artworks (id, title, author, type, value, desc)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(artworkId, art.title, art.author, art.type, art.value, art.desc)
            .run();
        }

        // 2) Связываем с dream
        await d1
          .prepare(
            `INSERT INTO dream_similar_artworks (id, dream_id, artwork_id, position, score)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(crypto.randomUUID(), dreamId, artworkId, i, null)
          .run();

        // Добавляем artworkId в объект для клиента
        similarArtworks.push({
          ...art,
          artworkId,
        });
      }

      // Обновляем dreams.similarArtworks для кэша
      await d1
        .prepare(`UPDATE dreams SET similarArtworks = ? WHERE id = ? AND user = ?`)
        .bind(JSON.stringify(similarArtworks), dreamId, userEmail)
        .run();
    }

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 2, 30000);
    return new Response(JSON.stringify({ similarArtworks }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Error in /find_similar:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

 // --- Interpret block endpoint (ИСПРАВЛЕННЫЙ) ---
if (url.pathname === '/interpret_block' && request.method === 'POST') {
  // Установка лимита: 3 запроса за 30 секунд, жёстко требуем рабочий rate limiter
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 3,
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json();
    const { blockText, dreamId, blockId, artworkId } = body;

    if (!blockText) {
      return new Response(JSON.stringify({ error: 'No blockText' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const d1 = env.DB;
    let autoSummary = '';
    let dreamSummary = '';

    if (dreamId) {
      const dreamRow = await d1
        .prepare(`SELECT autoSummary, dreamSummary FROM dreams WHERE id = ? AND user = ?`)
        .bind(dreamId, userEmail)
        .first();

      if (dreamRow) {
        autoSummary = dreamRow.autoSummary || '';
        dreamSummary = dreamRow.dreamSummary || '';
      }
    }

    const { rollingSummary, unprocessedMessages } = await getUnprocessedMessages(
      env,
      userEmail,
      dreamId,
      blockId,
      artworkId ?? null
    );

    let unprocessedContext = '';
    if (unprocessedMessages.length > 0) {
      unprocessedContext = '\n\n### Последние сообщения диалога (после summary):\n';
      unprocessedMessages.forEach((msg) => {
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
      stream: false,
    };

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepseekRequestBody),
    });

    const responseBody = await deepseekResponse.json();
    let interpretation = responseBody?.choices?.[0]?.message?.content || '';
    interpretation = interpretation
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim();

    // Сохраняем толкование блока в messages с правильным meta
    if (dreamId && blockId && interpretation) {
      const msgId = crypto.randomUUID();
      const createdAt = Date.now();

      await d1
        .prepare(
          `INSERT INTO messages (id, user, dream_id, block_id, role, content, created_at, meta, artwork_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          msgId,
          userEmail,
          dreamId,
          blockId,
          'assistant',
          interpretation,
          createdAt,
          JSON.stringify({ kind: 'block_interpretation' }),
          artworkId ?? null
        )
        .run();

      // Также сохраняем в blocks для истории
      const dreamRow = await d1
        .prepare(`SELECT blocks FROM dreams WHERE id = ? AND user = ?`)
        .bind(dreamId, userEmail)
        .first();

      if (dreamRow) {
        let blocks = [];
        try {
          blocks = JSON.parse(dreamRow.blocks || '[]');
        } catch {
          blocks = [];
        }

        const blockIndex = blocks.findIndex((b) => b.id === blockId);
        if (blockIndex !== -1) {
          blocks[blockIndex].interpretation = interpretation;

          await d1
            .prepare(`UPDATE dreams SET blocks = ? WHERE id = ? AND user = ?`)
            .bind(JSON.stringify(blocks), dreamId, userEmail)
            .run();
        }
      }
    }

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 3, 30000);

    return new Response(
      JSON.stringify({
        interpretation,
        isBlockInterpretation: true,
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (e) {
    console.error('Error in /interpret_block:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// --- Interpret final endpoint (с rolling summary + необработанные сообщения по всем блокам) ---
if (url.pathname === '/interpret_final' && request.method === 'POST') {
  // Лимит: 3 запроса за 30 секунд, жёстко требуем рабочий rate limiter
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 3,
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json();
    const { dreamText, blocks, dreamId } = body;

    if (!dreamText) {
      return new Response(JSON.stringify({ error: 'No dreamText' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // 1. Загружаем autoSummary и dreamSummary
    const d1 = env.DB;
    let autoSummary = '';
    let dreamSummary = '';

    if (dreamId) {
      const dreamRow = await d1
        .prepare(`SELECT autoSummary, dreamSummary FROM dreams WHERE id = ? AND user = ?`)
        .bind(dreamId, userEmail)
        .first();

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
        const blockText = block.text || block.content || '';

        // Итоговая интерпретация — по сну целиком, artworkId не нужен
        const { rollingSummary, unprocessedMessages } = await getUnprocessedMessages(
          env,
          userEmail,
          dreamId,
          blockId
        );

        blocksContext += `\n\n### Блок ${i + 1}:\n${blockText}\n`;

        if (rollingSummary) {
          blocksContext += `**Контекст диалога (summary):**\n${rollingSummary}\n`;
        }

        if (unprocessedMessages.length > 0) {
          blocksContext += `**Последние сообщения:**\n`;
          unprocessedMessages.forEach((msg) => {
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
      stream: false,
    };

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepseekRequestBody),
    });

    const responseBody = await deepseekResponse.json();
    let interpretation = responseBody?.choices?.[0]?.message?.content || '';
    interpretation = interpretation
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim();

    // Сохраняем итоговое толкование в БД
    if (dreamId && interpretation) {
      await d1
        .prepare(
          `
        UPDATE dreams 
        SET globalFinalInterpretation = ?
        WHERE id = ? AND user = ?
      `
        )
        .bind(interpretation, dreamId, userEmail)
        .run();
    }

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 3, 30000);

    return new Response(JSON.stringify({ interpretation }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Error in /interpret_final:', e);
    return new Response(JSON.stringify({ error: 'internal_error', message: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

// --- Interpret final for daily convo WITH CONTEXT ---
if (url.pathname === '/interpret_final_daily_convo' && request.method === 'POST') {
  // Лимит: 2 запроса за 30 секунд, жёстко требуем рабочий rate limiter
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 2,
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json();
    const { notesText, dailyConvoId, blockId = 'main' } = body || {};

    if (!notesText || !dailyConvoId) {
      return new Response(JSON.stringify({ error: 'notesText and dailyConvoId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const d1 = env.DB;

    // 1. Получаем autoSummary
    let autoSummary = '';
    const dailyRow = await d1
      .prepare('SELECT autoSummary FROM daily_convos WHERE id = ? AND user = ?')
      .bind(dailyConvoId, userEmail)
      .first();

    if (dailyRow) {
      autoSummary = dailyRow.autoSummary || '';
    }

    // 2. Получаем rolling summary + необработанные сообщения
    const { rollingSummary, unprocessedMessages } = await getUnprocessedMessages(
      env,
      userEmail,
      dailyConvoId,
      blockId
    );

    let unprocessedContext = '';
    if (unprocessedMessages.length > 0) {
      unprocessedContext = '\n\n### Последние сообщения диалога:\n';
      unprocessedMessages.forEach((msg) => {
        const label = msg.role === 'user' ? 'Пользователь' : 'Ассистент';
        unprocessedContext += `${label}: ${msg.content}\n`;
      });
    }

    // 3. Формируем промпт
    const prompt = `${FINAL_INTERPRETATION_PROMPT_DAILY}

ВЫЖИМКА ЗАПИСИ:
${autoSummary || 'Не указана'}

ТЕКСТ ЗАПИСИ:
${notesText.slice(0, 4000)}

КОНТЕКСТ ДИАЛОГА (ROLLING SUMMARY):
${rollingSummary || 'Диалог только начался'}
${unprocessedContext}

Создай целостное итоговое толкование, учитывая весь контекст диалога.`;

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
      stream: false,
    };

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepseekRequestBody),
    });

    const responseBody = await deepseekResponse.json();
    let interpretation = responseBody?.choices?.[0]?.message?.content || '';
    interpretation = interpretation
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim();

    // 4. Сохраняем в БД
    if (interpretation) {
      await d1
        .prepare(
          `UPDATE daily_convos SET globalFinalInterpretation = ? WHERE id = ? AND user = ?`
        )
        .bind(interpretation, dailyConvoId, userEmail)
        .run();
    }

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 2, 30000);

    return new Response(JSON.stringify({ interpretation }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('Error in /interpret_final_daily_convo:', err);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- Interpret block for daily convo ---
if (url.pathname === '/interpret_block_daily_convo' && request.method === 'POST') {
  // Лимит: 3 запроса за 30 секунд, жёстко требуем рабочий rate limiter
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 3,
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await request.json();
    const { notesText, blockType = 'dialog' } = body || {};

    if (!notesText || typeof notesText !== 'string') {
      return new Response(JSON.stringify({ error: 'No notesText' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const interpretation = await interpretBlock(env, notesText, blockType);

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 3, 30000);

    return new Response(JSON.stringify({ interpretation }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('Error in /interpret_block_daily_convo:', err);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- Interpret block for daily convo WITH CONTEXT ---
if (url.pathname === '/interpret_block_daily_convo_context' && request.method === 'POST') {
  // Лимит: 3 запроса за 30 секунд, жёстко требуем рабочий rate limiter
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 3,
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json();
    const { notesText, dailyConvoId, blockId = 'main' } = body || {};

    if (!notesText || !dailyConvoId) {
      return new Response(
        JSON.stringify({ error: 'notesText and dailyConvoId required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 1. Получаем autoSummary
    const d1 = env.DB;
    let autoSummary = '';
    const dailyRow = await d1
      .prepare('SELECT autoSummary FROM daily_convos WHERE id = ? AND user = ?')
      .bind(dailyConvoId, userEmail)
      .first();

    if (dailyRow) {
      autoSummary = dailyRow.autoSummary || '';
    }

    // 2. Получаем rolling summary + необработанные сообщения
    const { rollingSummary, unprocessedMessages } = await getUnprocessedMessages(
      env,
      userEmail,
      dailyConvoId,
      blockId
    );

    let unprocessedContext = '';
    if (unprocessedMessages.length > 0) {
      unprocessedContext = '\n\n### Последние сообщения диалога:\n';
      unprocessedMessages.forEach((msg) => {
        const label = msg.role === 'user' ? 'Пользователь' : 'Ассистент';
        unprocessedContext += `${label}: ${msg.content}\n`;
      });
    }

    // 3. Формируем промпт
    const prompt = `${BLOCK_INTERPRETATION_PROMPT_DAILY}

ВЫЖИМКА ЗАПИСИ:
${autoSummary || 'Не указана'}

ТЕКУЩИЙ ТЕКСТ:
${notesText.slice(0, 4000)}

ROLLING SUMMARY ДИАЛОГА:
${rollingSummary || 'Диалог только начался'}
${unprocessedContext}

На основе ВСЕГО контекста дай развёрнутое толкование.`;

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 600,
      temperature: 0.7,
      stream: false,
    };

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(deepseekRequestBody),
    });

    const responseBody = await deepseekResponse.json();
    let interpretation = responseBody?.choices?.[0]?.message?.content || '';
    interpretation = interpretation
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim();

    // 4. Сохраняем толкование в messages
    const msgId = crypto.randomUUID();
    const createdAt = Date.now();

    await d1
      .prepare(
        `INSERT INTO messages (id, user, dream_id, block_id, role, content, created_at, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        msgId,
        userEmail,
        dailyConvoId, // здесь dailyConvoId идёт в dream_id
        blockId,
        'assistant',
        interpretation,
        createdAt,
        JSON.stringify({ kind: 'daily_block_interpretation' })
      )
      .run();

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 3, 30000);

    return new Response(
      JSON.stringify({
        interpretation,
        isBlockInterpretation: true,
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (err) {
    console.error('Error in /interpret_block_daily_convo_context:', err);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- Interpret final for daily convo (NEW) ---
if (url.pathname === '/interpret_final_daily_convo_new' && request.method === 'POST') {
  // Лимит: 3 запроса за 30 секунд, жёстко требуем рабочий rate limiter
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 3,
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Invalid content type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await request.json();
    const { notesText, blockType = 'dialog' } = body || {};

    if (!notesText || typeof notesText !== 'string') {
      return new Response(JSON.stringify({ error: 'No notesText' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const interpretation = await interpretFinal(env, notesText, blockType);

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 3, 30000);

    return new Response(JSON.stringify({ interpretation }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('Error in /interpret_final_daily_convo_new:', err);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- ART CHAT: GET /art_chat?dreamId=...&artworkId=...&blockId=... ---
if (url.pathname === '/art_chat' && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    skipTrial: true,
    maxRequests: 50,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const dreamId = url.searchParams.get('dreamId');
  const artworkId = url.searchParams.get('artworkId');
  const blockId = url.searchParams.get('blockId');

  if (!dreamId || !blockId) {
    return new Response(
      JSON.stringify({ error: 'Missing dreamId or blockId' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  try {
    let query = `
      SELECT id, role, content, created_at, meta
      FROM messages
      WHERE user = ? AND dream_id = ? AND block_id = ?
    `;
    const params = [userEmail, dreamId, blockId];

    if (artworkId) {
      query += ` AND artwork_id = ?`;
      params.push(artworkId);
    }

    query += ` ORDER BY created_at ASC`;

    const res = await env.DB.prepare(query).bind(...params).all();

    const messages = (res.results || []).map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      created_at: r.created_at,
      meta: r.meta ? JSON.parse(r.meta) : undefined,
    }));

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 50),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('GET /art_chat error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        details: e?.message || String(e),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

// --- POST /art_chat ---
if (url.pathname === '/art_chat' && request.method === 'POST') {
  // Лимит: 25 запросов за 30 секунд, без проверки trial
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    skipTrial: true,
    maxRequests: 25,
    windowMs: 30000,
    requireRateLimit: true, // важно: без DO не идём дальше
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const { id, dreamId, blockId, artworkId, role, content, meta } = body || {};
  
  if (!dreamId || !blockId || !role || !content || !['user', 'assistant'].includes(role)) {
    return new Response(JSON.stringify({ error: 'Invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  const msgId = id || crypto.randomUUID();
  const createdAt = Date.now();

  try {
    await env.DB.prepare(
      `INSERT INTO messages (id, user, dream_id, block_id, role, content, created_at, meta, artwork_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        msgId,
        userEmail,
        dreamId,        // чистый UUID сна
        blockId,
        role,
        String(content).slice(0, 12000),
        createdAt,
        meta ? JSON.stringify(meta) : null,
        artworkId || null
      )
      .run();

    // Обновляем rolling summary только для сообщений ассистента
    if (role === 'assistant') {
      try {
        let artworkText = '';
        if (artworkId) {
          const artworkRow = await env.DB.prepare(
            `SELECT title, author, desc FROM artworks WHERE id = ?`
          ).bind(artworkId).first();

          if (artworkRow) {
            artworkText = `${artworkRow.title} — ${artworkRow.author}\n${artworkRow.desc}`;
          }
        }

        await updateRollingSummary(
          env,
          userEmail,
          dreamId,        // чистый UUID
          blockId,
          artworkText,
          env.DEEPSEEK_API_KEY,
          artworkId || null
        );
      } catch (e) {
        console.warn('[POST /art_chat] Failed to update summary:', e);
      }
    }

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 25, 30000);

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
        headers,
      }
    );
  } catch (e) {
    console.error('POST /art_chat error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', details: e?.message || String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// --- GET /dreams/:dreamId/similar_artworks ---
if (url.pathname.match(/^\/dreams\/[^/]+\/similar_artworks$/) && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, { maxRequests: 50, windowMs: 30000 });
  if (authResult instanceof Response) return authResult;
  const { userEmail } = authResult;

  const dreamId = url.pathname.split('/')[2];

  try {
    const res = await env.DB.prepare(
      `SELECT 
         a.id as artwork_id,
         a.title,
         a.author,
         a.type,
         a.value,
         a.desc,
         dsa.position,
         dsa.score
       FROM dream_similar_artworks dsa
       JOIN artworks a ON a.id = dsa.artwork_id
       WHERE dsa.dream_id = ?
       ORDER BY dsa.position ASC`
    ).bind(dreamId).all();

    const artworks = (res.results || []).map((r) => ({
      artwork_id: r.artwork_id,
      title: r.title,
      author: r.author,
      type: r.type,
      value: r.value,
      desc: r.desc,
      position: r.position,
      score: r.score,
    }));

    return new Response(JSON.stringify({ artworks }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('GET /dreams/:dreamId/similar_artworks error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', details: e?.message || String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// --- Interpret block for art WITH CONTEXT ---
if (url.pathname === '/interpret_block_art' && request.method === 'POST') {
  // Лимит: 3 запроса за 30 секунд, жёстко требуем рабочий rate limiter
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 3,
    windowMs: 30000,
    requireRateLimit: true,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json();
    const { dreamId, blockId, artworkId } = body || {};

    if (!dreamId || !blockId) {
      return new Response(
        JSON.stringify({ error: 'dreamId and blockId required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let artworkRow = null;

    if (artworkId) {
      artworkRow = await env.DB.prepare(
        `SELECT title, author, type, value, desc FROM artworks WHERE id = ?`
      ).bind(artworkId).first();
    } else if (blockId && blockId.startsWith('artwork__')) {
      const match = blockId.match(/^artwork__(\d+)$/);
      if (match) {
        const artIndex = parseInt(match[1], 10);

        const dreamRow = await env.DB.prepare(
          `SELECT similarArtworks FROM dreams WHERE id = ?`
        ).bind(dreamId).first();

        if (dreamRow && dreamRow.similarArtworks) {
          let similarArtworks = [];
          try {
            similarArtworks = JSON.parse(dreamRow.similarArtworks);
          } catch {}

          const artwork = similarArtworks[artIndex];
          if (artwork) {
            artworkRow = {
              title: artwork.title || '',
              author: artwork.author || '',
              type: artwork.type || 'default',
              value: artwork.value || '',
              desc: artwork.desc || '',
            };
          }
        }
      }
    }

    if (!artworkRow) {
      return new Response(
        JSON.stringify({ error: 'Artwork not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const artworkText = `
Название: ${artworkRow.title}
Автор: ${artworkRow.author}
Тип: ${artworkRow.type}
Описание: ${artworkRow.desc}
`.trim();

    // Контекст строго по artwork
    const { rollingSummary, unprocessedMessages } = await getUnprocessedMessages(
      env,
      userEmail,
      dreamId,
      blockId,
      artworkId || null
    );

    let unprocessedContext = '';
    if (unprocessedMessages.length > 0) {
      unprocessedContext = '\n\nПоследние сообщения диалога:\n';
      unprocessedMessages.forEach((msg) => {
        const label = msg.role === 'user' ? 'Пользователь' : 'Ассистент';
        unprocessedContext += `${label}: ${msg.content}\n`;
      });
    }

    const userPrompt = `
${ART_BLOCK_INTERPRETATION_PROMPT}

---

Описание произведения (artwork):
${artworkText.slice(0, 4000)}

---

Краткое содержание диалога (rolling summary):
${rollingSummary || 'Диалог только начался, подробного резюме ещё нет.'}

${unprocessedContext}
`.trim();

    const deepseekRequestBody = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'Ты внимательный психолог и арт-терапевт. Отвечай всегда на русском, живым человеческим языком.',
        },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.7,
      stream: false,
    };

    const deepseekResponse = await fetch(
      'https://api.deepseek.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify(deepseekRequestBody),
      },
    );

    if (!deepseekResponse.ok) {
      const errText = await deepseekResponse.text().catch(() => '');
      console.error('DeepSeek /interpret_block_art error', deepseekResponse.status, errText);
      throw new Error(`DeepSeek error: ${deepseekResponse.status}`);
    }

    const responseBody = await deepseekResponse.json();

    let interpretation =
      responseBody?.choices?.[0]?.message?.content || '';

    interpretation = interpretation
      .replace(/```[\s\S]*?```/g, '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .trim();

    if (!interpretation) {
      interpretation =
        'Мне не удалось сформировать развёрнутую интерпретацию, но это произведение явно несёт важный эмоциональный смысл. Попробуй задать ещё один вопрос или уточнить, что ты чувствуешь, глядя на него.';
    }

    const msgId = crypto.randomUUID();
    const createdAt = Date.now();

    await env.DB.prepare(
      `INSERT INTO messages (id, user, dream_id, block_id, role, content, created_at, meta, artwork_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        msgId,
        userEmail,
        dreamId,
        blockId,
        'assistant',
        interpretation,
        createdAt,
        JSON.stringify({ kind: 'art_block_interpretation' }),
        artworkId || null
      )
      .run();

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 3, 30000);

    return new Response(
      JSON.stringify({
        interpretation,
        isBlockInterpretation: true,
      }),
      {
        status: 200,
        headers,
      },
    );
  } catch (err) {
    console.error('Error in /interpret_block_art:', err);
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      },
    );
  }
}

// --- DELETE /art_chat ---
if (url.pathname === '/art_chat' && request.method === 'DELETE') {
  // Лимит: 20 запросов за 60 секунд на пользователя
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }

  const { dreamId, blockId, artworkId } = body || {};

  if (!dreamId || !blockId) {
    return new Response(
      JSON.stringify({ error: 'Missing dreamId or blockId' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    let deleteMessagesQuery =
      `DELETE FROM messages WHERE user = ? AND dream_id = ? AND block_id = ?`;
    let deleteSummariesQuery =
      `DELETE FROM dialog_summaries WHERE user = ? AND dream_id = ? AND block_id = ?`;
    const params = [userEmail, dreamId, blockId];

    if (artworkId) {
      deleteMessagesQuery += ` AND artwork_id = ?`;
      deleteSummariesQuery += ` AND artwork_id = ?`;
      params.push(artworkId);
    }

    await env.DB.prepare(deleteMessagesQuery).bind(...params).run();
    await env.DB.prepare(deleteSummariesQuery).bind(...params).run();

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('DELETE /art_chat error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        details: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}



// --- Dashboard metrics endpoint (нормальный range) ---
if (url.pathname === '/dashboard' && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 50,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;
  const { userEmail, rateLimitResult } = authResult;

  try {
    const d1 = env.DB;

    function resolveSinceTs(range) {
      const now = Date.now();
      let sinceTs;

      switch (range) {
        case '7d':   sinceTs = now - 7  * 24 * 60 * 60 * 1000; break;
        case '30d':  sinceTs = now - 30 * 24 * 60 * 60 * 1000; break;
        case '60d':  sinceTs = now - 60 * 24 * 60 * 60 * 1000; break;
        case '90d':  sinceTs = now - 90 * 24 * 60 * 60 * 1000; break;
        case '365d': sinceTs = now - 365* 24 * 60 * 60 * 1000; break;
        case 'all':  sinceTs = 0; break;
        default:     sinceTs = now - 30 * 24 * 60 * 60 * 1000; break;
      }

      const date = new Date(sinceTs);
      date.setUTCHours(0, 0, 0, 0);
      sinceTs = date.getTime();

      console.log(
        `[resolveSinceTs] range=${range}, sinceTs=${sinceTs}, date=${new Date(
          sinceTs
        ).toISOString()}`
      );
      return sinceTs;
    }

    // глубина периода S (0..1)
    function computeDailyDepthS(dashboardDataPeriod) {
      const {
        totalDreamsInPeriod,
        breakdownCounts,
        breakdownPercent,
        streak,
        insights,
      } = dashboardDataPeriod;

      if (!totalDreamsInPeriod || totalDreamsInPeriod <= 0) {
        return 0;
      }

      const pInterpreted = (breakdownPercent.interpreted || 0) / 100;
      const pSummarized = (breakdownPercent.summarized || 0) / 100;
      const pDialogs = (breakdownPercent.dialogs || 0) / 100;
      const pArtworks = (breakdownPercent.artworks || 0) / 100;

      const streakNorm = Math.min(1, (streak || 0) / 30);
      const insightsNorm = Math.min(1, (insights || 0) / 3);

      const wI = 0.35;
      const wS = 0.20;
      const wD = 0.15;
      const wA = 0.10;
      const wSt = 0.10;
      const wIns = 0.10;

      const depthRaw =
        wI * pInterpreted +
        wS * pSummarized +
        wD * pDialogs +
        wA * pArtworks +
        wSt * streakNorm +
        wIns * insightsNorm;

      return Math.max(0, Math.min(1, depthRaw));
    }

    // Elo‑обновление рейтинга глубины
    function updateDepthElo(currentRating, dailyS, K) {
      var R = currentRating || 0;
      var R0 = 1500;   // центр шкалы
      var scale = 400; // "крутизна" кривой ожиданий

      var S = Math.max(0, Math.min(1, dailyS));

      var E = 1 / (1 + Math.pow(10, (R - R0) / (2 * scale)));

      var newRating = R + K * (S - E);
      return Math.max(0, newRating);
    }

    // ---------- БЛОК RANGE ----------
    const rangeParamRaw = url.searchParams.get('range') || '30d';
    const allowedRanges = ['7d', '30d', '60d', '90d', '365d', 'all'];
    const rangeParam = allowedRanges.includes(rangeParamRaw)
      ? rangeParamRaw
      : '30d';

    const isAll = rangeParam === 'all';

    const sinceTs = resolveSinceTs(rangeParam);
    const thirtyDaysAgo = resolveSinceTs('30d');

    // Всего снов
    const totalDreamsRow = await d1
      .prepare('SELECT COUNT(*) AS count FROM dreams WHERE user = ?')
      .bind(userEmail)
      .first();
    const totalDreams = Number(totalDreamsRow?.count || 0);

    // Блоков (диалогов) за последние 30 дней
    const monthlyBlocksRow = await d1
      .prepare(
        `SELECT COUNT(DISTINCT dream_id) AS count
         FROM messages
         WHERE user = ? AND created_at > ?`
      )
      .bind(userEmail, thirtyDaysAgo)
      .first();
    const monthlyBlocks = Number(monthlyBlocksRow?.count || 0);

    // Снов с финальной интерпретацией
    const interpretedRow = await d1
      .prepare(
        `SELECT COUNT(*) AS count
         FROM dreams
         WHERE user = ?
           AND globalFinalInterpretation IS NOT NULL
           AND globalFinalInterpretation != ''`
      )
      .bind(userEmail)
      .first();
    const interpretedCount = Number(interpretedRow?.count || 0);

    // Снов с артами
    const artworksRow = await d1
      .prepare(
        `SELECT COUNT(*) AS count
         FROM dreams
         WHERE user = ?
           AND similarArtworks IS NOT NULL
           AND similarArtworks NOT IN ('[]','{}')`
      )
      .bind(userEmail)
      .first();
    const artworksCount = Number(artworksRow?.count || 0);

    // Снов с диалогами (assistant)
    const dialogDreamsRow = await d1
      .prepare(
        `SELECT COUNT(DISTINCT dream_id) AS count
         FROM messages
         WHERE user = ? AND role = 'assistant'
           AND dream_id IN (SELECT id FROM dreams WHERE user = ?)`
      )
      .bind(userEmail, userEmail)
      .first();
    const dialogDreamsCount = Number(dialogDreamsRow?.count || 0);

    // ---------- Стрик за последний год ----------
    const streakSinceTs = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const streakStmt = await d1
      .prepare(
        `SELECT DATE(date/1000, 'unixepoch') AS day,
                COUNT(*) AS count
         FROM dreams
         WHERE user = ? AND date > ?
         GROUP BY day
         ORDER BY day DESC`
      )
      .bind(userEmail, streakSinceTs)
      .all();

    const dailyDreams = streakStmt.results || [];
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < dailyDreams.length; i++) {
      const dreamDate = new Date(dailyDreams[i].day);
      dreamDate.setHours(0, 0, 0, 0);

      if (i === 0) {
        const diffDays =
          (currentDate.getTime() - dreamDate.getTime()) /
          (1000 * 60 * 60 * 24);
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

    // 7) Для прогресса
    const interpretedForScoreResult = await d1
      .prepare(
        `SELECT COUNT(*) as count 
         FROM dreams 
         WHERE user = ? AND globalFinalInterpretation IS NOT NULL AND globalFinalInterpretation != ''`
      )
      .bind(userEmail)
      .first();

    const summarizedForScoreResult = await d1
      .prepare(
        `SELECT COUNT(*) as count 
         FROM dreams 
         WHERE user = ? AND dreamSummary IS NOT NULL AND dreamSummary != ''`
      )
      .bind(userEmail)
      .first();

    const maxLengthResult = await d1
      .prepare(
        `SELECT MAX(LENGTH(globalFinalInterpretation)) as maxLength 
         FROM dreams 
         WHERE user = ? AND globalFinalInterpretation IS NOT NULL`
      )
      .bind(userEmail)
      .first();

    const maxLength = maxLengthResult?.maxLength || 0;

    const progressData = {
      total_dreams: totalDreams,
      interpreted_count: interpretedForScoreResult?.count || 0,
      summarized_count: summarizedForScoreResult?.count || 0,
      artworks_count: artworksCount,
      max_interpretation_length: maxLength,
    };

    const improvementScore = calculateImprovementScore(progressData);

    // 9.1 Aggregation per day in period / all
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

    const aggStmt = isAll
      ? d1.prepare(aggSql).bind(userEmail)
      : d1.prepare(aggSql).bind(userEmail, sinceTs);
    const aggRes = await aggStmt.all();
    const aggRows = aggRes.results || [];

    let cumulative = {
      total: 0,
      interpreted: 0,
      summarized: 0,
      artworks: 0,
      dialogs: 0,
    };
    const history = [];

    function computeScoreFromAgg(agg) {
      try {
        if (typeof calculateImprovementScore === 'function') {
          const dataForCalc = {
            total_dreams: agg.total || 0,
            interpreted_count: agg.interpreted || 0,
            summarized_count: agg.summarized || 0,
            artworks_count: agg.artworks || 0,
            max_interpretation_length: maxLength,
          };
          return Math.round(calculateImprovementScore(dataForCalc));
        }
      } catch (e) {
        // ignore
      }

      const total = agg.total || 1;
      const interpretedPct = (agg.interpreted || 0) / total;
      const dialogPct = (agg.dialogs || 0) / total;
      const artworkPct = (agg.artworks || 0) / total;
      const score = Math.round(
        Math.min(
          100,
          100 * (0.55 * interpretedPct + 0.25 * dialogPct + 0.2 * artworkPct)
        )
      );
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
        counts: { ...cumulative },
      };
      history.push(point);
    }

    if (history.length === 0) {
      console.warn(`[dashboard] No history data for range=${rangeParam}`);
    }

    const historyOut = history.map((h) => ({
      date: h.date,
      score: h.score,
    }));

    const lastScore = historyOut.length
      ? historyOut[historyOut.length - 1].score
      : Math.round(improvementScore || 0);
    const prevScore =
      historyOut.length > 1 ? historyOut[historyOut.length - 2].score : null;
    const scoreDelta = prevScore === null ? 0 : lastScore - prevScore;
    const highestPoint = historyOut.reduce(
      (acc, p) => (acc === null || p.score > acc.score ? p : acc),
      null
    );

    // recentDreams (12 последних)
    const recentLimit = 12;
    const recentSql = `
      SELECT id, title, date,
        (globalFinalInterpretation IS NOT NULL AND globalFinalInterpretation != '') AS interpreted
      FROM dreams
      WHERE user = ?
      ORDER BY date DESC
      LIMIT ?
    `;

    const recentStmt = d1.prepare(recentSql).bind(userEmail, recentLimit);
    const recentRes = await recentStmt.all();

    const recentDreams = (recentRes.results || []).map((r) => ({
      id: r.id,
      title: r.title || null,
      date: new Date(Number(r.date)).toISOString(),
      interpreted: Boolean(r.interpreted),
    }));

    // breakdown
    const finalCounts = history.length
      ? history[history.length - 1].counts
      : { total: 0, interpreted: 0, summarized: 0, artworks: 0, dialogs: 0 };
    const breakdownCounts = {
      interpreted: finalCounts.interpreted || 0,
      summarized: finalCounts.summarized || 0,
      artworks: finalCounts.artworks || 0,
      dialogs: finalCounts.dialogs || 0,
    };
    const totalForPct = Math.max(1, finalCounts.total || 0);
    const totalDreamsInPeriod = finalCounts.total || 0;
    const breakdownPercent = {
      interpreted: Math.round(
        (breakdownCounts.interpreted / totalForPct) * 100
      ),
      summarized: Math.round(
        (breakdownCounts.summarized / totalForPct) * 100
      ),
      artworks: Math.round((breakdownCounts.artworks / totalForPct) * 100),
      dialogs: Math.round((breakdownCounts.dialogs / totalForPct) * 100),
    };

    // moods
    let moodCounts = {};
    let moodTotal = 0;

    try {
      const moodsSql = isAll
        ? `SELECT context, COUNT(*) AS cnt FROM moods WHERE user_email = ? GROUP BY context`
        : `SELECT context, COUNT(*) AS cnt 
           FROM moods 
           WHERE user_email = ? 
             AND date >= ?
           GROUP BY context`;

      const moodsStmt = isAll
        ? d1.prepare(moodsSql).bind(userEmail)
        : d1.prepare(moodsSql).bind(userEmail, sinceTs);

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

    // инсайты
    let insightsDreamsCount = 0;
    let insightsArtworksCount = 0;

    try {
      const insightsSql = isAll
        ? `
          SELECT
            COUNT(DISTINCT CASE WHEN CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1 THEN dream_id END) AS insights_dreams,
            COUNT(CASE WHEN CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1 THEN 1 END) AS insights_artworks
          FROM messages
          WHERE user = ?
        `
        : `
          SELECT
            COUNT(DISTINCT CASE WHEN CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1 THEN dream_id END) AS insights_dreams,
            COUNT(CASE WHEN CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1 THEN 1 END) AS insights_artworks
          FROM messages
          WHERE user = ? AND created_at >= ?
        `;

      const insightsStmt = isAll
        ? d1.prepare(insightsSql).bind(userEmail)
        : d1.prepare(insightsSql).bind(userEmail, sinceTs);

      const insightsRes = await insightsStmt.first();
      insightsDreamsCount = Number(insightsRes?.insights_dreams ?? 0);
      insightsArtworksCount = Number(insightsRes?.insights_artworks ?? 0);
    } catch (err) {
      console.error('Failed to aggregate insights:', err);
    }

    // daily_convos aggregation
    let totalDailyConvos = 0;
    let dailyConvoInsightsCount = 0;
    try {
      const dailyCountRes = await d1
        .prepare(
          `SELECT COUNT(*) AS cnt FROM daily_convos WHERE user = ?`
        )
        .bind(userEmail)
        .first();
      totalDailyConvos = Number(dailyCountRes?.cnt ?? 0);

      const dailyInsightsRes = await d1
        .prepare(
          `
        SELECT
          COUNT(DISTINCT CASE WHEN CAST(json_extract(meta, '$.insightLiked') AS REAL) = 1 THEN dream_id END) AS daily_convos_with_insight,
          SUM(CASE WHEN CAST(json_extract(meta, '$.insightArtworksLiked') AS REAL) = 1 THEN 1 ELSE 0 END) AS daily_artwork_insight_msgs
        FROM messages
        WHERE user = ? AND dream_id IN (SELECT id FROM daily_convos WHERE user = ?)
      `
        )
        .bind(userEmail, userEmail)
        .first();

      dailyConvoInsightsCount = Number(
        dailyInsightsRes?.daily_convos_with_insight ?? 0
      );
    } catch (e) {
      console.warn(
        'Failed to aggregate daily_convos metrics for dashboard:',
        e
      );
      totalDailyConvos = totalDailyConvos || 0;
      dailyConvoInsightsCount = dailyConvoInsightsCount || 0;
    }

    // данные периода
    const dashboardDataPeriod = {
      totalDreams: totalDreamsInPeriod,
      totalDreamsInPeriod: totalDreamsInPeriod,
      breakdownCounts: breakdownCounts,
      breakdownPercent: breakdownPercent,
      streak: streak,
      insights: insightsDreamsCount,
      depthScore: 0,
    };
    dashboardDataPeriod.depthScore = calculateDepthScore(dashboardDataPeriod);

    // all‑time данные
    const dashboardDataTotal = {
      totalDreams: totalDreams,
      totalDreamsInPeriod: totalDreams,
      breakdownCounts: {
        interpreted: interpretedCount,
        summarized: summarizedForScoreResult?.count || 0,
        artworks: artworksCount,
        dialogs: dialogDreamsCount,
      },
      breakdownPercent: {
        interpreted:
          totalDreams > 0
            ? Math.round((interpretedCount / totalDreams) * 100)
            : 0,
        summarized:
          totalDreams > 0
            ? Math.round(
                ((summarizedForScoreResult?.count || 0) / totalDreams) * 100
              )
            : 0,
        artworks:
          totalDreams > 0
            ? Math.round((artworksCount / totalDreams) * 100)
            : 0,
        dialogs:
          totalDreams > 0
            ? Math.round((dialogDreamsCount / totalDreams) * 100)
            : 0,
      },
      streak: streak,
      insights: insightsDreamsCount,
      depthScore: 0,
    };
    dashboardDataTotal.depthScore = calculateDepthScore(dashboardDataTotal);

    // --- НОВАЯ ЛОГИКА depthScoreTotal (Elo + decay) ---
    const nowTs = Date.now();

    // 1) достаём прошлое значение
    let storedScore = 0;
    let lastAt = nowTs;
    try {
      const row = await d1
        .prepare(
          'SELECT depth_score_stored, last_depth_update_at FROM user_depth_state WHERE user_email = ?'
        )
        .bind(userEmail)
        .first();
      if (row) {
        storedScore = Number(row.depth_score_stored || 0);
        lastAt = Number(row.last_depth_update_at || nowTs);
      }
    } catch (e) {
      console.warn('Failed to load depth state:', e);
    }

    // 2) считаем качество текущего периода S (0..1)
    const dailyS = computeDailyDepthS(dashboardDataPeriod);

    // 3) шаг обновления рейтинга
    const K = 16;

    // 4) Elo‑обновление
    let rating = updateDepthElo(storedScore, dailyS, K);

    // 5) decay вокруг базового all‑time depthScore (как якорь)
function applyDepthDecay(opts) {
  const baseScore = opts.baseScore;
  const storedScoreLocal = opts.storedScore;
  const lastAtLocal = opts.lastAt;
  const nowLocal = opts.now;

  // Half‑life: через ~14 дней «выступ» над базой уменьшается в 2 раза
  const halfLifeDays = opts.halfLifeDays || 14;

  const hlMs = halfLifeDays * 24 * 60 * 60 * 1000;
  let dt = Math.max(0, nowLocal - (lastAtLocal || nowLocal));

  // 👇 Grace‑период: до 3 дней паузы не штрафуем
  const graceMs = 3 * 24 * 60 * 60 * 1000;
  if (dt <= graceMs) {
    dt = 0;
  }

  const k = hlMs > 0 ? Math.pow(0.5, dt / hlMs) : 0;

  const decayed = baseScore + (storedScoreLocal - baseScore) * k;

  // Рейтинг не опускается ниже базы
  return Math.max(baseScore, decayed);
}

    const baseDepthScoreTotal = dashboardDataTotal.depthScore;

rating = applyDepthDecay({
  baseScore: baseDepthScoreTotal,
  storedScore: rating,
  lastAt,
  now: nowTs,
  halfLifeDays: 14, // можно и не передавать, т.к. в функции стоит 14 по умолчанию
});

const depthScoreTotal = Math.round(rating);

    // 6) сохраняем новое значение в user_depth_state
    try {
      await d1
        .prepare(
          `
        INSERT INTO user_depth_state (user_email, depth_score_stored, last_depth_update_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_email) DO UPDATE SET
          depth_score_stored = excluded.depth_score_stored,
          last_depth_update_at = excluded.last_depth_update_at
      `
        )
        .bind(userEmail, depthScoreTotal, nowTs)
        .run();
    } catch (e) {
      console.warn('Failed to save depth state:', e);
    }

    // 6.1) сохраняем дневную точку в user_depth_history
    try {
      const dayDate = new Date(nowTs);
      dayDate.setUTCHours(0, 0, 0, 0);
      const dayKey = dayDate.getTime();

      await d1
        .prepare(
          `
      INSERT INTO user_depth_history (user_email, day, rating)
      VALUES (?, ?, ?)
      ON CONFLICT(user_email, day) DO UPDATE SET
        rating = excluded.rating
    `
        )
        .bind(userEmail, dayKey, depthScoreTotal)
        .run();
    } catch (e) {
      console.warn('Failed to save depth history:', e);
    }

    // 6.2) считаем рейтинг на начало периода и дельту
let depthScoreAtPeriodStart = null;
let depthDeltaInPeriod = 0;

if (!isAll) {
  try {
    const sinceDateObj = new Date(sinceTs);
    sinceDateObj.setUTCHours(0, 0, 0, 0);
    const sinceDayKey = sinceDateObj.getTime();

    const row = await d1
      .prepare(
        `
        SELECT rating
        FROM user_depth_history
        WHERE user_email = ? AND day <= ?
        ORDER BY day DESC
        LIMIT 1
      `
      )
      .bind(userEmail, sinceDayKey)
      .first();

    if (row && row.rating != null) {
      // нашли рейтинг на (или до) начала периода
      depthScoreAtPeriodStart = Number(row.rating);
    } else {
      // 🔥 fallback: если истории раньше начала периода нет — считаем, что стартовали с 0
      depthScoreAtPeriodStart = 0;
    }

    depthDeltaInPeriod = depthScoreTotal - depthScoreAtPeriodStart;
  } catch (e) {
    console.warn('Failed to load depth history for period:', e);
    // в случае ошибки просто оставим delta = 0 и start = null
  }
}

    // геймификация
    const level = getLevel(depthScoreTotal);

    const lastSeenLevelRow = await env.DB
      .prepare(
        'SELECT last_seen_level FROM user_depth_state WHERE user_email = ?'
      )
      .bind(userEmail)
      .first();

    const isNew = level.level > (lastSeenLevelRow?.last_seen_level || 0);

    const levelWithNew = {
      ...level,
      isNew,
    };

    const badgesInfo = await checkAndUnlockBadges(
      d1,
      userEmail,
      dashboardDataTotal
    );
    const recommendedGoal = getNextGoal(
      level,
      badgesInfo.unlocked,
      dashboardDataTotal
    );
    const advice = generateAdvice(
      level,
      recommendedGoal,
      dashboardDataTotal
    );

    let currentBadgeGoalId = null;
    try {
      const row = await d1
        .prepare(
          'SELECT current_badge_goal_id FROM user_goal_settings WHERE user_email = ?'
        )
        .bind(userEmail)
        .first();
      currentBadgeGoalId = row?.current_badge_goal_id ?? null;
    } catch (e) {
      currentBadgeGoalId = null;
    }

    const currentGoal =
      currentBadgeGoalId && BADGES[currentBadgeGoalId]
        ? {
            badgeId: currentBadgeGoalId,
            name: BADGES[currentBadgeGoalId].name,
            emoji: BADGES[currentBadgeGoalId].emoji,
            description: BADGES[currentBadgeGoalId].description,
            progress: calculateBadgeProgress(
              currentBadgeGoalId,
              dashboardDataTotal
            ),
            advice: generateAdvice(
              level,
              { badgeId: currentBadgeGoalId },
              dashboardDataTotal
            ),
          }
        : null;

    const payload = {
      period: rangeParam,

      totalDreams,
      entriesCount: totalDreams,
      interpretedCount,
      interpretedPercent:
        totalDreams > 0
          ? Math.round((interpretedCount / totalDreams) * 100)
          : 0,
      artworksCount,
      dialogDreamsCount,
      streak,
      monthlyBlocks,

      totalDreamsInPeriod,
      score: lastScore,
      scoreDelta,
      history: historyOut,
      highestScore: highestPoint
        ? { score: highestPoint.score, date: highestPoint.date }
        : null,
      breakdownCounts,
      breakdownPercent,
      recentDreams,
      moodCounts,
      moodTotal,
      insightsDreamsCount,
      insightsArtworksCount,
      totalDailyConvos,
      dailyConvoInsightsCount,

      lastUpdated: new Date().toISOString(),

      gamification: {
        depthScoreTotal,
        depthScoreAtPeriodStart,
        depthDeltaInPeriod,
        engagementScorePeriod: dashboardDataPeriod.depthScore,
        level: {
          name: levelWithNew.name,
          emoji: levelWithNew.emoji,
          color: levelWithNew.color,
          min: levelWithNew.min,
          max: levelWithNew.max,
          isNew: levelWithNew.isNew,
        },
        badges: {
          unlocked: badgesInfo.unlocked.map((id) => ({
            id,
            name: BADGES[id].name,
            emoji: BADGES[id].emoji,
            category: BADGES[id].category,
            description: BADGES[id].description,
            unlockedAt: badgesInfo.unlockedAtById?.get(id) ?? null,
          })),
          new: badgesInfo.new.map((id) => ({
            id,
            name: BADGES[id].name,
            emoji: BADGES[id].emoji,
            category: BADGES[id].category,
            description: BADGES[id].description,
            unlockedAt: badgesInfo.unlockedAtById?.get(id) ?? null,
          })),
          unseen: badgesInfo.unseen.map((id) => ({
            id,
            name: BADGES[id].name,
            emoji: BADGES[id].emoji,
            category: BADGES[id].category,
            description: BADGES[id].description,
            unlockedAt: badgesInfo.unlockedAtById?.get(id) ?? null,
          })),
          all: Object.entries(BADGES).map(([id, badge]) => {
            const unlocked = badgesInfo.unlocked.includes(id);
            return {
              id,
              name: badge.name,
              emoji: badge.emoji,
              category: badge.category,
              description: badge.description,
              unlocked,
              unlockedAt: unlocked
                ? badgesInfo.unlockedAtById?.get(id) ?? null
                : null,
            };
          }),
        },
        currentGoal,
        recommendedGoal: recommendedGoal
          ? {
              badgeId: recommendedGoal.badgeId,
              name: recommendedGoal.name,
              emoji: recommendedGoal.emoji,
              description: recommendedGoal.description,
              progress: recommendedGoal.progress,
              advice,
            }
          : null,
      },
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 50),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Dashboard error:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 50),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// =============================
// ✅ ОТМЕТИТЬ БЕЙДЖИ КАК ПРОСМОТРЕННЫЕ
// =============================

if (url.pathname === '/mark-badges-seen' && request.method === 'POST') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json().catch(() => ({}));
    const badgeIds = Array.isArray(body.badgeIds) ? body.badgeIds : [];

    if (badgeIds.length === 0) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      });
    }

    const now = Date.now();
    const d1 = env.DB;

    for (const badgeId of badgeIds) {
      await d1
        .prepare(
          'UPDATE user_badges SET seen_at = ? WHERE user_email = ? AND badge_id = ?'
        )
        .bind(now, userEmail, badgeId)
        .run();
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Failed to mark badges as seen:', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}

if (url.pathname === '/api/gamification/mark-level-seen' && request.method === 'POST') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json().catch(() => ({}));
    const { level } = body || {};

    if (typeof level !== 'number') {
      return new Response(JSON.stringify({ error: 'invalid_level' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      });
    }

    await env.DB.prepare(
      'UPDATE user_depth_state SET last_seen_level = ? WHERE user_email = ?'
    )
      .bind(level, userEmail)
      .run();

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });

  } catch (err) {
    console.error('Error in /api/gamification/mark-level-seen:', err && (err.stack || err.message || err));
    return new Response(JSON.stringify({ 
      error: 'internal_error',
      message: err?.message || String(err),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
        'X-RateLimit-Remaining': String(
          Math.max(0, rateLimitResult?.remaining ?? 0)
        ),
        'X-RateLimit-Reset': String(
          rateLimitResult?.resetAt ?? Date.now() + 60000
        ),
        ...corsHeaders,
      },
    });
  }
}

// --- PUT /me (заменить существующий блок) ---
if ((url.pathname === '/me' || url.pathname === '/api/me') && request.method === 'PUT') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  const ct = request.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    return new Response(
      JSON.stringify({ error: 'Invalid content type', message: 'application/json expected' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
          'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
          ...corsHeaders,
        },
      }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
        'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
        ...corsHeaders,
      },
    });
  }

  let { name, avatar_icon, avatar_image_url } = body || {};

  if (name === undefined && avatar_icon === undefined && avatar_image_url === undefined) {
    return new Response(
      JSON.stringify({ error: 'At least one field (name, avatar_icon or avatar_image_url) is required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
          'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
          ...corsHeaders,
        },
      }
    );
  }

  if (typeof name !== 'undefined' && (typeof name !== 'string' || name.length > 100)) {
    return new Response(
      JSON.stringify({ error: 'Invalid name (must be string up to 100 chars)' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
          'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
          ...corsHeaders,
        },
      }
    );
  }

  if (
    typeof avatar_icon !== 'undefined' &&
    (typeof avatar_icon !== 'string' || !VALID_AVATAR_ICONS.includes(avatar_icon))
  ) {
    return new Response(JSON.stringify({ error: 'Invalid avatar_icon' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
        'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
        ...corsHeaders,
      },
    });
  }

  if (
    typeof avatar_image_url !== 'undefined' &&
    (typeof avatar_image_url !== 'string' ||
      !(avatar_image_url.startsWith('http://') || avatar_image_url.startsWith('https://')))
  ) {
    return new Response(JSON.stringify({ error: 'Invalid avatar_image_url' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
        'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
        'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
        ...corsHeaders,
      },
    });
  }

  try {
    const sets = [];
    const binds = [];

    if (typeof name !== 'undefined') {
      sets.push('name = ?');
      binds.push(name);
    }
    if (typeof avatar_icon !== 'undefined') {
      sets.push('avatar_icon = ?');
      binds.push(avatar_icon);
    }
    if (typeof avatar_image_url !== 'undefined') {
      sets.push('avatar_image_url = ?');
      binds.push(avatar_image_url);
    }

    if (sets.length === 0) {
      return new Response(JSON.stringify({ error: 'Nothing to update' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
          'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
          ...corsHeaders,
        },
      });
    }

    binds.push(userEmail);
    const sql = `UPDATE users SET ${sets.join(', ')} WHERE email = ?`;
    await env.DB.prepare(sql).bind(...binds).run();

    let userRow = await env.DB
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(userEmail)
      .first();

    if (!userRow) {
      const kvRaw = await env.USERS_KV.get(`user:${userEmail}`);
      let kv = {};
      try {
        kv = kvRaw ? JSON.parse(kvRaw) : {};
      } catch {
        kv = {};
      }

      const password_hash = kv.password ?? '';
      const id =
        kv.id ??
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `id-${Date.now()}`);
      const created_at = kv.created
        ? new Date(kv.created).toISOString()
        : new Date().toISOString();

      await env.DB.prepare(
        `INSERT INTO users (id, email, password_hash, name, avatar_icon, avatar_image_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          id,
          userEmail,
          password_hash,
          name ?? null,
          avatar_icon ?? null,
          avatar_image_url ?? null,
          created_at
        )
        .run();

      userRow = await env.DB
        .prepare('SELECT id FROM users WHERE email = ?')
        .bind(userEmail)
        .first();

      if (!userRow) {
        return new Response(
          JSON.stringify({ error: 'User not found or insert failed' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
              'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
              'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
              ...corsHeaders,
            },
          }
        );
      }
    }

    const userFull = await env.DB
      .prepare(
        'SELECT id, email, name, avatar_icon, avatar_image_url, created_at FROM users WHERE email = ?'
      )
      .bind(userEmail)
      .first();

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
      'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
      'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ ok: true, user: userFull }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('PUT /me error:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 20),
          'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
          'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
          ...corsHeaders,
        },
      }
    );
  }
}

if (url.pathname === '/set-current-goal' && request.method === 'POST') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    let body = {};
    try { body = await request.json(); } catch {}

    const badgeId = body?.badgeId;

    // ✅ Разрешаем null для снятия цели
    if (badgeId !== null && (!badgeId || typeof badgeId !== 'string')) {
      return new Response(JSON.stringify({ error: 'badgeId must be string or null' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
          'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
          'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
          ...corsHeaders,
        },
      });
    }

    // ✅ Проверяем существование бейджа только если badgeId не null
    if (badgeId !== null && !BADGES[badgeId]) {
      return new Response(JSON.stringify({ error: 'unknown_badge' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
          'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
          'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
          ...corsHeaders,
        },
      });
    }

    const now = Date.now();

    console.log('🎯 Setting current goal:', { userEmail, badgeId, now });

    await env.DB.prepare(`
      INSERT INTO user_goal_settings (user_email, current_badge_goal_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_email) DO UPDATE SET
        current_badge_goal_id = excluded.current_badge_goal_id,
        updated_at = excluded.updated_at
    `).bind(userEmail, badgeId, now).run();

    console.log('✅ Current goal updated successfully');

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
      'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
      'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('❌ POST /set-current-goal error:', e && (e.stack || e.message || e));
    return new Response(JSON.stringify({ 
      error: 'internal_error', 
      message: e?.message || String(e),
      stack: e?.stack
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
        'X-RateLimit-Remaining': String(Math.max(0, rateLimitResult?.remaining ?? 0)),
        'X-RateLimit-Reset': String(rateLimitResult?.resetAt ?? Date.now() + 60000),
        ...corsHeaders,
      },
    });
  }
}

// GET rolling_summary
if (url.pathname === '/rolling_summary' && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 50,
    windowMs: 60000, // чуть мягче, чем было 30s
  });
  if (authResult instanceof Response) return authResult;
  const { userEmail, rateLimitResult } = authResult;

  const dreamId = url.searchParams.get('dreamId');
  const blockId = url.searchParams.get('blockId');
  const artworkId = url.searchParams.get('artworkId') || null;

  if (!dreamId || !blockId) {
    return new Response(
      JSON.stringify({ error: 'dreamId and blockId required' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 50),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }

  try {
    const summaryData = await getRollingSummary(
      env,
      userEmail,
      dreamId,
      blockId,
      artworkId
    );

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 50),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    if (!summaryData) {
      return new Response(
        JSON.stringify({ summary: null, lastMessageCount: 0 }),
        {
          status: 200,
          headers,
        }
      );
    }

    return new Response(
      JSON.stringify({
        summary: summaryData.summary,
        lastMessageCount: summaryData.lastMessageCount,
      }),
      {
        status: 200,
        headers,
      }
    );
  } catch (e) {
    console.error('[GET /rolling_summary] error:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 50),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

if (url.pathname === '/toggle_artwork_insight' && request.method === 'POST') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json().catch(() => ({}));
    const { dreamId, messageId, liked } = body || {};

    if (!dreamId || !messageId || typeof liked !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
            'X-RateLimit-Remaining': String(
              Math.max(0, rateLimitResult?.remaining ?? 0)
            ),
            'X-RateLimit-Reset': String(
              rateLimitResult?.resetAt ?? Date.now() + 60000
            ),
            ...corsHeaders,
          },
        }
      );
    }

    const updatedMessage = await toggleMessageArtworkInsight(env, {
      dreamId,
      messageId,
      liked,
      userEmail,
    });

    const headers = {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
      'X-RateLimit-Remaining': String(
        Math.max(0, rateLimitResult?.remaining ?? 0)
      ),
      'X-RateLimit-Reset': String(
        rateLimitResult?.resetAt ?? Date.now() + 60000
      ),
      ...corsHeaders,
    };

    return new Response(JSON.stringify({ message: updatedMessage }), {
      status: 200,
      headers,
    });
  } catch (e) {
    console.error('Error in /toggle_artwork_insight:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({ error: e?.message || 'internal_error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(rateLimitResult?.limit ?? 30),
          'X-RateLimit-Remaining': String(
            Math.max(0, rateLimitResult?.remaining ?? 0)
          ),
          'X-RateLimit-Reset': String(
            rateLimitResult?.resetAt ?? Date.now() + 60000
          ),
          ...corsHeaders,
        },
      }
    );
  }
}

// === QUIZ ENDPOINTS ===

// POST /generate_quiz - генерация квиза на основе глобального контекста
if (url.pathname === '/generate_quiz' && request.method === 'POST') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 10,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;
  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json();
    const { sourceType, sourceId, blockId, artworkId } = body;

    if (!sourceType || !sourceId) {
      return new Response(
        JSON.stringify({ error: 'sourceType and sourceId required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const now = Date.now();
    const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);

    // ========== 1. ОСНОВНОЙ ИСТОЧНИК ==========
    let primaryContent = '';
    let primaryContext = '';
    let contextTitle = '';
    let contextText = '';

    if (sourceType === 'dream') {
      const dream = await env.DB.prepare(
        'SELECT dreamText, autoSummary, globalFinalInterpretation, date FROM dreams WHERE id = ? AND user = ?'
      ).bind(sourceId, userEmail).first();
      
      if (!dream) {
        return new Response(
          JSON.stringify({ error: 'Dream not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      primaryContent = dream.dreamText || '';
      primaryContext = `${dream.autoSummary || ''}\n${dream.globalFinalInterpretation || ''}`.trim();
      contextTitle = 'Твой сон';
      contextText = dream.dreamText && dream.dreamText.length > 300
        ? dream.dreamText.substring(0, 300) + '...'
        : (dream.dreamText || '');

      // ====== Добавляем похожие произведения (dream_similar_artworks) ======
      try {
        const similarArtworks = await env.DB.prepare(`
          SELECT a.title, a.author, sa.context AS similarity_reason, sa.score
          FROM dream_similar_artworks sa
          LEFT JOIN artworks a ON sa.artwork_id = a.id
          WHERE sa.dream_id = ?
          ORDER BY sa.position ASC
          LIMIT 3
        `).bind(sourceId).all();

        if (similarArtworks && similarArtworks.results && similarArtworks.results.length > 0) {
          const artworkContext = similarArtworks.results
            .map(r => {
              const title = r.title || 'Без названия';
              const author = r.author ? `(${r.author})` : '';
              const reason = r.similarity_reason ? ` — ${r.similarity_reason}` : '';
              const score = typeof r.score === 'number' ? ` [score:${Number(r.score).toFixed(2)}]` : '';
              return `- "${title}" ${author}${score}${reason}`;
            })
            .join('\n');

          primaryContext += `\n\nПОХОЖИЕ ПРОИЗВЕДЕНИЯ ИСКУССТВА ДЛЯ ЭТОГО СНА:\n${artworkContext}`;
        }
      } catch (artErr) {
        // Не критично — логируем, но продолжаем
        console.warn('[generate_quiz] similarArtworks fetch failed:', artErr);
      }

    } else if (sourceType === 'daily') {
      const daily = await env.DB.prepare(
        'SELECT notes, autoSummary, createdAt FROM daily_convos WHERE id = ? AND user = ?'
      ).bind(sourceId, userEmail).first();
      
      if (!daily) {
        return new Response(
          JSON.stringify({ error: 'Daily convo not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      primaryContent = daily.notes || '';
      primaryContext = daily.autoSummary || '';
      contextTitle = 'Дневная беседа';
      contextText = daily.notes && daily.notes.length > 300
        ? daily.notes.substring(0, 300) + '...'
        : (daily.notes || '');

    } else if (sourceType === 'block' && blockId) {
      const messages = await env.DB.prepare(
        'SELECT role, content FROM messages WHERE user = ? AND dream_id = ? AND block_id = ? ORDER BY created_at ASC'
      ).bind(userEmail, sourceId, blockId).all();

      primaryContent = (messages.results || []).map(m => `${m.role}: ${m.content}`).join('\n');
      
      const summary = await getRollingSummary(env, userEmail, sourceId, blockId, artworkId);
      primaryContext = summary?.summary || '';
      contextTitle = 'Фрагмент сна';
      contextText = primaryContent.length > 300 
        ? primaryContent.substring(0, 300) + '...' 
        : primaryContent;

    } else if (sourceType === 'artwork' && artworkId) {
      const messages = await env.DB.prepare(
        'SELECT role, content FROM messages WHERE user = ? AND dream_id = ? AND block_id = ? AND artwork_id = ? ORDER BY created_at ASC'
      ).bind(userEmail, sourceId, blockId, artworkId).all();

      primaryContent = (messages.results || []).map(m => `${m.role}: ${m.content}`).join('\n');
      
      const summary = await getRollingSummary(env, userEmail, sourceId, blockId, artworkId);
      primaryContext = summary?.summary || '';
      contextTitle = 'Твоё произведение';
      contextText = primaryContent.length > 300 
        ? primaryContent.substring(0, 300) + '...' 
        : primaryContent;
    }

    // ========== 2. СОБИРАЕМ ГЛОБАЛЬНЫЙ КОНТЕКСТ ==========
    
    // 2.1 Последние сны (за 3 дня) — используем date (INTEGER timestamp)
    const recentDreams = await env.DB.prepare(
      'SELECT id, dreamText, autoSummary, globalFinalInterpretation, date FROM dreams WHERE user = ? AND date >= ? ORDER BY date DESC LIMIT 5'
    ).bind(userEmail, threeDaysAgo).all();

    // 2.2 Последние арт-чаты (за 3 дня) — ищем в messages с artwork_id
    const recentArtworkMessages = await env.DB.prepare(
      'SELECT DISTINCT dream_id, block_id, artwork_id, created_at FROM messages WHERE user = ? AND artwork_id IS NOT NULL AND created_at >= ? ORDER BY created_at DESC LIMIT 5'
    ).bind(userEmail, threeDaysAgo).all();

    const artworkSummaries = [];
    for (const msg of (recentArtworkMessages.results || [])) {
      const summary = await getRollingSummary(env, userEmail, msg.dream_id, msg.block_id, msg.artwork_id);
      if (summary?.summary) {
        artworkSummaries.push({
          id: msg.artwork_id,
          summary: summary.summary,
          created_at: msg.created_at
        });
      }
    }

    // 2.3 Последние дневные беседы (за 3 дня) — используем createdAt
    const recentDaily = await env.DB.prepare(
      'SELECT notes, autoSummary, createdAt FROM daily_convos WHERE user = ? AND createdAt >= ? ORDER BY createdAt DESC LIMIT 3'
    ).bind(userEmail, threeDaysAgo).all();

    // 2.4 Все блоки текущего сна (если sourceType === 'dream')
    let blockSummaries = [];
    if (sourceType === 'dream') {
      const blocks = await env.DB.prepare(
        'SELECT DISTINCT block_id FROM messages WHERE user = ? AND dream_id = ? AND block_id IS NOT NULL'
      ).bind(userEmail, sourceId).all();

      for (const block of (blocks.results || [])) {
        const summary = await getRollingSummary(env, userEmail, sourceId, block.block_id, null);
        if (summary?.summary) {
          blockSummaries.push(summary.summary);
        }
      }
    }

    // 2.5 Эмоциональная траектория — используем created_at (DATETIME)
    const recentMoods = await env.DB.prepare(
      'SELECT context, created_at FROM moods WHERE user_email = ? AND created_at >= datetime(?, "unixepoch") ORDER BY created_at DESC LIMIT 5'
    ).bind(userEmail, Math.floor(threeDaysAgo / 1000)).all();

    // ========== 3. ФОРМИРУЕМ СУПЕР-ПРОМПТ ==========
    
    // СЛОВАРЬ ПЕРЕВОДА mood id -> человекочитаемая метка (вставлен прямо здесь)
    const moodTranslation = {
      'heaviness_sadness': 'Грусть',
      'heaviness_fatigue': 'Усталость',
      'heaviness_emptiness': 'Пустота',
      'heaviness_loneliness': 'Одиночество',
      'heaviness_powerless': 'Бессилие',
      'storm_anxiety': 'Тревога',
      'storm_fear': 'Страх',
      'storm_panic': 'Паника',
      'storm_stress': 'Стресс',
      'storm_confusion': 'Растерянность',
      'fire_anger': 'Злость',
      'fire_irritation': 'Раздражение',
      'fire_resentment': 'Обида',
      'fire_jealousy': 'Ревность',
      'fire_passion': 'Страсть',
      'clarity_calm': 'Спокойствие',
      'clarity_confidence': 'Уверенность',
      'clarity_gratitude': 'Благодарность',
      'clarity_hope': 'Надежда',
      'clarity_relax': 'Расслабленность',
      'flight_joy': 'Радость',
      'flight_inspiration': 'Вдохновение',
      'flight_love': 'Любовь',
      'flight_curiosity': 'Любопытство',
      'flight_pride': 'Гордость'
    };

    let globalContextText = '';

    // Основной источник
    globalContextText += `# ОСНОВНОЙ ФОКУС (${contextTitle}):\n`;
    globalContextText += `${primaryContent.slice(0, 2000)}\n\n`;
    if (primaryContext) {
      globalContextText += `АНАЛИЗ:\n${primaryContext.slice(0, 1000)}\n\n`;
    }

    // Последние сны
    if (recentDreams.results && recentDreams.results.length > 0) {
      globalContextText += `# ПОСЛЕДНИЕ СНЫ (за 3 дня):\n`;
      recentDreams.results.forEach((d, i) => {
        const date = d.date
          ? new Date(d.date).toLocaleDateString('ru-RU')
          : `сон ${i + 1}`;
        globalContextText += `${i + 1}. [${date}] ${d.dreamText.slice(0, 200)}...\n`;
        if (d.autoSummary) {
          globalContextText += `   Суть: ${d.autoSummary.slice(0, 150)}\n`;
        }
      });
      globalContextText += '\n';
    }

    // Блоки текущего сна
    if (blockSummaries.length > 0) {
      globalContextText += `# ФРАГМЕНТЫ ТЕКУЩЕГО СНА:\n`;
      blockSummaries.forEach((summary, i) => {
        globalContextText += `${i + 1}. ${summary.slice(0, 200)}\n`;
      });
      globalContextText += '\n';
    }

    // Арт-чаты
    if (artworkSummaries.length > 0) {
      globalContextText += `# ПРОИЗВЕДЕНИЯ (за 3 дня):\n`;
      artworkSummaries.forEach((art, i) => {
        const date = art.created_at
          ? new Date(art.created_at).toLocaleDateString('ru-RU')
          : `арт ${i + 1}`;
        globalContextText += `${i + 1}. [${date}] ${art.summary.slice(0, 200)}\n`;
      });
      globalContextText += '\n';
    }

    // Дневные беседы
    if (recentDaily.results && recentDaily.results.length > 0) {
      globalContextText += `# ДНЕВНЫЕ ЗАПИСИ (за 3 дня):\n`;
      recentDaily.results.forEach((daily, i) => {
        const date = daily.createdAt
          ? new Date(daily.createdAt).toLocaleDateString('ru-RU')
          : `запись ${i + 1}`;
        globalContextText += `${i + 1}. [${date}] ${daily.notes.slice(0, 200)}...\n`;
        if (daily.autoSummary) {
          globalContextText += `   Суть: ${daily.autoSummary.slice(0, 150)}\n`;
        }
      });
      globalContextText += '\n';
    }

    // Эмоциональная траектория (с переводом ID в человекочитаемую метку)
    if (recentMoods.results && recentMoods.results.length > 0) {
      globalContextText += `# ЭМОЦИОНАЛЬНАЯ ТРАЕКТОРИЯ:\n`;
      recentMoods.results.forEach((mood, i) => {
        const date = mood.created_at
          ? new Date(mood.created_at).toLocaleDateString('ru-RU')
          : `день ${i + 1}`;
        // поддерживаем оба варианта названия поля: context или mood_id
        const moodId = mood.context || mood.mood_id || mood.mood || mood.type || '';
        const humanMood = moodTranslation[moodId] || moodId || '(эмоция)';
        globalContextText += `${i + 1}. [${date}] Эмоция: ${humanMood}\n`;
      });
      globalContextText += '\n';
    }

    // ========== 4. ГЕНЕРИРУЕМ КВИЗ ЧЕРЕЗ DEEPSEEK ==========
    
    const quizPrompt = `
Ты — психолог-аналитик сновидений. Перед тобой полная картина внутренней жизни человека за последние дни.

${globalContextText}

---

ЗАДАЧА:
Создай квиз из 5 вопросов, которые помогут человеку глубже осознать:
- Повторяющиеся символы и образы
- Эмоциональные переходы между днями
- Связь между снами, дневными событиями и творчеством
- Скрытые паттерны и внутренние конфликты
- Динамику психологического состояния

ПРАВИЛА:
1. Вопросы НЕ про факты ("Что ты видел?"), а про СМЫСЛ ("Что это значит для тебя?")
2. Используй материал из РАЗНЫХ источников (сны + дневник + арт + настроения)
3. Ищи СВЯЗИ между событиями разных дней
4. Задавай вопросы о КОНТРАСТАХ и ПОВТОРЕНИЯХ
5. Один вопрос может быть открытым (type: "reflection"), остальные — с вариантами
6. Пиши все вопросы и варианты ответов на живом русском языке, избегай технических терминов (например, не используй internal IDs)

ФОРМАТ ОТВЕТА (строго JSON):
{
  "questions": [
    {
      "type": "choice",
      "text": "Какой символ повторяется в твоих снах последние 3 дня?",
      "options": ["Вода", "Свет", "Закрытые двери"],
      "correctIndex": 1
    },
    {
      "type": "reflection",
      "text": "Как изменилось твоё внутреннее состояние с момента первого сна до сегодняшнего дня?"
    }
  ]
}

Генерируй вопросы, которые заставят задуматься и увидеть то, что раньше было незаметно.
`;

    const deepseekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { 
            role: 'system', 
            content: 'Ты — эксперт по психологии сновидений и символическому анализу. Твои вопросы помогают людям видеть глубинные паттерны своей психики.' 
          },
          { role: 'user', content: quizPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.8,
        stream: false
      })
    });

    const responseBody = await deepseekResponse.json();
    let quizJson = responseBody?.choices?.[0]?.message?.content || '{}';
    quizJson = quizJson.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const quizData = JSON.parse(quizJson);

    const quizId = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO quizzes (id, user, source_type, source_id, block_id, artwork_id, questions, created_at, total_questions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      quizId,
      userEmail,
      sourceType,
      sourceId,
      blockId || null,
      artworkId || null,
      JSON.stringify(quizData.questions),
      now,
      quizData.questions.length
    ).run();

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 10, 60000);

    return new Response(
      JSON.stringify({
        quizId,
        questions: quizData.questions,
        contextTitle,
        contextText,
        sourceType,
        sourceId
      }),
      { status: 200, headers }
    );

  } catch (e) {
    console.error('[POST /generate_quiz] error:', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// POST /submit_quiz - отправка ответов на квиз
if (url.pathname === '/submit_quiz' && request.method === 'POST') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;
  const { userEmail, rateLimitResult } = authResult;

  try {
    const body = await request.json();
    const { quizId, answers } = body; // answers = [{ questionIndex, userAnswer }]

    if (!quizId || !Array.isArray(answers)) {
      return new Response(
        JSON.stringify({ error: 'quizId and answers required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Получаем квиз
    const quiz = await env.DB.prepare(
      'SELECT questions, total_questions FROM quizzes WHERE id = ? AND user = ?'
    ).bind(quizId, userEmail).first();

    if (!quiz) {
      return new Response(
        JSON.stringify({ error: 'Quiz not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Безопасный парсинг questions
    let questions;
    try {
      questions = typeof quiz.questions === 'string'
        ? JSON.parse(quiz.questions)
        : quiz.questions;
    } catch (err) {
      console.error('[POST /submit_quiz] JSON parse error, quiz.questions =', quiz.questions, err);
      return new Response(
        JSON.stringify({ error: 'invalid_questions_json' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let score = 0;
    const now = Date.now();

    // Сохраняем ответы и считаем score
    for (const answer of answers) {
      const question = questions[answer.questionIndex];

      if (!question) {
        console.error('[POST /submit_quiz] question not found for index', answer.questionIndex);
        continue;
      }

      const correctIndex =
        typeof question.correctIndex === 'number'
          ? question.correctIndex
          : typeof question.correct_option_index === 'number'
            ? question.correct_option_index
            : null;

      if (correctIndex === null) {
        console.error('[POST /submit_quiz] question has no correctIndex field:', question);
      }

      const isCorrect = correctIndex === parseInt(answer.userAnswer) ? 1 : 0;
      score += isCorrect;

      const answerId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO quiz_answers (id, quiz_id, user, question_index, question_text, user_answer, is_correct, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        answerId,
        quizId,
        userEmail,
        answer.questionIndex,
        question.text || question.question || '',
        answer.userAnswer,
        isCorrect,
        now
      ).run();
    }

    // Обновляем квиз
    await env.DB.prepare(
      'UPDATE quizzes SET completed_at = ?, score = ? WHERE id = ? AND user = ?'
    ).bind(now, score, quizId, userEmail).run();

    // Обновляем статистику
    const stats = await env.DB.prepare(
      'SELECT * FROM quiz_stats WHERE user = ?'
    ).bind(userEmail).first();

    if (stats) {
      await env.DB.prepare(
        `UPDATE quiz_stats SET 
         total_completed = total_completed + 1,
         total_score = total_score + ?,
         last_quiz_date = ?,
         updated_at = ?
         WHERE user = ?`
      ).bind(score, now, now, userEmail).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO quiz_stats (user, total_quizzes, total_completed, total_score, last_quiz_date, updated_at)
         VALUES (?, 1, 1, ?, ?, ?)`
      ).bind(userEmail, score, now, now).run();
    }

    // Начисляем depthScore (ИСПРАВЛЕНО: убрали колонку id)
    const depthBonus = score * 10; // 10 очков за правильный ответ
    const dayTimestamp = Math.floor(now / 1000); // конвертируем в секунды для day
    
    await env.DB.prepare(
      `INSERT INTO user_depth_history (user_email, day, rating)
       VALUES (?, ?, ?)`
    ).bind(userEmail, dayTimestamp, depthBonus).run();

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 20, 60000);

    return new Response(
      JSON.stringify({
        score,
        totalQuestions: quiz.total_questions,
        depthBonus
      }),
      { status: 200, headers }
    );

  } catch (e) {
    console.error('[POST /submit_quiz] error:', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// GET /quiz_stats - статистика квизов
if (url.pathname === '/quiz_stats' && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;
  const { userEmail, rateLimitResult } = authResult;

  try {
    const stats = await env.DB.prepare(
      'SELECT * FROM quiz_stats WHERE user = ?'
    ).bind(userEmail).first();

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000);

    return new Response(
      JSON.stringify(stats || {
        total_quizzes: 0,
        total_completed: 0,
        total_score: 0,
        streak_days: 0
      }),
      { status: 200, headers }
    );

  } catch (e) {
    console.error('[GET /quiz_stats] error:', e);
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

// ============================================
// FEED & SOCIAL FEATURES ENDPOINTS
// ============================================

// ============================================
// 1. GET /feed - Публичная лента снов
// ============================================
if (url.pathname === '/feed' && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const d1 = env.DB;
    
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const sort = url.searchParams.get('sort') || 'latest';
    
    let orderClause = 'ORDER BY published_at DESC';
    if (sort === 'popular') {
      orderClause = 'ORDER BY likes_count DESC, published_at DESC';
    }

    const result = await d1
      .prepare(`
        SELECT 
          d.*,
          d.views_count,
          (SELECT COUNT(*) FROM dream_likes WHERE dream_id = d.id AND user_email = ?) as user_liked
        FROM dreams d
        WHERE d.is_public = 1
        ${orderClause}
        LIMIT ? OFFSET ?
      `)
      .bind(userEmail, limit, offset)
      .all();

    const dreams = await Promise.all(
      result.results.map(async (dream) => {
        if (dream.blocks) {
          try {
            dream.blocks = JSON.parse(dream.blocks);
          } catch {
            dream.blocks = [];
          }
        }

        const authorKey = `user:${dream.user}`;
        const authorRaw = await env.USERS_KV.get(authorKey);
        let authorInfo = { email: dream.user, displayName: 'Анонимный сновидец' };
        
        if (authorRaw) {
          try {
            const author = JSON.parse(authorRaw);
            
            const userRow = await env.DB.prepare(
              'SELECT name, avatar_icon, avatar_image_url FROM users WHERE email = ?'
            )
              .bind(dream.user)
              .first();

            const name = userRow?.name ?? author.name ?? null;
            const avatar_icon = userRow?.avatar_icon ?? author.avatar_icon ?? null;
            const avatar_image_url = userRow?.avatar_image_url ?? author.avatar_image_url ?? null;

            authorInfo = {
              email: author.email,
              displayName: name || author.email.split('@')[0],
              avatar: avatar_image_url || avatar_icon || null,
            };
          } catch {}
        }

        return {
          id: dream.id,
          title: dream.title,
          dreamText: dream.dreamText,
          dreamSummary: dream.dreamSummary,
          date: dream.date,
          published_at: dream.published_at,
          likes_count: dream.likes_count || 0,
          comments_count: dream.comments_count || 0,
          views_count: dream.views_count || 0,
          user_liked: dream.user_liked === 1,
          author: authorInfo,
          blocks: dream.blocks,
        };
      })
    );

    const totalResult = await d1
      .prepare('SELECT COUNT(*) as total FROM dreams WHERE is_public = 1')
      .first();

    const headers = buildRateHeaders(rateLimitResult, corsHeaders, 60, 60000);

    return new Response(
      JSON.stringify({
        dreams,
        pagination: {
          page,
          limit,
          total: totalResult.total,
          totalPages: Math.ceil(totalResult.total / limit),
        },
      }),
      { status: 200, headers }
    );
  } catch (e) {
    console.error('GET /feed error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 60, 60000),
      }
    );
  }
}

// ============================================
// 2. PUT /dreams/:dreamId/publish - Публикация сна
// ============================================
if (url.pathname.match(/^\/dreams\/[^/]+\/publish$/) && request.method === 'PUT') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const dreamId = url.pathname.split('/')[2];
    const d1 = env.DB;

    const dream = await d1
      .prepare('SELECT user, is_public FROM dreams WHERE id = ?')
      .bind(dreamId)
      .first();

    if (!dream) {
      return new Response(JSON.stringify({ error: 'Dream not found' }), {
        status: 404,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      });
    }

    if (dream.user !== userEmail) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      });
    }

    const now = Date.now();
    await d1
      .prepare('UPDATE dreams SET is_public = 1, published_at = ? WHERE id = ?')
      .bind(now, dreamId)
      .run();

    return new Response(
      JSON.stringify({ success: true, published_at: now }),
      {
        status: 200,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      }
    );
  } catch (e) {
    console.error('PUT /dreams/:id/publish error', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      }
    );
  }
}

// ============================================
// 3. PUT /dreams/:dreamId/unpublish - Снятие публикации
// ============================================
if (url.pathname.match(/^\/dreams\/[^/]+\/unpublish$/) && request.method === 'PUT') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const dreamId = url.pathname.split('/')[2];
    const d1 = env.DB;

    const dream = await d1
      .prepare('SELECT user, title, is_public FROM dreams WHERE id = ?')
      .bind(dreamId)
      .first();

    if (!dream || dream.user !== userEmail) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      });
    }

    await d1
      .prepare('UPDATE dreams SET is_public = 0, published_at = NULL WHERE id = ?')
      .bind(dreamId)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
    });
  } catch (e) {
    console.error('PUT /dreams/:id/unpublish error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      }
    );
  }
}

// ============================================
// 4. PUT /dreams/:id/mark-viewed - Отметить сон как просмотренный
// ============================================
if (url.pathname.match(/^\/dreams\/[^/]+\/mark-viewed$/) && request.method === 'PUT') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 100,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const dreamId = url.pathname.split('/')[2];
    const d1 = env.DB;

    const dream = await d1
      .prepare('SELECT id, user FROM dreams WHERE id = ?')
      .bind(dreamId)
      .first();

    if (!dream) {
      return new Response(
        JSON.stringify({ error: 'not_found', message: 'Dream not found' }),
        { 
          status: 404, 
          headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000) 
        }
      );
    }

    if (dream.user !== userEmail) {
      await d1
        .prepare('UPDATE dreams SET views_count = views_count + 1 WHERE id = ?')
        .bind(dreamId)
        .run();
    }

    await d1
      .prepare(`
        INSERT OR IGNORE INTO user_viewed_dreams (user_email, dream_id, viewed_at)
        VALUES (?, ?, ?)
      `)
      .bind(userEmail, dreamId, Date.now())
      .run();

    return new Response(
      JSON.stringify({ success: true, message: 'Dream marked as viewed' }),
      { 
        status: 200, 
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000) 
      }
    );
  } catch (e) {
    console.error('❌ Error marking dream as viewed:', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      { 
        status: 500, 
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000) 
      }
    );
  }
}

// ============================================
// 5. POST /dreams/:dreamId/like - Поставить лайк
// ============================================
if (url.pathname.match(/^\/dreams\/[^/]+\/like$/) && request.method === 'POST') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 100,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const dreamId = url.pathname.split('/')[2];
    console.log('🔍 POST /like - dreamId:', dreamId, 'userEmail:', userEmail);
    
    const d1 = env.DB;

    const dream = await d1
      .prepare('SELECT id, is_public FROM dreams WHERE id = ?')
      .bind(dreamId)
      .first();

    console.log('🔍 Dream found:', dream);

    if (!dream) {
      console.log('❌ Dream not found');
      return new Response(JSON.stringify({ error: 'Dream not found' }), {
        status: 404,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
      });
    }

    if (dream.is_public !== 1) {
      console.log('❌ Dream not public');
      return new Response(JSON.stringify({ error: 'Dream not public' }), {
        status: 403,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
      });
    }

    const existingLike = await d1
      .prepare('SELECT id FROM dream_likes WHERE dream_id = ? AND user_email = ?')
      .bind(dreamId, userEmail)
      .first();

    console.log('🔍 Existing like:', existingLike);

    if (existingLike) {
      console.log('⚠️ Already liked');
      const currentDream = await d1
        .prepare('SELECT likes_count FROM dreams WHERE id = ?')
        .bind(dreamId)
        .first();
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          likes_count: currentDream.likes_count,
          message: 'Already liked' 
        }),
        {
          status: 200,
          headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
        }
      );
    }

    await d1
      .prepare('INSERT INTO dream_likes (dream_id, user_email) VALUES (?, ?)')
      .bind(dreamId, userEmail)
      .run();

    console.log('✅ Like added');

    await d1
      .prepare('UPDATE dreams SET likes_count = likes_count + 1 WHERE id = ?')
      .bind(dreamId)
      .run();

    const updatedDream = await d1
      .prepare('SELECT likes_count FROM dreams WHERE id = ?')
      .bind(dreamId)
      .first();

    console.log('✅ Updated likes_count:', updatedDream.likes_count);

    return new Response(
      JSON.stringify({ success: true, likes_count: updatedDream.likes_count }),
      {
        status: 200,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
      }
    );
  } catch (e) {
    console.error('❌ POST /dreams/:id/like error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
      }
    );
  }
}

// ============================================
// 6. DELETE /dreams/:dreamId/like - Убрать лайк
// ============================================
if (url.pathname.match(/^\/dreams\/[^/]+\/like$/) && request.method === 'DELETE') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 100,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const dreamId = url.pathname.split('/')[2];
    
    console.log('🔥 DELETE /like called');
    console.log('   dreamId:', dreamId);
    console.log('   userEmail:', userEmail);
    
    const d1 = env.DB;
    
    const dreamInfo = await d1
      .prepare('SELECT id, user, is_public, title FROM dreams WHERE id = ?')
      .bind(dreamId)
      .first();
    
    console.log('   Dream info:', dreamInfo);
    console.log('   Is owner:', dreamInfo?.user === userEmail);

    const result = await d1
      .prepare('DELETE FROM dream_likes WHERE dream_id = ? AND user_email = ?')
      .bind(dreamId, userEmail)
      .run();

    console.log('   Delete result:', result.meta.changes);

    if (result.meta.changes === 0) {
      console.log('   ⚠️ Like not found');
      
      const currentDream = await d1
        .prepare('SELECT likes_count FROM dreams WHERE id = ?')
        .bind(dreamId)
        .first();
      
      console.log('   Current likes_count:', currentDream?.likes_count);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          likes_count: currentDream?.likes_count || 0,
          message: 'Like not found' 
        }),
        {
          status: 200,
          headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
        }
      );
    }

    await d1
      .prepare('UPDATE dreams SET likes_count = MAX(0, likes_count - 1) WHERE id = ?')
      .bind(dreamId)
      .run();

    const updatedDream = await d1
      .prepare('SELECT likes_count FROM dreams WHERE id = ?')
      .bind(dreamId)
      .first();

    console.log('   ✅ Updated likes_count:', updatedDream?.likes_count);
    console.log('🔥 DELETE /like completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        likes_count: updatedDream?.likes_count || 0
      }),
      {
        status: 200,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
      }
    );
  } catch (e) {
    console.error('❌ DELETE /dreams/:id/like error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
      }
    );
  }
}

// ============================================
// 7. GET /dreams/:dreamId/comments - Получить комментарии
// ============================================
if (url.pathname.match(/^\/dreams\/[^/]+\/comments$/) && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { rateLimitResult } = authResult;

  try {
    const dreamId = url.pathname.split('/')[2];
    const d1 = env.DB;

    const dream = await d1
      .prepare('SELECT is_public FROM dreams WHERE id = ?')
      .bind(dreamId)
      .first();

    if (!dream || dream.is_public !== 1) {
      return new Response(JSON.stringify({ error: 'Dream not found or not public' }), {
        status: 404,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 60, 60000),
      });
    }

    const result = await d1
      .prepare(`
        SELECT id, user_email, comment_text, created_at
        FROM dream_comments
        WHERE dream_id = ?
        ORDER BY created_at ASC
      `)
      .bind(dreamId)
      .all();

    const comments = await Promise.all(
      result.results.map(async (comment) => {
        const authorKey = `user:${comment.user_email}`;
        const authorRaw = await env.USERS_KV.get(authorKey);
        let authorInfo = { email: comment.user_email, displayName: 'Анонимный' };

        if (authorRaw) {
          try {
            const author = JSON.parse(authorRaw);
            
            const userRow = await env.DB.prepare(
              'SELECT name, avatar_icon, avatar_image_url FROM users WHERE email = ?'
            )
              .bind(comment.user_email)
              .first();

            const name = userRow?.name ?? author.name ?? null;
            const avatar_icon = userRow?.avatar_icon ?? author.avatar_icon ?? null;
            const avatar_image_url = userRow?.avatar_image_url ?? author.avatar_image_url ?? null;

            authorInfo = {
              email: author.email,
              displayName: name || author.email.split('@')[0],
              avatar: avatar_image_url || avatar_icon || null,
            };
          } catch {}
        }

        return {
          id: comment.id,
          text: comment.comment_text,
          created_at: comment.created_at,
          author: authorInfo,
        };
      })
    );

    return new Response(JSON.stringify({ comments }), {
      status: 200,
      headers: buildRateHeaders(rateLimitResult, corsHeaders, 60, 60000),
    });
  } catch (e) {
    console.error('GET /dreams/:id/comments error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 60, 60000),
      }
    );
  }
}

// ============================================
// 8. POST /dreams/:dreamId/comments - Добавить комментарий
// ============================================
if (url.pathname.match(/^\/dreams\/[^/]+\/comments$/) && request.method === 'POST') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const dreamId = url.pathname.split('/')[2];
    const body = await request.json();
    const { comment_text } = body;

    if (!comment_text || comment_text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Comment text is required' }), {
        status: 400,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      });
    }

    if (comment_text.length > 1000) {
      return new Response(JSON.stringify({ error: 'Comment too long (max 1000 chars)' }), {
        status: 400,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      });
    }

    const d1 = env.DB;

    const dream = await d1
      .prepare('SELECT is_public FROM dreams WHERE id = ?')
      .bind(dreamId)
      .first();

    if (!dream || dream.is_public !== 1) {
      return new Response(JSON.stringify({ error: 'Dream not found or not public' }), {
        status: 404,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      });
    }

    const now = Date.now();
    const result = await d1
      .prepare(`
        INSERT INTO dream_comments (dream_id, user_email, comment_text, created_at)
        VALUES (?, ?, ?, ?)
      `)
      .bind(dreamId, userEmail, comment_text.trim(), now)
      .run();

    await d1
      .prepare('UPDATE dreams SET comments_count = comments_count + 1 WHERE id = ?')
      .bind(dreamId)
      .run();

    const authorKey = `user:${userEmail}`;
    const authorRaw = await env.USERS_KV.get(authorKey);
    let authorInfo = { email: userEmail, displayName: 'Анонимный' };

    if (authorRaw) {
      try {
        const author = JSON.parse(authorRaw);
        
        const userRow = await env.DB.prepare(
          'SELECT name, avatar_icon, avatar_image_url FROM users WHERE email = ?'
        )
          .bind(userEmail)
          .first();

        const name = userRow?.name ?? author.name ?? null;
        const avatar_icon = userRow?.avatar_icon ?? author.avatar_icon ?? null;
        const avatar_image_url = userRow?.avatar_image_url ?? author.avatar_image_url ?? null;

        authorInfo = {
          email: author.email,
          displayName: name || author.email.split('@')[0],
          avatar: avatar_image_url || avatar_icon || null,
        };
      } catch (err) {
        console.error('Error parsing author info:', err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        comment: {
          id: result.meta.last_row_id,
          text: comment_text.trim(),
          created_at: now,
          author: authorInfo,
        },
      }),
      {
        status: 201,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      }
    );
  } catch (e) {
    console.error('POST /dreams/:id/comments error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      }
    );
  }
}

// ============================================
// 9. POST /users/:email/follow - Подписаться
// ============================================
if (url.pathname.match(/^\/users\/[^/]+\/follow$/) && request.method === 'POST') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const targetEmail = decodeURIComponent(url.pathname.split('/')[2]);
    
    if (userEmail === targetEmail) {
      return new Response(JSON.stringify({ error: 'Cannot follow yourself' }), {
        status: 400,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      });
    }

    const d1 = env.DB;

    const existing = await d1
      .prepare('SELECT id FROM user_followers WHERE follower_email = ? AND following_email = ?')
      .bind(userEmail, targetEmail)
      .first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Already following' }), {
        status: 400,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      });
    }

    await d1
      .prepare('INSERT INTO user_followers (follower_email, following_email) VALUES (?, ?)')
      .bind(userEmail, targetEmail)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 201,
      headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
    });
  } catch (e) {
    console.error('POST /users/:email/follow error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      }
    );
  }
}

// ============================================
// 10. DELETE /users/:email/follow - Отписаться
// ============================================
if (url.pathname.match(/^\/users\/[^/]+\/follow$/) && request.method === 'DELETE') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 30,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const targetEmail = decodeURIComponent(url.pathname.split('/')[2]);
    const d1 = env.DB;

    const result = await d1
      .prepare('DELETE FROM user_followers WHERE follower_email = ? AND following_email = ?')
      .bind(userEmail, targetEmail)
      .run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Not following' }), {
        status: 404,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
    });
  } catch (e) {
    console.error('DELETE /users/:email/follow error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 30, 60000),
      }
    );
  }
}

// ============================================
// 11. GET /users/:email/stats - Статистика пользователя
// ============================================
if (url.pathname.match(/^\/users\/[^/]+\/stats$/) && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 60,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { rateLimitResult } = authResult;

  try {
    const targetEmail = decodeURIComponent(url.pathname.split('/')[2]);
    const d1 = env.DB;

    const dreamsCount = await d1
      .prepare('SELECT COUNT(*) as count FROM dreams WHERE user = ? AND is_public = 1')
      .bind(targetEmail)
      .first();

    const followersCount = await d1
      .prepare('SELECT COUNT(*) as count FROM user_followers WHERE following_email = ?')
      .bind(targetEmail)
      .first();

    const followingCount = await d1
      .prepare('SELECT COUNT(*) as count FROM user_followers WHERE follower_email = ?')
      .bind(targetEmail)
      .first();

    const totalLikes = await d1
      .prepare(`
        SELECT SUM(d.likes_count) as total
        FROM dreams d
        WHERE d.user = ? AND d.is_public = 1
      `)
      .bind(targetEmail)
      .first();

    return new Response(
      JSON.stringify({
        email: targetEmail,
        public_dreams_count: dreamsCount.count || 0,
        followers_count: followersCount.count || 0,
        following_count: followingCount.count || 0,
        total_likes: totalLikes.total || 0,
      }),
      {
        status: 200,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 60, 60000),
      }
    );
  } catch (e) {
    console.error('GET /users/:email/stats error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 60, 60000),
      }
    );
  }
}

// ============================================
// 12. GET /dreams/:id - Получение одного сна
// ============================================
if (url.pathname.match(/^\/dreams\/[^/]+$/) && request.method === 'GET') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 100,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  try {
    const dreamId = url.pathname.split('/')[2];
    const d1 = env.DB;

    const dream = await d1
      .prepare(`
        SELECT 
          d.*,
          (SELECT COUNT(*) FROM dream_likes WHERE dream_id = d.id AND user_email = ?) as user_liked
        FROM dreams d
        WHERE d.id = ?
      `)
      .bind(userEmail, dreamId)
      .first();

    if (!dream) {
      return new Response(JSON.stringify({ error: 'Dream not found' }), {
        status: 404,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
      });
    }

    if (dream.user !== userEmail) {
      ctx.waitUntil(
        incrementView(env, dreamId)
      );
    }

    if (dream.blocks) {
      try {
        dream.blocks = JSON.parse(dream.blocks);
      } catch {
        dream.blocks = [];
      }
    }

    return new Response(JSON.stringify(dream), {
      status: 200,
      headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
    });
  } catch (e) {
    console.error('GET /dreams/:id error', e);
    return new Response(
      JSON.stringify({ error: 'internal_error', message: e?.message || String(e) }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 100, 60000),
      }
    );
  }
}

// ============================================
// 13. DELETE /dreams/:id - Удаление сна (В САМОМ КОНЦЕ!)
// ============================================
if (url.pathname.match(/^\/dreams\/[^/]+$/) && request.method === 'DELETE') {
  const authResult = await withAuthAndRateLimit(request, env, corsHeaders, {
    maxRequests: 20,
    windowMs: 60000,
  });
  if (authResult instanceof Response) return authResult;

  const { userEmail, rateLimitResult } = authResult;

  if (!(await isTrialActive(userEmail, env))) {
    return new Response(JSON.stringify({ error: 'Trial expired' }), {
      status: 403,
      headers: buildRateHeaders(rateLimitResult, corsHeaders, 20, 60000),
    });
  }

  const id = url.pathname.split('/')[2];
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing dream id' }), {
      status: 400,
      headers: buildRateHeaders(rateLimitResult, corsHeaders, 20, 60000),
    });
  }

  try {
    const d1 = env.DB;
    const result = await d1
      .prepare('DELETE FROM dreams WHERE id = ? AND user = ?')
      .bind(id, userEmail)
      .run();

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: 'Dream not found' }), {
        status: 404,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 20, 60000),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: buildRateHeaders(rateLimitResult, corsHeaders, 20, 60000),
    });
  } catch (e) {
    console.error('Error deleting dream:', e && (e.stack || e.message || e));
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: e?.message || String(e),
      }),
      {
        status: 500,
        headers: buildRateHeaders(rateLimitResult, corsHeaders, 20, 60000),
      }
    );
  }
}


    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};