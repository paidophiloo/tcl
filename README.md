# Touchline — Matchday local

Protótipo da tela de partida preparado para edição no VS Code e no Codex.

## Início rápido no Windows

1. Extraia esta pasta para um local fixo, por exemplo:
   `C:\Users\zgabr\Documents\Codex\touchline-matchday`
2. Dê dois cliques em `OPEN_VSCODE.bat` para abrir o projeto.
3. Dê dois cliques em `START_DEV.bat` para instalar as dependências e iniciar o servidor.
4. O navegador abrirá automaticamente no endereço local do Vite.

## Início pelo terminal do VS Code

```powershell
npm install
npm run dev
```

O Vite atualiza o navegador quando os arquivos em `src/` são salvos.

## MVP atual

O fluxo completo funciona sem recarregar a página:

`Matchday → Elenco → Esquemas → Funções → Instruções → Análise → partida → intervalo → pós-jogo`

- Chelsea × Manchester United, Premier League 2026/27, Matchweek 9;
- fixture em Stamford Bridge em 31/10/2026; horário-base de 15:00 marcado como provisório;
- 25 jogadores por clube, snapshot pesquisado em 30/07/2026;
- números e nomes do elenco separados dos ratings internos não oficiais;
- onze, banco, formações, funções individuais, posicionamento por arraste e relatório do adversário;
- posições manuais têm limites por função e alteram coesão e comportamento do motor;
- motor determinístico de 0–90 em 120 segundos no modo 1×;
- pausa, 1×/2×/4×, substituições, cartões, lesões, assistências e IA rival;
- Canvas 2.5D com 22 peças, bola, estádio, perspectiva e movimento;
- intervalo obrigatório e relatório final.

Validação:

```powershell
npm run test:mvp
npm run test:ui
npm run build
```

## Clubes, escudos e elencos

O protótipo possui integração opcional com `football-data.org`.

1. Crie uma chave em `https://www.football-data.org/client/register`.
2. Copie `.env.example` para `.env.local`.
3. Preencha:

```text
FOOTBALL_DATA_API_KEY=sua_chave
```

4. Reinicie `npm run dev`.

A chave permanece no servidor local do Vite. Sem chave, o jogo usa o snapshot local pesquisado e o identifica na interface. A integração é fail-closed: nenhuma resposta é tratada como ao vivo sem configuração e retorno válido do provedor. Ratings continuam internos mesmo com a API conectada. Escudos e marcas continuam sujeitos aos direitos de seus titulares e aos termos do provedor.

## Codex

- Instale a extensão oficial Codex no VS Code e faça login com sua conta ChatGPT.
- Abra a barra lateral do Codex.
- Cole o conteúdo de `CODEX_FIRST_PROMPT.md`.
- O arquivo `AGENTS.md` contém as regras permanentes do projeto.

## Arquivos importantes

- `index.html` — entrada mínima do Vite.
- `src/app.js` — fluxo e interface do MVP.
- `src/mvp-data.js` — elencos, escalações, ratings internos e fontes.
- `src/match-engine.js` — simulação determinística e regras.
- `src/pitch-renderer.js` — campo 2.5D separado da simulação.
- `src/styles.css` — sistema visual e responsividade desktop.
- `tests/` — smoke do motor e dos fluxos de interface.
- `CONTEXT_INDEX.md` — índice da memória oficial do projeto.
- `PRODUCT_BIBLE.md` — visão e sistemas do jogo.
- `MATCHDAY_SPEC.md` — especificação da tela de partida.
- `SIMULATION_PRINCIPLES.md` — princípios do motor.
- `TECH_ARCHITECTURE.md` — arquitetura recomendada.
- `RESEARCH_NOTES.md` — conclusões e referências da pesquisa.
- `AGENT_ROLES.md` — divisão de agentes/checklists.
- `AGENTS.md` — regras permanentes para o Codex.
- `CODEX_FIRST_PROMPT.md` — tarefa pronta da próxima iteração.
- `DESIGN_SYSTEM.md` — identidade visual atual.
- `preview.png` — captura da versão anterior.

## Arquitetura posterior

Depois de validar a nova linguagem visual e a câmera do campo, migrar para:
- React + TypeScript
- PixiJS 8 ou Babylon.js após spike comparativo
- Rust/WebAssembly para simulação
- Tauri 2 para desktop
