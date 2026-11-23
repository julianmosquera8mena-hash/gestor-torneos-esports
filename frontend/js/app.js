/**
 * app.js
 * Controlador principal: navegación entre vistas (SPA con rutas por hash),
 * renderizado dinámico, manejo de eventos del DOM y conexión entre
 * data.js (datos), validations.js (reglas) y aiService.js (IA).
 */
(function () {
  'use strict';

  const D = window.EsportsData;
  const V = window.Validators;
  const AI = window.AIService;

  const VIEWS = ['dashboard', 'torneos', 'equipos', 'partidas', 'cronicas'];
  const API_KEY_STORAGE = 'arena.geminiKey.session';

  /* ======================================================================
     Utilidades
     ====================================================================== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const num = (x) => parseInt(x, 10);
  const slug = (status) => status.toLowerCase().replace(/\s+/g, '-');

  function fmtDate(value) {
    const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function toast(message, type = 'ok') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${icon(type === 'error' ? 'alert' : 'check')}<span>${esc(message)}</span>`;
    box.appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 5000 : 3500);
  }

  function emptyState(iconName, title, text) {
    return `<div class="empty">${icon(iconName)}<strong>${esc(title)}</strong><span>${esc(text)}</span></div>`;
  }

  function fillSelect(select, items, placeholder) {
    const previous = select.value;
    select.innerHTML = `<option value="">${esc(placeholder)}</option>` +
      items.map((i) => `<option value="${esc(i.value)}">${esc(i.label)}</option>`).join('');
    if (items.some((i) => i.value === previous)) select.value = previous;
  }

  const teamOption = (t) => ({ value: t.id, label: `${t.tag} · ${t.name}` });

  function tagFrom(name) {
    const clean = V.norm(name).replace(/[^a-z0-9 ]/g, '').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    const tag = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 4) : clean.slice(0, 3);
    return (tag || 'EQ').toUpperCase();
  }

  /* ======================================================================
     Navegación (sin recargar la página)
     ====================================================================== */
  function currentView() {
    const hash = location.hash.replace(/^#\/?/, '');
    return VIEWS.includes(hash) ? hash : 'dashboard';
  }

  function showView() {
    const view = currentView();
    $$('.view').forEach((section) => { section.hidden = section.id !== `view-${view}`; });
    $$('[data-nav]').forEach((link) => {
      const active = link.dataset.nav === view;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.title = `${$(`#view-${view}`).dataset.title} · Arena`;
    window.scrollTo(0, 0);
  }

  /* ======================================================================
     Renderizado
     ====================================================================== */
  function scoreboardHTML(m, compact) {
    const a = D.team(m.teamAId);
    const b = D.team(m.teamBId);
    if (!a || !b) return '';
    const aWins = m.scoreA > m.scoreB;
    return `
      <div class="scoreboard ${compact ? 'compact' : ''}">
        <div class="sb-side ${aWins ? 'win' : ''}">
          <span class="sb-tag">${esc(a.tag)}</span><span class="sb-name">${esc(a.name)}</span>
        </div>
        <div class="sb-score" role="img" aria-label="Marcador ${m.scoreA} a ${m.scoreB}">
          <span class="${aWins ? 'win' : ''}">${m.scoreA}</span><span class="dash">–</span><span class="${aWins ? '' : 'win'}">${m.scoreB}</span>
        </div>
        <div class="sb-side right ${aWins ? '' : 'win'}">
          <span class="sb-tag">${esc(b.tag)}</span><span class="sb-name">${esc(b.name)}</span>
        </div>
      </div>`;
  }

  function sortedMatches() {
    return D.matches().slice().sort((x, y) => String(y.playedAt).localeCompare(String(x.playedAt)));
  }

  function standings() {
    const rows = new Map();
    D.teams().forEach((t) => rows.set(t.id, { team: t, pj: 0, w: 0, l: 0, pf: 0, pc: 0 }));
    D.matches().forEach((m) => {
      const a = rows.get(m.teamAId);
      const b = rows.get(m.teamBId);
      if (!a || !b) return;
      a.pj++; b.pj++;
      a.pf += m.scoreA; a.pc += m.scoreB;
      b.pf += m.scoreB; b.pc += m.scoreA;
      if (m.scoreA > m.scoreB) { a.w++; b.l++; } else { b.w++; a.l++; }
    });
    return Array.from(rows.values()).sort((x, y) =>
      y.w - x.w || (y.pf - y.pc) - (x.pf - x.pc) || x.team.name.localeCompare(y.team.name));
  }

  function renderDashboard() {
    // Hero: última partida
    const last = sortedMatches()[0];
    const hero = $('#dash-hero');
    if (last && D.team(last.teamAId) && D.team(last.teamBId) && D.tournament(last.tournamentId)) {
      const t = D.tournament(last.tournamentId);
      hero.innerHTML = `
        <div class="hero">
          <div class="hero-top">
            <h1>Última partida · <strong>${esc(t.name)}</strong></h1>
            <span class="badge badge-${slug(t.status)}">${esc(t.status)}</span>
          </div>
          ${scoreboardHTML(last, false)}
          <div class="hero-foot">
            <span class="mvp">${icon('star')}MVP ${esc(last.mvp.name)} · ${last.mvp.kills}/${last.mvp.deaths}/${last.mvp.assists}</span>
            <span>${icon('clock')} ${last.duration} min</span>
            <span>${esc(t.game)}</span>
            <button type="button" class="btn btn-primary btn-sm" data-action="chronicle-for" data-id="${esc(last.id)}">${icon('spark')}Generar crónica</button>
          </div>
        </div>`;
    } else {
      hero.innerHTML = `<div class="hero">${emptyState('swords', 'Aún no hay partidas jugadas', 'Registra la primera en la sección Partidas o restaura los datos de prueba.')}</div>`;
    }

    // Franja de cifras
    const inProgress = D.tournaments().filter((t) => t.status === 'En curso').length;
    $('#dash-stats').innerHTML = [
      [D.tournaments().length, 'Torneos'],
      [D.teams().length, 'Equipos'],
      [D.matches().length, 'Partidas jugadas'],
      [inProgress, 'Torneos en curso']
    ].map(([n, label]) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`).join('');

    // Torneos en juego (no finalizados)
    const active = D.tournaments().filter((t) => t.status !== 'Finalizado');
    $('#dash-tournaments').innerHTML = active.length
      ? `<div class="mini-list">${active.map((t) => `
          <div class="mini-item">
            <div><strong>${esc(t.name)}</strong><small>${esc(t.game)} · ${t.teamIds.length} equipos · ${fmtDate(t.date)}</small></div>
            <span class="badge badge-${slug(t.status)}">${esc(t.status)}</span>
          </div>`).join('')}</div>`
      : emptyState('trophy', 'No hay torneos abiertos ni en curso', 'Crea uno nuevo en la sección Torneos.');

    // Tabla de posiciones
    const table = standings();
    $('#dash-standings').innerHTML = table.length
      ? `<div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>P</th><th>Dif</th></tr></thead>
          <tbody>${table.map((r, i) => `
            <tr><td class="pos">${i + 1}</td><td>${esc(r.team.tag)} <span style="color:var(--muted)">${esc(r.team.name)}</span></td>
            <td>${r.pj}</td><td>${r.w}</td><td>${r.l}</td><td>${r.pf - r.pc > 0 ? '+' : ''}${r.pf - r.pc}</td></tr>`).join('')}
          </tbody></table></div>`
      : emptyState('users', 'Sin equipos registrados', 'Registra equipos en la sección Equipos.');
  }

  function renderTournaments() {
    const list = D.tournaments();
    $('#tournament-count').textContent = list.length;
    $('#tournament-list').innerHTML = list.length ? list.map((t) => {
      const teams = D.teamsInTournament(t.id);
      const played = D.matchesOfTournament(t.id).length;
      return `
        <article class="card">
          <div class="card-top">
            <div>
              <h3>${esc(t.name)}</h3>
              <div class="meta">
                <span>${esc(t.game)}</span><span>${esc(t.format)}</span>
                <span>${fmtDate(t.date)}</span><span>Premio: ${esc(t.prize)}</span>
                <span>${played} ${played === 1 ? 'partida' : 'partidas'}</span>
              </div>
            </div>
            <span class="badge badge-${slug(t.status)}">${esc(t.status)}</span>
          </div>
          <div class="chips" aria-label="Equipos inscritos">
            ${teams.length ? teams.map((tm) => `
              <span class="chip">${esc(tm.tag)}
                <button type="button" class="chip-x" data-action="unassign" data-tid="${esc(t.id)}" data-team="${esc(tm.id)}" aria-label="Quitar a ${esc(tm.name)} del torneo">×</button>
              </span>`).join('') : '<span class="hint">Sin equipos inscritos todavía.</span>'}
          </div>
          <div class="card-actions">
            <label class="sr-only" for="status-${esc(t.id)}">Estado del torneo</label>
            <select id="status-${esc(t.id)}" data-action="set-status" data-id="${esc(t.id)}">
              ${D.STATUSES.map((s) => `<option value="${esc(s)}" ${s === t.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-tournament" data-id="${esc(t.id)}">${icon('trash')}Eliminar</button>
          </div>
        </article>`;
    }).join('') : emptyState('trophy', 'Aún no hay torneos', 'Crea el primero con el formulario.');
  }

  function renderTeams() {
    const list = D.teams();
    $('#team-count').textContent = list.length;
    $('#team-list').innerHTML = list.length ? list.map((tm) => {
      const inTournaments = D.tournaments().filter((t) => t.teamIds.includes(tm.id));
      return `
        <article class="card team-card">
          <div class="tag-badge" aria-hidden="true">${esc(tm.tag)}</div>
          <div>
            <div class="card-top">
              <div>
                <h3>${esc(tm.name)}</h3>
                <div class="meta"><span>${esc(tm.game)}</span><span>Capitán: ${esc(tm.captain)}</span></div>
              </div>
              <button type="button" class="btn btn-danger btn-sm" data-action="delete-team" data-id="${esc(tm.id)}" aria-label="Eliminar ${esc(tm.name)}">${icon('trash')}</button>
            </div>
            ${tm.players.length ? `<div class="chips">${tm.players.map((p) => `<span class="chip static">${esc(p)}</span>`).join('')}</div>` : ''}
            <div class="chips" aria-label="Torneos del equipo">
              ${inTournaments.length
                ? inTournaments.map((t) => `<span class="badge badge-${slug(t.status)}">${esc(t.name)}</span>`).join('')
                : '<span class="hint">Sin inscripciones a torneos.</span>'}
            </div>
          </div>
        </article>`;
    }).join('') : emptyState('users', 'Aún no hay equipos', 'Registra el primero con el formulario.');
  }

  function renderMatches() {
    const list = sortedMatches();
    $('#match-count').textContent = list.length;
    $('#match-list').innerHTML = list.length ? list.map((m) => {
      const t = D.tournament(m.tournamentId);
      return `
        <article class="card match-card">
          <div class="match-meta">
            <span>${esc(t ? t.name : 'Torneo eliminado')} · ${esc(t ? t.game : '')}</span>
            <span>${fmtDate(m.playedAt)}</span>
          </div>
          ${scoreboardHTML(m, true)}
          <div class="match-stats">
            <span class="mvp">${icon('star')}MVP ${esc(m.mvp.name)}</span>
            <span>K/D/A <b>${m.mvp.kills}/${m.mvp.deaths}/${m.mvp.assists}</b></span>
            <span>Objetivos <b>${m.objectives}</b></span>
            <span>${icon('clock')} <b>${m.duration}</b> min</span>
          </div>
          <div class="card-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-action="chronicle-for" data-id="${esc(m.id)}">${icon('spark')}Generar crónica</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-match" data-id="${esc(m.id)}">${icon('trash')}Eliminar</button>
          </div>
        </article>`;
    }).join('') : emptyState('swords', 'Aún no hay partidas', 'Registra la primera con el formulario.');
  }

  /* ----- Selects dependientes ----- */
  function refreshAssignSelects() {
    const form = $('#assign-form');
    const open = D.tournaments().filter((t) => t.status !== 'Finalizado');
    fillSelect(form.tournamentId, open.map((t) => ({ value: t.id, label: `${t.name} (${t.game})` })), 'Selecciona un torneo');
    const t = D.tournament(form.tournamentId.value);
    const candidates = D.teams().filter((tm) => !t || (tm.game === t.game && !t.teamIds.includes(tm.id)));
    fillSelect(form.teamId, candidates.map(teamOption), 'Selecciona un equipo');
  }

  function refreshMatchSelects() {
    const form = $('#match-form');
    const open = D.tournaments().filter((t) => t.status !== 'Finalizado');
    fillSelect(form.tournamentId, open.map((t) => ({ value: t.id, label: `${t.name} (${t.game})` })), 'Selecciona un torneo');
    const teams = D.teamsInTournament(form.tournamentId.value).map(teamOption);
    const placeholder = form.tournamentId.value && !teams.length ? 'Inscribe equipos primero' : 'Selecciona equipo';
    fillSelect(form.teamAId, teams, placeholder);
    fillSelect(form.teamBId, teams, placeholder);
  }

  function refreshChronicleSelect() {
    const form = $('#chron-form');
    const items = sortedMatches().filter((m) => D.team(m.teamAId) && D.team(m.teamBId)).map((m) => {
      const a = D.team(m.teamAId);
      const b = D.team(m.teamBId);
      const t = D.tournament(m.tournamentId);
      return { value: m.id, label: `${a.tag} ${m.scoreA}-${m.scoreB} ${b.tag} · ${t ? t.name : ''}` };
    });
    fillSelect(form.matchId, items, items.length ? 'Selecciona una partida' : 'No hay partidas registradas');
    renderChroniclePreview();
  }

  function renderChroniclePreview() {
    const m = D.match($('#c-match').value);
    const box = $('#chron-preview');
    if (!m) { box.innerHTML = ''; return; }
    const t = D.tournament(m.tournamentId);
    box.innerHTML = `${scoreboardHTML(m, true)}
      <div class="match-stats"><span>${esc(t ? t.name : '')}</span><span class="mvp">${icon('star')}${esc(m.mvp.name)} ${m.mvp.kills}/${m.mvp.deaths}/${m.mvp.assists}</span><span>${m.duration} min</span></div>`;
  }

  function renderAll() {
    renderDashboard();
    renderTournaments();
    renderTeams();
    renderMatches();
    refreshAssignSelects();
    refreshMatchSelects();
    refreshChronicleSelect();
  }

  /* ======================================================================
     Formularios
     ====================================================================== */
  function setupForm(form, validator, onValid) {
    const live = V.bindLive(form, validator);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const errors = live.validateAll();
      if (Object.keys(errors).length) {
        toast('Revisa los campos marcados en rojo.', 'error');
        return;
      }
      onValid(V.getValues(form));
      form.reset();
      live.reset();
      renderAll();
    });
    return live;
  }

  function setupStaticSelects() {
    const games = D.GAMES.map((g) => ({ value: g, label: g }));
    fillSelect($('#t-game'), games, 'Selecciona un videojuego');
    fillSelect($('#e-game'), games, 'Selecciona el juego');
    fillSelect($('#q-game'), games, 'Selecciona un videojuego');
    fillSelect($('#t-format'), D.FORMATS.map((f) => ({ value: f, label: f })), 'Selecciona un formato');
  }

  function setupForms() {
    // Torneos
    setupForm($('#tournament-form'),
      (v) => V.tournament(v, { tournaments: D.tournaments() }),
      (v) => {
        D.addTournament(v);
        toast(`Torneo «${v.name}» creado.`);
      });

    // Equipos
    $('#e-tag').addEventListener('input', (ev) => { ev.target.value = ev.target.value.toUpperCase(); });
    setupForm($('#team-form'),
      (v) => V.team(v, { teams: D.teams() }),
      (v) => {
        D.addTeam({ name: v.name, tag: v.tag, game: v.game, captain: v.captain, players: V.parsePlayers(v.players) });
        toast(`Equipo ${v.name} registrado.`);
      });

    // Inscripción de equipos en torneos
    const assignForm = $('#assign-form');
    assignForm.tournamentId.addEventListener('change', refreshAssignSelects);
    setupForm(assignForm,
      (v) => V.assignment(v, { tournaments: D.tournaments(), teams: D.teams() }),
      (v) => {
        D.assignTeam(v.tournamentId, v.teamId);
        toast(`${D.team(v.teamId).name} inscrito en ${D.tournament(v.tournamentId).name}.`);
      });

    // Partidas
    const matchForm = $('#match-form');
    matchForm.tournamentId.addEventListener('change', () => {
      matchForm.teamAId.value = '';
      matchForm.teamBId.value = '';
      refreshMatchSelects();
    });
    setupForm(matchForm,
      (v) => V.match(v, { tournaments: D.tournaments() }),
      (v) => {
        D.addMatch({
          tournamentId: v.tournamentId, teamAId: v.teamAId, teamBId: v.teamBId,
          scoreA: num(v.scoreA), scoreB: num(v.scoreB), duration: num(v.duration),
          mvp: { name: v.mvpName, kills: num(v.kills), deaths: num(v.deaths), assists: num(v.assists) },
          objectives: num(v.objectives)
        });
        const t = D.tournament(v.tournamentId);
        if (t && t.status === 'Abierto') {
          D.setTournamentStatus(t.id, 'En curso');
          toast(`«${t.name}» pasó a estado En curso.`, 'info');
        }
        toast('Partida registrada correctamente.');
      });
  }

  /* ======================================================================
     Crónicas con IA
     ====================================================================== */
  function matchToStory(m) {
    const t = D.tournament(m.tournamentId);
    const a = D.team(m.teamAId);
    const b = D.team(m.teamBId);
    if (!t || !a || !b) return null;
    return {
      tournament: t.name, game: t.game,
      teamA: { name: a.name, tag: a.tag }, teamB: { name: b.name, tag: b.tag },
      scoreA: m.scoreA, scoreB: m.scoreB, duration: m.duration,
      mvp: { ...m.mvp }, objectives: m.objectives
    };
  }

  function quickToStory(v) {
    return {
      tournament: v.tournamentName || 'Torneo amistoso', game: v.game,
      teamA: { name: v.teamAName, tag: tagFrom(v.teamAName) },
      teamB: { name: v.teamBName, tag: tagFrom(v.teamBName) },
      scoreA: num(v.scoreA), scoreB: num(v.scoreB), duration: num(v.duration),
      mvp: { name: v.mvpName, kills: num(v.kills), deaths: num(v.deaths), assists: num(v.assists) },
      objectives: num(v.objectives)
    };
  }

  function renderAiResult(result) {
    $('#out-social').textContent = result.social;
    $('#out-chronicle').textContent = result.chronicle;
    const status = $('#chron-status');
    status.hidden = false;
    if (result.source === 'gemini') {
      status.className = 'result-status is-gemini';
      status.innerHTML = `${icon('check')}<span>Generado con Gemini (${esc(result.model)}).</span>`;
    } else {
      status.className = 'result-status is-local';
      status.innerHTML = `${icon('alert')}<span>Modo respaldo local. ${esc(result.note || '')}</span>`;
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  function setupChronicles() {
    const form = $('#chron-form');
    const button = $('#generate-btn');
    const getMode = () => form.elements.mode.value;

    const live = V.bindLive(form, (v) => (getMode() === 'quick' ? V.quick(v) : V.chronicleMatch(v)));

    // Cambio de modo: partida registrada <-> datos rápidos
    $$('input[name="mode"]', form).forEach((radio) => radio.addEventListener('change', () => {
      const quick = getMode() === 'quick';
      $('#chron-registered').hidden = quick;
      $('#chron-quick').hidden = !quick;
      live.reset();
    }));

    $('#c-match').addEventListener('change', renderChroniclePreview);

    // API Key: solo en sessionStorage (se borra al cerrar la pestaña)
    const keyInput = $('#api-key');
    try { keyInput.value = sessionStorage.getItem(API_KEY_STORAGE) || ''; } catch (e) { /* sin sessionStorage */ }
    keyInput.addEventListener('input', () => {
      try {
        if (keyInput.value.trim()) sessionStorage.setItem(API_KEY_STORAGE, keyInput.value.trim());
        else sessionStorage.removeItem(API_KEY_STORAGE);
      } catch (e) { /* sin sessionStorage */ }
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const errors = live.validateAll();
      if (Object.keys(errors).length) {
        toast('Completa los datos de la partida para generar la crónica.', 'error');
        return;
      }
      const values = V.getValues(form);
      const story = getMode() === 'quick' ? quickToStory(values) : matchToStory(D.match(values.matchId));
      if (!story) {
        toast('No se encontraron los datos completos de esa partida.', 'error');
        return;
      }

      button.disabled = true;
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Generando…</span>';
      try {
        const result = await AI.generate(story, keyInput.value);
        renderAiResult(result);
        toast(result.source === 'gemini' ? 'Crónica generada con Gemini.' : 'Crónica generada en modo local.', result.source === 'gemini' ? 'ok' : 'info');
      } finally {
        button.disabled = false;
        button.innerHTML = `${icon('spark')}<span>Generar crónica con IA</span>`;
      }
    });
  }

  /* ======================================================================
     Eventos globales (delegación)
     ====================================================================== */
  function setupGlobalEvents() {
    document.addEventListener('click', async (ev) => {
      const el = ev.target.closest('[data-action], [data-copy]');
      if (!el) return;

      if (el.dataset.copy) {
        const text = $(`#${el.dataset.copy}`).textContent;
        const ok = await copyText(text);
        toast(ok ? 'Texto copiado al portapapeles.' : 'No se pudo copiar; selecciona el texto manualmente.', ok ? 'ok' : 'error');
        return;
      }

      const { action, id } = el.dataset;
      switch (action) {
        case 'reset-data':
          if (confirm('Se reemplazarán todos los datos actuales por los datos de prueba iniciales. ¿Continuar?')) {
            D.reset();
            renderAll();
            toast('Datos de prueba restaurados.');
          }
          break;

        case 'delete-tournament': {
          const t = D.tournament(id);
          const played = D.matchesOfTournament(id).length;
          const extra = played ? ` También se eliminarán sus ${played} partida(s).` : '';
          if (t && confirm(`¿Eliminar el torneo «${t.name}»?${extra}`)) {
            D.removeTournament(id);
            renderAll();
            toast('Torneo eliminado.');
          }
          break;
        }

        case 'delete-team': {
          const tm = D.team(id);
          if (tm && confirm(`¿Eliminar el equipo ${tm.name}?`)) {
            const res = D.removeTeam(id);
            if (res.ok) toast('Equipo eliminado.');
            else toast(res.error, 'error');
            renderAll();
          }
          break;
        }

        case 'unassign': {
          const res = D.unassignTeam(el.dataset.tid, el.dataset.team);
          if (res.ok) toast('Equipo retirado del torneo.');
          else toast(res.error, 'error');
          renderAll();
          break;
        }

        case 'delete-match':
          if (confirm('¿Eliminar esta partida?')) {
            D.removeMatch(id);
            renderAll();
            toast('Partida eliminada.');
          }
          break;

        case 'chronicle-for': {
          const form = $('#chron-form');
          form.elements.mode.value = 'registered';
          $('#chron-registered').hidden = false;
          $('#chron-quick').hidden = true;
          location.hash = '#/cronicas';
          refreshChronicleSelect();
          $('#c-match').value = id;
          renderChroniclePreview();
          break;
        }
        default:
          break;
      }
    });

    // Cambio de estado del torneo
    document.addEventListener('change', (ev) => {
      const select = ev.target.closest('select[data-action="set-status"]');
      if (!select) return;
      const t = D.tournament(select.dataset.id);
      if (t && select.value === 'Abierto' && D.matchesOfTournament(t.id).length > 0) {
        toast('No puedes reabrir un torneo que ya tiene partidas jugadas.', 'error');
      } else if (t) {
        D.setTournamentStatus(t.id, select.value);
        toast(`«${t.name}» ahora está ${select.value}.`);
      }
      renderAll();
    });
  }

  /* ======================================================================
     Arranque
     ====================================================================== */
  function init() {
    D.load();
    setupStaticSelects();
    setupForms();
    setupChronicles();
    setupGlobalEvents();
    renderAll();
    window.addEventListener('hashchange', showView);
    showView();
    if (!D.isPersistent()) {
      toast('El navegador bloquea localStorage: los datos no se guardarán al recargar.', 'error');
    }
  }

  init();
})();
