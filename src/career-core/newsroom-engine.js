import { CAREER_EVENT_TYPES, latestCareerEvents } from './event-ledger.js';
import { strongestStoryArc } from './newsroom-story-arcs.js';
import { factualClaimsFromEvent, rankNewsEvents } from './newsroom-editorial.js';

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

function transferCopy(event, context) {
  const facts = event.facts || {};
  const playerId = facts.playerId || event.entities?.playerIds?.[0];
  const player = playerNameOf(playerId, context.playerResolver);
  const from = nameOf(facts.fromClubCode, context.clubResolver, 'clube anterior');
  const to = nameOf(facts.toClubCode, context.clubResolver, 'novo clube');
  const fee = formatFee(facts.fee, context.formatMoney);
  if (event.type === CAREER_EVENT_TYPES.TRANSFER_COMPLETED) {
    if (facts.freeAgent) {
      return {
        label: 'MERCADO',
        title: `${player} assina com o ${to} como agente livre`,
        summary: 'O jogador chegou sem taxa de transferência e passa a integrar o novo elenco após o acordo contratual.'
      };
    }
    return {
      label: 'MERCADO',
      title: `${player} deixa o ${from} e acerta com o ${to}`,
      summary: fee
        ? `A transferência foi concluída por ${fee}, encerrando a negociação entre os clubes.`
        : 'Os clubes concluíram a transferência e o jogador passa a integrar o novo elenco.'
    };
  }
  if (event.type === CAREER_EVENT_TYPES.LOAN_COMPLETED) {
    return {
      label: 'EMPRÉSTIMO',
      title: `${player} troca o ${from} pelo ${to} por empréstimo`,
      summary: facts.endDate
        ? `O acordo temporário foi fechado até ${facts.endDate} e passa a fazer parte do planejamento esportivo das duas equipes.`
        : 'O acordo temporário foi fechado e passa a fazer parte do planejamento esportivo das duas equipes.'
    };
  }
  return {
    label: facts.loan ? 'EMPRÉSTIMO' : 'MERCADO',
    title: `${player} entra no radar do mercado`,
    summary: 'A movimentação ainda não representa uma transferência concluída e seguirá sendo acompanhada.'
  };
}

function pressCopy(event, context) {
  const clubCode = event.entities?.clubCodes?.[0];
  const club = nameOf(clubCode, context.clubResolver);
  const manager = event.facts?.managerName || context.managerName || 'O treinador';
  const topic = event.facts?.topic || 'o momento da equipe';
  return {
    label: 'COLETIVA',
    title: `${manager} fala sobre ${topic}`,
    summary: event.facts?.summary || `${club} encerra a preparação com declarações do treinador antes do próximo compromisso.`
  };
}

function genericCopy(event, context) {
  const clubCode = event.entities?.clubCodes?.[0];
  const club = nameOf(clubCode, context.clubResolver, 'Clube');
  return {
    label: 'NOTÍCIAS',
    title: event.facts?.headline || `${club} tem nova atualização no modo carreira`,
    summary: event.facts?.summary || 'O acontecimento foi registrado pelo mundo da carreira e pode ganhar novos desdobramentos.'
  };
}

function copyFor(event, context) {
  if (event.type === CAREER_EVENT_TYPES.MATCH_PLAYED) return matchCopy(event, context);
  if (event.type === CAREER_EVENT_TYPES.INJURY) return injuryCopy(event, context);
  if ([CAREER_EVENT_TYPES.TRANSFER_LISTED, CAREER_EVENT_TYPES.TRANSFER_OFFERED, CAREER_EVENT_TYPES.TRANSFER_COMPLETED, CAREER_EVENT_TYPES.LOAN_COMPLETED].includes(event.type)) return transferCopy(event, context);
  if (event.type === CAREER_EVENT_TYPES.MANAGER_PRESS) return pressCopy(event, context);
  return genericCopy(event, context);
}

function categoryFor(event, context) {
  return event.entities?.clubCodes?.includes(context.userClubCode) ? 'club' : 'league';
}

function mediaIntentFor(event) {
  return {
    eventId: event.id,
    type: event.type,
    clubCodes: [...(event.entities?.clubCodes || [])],
    playerIds: [...(event.entities?.playerIds || [])],
    fixtureId: event.links?.fixtureId || event.facts?.fixtureId || null,
    preference: event.entities?.playerIds?.length ? 'player' : event.entities?.clubCodes?.length ? 'club' : 'competition'
  };
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
    mediaIntent: mediaIntentFor(event),
    factualClaims: editorial.factualClaims || factualClaimsFromEvent(event)
  };
}

export function buildCareerNewsroom(career, context = {}) {
  const userClubCode = context.userClubCode || career?.clubCode || null;
  const editorialContext = { ...context, userClubCode };
  const events = latestCareerEvents(career, context.eventLimit || 180);
  const ranked = rankNewsEvents(events, editorialContext);
  const strongest = strongestStoryArc(career, userClubCode);
  const storyEventIds = new Set(strongest?.eventIds || []);
  const feed = ranked.map(item => newsroomArticleFromEvent(item.event, {
    ...context,
    userClubCode,
    currentDate: context.currentDate || career?.currentDate
  }, {
    score: item.score,
    tier: item.tier,
    storyArcId: storyEventIds.has(item.event.id) ? strongest?.id || null : null,
    factualClaims: factualClaimsFromEvent(item.event)
  }));
  return {
    schemaVersion: 1,
    generatedForDate: context.currentDate || career?.currentDate || null,
    lead: feed.find(article => article.tier === 'lead') || feed[0] || null,
    feed,
    activeStoryArc: strongest
  };
}
