
      {/* 侧边栏抽屉与子面板 */}
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
                {sidebarSubView === "favorites" ? "我的收藏" :
                 sidebarSubView === "warehouse" ? "我的物品与仓库" :
                 sidebarSubView === "addresses" ? "地址管理" :
                 sidebarSubView === "currencies" ? "地区与币种" : "个人中心"}
              </span>
              <button
                onClick={() => {
                  if (sidebarSubView) setSidebarSubView(null);
                  else setSidebarOpen(false);
                }}
                className="p-1 rounded hover:bg-white/10 text-white/60"
              >
                {sidebarSubView ? <ArrowLeft size={16} /> : <X size={16} />}
              </button>
            </div>

            {/* 侧边栏主菜单 */}
            {!sidebarSubView && (
              <div className="space-y-2">
                <button
                  onClick={() => setSidebarSubView("favorites")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-white/80"
                >
                  <div className="flex items-center gap-2.5">
                    <Heart size={16} className="text-rose-400" />
                    <span>我的收藏</span>
                  </div>
                  <div className="flex items-center gap-1 text-white/40">
                    <span>{shoppingState.savedItems.length}</span>
                    <ChevronRight size={14} />
                  </div>
                </button>

                <button
                  onClick={() => setSidebarSubView("warehouse")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-white/80"
                >
                  <div className="flex items-center gap-2.5">
                    <Package size={16} className="text-amber-400" />
                    <span>我的物品与仓库</span>
                  </div>
                  <div className="flex items-center gap-1 text-white/40">
                    <span>{(shoppingState.warehouseItems || []).length}</span>
                    <ChevronRight size={14} />
                  </div>
                </button>

                <button
                  onClick={() => setSidebarSubView("addresses")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-white/80"
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin size={16} className="text-emerald-400" />
                    <span>地址管理</span>
                  </div>
                  <div className="flex items-center gap-1 text-white/40">
                    <span className="truncate max-w-[80px]">{activeAddress.region}</span>
                    <ChevronRight size={14} />
                  </div>
                </button>

                <button
                  onClick={() => setSidebarSubView("currencies")}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-white/80"
                >
                  <div className="flex items-center gap-2.5">
                    <Coins size={16} className="text-blue-400" />
                    <span>地区与币种</span>
                  </div>
                  <div className="flex items-center gap-1 text-white/40">
                    <span>{activeCurrency.currencyCode} ({activeCurrency.symbol})</span>
                    <ChevronRight size={14} />
                  </div>
                </button>
              </div>
            )}

            {/* 1. 收藏子面板 */}
            {sidebarSubView === "favorites" && (
              <div className="flex-1 overflow-y-auto space-y-2">
                {shoppingState.savedItems.length === 0 ? (
                  <p className="text-center text-xs text-white/40 py-8">暂无收藏</p>
                ) : (
                  shoppingState.savedItems.map(p => (
                    <div key={p.id} className="p-2.5 rounded-lg bg-white/5 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{p.title}</div>
                        <div className="text-[10px] text-amber-300">{formatPrice(p.priceLabel)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => addToCart(p)}
                          className="p-1 rounded bg-blue-600/30 text-blue-300 text-[10px] px-1.5"
                        >
                          加购
                        </button>
                        <button
                          onClick={() => toggleFavorite(p)}
                          className="p-1 text-rose-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 2. 物品与仓库（可赠送给角色） */}
            {sidebarSubView === "warehouse" && (
              <div className="flex-1 overflow-y-auto space-y-2.5">
                {(shoppingState.warehouseItems || []).length === 0 ? (
                  <div className="text-center text-xs text-white/40 py-8 space-y-1">
                    <Package size={28} className="mx-auto opacity-30" />
                    <p>仓库空空如也，支付订单后自动进入仓库</p>
                  </div>
                ) : (
                  (shoppingState.warehouseItems || []).map(item => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl">{item.icon || "📦"}</span>
                          <div>
                            <div className="text-xs font-bold line-clamp-1">{item.name}</div>
                            <div className="text-[10px] text-white/40">{item.shopName} · 拥有 {item.count} 件</div>
                          </div>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                          {item.kind === "delivery" ? "外卖餐品" : "商城物品"}
                        </span>
                      </div>
                      <button
                        onClick={() => setGiftTargetItem(item)}
                        className="w-full py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium flex items-center justify-center gap-1.5 hover:bg-amber-500/30 active:scale-98 transition"
                      >
                        <Gift size={12} />
                        <span>赠送给角色 (消耗 1 件)</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 3. 地址管理 */}
            {sidebarSubView === "addresses" && (
              <div className="flex-1 overflow-y-auto space-y-3">
                <button
                  onClick={() => setIsAddingAddress(!isAddingAddress)}
                  className="w-full py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium flex items-center justify-center gap-1"
                >
                  <Plus size={12} />
                  <span>新增收货地址</span>
                </button>

                {isAddingAddress && (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/30 space-y-2">
                    <input
                      type="text"
                      placeholder="收货人姓名"
                      value={newAddrName}
                      onChange={e => setNewAddrName(e.target.value)}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="联系电话"
                      value={newAddrPhone}
                      onChange={e => setNewAddrPhone(e.target.value)}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <input
                      type="text"
                      placeholder="区域 (默认东湾都会圈)"
                      value={newAddrRegion}
                      onChange={e => setNewAddrRegion(e.target.value)}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <textarea
                      placeholder="详细地址 (街区、门牌号)"
                      value={newAddrDetail}
                      onChange={e => setNewAddrDetail(e.target.value)}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white resize-none h-14"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddAddress}
                        className="flex-1 py-1 rounded bg-emerald-600 text-white text-xs font-bold"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setIsAddingAddress(false)}
                        className="px-3 py-1 rounded bg-white/10 text-white/60 text-xs"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(shoppingState.addresses || []).map(a => (
                    <div
                      key={a.id}
                      onClick={() => {
                        const next = { ...shoppingState, activeAddressId: a.id };
                        saveShoppingState(next);
                        setShoppingState(next);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition ${
                        shoppingState.activeAddressId === a.id
                          ? "bg-emerald-500/10 border-emerald-500/50"
                          : "bg-white/5 border-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>{a.name}</span>
                          <span className="text-[10px] text-white/40">{a.phone}</span>
                        </div>
                        <div className="text-[10px] text-emerald-300 font-medium truncate">{a.region}</div>
                        <div className="text-[10px] text-white/50 truncate">{a.detail}</div>
                      </div>
                      {(shoppingState.addresses || []).length > 1 && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteAddress(a.id);
                          }}
                          className="p-1 text-white/30 hover:text-rose-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. 地区与币种 */}
            {sidebarSubView === "currencies" && (
              <div className="flex-1 overflow-y-auto space-y-3">
                <button
                  onClick={() => setIsAddingCurrency(!isAddingCurrency)}
                  className="w-full py-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-medium flex items-center justify-center gap-1"
                >
                  <Plus size={12} />
                  <span>设立新地区 / 币种</span>
                </button>

                {isAddingCurrency && (
                  <div className="p-2.5 rounded-xl bg-black/40 border border-blue-500/30 space-y-2">
                    <input
                      type="text"
                      placeholder="地区名 (如：新港特别区)"
                      value={newCurrRegion}
                      onChange={e => setNewCurrRegion(e.target.value)}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="货币代码 (如：USD)"
                        value={newCurrCode}
                        onChange={e => setNewCurrCode(e.target.value)}
                        className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="货币符号 ($)"
                        value={newCurrSymbol}
                        onChange={e => setNewCurrSymbol(e.target.value)}
                        className="w-20 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white text-center"
                      />
                    </div>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="汇率 (相对于基准 CNY=1.0)"
                      value={newCurrRate}
                      onChange={e => setNewCurrRate(e.target.value)}
                      className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCurrency}
                        className="flex-1 py-1 rounded bg-blue-600 text-white text-xs font-bold"
                      >
                        设立
                      </button>
                      <button
                        onClick={() => setIsAddingCurrency(false)}
                        className="px-3 py-1 rounded bg-white/10 text-white/60 text-xs"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(shoppingState.currencies || DEFAULT_SHOPPING_CURRENCIES).map(c => (
                    <div
                      key={c.id}
                      onClick={() => {
                        const next = { ...shoppingState, activeCurrencyId: c.id };
                        saveShoppingState(next);
                        setShoppingState(next);
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition ${
                        shoppingState.activeCurrencyId === c.id
                          ? "bg-blue-500/10 border-blue-500/50"
                          : "bg-white/5 border-white/5 hover:border-white/20"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span>{c.regionName}</span>
                          <span className="text-[10px] text-white/40">({c.regionCode})</span>
                        </div>
                        <div className="text-[10px] text-blue-300 font-mono">
                          {c.currencyCode} · 符号 {c.symbol} · 汇率 {c.exchangeRate}
                        </div>
                      </div>
                      {(shoppingState.currencies || DEFAULT_SHOPPING_CURRENCIES).length > 1 && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            handleDeleteCurrency(c.id);
                          }}
                          className="p-1 text-white/30 hover:text-rose-400"
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

      {/* 赠送角色选择弹窗 */}
      {giftTargetItem && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-[280px] bg-[#161a24] border border-white/10 rounded-2xl p-4 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">送给哪位角色？</span>
              <button onClick={() => setGiftTargetItem(null)} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="text-[11px] text-amber-300">
              将作为{giftTargetItem.kind === "delivery" ? "即时外卖" : "心意礼物"}发送给指定角色
            </div>
            <div className="max-h-[200px] overflow-y-auto space-y-1.5">
              {characters.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleGiftToCharacter(c.id)}
                  className="w-full p-2 rounded-xl bg-white/5 hover:bg-blue-600/30 flex items-center gap-2.5 text-xs text-left"
                >
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                    {c.avatar ? <img src={c.avatar} className="w-full h-full rounded-full object-cover" /> : "👤"}
                  </div>
                  <span className="truncate flex-1 font-medium">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 商品详情弹窗 */}
      {selectedProduct && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-h-[80vh] bg-[#141824] border-t border-white/10 rounded-t-2xl p-4 space-y-3 overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between">
              <span className="text-3xl">{selectedProduct.previewIcon || "🛍️"}</span>
              <button onClick={() => setSelectedProduct(null)} className="text-white/40 hover:text-white">
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
              >
                <Heart size={16} />
              </button>
              <button
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white"
              >
                加入购物车
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 黑市彩蛋 App */}
      {blackMarketOpen && <BlackMarketApp onClose={() => setBlackMarketOpen(false)} />}
    </div>
  );
}
