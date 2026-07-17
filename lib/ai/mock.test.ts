import { describe, it, expect } from "vitest";
import { MockProvider } from "./mock";
import { overviewSchema } from "@/engine/prompts/overview";

describe("MockProvider", () => {
  it("synthesizes schema-valid output (validates prompt schema + mock synth)", async () => {
    const result = await new MockProvider().generateJSON({
      system: "s",
      prompt: "p",
      schema: overviewSchema,
    });
    expect(overviewSchema.safeParse(result).success).toBe(true);
  });
});
