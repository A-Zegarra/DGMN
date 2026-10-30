import express, {type Application, type Request, type Response} from "express";
import { isIP } from "node:net";
import { getProfileAccess, ProfileAccessError } from "./storage/profile-access";
import { ProfileAccessConflict } from "./storage/profile-store";

// /room ya está encaminado al juego por el túnel; no toca otros túneles ni apps.
export const PROFILE_IMPORT_PATH = "/room/profile-access/redeem";
export class AccessLimiter {
  private ips = new Map<string,{count:number;until:number}>();
  private global = {count:0,until:0};
  constructor(private now=()=>Date.now()) {}
  take(ip: string): boolean {
    const now=this.now();
    for(const [key,bucket] of this.ips)if(bucket.until<=now)this.ips.delete(key);
    if(this.global.until<=now)this.global={count:0,until:now+60000};
    let bucket=this.ips.get(ip);
    if(!bucket){if(this.ips.size>=4096)return false;bucket={count:0,until:now+60000};this.ips.set(ip,bucket);}
    if(bucket.count>=10||this.global.count>=120)return false;
    bucket.count++;this.global.count++;return true;
  }
}
function peerIP(req: Request): string {
  const remote=req.socket.remoteAddress??"unknown";
  // Solo confiar en Cloudflare cuando el par real es el túnel local.
  const forwarded=req.get("CF-Connecting-IP");
  return ["127.0.0.1","::1","::ffff:127.0.0.1"].includes(remote)&&forwarded&&isIP(forwarded)?forwarded:remote;
}
function allowedOrigin(origin: string): boolean {
  const extra=(process.env.DIGIWORLD_ALLOWED_ORIGINS??"").split(",").map(value=>value.trim());
  return ["https://digiworld.aliproinv.com","http://100.116.141.27:8080","http://100.84.154.39:5173"].includes(origin)||extra.includes(origin)||
    (process.env.NODE_ENV!=="production"&&/^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(origin));
}
export function registerProfileAccessRoutes(app: Application, service=()=>getProfileAccess(), limiter=new AccessLimiter()) {
  app.all(PROFILE_IMPORT_PATH,(req,res,next)=>{
    res.set({"Cache-Control":"no-store, private","Pragma":"no-cache","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});
    res.vary("Origin");
    const origin=req.get("Origin");
    if(origin&&!allowedOrigin(origin)){res.status(403).json({error:"Origen no permitido."});return;}
    if(origin)res.set("Access-Control-Allow-Origin",origin);
    if(req.method==="OPTIONS"){
      res.set({"Access-Control-Allow-Methods":"POST","Access-Control-Allow-Headers":"Content-Type"});res.status(204).end();return;
    }
    if(req.method!=="POST"){res.set("Allow","POST").status(405).json({error:"Método no permitido."});return;}
    if(!limiter.take(peerIP(req))){res.set("Retry-After","60").status(429).json({error:"Demasiados intentos. Espera un minuto y vuelve a intentarlo."});return;}
    if(!req.is("application/json")){res.status(415).json({error:"Se requiere JSON."});return;}
    next();
  });
  app.post(PROFILE_IMPORT_PATH,express.json({limit:"2kb",strict:true}),async(req,res)=>{
    try {
      if(Buffer.byteLength(JSON.stringify(req.body)??"")>2048)throw new ProfileAccessError("Solicitud de acceso demasiado grande.");
      const profile=await service().redeem(req.body);
      res.json({profile});
    }catch(error){
      if(error instanceof ProfileAccessError)res.status(error.status).json({error:error.message});
      else if(error instanceof ProfileAccessConflict)res.status(409).json({error:error.message});
      else res.status(503).json({error:"No se pudo confirmar el acceso en disco. Conserva este navegador y reintenta."});
    }
  });
  // No devolver ni registrar el cuerpo de solicitudes malformadas (puede incluir secretos).
  app.use(PROFILE_IMPORT_PATH,(_error: unknown,_req: Request,res: Response,_next: unknown)=>{
    res.status(400).json({error:"Solicitud de acceso inválida o demasiado grande."});
  });
}
