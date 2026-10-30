# Digievolución

La selección inicial ofrece **Koromon** por defecto. Agumon sigue disponible
como inicio rápido, junto a Gabumon y Patamon.

| Desde | Hacia | Nivel mínimo |
|---|---|---|
| Koromon | Agumon | 5 |
| Agumon | Greymon | 8 |
| Greymon | MetalGreymon | 14 |
| MetalGreymon | WarGreymon | 20 |

El nivel máximo actual es 20. Ganar XP no transforma automáticamente al
compañero: abre **Evolución**, revisa estadísticas/habilidades y confirma.

## Reglas autoritativas

- El servidor valida el nivel real y la transición de la especie actual. No
  acepta saltos de etapa, repetir una evolución ni retroceder.
- No se permite evolucionar debilitado, en combate o con invitación de duelo.
- La transformación dura 3 s; durante ella no se puede atacar, volver a
  evolucionar ni recibir invitaciones de duelo. Se evitan nuevos aggro durante
  esos segundos para no iniciar una pelea mientras las habilidades se bloquean.
- Conserva nivel, XP, posición del compañero y porcentaje de HP/EP. Las máximas
  se recalculan desde la nueva especie + bonos del nivel (8 HP y 3 EP por nivel
  adicional), sin sumar dos veces los bonos.
- Cada etapa tiene tres habilidades. Las nuevas sustituyen a las anteriores;
  se limpian órdenes pendientes y recargas de la etapa previa.
- La especie y el evento de digievolución se sincronizan con todos los jugadores.
- La evolución se guarda en disco en el servidor, junto con el nivel y la XP.
  Se recupera usando la clave privada de este navegador; consulta `guardado.md`.

## Habilidades nuevas

- Koromon: Burbujas Ácidas, Salto Burbuja, Recuperación Inicial.
- MetalGreymon: Giga Destructor, Brazo Tridente, Llama Nuclear.
- WarGreymon: Fuerza de Gaia, Garras Dramon, Tornado Valiente.

## Arte

Toda la línea usa ahora hojas originales de Digimon World DS. Las hojas de
Koromon, Greymon, MetalGreymon y WarGreymon fueron proporcionadas por el usuario
en `MODELOS DE SPRITES/`. `python scripts/prepare-evolution-sprites.py` genera
sus atlas sin modificar los originales. La procedencia, créditos y hashes están
en `art-source/ds-sheets/evolution-provenance.json`. No todas las hojas tienen
ocho direcciones completas; se reutilizan o reflejan las vistas disponibles.
La cámara adapta el encuadre al tamaño y la digievolución tiene pulso de escala,
tinte dorado, anillo, partículas y aviso en pantalla.

## Pruebas

```bash
pnpm --filter @digiworld/server exec tsx test/evolution.ts
pnpm --filter @digiworld/server exec tsx test/evolution-network.ts
node scripts/test-evolution-ui.cjs
```

La primera recorre la línea subiendo niveles con XP y verifica rechazos y stats.
La segunda crea una sala temporal aislada en el puerto 2588, sin salvajes y con
un compañero de nivel 20 exclusivamente para pruebas, y verifica las cuatro
evoluciones a través de WebSocket, cerrando el servidor al terminar. Esta sala
no está registrada en la aplicación ni se publica en producción.
La tercera verifica Koromon inicial, requisitos, interfaz adaptable y rechazo
de nivel falsificado en el cliente de desarrollo. Requiere puppeteer-core en
NODE_PATH y el cliente/servidor locales activos. `GAME_URL` permite comprobar
la UI desplegada sin habilitar depuración en producción.
