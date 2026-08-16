# Touchline Match Engine Research Matrix

Status: PHASE 0 research baseline
Date: 2026-08-16
Scope: public, verifiable behavioural references only. No proprietary Football Manager or EA source code is assumed available.

## Evidence policy

- **CONFIRMED**: explicitly described by a primary/authoritative source.
- **INFERRED**: reasonable behavioural inference from public material; not an internal formula claim.
- **TOUCHLINE DESIGN**: our own implementation choice intended to reproduce a confirmed/inferred football behaviour.
- Never convert an inference into a claim about Football Manager internals.

## Primary sources

1. Sports Interactive — Match Engine AI in FM21
   - https://www.footballmanager.com/news/match-engine-ai-fm21
2. Sports Interactive — FM26: In Possession, Out of Possession tactical evolution
   - https://www.footballmanager.com/fm26/features/possession-out-possession-fm26s-new-tactical-evolution
3. Sports Interactive — FM26 Match Day Experience
   - https://www.footballmanager.com/fm26/features/where-storytelling-evolves-fm26s-match-day-experience
4. EA Sports — FC 25 FC IQ Deep Dive
   - https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-fc-iq-deep-dive
5. EA Sports — FC 25 Gameplay Deep Dive
   - https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive
6. IFAB — Laws of the Game 2026/27
   - https://www.theifab.com/documents/?category=laws-of-the-game
7. IFAB — 2026/27 law changes
   - https://www.theifab.com/law-changes/latest/

## Supporting research

- Chacoma et al. (2020), *Modeling ball possession dynamics in the game of football* — possession timing/pass-length distributions as calibration targets.
  - https://arxiv.org/abs/2005.04020
- Liu et al. (2021), *From Motor Control to Team Play in Simulated Humanoid Football* — useful evidence for hierarchical multi-timescale decision architecture; not a direct template for Touchline because we are 2D and do not need articulated-body control.
  - https://arxiv.org/abs/2105.12196

---

## Research matrix

| Feature | Status | Public evidence | Confidence | How the reference behaves | Touchline implementation | Open questions |
|---|---|---|---|---|---|---|
| Decision slices | CONFIRMED | SI FM21 explicitly states players and officials make a decision every quarter-second, called a slice | High | Continuous re-assessment rather than event scripting | Fixed 250 ms simulation slices; perception can update without forcing an action | Whether all agents truly execute decision logic every slice is internal/UNKNOWN |
| Attribute-driven decisions | CONFIRMED | SI FM21 states actions are selected based on player attributes | High | Attributes shape decision and/or execution | Separate perception, option generation, decision quality and execution attributes | Exact SI formulas are UNKNOWN |
| Separate IP/OOP formations | CONFIRMED | FM26 introduces distinct In Possession and Out of Possession formations | High | Shape changes materially with possession state | TacticalState owns IP, OOP, attacking-transition and defensive-transition structures | How much interpolation/role-specific transition timing FM uses is UNKNOWN |
| OOP roles | CONFIRMED | FM26 describes new Out of Possession roles with suitability tied to positional familiarity and key attributes | High | Defending behaviour is role-specific | Every role has phase behaviours, not scalar buffs | Exact FM role catalogue/formulas are not copied |
| Reduced hardcoding in roles | CONFIRMED | FM26 says hardcoded role instructions were reduced to increase customisation | High | Role is a behavioural prior, manager instructions can override aspects | Roles expose priorities/constraints; team/player instructions are separate inputs | Conflict-resolution precedence must be Touchline-designed |
| Pass-risk rework | CONFIRMED | FM26 Match Day article says pass-risk assessment changed to improve passes through traffic and between lines | High | Passing considers contextual risk and reward | Generate pass candidates; evaluate lane risk, pressure, progression, receiver readiness and instruction risk tolerance | Internal FM risk model UNKNOWN |
| Pressing/rest defence language | CONFIRMED | FM26 tactical article explicitly references pressing triggers and rest defence as tactical concepts | High | Team shape is phase-aware and structurally constrained | Spatial model computes pressure support, cover, compactness and rest-defence occupation | Exact thresholds must be calibrated |
| Assistant contextual advice | CONFIRMED | FM26 Match Day gives example of assistant recommending lower tempo late when winning comfortably | High | Advice derives from match context | Insight rules require evidence payload from metrics/state, no random flavour text | Future ML vs rule-based insight layer |
| 2D Overview | CONFIRMED | FM26 Match Day presents a 2D Overview | High | 2D remains a valid tactical representation | Keep premium top-down 2D; renderer consumes snapshots only | Final visual hierarchy to be user-tested |
| Roles as off-ball behaviour | CONFIRMED | FC25 FC IQ says Roles guide how players think, behave and move off the ball | High | Role changes positioning/runs rather than pure ratings | Role behaviour catalogue drives target zones, support distance, runs, press/cover duties | Do not copy EA role names/UI verbatim where avoidable |
| Role trade-offs | CONFIRMED | FC25 says all Roles have positive and negative aspects | High | More attacking contribution may mean slower defensive recovery, etc. | Encode behavioural costs via positioning, effort, transition delay, risk; avoid flat hidden buffs | Balance coefficients require causality tests |
| Role familiarity | CONFIRMED | FC25 documents base/+/++/OOP and says familiarity influences tactical intelligence, positioning calculations and behaviour options | High | Familiar players select/t time behaviour more effectively | Familiarity affects available options, reaction latency, run timing, support/cover geometry and instruction compliance | EA says familiarity can be 10–40% in its formulas; Touchline will NOT blindly reuse those weights |
| With-ball / without-ball views | CONFIRMED | FC25 FC IQ exposes separate views | High | Tactical setup is visually phase-aware | Touchline Tactical Command Center exposes IP/OOP/average views | UX details original to Touchline |
| Substitution windows display | CONFIRMED | FC25 UI exposes substitutions remaining and windows remaining | High | Rule complexity is user-visible | CompetitionRules tracks used substitutes/windows and UI displays both | Competition-specific exception matrix required |
| Five substitutions / three opportunities | CONFIRMED as common rule framework; competition-specific | IFAB Laws/changes preserve three opportunities where applicable | High | Multiple substitute changes may be grouped into a single window | Rules engine records opportunities, half-time/exempt stoppages separately per competition | Premier League 2026/27 competition handbook should be separately verified before locking exact exceptions |
| Overall as representation, roles/attributes as behaviour | CONFIRMED for FC IQ conceptual model | EA describes OVR as representation of physical/mental attributes, PlayStyles as on-ball skills, Roles as off-ball abilities | Medium/High | OVR is not presented as sole simulation primitive | Overall is UI/scouting summary; action resolvers consume attributes | Touchline attribute weights are our design |
| Hierarchical/multi-timescale agents | SUPPORTING RESEARCH | Multi-agent football research demonstrates decisions at multiple abstraction/time scales | Medium | Team strategy and local actions need different horizons | Manager/tactical policy updates slower; player perception at 250 ms; action commitment spans slices | We should benchmark CPU cost before deeper hierarchy |
| Possession/pass statistical calibration | SUPPORTING RESEARCH | Chacoma et al. model possession-time/pass-length distributions from top European leagues | Medium | Plausibility can be evaluated statistically beyond goals | Realism Lab tracks possession durations, pass chains, pass lengths in addition to scoreboard metrics | Dataset selection for 2025/26 or 2026/27 calibration |

---

## What is explicitly UNKNOWN

The following must never be asserted as Football Manager internals unless Sports Interactive publishes them:

- exact probability formulas for passing, shooting, tackling, saving or injuries;
- precise attribute weights per action;
- source-code architecture/classes/data structures;
- exact pitch-control or space-evaluation algorithm;
- exact role-to-coordinate formulas;
- exact manager-AI utility functions;
- exact xG model and coefficients;
- hidden balancing/rubber-banding mechanisms;
- exact highlight-selection algorithm.

Touchline must build its own original implementations and validate them through football outcomes and tactical causality.

## Research conclusion

The strongest cross-source pattern is not a specific formula. It is **causal separation of concerns**:

1. tactical structure determines available space and responsibilities;
2. player role/familiarity shapes what the agent notices and attempts;
3. attributes/context/fatigue shape decision quality and execution;
4. the opponent simultaneously changes the same environment;
5. actions update the shared world state;
6. statistics and score emerge from those interactions;
7. presentation visualises the simulation rather than controlling it.

That is the behavioural target for Touchline.