import { CAREER_EVENT_TYPES, appendCareerEvent, careerEvents } from './event-ledger.js';
import { strongestStoryArc } from './newsroom-story-arcs.js';

const PRESS_SCHEMA_VERSION = 1;
const MAX_QUESTIONS = 3;
const PRESS_WINDOW_DAYS = 1;
const DAY_MS = 86_400_000;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export const NEWSROOM_PRESS_SCHEMA_VERSION = PRESS_SCHEMA_VERSION;
export const NEWSROOM_PRESS_WINDOW_DAYS = PRESS_WINDOW_DAYS;

function clean(value) {
  return String(value ?? '').trim();
}

function utcDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const [year, month, day] = String(value).split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function ageDays(gameDate, currentDate) {
  const game = utcDay(gameDate);
  const current = utcDay(currentDate);
  if (game == null || current == null) return 0;
  return Math.floor((current - game) / DAY_MS);
}

function addDays(gameDate, days) {
  const value = utcDay(gameDate);
  return value == null ? gameDate : new Date(value + days * DAY_MS).toISOString().slice(0, 10);
}

function latestUserMatch(career) {
  const clubCode = career?.clubCode;
  return careerEvents(career, { type: CAREER_EVENT_TYPES.MATCH_PLAYED, clubCode }).at(-1) || null;
}

function resultForClub(event, clubCode) {
  const facts = event?.facts || {};
  const home = facts.homeCode === clubCode;
  const away = facts.awayCode === clubCode;
  if (!home && !away) return null;
  const scored = Number(home ? facts.homeGoals : facts.awayGoals);
  const conceded = Number(home ? facts.awayGoals : facts.homeGoals);
  if (!Number.isFinite(scored) || !Number.isFinite(conceded)) return null;
  return {
    scored,
    conceded,
    outcome: scored > conceded ? 'win' : scored < conceded ? 'loss' : 'draw',
    opponentCode: home ? facts.awayCode : facts.homeCode,
    venue: home ? 'home' : 'away'
  };
}

function answeredQuestionIds(career, conferenceId) {
  return new Set(careerEvents(career, { type: CAREER_EVENT_TYPES.MANAGER_PRESS })
    .filter(event => event.facts?.conferenceId === conferenceId)
    .map(event => event.facts?.questionId)
    .filter(Boolean));
}

function option(id, tone, label, quote, effect) {
  return Object.freeze({ id, tone, label, quote, effect });
}

function resultQuestion(match, result, managerName) {
  const manager = clean(managerName) || 'Mister';
  if (result.outcome === 'win') {
    return {
      id: 'result-reaction',
      topic: 'o resultado',
      prompt: `O que mais te agradou na vitória por ${result.scored}–${result.conceded}?`,
      options: [
        option('measured', 'measured', 'Manter os pés no chão', `${manager}: "Foi uma boa atuação, mas o mais importante é manter esse nível de concentração no próximo jogo."`, { morale: 1, pressure: -1 }),
        option('ambitious', 'ambitious', 'Elevar a ambição', `${manager}: "Esse é o padrão que queremos. Quando jogamos assim, temos condições de competir contra qualquer adversário."`, { morale: 2, pressure: 2 }),
        option('collective', 'collective', 'Valorizar o grupo', `${manager}: "A vitória pertence ao elenco. Quem começou e quem entrou entendeu exatamente o que a partida pedia."`, { morale: 2, pressure: 0 })
      ]
    };
  }
  if (result.outcome === 'loss') {
    return {
      id: 'result-reaction',
      topic: 'a derrota',
      prompt: `Como você explica a derrota por ${result.conceded}–${result.scored}?`,
      options: [
        option('accountable', 'accountable', 'Assumir responsabilidade', `${manager}: "A responsabilidade começa comigo. Precisamos entender onde falhamos e responder melhor no próximo jogo."`, { morale: 1, pressure: -1 }),
        option('demanding', 'demanding', 'Cobrar reação', `${manager}: "Esse nível não é suficiente para o que queremos construir. A resposta precisa aparecer já no próximo jogo."`, { morale: -1, pressure: 2 }),
        option('protective', 'protective', 'Proteger o elenco', `${manager}: "Não vou transformar uma derrota em caça a culpados. Vamos corrigir os erros juntos e seguir trabalhando."`, { morale: 2, pressure: 0 })
      ]
    };
  }
  return {
    id: 'result-reaction',
    topic: 'o empate',
    prompt: `Qual é a sua leitura do empate em ${result.scored}–${result.conceded}?`,
    options: [
      option('balanced', 'measured', 'Reconhecer o equilíbrio', `${manager}: "Foi um jogo equilibrado. Houve momentos bons e outros que precisamos revisar com calma."`, { morale: 0, pressure: -1 }),
      option('frustrated', 'demanding', 'Mostrar frustração', `${manager}: "Criamos condições para conseguir mais. Precisamos ser mais eficientes quando a oportunidade aparece."`, { morale: -1, pressure: 1 }),
      option('positive', 'collective', 'Destacar a reação', `${manager}: "O grupo continuou competindo até o fim. Esse comportamento é uma base importante para a sequência."`, { morale: 1, pressure: 0 })
    ]
  };
}

function rivalryQuestion(match, result, managerName) {
  if (!match?.facts?.rivalry && !match?.context?.rivalry) return null;
  const manager = clean(managerName) || 'Mister';
  return {
    id: 'rivalry',
    topic: 'a rivalidade',
    prompt: 'Um clássico muda o peso emocional desse resultado?',
    options: [
      option('respect', 'measured', 'Respeitar o contexto', `${manager}: "Sabemos o que esse jogo representa para os torcedores, mas a temporada exige o mesmo foco em cada rodada."`, { morale: 1, pressure: -1 }),
      option('edge', 'ambitious', 'Usar a rivalidade', `${manager}: "Clássicos têm um peso diferente. Queremos que o adversário saiba que enfrentar nosso time nunca será confortável."`, { morale: 2, pressure: 2 }),
      option('calm', 'protective', 'Reduzir a temperatura', `${manager}: "A emoção faz parte, mas nossa obrigação é tomar boas decisões dentro de campo, independentemente do adversário."`, { morale: 0, pressure: -2 })
    ]
  };
}

function storyQuestion(arc, managerName) {
  if (!arc) return null;
  const manager = clean(managerName) || 'Mister';
  if (arc.type === 'form.winning-streak') {
    return {
      id: 'story-arc', topic: 'a sequência positiva',
      prompt: `${arc.facts?.streak || 0} vitórias seguidas mudam as expectativas para a equipe?`,
      options: [
        option('process', 'measured', 'Falar do processo', `${manager}: "A sequência é consequência do trabalho. Não vamos trocar processo por euforia."`, { morale: 1, pressure: -1 }),
        option('belief', 'ambitious', 'Assumir confiança', `${manager}: "Vitórias constroem confiança. O grupo sabe que pode mirar objetivos maiores se mantiver esse padrão."`, { morale: 2, pressure: 2 }),
        option('squad', 'collective', 'Dividir o mérito', `${manager}: "Uma sequência assim só acontece quando o elenco inteiro sustenta o nível, inclusive quem não aparece nas manchetes."`, { morale: 2, pressure: 0 })
      ]
    };
  }
  if (arc.type === 'form.losing-streak') {
    return {
      id: 'story-arc', topic: 'a sequência negativa',
      prompt: `${arc.facts?.streak || 0} derrotas seguidas aumentam a pressão sobre o trabalho?`,
      options: [
        option('accountability', 'accountable', 'Aceitar a pressão', `${manager}: "A pressão é parte do trabalho. O que importa é encontrar respostas concretas e não procurar desculpas."`, { morale: 1, pressure: 0 }),
        option('defiant', 'ambitious', 'Rejeitar o pânico', `${manager}: "Não vamos permitir que uma sequência defina quem somos. Tenho convicção no trabalho e neste elenco."`, { morale: 2, pressure: 2 }),
        option('protect', 'protective', 'Proteger o grupo', `${manager}: "É justamente agora que o elenco precisa de clareza e proteção. A cobrança fica comigo."`, { morale: 2, pressure: -1 })
      ]
    };
  }
  if (arc.type === 'player.scoring-form') {
    const goals = Number(arc.facts?.goals) || 0;
    const matches = Number(arc.facts?.matchesScoredIn) || 0;
    const windowMatches = Number(arc.facts?.windowMatches) || 0;
    return {
      id: 'story-arc', topic: 'a fase do artilheiro',
      prompt: `Seu artilheiro soma ${goals} gols e marcou em ${matches} dos últimos ${windowMatches} jogos. Como você administra esse momento?`,
      options: [
        option('keep-rhythm', 'measured', 'Preservar o ritmo', `${manager}: "A fase é boa, mas nosso trabalho é criar condições para que ele continue chegando às chances sem carregar o time sozinho."`, { morale: 1, pressure: -1 }),
        option('praise-scorer', 'ambitious', 'Valorizar o artilheiro', `${manager}: "Ele está sendo decisivo e merece o reconhecimento. Queremos jogadores que assumam responsabilidade nos grandes momentos."`, { morale: 2, pressure: 2 }),
        option('team-credit', 'collective', 'Dividir o mérito', `${manager}: "Os gols aparecem no nome de um jogador, mas começam no trabalho coletivo. O mérito dessa fase também é do time."`, { morale: 2, pressure: 0 })
      ]
    };
  }
  return null;
}

function conferenceQuestions(career, match, result) {
  const arc = strongestStoryArc(career, career.clubCode);
  return [
    resultQuestion(match, result, career.managerName),
    rivalryQuestion(match, result, career.managerName),
    storyQuestion(arc, career.managerName)
  ].filter(Boolean).slice(0, MAX_QUESTIONS);
}

function applyPressEffect(career, selected) {
  const moraleDelta = Number(selected?.effect?.morale) || 0;
  const pressureDelta = Number(selected?.effect?.pressure) || 0;
  career.pressState = {
    mediaPressure: clamp((Number(career.pressState?.mediaPressure) || 50) + pressureDelta, 0, 100),
    lastTone: selected?.tone || 'measured',
    lastResponseDate: career.currentDate || null
  };
  if (moraleDelta && career.playerState && typeof career.playerState === 'object') {
    for (const state of Object.values(career.playerState)) {
      if (!state || typeof state !== 'object') continue;
      state.morale = clamp((Number(state.morale) || 70) + moraleDelta, 0, 100);
    }
  }
}

export function buildPressConference(career) {
  if (!career?.clubCode) return null;
  const match = latestUserMatch(career);
  if (!match) return null;
  const pressAge = ageDays(match.gameDate, career.currentDate);
  if (pressAge < 0 || pressAge > PRESS_WINDOW_DAYS) return null;
  const conferenceId = `press-${match.id}`;
  const result = resultForClub(match, career.clubCode);
  if (!result) return null;
  const answered = answeredQuestionIds(career, conferenceId);
  const questions = conferenceQuestions(career, match, result).filter(question => !answered.has(question.id));
  if (!questions.length) return null;
  return {
    schemaVersion: PRESS_SCHEMA_VERSION,
    id: conferenceId,
    gameDate: match.gameDate,
    expiresOn: addDays(match.gameDate, PRESS_WINDOW_DAYS),
    ageDays: pressAge,
    sourceEventId: match.id,
    clubCode: career.clubCode,
    opponentCode: result.opponentCode,
    outcome: result.outcome,
    score: { for: result.scored, against: result.conceded },
    answeredQuestionIds: [...answered],
    questions
  };
}

export function pressQuestion(conference, questionId) {
  return conference?.questions?.find(question => question.id === questionId) || null;
}

export function pressResponseOption(conference, questionId, optionId) {
  return pressQuestion(conference, questionId)?.options?.find(candidate => candidate.id === optionId) || null;
}

export function recordPressResponse(career, conference, questionId, optionId) {
  if (!career || !conference || conference.clubCode !== career.clubCode) return null;
  const current = buildPressConference(career);
  if (!current || current.id !== conference.id || current.sourceEventId !== conference.sourceEventId) return null;
  const question = pressQuestion(current, questionId);
  const selected = pressResponseOption(current, questionId, optionId);
  if (!question || !selected) return null;

  const event = appendCareerEvent(career, {
    id: `evt-${conference.id}-${question.id}`,
    type: CAREER_EVENT_TYPES.MANAGER_PRESS,
    gameDate: conference.gameDate,
    source: 'newsroom-press-conference',
    scope: 'club',
    entities: { clubCodes: [career.clubCode] },
    facts: {
      conferenceId: conference.id,
      sourceEventId: conference.sourceEventId,
      questionId: question.id,
      topic: question.topic,
      managerName: career.managerName,
      tone: selected.tone,
      optionId: selected.id,
      summary: selected.quote,
      quote: selected.quote,
      effect: selected.effect
    },
    context: {
      opponentCode: conference.opponentCode,
      outcome: conference.outcome,
      score: conference.score
    },
    links: { sourceEventId: conference.sourceEventId }
  });

  if (!event) return null;
  applyPressEffect(career, selected);
  return {
    event,
    question,
    selected,
    remainingQuestions: buildPressConference(career)?.questions?.length || 0,
    pressState: { ...career.pressState }
  };
}
