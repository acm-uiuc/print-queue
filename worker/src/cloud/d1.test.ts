import { describe, expect, it } from "vitest";
import { applyDeviceStatus, type JobState } from "./d1";

describe("device status transitions", () => {
  it.each(["completed", "failed"] satisfies JobState[])(
    "ignores a duplicate terminal status for a %s job",
    async (storedStatus) => {
      const statements: string[] = [];
      const db = {
        prepare(sql: string) {
          statements.push(sql);
          return {
            bind() {
              return this;
            },
            async first() {
              return { status: storedStatus };
            },
          };
        },
      } as unknown as D1Database;

      const transition = await applyDeviceStatus(
        db,
        "office-main",
        {
          state: "completed",
          jobId: "019-job",
          failureCode: "",
          failureMessage: "",
        },
        1_700_000_000_000,
      );

      expect(transition).toBe("ignored");
      expect(statements).toHaveLength(1);
    },
  );
});
