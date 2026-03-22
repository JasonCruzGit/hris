import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./createApp.js";

describe("HRIS API", () => {
  const app = createApp();

  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, service: "hris-api" });
  });
});
