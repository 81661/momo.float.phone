import { previewMessagesForApi, sendLLMRequest } from "./chat-engine";
import { loadApiConfigs, loadBindingConfig, loadWorldBooks } from "./settings-storage";
import type { CheckPhoneShoppingProduct, CheckPhoneShoppingTone } from "./checkphone-config";
import type { ApiConfig } from "./settings-types";
import type { ShoppingCatalog, ShoppingCategory, ShoppingProduct, ShoppingRefreshResult, ShoppingSearchResponse } from "./shopping-types";
import type { LLMMessage } from "./llm-prompt-assembler";

export const SHOPPING_RECOMMENDATION_CATEGORIES: Array<Pick<ShoppingCategory, "id" | "title" | "subtitle">> = [
  { id: "digital", title: "数码好物", subtitle: "小设备、桌面装备、智能配件" },
  { id: "home", title: "生活家居", subtitle: "收纳、香氛、餐厨与居家质感" },
  { id: "style", title: "穿搭配饰", subtitle: "服饰、包袋、鞋履和日常搭配" },
  { id: "beauty", title: "美妆个护", subtitle: "护肤、彩妆、身体护理和仪容工具" },
  { id: "food", title: "食品饮品", subtitle: "零食、咖啡、茶饮和轻食补给" },
  { id: "hobby", title: "文具兴趣", subtitle: "纸品、手作、阅读、运动和旅行小物" },
];

export const DELIVERY_CATEGORIES: Array<Pick<ShoppingCategory, "id" | "title" | "subtitle">> = [
  { id: "chinese", title: "中餐", subtitle: "特色热炒、品质拌饭、粉面与家常风味" },
  { id: "foreign", title: "异国料理", subtitle: "西式餐点、日韩简餐、南洋风情便当" },
  { id: "drinks", title: "饮品", subtitle: "现磨咖啡、鲜萃茶饮、冷压果汁与特调" },
  { id: "desserts", title: "甜品烘焙", subtitle: "手作烘焙、西点蛋糕、法式甜羹与冰品" },
  { id: "fruits", title: "水果生鲜", subtitle: "应季鲜果、品质切盒、有机生鲜食材" },
  { id: "convenience", title: "便利店超市", subtitle: "零食饮料、即食夜宵、个人日用急需" },
  { id: "flowers", title: "鲜花", subtitle: "礼遇花束、桌面绿植、每日鲜切花" },
  { id: "pharmacy", title: "药店", subtitle: "居家应急、常备健康、护理与急救用品" },
];

/** 提取「东湾都会圈」世界书中的地域区划与设定信息，用于注入 Prompt */
export function extractDongwanWorldContext(): string {
  try {
    const books = loadWorldBooks();
    const matched = books.filter(b => /东湾|都会圈|都会/i.test(b.name || ""));
    const lines: string[] = [];
    for (const b of matched) {
      if (b.description?.trim()) lines.push(`【世界观背景】${b.description.trim()}`);
      for (const entry of (b.entries || []).slice(0, 10)) {
        if (entry.content?.trim()) {
          const key = entry.key?.trim() ? `（${entry.key.trim()}）` : "";
          lines.push(`- ${key}${entry.content.trim().slice(0, 200)}`);
        }
      }
    }
    return lines.slice(0, 8).join("\n");
  } catch {
    return "";
  }
}

export function buildShoppingWorldConstraintHint(): string {
  const dongwan = extractDongwanWorldContext();
  const base = [
    "【重要世界观规则 - 绝对执行】：",
    "1. 世界观是完全架空的（核心设定：东湾都会圈）。严禁出现任何现实中具体的省市、县镇、现实地方小吃名或带有强烈现实地域色彩的名字（例如：绝对不要出现「安徽板面」「沙县小吃」「老北京炸酱面」「武汉热干面」「兰州拉面」等带有现实地名的商品或店铺）。",
    "2. 地名、区域、商业街、配送地址若需要提及，可融合「东湾都会圈」的设定或使用自然都市架空名（如：东湾中央区、湾港大道、云湾里、星海汇、新港路等）。",
    "3. 允许且推荐出现真实的全球商业品牌（例如：费列罗巧克力、星巴克、索尼、罗技、戴森、可口可乐等纯商业品牌均可真实自然出现）。",
  ];
  if (dongwan) {
    base.push("【关联世界书·东湾都会圈设定参考】：", dongwan);
  }
  return base.join("\n");
}

export const DEFAULT_SHOPPING_REFRESH_PROMPT = [
  "<shopping_refresh_instruction>",
  "你正在为一个独立购物 App 生成首页分类推荐商品流。",
  "",
  buildShoppingWorldConstraintHint(),
  "",
  "要求：",
  "- 只生成可以浏览和购买的首页推荐商品，不要生成最近浏览、收藏、购物车或订单。",
  "- 不要写角色、人设、记忆、剧情或旁白。",
  "- 必须按以下 6 个分类推荐，每个分类 5 到 7 条商品：",
  ...SHOPPING_RECOMMENDATION_CATEGORIES.map(category => `  - ${category.title}：${category.subtitle}`),
  "- 商品名称、店铺、价格、说明和详情都要具体，像真实可购买的商品。",
  "- [详情] 写商品本身的材质、规格、用途、质感、适用场景，不要写推荐理由或系统解释。",
  "- [图标] 用单个直观、美观、和商品强相关的 emoji 或符号。",
  "",
  "输出格式：",
  "#推荐1",
  "[分类]数码好物",
  "[名称]商品名称",
  "[店铺]店铺名称",
  "[价格]¥99",
  "[说明]列表短说明",
  "[详情]商品详情文本",
  "[图标]商品图标",
  "",
  "#推荐2",
  "[分类]数码好物",
  "[名称]商品名称",
  "[店铺]店铺名称",
  "[价格]¥199",
  "[说明]列表短说明",
  "[详情]商品详情文本",
  "[图标]商品图标",
  "",
  "规则：",
  "- 每条商品都必须有 [分类]，且分类名只能使用上面 6 个分类名。",
  "- 每个分类连续输出 5 到 7 条商品，所有商品使用连续编号，例如 #推荐1、#推荐2、#推荐3。",
  "- 不要输出 #最近浏览、#收藏、#购物车、#订单；这些由用户交互产生。",
  "- 示例字段值都是占位说明，实际输出必须替换成真实商品内容。",
  "- 只输出上述块格式内容，不要输出 Markdown、解释、代码块或 JSON。",
  "</shopping_refresh_instruction>",
].join("\n");

export const DEFAULT_DELIVERY_REFRESH_PROMPT = [
  "<delivery_refresh_instruction>",
  "你正在为一个外卖即时配送 App 生成外卖店铺与餐品推荐流。",
  "",
  buildShoppingWorldConstraintHint(),
  "",
  "要求：",
  "- 属于即时配送的真实外卖店铺、轻食、饮品、便利商超与日常急需。",
  "- 必须按以下 8 个分类推荐，每个分类 3 到 5 家精选外卖店铺/餐品：",
  ...DELIVERY_CATEGORIES.map(category => `  - ${category.title}：${category.subtitle}`),
  "- 店铺名称要鲜活真实、有市井或都市特色，但绝对不可出现带有现实省市地名的招牌（如安徽、沙县等）。",
  "- 每条外卖餐品价格合理，[说明] 中标注预计送达时间（例如：28分钟·起送¥20·配送¥3）。",
  "- [详情] 写餐品的份量、口感、食材搭配、温热冷饮状态或规格。",
  "- [图标] 用单个美味、相关的食物/用品 emoji。",
  "",
  "输出格式：",
  "#外卖1",
  "[分类]中餐",
  "[名称]黑椒牛柳葱香拌饭配温泉蛋",
  "[店铺]慢火煲仔社·东湾中央店",
  "[价格]¥36",
  "[说明]30分钟送达·月售800+·配送¥3",
  "[详情]精选牛里脊搭配秘制现熬黑椒酱，现煎温泉蛋，搭配每日鲜蔬与越光米饭。",
  "[图标]🍱",
  "",
  "#外卖2",
  "[分类]饮品",
  "[名称]生椰冷萃冰咖啡",
  "[店铺]星芒工坊精品咖啡（星海汇店）",
  "[价格]¥24",
  "[说明]25分钟送达·配保温袋·配送¥2",
  "[详情]天然椰子水与冷萃浓缩分层交融，清甜回甘，零糖无负担。",
  "[图标]☕",
  "",
  "规则：",
  "- 每条外卖都必须有 [分类]，且分类名只能使用上面 8 个外卖分类名。",
  "- 编号格式为 #外卖1、#外卖2、#外卖3 等依次连续编号。",
  "- 只输出上述块格式内容，不要输出 Markdown 总结或系统解释。",
  "</delivery_refresh_instruction>",
].join("\n");

export const DEFAULT_SHOPPING_SEARCH_PROMPT = [
  "<shopping_search_instruction>",
  "你正在为一个独立购物/外卖 App 的搜索词“{{query}}”生成搜索结果商品流。",
  "",
  buildShoppingWorldConstraintHint(),
  "",
  "要求：",
  "- 只生成与搜索词“{{query}}”高度相关、可以浏览和购买的商品或外卖。",
  "- 遵守架空世界观：严禁出现现实省市具体地名（如安徽、东北、沙县等），可使用东湾都会圈或商业品牌。",
  "- 商品要覆盖不同价位、不同风格和不同使用场景，但都必须围绕搜索词。",
  "- 商品名称、店铺、价格、说明和详情都要具体，像真实可购买的商品。",
  "- [详情] 写商品或餐品的本身的材质、规格、用途、质感、适用场景。",
  "- [图标] 用单个直观、美观、和商品强相关的 emoji 或符号。",
  "",
  "输出格式：",
  "#搜索结果1",
  "[分类]所属分类",
  "[名称]商品名称",
  "[店铺]店铺名称",
  "[价格]价格",
  "[说明]列表短说明",
  "[详情]商品详情文本",
  "[图标]商品图标",
  "",
  "#搜索结果2",
  "[分类]所属分类",
  "[名称]商品名称",
  "[店铺]店铺名称",
  "[价格]价格",
  "[说明]列表短说明",
  "[详情]商品详情文本",
  "[图标]商品图标",
  "",
  "规则：",
  "- 生成 10 到 16 条搜索结果。",
  "- 所有商品使用连续编号，例如 #搜索结果1、#搜索结果2、#搜索结果3。",
  "- 只输出上述块格式内容，不要输出 Markdown、解释、代码块或 JSON。",
  "</shopping_search_instruction>",
].join("\n");

type ParsedRecommendationBlock = {
  order: number;
  fields: Record<string, string>;
};

function resolveShoppingApiConfig(): ApiConfig | null {
  const configs = loadApiConfigs();
  const binding = loadBindingConfig();
  if (binding.globalDefaults.apiConfigId) {
    return configs.find(config => config.id === binding.globalDefaults.apiConfigId) ?? null;
  }
  return configs[0] ?? null;
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function deriveTone(index: number): CheckPhoneShoppingTone {
  const tones: CheckPhoneShoppingTone[] = ["ivory", "mist", "blush", "graphite"];
  return tones[index % tones.length];
}

function stripJsonWrapperNoise(text: string): string {
  return text
    .replace(/^\s*```(?:json|text|markdown)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function parseTaggedFields(source: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let activeKey = "";
  const lines = source.replace(/\r/g, "").split("\n");

  for (const line of lines) {
    const match = line.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
    if (match) {
      activeKey = match[1].trim();
      fields[activeKey] = match[2].trim();
      continue;
    }
    if (activeKey && line.trim()) {
      fields[activeKey] = `${fields[activeKey]}\n${line.trim()}`.trim();
    }
  }

  return fields;
}

function extractProductBlocks(rawOutput: string, labels: string[]): ParsedRecommendationBlock[] {
  const source = stripJsonWrapperNoise(rawOutput);
  const labelPattern = labels.map(label => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const matches = [...source.matchAll(new RegExp(`^#\\s*(?:${labelPattern})(\\d+)\\s*$`, "gm"))];
  const allHeadings = [...source.matchAll(/^#\s*\S.*$/gm)];
  return matches.map((current, index) => {
    const start = (current.index ?? 0) + current[0].length;
    const next = allHeadings.find((match) => (match.index ?? 0) > (current.index ?? 0));
    const end = next?.index ?? source.length;
    return {
      order: Number(current[1]) || index + 1,
      fields: parseTaggedFields(source.slice(start, end).trim()),
    };
  });
}

function resolveShoppingCategory(value: string): Pick<ShoppingCategory, "id" | "title" | "subtitle"> {
  const normalized = cleanText(value, 80);
  return (
    SHOPPING_RECOMMENDATION_CATEGORIES.find(category => category.title === normalized) ??
    SHOPPING_RECOMMENDATION_CATEGORIES[0]
  );
}

function resolveDeliveryCategory(value: string): Pick<ShoppingCategory, "id" | "title" | "subtitle"> {
  const normalized = cleanText(value, 80);
  return (
    DELIVERY_CATEGORIES.find(category => category.title === normalized) ??
    DELIVERY_CATEGORIES[0]
  );
}

function parseShoppingProduct(
  block: ParsedRecommendationBlock,
  index: number,
  kind: "shopping" | "delivery" = "shopping",
): { category: Pick<ShoppingCategory, "id" | "title" | "subtitle">; product: ShoppingProduct | null } {
  const fields = block.fields;
  const category = kind === "delivery"
    ? resolveDeliveryCategory(fields["分类"])
    : resolveShoppingCategory(fields["分类"]);
  const title = cleanText(fields["名称"], 200);
  const merchantLabel = cleanText(fields["店铺"], 120);
  const priceLabel = cleanText(fields["价格"], 80);
  const subtitle = cleanText(fields["说明"] || fields["详情"] || fields["名称"], 400);
  const detail = cleanText(fields["详情"] || subtitle, 1200);
  const previewIcon = cleanText(fields["图标"], 8);

  if (!title || !merchantLabel || !priceLabel || !subtitle || !detail || !previewIcon) {
    return { category, product: null };
  }

  const signature = `${kind}|${category.title}|${title}|${merchantLabel}|${priceLabel}|${previewIcon}`;
  const estimatedDeliveryMinutes = kind === "delivery"
    ? Math.floor(Math.random() * 25) + 20
    : undefined;

  return {
    category,
    product: {
      id: `${kind}_${hashString(signature)}`,
      title,
      merchantLabel,
      priceLabel,
      tagLabel: category.title,
      subtitle,
      detail,
      previewIcon,
      tone: deriveTone(index),
      kind,
      estimatedDeliveryMinutes,
      packingFee: kind === "delivery" ? 2 : 0,
    },
  };
}

function parseSearchProduct(
  block: ParsedRecommendationBlock,
  query: string,
  index: number,
): ShoppingProduct | null {
  const fields = block.fields;
  const title = cleanText(fields["名称"], 200);
  const merchantLabel = cleanText(fields["店铺"], 120);
  const priceLabel = cleanText(fields["价格"], 80);
  const subtitle = cleanText(fields["说明"] || fields["详情"] || fields["名称"], 400);
  const detail = cleanText(fields["详情"] || subtitle, 1200);
  const previewIcon = cleanText(fields["图标"], 8);
  const tagLabel = cleanText(fields["分类"], 80) || `搜索：${query}`;
  const isDelivery = /外卖|餐|饭|茶|面|饮|食|菜|甜点|果/i.test(`${title} ${merchantLabel} ${tagLabel}`);
  const kind = isDelivery ? "delivery" : "shopping";

  if (!title || !merchantLabel || !priceLabel || !subtitle || !detail || !previewIcon) {
    return null;
  }

  const signature = `${query}|${title}|${merchantLabel}|${priceLabel}|${previewIcon}`;
  return {
    id: `search_${hashString(signature)}`,
    title,
    merchantLabel,
    priceLabel,
    tagLabel,
    subtitle,
    detail,
    previewIcon,
    tone: deriveTone(index),
    kind,
    estimatedDeliveryMinutes: kind === "delivery" ? 30 : undefined,
  };
}

export function parseShoppingCatalog(rawOutput: string): ShoppingCatalog | null {
  const grouped = new Map<string, ShoppingCategory>();
  for (const category of SHOPPING_RECOMMENDATION_CATEGORIES) {
    grouped.set(category.id, {
      id: category.id,
      title: category.title,
      subtitle: category.subtitle,
      items: [],
    });
  }

  const blocks = extractProductBlocks(rawOutput, ["推荐", "商品", "好物"]);
  const recommendations: ShoppingProduct[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const { category, product } = parseShoppingProduct(blocks[index], index, "shopping");
    if (!product) continue;
    recommendations.push(product);
    const existing = grouped.get(category.id);
    if (existing) {
      existing.items.push(product);
    } else {
      grouped.set(category.id, {
        id: category.id,
        title: category.title,
        subtitle: category.subtitle,
        items: [product],
      });
    }
  }

  const categories = [...grouped.values()].filter(category => category.items.length > 0);
  if (categories.length === 0 && recommendations.length === 0) {
    return null;
  }

  return {
    categories,
    recommendations,
  };
}

export function parseDeliveryCatalog(rawOutput: string): ShoppingCatalog | null {
  const grouped = new Map<string, ShoppingCategory>();
  for (const category of DELIVERY_CATEGORIES) {
    grouped.set(category.id, {
      id: category.id,
      title: category.title,
      subtitle: category.subtitle,
      items: [],
    });
  }

  const blocks = extractProductBlocks(rawOutput, ["外卖", "美食", "店铺", "推荐", "商品"]);
  const recommendations: ShoppingProduct[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const { category, product } = parseShoppingProduct(blocks[index], index, "delivery");
    if (!product) continue;
    recommendations.push(product);
    const existing = grouped.get(category.id);
    if (existing) {
      existing.items.push(product);
    } else {
      grouped.set(category.id, {
        id: category.id,
        title: category.title,
        subtitle: category.subtitle,
        items: [product],
      });
    }
  }

  const categories = [...grouped.values()].filter(category => category.items.length > 0);
  if (categories.length === 0 && recommendations.length === 0) {
    return null;
  }

  return {
    categories,
    recommendations,
  };
}

export async function generateShoppingCatalog(customPrompt?: string): Promise<ShoppingRefreshResult> {
  const apiConfig = resolveShoppingApiConfig();
  if (!apiConfig) {
    return { catalog: null, error: "未找到可用的 API 配置，请先在设置中绑定模型。" };
  }

  const systemContent = [
    "你是一个严谨的结构化商品生成引擎。",
    buildShoppingWorldConstraintHint(),
    "严格按照指定的标记与编号输出真实具体的商品信息，绝不输出闲聊、代码块或 JSON。",
  ].join("\n\n");

  const prompt = cleanText(customPrompt, 16000) || DEFAULT_SHOPPING_REFRESH_PROMPT;
  const messages: LLMMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: prompt },
  ];

  try {
    const response = await sendLLMRequest(
      apiConfig,
      null,
      messages,
      [],
      { characterName: "购物助手" },
      { appId: "checkphone" },
    );
    const catalog = parseShoppingCatalog(response);
    return {
      catalog,
      rawOutput: response,
      error: catalog ? undefined : "模型返回的内容未包含可解析的推荐商品块。",
    };
  } catch (error) {
    return {
      catalog: null,
      error: error instanceof Error ? error.message : "生成商品推荐失败，请重试。",
    };
  }
}

export async function generateDeliveryCatalog(customPrompt?: string): Promise<ShoppingRefreshResult> {
  const apiConfig = resolveShoppingApiConfig();
  if (!apiConfig) {
    return { catalog: null, error: "未找到可用的 API 配置，请先在设置中绑定模型。" };
  }

  const systemContent = [
    "你是一个严谨的结构化外卖生成引擎。",
    buildShoppingWorldConstraintHint(),
    "严格按照指定的标记与编号输出真实鲜活的外卖店铺与餐品，绝不输出闲聊、代码块或 JSON。",
  ].join("\n\n");

  const prompt = cleanText(customPrompt, 16000) || DEFAULT_DELIVERY_REFRESH_PROMPT;
  const messages: LLMMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: prompt },
  ];

  try {
    const response = await sendLLMRequest(
      apiConfig,
      null,
      messages,
      [],
      { characterName: "外卖助手" },
      { appId: "checkphone" },
    );
    const catalog = parseDeliveryCatalog(response);
    return {
      catalog,
      rawOutput: response,
      error: catalog ? undefined : "模型返回的内容未包含可解析的外卖推荐块。",
    };
  } catch (error) {
    return {
      catalog: null,
      error: error instanceof Error ? error.message : "生成外卖推荐失败，请重试。",
    };
  }
}

export async function generateShoppingSearchResults(
  query: string,
  customPrompt?: string,
): Promise<ShoppingSearchResponse> {
  const apiConfig = resolveShoppingApiConfig();
  if (!apiConfig) {
    return { result: null, error: "未找到可用的 API 配置，请先在设置中绑定模型。" };
  }

  const normalizedQuery = cleanText(query, 80);
  if (!normalizedQuery) {
    return { result: null, error: "搜索词不能为空。" };
  }

  const systemContent = [
    "你是一个严谨的结构化商品搜索结果生成引擎。",
    buildShoppingWorldConstraintHint(),
    "严格按照指定的标记与编号输出与搜索词相关的商品，绝不输出闲聊、代码块或 JSON。",
  ].join("\n\n");

  const promptTemplate = cleanText(customPrompt, 16000) || DEFAULT_SHOPPING_SEARCH_PROMPT;
  const userPrompt = promptTemplate.replace(/\{\{query\}\}/gi, normalizedQuery);
  const messages: LLMMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userPrompt },
  ];

  try {
    const response = await sendLLMRequest(
      apiConfig,
      null,
      messages,
      [],
      { characterName: "购物搜索助手" },
      { appId: "checkphone" },
    );
    const blocks = extractProductBlocks(response, ["搜索结果", "结果", "商品"]);
    const items = blocks
      .map((block, index) => parseSearchProduct(block, normalizedQuery, index))
      .filter((item): item is ShoppingProduct => Boolean(item));

    if (items.length === 0) {
      return {
        result: null,
        rawOutput: response,
        error: "未能从模型回复中解析出搜索商品。",
      };
    }

    return {
      result: {
        query: normalizedQuery,
        items,
        generatedAt: new Date().toISOString(),
      },
      rawOutput: response,
    };
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error.message : "搜索生成失败，请重试。",
    };
  }
}
