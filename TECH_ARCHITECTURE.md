# Technical Architecture — direção recomendada

## 1. Estratégia

Web-first, local-first e simulation-first.

A interface de manager é majoritariamente composta por dados, navegação, drag-and-drop, filtros e visualizações. A partida exige renderização eficiente. A simulação exige performance e determinismo.

## 2. Stack-alvo

### Interface

- React;
- TypeScript;
- Vite;
- TanStack Router;
- TanStack Query;
- Zustand;
- Zod;
- React Hook Form;
- Radix UI;
- Motion;
- dnd-kit;
- Apache ECharts apenas onde análise quantitativa justificar.

### Renderer de partida

Fase inicial:

- spike comparativo entre PixiJS 8 e Babylon.js;
- preferência inicial por PixiJS para 2.5D leve e controlável;
- Babylon.js somente se 3D real trouxer ganho claro de câmera, iluminação e pipeline sem explodir escopo.

### Simulação

- Rust;
- WebAssembly no browser;
- Web Worker para não bloquear UI;
- execução nativa no desktop.

### Desktop

- Tauri 2.

### Dados

- SQLite local;
- SQLite/WASM + OPFS no browser;
- PostgreSQL apenas para conta, nuvem ou recursos online futuros.

### Dados externos de futebol

- integrar provedores por uma camada própria, nunca diretamente nos componentes;
- protótipo atual: `football-data.org` para clubes, escudos e elencos;
- a chave `FOOTBALL_DATA_API_KEY` fica somente no middleware local do Vite;
- o browser acessa apenas endpoints internos restritos e validados;
- respostas usam cache para respeitar limites do provedor;
- nenhum escudo, marca de liga ou dado de elenco deve ser tratado como licença automática de uso comercial;
- quando o provedor estiver ausente, usar fallback marcado explicitamente como demonstração.

## 3. Estado provisório do protótipo

O repositório atual é vanilla HTML/CSS/JS servido por Vite para validar direção visual rapidamente.

Não fazer migração ampla para React antes de:

1. validar câmera;
2. validar densidade da tela;
3. validar interação tática;
4. escolher renderer.

Depois disso, migrar por módulos.

## 4. Estrutura futura

```text
apps/
  web/
  desktop/
  editor/
packages/
  ui/
  design-system/
  match-renderer/
  shared-types/
crates/
  simulation-core/
  match-engine/
  tactics/
  world-simulation/
  transfers/
  training/
  analytics/
  save-system/
tools/
  match-replay-viewer/
  balance-dashboard/
  database-editor/
tests/
  golden-matches/
  long-term-saves/
  tactical-sensitivity/
```

## 5. Regras de performance

- manter render loop separado da simulação;
- evitar recalcular layout React por frame;
- renderizar campo via Canvas/WebGL;
- interpolar visualmente entre snapshots;
- mover simulação pesada para worker;
- virtualizar listas grandes;
- medir frame time e memória desde cedo;
- não instalar bibliotecas apenas por estética.

## 6. Contratos de dados

O renderer recebe snapshots imutáveis ou eventos:

```ts
interface MatchSnapshot {
  clockMs: number;
  phase: MatchPhase;
  score: [number, number];
  ball: BallState;
  players: PlayerMatchState[];
  activeTactics: TeamTactics[];
  pendingChanges: TacticalChange[];
}
```

A UI envia comandos:

```ts
type MatchCommand =
  | { type: 'SET_MENTALITY'; teamId: string; value: Mentality }
  | { type: 'SET_WIDTH'; teamId: string; value: number }
  | { type: 'SET_DEFENSIVE_LINE'; teamId: string; value: number }
  | { type: 'SET_PRESSING'; teamId: string; value: number }
  | { type: 'REQUEST_SUBSTITUTION'; payload: SubstitutionRequest };
```

A simulação valida, agenda e aplica comandos.

## 7. Spike obrigatório do renderer

Construir duas provas pequenas com a mesma cena:

### PixiJS

- campo em perspectiva;
- 22 jogadores;
- sombras;
- bola;
- câmera;
- 60 FPS;
- resize.

### Babylon.js

- campo 3D simples;
- mesma câmera;
- 22 personagens low-poly/sprites billboard;
- iluminação e sombra;
- desempenho e tamanho do bundle.

Comparar:

- qualidade visual;
- complexidade;
- performance em notebook comum;
- tempo de implementação;
- acessibilidade de overlays;
- facilidade de sincronizar com simulação.

Não escolher por moda.

## 8. Testes

- unitários para comandos táticos;
- golden match com seed fixa;
- teste de sensibilidade: alterar uma instrução e medir comportamento;
- teste visual de snapshots;
- Playwright para painel, atalhos e controles;
- lint, typecheck e build obrigatórios após migração.

## 9. Estado implementado do MVP de uma partida — 30/07/2026

O protótipo Vite deixou de ser um script monolítico. A separação atual é:

```text
index.html
src/
  app.js              interface, navegação e comandos
  mvp-data.js         configuração e dados do cenário
  match-engine.js     estado, simulação, eventos e IA
  pitch-renderer.js   Canvas 2.5D; nunca decide resultados
  football-data.js    adapter do proxy opcional
  styles.css          design system e layout desktop
tests/
  mvp-smoke.mjs
  ui-dom-smoke.mjs
```

Decisões já provadas:

- mesmo seed e mesmas decisões geram os mesmos eventos em 1× e 4×;
- intervalo pausa exatamente em 45:00 e exige retomada;
- formações, funções, largura, linha, pressão, ritmo e risco alteram comportamento;
- IA adversária usa o mesmo sistema de comandos;
- API de elenco é opcional e fail-closed;
- renderer consome snapshots e permanece separado da simulação.

A migração para React + TypeScript continua posterior à validação desta experiência. PixiJS/Babylon.js não devem substituir o Canvas antes do spike comparativo.
