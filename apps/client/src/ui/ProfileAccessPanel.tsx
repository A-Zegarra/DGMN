import { useEffect, useState } from "react";
import type { WorldClient } from "../net/world-client";

function PrivateCode({code,label}:{code:string;label:string}) {
  const [message,setMessage]=useState("");
  return <div className="private-code">
    <output aria-label={label} autoCapitalize="characters">{code}</output>
    <button type="button" onClick={async()=>{
      try{await navigator.clipboard.writeText(code);setMessage("Copiado. Pégalo solo en tu otro dispositivo o en un lugar privado.");}
      catch{setMessage("Selecciona el código y cópialo manualmente.");}
    }}>Copiar código</button>
    {message&&<p role="status">{message}</p>}
  </div>;
}

export function ProfileAccessPanel({client}:{client:WorldClient}) {
  const [confirmRecovery,setConfirmRecovery]=useState(false),[confirmRevoke,setConfirmRevoke]=useState(false);
  useEffect(()=>()=>{client.profileRecoveryCode=null;client.profileLink=null;},[client]);
  const pending=client.profileAccessPendingUntil>Date.now();
  const cooldown=Math.max(0,client.profileAccessReadyAt-Date.now());
  const disabled=!client.profilePersistent||pending||cooldown>0;
  const link=client.profileLink&&client.profileLink.expiresAt>Date.now()?client.profileLink:null;
  return <section className="profile-access-panel" aria-label="Partida y dispositivos">
    <h3>Tu partida en PC y Android</h3>
    <p>Los dispositivos vinculados usan la misma partida del servidor. Solo uno puede jugar a la vez.</p>
    <p className="access-warning">Los códigos dan acceso a tu partida. No los pongas en el chat, capturas públicas ni enlaces.</p>
    <article className="access-card">
      <h4>Vincular otro dispositivo</h4>
      <ol><li>Genera un código aquí.</li><li>En el otro dispositivo, abre el inicio del juego y pulsa «Vincular o recuperar partida».</li><li>Pega el código. Después guarda y sal de este dispositivo antes de jugar allí.</li></ol>
      <p>No se reemplazan ni se fusionan partidas: usa un navegador de destino sin partida guardada.</p>
      <button type="button" data-access-action="link" disabled={disabled} onClick={()=>client.requestProfileAccess("link")}>Generar código de vinculación</button>
      {link&&<><PrivateCode key={link.code} code={link.code} label="Código de vinculación"/><p>Un solo uso · caduca en {Math.ceil((link.expiresAt-Date.now())/1000)} s.</p>
        <button type="button" disabled={pending} data-access-action="cancel_link" onClick={()=>client.requestProfileAccess("cancel_link")}>Cancelar código</button></>}
    </article>
    <article className="access-card">
      <h4>Clave de recuperación</h4>
      <p>Guárdala fuera del navegador, por ejemplo en tu gestor de contraseñas. Sirve una sola vez si pierdes el acceso a tus dispositivos. Crear otra invalida la anterior.</p>
      <label className="access-confirm"><input type="checkbox" data-access-confirm="recovery" checked={confirmRecovery} onChange={e=>setConfirmRecovery(e.target.checked)}/> Entiendo que reemplazará la clave de recuperación anterior.</label>
      <button type="button" data-access-action="recovery" disabled={disabled||!confirmRecovery} onClick={()=>{setConfirmRecovery(false);client.requestProfileAccess("recovery");}}>Crear clave de recuperación</button>
      {client.profileRecoveryCode&&<><PrivateCode key={client.profileRecoveryCode} code={client.profileRecoveryCode} label="Clave de recuperación"/><p>Solo se muestra ahora. Cópiala antes de cerrar esta pestaña.</p>
        <button type="button" onClick={()=>{client.profileRecoveryCode=null;setConfirmRecovery(false);}}>Ocultar clave</button></>}
    </article>
    <article className="access-card">
      <h4>Desvincular otros dispositivos</h4>
      <p>Conserva únicamente este navegador. Los otros accesos, códigos de vinculación y la clave de recuperación anteriores dejarán de servir. No borra tu progreso.</p>
      <label className="access-confirm"><input type="checkbox" data-access-confirm="revoke_others" checked={confirmRevoke} onChange={e=>setConfirmRevoke(e.target.checked)}/> Quiero conservar solo este dispositivo y generar después otra clave de recuperación.</label>
      <button type="button" data-access-action="revoke_others" disabled={disabled||!confirmRevoke} onClick={()=>{setConfirmRevoke(false);client.requestProfileAccess("revoke_others");}}>Desvincular los demás</button>
    </article>
    {pending&&<p role="status">Confirmando la operación en el servidor…</p>}
    {!pending&&cooldown>0&&<p>Espera {Math.ceil(cooldown/1000)} s antes de otra acción.</p>}
    {client.profileAccessMessage&&<p role="status">{client.profileAccessMessage}</p>}
    {client.profileAccessError&&<p role="alert" className="form-error">{client.profileAccessError}</p>}
    {client.profileSaveError&&<p role="alert" className="form-error">{client.profileSaveError}</p>}
  </section>;
}
