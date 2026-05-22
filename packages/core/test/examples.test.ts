import { describe, expect, it } from "vitest";
import { proofExamples, runExample } from "../src";

describe("proof examples", () => {
  it.each(proofExamples.filter((example) => example.provesWithTactic !== false))("proves $title", (example) => {
    const state = runExample(example);
    const goal = state.goals[0];

    expect(goal.status).toBe("proved");
    expect(state.proofLog).toHaveLength(1);
  });

  it("keeps the curated example set focused", () => {
    expect(proofExamples.map((example) => example.id)).toEqual([
      "transpose-counit",
      "product-pairing-precompose",
      "terminal-product-right-unitor"
    ]);
  });

  it("includes a split-first pairing example", () => {
    const example = proofExamples.find((candidate) => candidate.id === "product-pairing-precompose");

    expect(example?.provesWithTactic).toBe(false);
    expect(example?.goalText).toBe("h >> <f, g> = <h >> f, h >> g>");
  });

  it("includes a terminal product unitor example encoded as an inverse law", () => {
    const example = proofExamples.find((candidate) => candidate.id === "terminal-product-right-unitor");

    expect(example?.provesWithTactic).toBe(false);
    expect(example?.goalText).toBe("iso pi2(P) with <terminalMap(One, A), id(A)>");
    expect(example?.tacticText).toBe("iso");
  });
});
