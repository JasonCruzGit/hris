import "dotenv/config";
import cors from "cors";
import { uploadsRoot } from "./lib/uploadsRoot.js";
import express from "express";
import helmet from "helmet";
import { authRouter } from "./routes/auth.js";
import { employeesRouter } from "./routes/employees.js";
import { orgRouter } from "./routes/org.js";
import { attendanceRouter } from "./routes/attendance.js";
import { leaveRouter } from "./routes/leave.js";
import { payrollRouter } from "./routes/payroll.js";
import { recruitmentRouter } from "./routes/recruitment.js";
import { publicRecruitmentRouter } from "./routes/public-recruitment.js";
import { performanceRouter } from "./routes/performance.js";
import { trainingRouter } from "./routes/training.js";
import { notificationsRouter } from "./routes/notifications.js";
import { reportsRouter } from "./routes/reports.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { auditRouter } from "./routes/audit.js";
import { cronRouter } from "./routes/cron.js";
import { employeePortalRouter } from "./routes/employee-portal.js";
import { documentRequestsRouter } from "./routes/document-requests.js";
import { messagesRouter } from "./routes/messages.js";
import { announcementsRouter } from "./routes/announcements.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:5173"],
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.use("/uploads", express.static(uploadsRoot()));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "hris-api" });
  });

  app.use("/api/recruitment/public", publicRecruitmentRouter);

  app.use("/api/auth", authRouter);
  app.use("/api/employee", employeePortalRouter);
  app.use("/api/document-requests", documentRequestsRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/announcements", announcementsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/org", orgRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/leave", leaveRouter);
  app.use("/api/payroll", payrollRouter);
  app.use("/api/recruitment", recruitmentRouter);
  app.use("/api/performance", performanceRouter);
  app.use("/api/training", trainingRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/cron", cronRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}
