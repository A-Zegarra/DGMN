import fs from "node:fs";

const sheets = [
  ["koromon", 19, 20462],
  ["tamer", 45, 48323],
  ["agumon", 45, 48418],
  ["gabumon", 38, 41249],
  ["patamon", 45, 48422],
  ["greymon", 45, 48406],
  ["metalgreymon", 45, 48322],
  ["wargreymon", 46, 48613],
  ["garurumon", 46, 48583],
  ["angemon", 46, 48611],
];

fs.mkdirSync("art-source/ds-sheets", { recursive: true });

for (const [name, folder, id] of sheets) {
  const requested = process.argv.slice(2);
  if (requested.length && !requested.includes(name)) continue;
  if (fs.existsSync(`art-source/ds-sheets/${name}_raw.png`)) continue;
  const urls = [
    `https://web.archive.org/web/2024im_/https://www.spriters-resource.com/download/${id}/`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        },
      });
      const ct = res.headers.get("content-type") || "";
      console.log(name, res.status, ct, url);
      if (res.status === 429) {
        console.error("Límite de solicitudes alcanzado. Descarga detenida; inténtalo más tarde.");
        process.exitCode = 1;
        break;
      }
      if (res.ok && ct.includes("image")) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(`art-source/ds-sheets/${name}_raw.png`, buf);
        console.log("SAVED", name, buf.length);
        break;
      }
    } catch (err) {
      console.log(name, "ERR", err.message);
    }
  }
  if (process.exitCode) break;
}
