import { createApp } from "./createApp.js";

const PORT = Number(process.env.PORT ?? 4000);
const app = createApp();

if (!process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`HRIS API listening on http://localhost:${PORT}`);
  });
}

export { app };
