/**
 * validations.js
 * Validaciones de formularios (en tiempo real y al enviar) y reglas de negocio.
 * Cada validador recibe los valores del formulario y devuelve un objeto
 * { campo: "mensaje de error" }. Si el objeto está vacío, el formulario es válido.
 * Expone el espacio de nombres global `Validators`.
 */
(function (global) {
  'use strict';

  /* ---------- Utilidades ---------- */
  const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
  const isInt = (v) => /^-?\d+$/.test(String(v).trim());
  const norm = (s) => String(s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  /** Convierte "ana, beto\ncarla" en ['ana', 'beto', 'carla'] */
  function parsePlayers(text) {
    return String(text || '')
      .split(/[,\n;]/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function checkText(errors, key, value, { label, min = 1, max = 60, requiredMsg }) {
    const v = String(value ?? '').trim();
    if (!v) errors[key] = requiredMsg || `${label} es obligatorio.`;
    else if (v.length < min) errors[key] = `${label} debe tener al menos ${min} caracteres.`;
    else if (v.length > max) errors[key] = `${label} no puede superar los ${max} caracteres.`;
  }

  function checkInt(errors, key, value, { min = 0, max = 9999, label }) {
    if (isBlank(value)) {
      errors[key] = `${label}: ingresa un número.`;
    } else if (!isInt(value)) {
      errors[key] = `${label}: debe ser un número entero.`;
    } else {
      const n = Number(value);
      if (n < min) errors[key] = min === 0 ? `${label}: no puede ser negativo.` : `${label}: debe ser al menos ${min}.`;
      else if (n > max) errors[key] = `${label}: no puede ser mayor que ${max}.`;
    }
  }

  /** Reglas compartidas por el formulario de partidas y el de datos rápidos. */
  function checkMatchNumbers(errors, v) {
    checkInt(errors, 'scoreA', v.scoreA, { label: 'Marcador A', max: 999 });
    checkInt(errors, 'scoreB', v.scoreB, { label: 'Marcador B', max: 999 });
    if (!errors.scoreA && !errors.scoreB && Number(v.scoreA) === Number(v.scoreB)) {
      errors.scoreB = 'El marcador no puede terminar empatado: define un ganador.';
    }
    checkInt(errors, 'duration', v.duration, { label: 'Duración', min: 1, max: 600 });
    checkText(errors, 'mvpName', v.mvpName, { label: 'El nombre del MVP', min: 2, max: 30 });
    checkInt(errors, 'kills', v.kills, { label: 'Kills', max: 999 });
    checkInt(errors, 'deaths', v.deaths, { label: 'Muertes', max: 999 });
    checkInt(errors, 'assists', v.assists, { label: 'Asistencias', max: 999 });
    checkInt(errors, 'objectives', v.objectives, { label: 'Objetivos', max: 999 });
  }

  /* ---------- Validadores de negocio ---------- */

  /** ctx: { tournaments } */
  function tournament(v, ctx) {
    const e = {};
    checkText(e, 'name', v.name, { label: 'El nombre', min: 3, max: 60 });
    if (!e.name && ctx.tournaments.some((t) => norm(t.name) === norm(v.name))) {
      e.name = 'Ya existe un torneo con ese nombre.';
    }
    if (isBlank(v.game)) e.game = 'Selecciona un videojuego.';
    if (isBlank(v.format)) e.format = 'Selecciona un formato.';
    if (isBlank(v.date)) e.date = 'Elige la fecha del torneo.';
    else if (Number.isNaN(Date.parse(v.date))) e.date = 'La fecha no es válida.';
    checkText(e, 'prize', v.prize, {
      label: 'El premio', min: 1, max: 40,
      requiredMsg: 'Indica el premio (por ejemplo, USD 1.000).'
    });
    return e;
  }

  /** ctx: { teams } */
  function team(v, ctx) {
    const e = {};
    checkText(e, 'name', v.name, { label: 'El nombre', min: 2, max: 30 });
    if (!e.name && ctx.teams.some((t) => norm(t.name) === norm(v.name))) {
      e.name = 'Ya existe un equipo con ese nombre.';
    }
    if (isBlank(v.tag)) e.tag = 'El tag es obligatorio.';
    else if (!/^[A-Za-z0-9]{2,5}$/.test(v.tag.trim())) e.tag = 'El tag debe tener de 2 a 5 letras o números, sin espacios.';
    else if (ctx.teams.some((t) => t.tag.toUpperCase() === v.tag.trim().toUpperCase())) {
      e.tag = 'Ese tag ya lo usa otro equipo.';
    }
    if (isBlank(v.game)) e.game = 'Selecciona el juego principal.';
    checkText(e, 'captain', v.captain, { label: 'El capitán', min: 2, max: 30 });

    const players = parsePlayers(v.players);
    if (players.length > 8) {
      e.players = 'Máximo 8 jugadores adicionales.';
    } else if (players.some((p) => p.length > 30)) {
      e.players = 'Cada nombre de jugador debe tener máximo 30 caracteres.';
    } else if (new Set(players.map(norm)).size !== players.length) {
      e.players = 'Hay nombres de jugadores repetidos.';
    } else if (!isBlank(v.captain) && players.some((p) => norm(p) === norm(v.captain))) {
      e.players = 'El capitán ya está incluido; quítalo de la lista de jugadores.';
    }
    return e;
  }

  /** ctx: { tournaments, teams } */
  function assignment(v, ctx) {
    const e = {};
    const t = ctx.tournaments.find((x) => x.id === v.tournamentId);
    const tm = ctx.teams.find((x) => x.id === v.teamId);
    if (isBlank(v.tournamentId)) e.tournamentId = 'Selecciona un torneo.';
    else if (!t) e.tournamentId = 'El torneo seleccionado ya no existe.';
    else if (t.status === 'Finalizado') e.tournamentId = 'El torneo ya finalizó y no admite nuevos equipos.';

    if (isBlank(v.teamId)) e.teamId = 'Selecciona un equipo.';
    else if (!tm) e.teamId = 'El equipo seleccionado ya no existe.';

    if (t && tm && !e.tournamentId && !e.teamId) {
      if (t.teamIds.includes(tm.id)) e.teamId = 'Este equipo ya está inscrito en ese torneo.';
      else if (tm.game !== t.game) e.teamId = `El equipo juega ${tm.game}, pero el torneo es de ${t.game}.`;
    }
    return e;
  }

  /** ctx: { tournaments } */
  function match(v, ctx) {
    const e = {};
    const t = ctx.tournaments.find((x) => x.id === v.tournamentId);
    if (isBlank(v.tournamentId)) e.tournamentId = 'Selecciona un torneo.';
    else if (!t) e.tournamentId = 'El torneo seleccionado ya no existe.';
    else if (t.status === 'Finalizado') e.tournamentId = 'El torneo está finalizado: no admite nuevas partidas.';

    if (isBlank(v.teamAId)) e.teamAId = 'Selecciona el equipo A.';
    else if (t && !t.teamIds.includes(v.teamAId)) e.teamAId = 'El equipo A no está inscrito en este torneo.';
    if (isBlank(v.teamBId)) e.teamBId = 'Selecciona el equipo B.';
    else if (t && !t.teamIds.includes(v.teamBId)) e.teamBId = 'El equipo B no está inscrito en este torneo.';
    if (!e.teamAId && !e.teamBId && v.teamAId === v.teamBId) {
      e.teamBId = 'Un equipo no puede enfrentarse a sí mismo.';
    }
    checkMatchNumbers(e, v);
    return e;
  }

  /** Datos rápidos del módulo de IA (sin necesidad de registrar la partida). */
  function quick(v) {
    const e = {};
    checkText(e, 'teamAName', v.teamAName, { label: 'El equipo A', min: 2, max: 30 });
    checkText(e, 'teamBName', v.teamBName, { label: 'El equipo B', min: 2, max: 30 });
    if (!e.teamAName && !e.teamBName && norm(v.teamAName) === norm(v.teamBName)) {
      e.teamBName = 'Los dos equipos deben ser distintos.';
    }
    if (isBlank(v.game)) e.game = 'Selecciona un videojuego.';
    if (!isBlank(v.tournamentName) && v.tournamentName.trim().length > 60) {
      e.tournamentName = 'El nombre del torneo no puede superar los 60 caracteres.';
    }
    checkMatchNumbers(e, v);
    return e;
  }

  function chronicleMatch(v) {
    return isBlank(v.matchId) ? { matchId: 'Selecciona una partida registrada.' } : {};
  }

  /* ---------- Utilidades de interfaz ---------- */

  /** Devuelve los valores del formulario como objeto { name: value } (recortados). */
  function getValues(form) {
    const values = {};
    new FormData(form).forEach((val, key) => {
      values[key] = typeof val === 'string' ? val.trim() : val;
    });
    return values;
  }

  /** Muestra u oculta el error de un campo concreto. */
  function applyField(form, name, message, touched) {
    const span = form.querySelector(`[data-error-for="${name}"]`);
    const input = form.querySelector(`[name="${name}"]`);
    const wrapper = input ? input.closest('.field') : null;
    if (span) span.textContent = message || '';
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    if (wrapper) {
      wrapper.classList.toggle('has-error', Boolean(message));
      wrapper.classList.toggle('is-valid', !message && Boolean(touched));
    }
  }

  /**
   * Activa la validación en tiempo real. Un campo se valida cuando el usuario
   * interactúa con él; al enviar se validan todos.
   * Devuelve { validateAll(), reset() }.
   */
  function bindLive(form, runValidator) {
    const touched = new Set();
    const names = () => Array.from(form.querySelectorAll('[data-error-for]')).map((s) => s.dataset.errorFor);

    function onChange(ev) {
      const name = ev.target && ev.target.name;
      if (!name || !names().includes(name)) return;
      touched.add(name);
      const errors = runValidator(getValues(form));
      // Se revalidan todos los campos tocados porque algunas reglas cruzan campos
      // (equipo A/B, marcador A/B...).
      touched.forEach((n) => applyField(form, n, errors[n], true));
    }

    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
    form.addEventListener('focusout', onChange);

    return {
      validateAll() {
        const errors = runValidator(getValues(form));
        names().forEach((n) => {
          touched.add(n);
          applyField(form, n, errors[n], true);
        });
        const first = Object.keys(errors).find((k) => form.querySelector(`[name="${k}"]`));
        if (first) {
          const el = form.querySelector(`[name="${first}"]`);
          if (el && typeof el.focus === 'function') el.focus();
        }
        return errors;
      },
      reset() {
        touched.clear();
        names().forEach((n) => applyField(form, n, '', false));
      }
    };
  }

  global.Validators = {
    parsePlayers, norm,
    tournament, team, assignment, match, quick, chronicleMatch,
    getValues, bindLive
  };
})(window);
