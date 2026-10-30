import agumon from "../../assets/sprites/agumon-ds.png";
import koromon from "../../assets/sprites/koromon-ds.png";
import greymon from "../../assets/sprites/greymon-ds.png";
import metalgreymon from "../../assets/sprites/metalgreymon-ds.png";
import wargreymon from "../../assets/sprites/wargreymon-ds.png";
import devimon from "../../assets/sprites/devimon-ds.png";
import tamer from "../../assets/sprites/tamer-ds.png";
import gabumon from "../../assets/sprites/gabumon-ds.png";
import patamon from "../../assets/sprites/patamon-ds.png";
import garurumon from "../../assets/sprites/garurumon-ds.png";
import angemon from "../../assets/sprites/angemon-ds.png";

/** Assets locales recortados de las hojas originales; no requieren peticiones a TSR. */
export const REAL_DS_SPRITES: Record<string, {url: string; sheet: number; credits: string; rows: 5 | 7}> = {
  tamer: {url: tamer, sheet: 48323, credits: "RadSpyro y redblueyellow", rows: 5},
  gabumon: {url: gabumon, sheet: 41249, credits: "redblueyellow", rows: 7},
  patamon: {url: patamon, sheet: 48422, credits: "Mighty Jetters y redblueyellow", rows: 7},
  garurumon: {url: garurumon, sheet: 48583, credits: "RadSpyro", rows: 7},
  angemon: {url: angemon, sheet: 48611, credits: "A.J. Nitro y Dazz", rows: 7},
  devimon: {url: devimon, sheet: 48593, credits: "redblueyellow", rows: 7},
  koromon: {url: koromon, sheet: 20462, credits: "Atlanta", rows: 7},
  agumon: {url: agumon, sheet: 48418, credits: "Mighty Jetters y redblueyellow", rows: 7},
  greymon: {url: greymon, sheet: 48406, credits: "A.J. Nitro y redblueyellow", rows: 7},
  metalgreymon: {url: metalgreymon, sheet: 48322, credits: "RadSpyro", rows: 7},
  wargreymon: {url: wargreymon, sheet: 48613, credits: "A.J. Nitro y redblueyellow", rows: 7},
};
