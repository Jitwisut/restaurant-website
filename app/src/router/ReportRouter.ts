import { Elysia } from "elysia";
import { Reportcontroller } from "../Controller/Reportcontroller";

export const ReportRouter = (app: Elysia) => {
  return app.group("/reports", (app) => {
    app.get("/daily-closing", Reportcontroller.dailyClosing);
    app.get("/daily-closing.csv", Reportcontroller.dailyClosingCsv);
    return app;
  });
};
