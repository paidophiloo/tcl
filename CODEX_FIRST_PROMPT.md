# Primeiro prompt para colar no Codex

Leia `CONTEXT_INDEX.md` e todos os documentos listados nele, depois leia todo o `index.html`, antes de alterar qualquer arquivo. Considere esses arquivos a memória oficial do projeto.

Quero refazer a Match Screen atual sem criar uma interface genérica de IA.

Objetivo desta rodada:
- Transformar o viewer central em um campo 2.5D muito mais tridimensional, visto de lado e de cima em câmera elevada, como uma transmissão tática premium.
- O campo precisa ter perspectiva convincente, profundidade, sombra física dos jogadores, bola visível, linhas adaptadas à perspectiva e sensação de estádio ao fundo.
- Reduzir em pelo menos 40% a informação simultânea da interface.
- Deixar visíveis por padrão somente: competição discreta, relógio, placar, campo e controles mínimos de partida.
- O painel tático lateral deve iniciar fechado e abrir sobre a tela sem comprimir demais o campo.
- Timeline, stats, tabela e outros jogos devem ir para um bottom sheet recolhível, fechado por padrão.
- Quando eu mudar mentalidade, linha, largura ou pressão, os 11 jogadores devem alterar seu posicionamento e comportamento em tempo real no campo principal. Nada de apenas trocar texto ou mostrar toast.
- Preservar rigorosamente a identidade 60–30–10: branco `#FFFFFF`, cinza `#DEDEDE`, verde `#67A633`.
- Usar uma única família tipográfica e manter estética Apple-like premium, esportiva, elegante e clean.
- Não use neon, gradiente chamativo, excesso de glassmorphism, cards redundantes ou componentes com aparência de dashboard SaaS.

Antes de codar:
1. Faça uma auditoria curta do que deixa a tela atual flat, congestionada ou genérica.
2. Apresente um plano de arquivos e componentes.
3. Implemente a rodada completa.
4. Execute `npm run dev` ou `npm run build`, corrija erros e teste todos os controles alterados.
5. No fim, descreva objetivamente o que mudou e qualquer limitação real.

Trabalhe diretamente no repositório. Preserve o funcionamento local.


Ao planejar, use os papéis de `AGENT_ROLES.md`. Caso subagentes estejam disponíveis, delegue auditoria visual, renderer, lógica tática e QA separadamente, mas integre e teste tudo no agente principal.
