/* ============================================================
   課表、12 週計畫、日常菜單、檢測
   每個項目的份量依程度給三個值：[入門, 中階, 進階]
   ============================================================ */
const PLAN_DATA = (() => {
const a3 = v => (Array.isArray(v) ? v : [v, v, v]);
/* 份量寫法 */
const M = (a, b, c) => ({ k: 'min', v: b === undefined ? [a, a, a] : [a, b, c] });        // 分鐘
const S = (s, r) => ({ k: 'sets', s: a3(s), r: a3(r) });                                   // 組 × 次
const H = (s, sec) => ({ k: 'hold', s: a3(s), sec: a3(sec) });                             // 組 × 秒（撐住）
const I = (w, r, n, g) => ({ k: 'int', w: a3(w), r: a3(r), n: a3(n), g: a3(g === undefined ? 1 : g) }); // 間歇：動/休 × 回 × 組
const C = (gap, n, s) => ({ k: 'call', gap: a3(gap), n: a3(n), s: a3(s) });                // 步法點位：間隔秒、點數、組數
const T = v => ({ k: 'txt', v: a3(v) });                                                   // 文字
/* 項目：lv = 最低程度、mx = 最高程度（0 入門 1 中階 2 進階） */
const it = (x, rx, o) => Object.assign({ x, rx }, o || {});

const LEVELS = [
  { n: '入門', d: '剛開始打，或高遠球還打不到底線、步法還不熟。' },
  { n: '中階', d: '規律打球，基本球路都會，想提升穩定度、步法和體能。' },
  { n: '進階', d: '有比賽或球隊訓練經驗，能承受高強度間歇和多球。' }
];

/* 共用段落 */
const WU_COURT = () => ({ t: '暖身', fix: 1, items: [
  it('wu_pulse', M(3)), it('wu_joint', T('各 8–10 圈')), it('wu_dynamic', T('每個動作 8–10 下')),
  it('wu_activate', T('各 10 秒 × 2')), it('wu_shadow', T('各 10 下')), it('wu_rally', M(5))
] });
const WU_OFF = () => ({ t: '暖身', fix: 1, items: [
  it('wu_pulse', M(3)), it('wu_joint', T('各 8–10 圈')), it('wu_dynamic', T('每個動作 8–10 下')), it('wu_activate', T('各 10 秒 × 2'))
] });
const WU_HOME = () => ({ t: '暖身', fix: 1, items: [
  it('wu_joint', T('各 8–10 圈')), it('wu_shadow', T('各 10 下'))
] });
const CL_COURT = () => ({ t: '收操', fix: 1, items: [
  it('cl_walk', M(3)), it('cl_lower', T('每個部位 30 秒')), it('cl_upper', T('每個部位 30 秒'))
] });
const CL_OFF = () => ({ t: '收操', fix: 1, items: [
  it('cl_lower', T('每個部位 30 秒')), it('cl_back', T('約 3 分鐘'))
] });
const CL_ARM = () => ({ t: '收操', fix: 1, items: [it('cl_upper', T('每個部位 30 秒'))] });

/* ---------------- 計畫課表 ---------------- */
const SESS = {
  /* ===== 第一期：基礎 ===== */
  p1cA: {
    n: '基本功：高遠球與發球', kind: 'court', ppl: 2, dur: [75, 90, 100],
    goal: '把球打高、打深、打到位。這一堂不求快，只求每一拍的動作正確。',
    blocks: [
      WU_COURT(),
      { t: '步法', items: [it('fw_ready', S(2, '10 次')), it('fw_six', S([2, 3, 3], '2 輪'))] },
      { t: '後場', items: [
        it('tc_clear', M(8, 10, 12), { note: '先直線，後半段換對角' }),
        it('tc_drop_lift', M(8, 10, 12), { note: '時間過半交換角色' })
      ] },
      { t: '網前與發球', items: [it('tc_net', M(5, 6, 8)), it('tc_serve', M(6, 8, 8))] },
      { t: '比賽', fix: 1, items: [
        it('gm_match', T(['1–2 局', '2–3 局', '3 局以上']), { note: '上場重點：每一顆高遠球都打到後發球線之後' })
      ] },
      CL_COURT()
    ]
  },
  p1cB: {
    n: '前後場連貫', kind: 'court', ppl: 2, dur: [75, 90, 100],
    goal: '把後場和網前接起來：打完一拍就移動，不站著看球。',
    blocks: [
      WU_COURT(),
      { t: '步法', items: [it('fw_front', S([2, 3, 3], '左右各 8 次')), it('fw_rear', S([2, 3, 3], '左右各 6 次'))] },
      { t: '前後連貫', items: [
        it('tc_drop_lift', M(10), { mx: 0, note: '時間過半交換角色' }),
        it('tc_four', M(10, 10, 12), { lv: 1, note: '時間過半交換角色' })
      ] },
      { t: '中場與前三拍', items: [
        it('tc_drive', M(5, 6, 8)),
        it('tc_serve', M(6), { mx: 0 }),
        it('tc_third', M(8, 8, 10), { lv: 1 })
      ] },
      { t: '對抗', fix: 1, items: [
        it('tc_half', T(['11 分 × 2 局', '15 分 × 2 局', '15 分 × 3 局'])),
        it('gm_match', T('剩餘時間打比賽'))
      ] },
      CL_COURT()
    ]
  },
  p1oX: {
    n: '下肢與核心肌力', kind: 'off', ppl: 1, dur: [40, 50, 55],
    goal: '練出能撐住蹬跨和急停的腿與核心。動作慢、做完整。',
    blocks: [
      WU_OFF(),
      { t: '下肢', items: [
        it('st_squat', S([2, 3, 3], ['10 下', '12 下', '12 下（加重量）'])),
        it('st_lunge', S([2, 3, 3], ['每邊 5 下', '每邊 6 下', '每邊 8 下'])),
        it('st_rdl', S([2, 3, 3], '每邊 8 下')),
        it('st_calf', S([2, 3, 3], ['12 下', '15 下', '單腳 12 下'])),
        it('st_bridge', S([2, 3, 3], ['12 下', '單腳每邊 10 下', '單腳每邊 12 下']))
      ] },
      { t: '核心', items: [
        it('st_plank', H([2, 3, 3], [30, 45, 60])),
        it('st_side_plank', H([2, 2, 3], [20, 30, 40]), { note: '左右各做' }),
        it('st_deadbug', S([2, 3, 3], '每邊 8 下'))
      ] },
      { t: '肩部保養', items: [it('st_er', S([2, 2, 3], '每邊 15 下')), it('st_ytw', S([2, 2, 3], '各 8 下'))] },
      CL_OFF()
    ]
  },
  p1oY: {
    n: '步法與有氧', kind: 'off', ppl: 1, dur: [35, 45, 50],
    goal: '把六個點的步伐走對，同時打有氧的底。',
    blocks: [
      WU_OFF(),
      { t: '步法', items: [
        it('fw_ready', S(2, '10 次')),
        it('fw_six', S([3, 4, 4], '2 輪'), { note: '慢速，每一步都走對' }),
        it('fw_two', S([2, 3, 4], '每條路線 10 趟')),
        it('fw_random', C([3.5, 2.5, 2], [16, 20, 24], [2, 3, 3]))
      ] },
      { t: '有氧', items: [it('cd_rope', I(60, 30, [3, 4, 5])), it('cd_easy', M(10, 15, 20))] },
      CL_OFF()
    ]
  },
  p1oZ: {
    n: '居家球感', kind: 'off', ppl: 1, dur: [25, 30, 35],
    goal: '不用球場也能練的手上功夫：握拍、手指發力、控球。',
    blocks: [
      WU_HOME(),
      { t: '握拍與控球', items: [
        it('so_grip', S(3, '30 下')),
        it('so_juggle', T(['正手、反手各連續 30 下 × 3 回', '正反交替連續 100 下 × 2 回', '一高一低交替 100 下 × 2 回'])),
        it('so_finger', S(3, '正反手各 20 下'))
      ] },
      { t: '擊球', items: [
        it('so_wall', I(30, 30, [4, 6, 8])),
        it('so_swing', S(3, '10 下')),
        it('so_serve', S([2, 3, 3], '20 顆'), { note: '家裡沒有網，就提早 10 分鐘到球場練' })
      ] },
      { t: '前臂', items: [it('st_forearm', S([2, 2, 3], '每個動作 12 下'))] },
      CL_ARM()
    ]
  },
  p1oM: {
    n: '步法、肌力、球感綜合', kind: 'off', ppl: 1, dur: [40, 50, 55],
    goal: '一週只有一天場外時間時，把最重要的三件事各做一點。',
    blocks: [
      WU_OFF(),
      { t: '步法', items: [it('fw_six', S([2, 3, 3], '2 輪')), it('fw_random', C([3.5, 2.5, 2], [16, 20, 24], [2, 2, 3]))] },
      { t: '肌力', items: [
        it('st_squat', S([2, 3, 3], ['10 下', '12 下', '12 下（加重量）'])),
        it('st_lunge', S([2, 2, 3], ['每邊 5 下', '每邊 6 下', '每邊 8 下'])),
        it('st_calf', S([2, 3, 3], ['12 下', '15 下', '單腳 12 下'])),
        it('st_plank', H([2, 3, 3], [30, 45, 60])),
        it('st_er', S(2, '每邊 15 下'))
      ] },
      { t: '球感', items: [it('so_wall', I(30, 30, [4, 5, 6]), { note: '沒有牆就改做顛球 3 分鐘' })] },
      CL_OFF()
    ]
  },

  /* ===== 第二期：強化 ===== */
  p2cA: {
    n: '進攻組合：殺、吊、上網', kind: 'court', ppl: 2, dur: [80, 95, 105],
    goal: '殺完不停，馬上接下一拍。落點和連貫比力量重要。',
    blocks: [
      WU_COURT(),
      { t: '步法', items: [it('fw_random', C([3.5, 2.5, 2], [16, 20, 24], [2, 3, 3]))] },
      { t: '進攻', items: [
        it('tc_smash_block', M(8, 10, 12), { note: '時間過半交換角色' }),
        it('tc_attack_defend', M(6, 8, 10), { note: '時間過半交換角色' }),
        it('tc_clear', M(6), { mx: 0, note: '高遠球到位是進攻的前提' }),
        it('tc_2v1', M(8, 8, 10), { lv: 1, note: '有三個人時做；兩個人就把「一攻一守」多做一輪' })
      ] },
      { t: '網前', items: [it('tc_net_kill', S([2, 3, 3], '10 顆'))] },
      { t: '比賽', fix: 1, items: [
        it('gm_cond', T('只准下壓、挑高算失分，11 分 × 2 局')),
        it('gm_match', T('剩餘時間'))
      ] },
      CL_COURT()
    ]
  },
  p2cB: {
    n: '速度與攻防轉換', kind: 'court', ppl: 2, dur: [80, 95, 105],
    goal: '平抽不退、前三拍搶主動，攻守互換時站位要跟上。',
    blocks: [
      WU_COURT(),
      { t: '中場速度', items: [it('tc_drive', M(6, 8, 10))] },
      { t: '前三拍', items: [it('tc_third', M(8, 10, 10), { note: '每 10 球交換發球方' })] },
      { t: '攻防轉換', items: [it('tc_rotation', M(8, 10, 12)), it('tc_backhand', M(5, 5, 6), { lv: 1 })] },
      { t: '比賽', fix: 1, items: [it('tc_drive_game', T('11 分 × 2 局')), it('gm_match', T('剩餘時間'))] },
      { t: '體能收尾', items: [it('fw_interval', I([20, 20, 30], [40, 40, 30], [4, 6, 6]))] },
      CL_COURT()
    ]
  },
  p2oX: {
    n: '爆發力與肌力', kind: 'off', ppl: 1, dur: [45, 55, 60],
    goal: '練起跳、蹬地和煞車。跳躍放在最前面，趁還有力的時候做。',
    blocks: [
      WU_OFF(),
      { t: '爆發與落地', fix: 1, items: [
        it('pw_pogo', S(2, '20 下')),
        it('pw_squat_jump', S([2, 3, 3], ['6 下', '6 下', '8 下'])),
        it('pw_skater', S([2, 2, 3], '每邊 5 下')),
        it('pw_split_jump', S(2, '每邊 5 下'), { lv: 1 }),
        it('pw_hop_stick', S(2, '每邊 5 下'))
      ] },
      { t: '肌力', items: [
        it('st_squat', S(3, '12 下'), { mx: 0 }),
        it('st_split', S(3, ['每邊 8 下', '每邊 8 下', '每邊 10 下']), { lv: 1 }),
        it('st_rdl', S(3, ['每邊 8 下', '每邊 10 下', '每邊 10 下'])),
        it('st_calf', S(3, ['15 下', '單腳 12 下', '單腳 15 下'])),
        it('st_pushup', S([2, 3, 3], ['跪姿 8 下', '10 下', '15 下'])),
        it('st_row', S([2, 3, 3], '12 下'))
      ] },
      { t: '核心與肩', items: [
        it('st_antirot', S([2, 3, 3], '每邊 10 下')),
        it('st_deadbug', S(3, '每邊 10 下')),
        it('st_er', S([2, 3, 3], '每邊 15 下'))
      ] },
      CL_OFF()
    ]
  },
  p2oY: {
    n: '步法間歇', kind: 'off', ppl: 1, dur: [35, 40, 45],
    goal: '用比賽速度跑步法。做的時候全力，休息時真的休息。',
    blocks: [
      WU_OFF(),
      { t: '技術熱身', fix: 1, items: [it('fw_six', S(2, '2 輪'), { note: '中速，把步伐走順' })] },
      { t: '主課', items: [
        it('fw_interval', I([20, 20, 30], [40, 40, 30], [6, 8, 10])),
        it('fw_line', I(15, 45, [4, 6, 6]), { note: '沒有球場就量 5 公尺的距離' }),
        it('cd_rope', I(60, 30, [3, 4, 5]), { note: '進階者加入二迴旋' })
      ] },
      CL_OFF()
    ]
  },
  p2oZ: {
    n: '居家球感進階', kind: 'off', ppl: 1, dur: [25, 30, 35],
    goal: '把手上的速度練出來：引拍短、出手快。',
    blocks: [
      WU_HOME(),
      { t: '對牆', items: [
        it('so_wall', I([30, 40, 45], [30, 20, 15], [6, 8, 8])),
        it('so_wall_def', I(20, 40, [4, 6, 6]))
      ] },
      { t: '手上功夫', items: [
        it('so_finger', S(3, '正反手各 20 下')),
        it('so_juggle', T(['正反交替連續 50 下 × 3 回', '一高一低交替 100 下 × 2 回', '邊走邊顛 2 分鐘 × 2 回'])),
        it('so_swing', S(3, '15 下'), { note: '套上拍套' }),
        it('so_serve', S(3, '20 顆'), { note: '短球和平高發球混著發；家裡沒有網，就提早到球場練' })
      ] },
      { t: '前臂與肩', items: [it('st_forearm', S([2, 3, 3], '每個動作 12 下')), it('st_er', S(2, '每邊 15 下'))] },
      CL_ARM()
    ]
  },
  p2oM: {
    n: '爆發、間歇、球感綜合', kind: 'off', ppl: 1, dur: [40, 50, 55],
    goal: '一週只有一天場外時間時的精華版。',
    blocks: [
      WU_OFF(),
      { t: '爆發', fix: 1, items: [it('pw_squat_jump', S([2, 3, 3], ['6 下', '6 下', '8 下'])), it('pw_skater', S([2, 2, 3], '每邊 5 下'))] },
      { t: '步法間歇', items: [it('fw_interval', I([20, 20, 30], [40, 40, 30], [5, 6, 8]))] },
      { t: '肌力', items: [
        it('st_lunge', S([2, 3, 3], ['每邊 5 下', '每邊 6 下', '每邊 8 下'])),
        it('st_calf', S([2, 3, 3], ['15 下', '單腳 12 下', '單腳 15 下'])),
        it('st_plank', H([2, 3, 3], [40, 50, 60])),
        it('st_er', S(2, '每邊 15 下'))
      ] },
      { t: '球感', items: [it('so_wall', I(30, 30, [4, 5, 6]), { note: '沒有牆就改做顛球 3 分鐘' })] },
      CL_OFF()
    ]
  },

  /* ===== 第三期：實戰 ===== */
  p3cA: {
    n: '戰術情境', kind: 'court', ppl: 2, dur: [80, 95, 105],
    goal: '練會得分的情境：前三拍、關鍵分、攻防轉換。',
    blocks: [
      WU_COURT(),
      { t: '前三拍', items: [it('tc_third', M(8, 10, 10), { note: '計分：三拍內得分算 2 分' })] },
      { t: '關鍵分', fix: 1, items: [
        it('gm_cond', T(['每局從 17:17 開始，打 3 局', '每局從 17:17 開始，打 5 局', '每局從 17:17 開始，打 5 局']), { note: '15 分制從 11:11 開始' })
      ] },
      { t: '攻防', items: [it('tc_rotation', M(8, 10, 10)), it('gm_weak', M(8, 10, 10))] },
      { t: '比賽', fix: 1, items: [it('gm_match', T('剩餘時間'))] },
      CL_COURT()
    ]
  },
  p3cB: {
    n: '模擬比賽', kind: 'court', ppl: 2, dur: [80, 95, 110],
    goal: '照正式比賽的流程打：暖身、計分、休息時間都照規則。',
    blocks: [
      WU_COURT(),
      { t: '賽前', fix: 1, items: [it('gm_visual', T('2 分鐘'))] },
      { t: '正式比賽', fix: 1, items: [
        it('gm_match', T(['三局兩勝 1 場', '三局兩勝 2 場', '三局兩勝 2–3 場']), { note: '局中休息 60 秒、局間 120 秒，用計分板記分' }),
        it('gm_review', T('打完花 3 分鐘寫下來'))
      ] },
      CL_COURT()
    ]
  },
  p3oX: {
    n: '維持肌力與速度', kind: 'off', ppl: 1, dur: [35, 40, 45],
    goal: '量少、質高。保住前兩期練出來的力量，不把自己練累。',
    blocks: [
      WU_OFF(),
      { t: '爆發', fix: 1, items: [
        it('pw_squat_jump', S([2, 3, 3], '5 下'), { note: '每一下都全力' }),
        it('pw_skater', S([2, 2, 3], '每邊 5 下')),
        it('pw_hop_stick', S(2, '每邊 5 下'))
      ] },
      { t: '肌力', items: [
        it('st_squat', S(2, '12 下'), { mx: 0 }),
        it('st_split', S([2, 2, 3], '每邊 8 下'), { lv: 1 }),
        it('st_rdl', S(2, '每邊 8 下')),
        it('st_calf', S([2, 2, 3], ['15 下', '單腳 12 下', '單腳 15 下']))
      ] },
      { t: '核心與肩', items: [
        it('st_antirot', S(2, '每邊 10 下')),
        it('st_plank', H(2, [40, 50, 60])),
        it('st_er', S(2, '每邊 15 下'))
      ] },
      CL_OFF()
    ]
  },
  p3oY: {
    n: '比賽節奏間歇', kind: 'off', ppl: 1, dur: [30, 35, 40],
    goal: '模擬比賽的回合節奏：短時間全速、短休息，重複很多次。',
    blocks: [
      WU_OFF(),
      { t: '技術熱身', fix: 1, items: [it('fw_six', S(2, '2 輪'))] },
      { t: '主課', items: [
        it('fw_interval', I([10, 12, 15], [20, 18, 15], [8, 10, 12], 2), { note: '兩組之間休息 2 分鐘' }),
        it('fw_line', I(10, 20, [6, 8, 8]), { note: '沒有球場就量 5 公尺的距離' })
      ] },
      CL_OFF()
    ]
  },
  p3oZ: {
    n: '賽前球感', kind: 'off', ppl: 1, dur: [20, 25, 30],
    goal: '保持手感，把發球練穩。',
    blocks: [
      WU_HOME(),
      { t: '手感', items: [
        it('so_grip', S(2, '30 下')),
        it('so_wall', I(30, 30, [4, 5, 6])),
        it('so_wall_def', I(20, 40, [3, 4, 5])),
        it('so_serve', S(3, '20 顆'), { note: '記下成功顆數；家裡沒有網，就提早到球場練' })
      ] },
      { t: '心理', fix: 1, items: [it('gm_visual', T('3 分鐘'))] },
      CL_ARM()
    ]
  },
  p3oM: {
    n: '速度與肌力維持', kind: 'off', ppl: 1, dur: [35, 45, 50],
    goal: '短而精：一組爆發、一段比賽節奏間歇、一點肌力維持。',
    blocks: [
      WU_OFF(),
      { t: '爆發', fix: 1, items: [it('pw_squat_jump', S([2, 3, 3], '5 下')), it('pw_skater', S([2, 2, 3], '每邊 5 下'))] },
      { t: '比賽節奏間歇', items: [it('fw_interval', I([10, 12, 15], [20, 18, 15], [8, 10, 12]))] },
      { t: '肌力維持', items: [
        it('st_lunge', S(2, ['每邊 5 下', '每邊 6 下', '每邊 8 下'])),
        it('st_calf', S(2, ['15 下', '單腳 12 下', '單腳 15 下'])),
        it('st_plank', H(2, [40, 50, 60])),
        it('st_er', S(2, '每邊 15 下'))
      ] },
      CL_OFF()
    ]
  },

  /* ===== 通用 ===== */
  cC: {
    n: '比賽日', kind: 'court', ppl: 2, dur: [90, 100, 120],
    goal: '把這週練的東西用在比賽裡。每一局只專注一個重點。',
    blocks: [
      WU_COURT(),
      { t: '比賽', fix: 1, items: [
        it('gm_match', T(['3–4 局', '4–6 局', '6 局以上'])),
        it('gm_review', T('打完花 3 分鐘寫下來'))
      ] },
      CL_COURT()
    ]
  },
  rec: {
    n: '恢復日', kind: 'off', ppl: 1, dur: [25, 30, 30],
    goal: '讓身體恢復。強度低到可以一路聊天。',
    blocks: [
      { t: '輕鬆活動', fix: 1, items: [it('cd_easy', M(15, 20, 20))] },
      { t: '伸展放鬆', fix: 1, items: [
        it('cl_lower', T('每個部位 30 秒')), it('cl_upper', T('每個部位 30 秒')),
        it('cl_back', T('約 3 分鐘')), it('cl_roll', T('每個部位 30–60 秒'), { note: '有滾筒再做' })
      ] }
    ]
  }
};

/* ---------------- 12 週計畫 ---------------- */
const PHASES = [
  {
    n: '基礎期', goal: '把動作做對，建立體能的底。',
    pts: ['高遠球打到位、發球穩定', '六個點的步法走正確', '下肢與核心的基礎肌力', '有氧耐力'],
    court: ['p1cA', 'p1cB'], off: { X: 'p1oX', Y: 'p1oY', Z: 'p1oZ', M: 'p1oM' }
  },
  {
    n: '強化期', goal: '提高速度和力量，把球路串成進攻組合。',
    pts: ['殺、吊、上網的連貫', '平抽速度與前三拍', '爆發力與落地控制', '比賽速度的步法間歇'],
    court: ['p2cA', 'p2cB'], off: { X: 'p2oX', Y: 'p2oY', Z: 'p2oZ', M: 'p2oM' }
  },
  {
    n: '實戰期', goal: '把練到的東西變成比賽裡用得出來的能力。',
    pts: ['關鍵分與發接發', '完整的三局兩勝比賽', '比賽節奏的體能', '維持肌力、減少疲勞'],
    court: ['p3cA', 'p3cB'], off: { X: 'p3oX', Y: 'p3oY', Z: 'p3oZ', M: 'p3oM' }
  }
];
/* 每期四週的負荷：三週加量、一週減量 */
const LOADS = [
  { f: 1, n: '基準', pct: 100, d: '照表上的份量練。' },
  { f: 1.1, n: '加量', pct: 110, d: '計時的項目多一成，算組數的項目有一半多做一組。' },
  { f: 1.2, n: '高峰', pct: 120, d: '計時的項目多兩成，算組數的項目每項多做一組，是這一期最重的一週。' },
  { f: 0.6, n: '減量', pct: 60, d: '時間和組數減少約四成，強度不變，讓身體恢復，並安排檢測。' }
];
const PLAN_WEEKS = 12;

/* ---------------- 日常菜單（不綁計畫，隨時可用） ---------------- */
const MENUS = {
  m_warm: {
    n: '上場前暖身', kind: 'court', where: 'court', ppl: 2, dur: [15, 15, 15],
    goal: '打球前一定要做的 15 分鐘。前四項不用球場，排隊等場時就能先做。',
    blocks: [WU_COURT()]
  },
  m_cool: {
    n: '打完球收操', kind: 'off', where: 'any', ppl: 1, dur: [10, 10, 10],
    goal: '趁身體還熱的時候伸展，維持活動度，也讓心跳慢慢降下來。',
    blocks: [{ t: '收操', fix: 1, items: [
      it('cl_walk', M(3)), it('cl_lower', T('每個部位 30 秒')), it('cl_upper', T('每個部位 30 秒')), it('cl_back', T('約 3 分鐘'))
    ] }]
  },
  m_home_skill: {
    n: '居家球感 20 分', kind: 'off', where: 'home', ppl: 1, dur: [20, 20, 20],
    goal: '客廳就能做。每天碰一下球拍，手感進步最快。',
    blocks: [
      WU_HOME(),
      { t: '球感', items: [
        it('so_grip', S(3, '30 下')),
        it('so_juggle', T(['正手、反手各連續 30 下 × 3 回', '正反交替連續 100 下 × 2 回', '一高一低交替 100 下 × 2 回'])),
        it('so_finger', S(3, '正反手各 20 下')),
        it('so_wall', I(30, 30, [4, 5, 6]), { note: '沒有牆就多做一輪顛球' }),
        it('so_swing', S(3, '10 下'))
      ] }
    ]
  },
  m_home_str: {
    n: '居家肌力 25 分', kind: 'off', where: 'home', ppl: 1, dur: [25, 25, 30],
    goal: '不用器材的全身肌力，重點在腿、臀、核心和肩胛。',
    blocks: [
      WU_OFF(),
      { t: '循環', items: [
        it('st_squat', S([2, 3, 3], ['10 下', '12 下', '15 下'])),
        it('st_lunge', S([2, 3, 3], ['每邊 5 下', '每邊 6 下', '每邊 8 下'])),
        it('st_rdl', S([2, 3, 3], '每邊 8 下')),
        it('st_calf', S([2, 3, 3], ['12 下', '15 下', '單腳 12 下'])),
        it('st_bridge', S([2, 3, 3], ['12 下', '單腳每邊 10 下', '單腳每邊 12 下'])),
        it('st_plank', H([2, 3, 3], [30, 45, 60])),
        it('st_side_plank', H(2, [20, 30, 40]), { note: '左右各做' }),
        it('st_ytw', S(2, '各 8 下'))
      ] },
      CL_OFF()
    ]
  },
  m_foot: {
    n: '一個人練步法 20 分', kind: 'off', where: 'any', ppl: 1, dur: [20, 20, 25],
    goal: '有 4 × 4 公尺的空間就能做，不需要球。',
    blocks: [
      WU_OFF(),
      { t: '步法', items: [
        it('fw_ready', S(2, '10 次')),
        it('fw_six', S([2, 3, 3], '2 輪')),
        it('fw_two', S([2, 2, 3], '每條路線 10 趟')),
        it('fw_random', C([3.5, 2.5, 2], [16, 20, 24], [2, 3, 3]))
      ] },
      CL_OFF()
    ]
  },
  m_solo_court: {
    n: '一個人到球場 45 分', kind: 'court', where: 'court', ppl: 1, dur: [45, 45, 50],
    goal: '球友還沒到，或想自己加練時用。',
    blocks: [
      WU_OFF(),
      { t: '發球與網前', items: [
        it('so_serve', S([3, 4, 4], '20 顆')),
        it('so_net_self', M(6, 8, 8))
      ] },
      { t: '步法', items: [
        it('fw_six', S([2, 3, 3], '2 輪')),
        it('fw_random', C([3.5, 2.5, 2], [16, 20, 24], [2, 3, 3])),
        it('fw_line', I(15, 45, [4, 5, 6]))
      ] },
      { t: '揮拍', items: [it('so_swing', S(3, '10 下'))] },
      CL_OFF()
    ]
  },
  m_pair: {
    n: '兩人對練 60 分', kind: 'court', where: 'court', ppl: 2, dur: [60, 60, 65],
    goal: '兩個人包一個場地時最划算的練法，把每種球路都輪過一遍。',
    blocks: [
      WU_COURT(),
      { t: '後場', items: [it('tc_clear', M(6, 6, 8)), it('tc_drop_lift', M(6, 8, 8), { note: '時間過半交換角色' })] },
      { t: '前後連貫', items: [
        it('tc_four', M(8, 8, 10), { lv: 1, note: '時間過半交換角色' }),
        it('tc_net', M(5)),
        it('tc_smash_block', M(6, 8, 8), { note: '時間過半交換角色' })
      ] },
      { t: '中場', items: [it('tc_drive', M(5))] },
      { t: '對抗', fix: 1, items: [it('tc_half', T(['11 分 × 2 局', '15 分 × 2 局', '15 分 × 2 局']))] },
      CL_COURT()
    ]
  },
  m_three: {
    n: '三人輪替 60 分', kind: 'court', where: 'court', ppl: 3, dur: [60, 60, 65],
    goal: '三個人也能練得很紮實：輪流當單人方。',
    blocks: [
      WU_COURT(),
      { t: '二打一', fix: 1, items: [it('tc_2v1', T(['每人 4 分鐘', '每人 5 分鐘', '每人 6 分鐘']), { note: '三個人輪流當單人方' })] },
      { t: '攻防', fix: 1, items: [it('tc_attack_defend', T('每人進攻 4 分鐘'), { note: '第三人撿球休息，輪流換' })] },
      { t: '對抗', fix: 1, items: [it('tc_half', T('半場單打 11 分，贏的留在場上'))] },
      CL_COURT()
    ]
  },
  m_four: {
    n: '四人雙打訓練 90 分', kind: 'court', where: 'court', ppl: 4, dur: [90, 90, 95],
    goal: '把單純打比賽的時間，換成一半練習、一半比賽。',
    blocks: [
      WU_COURT(),
      { t: '速度', items: [it('tc_drive', M(6, 8, 8), { note: '兩兩各用半場' })] },
      { t: '前三拍', items: [it('tc_third', M(10), { note: '每 10 球換人發' })] },
      { t: '攻防輪轉', items: [it('tc_rotation', M(10, 12, 12))] },
      { t: '比賽', fix: 1, items: [
        it('tc_drive_game', T('11 分 × 2 局')),
        it('gm_cond', T('每局從 17:17 開始，打 3 局'), { note: '15 分制從 11:11 開始' }),
        it('gm_match', T('剩餘時間'))
      ] },
      CL_COURT()
    ]
  },
  m_multi: {
    n: '多球訓練 45 分', kind: 'court', where: 'court', ppl: 2, dur: [45, 45, 50],
    goal: '需要一位餵球的人和一筒舊球。兩個人輪流餵、輪流練。',
    blocks: [
      WU_COURT(),
      { t: '多球', items: [
        it('mb_net', S([2, 3, 3], ['16 顆', '20 顆', '20 顆'])),
        it('mb_rear', S([2, 3, 3], ['16 顆', '20 顆', '20 顆'])),
        it('mb_four', S([2, 2, 3], ['16 顆', '16 顆', '20 顆']), { lv: 1 }),
        it('mb_smash_net', S([2, 2, 3], ['6 趟', '8 趟', '10 趟'])),
        it('mb_defense', S([2, 2, 3], '16 顆'))
      ] },
      CL_COURT()
    ]
  },
  m_cardio: {
    n: '體能間歇 25 分', kind: 'off', where: 'any', ppl: 1, dur: [25, 25, 30],
    goal: '時間很少、又想顧體能的那一天。',
    blocks: [
      WU_OFF(),
      { t: '主課', items: [
        it('cd_rope', I(60, 30, [3, 4, 5])),
        it('fw_interval', I([20, 20, 30], [40, 40, 30], [5, 6, 8])),
        it('cd_shuttle', S([2, 3, 4], '10 趟'), { note: '組間休息 90 秒' })
      ] },
      CL_OFF()
    ]
  },
  m_leg: {
    n: '護膝護踝 15 分', kind: 'off', where: 'home', ppl: 1, dur: [15, 15, 15],
    goal: '預防腳踝扭傷、膝蓋和阿基里斯腱的問題。每週做 2 次，暖身後或打完球之後做。',
    blocks: [{ t: '下肢穩定', items: [
      it('st_ankle', H(2, [30, 30, 30]), { note: '左右各做' }),
      it('st_calf', S([2, 3, 3], ['12 下', '15 下', '單腳 12 下']), { note: '下放 3 秒' }),
      it('pw_hop_stick', S(2, '每邊 5 下')),
      it('st_bridge', S(2, ['12 下', '單腳每邊 10 下', '單腳每邊 12 下'])),
      it('st_rdl', S(2, '每邊 8 下')),
      it('st_lunge', S(2, ['每邊 4 下', '每邊 5 下', '每邊 6 下']), { note: '放慢，顧膝蓋方向' })
    ] }]
  },
  m_arm: {
    n: '肩肘保養 12 分', kind: 'off', where: 'home', ppl: 1, dur: [12, 12, 12],
    goal: '打完隔天肩膀、手肘容易緊的人，每週做 2–3 次。先活動一下肩膀和手腕再開始。',
    blocks: [{ t: '肩胛與前臂', items: [
      it('st_er', S(2, '每邊 15 下')),
      it('st_ytw', S(2, '各 8 下')),
      it('st_row', S(2, '12 下')),
      it('st_forearm', S(2, '每個動作 12 下')),
      it('cl_upper', T('每個部位 30 秒'))
    ] }]
  },
  m_recover: {
    n: '恢復伸展 12 分', kind: 'off', where: 'home', ppl: 1, dur: [12, 12, 12],
    goal: '休息日或睡前做，放鬆打球最常用到的部位。',
    blocks: [{ t: '伸展放鬆', fix: 1, items: [
      it('cl_lower', T('每個部位 30 秒')), it('cl_upper', T('每個部位 30 秒')),
      it('cl_back', T('約 3 分鐘')), it('cl_roll', T('每個部位 30–60 秒'), { note: '有滾筒再做' })
    ] }]
  },
  m_match_wu: {
    n: '比賽前暖身 20 分', kind: 'court', where: 'court', ppl: 2, dur: [20, 20, 20],
    goal: '正式比賽前的完整流程。做完到上場之間保持走動、披件外套。',
    blocks: [{ t: '賽前暖身', fix: 1, items: [
      it('wu_pulse', M(4)), it('wu_joint', T('各 8–10 圈')), it('wu_dynamic', T('每個動作 8–10 下')),
      it('wu_activate', T('各 10 秒 × 2')), it('fw_six', T('比賽速度 1 輪')), it('wu_rally', M(6)),
      it('so_serve', T('發 10 顆，找到今天的手感')), it('gm_visual', T('1 分鐘'))
    ] }]
  }
};
const MENU_ORDER = ['m_warm', 'm_cool', 'm_home_skill', 'm_home_str', 'm_foot', 'm_cardio',
  'm_solo_court', 'm_pair', 'm_three', 'm_four', 'm_multi', 'm_match_wu', 'm_leg', 'm_arm', 'm_recover'];

/* ---------------- 檢測 ---------------- */
const TESTS = [
  { id: 'six', n: '米字步 2 輪', u: '秒', better: 'low', how: '從中心出發依序到六個點並回中心，連做 2 輪（12 點），計時。' },
  { id: 'line', n: '30 秒邊線折返', u: '趟', better: 'high', how: '在單打兩條邊線之間側向折返，摸到線算 1 趟。' },
  { id: 'rope', n: '1 分鐘跳繩', u: '下', better: 'high', how: '一迴旋（一跳繞一圈），1 分鐘內跳的次數。' },
  { id: 'plank', n: '棒式', u: '秒', better: 'high', how: '姿勢一跑掉就停，記下撐住的秒數。' },
  { id: 'wall', n: '30 秒對牆平抽', u: '下', better: 'high', how: '距離牆面 2.5 公尺，30 秒內的擊球次數；掉球撿起來繼續算。' },
  { id: 'serve', n: '短發球 20 顆', u: '顆', better: 'high', how: '反手短發球 20 顆，過網而且落在前發球線後一個球筒長度（約 40 公分）以內的顆數。' },
  { id: 'clear', n: '高遠球 20 顆', u: '顆', better: 'high', how: '請球友把球挑高，打 20 顆直線高遠球，落在對方雙打後發球線之後的顆數。' },
  { id: 'juggle', n: '連續顛球', u: '下', better: 'high', how: '正反拍交替，連續不落地的最高次數。' }
];
const TEST_POINTS = [
  { k: 'w0', n: '開始前', s: '開始', w: 0 }, { k: 'w4', n: '第 4 週', s: '4 週', w: 3 },
  { k: 'w8', n: '第 8 週', s: '8 週', w: 7 }, { k: 'w12', n: '第 12 週', s: '12 週', w: 11 }
];

return { LEVELS, SESS, PHASES, LOADS, PLAN_WEEKS, MENUS, MENU_ORDER, TESTS, TEST_POINTS };
})();
const { LEVELS, SESS, PHASES, LOADS, PLAN_WEEKS, MENUS, MENU_ORDER, TESTS, TEST_POINTS } = PLAN_DATA;
