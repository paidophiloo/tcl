# TOUCHLINE MATCH ENGINE MASTER PLAN

Status: PHASE 0 — Research, Audit, Architecture, Gap Analysis
Date: 2026-08-16
Branch: feat/playable-career-v1
Owner: Touchline Match Simulation

## 1. Mission

Touchline must be a football management simulation in which the score is an emergent output of player decisions, tactical structure, spatial interactions, physical condition, rules and uncertainty.

The renderer never decides football outcomes. The match engine must be able to simulate a complete match headlessly and deterministically.

Target experience: behavioural/systemic depth comparable in spirit to modern Football Manager, while remaining an original Touchline implementation with a premium 2D top-down Match Day.

## 2. Non-negotiable principles

1. Score is output, never preselected input.
2. No hidden `strongTeamForceGoal`, goal guarantees or rubber-banding.
3. Overall is primarily a summary/UI value; action resolution consumes contextual attributes.
4. Tactics change positions, options, responsibilities, risk and effort — not flat attack/defence bonuses.
5. Roles are behavioural policies per match phase, not `passing +10` presets.
6. The opponent uses the same simulation rules as the user.
7. Fixed simulation time is independent from renderer frame rate and playback speed.
8. Same seed + same inputs + same manager actions = same simulation.
9. Every major tactical control must have an observable causal footprint in positions, heatmaps, events or metrics.
10. Statistical calibration fixes causal systems, not test outputs.

## 3. Source classification

See `docs/RESEARCH-MATRIX.md`.

Implementation documents must label external claims as:

- CONFIRMED
- INFERRED
- TOUCHLINE DESIGN

No undocumented Football Manager internal formula may be presented as fact.

---

# 4. CURRENT SYSTEM AUDIT

## 4.1 What exists today

### Public facade

`src/match-engine.js` is already a compatibility facade that exports the implementation below `src/match-sim/`. This boundary is worth preserving because UI/career integrations can stay stable while internals are decomposed.

### V2 simulation core

`src/match-sim/v2.js` currently provides:

- deterministic seeded RNG;
- fixed 0.25 second decision slice;
- 45/90 minute phase constants;
- five substitutions / three substitution windows baseline;
- four formations: 4-2-3-1, 4-3-3, 4-4-2, 3-4-2-1;
- tactics: mentality, width, defensive line, pressing, tempo, passing risk, counterpress;
- player positions and constrained custom positions;
- role familiarity/position-fit concepts;
- player/team state;
- ball state;
- tactical queuing and substitutions;
- fatigue/stamina behaviour;
- AI team handling;
- events and statistics;
- deterministic tick accumulation;
- competition-like end-state support including conditional shootout behaviour added in V2.

### Statistical calibration layer

`src/match-sim/engine.js` currently wraps V2 and owns shot/xG/discipline calibration separately from the tactical slice layer. This is a good direction: probability calibration can change without coupling renderer or public API.

### Renderer

`src/pitch-renderer.js` is Canvas 2D and already has a strong architectural property: it consumes MatchEngine snapshots. It maintains visual interpolation state independently from simulation state and is therefore a suitable base for the future 2D presentation layer.

### Match Day application

`src/app.js` currently contains large amounts of Match Day UI orchestration, pre-match scenes, tactical copy, substitution UI state, event handling and renderer integration. It imports `MatchEngine`, `PitchRenderer` and MVP data directly.

This file is currently too broad to remain the long-term Match Day architecture.

### Data model

`src/mvp-data.js` already models explicit player attributes instead of only overall. Current profiles include examples such as:

- goalkeeping
- defending
- positioning
- physical
- passing
- decisions
- technique
- finishing
- pace
- stamina
- aggression
- aerial
- crossing
- dribbling
- tackling
- firstTouch
- workRate

This is a useful base, but the future engine requires a richer semantic attribute model and source mapping from the career player database.

### Existing validation

The project already has:

- MVP smoke tests;
- Match Engine V2 smoke tests;
- tactics engine/UI tests;
- career persistence tests;
- world simulation tests;
- FC26 rating audits;
- live roster validation;
- full GitHub Actions quality workflow.

That foundation should be expanded rather than replaced.

## 4.2 Current strengths to preserve

- stable `match-engine.js` facade;
- deterministic RNG concept;
- 250 ms simulation slices;
- renderer/simulation separation;
- snapshot-based Canvas 2D renderer;
- explicit player attributes;
- queued tactical/substitution changes;
- current career result/event integration;
- tests and CI discipline;
- headless-capable core logic.

## 4.3 Current architectural problems

### A. Monolithic implementation remains

Although `match-engine.js` is now a facade, `src/match-sim/v2.js` is still ~54 KB and owns too many responsibilities.

Target: V2 becomes a migration source, not the final architecture.

### B. Roles are still too scalar

Current `ROLE_EFFECTS` contains fields such as:

- attack
- defend
- width
- involvement
- fatigue
- pass
- carry
- shot

These were useful for V2, but the final system must replace these with explicit behaviours:

- preferred zones;
- support relationships;
- run types;
- press responsibility;
- cover responsibility;
- transition priority;
- risk profile;
- receiving orientation;
- marking behaviour;
- recovery behaviour.

### C. Formation model is mostly a base coordinate map

Current formations provide static slot coordinates. The target requires:

- explicit In Possession shape;
- explicit Out of Possession shape;
- attacking-transition responsibilities;
- defensive-transition responsibilities;
- role-driven morphing between structures.

### D. Spatial intelligence is implicit

Pressure and distance exist, but there is no dedicated reusable SpatialModel with first-class concepts for:

- passing lanes;
- pitch control;
- compactness;
- line distances;
- overloads;
- rest defence;
- cover shadows;
- free/contested zones;
- offside line.

### E. Decision pipeline is not sufficiently decomposed

We need explicit layers:

PERCEIVE -> INTERPRET -> GENERATE OPTIONS -> EVALUATE OPTIONS -> COMMIT -> EXECUTE -> REACT.

That allows attributes to affect different cognitive stages rather than only success probabilities.

### F. Ball physics/state is under-specified

The ball already has position/state but needs an explicit action trajectory model so passing, crossing, loose balls, rebounds and aerial play stop behaving like ownership transitions.

### G. Action families are coupled

Passing, receiving, carrying, dribbling, tackling, aerial duels, shooting and goalkeeping need independent resolvers with shared contracts.

### H. Referee/rules are not a complete subsystem

Rules must be competition-driven and include:

- substitution limits/windows;
- draw/extra time/shootout rules;
- offside;
- advantage;
- cards;
- penalties;
- added time;
- current IFAB season changes.

### I. Manager AI is not yet an analyst

Target AI must observe evidence and decide through the same tactical command API available to the user.

### J. Match Day UI and orchestration are too concentrated in `app.js`

We need distinct presentation/view-model modules for:

- match shell;
- scoreboard;
- pitch;
- timeline;
- tactical command center;
- substitution panel;
- match analytics;
- assistant insights;
- replay/highlight controller.

---

# 5. TARGET ARCHITECTURE

```text
src/match-sim/
  index.js
  engine.js                 # public internal orchestrator

  core/
    simulation-clock.js
    deterministic-rng.js
    match-state.js
    possession-state.js
    ball-state.js
    action-state.js
    snapshot-builder.js

  agents/
    player-agent.js
    goalkeeper-agent.js
    referee-agent.js
    manager-agent.js

  spatial/
    pitch-model.js
    spatial-index.js
    pressure-map.js
    passing-lanes.js
    pitch-control.js
    compactness.js
    offside-line.js
    overloads.js
    rest-defence.js

  tactics/
    formations.js
    tactical-shapes.js
    role-catalog.js
    role-behaviours.js
    team-instructions.js
    player-instructions.js
    transitions.js
    tactical-familiarity.js

  decisions/
    perception.js
    interpretation.js
    option-generation.js
    option-evaluation.js
    intention.js
    decision-engine.js

  actions/
    action-contract.js
    movement.js
    passing.js
    receiving.js
    carrying.js
    dribbling.js
    tackling.js
    interceptions.js
    aerial-duels.js
    shooting.js
    blocking.js
    goalkeeping.js
    loose-ball.js

  rules/
    competition-rules.js
    match-phases.js
    substitutions.js
    offside.js
    fouls.js
    advantage.js
    cards.js
    penalties.js
    added-time.js
    var.js

  set-pieces/
    set-piece-state.js
    corners.js
    free-kicks.js
    penalties.js
    throw-ins.js
    goal-kicks.js

  physical/
    energy.js
    condition.js
    match-load.js
    injuries.js

  analytics/
    event-ledger.js
    match-stats.js
    player-stats.js
    xg.js
    xt.js
    tactical-metrics.js
    player-ratings.js
    evidence-payloads.js

  manager/
    tactical-observer.js
    mismatch-detector.js
    recommendation-engine.js
    manager-policy.js

  presentation/
    highlight-selector.js
    replay-buffer.js
    presentation-snapshot.js

  calibration/
    realism-lab.js
    tactical-causality-lab.js
    benchmark-targets.js
```

Compatibility remains:

`src/match-engine.js -> src/match-sim/engine.js`

No career/UI consumer should need to know internal paths.

---

# 6. SIMULATION CONTRACT

## 6.1 Time

- canonical decision slice: 0.25 s;
- fixed deterministic simulation accumulator;
- playback speed only changes how quickly simulation slices are consumed/presented;
- renderer interpolation is visual only;
- event timestamps are simulation timestamps.

## 6.2 Per-slice high-level order

Proposed Touchline order:

1. advance deterministic clock;
2. process pending rule/stoppage transitions;
3. update ball trajectory/action state;
4. update spatial index;
5. update team tactical phase;
6. update slow tactical/manager observations when due;
7. for eligible agents: perceive local state;
8. update/abort existing intentions if materially invalidated;
9. generate options when decision is required;
10. evaluate utilities with role/tactic/context/attributes;
11. commit intention;
12. resolve movement/action execution over time;
13. resolve interactions/collisions/duels;
14. referee evaluates relevant incidents;
15. update possession, events and statistics;
16. update energy/load;
17. build presentation snapshot at configured snapshot cadence.

Not every player selects a new action every slice. The slice is the opportunity to re-assess.

## 6.3 Hierarchical time scales

- 250 ms: local perception/reaction eligibility;
- ~0.5–3 s: movement/action commitments;
- ~2–10 s: possession/transition structures;
- ~15–60 s: tactical trend observations;
- minutes: manager tactical adaptations/substitutions.

Exact intervals are Touchline Design and must remain deterministic.

---

# 7. PLAYER AGENT MODEL

Each player owns:

```text
Identity
Attributes
Preferred positions
Preferred foot / weak foot
Position familiarity
Role familiarity
Tactical familiarity
Condition
Acute energy
Match load
Morale/confidence (small contextual influence)
Current position/velocity/orientation
Current marking/press assignment
Current intention
Current action
Perception memory
Match statistics
```

Decision stages must use different attribute subsets.

Example pass:

### Perception
- Vision
- Anticipation
- Concentration
- role familiarity
- pressure

### Evaluation
- Decisions
- Vision
- Teamwork
- Flair/risk profile
- manager instructions

### Execution
- Passing
- Technique
- First Touch/body setup
- preferred/weak foot
- pressure
- fatigue
- distance/pass type

This is explicitly different from `overall -> pass chance`.

---

# 8. TACTICAL MODEL

## 8.1 Four tactical phases

Every team always maps into one of:

1. IN_POSSESSION
2. ATTACKING_TRANSITION
3. OUT_OF_POSSESSION
4. DEFENSIVE_TRANSITION

Special ball/stoppage states temporarily override them.

## 8.2 Formation definition

A tactic stores at minimum:

```text
inPossessionFormation
outOfPossessionFormation
role per player for IP
role per player for OOP
team instructions IP
team instructions transition attack
team instructions OOP
team instructions transition defence
player instructions
set-piece assignments
```

Formation presets do not hardcode every movement. Roles/instructions transform the structure.

## 8.3 Required formation catalogue

Initial target:

- 4-3-3
- 4-2-3-1
- 4-4-2
- 4-1-4-1
- 3-4-3
- 3-4-2-1
- 3-5-2
- 5-4-1
- 5-3-2
- 4-2-2-2
- 4-3-2-1
- 4-4-1-1

Additional formations are data additions, not engine rewrites.

---

# 9. ROLE MODEL

The V2 scalar `ROLE_EFFECTS` is transitional and must not become the permanent abstraction.

A role behaviour definition should express:

```text
phase priorities
preferred zones
support distance
line-breaking/run preferences
ball-demand tendency
receive orientation
pass-risk profile
carry/dribble propensity
box occupation
press trigger response
marking/cover responsibility
recovery priority
transition urgency
width policy
verticality policy
```

Familiarity should primarily alter:

- timing;
- reaction latency;
- quality of chosen support/cover point;
- available behaviour options;
- instruction compliance;
- perception of role-relevant space.

It must not become a universal stat multiplier.

---

# 10. SPATIAL MODEL

A first-class SpatialModel is the core missing dependency.

Minimum outputs:

- nearest pressure per player;
- local numerical superiority;
- passing-lane openness;
- receiving-space score;
- ball-side / weak-side occupation;
- team width/depth;
- inter-line distances;
- defensive line and offside line;
- compactness;
- rest-defence count/shape;
- overload flags;
- dangerous free-space zones;
- cover relationships.

Implementation strategy:

1. begin with normalized pitch grid + geometric lane checks;
2. add influence/control estimates based on distance, velocity and facing;
3. cache per-slice calculations;
4. only add full continuous pitch-control sophistication where metrics prove value.

Avoid premature mathematical complexity.

---

# 11. BALL / ACTION MODEL

Ball is independent state.

Minimum BallState:

```text
x/y/z
vx/vy/vz
spin/curve simplified
lastTouchPlayerId
lastTouchTeamId
intendedTarget
trajectory/action id
state: CONTROLLED | TRAVELLING | LOOSE | DEAD
```

Actions have time duration and can be interrupted.

Required ball actions:

- ground pass;
- driven pass;
- through ball;
- lofted pass;
- long ball;
- cross;
- cutback;
- shot;
- header;
- clearance;
- deflection;
- rebound;
- loose ball.

---

# 12. DEFENSIVE / PRESSING MODEL

Pressing is a coordinated assignment problem, not a possession-win modifier.

Roles during a press:

- primary presser;
- lane blocker / cover shadow;
- second presser;
- cover player;
- rest-defence anchor;
- back-line adjustment.

Pressing consequences must emerge through:

- opponent option removal;
- decision-time compression;
- forced direction;
- pass execution under pressure;
- line movement;
- fatigue/sprint cost;
- space opened elsewhere.

Defensive options:

- hold;
- jockey;
- press;
- tackle;
- intercept;
- cover;
- track runner;
- hand over marking;
- double team;
- step up;
- drop;
- protect box;
- defend cross;
- aerial challenge.

---

# 13. PHYSICAL MODEL

Separate:

- pre-match condition;
- acute energy;
- match load;
- longer-term fatigue;
- sharpness.

Per-action energetic costs differ for walk/jog/run/sprint/press/duel/jump/recovery run.

Fatigue influences physical execution and cognitive reliability progressively, not with an arbitrary minute cliff.

---

# 14. RULES / REFEREE MODEL

`CompetitionRules` is mandatory.

It decides:

- match duration;
- draw allowed;
- extra time;
- shootout;
- substitutes allowed;
- substitution opportunities;
- competition-specific exceptions;
- VAR availability;
- concussion/substitution protocol flags where supported.

IFAB 2026/27 is the base rule reference, but competition rules must be separately configured.

Referee agent evaluates:

- fouls;
- advantage;
- yellow/red cards;
- penalties;
- added time;
- discipline thresholds.

Offside is geometric at pass/contact time.

---

# 15. MANAGER AI

Manager AI is not a difficulty multiplier.

Inputs:

- score/minute;
- xG and shot quality;
- territory/field tilt;
- possession quality;
- pressing efficiency;
- dangerous turnovers;
- fatigue;
- cards;
- matchup evidence;
- role performance.

Outputs must use the same command API as user actions:

- formation/shape;
- role;
- mentality;
- line;
- width;
- press;
- tempo;
- passing risk;
- marking/player instruction;
- substitution.

No hidden AI buffs.

---

# 16. ANALYTICS / EVIDENCE

The simulation should emit evidence-rich events and aggregates, not fabricated analysis strings.

Required team metrics progressively:

- goals;
- xG;
- shots/SOT;
- possession;
- passes/completion;
- progressive passes;
- field tilt;
- PPDA-like pressure metric;
- recoveries by zone;
- turnovers by zone;
- corners;
- fouls/cards;
- offsides;
- substitution windows;
- set-piece xG.

Player metrics progressively:

- touches;
- pass attempts/completion;
- progressive passes;
- key passes;
- xA/creation proxy;
- shots/xG;
- carries/dribbles;
- duels;
- tackles/interceptions;
- recoveries;
- distance/sprints;
- errors;
- role-execution metrics;
- rating.

Assistant insights consume evidence payloads such as:

```js
{
  type: "LEFT_FLANK_OVERLOAD",
  severity: 0.78,
  evidence: {
    entriesAllowed: 9,
    twoVOneEvents: 5,
    leftBackEnergy: 42,
    opponentRightProgressions: 11
  }
}
```

No random advice text without evidence.

---

# 17. REALISM LAB

Headless batch simulation is a first-class product requirement.

Runs:

- 1
- 10
- 100
- 1,000
- 10,000+

Track distributions, not individual scores:

- goals/game;
- home/away goals;
- result rates;
- exact-score frequencies;
- shot/SOT/xG distributions;
- possession/pass-chain/pass-length distributions;
- cards/fouls;
- corners;
- offsides;
- penalties;
- substitutions;
- injuries;
- goal timing;
- set-piece contribution;
- counterattack contribution;
- team-strength/result relationship.

Calibration targets should be versioned with source season/competition metadata.

---

# 18. TACTICAL CAUSALITY LAB

Every tactical feature needs an A/B test with the same teams and seeds.

Minimum mandatory experiments:

### Pressing 40 vs 80
Expect:
- press height/recovery zone changes;
- sprint/load increases;
- opponent decision pressure changes;
- late-game energy degradation;
- potential space-behind changes.

### Defensive line low vs high
Expect:
- average defensive position changes;
- compactness/territory changes;
- offside frequency changes;
- through-ball/run-behind exposure changes.

### Width narrow vs wide
Expect:
- touch/receive heatmap changes;
- central vs wide passing share changes;
- crossing/cutback profile changes.

### Tempo low vs high
Expect:
- time-to-action changes;
- transition frequency/turnover profile changes;
- energy/load changes.

### Fullback vs inverted fullback
Expect:
- average-position and heatmap shift;
- central overload/rest-defence shift;
- wide occupation change.

### False-nine vs target-forward-like striker
Expect:
- receiving depth changes;
- central-link involvement changes;
- box occupation/aerial target profile changes.

A control that cannot be observed in simulation evidence is not considered implemented.

---

# 19. MATCH DAY 2D TARGET

## 19.1 Visual direction

- 2D top-down only;
- no 3D player models;
- premium professional football-analytics aesthetic;
- original Touchline visual identity;
- smooth interpolation between snapshots;
- no visual interpolation feeding back into simulation.

## 19.2 Core layout target

Desktop baseline:

```text
┌──────────────── SCORE / CLOCK / COMPETITION / SPEED ────────────────┐
│                                                                     │
│  Context / Insights      LARGE 2D PITCH       Tactics / Bench       │
│                                                                     │
├──────────────────── EVENT + ANALYTICS TIMELINE ─────────────────────┤
└─────────────────────────────────────────────────────────────────────┘
```

This is a starting composition, not a pixel-locked mandate.

## 19.3 Tactical Command Center

Pause transitions the interface into a deeper command mode with:

- IP/OOP/average position views;
- roles;
- stamina;
- ratings;
- cards/injury state;
- matchups;
- heatmaps;
- passing network;
- pressure/territory overlays;
- evidence-based assistant insights;
- bench/substitution workflow.

## 19.4 Required optional overlays

- average positions;
- player trails;
- passing network;
- pressure;
- heatmap;
- defensive line;
- passing lanes;
- territorial control.

Only selected overlays display at once to preserve legibility.

## 19.5 Highlights and replay

Simulation always runs complete football.

Highlight modes only choose presentation segments:

- Full
- Comprehensive
- Extended
- Key
- Dynamic

Important event windows store snapshots for deterministic 2D replay. Replays never re-simulate the event.

---

# 20. MIGRATION STRATEGY

Do not big-bang replace the working V2.

Use strangler migration behind the stable facade.

### Step A
Introduce new module contracts while V2 remains authoritative.

### Step B
Move deterministic RNG/clock/state into `core/` with parity tests.

### Step C
Move formations/roles/tactics into data-driven modules.

### Step D
Introduce SpatialModel and feed it into current decisions without removing current fallbacks.

### Step E
Replace action families one by one.

### Step F
Replace manager/referee/rules subsystems.

### Step G
Retire scalar role effects only after causality tests prove behavioural replacements.

### Step H
Refactor Match Day UI after simulation contracts are stable.

At every step preserve `src/match-engine.js` API or add an adapter.

---

# 21. DELIVERY PHASES

## PHASE 0 — COMPLETE WITH THIS DOCUMENT SET
Research + audit + architecture + gap analysis.

## PHASE 1 — Simulation Kernel
Extract clock, RNG, state contracts, action state, snapshot builder.

Acceptance:
- seed determinism;
- 1x/2x/4x outcome parity;
- renderer independence;
- current MVP regression green.

## PHASE 2 — Spatial Intelligence
Pressure, lanes, compactness, line/offside, overload/rest defence primitives.

## PHASE 3 — Player Brain
Perception, interpretation, option generation/evaluation, intentions.

## PHASE 4 — Tactical Shapes + Roles
Separate IP/OOP shapes; data-driven phase behaviours and role familiarity.

## PHASE 5 — Passing + Receiving
Candidate risk, trajectory, interception, receiver movement/first touch.

## PHASE 6 — Defensive AI + Pressing
Coordinated press/cover/track/intercept and block behaviour.

## PHASE 7 — Transitions
Counterpress/regroup/counter/hold shape with time-sensitive state.

## PHASE 8 — Carry + Dribble + Duels
Distinct carry/dribble and contextual duel resolution.

## PHASE 9 — Shooting + Goalkeepers
Opportunity selection, blockers, trajectory, goalkeeper agent.

## PHASE 10 — Referee + Offside
Fouls, advantage, cards, penalties, geometric offside.

## PHASE 11 — Set Pieces
Corners, free kicks, penalties, throw-ins, goal kicks.

## PHASE 12 — Physical / Injuries
Energy, condition, load, injury risk.

## PHASE 13 — Manager AI + Substitutions
Evidence-driven same-command-API manager decisions.

## PHASE 14 — Competition Rules
Rule profiles, phases, extra time/shootout/VAR/substitution protocols.

## PHASE 15 — Analytics / Ratings
Tactical metrics, evidence payloads, role-sensitive ratings.

## PHASE 16 — Realism Calibration
Large batch distributions + versioned target data.

## PHASE 17 — 2D Match Day Rebuild
Presentation shell, pitch, scoreboard, timeline, panels.

## PHASE 18 — Tactical Command Center
Pause/deep tactical interaction and overlays.

## PHASE 19 — Highlights / Replay / Assistant
Snapshot replay, highlight selection, evidence-based advice.

## PHASE 20 — Full Regression / Career Integration
End-to-end persistence, league, Newsroom, calendar, injuries, cards, manager world integration.

---

# 22. PHASE GATES

Every phase requires, where applicable:

1. unit tests;
2. deterministic simulation tests;
3. tactical causality tests;
4. statistical checks;
5. public API regression tests;
6. career integration tests;
7. build;
8. GitHub Actions green.

A phase does not pass merely because the UI renders.

---

# 23. FIRST IMPLEMENTATION MILESTONE

The next coding milestone is **PHASE 1 — Simulation Kernel Extraction**.

Do not begin with visual redesign.

Concrete first tasks:

1. create `src/match-sim/core/deterministic-rng.js`;
2. create `src/match-sim/core/simulation-clock.js`;
3. create `src/match-sim/core/match-state.js`;
4. create `src/match-sim/core/snapshot-builder.js`;
5. adapt V2 to consume them without behavioural change;
6. add parity/determinism/speed-independence tests;
7. keep existing MVP distribution tests unchanged;
8. run full CI.

This creates a safe seam for all subsequent behavioural work.

---

# 24. Definition of Done for the full rebuild

The rebuild is done only when:

- tactics materially alter observable behaviour;
- attributes affect appropriate cognitive/execution stages;
- formations visibly morph by phase;
- roles produce distinct heatmaps and responsibilities;
- pressing has both benefit and cost;
- fatigue changes execution/decision quality progressively;
- substitutions change actual matchups;
- manager AI reacts through the user command API;
- strong teams win more often through football processes, not forced score weights;
- underdogs can win through the same football processes;
- the renderer cannot alter the outcome;
- match distributions are plausible across large samples;
- tactical A/B tests produce the expected direction of change;
- 2D presentation makes tactical differences visually legible;
- career persistence, Newsroom, league table, fixtures, cards and injuries remain integrated;
- full CI is green.

Until then, V2/V3 milestones are progress, not completion.