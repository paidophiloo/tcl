# Touchline Matchday — Design system v0.2

## Direção visual
**Operational Minimalism**: interface de comando esportivo com a calma visual de um produto premium. A tela não imita televisão nem planilha; funciona como uma central de decisões em tempo real.

## Regra 60–30–10
- **60% — Paper `#FFFFFF`**: fundo principal, navegação e áreas de leitura.
- **30% — Fog `#DEDEDE`**: divisões, superfícies, estados inativos e hierarquia silenciosa.
- **10% — Pitch `#67A633`**: ação, seleção, confirmação e futebol.

Cores derivadas só existem para contraste e acessibilidade:
- Ink `#171915`
- Pitch Deep `#3F6D1F`
- Pitch Soft `#EFF6E9`
- Surface `#F6F7F4`
- Line `#E9EBE6`

## Tipografia
Uma única pilha de interface, próxima da clareza editorial esportiva desejada:

`"Avenir Next", "SF Pro Display", "Segoe UI Variable", Inter, system-ui, sans-serif`.

O jogo usa peso, tracking e escala para hierarquia — não múltiplas fontes. Placar, relógio e dados usam a mesma família com numerais tabulares, sem fonte monoespaçada.

Pesos recomendados:
- 420–520 para leitura;
- 620–700 para controles e hierarquia;
- até 760 apenas em informação crítica.

## Linguagem de matchday
**Broadcast Diorama / Quiet Touchline**: o campo conta a história; a interface só permite ao técnico intervir.

- campo 2.5D dominante e atmosférico;
- câmera lateral elevada estável;
- arquibancada e luz como contexto, não decoração;
- jogadores como peças circulares de futebol de botão, com escala, sombra física, cor de equipe e número legível;
- placar e controles essenciais persistentes;
- painel técnico e dados fechados por padrão;
- nunca abrir dois painéis grandes simultaneamente;
- feedback tático aparece primeiro no comportamento dos jogadores.

As peças circulares são uma linguagem deliberada de jogo de manager, não componentes de UI: devem parecer objetos sobre o gramado, não botões clicáveis ou avatares.

## Geometria
- Cards: 18–26 px
- Shells: 34 px
- Botões: 11–15 px
- Bordas: 1 px, baixo contraste
- Sombras: amplas e discretas, nunca “flutuando” sem função

## Padrões centrais
1. **Technical Workspace**: modal central ou bottom sheet dentro do viewport; nenhum painel empurra ou escapa do shell.
2. **Match Canvas**: a partida é o centro visual, sem widgets sobrecarregando o campo.
3. **Live Explainability**: toda recomendação indica causa, efeito e mudança proposta.
4. **Progressive Density**: resumo primeiro; detalhe aparece em tabs, hover ou expansão.
5. **Next Stoppage Commit**: mudanças táticas são preparadas e aplicadas na próxima interrupção, evitando sensação de magia instantânea.
6. **One Accent Rule**: verde significa estado ativo ou ação confirmada; não decoração.

## Adaptador de competição

A identidade da competição é uma camada contextual, não a marca do produto:

- Premier League Purple `#37003C` pode aparecer no filete superior, navegação de cenas e cabeçalho de Matchday;
- o verde Touchline continua reservado para ação confirmada, estado válido e futebol;
- logos oficiais não podem ser recoloridos, cortados ou tratados como propriedade do produto;
- qualquer protótipo com marcas de terceiros deve declarar que não é oficial nem endossado;
- cenas fora da Premier League devem receber seu próprio adaptador, sem contaminar o sistema visual global.

Na preparação, a navegação usa cenas animadas na mesma tela: `Matchday`, `Elenco`, `Esquemas`, `Funções`, `Instruções` e `Análise`. Somente a cena ativa revela densidade.

## Interações implementadas
- preparação, partida e pós-jogo são estados visuais distintos;
- a partida não mantém sidebar ou mini-campo duplicado;
- painel técnico abre em overlay e começa fechado;
- dados da partida abrem em bottom sheet e começam fechados;
- somente um painel grande pode permanecer aberto;
- mentalidade, altura da linha, largura, pressão e ritmo alteram o comportamento do campo;
- instruções rápidas alteram ocupação e aproximação;
- substituição possui saída e entrada visual pela lateral;
- partida pausa, retoma e usa velocidades diretas `1`, `2` e `4`;
- Canvas projeta campo, marcações, gols, jogadores e bola pela mesma câmera 2.5D;
- a faixa de ações ocupa área própria e não cobre o gramado;
- modais preservam header e footer; somente o conteúdo central rola;
- atalhos: `T` área técnica, `S` substituições, `Espaço` pausa e `Esc` fecha painéis.
- peças do pré-jogo podem ser arrastadas dentro de limites válidos de posição;
- mudança de cena usa movimento de 320–420 ms, sem animação contínua decorativa.
