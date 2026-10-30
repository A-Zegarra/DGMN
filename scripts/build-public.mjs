import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");

const build = spawnSync(
  "pnpm",
  ["--filter", "@digiworld/client", "build"],
  {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      VITE_SERVER_URL: "https://digiworld.aliproinv.com",
    },
  },
);

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

// Solo sprites DS: no empaquetar ningún modelo de personaje ni sprites privados.
rmSync(resolve(root, "apps/client/dist/sprites"), {
  recursive: true,
  force: true,
});
rmSync(resolve(root, "apps/client/dist/models"), { recursive: true, force: true });

console.log(
  "Build público listo: solo sprites DS. Se excluyeron modelos 3D y sprites privados de dist/.",
);
