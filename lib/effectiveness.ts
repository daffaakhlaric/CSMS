import { Room, Scenario, scenarios, tickRoom } from "./domain";

export type Observation = { at: number; temperature: number; valid: boolean };
export type EvaluationInput = {
  roomId: string;
  scenario: Scenario;
  target: number;
  warning: number;
  critical: number;
  samples: Observation[];
};
export function validEvaluation(x: unknown): x is EvaluationInput {
  if (!x || typeof x !== "object") return false;
  const v = x as EvaluationInput;
  return (
    ["CS-01", "CS-02"].includes(v.roomId) &&
    Object.hasOwn(scenarios, v.scenario) &&
    [v.target, v.warning, v.critical].every(
      (n) => Number.isFinite(n) && n >= -60 && n <= 20,
    ) &&
    v.target < v.warning &&
    v.warning < v.critical &&
    Array.isArray(v.samples) &&
    v.samples.length >= 2 &&
    v.samples.length <= 300 &&
    v.samples.every(
      (s, i) =>
        s &&
        Number.isFinite(s.at) &&
        Number.isFinite(s.temperature) &&
        s.temperature >= -60 &&
        s.temperature <= 20 &&
        typeof s.valid === "boolean" &&
        (i === 0 ||
          (s.at > v.samples[i - 1].at && s.at - v.samples[i - 1].at <= 15000)),
    )
  );
}
const round = (n: number) => Math.round(n * 10) / 10;
export function effectiveness(input: EvaluationInput) {
  let total = 0,
    available = 0,
    safe = 0,
    critical = 0,
    deviation = 0;
  for (let i = 0; i < input.samples.length - 1; i++) {
    const s = input.samples[i],
      dt = (input.samples[i + 1].at - s.at) / 1000;
    total += dt;
    if (!s.valid) continue;
    available += dt;
    if (s.temperature < input.warning) safe += dt;
    if (s.temperature >= input.critical) critical += dt;
    deviation += Math.abs(s.temperature - input.target) * dt;
  }
  const availability = total ? available / total : 0;
  const safeFraction = available ? safe / available : 0;
  const tracking = available
    ? Math.max(0, 1 - deviation / available / (input.warning - input.target))
    : 0;
  // All components are availability-gated: missing telemetry cannot earn cooling credit.
  const score = total
    ? Math.round(
        100 * availability * (0.6 * safeFraction + 0.25 * tracking + 0.15),
      )
    : null;
  return {
    score,
    seconds: round(total),
    availabilityPct: round(availability * 100),
    safePct: round(safeFraction * 100),
    criticalSeconds: round(critical),
    meanDeviation: available ? round(deviation / available) : null,
    confidence:
      total >= 60 && availability >= 0.9 ? "cukup untuk demo" : "data terbatas",
  };
}

/** A bounded model-callable tool. Predictions are synthetic, not hardware forecasts. */
export function compareInterventions(input: EvaluationInput) {
  return (["normal", "recovery", "stable"] as Scenario[]).map((scenario) => {
    let room = {
      id: input.roomId,
      target: input.target,
      warning: input.warning,
      critical: input.critical,
      temperature: input.samples.at(-1)!.temperature,
      scenario,
      running: true,
      noise: 0,
      history: [],
    } as unknown as Room;
    const samples: Observation[] = [];
    for (let i = 0; i <= 60; i++) {
      samples.push({
        at: i * 2000,
        temperature: room.temperature,
        valid: true,
      });
      room = tickRoom(room, new Date((i + 1) * 2000), () => 0.5);
    }
    return {
      scenario,
      ...effectiveness({ ...input, scenario, samples }),
      limitation:
        "Proyeksi simulator 120 detik, sensor diasumsikan pulih, derau nol; bukan bukti hasil nyata.",
    };
  });
}
