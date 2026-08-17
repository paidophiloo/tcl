// Every official world fixture now uses the same deterministic causal Match
// Engine as a watched user match. This adapter preserves the career runtime API.
export { prepareCareerMatch, createCareerMatchEngine, runMatchToEnd, resultFromCareerMatch } from './career-match-engine-adapter.js';
import { simulateCareerFixtureWithEngine } from './career-match-engine-adapter.js';
export function simulateWorldFixture(career,fixture){return simulateCareerFixtureWithEngine(career,fixture)}
