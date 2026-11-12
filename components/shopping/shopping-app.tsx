"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Clock,
  Coins,
  Gift,
  Heart,
  Home,
  MapPin,
  Menu,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";

import { BlackMarketApp } from "@/components/shopping/black-market-app";
import { loadCharacters } from "@/lib/character-storage";
import type { Character } from "@/lib/character-types";
import { createOrGetSession, pushChatMessage } from "@/lib/chat-storage";
import {
  generateDeliveryCatalog,
  generateShoppingCatalog,
  generateShoppingSearchResults,
} from "@/lib/shopping-engine";
import {
  DEFAULT_SHOPPING_ADDRESSES,
  DEFAULT_SHOPPING_CURRENCIES,
  loadShoppingState,
  saveShoppingState,
  SHOPPING_STATE_UPDATED_EVENT,
} from "@/lib/shopping-storage";
import type {
  ShoppingAddress,
  ShoppingCartItem,
  ShoppingCurrency,
  ShoppingOrder,
  ShoppingProduct,
  ShoppingProductKind,
  ShoppingShippingEvent,
  ShoppingState,
  WarehouseItem,
} from "@/lib/shopping-types";

type ShoppingAppProps = {
  onClose: (isBusy?: boolean) => void;
  visible?: boolean;
  onIdle?: () => void;
  onBusyChange?: (isBusy: boolean) => void;
};

type ShoppingTabId = "shopping" | "delivery" | "cart" | "orders";
type SidebarSubView = null | "favorites" | "warehouse" | "addresses" | "currencies";

function parseShoppingAmount(label: string): number {
  const match = String(label ?? "").replace(/[¥￥元,\s$€₩円]/g, "").match(/-?\d+(?:\.\d+)?/);
  const amount = match ? Number(match[0]) : 0;
  return Number.isFinite(amount) ? amount : 0;
}

function parseShoppingQuantity(label?: string): number {
  const match = String(label ?? "").match(/\d+/);
  if (!match) return 1;
  const quantity = Number(match[0]);
  return Number.isFinite(quantity) && quantity >= 1 ? Math.round(quantity) : 1;
}

function formatShoppingDateTime(date: Date): string {
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ShoppingApp({ onClose, visible = true, onBusyChange }: ShoppingAppProps) {
  const [shoppingState, setShoppingState] = useState<ShoppingState>(loadShoppingState);
  const [activeTab, setActiveTab] = useState<ShoppingTabId>("shopping");
  const [cartKind, setCartKind] = useState<ShoppingProductKind>("shopping");
  const [ordersKind, setOrdersKind] = useState<ShoppingProductKind>("shopping");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarSubView, setSidebarSubView] = useState<SidebarSubView>(null);

  const [selectedProduct, setSelectedProduct] = useState<ShoppingProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isRefreshingShopping, setIsRefreshingShopping] = useState(false);
  const [isRefreshingDelivery, setIsRefreshingDelivery] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  const [blackMarketOpen, setBlackMarketOpen] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [giftTargetItem, setGiftTargetItem] = useState<WarehouseItem | null>(null);

  const [newAddrName, setNewAddrName] = useState("");
  const [newAddrPhone, setNewAddrPhone] = useState("");
  const [newAddrRegion, setNewAddrRegion] = useState("东湾都会圈 · 中央区");
  const [newAddrDetail, setNewAddrDetail] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  const [newCurrRegion, setNewCurrRegion] = useState("");
  const [newCurrCode, setNewCurrCode] = useState("");
  const [newCurrSymbol, setNewCurrSymbol] = useState("");
  const [newCurrRate, setNewCurrRate] = useState("1.0");
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);

  useEffect(() => {
    setCharacters(loadCharacters());
    const onStateUpdate = () => setShoppingState(loadShoppingState());
    window.addEventListener(SHOPPING_STATE_UPDATED_EVENT, onStateUpdate);
    return () => window.removeEventListener(SHOPPING_STATE_UPDATED_EVENT, onStateUpdate);
  }, []);

  const activeCurrency = useMemo(() => {
    const list = shoppingState.currencies || DEFAULT_SHOPPING_CURRENCIES;
    return list.find(c => c.id === shoppingState.activeCurrencyId) || list[0] || DEFAULT_SHOPPING_CURRENCIES[0];
  }, [shoppingState.currencies, shoppingState.activeCurrencyId]);

  const activeAddress = useMemo(() => {
    const list = shoppingState.addresses || DEFAULT_SHOPPING_ADDRESSES;
    return list.find(a => a.id === shoppingState.activeAddressId)
      || list.find(a => a.isDefault)
      || list[0]
      || DEFAULT_SHOPPING_ADDRESSES[0];
  }, [shoppingState.addresses, shoppingState.activeAddressId]);

  const formatPrice = (value: number | string) => {
    const num = typeof value === "number" ? value : parseShoppingAmount(value);
    const converted = num * (activeCurrency.exchangeRate || 1);
    const shown = Number.isInteger(converted) ? String(converted) : converted.toFixed(2);
    return `${activeCurrency.symbol}${shown}`;
  };

  const refreshCatalog = async (kind: ShoppingProductKind) => {
    const isDelivery = kind === "delivery";
    if (isDelivery ? isRefreshingDelivery : isRefreshingShopping) return;
    if (isDelivery) setIsRefreshingDelivery(true);
    else setIsRefreshingShopping(true);
    setRefreshError(null);
    onBusyChange?.(true);
    try {
      const res = isDelivery
        ? await generateDeliveryCatalog(shoppingState.settings.deliveryRefreshPrompt)
        : await generateShoppingCatalog(shoppingState.settings.refreshPrompt);
      if (res.catalog) {
        const now = new Date().toISOString();
        const nextState: ShoppingState = isDelivery
          ? { ...shoppingState, deliveryCatalog: res.catalog, deliveryGeneratedAt: now, updatedAt: now }
          : { ...shoppingState, catalog: res.catalog, generatedAt: now, updatedAt: now };
        saveShoppingState(nextState);
        setShoppingState(nextState);
      } else if (res.error) {
        setRefreshError(res.error);
      }
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : "刷新失败");
    } finally {
      if (isDelivery) setIsRefreshingDelivery(false);
      else setIsRefreshingShopping(false);
      onBusyChange?.(false);
    }
  };

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query || isSearching) return;
    if (query.toLowerCase() === "black market") {
      setBlackMarketOpen(true);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    onBusyChange?.(true);
    try {
      const res = await generateShoppingSearchResults(query, shoppingState.settings.searchPrompt);
      if (res.result) {
        const nextState: ShoppingState = { ...shoppingState, searchResult: res.result, updatedAt: new Date().toISOString() };
        saveShoppingState(nextState);
        setShoppingState(nextState);
      } else if (res.error) {
        setSearchError(res.error);
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "搜索失败");
    } finally {
      setIsSearching(false);
      onBusyChange?.(false);
    }
  };

  const addToCart = (product: ShoppingProduct) => {
    const kind: ShoppingProductKind = product.kind || "shopping";
    const existing = shoppingState.cartItems.find(item => item.id === product.id);
    const nextCart: ShoppingCartItem[] = existing
      ? shoppingState.cartItems.map(item => item.id === product.id
        ? { ...item, quantityLabel: `x ${parseShoppingQuantity(item.quantityLabel) + 1}` }
        : item)
      : [...shoppingState.cartItems, { ...product, kind, quantityLabel: "x 1" }];
    const nextState = { ...shoppingState, cartItems: nextCart };
    saveShoppingState(nextState);
    setShoppingState(nextState);
  };

  const updateCartQty = (id: string, delta: number) => {
    const nextCart = shoppingState.cartItems
      .map(item => {
        if (item.id !== id) return item;
        const nextQty = parseShoppingQuantity(item.quantityLabel) + delta;
        return nextQty > 0 ? { ...item, quantityLabel: `x ${nextQty}` } : null;
      })
      .filter((item): item is ShoppingCartItem => Boolean(item));
    const nextState = { ...shoppingState, cartItems: nextCart };
    saveShoppingState(nextState);
    setShoppingState(nextState);
  };

  const toggleFavorite = (product: ShoppingProduct) => {
    const exists = shoppingState.savedItems.some(item => item.id === product.id);
    const nextSaved = exists
      ? shoppingState.savedItems.filter(item => item.id !== product.id)
      : [...shoppingState.savedItems, product];
    const nextState = { ...shoppingState, savedItems: nextSaved };
    saveShoppingState(nextState);
    setShoppingState(nextState);
  };

  const filteredCartItems = useMemo(
    () => shoppingState.cartItems.filter(item => (item.kind || "shopping") === cartKind),
    [shoppingState.cartItems, cartKind],
  );

  const cartTotalAmount = useMemo(
    () => filteredCartItems.reduce(
      (sum, item) => sum + parseShoppingAmount(item.priceLabel) * parseShoppingQuantity(item.quantityLabel),
      0,
    ),
    [filteredCartItems],
  );

  const handleCheckout = () => {
    if (filteredCartItems.length === 0 || isPaying) return;
    setIsPaying(true);
    const now = new Date();
    const orderId = `ord_${Date.now()}`;
    const isDelivery = cartKind === "delivery";
    const totalAmount = cartTotalAmount + (isDelivery ? 5 : 0);

    const timeline: ShoppingShippingEvent[] = isDelivery
      ? [
          { status: "ordered", label: "商家已接单并开始备餐", timeLabel: formatShoppingDateTime(now), timestamp: now.toISOString() },
          { status: "delivering", label: "骑手已取餐，正在配送", timeLabel: "预计 30 分钟内送达", timestamp: new Date(now.getTime() + 5 * 60000).toISOString() },
        ]
      : [
          { status: "ordered", label: "买家已付款", timeLabel: formatShoppingDateTime(now), timestamp: now.toISOString() },
          { status: "shipped", label: "包裹已从东湾仓出库", timeLabel: "预计 24 小时内揽收", timestamp: new Date(now.getTime() + 3600000).toISOString() },
        ];

    const newOrder: ShoppingOrder = {
      id: orderId,
      kind: cartKind,
      statusLabel: isDelivery ? "配送中" : "待发货",
      timeLabel: formatShoppingDateTime(now),
      totalLabel: formatPrice(totalAmount),
      merchantLabel: isDelivery ? "东湾即时外卖中心" : "东湾精品官方仓",
      summary: `${filteredCartItems[0]?.title || "商品"} 等共 ${filteredCartItems.length} 件`,
      note: `${activeAddress.region} ${activeAddress.detail}（${activeAddress.name} 收）`,
      items: [...filteredCartItems],
      shippingTimeline: timeline,
      paidAt: now.toISOString(),
      paymentStatus: "paid_by_user",
      addressId: activeAddress.id,
      shippingAddressText: `${activeAddress.region} ${activeAddress.detail}`,
      currencyCode: activeCurrency.currencyCode,
    };

    const mergedWarehouse: WarehouseItem[] = [...(shoppingState.warehouseItems || [])];
    for (const item of filteredCartItems) {
      const count = parseShoppingQuantity(item.quantityLabel);
      const hit = mergedWarehouse.find(entry => entry.productId === item.id);
      if (hit) {
        hit.count += count;
      } else {
        mergedWarehouse.unshift({
          id: `wh_${item.id}_${Date.now()}`,
          productId: item.id,
          name: item.title,
          shopName: item.merchantLabel,
          kind: item.kind || "shopping",
          count,
          icon: item.previewIcon,
          price: item.priceLabel,
          desc: item.detail,
          acquiredAt: now.toISOString(),
          sourceOrderId: orderId,
        });
      }
    }

    const nextState: ShoppingState = {
      ...shoppingState,
      cartItems: shoppingState.cartItems.filter(item => (item.kind || "shopping") !== cartKind),
      orders: [newOrder, ...shoppingState.orders],
      warehouseItems: mergedWarehouse,
      updatedAt: now.toISOString(),
    };
    saveShoppingState(nextState);
    setShoppingState(nextState);
    setIsPaying(false);
    setActiveTab("orders");
    setOrdersKind(cartKind);
  };

  const handleGift = (characterId: string) => {
    const item = giftTargetItem;
    if (!item) return;
    const character = characters.find(c => c.id === characterId);
    if (!character) return;
    const isDelivery = item.kind === "delivery";
    const session = createOrGetSession(character.id);
    pushChatMessage({
      sessionId: session.id,
      role: "user",
      content: isDelivery
        ? `[外卖点单：给${character.name}点了一份《${item.name}》，正在即时配送]`
        : `[赠送礼物：送给${character.name}一份《${item.name}》]`,
      mediaType: "gift",
      mediaData: { label: item.name, giftName: item.name, recipientName: character.name },
    });
    const nextWarehouse = (shoppingState.warehouseItems || [])
      .map(entry => entry.id === item.id ? { ...entry, count: entry.count - 1 } : entry)
      .filter(entry => entry.count > 0);
    const nextState = { ...shoppingState, warehouseItems: nextWarehouse };
    saveShoppingState(nextState);
    setShoppingState(nextState);
    setGiftTargetItem(null);
  };

  const handleAddAddress = () => {
    if (!newAddrName.trim() || !newAddrDetail.trim()) return;
    const address: ShoppingAddress = {
      id: `addr_${Date.now()}`,
      name: newAddrName.trim(),
      phone: newAddrPhone.trim() || "13800000000",
      region: newAddrRegion.trim() || "东湾都会圈 · 中央区",
      detail: newAddrDetail.trim(),
      isDefault: (shoppingState.addresses || []).length === 0,
    };
    const nextState = {
      ...shoppingState,
      addresses: [...(shoppingState.addresses || []), address],
      activeAddressId: address.id,
    };
    saveShoppingState(nextState);
    setShoppingState(nextState);
    setNewAddrName("");
    setNewAddrPhone("");
    setNewAddrDetail("");
    setIsAddingAddress(false);
  };

  const handleDeleteAddress = (id: string) => {
    const next = (shoppingState.addresses || []).filter(item => item.id !== id);
    const nextState = {
      ...shoppingState,
      addresses: next,
      activeAddressId: shoppingState.activeAddressId === id ? (next[0]?.id || "") : shoppingState.activeAddressId,
    };
    saveShoppingState(nextState);
    setShoppingState(nextState);
  };

  const handleAddCurrency = () => {
    if (!newCurrCode.trim() || !newCurrSymbol.trim()) return;
    const rate = Number(newCurrRate);
    const currency: ShoppingCurrency = {
      id: `c_${Date.now()}`,
      regionCode: newCurrRegion.trim().toUpperCase() || "CUSTOM",
      regionName: newCurrRegion.trim() || "自定义地区",
      currencyCode: newCurrCode.trim().toUpperCase(),
      symbol: newCurrSymbol.trim(),
      exchangeRate: Number.isFinite(rate) && rate > 0 ? rate : 1,
    };
    const nextState = {
      ...shoppingState,
      currencies: [...(shoppingState.currencies || DEFAULT_SHOPPING_CURRENCIES), currency],
      activeCurrencyId: currency.id,
    };
    saveShoppingState(nextState);
    setShoppingState(nextState);
    setNewCurrRegion("");
    setNewCurrCode("");
    setNewCurrSymbol("");
    setNewCurrRate("1.0");
    setIsAddingCurrency(false);
  };

  const handleDeleteCurrency = (id: string) => {
    const list = shoppingState.currencies || DEFAULT_SHOPPING_CURRENCIES;
    if (list.length <= 1) return;
    const next = list.filter(item => item.id !== id);
    const nextState = {
      ...shoppingState,
      currencies: next,
      activeCurrencyId: shoppingState.activeCurrencyId === id ? next[0].id : shoppingState.activeCurrencyId,
    };
    saveShoppingState(nextState);
    setShoppingState(nextState);
  };

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#0b0d11] text-[#e8ebf2] select-none overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2.5 border-b border-white/10 bg-[#12161f]/90 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 active:scale-95 transition"
            aria-label="侧边栏"
          >
            <Menu size={20} />
          </button>
          <div className="text-sm font-bold tracking-wide flex items-center gap-1.5">
            <span>东湾汇</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-medium">
              {activeCurrency.currencyCode}
            </span>
          </div>
        </div>
        <form onSubmit={handleSearch} className="flex-1 max-w-[190px] mx-2 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="搜索商品或外卖"
            className="w-full pl-7 pr-2 py-1 text-xs bg-white/5 border border-white/10 rounded-full focus:outline-none focus:border-blue-400 text-white placeholder-white/40"
          />
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
        </form>
        <button
          onClick={() => onClose()}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 active:scale-95 transition"
          aria-label="关闭"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4">

        {shoppingState.searchResult && (
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">搜索结果：{shoppingState.searchResult.query}</span>
              <button
                onClick={() => {
                  const nextState = { ...shoppingState, searchResult: undefined };
                  saveShoppingState(nextState);
                  setShoppingState(nextState);
                }}
                className="text-blue-400"
              >
                清除
              </button>
            </div>
            {searchError && <p className="text-[11px] text-red-300">{searchError}</p>}
            <div className="grid grid-cols-2 gap-2">
              {shoppingState.searchResult.items.map(product => (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className="p-2.5 rounded-xl bg-[#161a24] border border-white/10 cursor-pointer hover:border-blue-400/40"
                >
                  <div className="text-2xl mb-1">{product.previewIcon || "🛍️"}</div>
                  <div className="text-xs font-bold truncate">{product.title}</div>
                  <div className="text-[10px] text-white/50 truncate">{product.merchantLabel}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-300">{formatPrice(product.priceLabel)}</span>
                    <button
                      onClick={event => {
                        event.stopPropagation();
                        addToCart(product);
                      }}
                      className="p-1 rounded bg-blue-600/30 text-blue-300"
                      aria-label="加入购物车"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "shopping" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <span>精品商城</span>
                <span className="text-[10px] text-white/40 font-normal">全城品质好物</span>
              </h2>
              <button
                onClick={() => refreshCatalog("shopping")}
                disabled={isRefreshingShopping}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 disabled:opacity-50"
              >
                <RefreshCw size={12} className={isRefreshingShopping ? "animate-spin" : ""} />
                <span>{isRefreshingShopping ? "刷新中" : "换一批好物"}</span>
              </button>
            </div>

            {refreshError && !isRefreshingShopping && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{refreshError}</div>
            )}

            {shoppingState.catalog.categories.length === 0 ? (
              <div className="text-center py-12 text-white/40 space-y-2">
                <Package size={36} className="mx-auto opacity-40" />
                <p className="text-xs">暂无推荐商品，点击「换一批好物」生成</p>
              </div>
            ) : (
              shoppingState.catalog.categories.map(category => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-baseline justify-between border-b border-white/5 pb-1">
                    <h3 className="text-xs font-bold text-white/90">{category.title}</h3>
                    <span className="text-[10px] text-white/40">{category.subtitle}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {category.items.map(product => (
                      <div
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className="p-2.5 rounded-xl bg-[#141822] border border-white/10 cursor-pointer hover:border-blue-400/40"
                      >
                        <div className="text-2xl mb-1">{product.previewIcon || "📦"}</div>
                        <div className="text-xs font-medium truncate">{product.title}</div>
                        <div className="text-[10px] text-white/40 truncate">{product.merchantLabel}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-300">{formatPrice(product.priceLabel)}</span>
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              addToCart(product);
                            }}
                            className="p-1 rounded bg-white/10 text-white/80"
                            aria-label="加入购物车"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "delivery" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-1.5">
                <span className="text-orange-400">即时外卖</span>
                <span className="text-[10px] text-white/40 font-normal">平均 30 分钟送达</span>
              </h2>
              <button
                onClick={() => refreshCatalog("delivery")}
                disabled={isRefreshingDelivery}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 disabled:opacity-50"
              >
                <RefreshCw size={12} className={isRefreshingDelivery ? "animate-spin" : ""} />
                <span>{isRefreshingDelivery ? "更新中" : "换一批外卖"}</span>
              </button>
            </div>

            {refreshError && !isRefreshingDelivery && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs">{refreshError}</div>
            )}

            {!shoppingState.deliveryCatalog || shoppingState.deliveryCatalog.categories.length === 0 ? (
              <div className="text-center py-12 text-white/40 space-y-2">
                <UtensilsCrossed size={36} className="mx-auto opacity-40 text-orange-400" />
                <p className="text-xs">暂无外卖餐品，点击「换一批外卖」生成</p>
              </div>
            ) : (
              shoppingState.deliveryCatalog.categories.map(category => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-baseline justify-between border-b border-white/5 pb-1">
                    <h3 className="text-xs font-bold text-orange-300">{category.title}</h3>
                    <span className="text-[10px] text-white/40">{category.subtitle}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {category.items.map(product => (
                      <div
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className="p-2.5 rounded-xl bg-[#18141f] border border-orange-500/20 cursor-pointer hover:border-orange-400/50"
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-2xl">{product.previewIcon || "🍱"}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
                            {product.estimatedDeliveryMinutes || 30} 分
                          </span>
                        </div>
                        <div className="text-xs font-medium truncate mt-1">{product.title}</div>
                        <div className="text-[10px] text-white/40 truncate">{product.merchantLabel}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs font-bold text-orange-300">{formatPrice(product.priceLabel)}</span>
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              addToCart(product);
                            }}
                            className="p-1 rounded bg-orange-600/30 text-orange-200"
                            aria-label="加入购物车"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "cart" && (
          <div className="space-y-4">
            <div className="flex rounded-lg bg-white/5 p-1 border border-white/10">
              <button
                onClick={() => setCartKind("shopping")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                  cartKind === "shopping" ? "bg-blue-600 text-white" : "text-white/60"
                }`}
              >
                商城购物车（{shoppingState.cartItems.filter(item => (item.kind || "shopping") === "shopping").length}）
              </button>
              <button
                onClick={() => setCartKind("delivery")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                  cartKind === "delivery" ? "bg-orange-600 text-white" : "text-white/60"
                }`}
              >
                外卖购物车（{shoppingState.cartItems.filter(item => item.kind === "delivery").length}）
              </button>
            </div>

            {filteredCartItems.length === 0 ? (
              <div className="text-center py-16 text-white/40 space-y-2">
                <ShoppingCart size={36} className="mx-auto opacity-30" />
                <p className="text-xs">当前{cartKind === "delivery" ? "外卖" : "商城"}购物车是空的</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredCartItems.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#141822] border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="text-2xl">{item.previewIcon || "🛍️"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{item.title}</div>
                      <div className="text-[10px] text-white/40 truncate">{item.merchantLabel}</div>
                      <div className="text-xs text-amber-300 font-bold mt-0.5">{formatPrice(item.priceLabel)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateCartQty(item.id, -1)}
                        className="p-1 rounded bg-white/10 text-white/70"
                        aria-label="减少数量"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">
                        {parseShoppingQuantity(item.quantityLabel)}
                      </span>
                      <button
                        onClick={() => updateCartQty(item.id, 1)}
                        className="p-1 rounded bg-white/10 text-white/70"
                        aria-label="增加数量"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>收货地址</span>
                    <button
                      onClick={() => {
                        setSidebarSubView("addresses");
                        setSidebarOpen(true);
                      }}
                      className="text-blue-400 flex items-center gap-1"
                    >
                      <MapPin size={10} />
                      <span className="truncate max-w-[150px]">{activeAddress.region}</span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>商品总计</span>
                    <span className="font-bold text-white">{formatPrice(cartTotalAmount)}</span>
                  </div>
                  {cartKind === "delivery" && (
                    <div className="flex items-center justify-between text-xs text-white/70">
                      <span>包装与配送费</span>
                      <span className="font-bold text-white">{formatPrice(5)}</span>
                    </div>
                  )}
                  <button
                    onClick={handleCheckout}
                    disabled={isPaying}
                    className={`w-full py-2.5 rounded-lg text-xs font-bold text-white transition ${
                      cartKind === "delivery" ? "bg-orange-600" : "bg-blue-600"
                    }`}
                  >
                    {isPaying ? "处理中" : `立即支付（${formatPrice(cartTotalAmount + (cartKind === "delivery" ? 5 : 0))}）`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-4">
            <div className="flex rounded-lg bg-white/5 p-1 border border-white/10">
              <button
                onClick={() => setOrdersKind("shopping")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                  ordersKind === "shopping" ? "bg-blue-600 text-white" : "text-white/60"
                }`}
              >
                商城订单（{shoppingState.orders.filter(item => (item.kind || "shopping") === "shopping").length}）
              </button>
              <button
                onClick={() => setOrdersKind("delivery")}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
                  ordersKind === "delivery" ? "bg-orange-600 text-white" : "text-white/60"
                }`}
              >
                外卖订单（{shoppingState.orders.filter(item => item.kind === "delivery").length}）
              </button>
            </div>

            {shoppingState.orders.filter(item => (item.kind || "shopping") === ordersKind).length === 0 ? (
              <div className="text-center py-16 text-white/40 space-y-2">
                <Truck size={36} className="mx-auto opacity-30" />
                <p className="text-xs">暂无{ordersKind === "delivery" ? "外卖" : "商城"}订单</p>
              </div>
            ) : (
              shoppingState.orders
                .filter(item => (item.kind || "shopping") === ordersKind)
                .map(order => (
                  <div key={order.id} className="p-3.5 rounded-xl bg-[#141822] border border-white/10 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white/90">{order.merchantLabel}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          order.kind === "delivery"
                            ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {order.statusLabel}
                      </span>
                    </div>
                    <div className="text-xs text-white/70 truncate">{order.summary}</div>
                    <div className="flex items-center justify-between text-[11px] text-white/40 pt-1 border-t border-white/5">
                      <span>{order.timeLabel}</span>
                      <span className="text-xs font-bold text-white">{order.totalLabel}</span>
                    </div>
                    {order.shippingTimeline.length > 0 && (
                      <div className="p-2 rounded-lg bg-black/30 border border-white/5 text-[10px] text-white/50 flex items-center gap-1">
                        <Clock size={10} />
                        <span>{order.shippingTimeline[order.shippingTimeline.length - 1].label}</span>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        )}
      </div>

      <nav className="flex items-center justify-around py-2 border-t border-white/10 bg-[#12161f] z-20">
        <button
          onClick={() => setActiveTab("shopping")}
          className={`flex flex-col items-center gap-0.5 text-xs ${
            activeTab === "shopping" ? "text-blue-400 font-bold" : "text-white/40"
          }`}
        >
          <Home size={18} />
          <span>商城</span>
        </button>
        <button
          onClick={() => setActiveTab("delivery")}
          className={`flex flex-col items-center gap-0.5 text-xs ${
            activeTab === "delivery" ? "text-orange-400 font-bold" : "text-white/40"
          }`}
        >
          <UtensilsCrossed size={18} />
          <span>外卖</span>
        </button>
        <button
          onClick={() => setActiveTab("cart")}
          className={`relative flex flex-col items-center gap-0.5 text-xs ${
            activeTab === "cart" ? "text-blue-400 font-bold" : "text-white/40"
          }`}
        >
          <ShoppingCart size={18} />
          <span>购物车</span>
          {shoppingState.cartItems.length > 0 && (
            <span className="absolute -top-1 -right-2 px-1 text-[9px] font-bold bg-blue-500 text-white rounded-full">
              {shoppingState.cartItems.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex flex-col items-center gap-0.5 text-xs ${
            activeTab === "orders" ? "text-blue-400 font-bold" : "text-white/40"
          }`}
        >
          <Truck size={18} />
          <span>订单</span>
        </button>
      </nav>

      {sidebarOpen && (
        <div className="absolute inset-0 z-40 flex">
          <div
            onClick={() => {
              setSidebarOpen(false);
              setSidebarSubView(null);
            }}
            className="flex-1 bg-black/60 backdrop-blur-sm"
          />
          <div className="w-[280px] bg-[#121620] border-l border-white/10 flex flex-col h-full shadow-2xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-sm font-bold text-white/90">
                {sidebarSubView === "favorites" ? "我的收藏"
                  : sidebarSubView === "warehouse" ? "我的物品与仓库"
                  : sidebarSubView === "addresses" ? "地址管理"
                  : sidebarSubView === "currencies" ? "地区与币种"
                  : "个人中心"}
              </span>
              <button
                onClick={() => {
                  if (sidebarSubView) setSidebarSubView(null);
                  else setSidebarOpen(false);
                }}
                className="p-1 rounded hover:bg-white/10 text-white/60"
                aria-label="返回"
              >
                {sidebarSubView ? <ArrowLeft size={16} /> : <X size={16} />}
              </button>
            </div>

            {!sidebarSubView && (
              <div className="space-y-2">
                <button
                  onClick={() => setSidebarSubView("favorites")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 text-xs font-medium text-white/80"
                >
                  <span className="flex items-center gap-2.5"><Heart size={16} className="text-rose-400" />我的收藏</span>
                  <span className="flex items-center gap-1 text-white/40">{shoppingState.savedItems.length}<ChevronRightIcon /></span>
                </button>
                <button
                  onClick={() => setSidebarSubView("warehouse")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 text-xs font-medium text-white/80"
                >
                  <span className="flex items-center gap-2.5"><Package size={16} className="text-amber-400" />我的物品与仓库</span>
                  <span className="flex items-center gap-1 text-white/40">{(shoppingState.warehouseItems || []).length}<ChevronRightIcon /></span>
                </button>
                <button
                  onClick={() => setSidebarSubView("addresses")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 text-xs font-medium text-white/80"
                >
                  <span className="flex items-center gap-2.5"><MapPin size={16} className="text-emerald-400" />地址管理</span>
                  <span className="flex items-center gap-1 text-white/40 truncate max-w-[90px]">{activeAddress.region}<ChevronRightIcon /></span>
                </button>
                <button
                  onClick={() => setSidebarSubView("currencies")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 text-xs font-medium text-white/80"
                >
                  <span className="flex items-center gap-2.5"><Coins size={16} className="text-blue-400" />地区与币种</span>
                  <span className="flex items-center gap-1 text-white/40">{activeCurrency.currencyCode}<ChevronRightIcon /></span>
                </button>
              </div>
            )}

            {sidebarSubView === "favorites" && (
              <div className="flex-1 overflow-y-auto space-y-2">
                {shoppingState.savedItems.length === 0 ? (
                  <p className="text-center text-xs text-white/40 py-8">暂无收藏</p>
                ) : (
                  shoppingState.savedItems.map(product => (
                    <div key={product.id} className="p-2.5 rounded-lg bg-white/5 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{product.title}</div>
                        <div className="text-[10px] text-amber-300">{formatPrice(product.priceLabel)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => addToCart(product)} className="px-1.5 py-1 rounded bg-blue-600/30 text-blue-300 text-[10px]">
                          加购
                        </button>
                        <button onClick={() => toggleFavorite(product)} className="p-1 text-rose-400" aria-label="取消收藏">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {sidebarSubView === "warehouse" && (
              <div className="flex-1 overflow-y-auto space-y-2.5">
                {(shoppingState.warehouseItems || []).length === 0 ? (
                  <div className="text-center text-xs text-white/40 py-8 space-y-1">
                    <Package size={28} className="mx-auto opacity-30" />
                    <p>仓库是空的，支付后物品会自动入库</p>
                  </div>
                ) : (
                  (shoppingState.warehouseItems || []).map(item => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xl">{item.icon || "📦"}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{item.name}</div>
                            <div className="text-[10px] text-white/40 truncate">{item.shopName} · 共 {item.count} 件</div>
                          </div>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 shrink-0">
                          {item.kind === "delivery" ? "外卖" : "商城"}
                        </span>
                      </div>
                      <button
                        onClick={() => setGiftTargetItem(item)}
                        className="w-full py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center justify-center gap-1.5"
                      >
                        <Gift size={12} />
                        赠送给角色（消耗 1 件）
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {sidebarSubView === "addresses" && (
              <div className="flex-1 overflow-y-auto space-y-3">
                <button
                  onClick={() => setIsAddingAddress(!isAddingAddress)}
                  className="w-full py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center justify-center gap-1"
                >
                  <Plus size={12} />
                  新增收货地址
                </button>

                {isAddingAddress && (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/30 space-y-2">
                    <input
                      value={newAddrName}
                      onChange={event => setNewAddrName(event.target.value)}
                      placeholder="收货人姓名"
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <input
                      value={newAddrPhone}
                      onChange={event => setNewAddrPhone(event.target.value)}
                      placeholder="联系电话"
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <input
                      value={newAddrRegion}
                      onChange={event => setNewAddrRegion(event.target.value)}
                      placeholder="区域"
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <textarea
                      value={newAddrDetail}
                      onChange={event => setNewAddrDetail(event.target.value)}
                      placeholder="详细地址"
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white resize-none h-14"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleAddAddress} className="flex-1 py-1 rounded bg-emerald-600 text-white text-xs font-bold">
                        保存
                      </button>
                      <button onClick={() => setIsAddingAddress(false)} className="px-3 py-1 rounded bg-white/10 text-white/60 text-xs">
                        取消
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(shoppingState.addresses || []).map(address => (
                    <div
                      key={address.id}
                      onClick={() => {
                        const nextState = { ...shoppingState, activeAddressId: address.id };
                        saveShoppingState(nextState);
                        setShoppingState(nextState);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer ${
                        shoppingState.activeAddressId === address.id
                          ? "bg-emerald-500/10 border-emerald-500/50"
                          : "bg-white/5 border-white/5"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{address.name}</span>
                          <span className="text-[10px] text-white/40">{address.phone}</span>
                        </div>
                        <div className="text-[10px] text-emerald-300 truncate">{address.region}</div>
                        <div className="text-[10px] text-white/50 truncate">{address.detail}</div>
                      </div>
                      {(shoppingState.addresses || []).length > 1 && (
                        <button
                          onClick={event => {
                            event.stopPropagation();
                            handleDeleteAddress(address.id);
                          }}
                          className="p-1 text-white/30 hover:text-rose-400"
                          aria-label="删除地址"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sidebarSubView === "currencies" && (
              <div className="flex-1 overflow-y-auto space-y-3">
                <button
                  onClick={() => setIsAddingCurrency(!isAddingCurrency)}
                  className="w-full py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-medium flex items-center justify-center gap-1"
                >
                  <Plus size={12} />
                  设立新地区与币种
                </button>

                {isAddingCurrency && (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-blue-500/30 space-y-2">
                    <input
                      value={newCurrRegion}
                      onChange={event => setNewCurrRegion(event.target.value)}
                      placeholder="地区名（如：新港特别区）"
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <div className="flex gap-2">
                      <input
                        value={newCurrCode}
                        onChange={event => setNewCurrCode(event.target.value)}
                        placeholder="货币代码"
                        className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      />
                      <input
                        value={newCurrSymbol}
                        onChange={event => setNewCurrSymbol(event.target.value)}
                        placeholder="符号"
                        className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white text-center"
                      />
                    </div>
                    <input
                      type="number"
                      step="0.0001"
                      value={newCurrRate}
                      onChange={event => setNewCurrRate(event.target.value)}
                      placeholder="汇率（CNY = 1.0）"
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleAddCurrency} className="flex-1 py-1 rounded bg-blue-600 text-white text-xs font-bold">
                        设立
                      </button>
                      <button onClick={() => setIsAddingCurrency(false)} className="px-3 py-1 rounded bg-white/10 text-white/60 text-xs">
                        取消
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(shoppingState.currencies || DEFAULT_SHOPPING_CURRENCIES).map(currency => (
                    <div
                      key={currency.id}
                      onClick={() => {
                        const nextState = { ...shoppingState, activeCurrencyId: currency.id };
                        saveShoppingState(nextState);
                        setShoppingState(nextState);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer ${
                        shoppingState.activeCurrencyId === currency.id
                          ? "bg-blue-500/10 border-blue-500/50"
                          : "bg-white/5 border-white/5"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span className="truncate">{currency.regionName}</span>
                          <span className="text-[10px] text-white/40">({currency.regionCode})</span>
                        </div>
                        <div className="text-[10px] text-blue-300">
                          {currency.currencyCode} · {currency.symbol} · 汇率 {currency.exchangeRate}
                        </div>
                      </div>
                      {(shoppingState.currencies || DEFAULT_SHOPPING_CURRENCIES).length > 1 && (
                        <button
                          onClick={event => {
                            event.stopPropagation();
                            handleDeleteCurrency(currency.id);
                          }}
                          className="p-1 text-white/30 hover:text-rose-400"
                          aria-label="删除币种"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {giftTargetItem && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-[280px] bg-[#161a24] border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">送给哪位角色</span>
              <button onClick={() => setGiftTargetItem(null)} className="text-white/40" aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className="text-[11px] text-amber-300">
              以{giftTargetItem.kind === "delivery" ? "即时外卖" : "心意礼物"}形式送出
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-1.5">
              {characters.length === 0 && <p className="text-[11px] text-white/40">还没有角色</p>}
              {characters.map(character => (
                <button
                  key={character.id}
                  onClick={() => handleGift(character.id)}
                  className="w-full p-2 rounded-xl bg-white/5 flex items-center gap-2.5 text-xs text-left"
                >
                  <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                    {character.avatar
                      ? <img src={character.avatar} alt="" className="w-full h-full object-cover" />
                      : "👤"}
                  </span>
                  <span className="truncate flex-1 font-medium">{character.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-h-[80vh] bg-[#141824] border-t border-white/10 rounded-t-2xl p-4 space-y-3 overflow-y-auto">
            <div className="flex items-start justify-between">
              <span className="text-3xl">{selectedProduct.previewIcon || "🛍️"}</span>
              <button onClick={() => setSelectedProduct(null)} className="text-white/40" aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <div>
              <div className="text-sm font-bold text-white">{selectedProduct.title}</div>
              <div className="text-xs text-white/50">{selectedProduct.merchantLabel}</div>
              <div className="text-sm font-bold text-amber-300 mt-1">{formatPrice(selectedProduct.priceLabel)}</div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-white/70 leading-relaxed">
              {selectedProduct.detail}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => toggleFavorite(selectedProduct)}
                className={`p-2.5 rounded-xl border flex items-center justify-center ${
                  shoppingState.savedItems.some(item => item.id === selectedProduct.id)
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    : "bg-white/5 text-white/60 border-white/10"
                }`}
                aria-label="收藏"
              >
                <Heart size={16} />
              </button>
              <button
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
              >
                加入购物车
              </button>
            </div>
          </div>
        </div>
      )}

      {blackMarketOpen && <BlackMarketApp onClose={() => setBlackMarketOpen(false)} />}
    </div>
  );
}

function ChevronRightIcon() {
  return <span className="text-[11px]">›</span>;
}
