# Combate del Digimon

El domador y el compañero tienen posiciones distintas. El servidor sincroniza
`partnerX`, `partnerZ`, `partnerRot` y `partnerMoving`; HP/EP del estado del
jugador representan **al compañero**, no al domador. Se mantienen los nombres
de los campos para no duplicar progresión, regeneración, niveles y duelos.

- Seleccionar un salvaje da al Digimon una orden de aproximación/autoataque.
- Una habilidad pendiente espera a que el compañero entre en alcance; no
  desplaza al domador. Mover al domador o Escape cancela la habilidad pendiente.
- Correa de mando: objetivo a un máximo de 20 m del domador, validada también
  en el servidor. Para enemigos lejanos hay que acercar al domador manualmente.
- Los alcances PvE/PvP, aggro y persecución se calculan con la posición del
  compañero. Las invitaciones a duelo siguen midiendo distancia entre domadores.
- El compañero pierde HP, consume EP, recibe curación y se debilita; el domador
  puede moverse mientras su Digimon se recupera (3,5 s).
- Los efectos nacen y terminan en los Digimon: proyectil, impacto, partículas,
  números de daño/curación, KO y subida de nivel. Los golpes básicos y habilidades
  se comunican a todos los clientes para que los espectadores vean el combate.
- Agumon usa poses recortadas de la hoja original más sacudida, avance y tinte
  de daño. Los demás sprites provisionales usan avance, sacudida y tintes.
- La cámara amplía suavemente el encuadre del equipo durante el combate sin
  activar fijación automática sobre enemigos.

## Comprobaciones

`pnpm --filter @digiworld/server exec tsx test/partner-combat.ts`

Prueba directamente la lógica autoritativa: rango desde el compañero (también
cuando el domador está fuera de rango), recargas, EP, curación, PvP, correa,
aggro/persecución, separación de movimiento y recuperación.

`node scripts/test-partner-combat.cjs` (Puppeteer disponible en NODE_PATH)

Con cliente y servidor activos comprueba que el domador permanece quieto
mientras el Digimon ataca/recibe golpes y activa las animaciones. Variables
opcionales: `GAME_URL`, `CHROME_PATH` y `SCREENSHOT_PATH`.

`node scripts/test-partner-server.cjs` verifica el mismo flujo por WebSocket,
incluida la versión pública (`GAME_URL=https://digiworld.aliproinv.com`), sin
exponer herramientas de depuración en producción.
