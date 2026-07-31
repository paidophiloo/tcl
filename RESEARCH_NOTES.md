# Research Notes — referências e conclusões

Data-base da pesquisa: julho de 2026.

Este arquivo registra conclusões úteis, não instruções para copiar interfaces, marcas ou conteúdo protegido.

## Football Manager

Forças observadas:

- mundo persistente e profundo;
- banco de dados, staff, scouting, contratos, reputação e competições;
- estruturas com e sem bola;
- funções táticas detalhadas;
- mercado guiado por necessidades do elenco;
- carreira longa e histórico.

Fraquezas a evitar:

- cliques e menus excessivos;
- opacidade causal;
- interações sociais repetitivas;
- complexidade administrativa sem decisão interessante.

Referências oficiais:

- https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution
- https://www.footballmanager.com/fm26/features/where-storytelling-evolves-fm26s-match-day-experience
- https://www.footballmanager.com/fm26/features/powered-transferroom-fm26s-recruitment-revamp

## EA Sports FC / FIFA Career

Forças observadas:

- apresentação e emoção de matchday;
- estádios, transmissão e treinador visível;
- controles diretos e legibilidade;
- eventos e mercado de treinadores;
- acessibilidade.

Fraquezas a evitar:

- progressão baseada demais em overall;
- negociações previsíveis;
- objetivos arbitrários;
- mundo e mercado superficiais.

Referência oficial:

- https://www.ea.com/pt-br/games/ea-sports-fc/fc-26/news/pitch-notes-fc26-career-mode-deep-dive

## Soccer Manager

Forças observadas:

- velocidade;
- interface direta;
- infraestrutura visual;
- entrada acessível para novos jogadores.

Fraquezas a evitar:

- sensação de resultado scriptado;
- tática como modificador invisível;
- sistemas mobile/free-to-play invadindo a simulação.

Referência:

- https://play.google.com/store/apps/details?id=com.invinciblesstudioltd.soccermanager2025

## PES / Master League

Forças observadas:

- identidade de jornada;
- vínculo emocional com elenco;
- ritmo direto;
- contratações percebidas dentro de campo;
- cenas curtas com contexto.

Fraquezas a evitar:

- regens-cópia;
- IA de mercado fraca;
- diálogos sem consequência.

Referências oficiais:

- https://www.konami.com/games/eu/en/products/pes2021/
- https://www.konami.com/efootball/en/page/v5/versioninfo_v5-40

## We Are Football

Força principal:

- clube como instituição: departamentos, staff, estádio, patrocínio, torcida e base.

Referência:

- https://store.steampowered.com/app/1951410/WE_ARE_FOOTBALL_2024/

## Football, Tactics & Glory

Força principal:

- decisão e consequência legíveis; profundidade sem opacidade.

Referência:

- https://store.steampowered.com/app/375530/Football_Tactics__Glory/

## Hattrick e Top Eleven

Forças observadas:

- continuidade;
- antecipação semanal;
- histórias de longo prazo;
- rivalidade e hábito.

Referências:

- https://nordeus.helpshift.com/hc/en/3-top-eleven-be-a-soccer-manager/
- https://arxiv.org/abs/2504.09499

## Dados e calibração

StatsBomb Open Data pode ajudar a calibrar distribuições e métricas iniciais sem ser usado como motor pronto.

- https://github.com/statsbomb/open-data

## Engenharia

Referências principais:

- Rust + WebAssembly: https://rustwasm.github.io/docs/book/
- Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- Tauri: https://tauri.app/
- PixiJS: https://pixijs.com/8.x/guides/components/renderers
- Babylon.js WebGPU: https://doc.babylonjs.com/setup/support/webGPU/
- SQLite WASM: https://sqlite.org/wasm/doc/trunk/index.md
- Blender: https://docs.blender.org/manual/en/dev/getting_started/about/index.html

## Conclusão de produto

Nenhum concorrente domina simultaneamente:

- profundidade;
- apresentação;
- acessibilidade;
- causalidade visível;
- mundo vivo;
- ritmo de jogo.

A oportunidade é criar um manager em que o usuário vê o time obedecer, resistir ou falhar diante de uma decisão, e consegue explicar o motivo.

## Pesquisa de UX de matchday — julho de 2026

Padrões recorrentes em comentários de jogadores de Football Manager, EA FC Career e Top Eleven:

- excesso de cards, feeds e painéis simultâneos destrói a prioridade da partida;
- simplificar escondendo informação atrás de muitos cliques também é rejeitado;
- tática só parece profunda quando produz mudança visível de posição, distância, pressão e ritmo;
- 3D é valorizado quando melhora a leitura da simulação, não quando adiciona cutscenes ou espetáculo desconectado;
- câmera, luz, sombra, profundidade do gramado e ambiente coerente aumentam mais a imersão do que UI decorativa;
- placar, relógio, bola e jogadores precisam continuar legíveis em notebooks comuns;
- informação secundária deve permanecer disponível em um gesto, mas oculta por padrão.

Decisão aplicada:

`placar + relógio + campo + velocidade + Área Técnica` formam o estado padrão. Táticas e substituições vivem em painel lateral; timeline, estatísticas, tabela e análise em painel inferior. Os dois começam fechados e nunca ficam abertos simultaneamente.

Fontes de comunidade:

- https://www.reddit.com/r/footballmanagergames/comments/jruq7i/
- https://community.sports-interactive.com/forums/topic/594137-official-football-manager-26-feedback-thread/page/73/
- https://www.reddit.com/r/FifaCareers/comments/1fnzc7m/the_menusui_are_making_the_game_unplayable/
- https://www.reddit.com/r/FifaCareers/comments/1h08jll/the_new_menus_in_career_mode_are_giving_me_a/
- https://www.reddit.com/r/footballmanagergames/comments/tvrsy8/look_at_the_new_3d_match_engine_for_top_eleven/
- https://forum.topeleven.com/top-eleven-general-discussion/84312-%5Bofficial%5D-3d-matches-live-%7C-top-eleven-now-3d.html

Referências de direção:

- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines
- Premier League / Monotype: https://www.monotype.com/resources/case-studies/premier-league
- Premier League logo guidelines e Purple RGB 55/0/60: https://logo.premierleague.com/
- Premier League 2026/27 fixtures por data: https://resources.premierleague.pulselive.com/premierleague/document/2026/06/29/37fdab52-4913-4df1-8e52-b5272f6d9a62/Premier-League-Season-2026-27-By-Date.pdf
- Premier League Matchweek 9: https://www.premierleague.com/en/matches/premier-league/2026-27/matchweek-9
- Confirmação de fixtures 2026/27 do Chelsea: https://www.chelseafc.com/en/news/article/chelseas-2026-27-premier-league-fixtures-announced
- FM26 Matchday: https://www.footballmanager.com/fm26/features/where-storytelling-evolves-fm26s-match-day-experience
- FM26 Táticas: https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution

Decisão factual do cenário:

- Chelsea v Manchester United;
- Premier League 2026/27, Matchweek 9;
- Stamford Bridge, 31/10/2026;
- slot-base de 15:00 ainda provisório no corte de 30/07/2026.
