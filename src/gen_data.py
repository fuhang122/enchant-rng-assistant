# -*- coding: utf-8 -*-
"""从 26.3 原版数据生成附魔/物品数据表（build/data.json）"""
import json, os

cn = {
'aqua_affinity':'水下速掘','bane_of_arthropods':'节肢杀手','binding_curse':'绑定诅咒',
'blast_protection':'爆炸保护','breach':'破甲','channeling':'引雷','density':'密度',
'depth_strider':'深海探索者','efficiency':'效率','feather_falling':'摔落保护',
'fire_aspect':'火焰附加','fire_protection':'火焰保护','flame':'火矢','fortune':'时运',
'frost_walker':'冰霜行者','impaling':'穿刺','infinity':'无限','knockback':'击退',
'looting':'抢夺','loyalty':'忠诚','luck_of_the_sea':'海之眷顾','lure':'饵钓',
'lunge':'突刺','mending':'经验修补','multishot':'多重射击','piercing':'穿透','power':'力量',
'projectile_protection':'弹射物保护','protection':'保护','punch':'冲击','quick_charge':'快速装填',
'respiration':'水下呼吸','riptide':'激流','sharpness':'锋利','silk_touch':'精准采集',
'smite':'亡灵杀手','soul_speed':'灵魂疾行','sweeping_edge':'横扫之刃','swift_sneak':'迅捷潜行',
'thorns':'荆棘','unbreaking':'耐久','vanishing_curse':'消失诅咒','wind_burst':'风爆'}

# ---------------- 物品（材质顺序：木 石 铜 铁 金 钻石 下界合金） ----------------
SW = ['wooden', 'stone', 'copper', 'iron', 'golden', 'diamond', 'netherite']
SWcn = {'wooden':'木','stone':'石','copper':'铜','iron':'铁','golden':'金','diamond':'钻石','netherite':'下界合金'}
ench_tool = {'wooden':15,'stone':5,'copper':13,'iron':14,'golden':22,'diamond':10,'netherite':15}
ench_armor = {'leather':15,'chainmail':12,'copper':8,'iron':9,'golden':25,'diamond':10,'netherite':15}
armorcn = {'leather':'皮革','chainmail':'锁链','copper':'铜','iron':'铁','golden':'金','diamond':'钻石','netherite':'下界合金'}
ARM = ['leather','chainmail','copper','iron','golden','diamond','netherite']

items = []
def add(key, name, en, tags, group):
    items.append({'key':key,'name':name,'en':en,'tags':tags,'group':group})

for m in SW:
    add(m+'_sword', SWcn[m]+'剑', ench_tool[m],
        ['sword','melee_weapon','sharp_weapon','weapon','durability','fire_aspect','vanishing'], '剑')
for m in SW:
    add(m+'_axe', SWcn[m]+'斧', ench_tool[m],
        ['axe','mining','mining_loot','sharp_weapon','weapon','durability','vanishing'], '斧')
for m in SW:
    add(m+'_pickaxe', SWcn[m]+'镐', ench_tool[m],
        ['pickaxe','mining','mining_loot','durability','vanishing'], '镐')
for m in SW:
    add(m+'_shovel', SWcn[m]+'锹', ench_tool[m],
        ['shovel','mining','mining_loot','durability','vanishing'], '锹')
for m in SW:
    add(m+'_hoe', SWcn[m]+'锄', ench_tool[m],
        ['hoe','mining','mining_loot','durability','vanishing'], '锄')
for slot, slcn, tag in [('helmet','头盔','head_armor'),('chestplate','胸甲','chest_armor'),
                        ('leggings','护腿','leg_armor'),('boots','靴子','foot_armor')]:
    for m in ARM:
        add(m+'_'+slot, armorcn[m]+slcn, ench_armor[m],
            [tag,'armor','durability','equippable','vanishing'], '盔甲' if slot == 'chestplate' else slcn)
add('turtle_helmet','海龟壳',9,['head_armor','armor','durability','equippable','vanishing'],'头盔')
add('bow','弓',1,['bow','durability','vanishing'],'远程')
add('crossbow','弩',1,['crossbow','durability','vanishing'],'远程')
add('trident','三叉戟',1,['trident','durability','vanishing'],'远程')
add('fishing_rod','钓鱼竿',1,['fishing','durability','vanishing'],'工具')
add('mace','重锤',15,['mace','weapon','durability','fire_aspect','vanishing'],'工具')
add('shears','剪刀',1,['mining','durability','vanishing'],'工具')
add('book','书（附魔书）',1,[],'其他')
for m in SW:                                   # 1.21.11 长矛
    add(m+'_spear', SWcn[m]+'矛', ench_tool[m],
        ['spear','melee_weapon','sharp_weapon','weapon','durability','fire_aspect','vanishing'],
        '长矛（1.21.11+）')

# ---------------- 标签 ----------------
tagitems = {}
for it in items:
    for t in it['tags']:
        tagitems.setdefault(t, []).append(it['key'])

TAGMAP = {   # 数据包标签名 -> 我的标签集合
 'head_armor':['head_armor'], 'chest_armor':['chest_armor'], 'leg_armor':['leg_armor'], 'foot_armor':['foot_armor'],
 'armor':['head_armor','chest_armor','leg_armor','foot_armor'],
 'durability':['durability'], 'equippable':['equippable'], 'vanishing':['vanishing'],
 'mining':['mining'], 'mining_loot':['mining_loot'], 'sword':['sword'],
 'sharp_weapon':['sharp_weapon'], 'melee_weapon':['melee_weapon'], 'sweeping':['sword'],
 'lunge':['spear'], 'weapon':['weapon'], 'fire_aspect':['fire_aspect'],
 'bow':['bow'], 'crossbow':['crossbow'], 'trident':['trident'], 'fishing':['fishing'], 'mace':['mace']}

def expand(tagstr):
    if not tagstr:
        return []
    name = tagstr.split('/')[-1].split(':')[-1]
    res = []
    for t in TAGMAP.get(name, []):
        res += tagitems.get(t, [])
    return sorted(set(res))

# ---------------- 附魔（26.3 数据包） ----------------
non_treasure = [x.split(':')[1] for x in
                json.load(open('t263/_tags_enchantment_non_treasure.json'))['values']]
ench = []
for eid in sorted(non_treasure):
    d = json.load(open('e263/' + eid + '.json'))
    ex = d.get('exclusive_set')
    ench.append({
        'id': eid, 'name': cn.get(eid, eid), 'max': d['max_level'], 'w': d['weight'],
        'minB': d['min_cost']['base'], 'minP': d['min_cost'].get('per_level_above_first', 0),
        'maxB': d['max_cost']['base'], 'maxP': d['max_cost'].get('per_level_above_first', 0),
        'sup': expand(d.get('supported_items')), 'pri': expand(d.get('primary_items')),
        'excl': ex.split('/')[-1] if ex else None})

excl = {
 'armor':['protection','blast_protection','fire_protection','projectile_protection'],
 'boots':['frost_walker','depth_strider'],
 'bow':['infinity','mending'],
 'crossbow':['multishot','piercing'],
 'damage':['sharpness','smite','bane_of_arthropods','impaling','density','breach'],
 'mining':['fortune','silk_touch'],
 'riptide':['loyalty','channeling'],
}

out = {'items': items, 'ench': ench, 'excl': excl}
os.makedirs('build', exist_ok=True)
json.dump(out, open('build/data.json', 'w'), ensure_ascii=False, indent=0)
print(len(items), len(ench))

# ---------------- 自检 ----------------
def poss(item, e):
    key = item['key']; res = []
    for x in ench:
        ok = (key in x['pri']) if x['pri'] else (key in x['sup'])
        if key == 'book':
            ok = True
        if not ok:
            continue
        for L in range(x['max'], 0, -1):
            mn = x['minB'] + (L-1)*x['minP']; mx = x['maxB'] + (L-1)*x['maxP']
            if mn <= e <= mx:
                res.append(x['id'] + str(L)); break
    return res

for k in ['copper_sword','copper_pickaxe','copper_spear','diamond_sword','book']:
    it = [i for i in items if i['key'] == k][0]
    print(k, poss(it, 30))
