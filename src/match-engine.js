// Public compatibility facade for the Touchline match simulation.
// Keeping this path stable lets the UI, renderer and tests evolve independently
// from the simulation implementation under src/match-sim/.
export * from "./match-sim/v2.js";
