# Matchday Spec — tela de partida

## 1. Objetivo da tela

Criar a melhor sensação de “estar na área técnica” possível em um manager. A partida ocupa a maior parte da tela; controles aparecem somente quando necessários. O usuário enxerga a consequência de cada instrução no campo, sem navegar por cinco menus.

## 2. Diagnóstico do protótipo anterior

Problemas já identificados pelo Gabriel:

- campo flat e com aparência de interface gerada por IA;
- câmera superior demais;
- falta de profundidade, lateral do gramado e sensação de estádio;
- informação excessiva simultaneamente;
- painel lateral comprimindo a área principal;
- mudanças táticas comunicadas por labels, não pelo comportamento dos jogadores.

Esses problemas não podem voltar.

## 3. Hierarquia visual

Ordem de importância:

1. campo e movimento da partida;
2. placar, relógio e estado do jogo;
3. ação tática atual do treinador;
4. alertas críticos;
5. timeline, estatísticas, tabela e outros jogos sob demanda.

## 4. Composição padrão

### Estado fechado

Visível por padrão:

- competição discreta;
- relógio;
- placar e escudos;
- campo principal;
- pausar e velocidade;
- botão claro para abrir “Área Técnica”;
- no máximo um alerta contextual do assistente.

Oculto por padrão:

- painel tático;
- substituições;
- timeline completa;
- tabela;
- outros jogos;
- gráficos analíticos;
- instruções avançadas.

### Área técnica

Painel lateral em overlay, sem reduzir drasticamente o campo. Pode cobrir parte pequena da lateral, com fundo branco sólido ou translúcido muito contido. Deve fechar em um clique ou tecla.

Seções prioritárias:

- mentalidade;
- estrutura com e sem bola;
- linha e bloco;
- pressão;
- largura e ritmo;
- substituições;
- funções individuais;
- capitão e bolas paradas em nível secundário.

Nunca abrir múltiplos subpainéis grandes ao mesmo tempo.

### Painel inferior

Bottom sheet recolhível, fechado por padrão, com abas:

- Linha do tempo;
- Estatísticas;
- Tabela ao vivo;
- Outros jogos;
- Análise.

## 5. Câmera do campo

A câmera deve ser lateral elevada, entre transmissão tática e diorama esportivo:

- visão ampla do campo;
- linha lateral frontal visível;
- horizonte ou arquibancada discreta;
- profundidade real;
- jogadores mais próximos ligeiramente maiores;
- linhas e círculos respeitando perspectiva;
- gol e área com profundidade;
- câmera não pode parecer um retângulo inclinado por CSS.

A implementação inicial pode ser:

- Canvas 2D com projeção perspectiva controlada;
- PixiJS com sprites e transformação projetiva;
- Babylon.js após spike técnico, apenas se justificar custo.

## 6. Campo e atmosfera

O campo precisa ter:

- variação sutil de corte do gramado;
- textura muito discreta;
- laterais físicas;
- sombra de estádio coerente;
- sombras dos jogadores orientadas pela mesma luz;
- bola claramente legível;
- bancos ou arquibancada apenas como atmosfera, nunca ruído;
- som futuro de torcida vinculado a momentos reais.

Evitar:

- verde neon;
- brilho plástico;
- gradientes decorativos;
- personagens como círculos genéricos sem orientação;
- miniaturas ilegíveis.

## 7. Jogadores

Na primeira versão 2.5D:

- peças circulares inspiradas em futebol de botão;
- cor do uniforme, aro contrastante e número legível;
- escala por profundidade;
- sombra elíptica física;
- destaque seletivo somente no portador da bola ou atleta em transição;
- movimento suave com aceleração, desaceleração e ocupação tática observável.

As peças não são placeholders de interface. São a linguagem visual assumida do renderer desta fase e devem parecer objetos físicos sobre o gramado.

## 8. Alteração tática em tempo real

A interface deve demonstrar efeitos observáveis:

### Mentalidade

- defensiva: bloco recua, menos jogadores ultrapassam a linha da bola, posse mais segura;
- equilibrada: espaçamento médio;
- ofensiva: linha sobe, laterais e meias ocupam zonas mais altas, maior risco de transição.

### Largura

- estreita: pontas aproximam dos meio-espaços;
- ampla: extremos abrem e laterais ajustam suporte.

### Linha defensiva

- jogadores da última linha mudam coordenadas-alvo;
- compactação do time se recalcula;
- espaço às costas fica visivelmente maior ou menor.

### Pressão

- maior velocidade de aproximação;
- marcação mais agressiva;
- maior consumo de energia;
- forma do bloco reage à localização da bola.

### Ritmo e risco

- tempo médio com a bola muda;
- distância e frequência de passes mudam;
- movimentos de apoio mudam.

### Substituição

- aplicada em interrupção coerente;
- atleta sai, novo atleta entra;
- função, condição e comportamento passam a influenciar o jogo.

## 9. Regra de compromisso

Mudanças estruturais não devem parecer magia instantânea. Usar:

- “Preparada”; 
- “Aplicando na próxima interrupção”; 
- transição visual curta quando o jogo reinicia.

Ajustes leves de intensidade podem responder gradualmente durante bola rolando.

## 10. Alertas do assistente

Mostrar no máximo um insight por vez e somente quando houver evidência:

- problema;
- causa;
- sugestão;
- efeito esperado;
- botão opcional de preparar mudança.

Exemplo:

> O lateral esquerdo está isolado contra dois. Recuar o ponta pode reduzir as entradas adversárias naquele corredor, mas diminui sua saída ofensiva.

Nunca mostrar conselho genérico como “aumente a posse”.

## 11. Controles

- `Espaço`: pausar/retomar;
- `1`, `2`, `4`: velocidade;
- `T`: área técnica;
- `S`: substituições;
- `Esc`: fechar painel ativo;
- mouse e teclado com foco visível;
- tooltips curtos;
- controles críticos com área clicável confortável.

## 11.1 Duração do protótipo

- uma partida completa percorre 0–90 em 120 segundos reais na velocidade 1×;
- 2× completa a partida em aproximadamente 60 segundos;
- 4× completa a partida em aproximadamente 30 segundos;
- relógio, bola, jogadores, eventos e substituições usam a mesma escala temporal;
- o placar inicia em 0–0 e eventos de gol atualizam a tela durante a simulação.

## 12. Responsividade desktop

Prioridades:

- 1366×768: campo ainda dominante, painéis sobrepostos;
- 1440×900: experiência base;
- ultrawide: campo amplia, UI não se estica indefinidamente;
- notebook menor: reduzir atmosfera periférica antes de reduzir legibilidade.

## 13. Critérios de aceite da próxima iteração

A tarefa não está concluída até que:

1. o campo tenha perspectiva convincente;
2. a UI visível tenha pelo menos 40% menos elementos;
3. painel tático e bottom sheet iniciem fechados;
4. mentalidade, largura, linha e pressão alterem jogadores no campo;
5. pausar e velocidades funcionem;
6. não haja erros no console;
7. o projeto rode por `npm run dev`;
8. screenshots comparativas sejam geradas;
9. limitações reais sejam registradas.

## 14. Recorte implementado do MVP

O cenário atual cobre uma única partida, sem sistemas de carreira:

1. preparação pré-jogo dedicada;
2. elenco completo, XI, banco e troca entre atletas;
3. formação, instruções coletivas e 12 funções individuais;
4. análise do adversário com forças, vulnerabilidades e jogadores-chave;
5. confirmação antes do apito;
6. partida 2.5D com placar, relógio, pausa e velocidades;
7. área técnica, elenco ao vivo, substituições e dados sob demanda;
8. intervalo obrigatório;
9. pós-jogo com autores, eventos, números, notas e explicações.

O painel fixo e o mini-campo duplicado foram removidos. Durante a bola rolando, permanecem somente HUD, campo e uma faixa discreta de ações. Modais são centralizados dentro do shell e o bottom sheet inicia fechado.

Dados do cenário:

- snapshot de elenco em 30/07/2026;
- o mercado ainda estava aberto, portanto a interface não chama o elenco de definitivo;
- overalls, condição, ritmo, atributos, forças e scouting são ratings internos do protótipo;
- uma API configurada pode atualizar identidade, número e escudo, mas não transforma ratings internos em dados oficiais;
- disponibilidade pública de logos e nomes não equivale a licença comercial.

## 15. Hub de preparação por cenas

O pré-jogo não é mais uma tela única com tabela, campo e controles competindo por atenção. Ele preserva um palco comum e alterna cenas:

1. `Matchday`: competição, Matchweek, estádio, horário e confronto;
2. `Elenco`: XI, banco e elenco completo;
3. `Esquemas`: formação, largura, altura e posicionamento manual;
4. `Funções`: comportamento individual por jogador;
5. `Instruções`: mentalidade, ritmo, risco, pressão e transição;
6. `Análise`: forma provável, forças, vulnerabilidades e destaques rivais.

O cenário do MVP corresponde ao fixture oficial `Chelsea v Manchester United`, Premier League 2026/27, Matchweek 9, em Stamford Bridge, em 31/10/2026. O slot de 15:00 é provisório e deve permanecer identificado como sujeito a alteração.

Arrastar uma peça grava coordenadas táticas normalizadas. O motor limita o deslocamento conforme posição e lateralidade; movimentos fora da zona reduzem encaixe e coesão e alteram passes, pressão, proteção, condução, chute e fadiga.
