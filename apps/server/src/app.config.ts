import { defineRoom, defineServer } from "colyseus";

import { WorldRoom } from "./rooms/WorldRoom";

const app = defineServer({
  rooms: {
    world: defineRoom(WorldRoom),
  },

  express: (expressApp) => {
    expressApp.get("/health", (_req, res) => {
      res.json({
        ok: true,
        service: "digiworld-server",
        zone: "bosque-digital",
        uptime: process.uptime(),
      });
    });
  },
});

export default app;
