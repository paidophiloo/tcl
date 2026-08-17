# Touchline Match Engine V3 — Implementation Report

Status: implementation baseline complete on `feat/playable-career-v1`.

This report closes the execution cycle defined by `TOUCHLINE-MATCH-ENGINE-MASTER-PLAN.md`. It records what is implemented in the repository and what must be validated by a human in the playable Match Day. It does not claim access to or reproduction of proprietary Football Manager / EA FC source code. Touchline implements an original causal football simulation using public behavioural references and football rules.

## Core invariant

The score is an output of the simulation. There is no pre-selected scoreline, strong-team forced goal, rubber banding, guaranteed goal, or renderer-driven result.

The public match engine is deterministic for identical seed + inputs + manager actions. Playback speed changes how quickly fixed simulation slices are consumed, not the size or order of simulation decisions.

## Phase completion matrix

### Phase 0 — Research, audit and architecture — COMPLETE

- `docs/RESEARCH-MATRIX.md`
- `docs/TOUCHLINE-MATCH-ENGINE-MASTER-PLAN.md`
- Explicit separation of CONFIRMED public evidence, INFERRED behaviour and TOUCHLINE DESIGN.
- Stable public facade retained at `src/match-engine.js`.

### Phase 1 — Simulation kernel — COMPLETE

- Fixed 250 ms decision slices.
- Deterministic RNG.
- Fixed-step simulation clock independent from render frame rate.
- Match state, score, period, pause, speed and stoppage state.
- Independent ball state.
- Same seed is reproducible across different processing chunk sizes and 1x/4x playback throughput.

Primary modules:
- `src/match-sim/core/simulation-clock.js`
- `src/match-sim/core/deterministic-rng.js`
- `src/match-sim/core/ball-state.js`
- `src/match-sim/engine-v3.js`

### Phase 2 — Spatial intelligence — COMPLETE

- Normalised pitch geometry.
- Pressure map.
- Passing lane risk.
- Pitch control.
- Compactness.
- Offside line.
- Tactical anchors by phase.
- Team width and line-height causality.
- Cached structural slot assignment so phase changes do not repeatedly solve the same tactical assignment.

Primary modules:
- `src/match-sim/spatial/pitch-model.js`
- `pressure-map.js`
- `passing-lanes.js`
- `pitch-control.js`
- `compactness.js`
- `offside-line.js`
- `src/match-sim/tactics/tactical-shapes.js`

### Phase 3 — Player perception and decision engine — COMPLETE

Decision pipeline:
- perceive context;
- generate feasible options;
- evaluate football utility;
- stochastic-but-deterministic selection driven by decision quality;
- execute chosen action;
- retain evidence for diagnostics.

The player brain consumes pressure, phase, zone, offside line, passing lanes, teammates, opponents, attributes, role and tactical instructions rather than Overall as a universal probability modifier.

Primary modules:
- `src/match-sim/decisions/perception.js`
- `option-generation.js`
- `option-evaluation.js`
- `decision-engine.js`

### Phase 4 — Tactical shapes and player roles — COMPLETE

- Separate in-possession and out-of-possession formations.
- Attacking and defensive transition phases.
- Formation transforms such as `4-2-3-1 → 3-2-5`.
- Large behavioural role catalogue for GK, defenders, full-backs/wing-backs, midfielders, wide attackers and strikers.
- Roles alter anchors, support, width, run choice, ball demand, pass risk, carrying, box occupation, pressing, marking, cover and recovery behaviour.
- Position, role and tactical familiarity are separate concepts.
- Role behaviour is phase-aware rather than a flat `+attack` modifier.

Primary modules:
- `src/match-sim/tactics/formations.js`
- `role-catalog.js`
- `tactical-shapes.js`
- `team-instructions.js`
- `src/match-sim/engine-complete.js`

### Phase 5 — Passing and receiving — COMPLETE

- Pass decision and execution are separate.
- Passing-lane risk, progression, receiver control, pressure and distance influence selection.
- Pass execution uses passing/technique/vision/decisions/weak-foot-style context rather than overall alone.
- Ball travels as an action instead of teleporting directly between players.
- Reception can produce controlled first touch, pressured control or turnover outcomes.

Primary modules:
- `src/match-sim/actions/passing.js`
- `receiving.js`
- `src/match-sim/core/ball-state.js`

### Phase 6 — Defensive AI and pressing — COMPLETE

- Pressure depends on actual player/ball geometry.
- Multiple nearby defenders contribute differently.
- Pressing intensity changes engagement and physical cost.
- Counterpress modifies transition reaction.
- High pressing/tempo consumes measurably more energy than a conservative block.
- Defensive line and block behaviour have spatial consequences instead of hidden score bonuses.

Primary modules:
- tactical shapes;
- pressure map;
- decision engine;
- energy model.

### Phase 7 — Transitions — COMPLETE

Four collective phases are represented:
- IN_POSSESSION;
- ATTACKING_TRANSITION;
- OUT_OF_POSSESSION;
- DEFENSIVE_TRANSITION.

Possession age determines transition vs established structure. Counter/counterpress instructions and role transition behaviour alter movement and decision context.

### Phase 8 — Carrying, dribbling and duels — COMPLETE

- Ball carrying and confrontation outcomes are separated in the action layer.
- Ground/aerial duel resolution uses contextual attributes and player state.
- Second-ball outcomes are represented through loose-ball/action resolution rather than guaranteed clean possession.

Primary modules:
- `src/match-sim/actions/carrying.js`
- `duels.js`

### Phase 9 — Shooting and goalkeepers — COMPLETE

- Shot selection emerges from location, angle, pressure, alternatives, role and player quality.
- xG describes the created chance rather than choosing the score beforehand.
- Shot execution and goalkeeper response are distinct parts of resolution.
- Goalkeeper anchors respond to ball and tactical context.
- Saves, parries/restarts and keeper distribution are represented.

Primary modules:
- `src/match-sim/actions/shooting.js`
- `goalkeeping.js`
- engine shot resolution.

### Phase 10 — Fouls, cards, referee, offside and VAR — COMPLETE

- Referee model.
- Fouls and advantage-related match stoppages.
- Yellow, second-yellow / red paths.
- Penalties.
- Geometric offside evaluation.
- VAR review layer where competition rules permit it.

Primary modules:
- `src/match-sim/rules/referee.js`
- `offside.js`
- `var.js`

### Phase 11 — Set pieces — COMPLETE baseline

- Corners.
- Direct/crossing free-kick resolution.
- Throw-ins.
- Goal kicks.
- Penalties / shootout support.
- Set-piece takers selected from relevant contextual attributes.

Primary module:
- `src/match-sim/set-pieces/set-piece-engine.js`

A future graphical custom-routine designer can deepen this without changing the simulation architecture.

### Phase 12 — Fatigue and injuries — COMPLETE

- Energy drains continuously by activity.
- Pressing, running and high tempo create different physical costs.
- Fatigue feeds contextual execution and late-match behaviour.
- Injury risk is modelled from match context rather than a scripted minute trigger.

Primary modules:
- `src/match-sim/physical/energy.js`
- `injuries.js`

### Phase 13 — Manager AI and substitutions — COMPLETE

- AI observes score, threat, fatigue and tactical metrics.
- AI tactical changes use the same queued-tactics pathway exposed to the human manager.
- AI substitutions use the same substitution rules/pathway.
- Five-substitution support with three in-match windows.
- Half-time substitutions do not consume an in-match window where the competition rule allows it.
- Fresh replacement inherits the relevant role/position context and starts with its own physical/attribute profile.

Primary modules:
- `src/match-sim/manager/tactical-observer.js`
- `manager-policy.js`
- `src/match-sim/rules/substitutions.js`

### Phase 14 — Competition rules and match phases — COMPLETE

- League draw support.
- Winner-required match support.
- Added time.
- Extra time.
- Penalty shootout only when the competition requires a winner.
- Competition-aware substitution configuration.

Primary modules:
- `src/match-sim/rules/competition-rules.js`
- `added-time.js`
- engine rules layers.

### Phase 15 — Analytics and player ratings — COMPLETE

Team metrics include, where produced by simulation:
- score;
- xG;
- shots / shots on target;
- possession;
- passes / progressive passes;
- corners;
- fouls/cards;
- offsides;
- saves;
- high recoveries;
- counters;
- field tilt / tactical metrics.

Player ratings consume broader match contribution rather than goals/assists alone.

Primary modules:
- `src/match-sim/analytics/match-analytics.js`
- `player-ratings.js`

### Phase 16 — Realism and causality calibration — COMPLETE baseline and permanently gated

Automated gates test:
- goals per match distribution;
- shots;
- shots on target;
- xG;
- scoreline variation;
- stronger-attribute team advantage over batches;
- pressing physical cost;
- width causality;
- defensive-line causality;
- role-position causality;
- deterministic simulation;
- playback-speed determinism;
- IP/OOP shape changes.

Primary validation:
- `tests/match-engine-v3-causality.mjs`
- `tests/match-engine-v3-realism.mjs`
- `tests/match-engine-v2-smoke.mjs` (historical filename, public V3 gate)
- `scripts/match-realism-lab.mjs`

### Phase 17 — 2D Match Day visual rebuild — COMPLETE

- No 3D character gameplay.
- Top-down 2D pitch.
- Player discs with numbers/status/energy.
- Independent ball marker.
- Smooth renderer interpolation between simulation states.
- Scoreboard, clock, speed, timeline, contextual panels and match controls.
- Renderer consumes snapshots and cannot author simulation results.

Primary files:
- `src/career-matchday-v3.js`
- `src/career-matchday-v3.css`
- `src/pitch-renderer.js`

### Phase 18 — Tactical Command Center — COMPLETE

Pause opens a management surface for live intervention:
- formation;
- mentality;
- pressing;
- tempo;
- width;
- defensive line;
- player roles;
- substitution OUT/IN;
- role suitability / energy;
- separate IP/OOP shapes;
- directness;
- pressing trap;
- marking approach;
- tackling;
- goalkeeper distribution;
- chance creation;
- defensive width;
- counterpress;
- counter;
- offside trap.

Changes are queued into the same engine API and applied through match stoppage logic rather than instant secret buffs.

Primary files:
- `src/career-matchday-v3.js`
- `src/career-matchday-v3-advanced-tactics.js`
- associated CSS.

### Phase 19 — Highlights, replay, overlays and assistant insight — COMPLETE baseline

- FULL / COMPREHENSIVE / EXTENDED / KEY / DYNAMIC presentation modes.
- Highlight selection filters presentation only; simulation remains continuous.
- Snapshot-based 2D replay without recomputing the incident.
- Tactical overlays for anchors, lines and movement trails.
- Assistant insights consume engine analytics/evidence rather than random flavour text.

Primary files:
- `src/career-matchday-v3-enhancements.js`
- `src/match-sim/presentation/highlight-selector.js`
- `replay-buffer.js`

### Phase 20 — Career integration and regression — COMPLETE

The same public V3 engine is connected to career fixtures and headless simulation.

The career adapter provides:
- real selected line-up for user club;
- AI line-up / tactical plan for opponent;
- player availability / world state;
- deterministic fixture seed;
- competition rule selection;
- engine result conversion into canonical career events and match stats.

Primary file:
- `src/career-world/career-match-engine-adapter.js`

Result data feeds the existing career result/event architecture instead of maintaining a separate arcade result generator.

## Match Day manual acceptance checklist

Automated tests can prove deterministic and statistical contracts but cannot decide whether the visual football feels right to a human. Manual acceptance should focus on observable causal behaviour.

1. Start one fixture and watch at least 15–20 simulated minutes before changing anything.
2. Pause and change team width from narrow to very wide. Resume and verify the outer lanes visibly expand.
3. Compare low vs high defensive line and verify the block visibly moves up/down, with the expected risk behind it.
4. Use `4-2-3-1` out of possession and `3-2-5` in possession. Verify the team visibly transforms when possession changes.
5. Change a striker between an advanced/depth role and False Nine. Verify the False Nine receives/drops deeper rather than behaving as a finishing-stat buff.
6. Increase pressing and tempo. Verify more aggressive engagement and a larger physical cost later in the match.
7. Around 65–75 minutes, introduce a fresh fast attacker against a tired wide defender. Verify the physical matchup and movement visibly change.
8. Queue a tactical change during live play. Verify it is prepared/applied through the match control flow instead of magically changing a completed action.
9. Use the substitution panel and verify the three-window rule while half-time changes remain free of a window when applicable.
10. Switch 1x / 2x / 4x. Visual playback should accelerate while football logic remains stable.
11. Toggle tactical overlays and confirm they clarify, rather than obscure, the 2D match.
12. Trigger/view a replay after a relevant incident and confirm it replays stored snapshots instead of producing a different event.
13. Inspect post-match xG, shots, possession, cards, passes and player ratings and compare them to what you watched.
14. Play a second match with materially different tactics. Without looking at the settings, the two teams should visibly play differently.

## Explicit non-goals / boundaries

- No proprietary Football Manager or EA FC source code is copied or claimed.
- No 3D player model system is planned for this Match Day.
- Statistical calibration remains an ongoing product discipline: future real-world datasets can tighten the target distributions without changing the causal architecture.
- A graphical custom set-piece routine designer can be added later on top of the implemented set-piece engine.
- Subjective animation/UI feel requires human acceptance in the browser even when automated UI contracts are green.

## Definition of done for this rebuild baseline

The rebuild baseline is ready for product acceptance when the branch head passes:

- production build;
- V3 tactical causality gate;
- V3 statistical realism gate;
- V3 Match Day 2D UI gate;
- playback-speed determinism;
- competition/substitution rules;
- career result integrity;
- Newsroom/event bridges;
- Living World / market / managers;
- ratings audit;
- MVP smoke;
- live roster validation.

After that point, iteration should be driven by observed football behaviour from manual Match Day testing and by measured distribution regressions, not by returning to scripted score or flat tactical bonuses.
