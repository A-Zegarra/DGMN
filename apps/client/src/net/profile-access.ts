import { SPECIES } from "@digiworld/content";
import type { ProfileImportRequest, SavedProfileSummary } from "@digiworld/shared/messages";
import { applyImportedProfile, createProfileToken, getProfileToken, getSavedProfile } from "./profile";

const SERVER_URL=import.meta.env.VITE_SERVER_URL??"http://localhost:2567";
const PENDING_KEY="digiworld:pending-profile-link:v1";
class ImportError extends Error { constructor(message:string,readonly status:number){super(message);} }

async function requestAccess(request: ProfileImportRequest): Promise<SavedProfileSummary> {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(new URL("/room/profile-access/redeem",SERVER_URL),{
      method:"POST",credentials:"omit",cache:"no-store",signal:controller.signal,
      headers:{"Content-Type":"application/json"},body:JSON.stringify(request),
    });
    const data=await response.json();
    if(!response.ok)throw new ImportError(typeof data.error==="string"?data.error:"No se pudo confirmar el acceso.",response.status);
    const p=data.profile;
    if(!p||typeof p.name!=="string"||!Object.hasOwn(SPECIES,p.species)||!Number.isInteger(p.level)||p.level<1||p.level>20||
      ![p.xp,p.xpNext,p.duelWins,p.duelLosses,p.updatedAt].every(value=>typeof value==="number"&&Number.isFinite(value)))throw new Error("Respuesta de acceso inválida.");
    return p as SavedProfileSummary;
  }finally{clearTimeout(timer);}
}

export async function importProfileAccess(mode:"link"|"recovery",code:string): Promise<SavedProfileSummary> {
  if(getSavedProfile())throw new Error("Este navegador ya tiene una partida. No se reemplaza ni se fusiona; usa otro perfil de navegador sin partida.");
  const active=getProfileToken();
  let pending:{token:string;previousToken:string}|null=null;
  try{
    pending=JSON.parse(localStorage.getItem(PENDING_KEY)??"null");
    if(pending&&(!/^[a-f0-9]{64}$/.test(pending.token)||!/^[a-f0-9]{64}$/.test(pending.previousToken)))throw new Error("invalid");
  }catch{throw new Error("No se pudo leer el acceso pendiente. Conserva este navegador y vuelve a intentarlo.");}
  let profile:SavedProfileSummary|undefined;
  if(pending){
    if(active!==pending.previousToken&&active!==pending.token)throw new Error("Este navegador cambió de acceso. No se reemplazará su partida.");
    try{profile=await requestAccess({mode:"resume",...pending});}
    catch(error){if(!(error instanceof ImportError)||error.status!==400)throw error;}
  }else{
    pending={token:createProfileToken(),previousToken:active};
    try{localStorage.setItem(PENDING_KEY,JSON.stringify(pending));}
    catch{throw new Error("Permite el almacenamiento del navegador antes de vincular. No se cambió tu acceso.");}
  }
  profile??=await requestAccess({mode,code,...pending});
  // Guardar primero el candidato permite retomar una respuesta perdida o un
  // fallo local sin volver a gastar el código ni conocer la clave del origen.
  try{applyImportedProfile(pending.token,profile);}
  catch{throw new Error("El servidor confirmó el acceso, pero no se pudo terminar el guardado local. Conserva este navegador, permite su almacenamiento y reintenta.");}
  try{localStorage.removeItem(PENDING_KEY);}catch{ /* La credencial activa ya quedó guardada. */ }
  return profile;
}
