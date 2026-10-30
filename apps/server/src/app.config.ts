import { defineRoom, defineServer } from "colyseus";

import { WorldRoom } from "./rooms/WorldRoom";
import { registerProfileAccessRoutes } from "./profile-access-routes";

const app = defineServer({
  rooms: {
    world: defineRoom(WorldRoom),
  },

  express: (expressApp) => {
    registerProfileAccessRoutes(expressApp);
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
