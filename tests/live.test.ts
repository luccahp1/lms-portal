import { describe, expect, it } from "vitest";
import { closeAllStreams, trackStream } from "@/lib/live/hub";

describe("live streams on shutdown", () => {
  it("closes every open stream once and forgets closed ones", () => {
    const closed: string[] = [];
    const untrackA = trackStream(() => {
      closed.push("a");
      untrackA();
    });
    const untrackB = trackStream(() => closed.push("b"));
    untrackB(); // the browser left before shutdown
    closeAllStreams();
    closeAllStreams();
    expect(closed).toEqual(["a"]);
  });
});
