/**
 * aiService.js
 * Genera resúmenes post-partida:
 *   1) Post para redes sociales (X / Instagram)
 *   2) Crónica oficial para la web del evento
 *
 * - Si hay API Key de Gemini y conexión, usa el LLM.
 * - Si no hay API Key, no hay conexión o la API falla, ejecuta un generador
 *   local dinámico basado en las estadísticas reales de la partida, de modo
 *   que la demostración nunca falla.
 *
 * Expone el espacio de nombres global `AIService`.
 *
 * Objeto "story" que recibe generate():
 * {
 *   tournament, game,
 *   teamA: { name, tag }, teamB: { name, tag },
 *   scoreA, scoreB, duration,
 *   mvp: { name, kills, deaths, assists }, objectives
 * }
 */
(function (global) {
  'use strict';

  const config = {
    model: 'gemini-2.5-flash', // modelo configurable (ver README)
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    timeoutMs: 20000
  };

  const OBJECTIVE_LABELS = {
    'Valorant': 'plantaciones de spike y rondas de objetivo',
    'League of Legends': 'objetivos (torres, dragones y barones)',
    'Counter-Strike 2': 'plantaciones y desactivaciones de bomba',
    'Dota 2': 'torres y Roshans derribados',
    'Rocket League': 'tiros a puerta y salvadas decisivas',
    'Fortnite': 'zonas disputadas',
    'EA Sports FC': 'jugadas de gol creadas',
    'Free Fire': 'zonas controladas'
  };

  /* ---------- Utilidades ---------- */

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Generador pseudoaleatorio determinista (mulberry32): misma partida => mismo texto. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function toHashtag(text) {
    const words = String(text)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(/[^A-Za-z0-9]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    return '#' + words.join('').slice(0, 30);
  }

  /* ---------- Análisis de la partida ---------- */

  function analyze(story) {
    const aWins = story.scoreA > story.scoreB;
    const winner = aWins ? story.teamA : story.teamB;
    const loser = aWins ? story.teamB : story.teamA;
    const wScore = Math.max(story.scoreA, story.scoreB);
    const lScore = Math.min(story.scoreA, story.scoreB);
    const ratio = wScore === 0 ? 0 : lScore / wScore;

    let margin = 'normal';
    if (ratio >= 0.75 || wScore - lScore <= 1) margin = 'ajustado';
    else if (ratio <= 0.4) margin = 'dominante';

    let pace;
    if (story.duration <= 25) pace = 'relampago';
    else if (story.duration <= 45) pace = 'equilibrada';
    else if (story.duration <= 70) pace = 'larga';
    else pace = 'maraton';

    const { kills, deaths, assists } = story.mvp;
    return {
      winner, loser, wScore, lScore, margin, pace,
      kda: ((kills + assists) / Math.max(deaths, 1)).toFixed(2),
      involvement: kills + assists,
      perMinute: ((kills + assists) / story.duration).toFixed(2),
      objectiveLabel: OBJECTIVE_LABELS[story.game] || 'objetivos'
    };
  }

  /* ---------- Generador local (modo respaldo) ---------- */

  function buildLocal(story) {
    const a = analyze(story);
    const rand = rng(hashString(JSON.stringify(story)));
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const { winner, loser, wScore, lScore } = a;
    const { mvp } = story;
    const kdaText = `${mvp.kills}/${mvp.deaths}/${mvp.assists}`;

    /* --- Post para redes sociales --- */
    const headlines = {
      dominante: [
        `💥 ¡Paliza épica! ${winner.name} arrasa a ${loser.name}`,
        `🔥 ${winner.name} pasa por encima de ${loser.name}`
      ],
      ajustado: [
        `😮 ¡Final de infarto! ${winner.name} se impone por la mínima a ${loser.name}`,
        `⚡ Todo se decidió al límite: ${winner.name} vence a ${loser.name}`
      ],
      normal: [
        `🏆 ${winner.name} se queda con la victoria sobre ${loser.name}`,
        `🔥 ¡${winner.name} manda en ${story.tournament}!`
      ]
    };
    const paceEmoji = { relampago: '⚡', equilibrada: '⏱️', larga: '🧠', maraton: '🥵' }[a.pace];
    const closings = {
      relampago: '⚡ ¡Todo se definió en un abrir y cerrar de ojos!',
      equilibrada: '🎯 Un duelo con ritmo, lectura de juego y mucha presión.',
      larga: '🧠 Una batalla de nervios que se decidió en los detalles.',
      maraton: '🥵 Una maratón de resistencia: nadie soltó el mando hasta el final.'
    };

    const hashtags = [
      toHashtag(story.tournament), toHashtag(story.game), '#Esports',
      '#' + winner.tag.replace(/[^A-Za-z0-9]/g, '')
    ].join(' ');

    const social = [
      pick(headlines[a.margin]),
      `${story.teamA.tag} ${story.scoreA} - ${story.scoreB} ${story.teamB.tag} | ${story.game} | ${story.duration} min ${paceEmoji}`,
      `⭐ MVP: ${mvp.name} (${kdaText} K/D/A, KDA ${a.kda}) · ${plural(story.objectives, 'objetivo', 'objetivos')}`
    ];
    const withClosing = social.concat(closings[a.pace], hashtags).join('\n');
    const socialText = withClosing.length <= 280 ? withClosing : social.concat(hashtags).join('\n');

    /* --- Crónica oficial --- */
    const intro = pick([
      `${winner.name} derrotó a ${loser.name} por ${wScore}-${lScore} en ${story.tournament}, en un enfrentamiento de ${story.game} que se extendió durante ${story.duration} minutos.`,
      `Por ${wScore}-${lScore} y tras ${story.duration} minutos de ${story.game}, ${winner.name} se llevó el duelo ante ${loser.name} correspondiente a ${story.tournament}.`
    ]);

    const paceSentence = {
      relampago: `El ritmo fue vertiginoso: con una duración tan corta, cada error se pagó de inmediato y no hubo espacio para reacomodar el plan de juego.`,
      equilibrada: `Fue una partida de duración equilibrada, con fases de tanteo y momentos de máxima intensidad que mantuvieron la tensión sobre el escenario.`,
      larga: `El desgaste fue protagonista en una partida larga, donde la paciencia y la toma de decisiones pesaron tanto como la mecánica individual.`,
      maraton: `Se trató de una auténtica maratón de ${story.duration} minutos: el cansancio y la presión pusieron a prueba la concentración de ambos equipos hasta el último segundo.`
    }[a.pace];

    const marginSentence = {
      dominante: `${winner.name} tomó el control desde los primeros compases y nunca soltó la ventaja, mientras ${loser.name} no encontró la manera de equilibrar el marcador.`,
      ajustado: `La diferencia nunca fue cómoda: ambos equipos se alternaron el protagonismo y el desenlace se resolvió por detalles mínimos.`,
      normal: `${winner.name} supo imponer su ritmo en los momentos clave y mantuvo a ${loser.name} a distancia en el marcador.`
    }[a.margin];

    const mvpSentence = `${mvp.name} fue la figura del encuentro con ${plural(mvp.kills, 'eliminación', 'eliminaciones')}, ${plural(mvp.deaths, 'caída', 'caídas')} y ${plural(mvp.assists, 'asistencia', 'asistencias')} (KDA de ${a.kda}), participando en ${a.involvement} acciones de combate a razón de ${a.perMinute} por minuto.`;

    const objectiveSentence = story.objectives > 0
      ? `En el plano estratégico se registraron ${story.objectives} ${a.objectiveLabel}, un indicador clave para entender cómo se inclinó la balanza.`
      : `En el plano estratégico, el partido se resolvió sin objetivos destacados registrados, lo que dejó todo el peso en el duelo directo.`;

    const closing = pick([
      `Con este resultado, ${winner.name} suma un triunfo importante en ${story.tournament}, mientras que ${loser.name} deberá revisar sus errores de cara a lo que viene.`,
      `La victoria da impulso a ${winner.name} en ${story.tournament}; ${loser.name} tendrá que replantear su estrategia para la próxima cita.`
    ]);

    const chronicle = [intro, paceSentence, marginSentence, mvpSentence, objectiveSentence, closing].join(' ');
    return { social: socialText, chronicle };
  }

  /* ---------- Gemini API ---------- */

  function buildPrompt(story) {
    const data = {
      torneo: story.tournament,
      videojuego: story.game,
      equipoA: story.teamA,
      equipoB: story.teamB,
      marcador: `${story.scoreA}-${story.scoreB}`,
      duracionMinutos: story.duration,
      mvp: {
        jugador: story.mvp.name,
        kills: story.mvp.kills,
        muertes: story.mvp.deaths,
        asistencias: story.mvp.assists
      },
      objetivos: story.objectives
    };
    return [
      'Eres un periodista deportivo especializado en esports. Con los datos reales de la siguiente partida, redacta en español:',
      '1) "social": un post para X/Instagram de tono épico, con emojis, mención al MVP, el marcador y hashtags del torneo (máximo 280 caracteres).',
      '2) "chronicle": una crónica oficial para la web del evento, de un solo párrafo periodístico (90 a 140 palabras) que narre el desarrollo de la partida según su duración y estadísticas.',
      'Usa únicamente los datos entregados; no inventes jugadas, jugadores ni cifras.',
      'Responde SOLO con un objeto JSON válido con las claves "social" y "chronicle", sin texto adicional ni bloques de código.',
      '',
      'Datos de la partida:',
      JSON.stringify(data, null, 2)
    ].join('\n');
  }

  function parseModelJson(text) {
    const clean = String(text).replace(/```json|```/gi, '').trim();
    const parsed = JSON.parse(clean);
    if (typeof parsed.social !== 'string' || typeof parsed.chronicle !== 'string'
      || !parsed.social.trim() || !parsed.chronicle.trim()) {
      throw new Error('respuesta incompleta del modelo');
    }
    return { social: parsed.social.trim(), chronicle: parsed.chronicle.trim() };
  }

  async function callGemini(story, apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    const url = `${config.endpoint}/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildPrompt(story) }] }],
          generationConfig: { temperature: 0.9, responseMimeType: 'application/json' }
        })
      });
      if (!response.ok) {
        const reasons = {
          400: 'API Key o solicitud no válida',
          401: 'API Key no autorizada',
          403: 'permiso denegado para esta API Key',
          404: 'modelo no disponible',
          429: 'límite de uso alcanzado'
        };
        throw new Error(reasons[response.status] || `error HTTP ${response.status}`);
      }
      const data = await response.json();
      const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content
        ? data.candidates[0].content.parts : null;
      const text = parts ? parts.map((p) => p.text || '').join('') : '';
      if (!text) throw new Error('el modelo no devolvió texto');
      return parseModelJson(text);
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('tiempo de espera agotado');
      if (err instanceof TypeError) throw new Error('sin conexión o red bloqueada');
      if (err instanceof SyntaxError) throw new Error('respuesta del modelo no válida');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- API pública ---------- */

  /**
   * Genera el post y la crónica. Nunca lanza: siempre devuelve un resultado.
   * @returns {Promise<{social:string, chronicle:string, source:'gemini'|'local', model?:string, note?:string}>}
   */
  async function generate(story, apiKey) {
    const key = (apiKey || '').trim();
    if (!key) {
      return { ...buildLocal(story), source: 'local', note: 'No se ingresó API Key: se usó el generador local.' };
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { ...buildLocal(story), source: 'local', note: 'Sin conexión a internet: se usó el generador local.' };
    }
    try {
      const result = await callGemini(story, key);
      return { ...result, source: 'gemini', model: config.model };
    } catch (err) {
      return {
        ...buildLocal(story),
        source: 'local',
        note: `No se pudo usar Gemini (${err.message}). Se activó el modo respaldo local.`
      };
    }
  }

  global.AIService = { config, generate, buildLocal, buildPrompt };
})(window);
