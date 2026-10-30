import { BITS_LIMIT, INVENTORY_LIMIT } from "./pve";

export interface ShopBalance {bits: number; devimonSeals: number; hpPotion: number; epPotion: number;}
export interface ShopOffer {
  id: string;
  name: string;
  cost: {bits: number; devimonSeals: number};
  reward: {bits: number; hpPotion: number; epPotion: number};
}

export const SHOP_ACTION_INTERVAL_MS = 400;
export const REFUGE_SHOP_OFFERS: readonly ShopOffer[] = [
  {id: "hp-disc", name: "Disco de vida", cost: {bits: 50, devimonSeals: 0}, reward: {bits: 0, hpPotion: 1, epPotion: 0}},
  {id: "ep-disc", name: "Disco de energía", cost: {bits: 40, devimonSeals: 0}, reward: {bits: 0, hpPotion: 0, epPotion: 1}},
  {id: "devimon-supplies", name: "Suministros de las ruinas", cost: {bits: 0, devimonSeals: 1}, reward: {bits: 200, hpPotion: 5, epPotion: 3}},
];

export function getShopOffer(id: unknown): ShopOffer | undefined {
  return typeof id === "string" ? REFUGE_SHOP_OFFERS.find(offer => offer.id === id) : undefined;
}

export function shopBalanceAfter(balance: ShopBalance, offer: ShopOffer): ShopBalance {
  return {
    bits: balance.bits - offer.cost.bits + offer.reward.bits,
    devimonSeals: balance.devimonSeals - offer.cost.devimonSeals,
    hpPotion: balance.hpPotion + offer.reward.hpPotion,
    epPotion: balance.epPotion + offer.reward.epPotion,
  };
}

export function shopPurchaseError(balance: ShopBalance, offer: ShopOffer): string | null {
  if (balance.bits < offer.cost.bits) return "No tienes suficientes Bits.";
  if (balance.devimonSeals < offer.cost.devimonSeals) return "Necesitas un sello de Devimon.";
  const next = shopBalanceAfter(balance, offer);
  if (next.bits > BITS_LIMIT || next.hpPotion > INVENTORY_LIMIT || next.epPotion > INVENTORY_LIMIT) {
    return "No hay espacio para toda la compra. Libera espacio en la mochila.";
  }
  return null;
}
