import { describe, expect, it } from "vitest";
import { proofExamples, runExample } from "../src";

describe("proof examples", () => {
  it.each(proofExamples.filter((example) => example.provesWithTactic !== false))("proves $title", (example) => {
    const state = runExample(example);
    const goal = state.goals[0];

    expect(goal.status).toBe("proved");
    expect(state.proofLog).toHaveLength(1);
  });

  it("includes a split-first vertical composite naturality example", () => {
    const example = proofExamples.find((candidate) => candidate.id === "vertical-composite-naturality");

    expect(example?.provesWithTactic).toBe(false);
    expect(example?.goalText).toBe("F.map(f) >> alpha_Y >> beta_Y = alpha_X >> beta_X >> H.map(f)");
  });
});
