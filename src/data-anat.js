/* ============================================================
   動作原理與肌肉對照
   MUSCLES：肌肉部位（f 正面圖、b 背面圖），對照 anatSVG 的圖形
   ANAT[動作代碼] = { why: 原理, p: 主要部位, s: 協同部位, sys: 主要訓練的系統（選用） }
   ============================================================ */
const MUSCLES = {
  delt: { n: '三角肌（肩膀）', v: 'fb' },
  pec: { n: '胸大肌', v: 'f' },
  bicep: { n: '肱二頭肌', v: 'f' },
  forearm: { n: '前臂肌群（握力、腕屈伸、旋前旋後）', v: 'fb' },
  abs: { n: '腹直肌', v: 'f' },
  oblique: { n: '腹斜肌（轉體、抗旋轉）', v: 'f' },
  hipflex: { n: '髖屈肌（髂腰肌）', v: 'f' },
  quad: { n: '股四頭肌（大腿前側）', v: 'f' },
  adductor: { n: '內收肌（大腿內側）', v: 'f' },
  tib: { n: '脛前肌（小腿前側）', v: 'f' },
  trap: { n: '斜方肌', v: 'b' },
  upperback: { n: '菱形肌與中下斜方肌（肩胛穩定）', v: 'b' },
  rotcuff: { n: '旋轉肌袖（棘下肌、小圓肌）', v: 'b' },
  lat: { n: '背闊肌', v: 'b' },
  tricep: { n: '肱三頭肌', v: 'b' },
  erector: { n: '豎脊肌（下背）', v: 'b' },
  gmed: { n: '臀中肌（骨盆側向穩定）', v: 'b' },
  glute: { n: '臀大肌', v: 'b' },
  hamstring: { n: '大腿後側肌群', v: 'b' },
  calf: { n: '小腿後側（腓腸肌、比目魚肌、阿基里斯腱）', v: 'b' }
};

const ANAT = {
  /* ---------- 暖身 ---------- */
  wu_pulse: { why: '輕度有氧讓心跳和肌肉溫度上升。肌肉溫度每升高一些，收縮速度和延展性都會變好，神經傳導也變快，接下來的動作比較不容易拉傷。', p: ['calf', 'quad'], s: ['glute', 'delt'], sys: '心肺' },
  wu_joint: { why: '關節慢慢繞圈能讓關節液分布到關節面，降低活動時的摩擦，也讓大腦重新「校正」各關節的位置感。羽球最常扭傷的是腳踝，用得最兇的是手腕和肩膀。', p: ['calf', 'forearm', 'delt'], s: ['hipflex', 'oblique'] },
  wu_dynamic: { why: '動態伸展是在動作中把肌肉拉到接近比賽需要的長度，比靜態拉筋更能維持接下來的爆發力。研究上，運動前長時間的靜態伸展會暫時降低爆發力，所以運動前用動態伸展。', p: ['hamstring', 'hipflex', 'glute'], s: ['quad', 'adductor', 'oblique'] },
  wu_activate: { why: '短時間、快頻率的腳步讓神經系統進入「快模式」，讓小腿和臀腿先習慣急停、變向的負荷，上場第一球就跑得動。', p: ['calf', 'quad'], s: ['glute', 'gmed', 'adductor'] },
  wu_shadow: { why: '空揮把擊球的動作順序（腿、軀幹、肩、手臂、手腕）先跑一遍，由慢到快逐步提高肩膀和手肘的負荷，避免第一拍殺球就拉傷肩膀。', p: ['delt', 'rotcuff', 'forearm'], s: ['oblique', 'tricep', 'pec'] },
  wu_rally: { why: '在真實的球速下熱拍，讓眼睛、判斷和揮拍同步。力量從五成慢慢加到八成，是給肩膀和手肘的漸進負荷。', p: ['delt', 'forearm', 'calf'], s: ['rotcuff', 'quad', 'oblique'] },

  /* ---------- 步法 ---------- */
  fw_ready: { why: '分腿跳（啟動步）讓肌肉在落地瞬間先被拉長，接著立刻收縮，像彈簧一樣產生更快的起動（伸展–收縮循環）。時機抓在對手擊球的瞬間，才能往正確方向蹬出。', p: ['calf', 'quad'], s: ['glute', 'adductor', 'gmed'] },
  fw_six: { why: '把全場移動拆成六個方向反覆練，讓每個方向的步數和節奏變成自動化的動作，比賽時注意力才能放在來球和對手身上。', p: ['quad', 'glute', 'calf'], s: ['adductor', 'hamstring', 'oblique'] },
  fw_front: { why: '上網的最後一步是大跨步加煞車：前腳的股四頭肌和臀大肌以「離心收縮」吸收衝擊，膝蓋要對準腳尖，再用同一隻腳推蹬回中心。', p: ['quad', 'glute'], s: ['adductor', 'calf', 'hamstring'] },
  fw_rear: { why: '轉身側對球網後退，最後一步蹬地起跳、空中換腳（剪刀腳），讓轉體的力量傳到手臂，落地時順勢把重心送回中場。', p: ['calf', 'glute', 'quad'], s: ['oblique', 'hamstring', 'gmed'] },
  fw_side: { why: '接殺時沒有時間多跨步，靠一次側向蹬跨加上壓低重心。內收肌和臀中肌負責側向的推蹬與煞車。', p: ['adductor', 'quad', 'gmed'], s: ['glute', 'calf'] },
  fw_two: { why: '固定兩點來回能把同一條路線的步伐練到穩定，也開始累積重複衝刺的體能。每趟回中心是比賽的基本習慣。', p: ['quad', 'calf', 'glute'], s: ['adductor', 'hamstring'], sys: '無氧耐力' },
  fw_random: { why: '隨機指令加入了「看到訊號才決定方向」的反應過程，比固定路線更接近比賽。訓練的是判斷加移動，而不只是腿。', p: ['quad', 'calf', 'glute'], s: ['adductor', 'gmed', 'oblique'], sys: '反應與敏捷' },
  fw_interval: { why: '羽球是間歇運動：一分球約 5–10 秒高強度、接著短暫休息。用比賽速度做、休交替，同時練到腿部力量的持續和心肺恢復能力。', p: ['quad', 'calf', 'glute'], s: ['adductor', 'hamstring'], sys: '心肺與無氧耐力' },
  fw_line: { why: '側向折返要反覆煞車再起動，內收肌、臀中肌和小腿承擔大部分負荷，也是羽球側向移動的專項體能。', p: ['adductor', 'gmed', 'calf'], s: ['quad', 'glute'], sys: '無氧耐力' },
  fw_quick: { why: '小幅度、高頻率的腳步練的是神經肌肉的協調與觸地時間，讓腳步變得「輕」，而不是用力。', p: ['calf', 'tib'], s: ['quad', 'hipflex'], sys: '協調與敏捷' },

  /* ---------- 對練技術 ---------- */
  tc_clear: { why: '高遠球靠的是由下而上的動力鏈：蹬地、轉體、肩膀外旋到內旋、前臂內旋，最後手指握緊。力量來自全身，手臂只是最後一節鞭梢。', p: ['delt', 'rotcuff', 'forearm'], s: ['oblique', 'pec', 'tricep', 'calf'] },
  tc_drop_lift: { why: '吊球要「同樣的準備動作、不同的出手速度」，練的是拍面控制；挑球則是上網後用前腳煞車、手腕和前臂把球送到後場。兩者合練就是前後場的轉換。', p: ['forearm', 'quad'], s: ['delt', 'glute', 'calf'] },
  tc_four: { why: '固定四拍循環讓兩人都練到前後場的移動與四種基本球路的轉換，重複次數多、節奏穩定，適合把動作和步法串起來。', p: ['quad', 'delt', 'forearm'], s: ['calf', 'glute', 'oblique'] },
  tc_smash_block: { why: '殺球後立刻上網是單打最常見的得分連續動作，訓練的是殺球後的回動速度，以及另一方的擋網控制。', p: ['delt', 'quad', 'calf'], s: ['oblique', 'pec', 'forearm', 'glute'] },
  tc_drive: { why: '平抽的球速快、揮拍幅度小，主要靠前臂旋轉和手指發力，練反應速度和拍面在身前的位置。', p: ['forearm', 'delt'], s: ['tricep', 'rotcuff', 'oblique'] },
  tc_net: { why: '網前小球靠手指和手腕的細微控制，力量越小越難。重點是放鬆握拍、用手指調整拍面角度。', p: ['forearm'], s: ['quad', 'delt'] },
  tc_net_kill: { why: '撲球要在球剛過網的最高點擊球，靠的是快速上網和短促的手指、前臂發力，揮拍幅度小以免觸網。', p: ['forearm', 'quad'], s: ['delt', 'calf'] },
  tc_serve: { why: '反手短發球是穩定性最高的技術，練的是小肌群的精細控制；接發球則訓練預判與搶高點，雙打前三拍的勝負常從這裡開始。', p: ['forearm'], s: ['delt', 'quad'] },
  tc_third: { why: '只打發球、接發、第三拍，把雙打最關鍵的前三拍重複放大練習，強化預判和第一時間的搶攻意識。', p: ['forearm', 'quad'], s: ['delt', 'calf'], sys: '反應與判斷' },
  tc_attack_defend: { why: '固定一攻一守，攻方練連續下壓的力量與落點，守方練重心壓低和拍面控制。高強度，是攻防體能的專項訓練。', p: ['delt', 'quad', 'forearm'], s: ['oblique', 'calf', 'rotcuff'], sys: '無氧耐力' },
  tc_2v1: { why: '單人方要在比賽速度下連續移動，是羽球最接近比賽、甚至比比賽更累的專項體能訓練；兩人方則練控球和落點。', p: ['quad', 'calf', 'glute'], s: ['delt', 'forearm', 'adductor'], sys: '無氧耐力' },
  tc_half: { why: '只用直線半場，少了左右移動，能把前後移動和高、吊、放、挑的組合打得更密集，適合練單打的前後轉換。', p: ['quad', 'calf', 'delt'], s: ['glute', 'forearm', 'oblique'] },
  tc_backhand: { why: '反手後場球靠背對球網時的轉體、前臂旋後和手指瞬間發力，揮拍路線短。它是被動時的補救技術，所以先求打過中場、不出界。', p: ['forearm', 'rotcuff', 'delt'], s: ['tricep', 'upperback', 'oblique'] },
  tc_rotation: { why: '雙打攻守轉換時，站位要從前後換成左右（或反過來）。練的是兩人的默契與移動路線，誰補哪一塊空位。', p: ['quad', 'calf'], s: ['delt', 'forearm', 'adductor'], sys: '判斷與配合' },
  tc_drive_game: { why: '限制只能打平球，逼自己在中場用小動作快速出手，強化平抽擋的反應速度和拍面控制。', p: ['forearm', 'delt'], s: ['quad', 'calf', 'rotcuff'], sys: '反應速度' },

  /* ---------- 多球 ---------- */
  mb_net: { why: '多球讓同一個動作在短時間內重複 16–20 次，動作和步法的學習效率比一般對練高很多，也同時練到上網的腿力。', p: ['quad', 'forearm'], s: ['glute', 'calf', 'adductor'] },
  mb_rear: { why: '連續的後場來球讓肩膀在疲勞下仍要維持正確的揮拍順序，訓練後場技術的穩定和後退步法。', p: ['delt', 'rotcuff', 'calf'], s: ['oblique', 'forearm', 'quad', 'glute'] },
  mb_four: { why: '隨機四角加上接近比賽的速度，是技術與體能的綜合訓練，一組相當於幾分最激烈的來回。', p: ['quad', 'calf', 'delt'], s: ['glute', 'adductor', 'forearm'], sys: '無氧耐力' },
  mb_smash_net: { why: '殺球後馬上上網撲球，訓練從後場到網前的最快轉換，同時練殺球的力量和撲球的細膩。', p: ['delt', 'quad', 'calf'], s: ['oblique', 'forearm', 'glute'], sys: '無氧耐力' },
  mb_defense: { why: '接殺時球速快、反應時間短，重點是重心壓低、拍子在身前、靠前臂和手指的短促發力把球擋好或挑深。', p: ['forearm', 'quad'], s: ['delt', 'adductor', 'calf'], sys: '反應速度' },

  /* ---------- 單人球感 ---------- */
  so_grip: { why: '正反手切換靠手指轉動握把，速度越快，來不及時就越不會用錯握法。這是平抽、接殺能不能跟上的基礎。', p: ['forearm'], s: [] },
  so_juggle: { why: '顛球訓練手眼協調與拍面感覺，用最小的力量控制球的高度，是放網、搓球的基本功。', p: ['forearm'], s: ['delt'], sys: '協調' },
  so_wall: { why: '牆面回球比人快又穩定，能在短時間內做大量的平抽重複，訓練手指發力和連續反應。', p: ['forearm', 'delt'], s: ['tricep', 'rotcuff'], sys: '反應速度' },
  so_wall_def: { why: '近距離快擋模擬雙打接殺和封網，拍子保持在身前，用最短的動作反應。', p: ['forearm'], s: ['delt', 'tricep'], sys: '反應速度' },
  so_swing: { why: '揮拍的力量順序是腿、髖、軀幹、肩、上臂、前臂。反覆空揮把順序練成習慣，前臂內旋是殺球和高遠球最後加速的來源。', p: ['delt', 'oblique', 'forearm'], s: ['rotcuff', 'pec', 'tricep', 'calf'] },
  so_serve: { why: '發球是唯一完全由自己控制的一拍。反覆練同一個動作並設定目標區，把穩定性練起來。', p: ['forearm'], s: ['delt'] },
  so_finger: { why: '手指在擊球瞬間握緊，能讓拍頭在很短的距離內加速，小動作也能打出速度，是網前、平抽、接殺的關鍵。', p: ['forearm'], s: [] },
  so_net_self: { why: '自己拋球能把注意力完全放在拍面角度和擊球點，觀察球過網的高度與翻滾，練出網前手感。', p: ['forearm'], s: ['quad'] },

  /* ---------- 體能 ---------- */
  cd_rope: { why: '跳繩是低幅度、高頻率的彈跳，強化小腿和阿基里斯腱的彈性與耐力，也練腳踝的節奏感，是羽球腳步的基礎體能。', p: ['calf', 'tib'], s: ['quad', 'forearm', 'delt'], sys: '心肺' },
  cd_easy: { why: '低強度有氧建立「有氧底」：心臟每跳送出的血量增加、肌肉微血管變多，分與分之間恢復得更快。也是恢復日加速恢復的方式。', p: ['quad', 'calf'], s: ['glute', 'hamstring'], sys: '心肺（有氧）' },
  cd_shuttle: { why: '6 公尺折返包含加速、煞車、轉向，接近羽球的移動距離。全力衝刺練的是無氧能力與重複衝刺後的恢復。', p: ['quad', 'glute', 'calf'], s: ['hamstring', 'adductor'], sys: '無氧' },
  cd_run_int: { why: '快、慢交替讓心跳反覆拉高再回落，同時改善最大攝氧量與恢復速度，比同樣時間的慢跑更貼近羽球的間歇特性。', p: ['quad', 'calf', 'hamstring'], s: ['glute', 'hipflex'], sys: '心肺（間歇）' },

  /* ---------- 肌力 ---------- */
  st_squat: { why: '深蹲是下肢最基本的「推」：髖和膝同時伸展。強化臀腿就是強化每一次蹬地和煞車，也讓膝蓋周圍更能承受羽球大量的跨步。', p: ['quad', 'glute'], s: ['adductor', 'hamstring', 'erector', 'abs'] },
  st_lunge: { why: '向不同方向跨步下蹲，直接對應上網和接殺的蹬跨。前腳下蹲時是離心收縮在煞車，是預防膝蓋受傷最重要的能力之一。', p: ['quad', 'glute', 'adductor'], s: ['gmed', 'hamstring', 'calf'] },
  st_split: { why: '單腳承擔大部分重量，比雙腳深蹲更能改善左右腳不平衡，也加強單腳時骨盆的穩定，接近羽球單腳跨步的情境。', p: ['quad', 'glute'], s: ['gmed', 'adductor', 'hamstring'] },
  st_rdl: { why: '髖關節鉸鏈（往後折）主要練臀大肌和大腿後側；單腳做還要靠臀中肌和腳踝維持平衡。大腿後側夠強，衝刺和急停時比較不容易拉傷。', p: ['hamstring', 'glute'], s: ['gmed', 'erector', 'calf'] },
  st_calf: { why: '小腿和阿基里斯腱承受每一次彈跳和蹬地。慢慢放下（離心）的提踵能強化肌腱，膝蓋伸直練腓腸肌、微彎練比目魚肌。', p: ['calf'], s: ['tib'] },
  st_bridge: { why: '臀橋在不壓迫下背的情況下直接練臀大肌伸髖。臀部無力時，下背和大腿後側會代償，容易痠痛。', p: ['glute'], s: ['hamstring', 'erector', 'abs'] },
  st_plank: { why: '棒式練的是軀幹「不動」的能力（抗伸展）。羽球的力量從腿傳到手，中間要靠穩定的軀幹，不然力量會漏掉。', p: ['abs'], s: ['oblique', 'delt', 'glute'] },
  st_side_plank: { why: '側棒式練側腹和臀中肌，對抗身體側彎，讓單腳落地和側向移動時骨盆不歪。', p: ['oblique', 'gmed'], s: ['abs', 'delt'] },
  st_deadbug: { why: '手腳在動，軀幹保持不動、下背貼地，練的是核心在四肢活動時的控制，對下背最友善。', p: ['abs'], s: ['oblique', 'hipflex'] },
  st_birddog: { why: '對側手腳伸直時，軀幹要抵抗旋轉和下沉，同時練到下背和臀部，是物理治療常用的下背穩定動作。', p: ['erector', 'glute'], s: ['abs', 'delt', 'upperback'] },
  st_antirot: { why: '抗旋轉（Pallof press）練的是「不被拉轉」：揮拍時上下半身要能傳遞轉體的力量，而不是在腰部亂扭。', p: ['oblique', 'abs'], s: ['delt', 'glute'] },
  st_pushup: { why: '伏地挺身練胸、肩前側和上臂後側的推力，同時要求軀幹維持一直線，是上肢與核心一起練的基本動作。', p: ['pec', 'tricep'], s: ['delt', 'abs'] },
  st_row: { why: '羽球大量的揮拍會讓胸和肩前側變緊、上背變弱，肩膀容易往前圓。划船練肩胛往後收的肌群，讓肩膀前後平衡。', p: ['upperback', 'lat'], s: ['bicep', 'delt', 'forearm'] },
  st_er: { why: '殺球和高遠球時，肩膀內旋的速度非常快，揮完拍要靠後側的旋轉肌袖煞車。肩外旋就是在練這組「煞車肌」，是預防肩膀受傷的重點。', p: ['rotcuff'], s: ['delt', 'upperback'] },
  st_ytw: { why: 'Y、T、W 三個角度分別練下、中斜方肌和菱形肌，讓肩胛在手臂舉高時穩定地往下往後，揮拍時肩膀比較不會夾擠。', p: ['upperback', 'trap'], s: ['rotcuff', 'delt'] },
  st_forearm: { why: '握拍、發力、網前控制都靠前臂。腕屈、腕伸和旋轉都練到，能減少手肘外側（網球肘）和手腕的過度使用傷害。', p: ['forearm'], s: [] },
  st_ankle: { why: '單腳平衡練的是腳踝的本體感覺（大腦知道腳踝角度的能力）。研究顯示平衡訓練能降低腳踝再次扭傷的機會。', p: ['calf', 'tib', 'gmed'], s: ['glute', 'quad'], sys: '平衡與本體感覺' },

  /* ---------- 爆發與落地 ---------- */
  pw_pogo: { why: '膝蓋幾乎不彎、只用腳踝快速彈跳，練的是小腿和阿基里斯腱像彈簧一樣儲存、釋放能量，觸地越短越好。', p: ['calf'], s: ['tib', 'quad'] },
  pw_squat_jump: { why: '蹲跳把深蹲的力量轉成速度，練垂直的爆發力；落地要輕、膝蓋對準腳尖，學會安全吸收衝擊。', p: ['quad', 'glute', 'calf'], s: ['hamstring', 'abs'] },
  pw_split_jump: { why: '弓箭步跳在空中換腳、落地煞車，接近上網跨步和後場剪刀腳的發力與落地。', p: ['quad', 'glute'], s: ['calf', 'hipflex', 'adductor'] },
  pw_skater: { why: '單腳側向起跳、另一腳落地停穩，練側向的爆發與煞車，正是羽球左右移動的需求。', p: ['gmed', 'glute', 'quad'], s: ['adductor', 'calf'] },
  pw_hop_stick: { why: '單腳落地後停穩，練的是落地時膝蓋不內夾、骨盆不歪的控制能力。膝蓋內夾的落地是前十字韌帶受傷的常見機制。', p: ['quad', 'gmed', 'glute'], s: ['calf', 'hamstring'], sys: '落地控制' },

  /* ---------- 比賽情境 ---------- */
  gm_match: { why: '比賽把技術、步法、體能和判斷全部放在一起，在有壓力的情況下才看得出哪裡還不穩。', p: ['quad', 'calf', 'delt'], s: ['glute', 'forearm', 'oblique'], sys: '全身綜合' },
  gm_cond: { why: '加上限制條件，逼自己反覆用出想練的打法或處理關鍵分，比自由比賽更有針對性。', p: ['quad', 'calf', 'delt'], s: ['glute', 'forearm'], sys: '戰術與判斷' },
  gm_review: { why: '刻意練習的核心是回饋：知道自己哪裡失分，下一次練習才有方向。寫下來能讓記憶更清楚。', p: [], s: [], sys: '思考與回饋（沒有特定肌肉）' },
  gm_weak: { why: '把練習集中在最常失分的球路，進步最快。弱點補強要有足夠的重複次數。', p: ['forearm', 'quad'], s: ['delt', 'calf'], sys: '依弱點而定' },
  gm_visual: { why: '意象訓練（在腦中演練動作）會活化和實際動作相似的大腦區域，研究顯示搭配實際練習能幫助技術學習和穩定比賽情緒。', p: [], s: [], sys: '大腦與神經（沒有特定肌肉）' },

  /* ---------- 收操伸展 ---------- */
  cl_walk: { why: '激烈運動後突然停下來，血液容易積在腿部而頭暈。慢走讓心跳和呼吸逐步回到平靜。', p: ['calf', 'quad'], s: [], sys: '心肺回復' },
  cl_lower: { why: '運動後的靜態伸展讓緊繃的肌肉回到放鬆的長度，維持關節活動度。膝蓋伸直伸展腓腸肌，微彎伸展比目魚肌。', p: ['calf', 'hamstring', 'quad'], s: ['hipflex', 'glute', 'adductor'] },
  cl_upper: { why: '羽球大量使用胸、肩前側和前臂，伸展這些部位能減少肩膀往前圓的姿勢，也照顧容易過度使用的前臂。', p: ['pec', 'forearm', 'rotcuff'], s: ['delt', 'tricep', 'lat'] },
  cl_back: { why: '貓牛式和扭轉讓脊椎一節一節活動，放鬆打球時大量轉體和前彎的下背。', p: ['erector'], s: ['oblique', 'lat', 'glute'] },
  cl_roll: { why: '滾筒按壓能暫時降低肌肉緊繃感、增加活動度，常用來放鬆小腿和大腿。它不會「打散乳酸」，但能讓身體感覺比較放鬆。', p: ['calf', 'quad', 'glute'], s: ['hamstring', 'upperback'] }
};

/* 建置時檢查：每個動作都要有原理和肌肉資料，部位代碼要存在 */
function validateAnat() {
  const errs = [];
  Object.keys(EX).forEach(id => {
    const a = ANAT[id];
    if (!a || !a.why) { errs.push('原理：缺少 ' + id); return; }
    a.p.concat(a.s).forEach(m => { if (!MUSCLES[m]) errs.push('原理：' + id + ' 的部位代碼 ' + m + ' 不存在'); });
    if (!a.p.length && !a.sys) errs.push('原理：' + id + ' 沒有主要部位也沒有說明訓練系統');
  });
  Object.keys(ANAT).forEach(id => { if (!EX[id]) errs.push('原理：' + id + ' 不在動作庫'); });
  return errs;
}
