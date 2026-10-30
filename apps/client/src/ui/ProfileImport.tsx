import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SavedProfileSummary } from "@digiworld/shared/messages";
import { importProfileAccess } from "../net/profile-access";

export function ProfileImport({hasSaved,disabled,onImported}:{hasSaved:boolean;disabled:boolean;onImported:(profile:SavedProfileSummary)=>void}) {
  const [open,setOpen]=useState(false),[mode,setMode]=useState<"link"|"recovery">("link"),[code,setCode]=useState("");
  const [pending,setPending]=useState(false),[error,setError]=useState<string|null>(null);
  const dialogRef=useRef<HTMLElement>(null),triggerRef=useRef<HTMLButtonElement>(null);
  const pendingRef=useRef(pending);pendingRef.current=pending;
  useEffect(()=>{
    if(!open)return;
    const trap=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&!pendingRef.current){setOpen(false);return;}
      if(event.key!=="Tab")return;
      const dialog=dialogRef.current;
      const controls=[...dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')??[]].filter(e=>e.tabIndex>=0&&e.getClientRects().length>0);
      if(!controls.length){event.preventDefault();dialog?.focus();return;}
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&(document.activeElement===first||!dialog?.contains(document.activeElement))){event.preventDefault();last?.focus();}
      if(!event.shiftKey&&(document.activeElement===last||!dialog?.contains(document.activeElement))){event.preventDefault();first?.focus();}
    };
    window.addEventListener("keydown",trap,true);
    return()=>{window.removeEventListener("keydown",trap,true);triggerRef.current?.focus();};
  },[open]);
  useEffect(()=>{if(open&&pending)dialogRef.current?.focus();},[open,pending]);
  return <>
    <button ref={triggerRef} type="button" className="profile-import-toggle" disabled={disabled} onClick={()=>{setError(null);setCode("");setOpen(true);}}>Vincular o recuperar partida</button>
    {open&&createPortal(<div className="evolution-overlay"><section ref={dialogRef} tabIndex={-1} className="evolution-dialog panel profile-import-dialog" role="dialog" aria-modal="true" aria-label="Vincular o recuperar partida">
      <header><h2>Continuar en este dispositivo</h2><button type="button" aria-label="Cerrar vinculación" disabled={pending} autoFocus onClick={()=>setOpen(false)}>×</button></header>
      {hasSaved?<p role="alert">Este navegador ya tiene una partida. No se reemplaza ni se fusiona; usa otro perfil de navegador sin partida para conservar ambos progresos.</p>:<form onSubmit={async event=>{
        event.preventDefault();if(pending)return;setPending(true);setError(null);
        try{const profile=await importProfileAccess(mode,code);onImported(profile);setCode("");setOpen(false);}
        catch(reason){setError(reason instanceof Error&&reason.name!=="AbortError"&&!(reason instanceof TypeError)?reason.message:"No se pudo confirmar la vinculación. Conserva este navegador y reintenta; no se gastará el código dos veces.");}
        finally{setPending(false);}
      }}>
        <p>No necesitas copiar la clave privada del otro navegador. Solo usa un código generado en tu propia partida.</p>
        <label className="field"><span>Tipo de acceso</span><select aria-label="Tipo de acceso" value={mode} disabled={pending} onChange={e=>{setMode(e.target.value as "link"|"recovery");setCode("");setError(null);}}>
          <option value="link">Código de vinculación (5 minutos)</option><option value="recovery">Clave de recuperación guardada</option>
        </select></label>
        <label className="field"><span>{mode==="link"?"Código de vinculación":"Clave de recuperación"}</span><input type={mode==="recovery"?"password":"text"} aria-label={mode==="link"?"Código de vinculación":"Clave de recuperación"} value={code} onChange={e=>setCode(e.target.value)} maxLength={100} autoCapitalize="characters" autoComplete="off" spellCheck={false} disabled={pending}/></label>
        <p className="evolution-note">Un solo uso. El progreso no se copia: ambos dispositivos acceden al mismo perfil. Guarda y sal del dispositivo anterior antes de jugar aquí.</p>
        <button type="submit" className="profile-import-submit" disabled={pending||!code.trim()}>{pending?"Confirmando acceso…":"Vincular esta partida"}</button>
        {error&&<p role="alert" className="form-error">{error}</p>}
      </form>}
    </section></div>,document.body)}
  </>;
}
