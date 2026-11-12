import { kvGet, kvSet, registerKvMigration } from "./kv-db";
import type {
  ShoppingAddress,
  ShoppingCategory,
  ShoppingCurrency,
  ShoppingProduct,
  ShoppingSearchResult,
  ShoppingShippingEvent,
  ShoppingState,
  WarehouseItem,
} from "./shopping-types";
import {
  DEFAULT_DELIVERY_REFRESH_PROMPT,
  DEFAULT_SHOPPING_REFRESH_PROMPT,
  DEFAULT_SHOPPING_SEARCH_PROMPT,
  DELIVERY_CATEGORIES,
  SHOPPING_RECOMMENDATION_CATEGORIES,
} from "./shopping-engine";

const SHOPPING_STATE_KEY = "ai_phone_shopping_state_v1";
export const SHOPPING_STATE_UPDATED_EVENT = "shopping-state-updated";
const DEFAULT_DELIVERY_MIN_MINUTES = 60;
const DEFAULT_DELIVERY_MAX_MINUTES = 180;

registerKvMigration(SHOPPING_STATE_KEY);

export const DEFAULT_SHOPPING_CURRENCIES: ShoppingCurrency[] = [
  { id: "c_cn", regionCode: "CN", regionName: "中国大陆", currencyCode: "CNY", symbol: "¥", exchangeRate: 1.0 },
  { id: "c_us", regionCode: "US", regionName: "美国", currencyCode: "USD", symbol: "$", exchangeRate: 0.14 },
  { id: "c_hk", regionCode: "HK", regionName: "中国香港", currencyCode: "HKD", symbol: "HK$", exchangeRate: 1.08 },
  { id: "c_kr", regionCode: "KR", regionName: "韩国", currencyCode: "KRW", symbol: "₩", exchangeRate: 190.0 },
  { id: "c_jp", regionCode: "JP", regionName: "日本", currencyCode: "JPY", symbol: "円", exchangeRate: 21.5 },
  { id: "c_eu", regionCode: "EU", regionName: "欧洲地区", currencyCode: "EUR", symbol: "€", exchangeRate: 0.13 },
];

export const DEFAULT_SHOPPING_ADDRESSES: ShoppingAddress[] = [
  { id: "addr_default", name: "我", phone: "13800000000", region: "东湾都会圈 · 中央区", detail: "湾港大道 88 号云湾高地 A 座 1202", isDefault: true },
];

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function normalizeArray<T>(value: unknown, guard: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(guard).filter((item): item is T => Boolean(item)) : [];
}

function normalizeRefreshPrompt(value: unknown): string {
  const prompt = cleanText(value, 16000);
  if (!prompt) return DEFAULT_SHOPPING_REFRESH_PROMPT;
  return prompt;
}

function normalizeDeliveryRefreshPrompt(value: unknown): string {
  const prompt = cleanText(value, 16000);
  if (!prompt) return DEFAULT_DELIVERY_REFRESH_PROMPT;
  return prompt;
}

function normalizeSearchPrompt(value: unknown): string {
  return cleanText(value, 16000) || DEFAULT_SHOPPING_SEARCH_PROMPT;
}

function normalizeDeliveryMinutes(value: unknown, fallback: number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.min(10080, Math.max(1, Math.round(amount)));
}

function normalizeProduct(value: unknown): ShoppingProduct | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = cleanText(record.id, 180);
  const title = cleanText(record.title, 200);
  const merchantLabel = cleanText(record.merchantLabel, 120);
  const priceLabel = cleanText(record.priceLabel, 80);
  const previewIcon = cleanText(record.previewIcon, 8);
  const rawTone = record.tone;
  const tone = rawTone === "mist" || rawTone === "blush" || rawTone === "graphite" ? rawTone : "ivory";
  const kind = record.kind === "delivery" ? "delivery" : "shopping";
  if (!id || !title || !merchantLabel || !priceLabel || !previewIcon) return null;
  const subtitle = cleanText(record.subtitle, 400);
  const detail = cleanText(record.detail, 1200);
  return {
    id,
    title,
    merchantLabel,
    priceLabel,
    tagLabel: cleanText(record.tagLabel, 80) || (kind === "delivery" ? "外卖" : "商品"),
    subtitle: subtitle || detail || title,
    detail: detail || subtitle || title,
    previewIcon,
    tone,
    kind,
    estimatedDeliveryMinutes: typeof record.estimatedDeliveryMinutes === "number" ? record.estimatedDeliveryMinutes : (kind === "delivery" ? 30 : undefined),
    packingFee: typeof record.packingFee === "number" ? record.packingFee : (kind === "delivery" ? 2 : 0),
  };
}

function normalizeCategory(value: unknown, isDelivery = false): ShoppingCategory | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = cleanText(record.title, 80);
  const templateList = isDelivery ? DELIVERY_CATEGORIES : SHOPPING_RECOMMENDATION_CATEGORIES;
  const template = templateList.find(category => category.title === title);
  const items = normalizeArray(record.items, normalizeProduct).slice(0, 16);
  if (!title || items.length === 0) return null;
  return {
    id: cleanText(record.id, 80) || template?.id || title,
    title,
    subtitle: cleanText(record.subtitle, 160) || template?.subtitle || "",
    items,
  };
}

function normalizeCartItem(value: unknown): ShoppingState["cartItems"][number] | null {
  const product = normalizeProduct(value);
  if (!product || !value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    ...product,
    kind: product.kind || (record.kind === "delivery" ? "delivery" : "shopping"),
    tagLabel: product.tagLabel || "购物车",
    quantityLabel: cleanText(record.quantityLabel, 40) || "x 1",
  };
}

function normalizeShippingEvent(value: unknown): ShoppingShippingEvent | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const status = cleanText(record.status, 40);
  if (status !== "ordered" && status !== "shipped" && status !== "delivering" && status !== "delivered") return null;
  const timestamp = cleanText(record.timestamp, 80);
  const time = new Date(timestamp);
  if (!timestamp || Number.isNaN(time.getTime())) return null;
  return {
    status,
    label: cleanText(record.label, 80) || "物流更新",
    timeLabel: cleanText(record.timeLabel, 80) || time.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    timestamp,
  };
}

function normalizeOrder(value: unknown): ShoppingState["orders"][number] | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = cleanText(record.id, 180);
  const statusLabel = cleanText(record.statusLabel, 80);
  const timeLabel = cleanText(record.timeLabel, 80);
  const totalLabel = cleanText(record.totalLabel, 80);
  const merchantLabel = cleanText(record.merchantLabel, 120);
  const summary = cleanText(record.summary, 400);
  const items = normalizeArray(record.items, normalizeCartItem);
  const kind = record.kind === "delivery" ? "delivery" : "shopping";
  const rawPaymentStatus = cleanText(record.paymentStatus, 80);
  const paymentStatus = rawPaymentStatus === "paid_by_user"
    || rawPaymentStatus === "payment_requested"
    || rawPaymentStatus === "paid_by_character"
    || rawPaymentStatus === "payment_declined"
    || rawPaymentStatus === "payment_canceled"
    ? rawPaymentStatus
    : undefined;
  if (!id || !statusLabel || !timeLabel || !totalLabel || !merchantLabel || !summary || items.length === 0) {
    return null;
  }
  return {
    id,
    kind,
    statusLabel,
    timeLabel,
    totalLabel,
    merchantLabel,
    summary,
    note: cleanText(record.note, 800) || summary,
    items,
    shippingTimeline: normalizeArray(record.shippingTimeline, normalizeShippingEvent).slice(0, 8),
    paymentCardId: cleanText(record.paymentCardId, 120) || undefined,
    paymentCardLabel: cleanText(record.paymentCardLabel, 120) || undefined,
    paymentTransactionId: cleanText(record.paymentTransactionId, 120) || undefined,
    paidAt: cleanText(record.paidAt, 80) || undefined,
    paymentStatus,
    paymentRequestId: cleanText(record.paymentRequestId, 120) || undefined,
    payerCharacterId: cleanText(record.payerCharacterId, 120) || undefined,
    payerCharacterName: cleanText(record.payerCharacterName, 120) || undefined,
    paymentRequestedAt: cleanText(record.paymentRequestedAt, 80) || undefined,
    paymentDeclinedAt: cleanText(record.paymentDeclinedAt, 80) || undefined,
    characterPaidAt: cleanText(record.characterPaidAt, 80) || undefined,
    addressId: cleanText(record.addressId, 80) || undefined,
    shippingAddressText: cleanText(record.shippingAddressText, 300) || undefined,
    currencyCode: cleanText(record.currencyCode, 20) || undefined,
    estimatedArrivalIso: cleanText(record.estimatedArrivalIso, 80) || undefined,
  };
}

function normalizeSearchResult(value: unknown): ShoppingSearchResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const query = cleanText(record.query, 80);
  const items = normalizeArray(record.items, normalizeProduct).slice(0, 30);
  if (!query || items.length === 0) return undefined;
  return {
    query,
    items,
    generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : new Date().toISOString(),
  };
}

function normalizeAddress(value: unknown): ShoppingAddress | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const id = cleanText(r.id, 80);
  const name = cleanText(r.name, 60);
  const phone = cleanText(r.phone, 40);
  const region = cleanText(r.region, 120);
  const detail = cleanText(r.detail, 240);
  if (!id || !name || !detail) return null;
  return {
    id,
    name,
    phone: phone || "13800000000",
    region: region || "东湾都会圈",
    detail,
    isDefault: Boolean(r.isDefault),
  };
}

function normalizeCurrency(value: unknown): ShoppingCurrency | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const id = cleanText(r.id, 40);
  const regionCode = cleanText(r.regionCode, 20);
  const regionName = cleanText(r.regionName, 40);
  const currencyCode = cleanText(r.currencyCode, 20);
  const symbol = cleanText(r.symbol, 10);
  const exchangeRate = Number(r.exchangeRate);
  if (!id || !regionCode || !symbol || !Number.isFinite(exchangeRate) || exchangeRate <= 0) return null;
  return {
    id,
    regionCode,
    regionName: regionName || regionCode,
    currencyCode: currencyCode || regionCode,
    symbol,
    exchangeRate,
  };
}

function normalizeWarehouseItem(value: unknown): WarehouseItem | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const id = cleanText(r.id, 120);
  const productId = cleanText(r.productId, 120);
  const name = cleanText(r.name, 200);
  const shopName = cleanText(r.shopName, 120);
  const kind = r.kind === "delivery" ? "delivery" : "shopping";
  const count = Math.max(1, Math.round(Number(r.count) || 1));
  if (!id || !name) return null;
  return {
    id,
    productId: productId || id,
    name,
    shopName: shopName || "自营仓",
    kind,
    count,
    icon: cleanText(r.icon, 8) || (kind === "delivery" ? "🍱" : "📦"),
    price: cleanText(r.price, 40),
    desc: cleanText(r.desc, 400),
    acquiredAt: cleanText(r.acquiredAt, 80) || new Date().toISOString(),
    sourceOrderId: cleanText(r.sourceOrderId, 120) || undefined,
  };
}

export function createDefaultShoppingState(): ShoppingState {
  return {
    catalog: {
      categories: [],
      recommendations: [],
    },
    deliveryCatalog: {
      categories: [],
      recommendations: [],
    },
    savedItems: [],
    cartItems: [],
    orders: [],
    warehouseItems: [],
    addresses: DEFAULT_SHOPPING_ADDRESSES,
    currencies: DEFAULT_SHOPPING_CURRENCIES,
    activeCurrencyId: "c_cn",
    activeAddressId: "addr_default",
    settings: {
      refreshPrompt: DEFAULT_SHOPPING_REFRESH_PROMPT,
      deliveryRefreshPrompt: DEFAULT_DELIVERY_REFRESH_PROMPT,
      searchPrompt: DEFAULT_SHOPPING_SEARCH_PROMPT,
      deliveryMinMinutes: DEFAULT_DELIVERY_MIN_MINUTES,
      deliveryMaxMinutes: DEFAULT_DELIVERY_MAX_MINUTES,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function loadShoppingState(): ShoppingState {
  if (typeof window === "undefined") return createDefaultShoppingState();
  try {
    const raw = kvGet(SHOPPING_STATE_KEY);
    if (!raw) return createDefaultShoppingState();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const catalogRaw = parsed.catalog && typeof parsed.catalog === "object"
      ? parsed.catalog as Record<string, unknown>
      : {};
    const deliveryCatalogRaw = parsed.deliveryCatalog && typeof parsed.deliveryCatalog === "object"
      ? parsed.deliveryCatalog as Record<string, unknown>
      : {};
    const settingsRaw = parsed.settings && typeof parsed.settings === "object"
      ? parsed.settings as Record<string, unknown>
      : {};

    const categories = normalizeArray(catalogRaw.categories, v => normalizeCategory(v, false));
    const recommendations = categories.length > 0
      ? categories.flatMap(c => c.items)
      : normalizeArray(catalogRaw.recommendations, normalizeProduct).slice(0, 60);

    const deliveryCategories = normalizeArray(deliveryCatalogRaw.categories, v => normalizeCategory(v, true));
    const deliveryRecommendations = deliveryCategories.length > 0
      ? deliveryCategories.flatMap(c => c.items)
      : normalizeArray(deliveryCatalogRaw.recommendations, normalizeProduct).slice(0, 60);

    const deliveryMinMinutes = normalizeDeliveryMinutes(settingsRaw.deliveryMinMinutes, DEFAULT_DELIVERY_MIN_MINUTES);
    const deliveryMaxMinutes = normalizeDeliveryMinutes(settingsRaw.deliveryMaxMinutes, DEFAULT_DELIVERY_MAX_MINUTES);

    const rawCurrencies = normalizeArray(parsed.currencies, normalizeCurrency);
    const currencies = rawCurrencies.length > 0 ? rawCurrencies : DEFAULT_SHOPPING_CURRENCIES;

    const rawAddresses = normalizeArray(parsed.addresses, normalizeAddress);
    const addresses = rawAddresses.length > 0 ? rawAddresses : DEFAULT_SHOPPING_ADDRESSES;

    return {
      catalog: {
        categories,
        recommendations,
      },
      deliveryCatalog: {
        categories: deliveryCategories,
        recommendations: deliveryRecommendations,
      },
      searchResult: normalizeSearchResult(parsed.searchResult),
      savedItems: normalizeArray(parsed.savedItems, normalizeProduct).slice(0, 100),
      cartItems: normalizeArray(parsed.cartItems, normalizeCartItem).slice(0, 100),
      orders: normalizeArray(parsed.orders, normalizeOrder).slice(0, 100),
      warehouseItems: normalizeArray(parsed.warehouseItems, normalizeWarehouseItem).slice(0, 200),
      addresses,
      currencies,
      activeCurrencyId: cleanText(parsed.activeCurrencyId, 40) || currencies[0]?.id || "c_cn",
      activeAddressId: cleanText(parsed.activeAddressId, 80) || addresses[0]?.id || "addr_default",
      settings: {
        refreshPrompt: normalizeRefreshPrompt(settingsRaw.refreshPrompt),
        deliveryRefreshPrompt: normalizeDeliveryRefreshPrompt(settingsRaw.deliveryRefreshPrompt),
        searchPrompt: normalizeSearchPrompt(settingsRaw.searchPrompt),
        deliveryMinMinutes: Math.min(deliveryMinMinutes, deliveryMaxMinutes),
        deliveryMaxMinutes: Math.max(deliveryMinMinutes, deliveryMaxMinutes),
      },
      generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined,
      deliveryGeneratedAt: typeof parsed.deliveryGeneratedAt === "string" ? parsed.deliveryGeneratedAt : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return createDefaultShoppingState();
  }
}

export function saveShoppingState(state: ShoppingState): ShoppingState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  kvSet(SHOPPING_STATE_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SHOPPING_STATE_UPDATED_EVENT));
  }
  return next;
}
