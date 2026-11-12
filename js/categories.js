import { hasIcon } from './icons.js';

export const PALETTE = [
  '#FF8A34', '#FF6B6B', '#FF6B9A', '#F5A524',
  '#1FCB8C', '#2EC9A0', '#14B8A6', '#4C8DFF',
  '#7C6BF5', '#A78BFA', '#64748B', '#9AA3AF',
];

export const PAY_METHODS = [
  { id: 'wechat', name: '微信' },
  { id: 'alipay', name: '支付宝' },
  { id: 'cash', name: '现金' },
  { id: 'card', name: '银行卡' },
];

export function payName(id) {
  return PAY_METHODS.find((p) => p.id === id)?.name || '';
}

export function safeColor(c) {
  return /^#[0-9A-Fa-f]{6}$/.test(c || '') ? c : '#9AA3AF';
}

export function safeIcon(name) {
  return hasIcon(name) ? name : 'more';
}

/** Preset expense categories, in 记一笔 order. 其他 is the fallback and cannot be deleted. */
export function presetBlueprints() {
  return [
    { type: 'expense', name: '餐饮', icon: 'utensils', color: '#FF8A34' },
    { type: 'expense', name: '交通', icon: 'bus', color: '#4C8DFF' },
    { type: 'expense', name: '学习', icon: 'book', color: '#7C6BF5' },
    { type: 'expense', name: '娱乐', icon: 'film', color: '#FF6B9A' },
    { type: 'expense', name: '日用', icon: 'bag', color: '#2EC9A0' },
    { type: 'expense', name: '其他', icon: 'more', color: '#9AA3AF', isFallback: true },
    { type: 'income', name: '生活费', icon: 'wallet', color: '#2EC9A0' },
    { type: 'income', name: '兼职', icon: 'briefcase', color: '#4C8DFF' },
    { type: 'income', name: '奖助学金', icon: 'award', color: '#7C6BF5' },
    { type: 'income', name: '红包', icon: 'gift', color: '#FF6B6B' },
    { type: 'income', name: '其他', icon: 'more', color: '#9AA3AF', isFallback: true },
  ];
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildPresetCategories() {
  const order = { expense: 0, income: 0 };
  return presetBlueprints().map((b) => ({
    id: newId(),
    type: b.type,
    name: b.name,
    icon: b.icon,
    color: b.color,
    isFallback: !!b.isFallback,
    order: order[b.type]++,
  }));
}

const ALI = {
  餐饮美食: '餐饮',
  交通出行: '交通',
  日用百货: '日用',
  文化休闲: '娱乐',
  娱乐休闲: '娱乐',
  运动户外: '娱乐',
  教育培训: '学习',
  医疗健康: '医疗',
  服饰装扮: '日用',
  美容美发: '日用',
  住房物业: '日用',
  通讯物流: '日用',
  酒店旅游: '娱乐',
  充值缴费: '日用',
  爱心捐赠: '其他',
  保险: '其他',
  公益: '其他',
};

const EXPENSE_RULES = [
  [/美团单车|美团骑行|共享单车|哈啰|青桔|滴滴|高德|地铁|公交|高铁|火车|12306|机票|航班|停车|加油|打车|出租|出行|乘车|中石油|中石化|充电桩|通行/, '交通'],
  [/美团|饿了么|食堂|奶茶|咖啡|外卖|火锅|烧烤|肯德基|麦当劳|星巴克|喜茶|瑞幸|茶百道|库迪|汉堡|早餐|午餐|晚餐|夜宵|小吃|沙县|黄焖鸡|拉面|米线|麻辣烫|必胜客|食品|水果|烘焙|面包|饮品|餐厅|饭店|餐|饭/, '餐饮'],
  [/教材|书店|打印|复印|文具|课程|学费|考试|考研|网课|图书馆|论文|二手书/, '学习'],
  [/电影|影城|万达影|游戏|腾讯视频|爱奇艺|优酷|网易云|音乐|哔哩|bilibili|KTV|ktv|演出|门票|steam|娱乐/, '娱乐'],
  [/医院|药店|药房|诊所|挂号|体检|口腔|医保/, '医疗'],
  [/超市|便利店|沃尔玛|盒马|永辉|洗衣|话费|水电|物业|日用|洗发|牙膏|百货/, '日用'],
];

export function suggestCategoryName({ type, text, kind }) {
  const blob = `${kind || ''} ${text || ''}`;
  if (type === 'income') {
    if (/奖助学金|奖学金|助学金/.test(blob)) return '奖助学金';
    if (/红包/.test(blob)) return '红包';
    if (/兼职|工资|劳务|薪资|实习|稿费/.test(blob)) return '兼职';
    if (/生活费/.test(blob)) return '生活费';
    return '其他';
  }
  if (kind && ALI[kind]) return ALI[kind];
  for (const [re, name] of EXPENSE_RULES) {
    if (re.test(blob)) return name;
  }
  return '其他';
}

export function resolveCategoryId(name, type, categories) {
  const list = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  const hit = list.find((c) => c.name === name);
  if (hit) return hit.id;
  const fb = list.find((c) => c.isFallback) || list[list.length - 1];
  return fb ? fb.id : '';
}

export function mapPayMethod(raw, source) {
  const s = String(raw || '');
  if (/现金/.test(s)) return 'cash';
  if (/花呗|余额宝|支付宝/.test(s)) return 'alipay';
  if (/银行|储蓄卡|信用卡|借记/.test(s)) return 'card';
  if (/微信|零钱/.test(s)) return 'wechat';
  if (source === 'wechat') return 'wechat';
  if (source === 'alipay') return 'alipay';
  return '';
}

export function defaultSettings() {
  return {
    key: 'settings',
    monthlyBudget: null,
    categoryBudgets: {},
    savings: null,
    lastBackupAt: null,
    lastPayMethod: '',
  };
}
