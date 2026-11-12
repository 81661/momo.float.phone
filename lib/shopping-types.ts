import type {
  CheckPhoneShoppingCartItem,
  CheckPhoneShoppingOrder,
  CheckPhoneShoppingShippingEvent,
  CheckPhoneShoppingPayload,
  CheckPhoneShoppingProduct,
} from "./checkphone-config";

export type ShoppingProductKind = "shopping" | "delivery";

export type ShoppingProduct = CheckPhoneShoppingProduct & {
  kind?: ShoppingProductKind;
  estimatedDeliveryMinutes?: number;
  packingFee?: number;
};

export type ShoppingCartItem = CheckPhoneShoppingCartItem & {
  kind?: ShoppingProductKind;
  product?: ShoppingProduct;
};

export type ShoppingOrder = CheckPhoneShoppingOrder & {
  kind?: ShoppingProductKind;
  addressId?: string;
  shippingAddressText?: string;
  currencyCode?: string;
  estimatedArrivalIso?: string;
};

export type ShoppingShippingEvent = CheckPhoneShoppingShippingEvent;

export type ShoppingCategory = {
  id: string;
  title: string;
  subtitle: string;
  items: ShoppingProduct[];
};

export type ShoppingCatalog = {
  categories: ShoppingCategory[];
  recommendations: ShoppingProduct[];
};

export type ShoppingAddress = {
  id: string;
  name: string;
  phone: string;
  region: string;
  detail: string;
  isDefault: boolean;
};

export type ShoppingCurrency = {
  id: string;
  regionCode: string;
  regionName: string;
  currencyCode: string;
  symbol: string;
  exchangeRate: number; // relative to base (CNY = 1.0)
};

export type WarehouseItem = {
  id: string;
  productId: string;
  name: string;
  shopName: string;
  kind: ShoppingProductKind;
  count: number;
  icon?: string;
  price?: string;
  desc?: string;
  acquiredAt: string;
  sourceOrderId?: string;
};

export type ShoppingSettings = {
  refreshPrompt: string;
  deliveryRefreshPrompt: string;
  searchPrompt: string;
  deliveryMinMinutes: number;
  deliveryMaxMinutes: number;
};

export type ShoppingSearchResult = {
  query: string;
  items: ShoppingProduct[];
  generatedAt: string;
};

export type ShoppingState = {
  catalog: ShoppingCatalog;
  deliveryCatalog?: ShoppingCatalog;
  searchResult?: ShoppingSearchResult;
  savedItems: ShoppingProduct[];
  cartItems: ShoppingCartItem[];
  orders: ShoppingOrder[];
  warehouseItems?: WarehouseItem[];
  addresses?: ShoppingAddress[];
  currencies?: ShoppingCurrency[];
  activeCurrencyId?: string;
  activeAddressId?: string;
  settings: ShoppingSettings;
  generatedAt?: string;
  deliveryGeneratedAt?: string;
  updatedAt: string;
};

export type ShoppingRefreshResult = {
  catalog: ShoppingCatalog | null;
  rawOutput?: string;
  error?: string;
};

export type ShoppingSearchResponse = {
  result: ShoppingSearchResult | null;
  rawOutput?: string;
  error?: string;
};

export type ShoppingPayloadView = CheckPhoneShoppingPayload;
