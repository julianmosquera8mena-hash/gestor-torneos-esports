/**
 * data.js
 * Capa de datos: persistencia en localStorage + datos de prueba precargados.
 * Expone el espacio de nombres global `EsportsData` (sin ES modules, para que
 * el proyecto funcione abriendo index.html directamente con file://).
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'arena.gestorTorneos.v1';

  const GAMES = [
    'Valorant', 'League of Legends', 'Counter-Strike 2', 'Dota 2',
    'Rocket League', 'Fortnite', 'EA Sports FC', 'Free Fire'
  ];
  const FORMATS = [
    'Eliminación directa', 'Doble eliminación', 'Round Robin',
    'Fase de grupos + playoffs', 'Sistema suizo'
  ];
  const STATUSES = ['Abierto', 'En curso', 'Finalizado'];

  let state = { tournaments: [], teams: [], matches: [] };
  let persistent = true; // pasa a false si localStorage no está disponible

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** Datos iniciales: 2 torneos, 4 equipos y 2 partidas jugadas. */
  function seedData() {
    const teams = [
      {
        id: 'team_seed_1', name: 'Nova Esports', tag: 'NVA', game: 'Valorant',
        captain: 'Kira', players: ['Zeta', 'Mako', 'Rune', 'Vex']
      },
      {
        id: 'team_seed_2', name: 'Cóndores GG', tag: 'CGG', game: 'Valorant',
        captain: 'Nacho', players: ['Dante', 'Sol', 'Pipe', 'Lobo']
      },
      {
        id: 'team_seed_3', name: 'Titanes del Sur', tag: 'TDS', game: 'League of Legends',
        captain: 'Mateo', players: ['Vigo', 'Luna', 'Kairo', 'Bruma']
      },
      {
        id: 'team_seed_4', name: 'Neon Wolves', tag: 'NWF', game: 'League of Legends',
        captain: 'Sofía', players: ['Rayo', 'Echo', 'Tanto', 'Nube']
      }
    ];
    const tournaments = [
      {
        id: 'trn_seed_1', name: 'Copa Andina Valorant 2026', game: 'Valorant',
        format: 'Eliminación directa', date: '2026-11-20', prize: 'USD 2.000',
        status: 'En curso', teamIds: ['team_seed_1', 'team_seed_2']
      },
      {
        id: 'trn_seed_2', name: 'Liga Bogotá Invitational de LoL', game: 'League of Legends',
        format: 'Round Robin', date: '2026-10-18', prize: 'COP 5.000.000',
        status: 'Finalizado', teamIds: ['team_seed_3', 'team_seed_4']
      }
    ];
    const matches = [
      {
        id: 'match_seed_1', tournamentId: 'trn_seed_1',
        teamAId: 'team_seed_1', teamBId: 'team_seed_2',
        scoreA: 13, scoreB: 9, duration: 43,
        mvp: { name: 'Kira', kills: 27, deaths: 14, assists: 6 },
        objectives: 9, playedAt: '2026-11-20T21:30:00'
      },
      {
        id: 'match_seed_2', tournamentId: 'trn_seed_2',
        teamAId: 'team_seed_3', teamBId: 'team_seed_4',
        scoreA: 2, scoreB: 1, duration: 78,
        mvp: { name: 'Luna', kills: 9, deaths: 4, assists: 21 },
        objectives: 14, playedAt: '2026-10-18T19:00:00'
      }
    ];
    return { tournaments, teams, matches };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      persistent = true;
    } catch (err) {
      persistent = false;
      console.warn('localStorage no disponible; los datos viven solo en memoria.', err);
    }
  }

  function isValidShape(obj) {
    return obj && Array.isArray(obj.tournaments) && Array.isArray(obj.teams) && Array.isArray(obj.matches);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidShape(parsed)) {
          state = parsed;
          return;
        }
      }
    } catch (err) {
      console.warn('No se pudo leer el almacenamiento; se cargan datos de prueba.', err);
    }
    state = seedData();
    persist();
  }

  function reset() {
    state = seedData();
    persist();
  }

  /* ---------- Lecturas ---------- */
  const tournaments = () => state.tournaments;
  const teams = () => state.teams;
  const matches = () => state.matches;
  const tournament = (id) => state.tournaments.find((t) => t.id === id) || null;
  const team = (id) => state.teams.find((t) => t.id === id) || null;
  const match = (id) => state.matches.find((m) => m.id === id) || null;
  const matchesOfTournament = (id) => state.matches.filter((m) => m.tournamentId === id);
  const matchesOfTeam = (id) => state.matches.filter((m) => m.teamAId === id || m.teamBId === id);
  const teamsInTournament = (id) => {
    const t = tournament(id);
    return t ? t.teamIds.map(team).filter(Boolean) : [];
  };

  /* ---------- Torneos ---------- */
  function addTournament(data) {
    const t = {
      id: uid('trn'), name: data.name, game: data.game, format: data.format,
      date: data.date, prize: data.prize, status: 'Abierto', teamIds: []
    };
    state.tournaments.push(t);
    persist();
    return t;
  }

  function setTournamentStatus(id, status) {
    const t = tournament(id);
    if (!t || !STATUSES.includes(status)) return false;
    t.status = status;
    persist();
    return true;
  }

  function removeTournament(id) {
    state.tournaments = state.tournaments.filter((t) => t.id !== id);
    state.matches = state.matches.filter((m) => m.tournamentId !== id);
    persist();
  }

  function assignTeam(tournamentId, teamId) {
    const t = tournament(tournamentId);
    if (!t || !team(teamId) || t.teamIds.includes(teamId)) return false;
    t.teamIds.push(teamId);
    persist();
    return true;
  }

  function unassignTeam(tournamentId, teamId) {
    const t = tournament(tournamentId);
    if (!t) return { ok: false, error: 'Torneo no encontrado.' };
    const hasMatches = matchesOfTournament(tournamentId)
      .some((m) => m.teamAId === teamId || m.teamBId === teamId);
    if (hasMatches) {
      return { ok: false, error: 'El equipo tiene partidas registradas en este torneo.' };
    }
    t.teamIds = t.teamIds.filter((id) => id !== teamId);
    persist();
    return { ok: true };
  }

  /* ---------- Equipos ---------- */
  function addTeam(data) {
    const t = {
      id: uid('team'), name: data.name, tag: data.tag.toUpperCase(),
      game: data.game, captain: data.captain, players: data.players || []
    };
    state.teams.push(t);
    persist();
    return t;
  }

  function removeTeam(id) {
    if (matchesOfTeam(id).length > 0) {
      return { ok: false, error: 'No se puede eliminar: el equipo tiene partidas registradas.' };
    }
    state.teams = state.teams.filter((t) => t.id !== id);
    state.tournaments.forEach((t) => { t.teamIds = t.teamIds.filter((tid) => tid !== id); });
    persist();
    return { ok: true };
  }

  /* ---------- Partidas ---------- */
  function addMatch(data) {
    const m = {
      id: uid('match'), tournamentId: data.tournamentId,
      teamAId: data.teamAId, teamBId: data.teamBId,
      scoreA: data.scoreA, scoreB: data.scoreB, duration: data.duration,
      mvp: data.mvp, objectives: data.objectives,
      playedAt: new Date().toISOString()
    };
    state.matches.push(m);
    persist();
    return m;
  }

  function removeMatch(id) {
    state.matches = state.matches.filter((m) => m.id !== id);
    persist();
  }

  global.EsportsData = {
    GAMES, FORMATS, STATUSES,
    load, reset, isPersistent: () => persistent,
    tournaments, teams, matches,
    tournament, team, match,
    matchesOfTournament, matchesOfTeam, teamsInTournament,
    addTournament, setTournamentStatus, removeTournament, assignTeam, unassignTeam,
    addTeam, removeTeam, addMatch, removeMatch
  };
})(window);
