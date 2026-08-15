import { CAREER_EVENT_TYPES, latestCareerEvents } from './event-ledger.js';
import { strongestStoryArc } from './newsroom-story-arcs.js';
import { factualClaimsFromEvent, rankNewsEvents } from './newsroom-editorial.js';
import { selectEditorialEdition } from './newsroom-edition.js';
import { MILESTONE_KINDS, NEWSROOM_PERFORMANCE_EVENT_TYPES, PERFORMANCE_KINDS } from './newsroom-performance-types.js';

function nameOf(code, resolver, fallback = code) {
  if (!code) return fallback || '';
  if (typeof resolver === 'function') return resolver(code) || fallback || code;
  return resolver?.[code]?.name || resolver?.[code] || fallback || code;
}

function playerNameOf(playerId, resolver) {
  if (!playerId) return 'Jogador';
  if (typeof resolver === 'function') return resolver(playerId) || playerId;
  return resolver?.[playerId]?.name || resolver?.[playerId] || playerId;
}

function scoreline(facts = {}) {
  return `${Number(facts.homeGoals) || 0}–${Number(facts.awayGoals) || 0}`;
}

function formatFee(value, formatter) {
  const amount = Number(value) || 0;
  if (!amount) return null;
  if (typeof formatter === 'function') return formatter(amount);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1
  }).format(amount);
}

function matchCopy(event, context) {
  const facts = event.facts || {};
  const home = nameOf(facts.homeCode, context.clubResolver);
  const away = nameOf(facts.awayCode, context.clubResolver);
  const homeGoals = Number(facts.homeGoals) || 0;
  const awayGoals = Number(facts.awayGoals) || 0;
  const draw = homeGoals === awayGoals;
  const winner = homeGoals > awayGoals ? home : away;
  const loser = homeGoals > awayGoals ? away : home;
  const margin = Math.abs(homeGoals - awayGoals);
  const rivalry = Boolean(facts.rivalry || event.context?.rivalry);
  const titleRace = Boolean(event.context?.titleRace);
  const upset = Number(event.context?.eloUpsetGap) >= 50;

  if (draw) {
    return {
      label: rivalry ? 'CLÁSSICO' : 'RESULTADO',
      title: `${home} e ${away} empatam em ${scoreline(facts)}`,
      summary: titleRace
        ? 'O empate mantém a disputa apertada e aumenta o peso da próxima rodada.'
        : 'As duas equipes dividem os pontos após um confronto equilibrado.'
    };
  }

  const verb = margin >= 3 ? 'goleia' : upset ? 'surpreende' : rivalry ? 'vence o clássico contra' : 'vence';
  return {
    label: rivalry ? 'CLÁSSICO' : titleRace ? 'CORRIDA PELO TÍTULO' : 'RESULTADO',
    title: `${winner} ${verb} ${loser}: ${scoreline(facts)}`,
    summary: margin >= 3
      ? 'A diferença no placar transforma o resultado em uma das atuações de maior impacto da rodada.'
      : titleRace
        ? 'Os três pontos alteram o equilíbrio da disputa e colocam pressão direta nos concorrentes.'
        : 'O resultado muda o momento das equipes e passa a pesar na preparação para a sequência.'
  };
}

function goalCopy(event, context) {
  const player = playerNameOf(event.facts?.playerId || event.entities?.playerIds?.[0], context.playerResolver);
  const club = nameOf(event.facts?.clubCode, context.clubResolver, 'sua equipe');
  const minute = Number(event.facts?.minute) || 0;
  return {
    label: 'GOL',
    title: `${player} marca para o ${club}`,
    summary: `${event.facts?.isPenalty ? 'De pênalti, ' : ''}${player} balançou a rede aos ${minute} minutos.`
  };
}

function redCardCopy(event, context) {
  const player = playerNameOf(event.facts?.playerId || event.entities?.playerIds?.[0], context.playerResolver);
  const club = nameOf(event.facts?.clubCode, context.clubResolver, 'sua equipe');
  const minute = Number(event.facts?.minute) || 0;
  return {
    label: 'DISCIPLINA',
    title: `${player} é expulso pelo ${club}`,
    summary: `O cartão vermelho aos ${minute} minutos alterou o contexto da partida e passou a fazer parte do registro oficial do jogo.`
  };
}

function injuryCopy(event, context) {
  const playerId = event.entities?.playerIds?.[0];
  const clubCode = event.entities?.clubCodes?.[0];
  const player = playerNameOf(playerId, context.playerResolver);
  const club = nameOf(clubCode, context.clubResolver);
  const daysOut = Math.max(0, Number(event.facts?.daysOut) || 0);
  return {
    label: 'DEPARTAMENTO MÉDICO',
    title: `${player} desfalca o ${club}`,
    summary: daysOut
      ? `A avaliação aponta uma ausência estimada de ${daysOut} dias, obrigando a comissão técnica a rever opções para a sequência.`
      : 'O jogador será acompanhado pelo departamento médico antes de voltar a ficar disponível.'
  };
}

function performanceCopy(event, context) {
  const facts = event.facts || {};
  const player = playerNameOf(facts.playerId || event.entities?.playerIds?.[0], context.playerResolver);
  const club = nameOf(facts.clubCode, context.clubResolver, 'equipe');
  const opponent = nameOf(facts.opponentCode, context.clubResolver, 'adversário');
  const kinds = Array.isArray(facts.performanceTypes) ? facts.performanceTypes : [];
  const seasonMilestone = (facts.milestonesReached || []).find(item => item?.kind === MILESTONE_KINDS.SEASON_GOALS);
  const milestoneTail = seasonMilestone ? ` Com a atuação, chegou a ${Number(seasonMilestone.value) || 0} gols na temporada.` : '';

  if (kinds.includes(PERFORMANCE_KINDS.FOUR_PLUS_GOALS)) {
    return { label: 'ATUAÇÃO', title: `${player} marca ${Number(facts.goals) || 4} vezes pelo ${club}`, summary: `${player} foi às redes ${Number(facts.goals) || 4} vezes diante do ${opponent}.${milestoneTail}` };
  }
  if (kinds.includes(PERFORMANCE_KINDS.HAT_TRICK)) {
    return { label: 'HAT-TRICK', title: `${player} marca hat-trick pelo ${club}`, summary: `Três gols de ${player} contra o ${opponent} transformaram a partida em uma atuação individual de destaque.${milestoneTail}` };
  }
  if (kinds.includes(PERFORMANCE_KINDS.BRACE)) {
    return { label: 'DESTAQUE', title: `${player} marca duas vezes pelo ${club}`, summary: `${player} fez dois gols diante do ${opponent}.${milestoneTail}` };
  }
  if (kinds.includes(PERFORMANCE_KINDS.ASSIST_DOUBLE)) {
    return { label: 'DESTAQUE', title: `${player} distribui ${Number(facts.assists) || 2} assistências pelo ${club}`, summary: `${player} participou diretamente da criação de ${Number(facts.assists) || 2} gols diante do ${opponent}.` };
  }
  if (kinds.includes(PERFORMANCE_KINDS.STARTER_SHUTOUT)) {
    return { label: 'DEFESA', title: `${player} é titular em jogo do ${club} sem sofrer gols`, summary: `O ${club} terminou a partida contra o ${opponent} sem ser vazado, com ${player} entre os titulares. O save não atribui clean sheet individual oficial sem minutos completos de substituição.` };
  }
  return { label: 'ATUAÇÃO', title: `${player} se destaca pelo ${club}`, summary: 'A atuação foi registrada diretamente a partir dos eventos canônicos da partida.' };
}

function milestoneCopy(event, context) {
  const facts = event.facts || {};
  const player = playerNameOf(facts.playerId || event.entities?.playerIds?.[0], context.playerResolver);
  const club = nameOf(facts.clubCode, context.clubResolver, 'equipe');
  const milestones = Array.isArray(facts.milestones) ? facts.milestones : [];
  const firstClubGoal = milestones.some(item => item?.kind === MILESTONE_KINDS.FIRST_CLUB_GOAL);
  const season = milestones.find(item => item?.kind === MILESTONE_KINDS.SEASON_GOALS);
  if (firstClubGoal && season) {
    return { label: 'MARCA', title: `${player} faz primeiro gol pelo ${club} e chega a ${season.value} na temporada`, summary: 'Os dois marcos foram alcançados na mesma partida e são derivados do histórico completo de gols do save.' };
  }
  if (season) {
    return { label: 'MARCA', title: `${player} alcança ${season.value} gols na temporada`, summary: `${player} atingiu a marca de ${season.value} gols após o jogo mais recente pelo ${club}.` };
  }
  return { label: 'PRIMEIRO GOL', title: `${player} marca pela primeira vez com a camisa do ${club}`, summary: 'É o primeiro gol registrado pelo jogador para este clube no histórico da carreira.' };
}

function transferCopy(event, context) {
  const facts = event.facts || {};
  const playerId = facts.playerId || event.entities?.playerIds?.[0];
  const player = playerNameOf(playerId, context.playerResolver);
  const from = nameOf(facts.fromClubCode, context.clubResolver, 'clube anterior');
  const to = nameOf(facts.toClubCode, context.clubResolver, 'novo clube');
  const fee = formatFee(facts.fee, context.formatMoney);
  if (event.type === CAREER_EVENT_TYPES.TRANSFER_COMPLETED) {
    if (facts.freeAgent) {
      return { label: 'MERCADO', title: `${player} assina com o ${to} como agente livre`, summary: 'O jogador chegou sem taxa de transferência e passa a integrar o novo elenco após o acordo contratual.' };
    }
    return { label: 'MERCADO', title: `${player} deixa o ${from} e acerta com o ${to}`, summary: fee ? `A transferência foi concluída por ${fee}, encerrando a negociação entre os clubes.` : 'Os clubes concluíram a transferência e o jogador passa a integrar o novo elenco.' };
  }
  if (event.type === CAREER_EVENT_TYPES.LOAN_COMPLETED) {
    return { label: 'EMPRÉSTIMO', title: `${player} troca o ${from} pelo ${to} por empréstimo`, summary: facts.endDate ? `O acordo temporário foi fechado até ${facts.endDate} e passa a fazer parte do planejamento esportivo das duas equipes.` : 'O acordo temporário foi fechado e passa a fazer parte do planejamento esportivo das duas equipes.' };
  }
  return { label: facts.loan ? 'EMPRÉSTIMO' : 'MERCADO', title: `${player} entra no radar do mercado`, summary: 'A movimentação ainda não representa uma transferência concluída e seguirá sendo acompanhada.' };
}

function pressCopy(event, context) {
  const clubCode = event.entities?.clubCodes?.[0];
  const club = nameOf(clubCode, context.clubResolver);
  const manager = event.facts?.managerName || context.managerName || 'O treinador';
  const topic = event.facts?.topic || 'o momento da equipe';
  return { label: 'COLETIVA', title: `${manager} fala sobre ${topic}`, summary: event.facts?.summary || `${club} encerra a preparação com declarações do treinador antes do próximo compromisso.` };
}

function genericCopy(event, context) {
  const clubCode = event.entities?.clubCodes?.[0];
  const club = nameOf(clubCode, context.clubResolver, 'Clube');
  return { label: 'NOTÍCIAS', title: event.facts?.headline || `${club} tem nova atualização no modo carreira`, summary: event.facts?.summary || 'O acontecimento foi registrado pelo mundo da carreira e pode ganhar novos desdobramentos.' };
}

function copyFor(event, context) {
  if (event.type === CAREER_EVENT_TYPES.MATCH_PLAYED) return matchCopy(event, context);
  if (event.type === CAREER_EVENT_TYPES.GOAL) return goalCopy(event, context);
  if (event.type === CAREER_EVENT_TYPES.RED_CARD) return redCardCopy(event, context);
  if (event.type === CAREER_EVENT_TYPES.INJURY) return injuryCopy(event, context);
  if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE) return performanceCopy(event, context);
  if (event.type === NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE) return milestoneCopy(event, context);
  if ([CAREER_EVENT_TYPES.TRANSFER_LISTED, CAREER_EVENT_TYPES.TRANSFER_OFFERED, CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type)) return transferCopy(event, context);
  if (event.type === CAREER_EVENT_TYPES.MANAGER_PRESS) return pressCopy(event, context);
  return genericCopy(event, context);
}

function categoryFor(event, context) {
  return event.entities?.clubCodes?.includes(context.userClubCode) ? 'club' : 'league';
}

function mediaIntentFor(event, heroPlayerId = null) {
  const eventPlayers = [...(event.entities?.playerIds || [])];
  const playerIds = heroPlayerId ? [heroPlayerId, ...eventPlayers.filter(id => id !== heroPlayerId)] : eventPlayers;
  return { eventId: event.id, type: event.type, clubCodes: [...(event.entities?.clubCodes || [])], playerIds, fixtureId: event.links?.fixtureId || event.facts?.fixtureId || null, preference: playerIds.length ? 'player' : event.entities?.clubCodes?.length ? 'club' : 'competition' };
}

function relatedMatchEvents(matchEvent, allEvents) {
  const fixtureId = matchEvent?.facts?.fixtureId || matchEvent?.links?.fixtureId;
  if (!fixtureId) return [];
  const supported = new Set([CAREER_EVENT_TYPES.GOAL, CAREER_EVENT_TYPES.RED_CARD, CAREER_EVENT_TYPES.INJURY]);
  return allEvents
    .filter(event => event.id !== matchEvent.id)
    .filter(event => supported.has(event.type))
    .filter(event => String(event.facts?.fixtureId || event.links?.fixtureId || '') === String(fixtureId))
    .sort((left, right) => Number(left.facts?.minute || 999) - Number(right.facts?.minute || 999) || left.id.localeCompare(right.id));
}

function matchTimelineClaims(matchEvent, allEvents) {
  return relatedMatchEvents(matchEvent, allEvents).flatMap(event => factualClaimsFromEvent(event));
}

function matchHeroPlayerId(matchEvent, allEvents) {
  if (matchEvent?.type !== CAREER_EVENT_TYPES.MATCH_PLAYED) return null;
  const facts = matchEvent.facts || {};
  const winnerCode = Number(facts.homeGoals) > Number(facts.awayGoals) ? facts.homeCode : Number(facts.awayGoals) > Number(facts.homeGoals) ? facts.awayCode : null;
  const rows = new Map();
  for (const event of relatedMatchEvents(matchEvent, allEvents)) {
    if (event.type !== CAREER_EVENT_TYPES.GOAL || !event.facts?.playerId) continue;
    const id = event.facts.playerId;
    const row = rows.get(id) || { playerId: id, goals: 0, winnerGoals: 0, latestMinute: 0 };
    row.goals += 1;
    if (winnerCode && event.facts.clubCode === winnerCode) row.winnerGoals += 1;
    row.latestMinute = Math.max(row.latestMinute, Number(event.facts.minute) || 0);
    rows.set(id, row);
  }
  return [...rows.values()].sort((left, right) => right.goals - left.goals || right.winnerGoals - left.winnerGoals || right.latestMinute - left.latestMinute || left.playerId.localeCompare(right.playerId))[0]?.playerId || null;
}

function relatedAchievementClaims(event, allEvents) {
  if (![NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE, NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE].includes(event.type)) return [];
  const fixtureId = event.facts?.fixtureId;
  const playerId = event.facts?.playerId;
  return allEvents
    .filter(other => other.id !== event.id)
    .filter(other => [NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_PERFORMANCE, NEWSROOM_PERFORMANCE_EVENT_TYPES.PLAYER_MILESTONE].includes(other.type))
    .filter(other => String(other.facts?.fixtureId || '') === String(fixtureId || '') && String(other.facts?.playerId || '') === String(playerId || ''))
    .flatMap(other => factualClaimsFromEvent(other));
}

function claimsForArticle(event, allEvents) {
  const own = factualClaimsFromEvent(event);
  if (event.type === CAREER_EVENT_TYPES.MATCH_PLAYED) return [...own, ...matchTimelineClaims(event, allEvents)];
  return [...own, ...relatedAchievementClaims(event, allEvents)];
}

export function newsroomArticleFromEvent(event, context = {}, editorial = {}) {
  const copy = copyFor(event, context);
  return {
    id: `news-${event.id}`,
    eventId: event.id,
    category: categoryFor(event, context),
    label: copy.label,
    title: copy.title,
    summary: copy.summary,
    gameDate: event.gameDate,
    timestamp: event.gameDate === context.currentDate ? 'Hoje' : event.gameDate,
    tier: editorial.tier || 'wire',
    newsworthiness: editorial.score || 0,
    storyArcId: editorial.storyArcId || null,
    mediaIntent: mediaIntentFor(event, editorial.heroPlayerId || null),
    factualClaims: editorial.factualClaims || factualClaimsFromEvent(event)
  };
}

export function buildCareerNewsroom(career, context = {}) {
  const userClubCode = context.userClubCode || career?.clubCode || null;
  const currentDate = context.currentDate || career?.currentDate || null;
  const editorialContext = { ...context, userClubCode, currentDate };
  const events = latestCareerEvents(career, context.eventLimit || 180);
  const ranked = rankNewsEvents(events, editorialContext);
  const edition = selectEditorialEdition(ranked, editorialContext);
  const strongest = strongestStoryArc(career, userClubCode);
  const storyEventIds = new Set(strongest?.eventIds || []);
  const feed = edition.map(item => newsroomArticleFromEvent(item.event, { ...context, userClubCode, currentDate }, {
    score: item.score,
    tier: item.tier,
    storyArcId: storyEventIds.has(item.event.id) ? strongest?.id || null : null,
    heroPlayerId: matchHeroPlayerId(item.event, events),
    factualClaims: claimsForArticle(item.event, events)
  }));
  return { schemaVersion: 1, generatedForDate: currentDate, lead: feed.find(article => article.tier === 'lead') || feed[0] || null, feed, activeStoryArc: strongest };
}
