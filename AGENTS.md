# Touchline — instruções permanentes para agentes de código

## Leitura obrigatória
Antes de qualquer tarefa relevante, leia `CONTEXT_INDEX.md` e todos os documentos indicados por ele. Não presuma que o último prompt contém o contexto completo.

## Produto
Touchline é um jogo premium de manager de futebol para browser e PC. O treinador deve alterar a partida em tempo real e enxergar consequências táticas observáveis. Não é um dashboard corporativo, não é uma planilha do Football Manager e não pode parecer um template de IA.

## Direção da próxima iteração
A tela atual é apenas um protótipo. A próxima versão deve:

1. Tornar o campo principal muito mais tridimensional, com câmera lateral elevada/isométrica semelhante a uma transmissão tática.
2. Construir o campo com profundidade real: perspectiva, laterais do gramado, arquibancada desfocada, túnel de luz, sombras de jogadores, bola e sensação de estádio.
3. Reduzir drasticamente a quantidade de informação simultânea.
4. Manter na tela principal somente placar, relógio, campo, um controle discreto de velocidade e um acesso claro ao painel técnico.
5. Colocar timeline, estatísticas, tabela e outros jogos em um painel inferior recolhível, fechado por padrão.
6. Colocar táticas e substituições num painel lateral recolhível, também fechado por padrão.
7. Mostrar mudanças táticas em tempo real no campo: formação, altura do bloco, largura, pressão, mentalidade, substituições e funções individuais.
8. Não simular alteração apenas com texto ou toast. Os jogadores devem mudar de posição, distância, velocidade e comportamento visualmente.

## Identidade visual
- Regra 60–30–10:
  - 60% branco `#FFFFFF`
  - 30% cinza `#DEDEDE` e superfícies derivadas
  - 10% verde `#67A633`
- Texto principal: `#171915`.
- O verde indica futebol, seleção ativa, decisão aplicada ou ação principal; nunca decoração aleatória.
- Sem gradientes chamativos, glow neon, glassmorphism excessivo ou cards por toda parte.
- Estética: Apple-like, editorial, silenciosa, precisa, premium e esportiva.
- Cantos arredondados contidos; não transformar cada bloco em cápsula.
- Sombras suaves e físicas, não sombras genéricas de template.

## Tipografia
Usar uma única família em todo o produto. Enquanto não houver licença de fonte própria, usar:
`"Avenir Next", "SF Pro Display", "Segoe UI Variable", Inter, system-ui, sans-serif`.
Não misturar fonte monospace na interface principal. Diferenciar placar, labels e títulos com peso, tracking e escala, não com famílias diferentes.

## UX
- Progressive disclosure: mostrar somente o necessário e revelar profundidade sob demanda.
- Toda ação importante deve ter feedback visual imediato no campo.
- Preservar área visual dominante para a partida.
- Nunca sobrepor vários painéis simultaneamente.
- A interface deve funcionar bem em 1366×768, 1440×900 e ultrawide.
- Animações entre 180–420 ms e curvas suaves; sem lag e sem movimento decorativo inútil.

## Engenharia
- Primeiro estabilizar a experiência em Vite.
- Depois modularizar para React + TypeScript.
- Campo futuro: PixiJS 8 para 2.5D premium ou Babylon.js para 3D real, após comparação técnica.
- Separar sempre `match state`, `simulation` e `renderer`.
- A renderização não decide resultados; ela representa o estado da simulação.
- Toda mudança deve preservar execução local com `npm run dev`.

## Regras de trabalho
- Antes de editar, leia `CONTEXT_INDEX.md`, siga sua ordem de leitura e então leia o código afetado.
- Faça alterações focadas e testáveis.
- Rode o projeto e valide visualmente em browser desktop.
- Não substitua tudo por um template pronto.
- Não invente features fora do escopo da tarefa atual.
- Nunca declare concluído sem testar os controles modificados.
