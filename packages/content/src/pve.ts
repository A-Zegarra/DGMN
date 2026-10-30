export interface PvEArea {
  id: string; name: string; minLevel: number; maxLevel: number; radius: number; color: string; safe: boolean;
}
export const PVE_AREAS: PvEArea[] = [
  {id:"refugio",name:"Refugio del Inicio",minLevel:1,maxLevel:1,radius:16,color:"#73dfb1",safe:true},
  {id:"pradera",name:"Pradera de Datos",minLevel:1,maxLevel:4,radius:32,color:"#b5df83",safe:false},
  {id:"espesura",name:"Espesura Digital",minLevel:5,maxLevel:9,radius:48,color:"#e8c174",safe:false},
  {id:"ruinas",name:"Ruinas Corruptas",minLevel:10,maxLevel:18,radius:100,color:"#b396df",safe:false},
];
export function getPvEArea(x:number,z:number): PvEArea {
  const radius=Math.hypot(x,z);
  return PVE_AREAS.find(area=>radius<=area.radius) ?? PVE_AREAS[3]!;
}
export interface PvESpawn {id:string; species:string; level:number; x:number; z:number; boss?:boolean;}
export const PVE_SPAWNS: PvESpawn[] = [
  {id:"wild-1",species:"agumon",level:1,x:22,z:0},
  {id:"wild-2",species:"agumon",level:1,x:-22,z:0},
  {id:"wild-3",species:"koromon",level:2,x:0,z:24},
  {id:"wild-4",species:"koromon",level:1,x:0,z:-24},
  {id:"wild-5",species:"agumon",level:3,x:24,z:18},
  {id:"wild-6",species:"agumon",level:3,x:-24,z:-18},
  {id:"wild-7",species:"agumon",level:4,x:-18,z:24},
  {id:"wild-8",species:"koromon",level:2,x:18,z:-24},
  {id:"wild-9",species:"greymon",level:7,x:-38,z:10},
  {id:"wild-10",species:"greymon",level:8,x:38,z:-10},
  {id:"wild-11",species:"agumon",level:5,x:-10,z:-39},
  {id:"wild-12",species:"agumon",level:5,x:10,z:39},
  {id:"wild-13",species:"agumon",level:6,x:-30,z:30},
  {id:"wild-14",species:"agumon",level:6,x:30,z:-30},
  {id:"wild-15",species:"greymon",level:10,x:50,z:16},
  {id:"wild-16",species:"greymon",level:11,x:-50,z:-16},
  {id:"wild-17",species:"metalgreymon",level:13,x:-43,z:38},
  {id:"wild-18",species:"metalgreymon",level:12,x:40,z:-43},
  {id:"wild-19",species:"metalgreymon",level:17,x:-52,z:42},
  {id:"wild-20",species:"greymon",level:16,x:52,z:-42},
  {id:"boss-devimon",species:"devimon",level:14,x:44,z:44,boss:true},
];
export const DEVIMON_CAST_RANGE=7;
export const ITEM_COOLDOWN_MS=8000;
export const INVENTORY_LIMIT=999;
export const BITS_LIMIT=1000000;
export const CONSUMABLES = {
  hp_potion:{name:"Disco de vida",icon:"💚",description:"Recupera un 35% de HP máximo + 20 HP del compañero."},
  ep_potion:{name:"Disco de energía",icon:"🔋",description:"Recupera un 35% de EP máximo + 10 EP del compañero."},
};
export type ConsumableId=keyof typeof CONSUMABLES;
export interface LootRoll {bits:number;hpPotion:number;epPotion:number;devimonSeals:number;}
export function rollPvELoot(level:number,boss:boolean,random:()=>number=Math.random):LootRoll {
  return boss ? {bits:500,hpPotion:2,epPotion:2,devimonSeals:1} : {
    bits:10+level*8,hpPotion:random()<0.4?1:0,epPotion:random()<0.25?1:0,devimonSeals:0,
  };
}
export function wildXp(level:number,boss:boolean) {return boss?1000:40+level*30;}
