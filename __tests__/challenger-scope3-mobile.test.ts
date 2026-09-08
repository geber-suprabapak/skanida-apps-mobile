import { listAttendances } from "../utils/bffMobileApi";
import * as bffModule from "../utils/bff";

describe("Scope 3 Mobile Challenger: listAttendances serialization stress test", () => {
  let capturedPaths: string[] = [];

  beforeEach(() => {
    capturedPaths = [];
    jest
      .spyOn(bffModule, "bffRequest")
      .mockImplementation(async (path: string) => {
        capturedPaths.push(path);
        // SAFETY: Test mock for attendance list API response envelope
        return { items: [] } as any;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("serializes camelCase startDate and endDate into dual parameters", async () => {
    await listAttendances({
      startDate: "2026-08-01",
      endDate: "2026-08-28",
    });

    expect(capturedPaths).toHaveLength(1);
    const url = capturedPaths[0];
    expect(url).toContain("startDate=2026-08-01");
    expect(url).toContain("start_date=2026-08-01");
    expect(url).toContain("endDate=2026-08-28");
    expect(url).toContain("end_date=2026-08-28");
  });

  it("serializes snake_case start_date and end_date into dual parameters", async () => {
    await listAttendances({
      start_date: "2026-08-05",
      end_date: "2026-08-20",
    });

    expect(capturedPaths).toHaveLength(1);
    const url = capturedPaths[0];
    expect(url).toContain("startDate=2026-08-05");
    expect(url).toContain("start_date=2026-08-05");
    expect(url).toContain("endDate=2026-08-20");
    expect(url).toContain("end_date=2026-08-20");
  });

  it("serializes single date param", async () => {
    await listAttendances({
      date: "2026-08-28",
    });

    expect(capturedPaths).toHaveLength(1);
    const url = capturedPaths[0];
    expect(url).toBe("/v1/mobile/attendance?date=2026-08-28");
  });

  it("handles empty params cleanly without trailing query mark", async () => {
    await listAttendances();

    expect(capturedPaths).toHaveLength(1);
    expect(capturedPaths[0]).toBe("/v1/mobile/attendance");
  });
});
