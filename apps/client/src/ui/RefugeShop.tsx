import { REFUGE_SHOP_OFFERS, getPvEArea, shopPurchaseError } from "@digiworld/content";
import type { PlayerView, WorldClient } from "../net/world-client";

export function RefugeShop({client, local}: {client: WorldClient; local: PlayerView}) {
  const inventory = client.inventory;
  const atRefuge = getPvEArea(local.x, local.z).safe && getPvEArea(local.partnerX, local.partnerZ).safe;
  const evolving = client.evolutionPendingUntil > Date.now() || (client.evolutionNotice?.until ?? 0) > Date.now();
  const available = atRefuge && local.hp > 0 && !local.inCombat && !local.duelOpponent && !evolving;
  const pending = client.shopPendingUntil > Date.now();
  const waiting = client.shopReadyAt > Date.now();
  const receipt = client.lastShopPurchase && client.lastShopPurchase.until > Date.now() ? client.lastShopPurchase.data : null;
  return <section className="refuge-shop" aria-label="Tienda del refugio">
    <h3>Tienda del refugio</h3>
    <p data-shop-balance>{inventory.bits} Bits · {inventory.devimonSeals} sellos de Devimon</p>
    <p className="evolution-note">Cada compra entrega el lote indicado. No hay venta de objetos ni intercambio entre jugadores.</p>
    {!client.inventoryLoaded && <p role="status">Recuperando inventario…</p>}
    {!atRefuge ? <p>Vuelve con tu Digimon al Refugio del Inicio para comprar o canjear.</p> : !available && <p>Espera a estar fuera de combate y a que tu Digimon se recupere o termine de evolucionar.</p>}
    {REFUGE_SHOP_OFFERS.map(offer => {
      const error = shopPurchaseError(inventory, offer);
      const price = offer.cost.devimonSeals ? `${offer.cost.devimonSeals} sello de Devimon` : `${offer.cost.bits} Bits`;
      const rewards = [offer.reward.hpPotion && `${offer.reward.hpPotion} ${offer.reward.hpPotion === 1 ? "disco" : "discos"} de vida`, offer.reward.epPotion && `${offer.reward.epPotion} ${offer.reward.epPotion === 1 ? "disco" : "discos"} de energía`, offer.reward.bits && `${offer.reward.bits} Bits`].filter(Boolean).join(" · ");
      return <article className="shop-offer" data-shop-offer={offer.id} key={offer.id}>
        <h4>{offer.name}</h4><p>{rewards}</p>
        <button type="button" data-shop-buy={offer.id} disabled={!client.inventoryLoaded || !available || Boolean(error) || pending || waiting}
          onClick={() => client.buyShopOffer(offer.id)}>
          {pending ? "Procesando…" : waiting ? "Espera un instante…" : `${offer.cost.devimonSeals ? "Canjear" : "Comprar"} por ${price}`}
        </button>
        {error && client.inventoryLoaded && <p className="evolution-note">{error}</p>}
      </article>;
    })}
    {receipt && <p className="shop-receipt" role="status">Compra completada: {receipt.offerName}. Mochila actualizada.</p>}
    <p className="evolution-note">Las compras se guardan con tu partida. Si aparece un error de guardado, no cierres el juego hasta que se confirme.</p>
  </section>;
}
