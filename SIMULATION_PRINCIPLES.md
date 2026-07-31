# Simulation Principles — núcleo da partida

## 1. Separação obrigatória

A arquitetura deve manter três domínios separados:

1. `simulation`: decide estado e eventos;
2. `match state`: representa o estado atual serializável;
3. `renderer`: desenha o estado e interpola movimento.

O renderer nunca escolhe gol, passe ou desarme.

## 2. Determinismo

Cada partida usa uma seed. Com o mesmo:

- estado inicial;
- seed;
- escalações;
- instruções;
- decisões durante o jogo;

os eventos centrais devem ser reproduzíveis.

Isso permite testes, replay, comparação e debugging.

## 3. Loop conceitual

`recuperação → estabilização → construção → progressão → último terço → criação → finalização → rebote/perda → transição`

Cada ação carrega:

- ator;
- posição;
- velocidade;
- orientação;
- opções percebidas;
- decisão;
- qualidade de execução;
- pressão;
- resultado.

## 4. Primeira implementação

Não tentar simular física completa. Implementar uma simulação tática reduzida:

- coordenadas contínuas normalizadas;
- zonas táticas;
- targets por função e fase;
- estados de posse;
- decisões baseadas em utilidade e risco;
- interpolação visual separada.

## 5. Estados mínimos

- kickoff;
- open play;
- buildup;
- attacking third;
- transition;
- set piece;
- stoppage;
- halftime;
- fulltime.

## 6. Dados mínimos do jogador em partida

- id;
- teamId;
- role;
- position;
- targetPosition;
- velocity;
- facing;
- stamina;
- confidence;
- decisionQuality;
- executionQuality;
- pressingIntensity;
- currentAction;
- possessionState;
- markTarget;
- tacticalResponsibility.

## 7. Estrutura tática mínima

- formationInPossession;
- formationOutOfPossession;
- mentality;
- defensiveLine;
- blockHeight;
- widthInPossession;
- widthOutOfPossession;
- pressingIntensity;
- tempo;
- passingRisk;
- counterpress;
- restDefenseCount.

## 8. Efeito de instrução

Toda instrução deve alterar ao menos um destes grupos:

- posição-alvo;
- velocidade de reação;
- opções consideradas;
- risco aceito;
- custo de stamina;
- distância entre jogadores;
- prioridade de marcação;
- probabilidade de determinada ação.

### Posição manual

`tactics.playerPositions[playerId] = { x, y }` representa um offset tático persistente:

- `x = 0` é o próprio gol e `x = 1` o gol rival;
- o motor espelha a coordenada para a equipe que ataca no sentido oposto;
- cada slot possui limites de profundidade e lateralidade;
- `zoneFit` e coesão caem quando o jogador se afasta de sua zona natural;
- renderer e interface apenas mostram o estado sanitizado; não decidem seu efeito.

## 9. Eventos

Eventos centrais:

- pass;
- carry;
- dribble;
- cross;
- shot;
- save;
- tackle;
- interception;
- foul;
- card;
- injury;
- offside;
- substitution;
- tacticalChange;
- goal;
- restart.

## 10. Explicabilidade

A simulação deve guardar razões resumidas para eventos importantes:

- superioridade numérica;
- espaço encontrado;
- erro sob pressão;
- fadiga;
- incompatibilidade de função;
- linha alta exposta;
- perda em saída;
- sobrecarga lateral.

Essas razões alimentam timeline, assistente e análise pós-jogo.

## 11. Não implementar ainda

- física realista de colisão;
- mocap;
- 3D humano completo;
- inteligência de nível profissional em todas as fases;
- modelo estatístico calibrado com dezenas de ligas.

Primeiro provar que instruções produzem comportamento legível e coerente.
