import type { Artifacts, Board } from "../../../../../../src/contracts/index.js";

export const MOCK_BOARD: Board = {
  assembly_template: "shot-v1",
  shots: [
    {
      shot_id: "S01-01",
      scene_id: "S01",
      location_id: "L01",
      character_ids: ["C01", "C02"],
      prop_ids: ["P01"],
      shot_size: "全景" as never,
      camera: "固定机位，河面位于画面左侧",
      action: "程禾排齐留言，麦冬把空白磁片贴到中央，计时器静止。",
      dialogue: undefined,
      duration_s: 4,
      shot_part: "全景，固定机位，河面位于画面左侧。程禾排齐留言，麦冬把空白磁片贴到中央，计时器静止。情绪克制，保持自然停顿。",
      injected_ids: ["L01", "C01", "C02", "P01"],
      final_prompt:
        "[镜头] 全景，固定机位，河面位于画面左侧。程禾排齐留言，麦冬把空白磁片贴到中央，计时器静止。情绪克制，保持自然停顿。\n[场景] 旧候船亭：停航后的木质候船亭，青灰色立柱、朝河面的长凳，墙上保留九宫格旧时刻表，河风从左侧敞口穿过。\n[角色] 程禾：成年女性，齐耳黑发，穿浅灰工装外套、深蓝长裤与白色帆布鞋，左袖口有一枚圆形布补丁。\n[角色] 麦冬：短发孩子，穿姜黄色连帽衫、棕色背带裤与红色运动鞋，额前一绺头发向右翘起。\n[道具] 蓝色机械计时器：掌心大小的蓝色方壳机械计时器，白色圆盘、黑色指针，右侧有一枚银色发条旋钮。\n[规格] 景别 全景，机位 固定机位，河面位于画面左侧，时长 4 秒",
    },
    {
      shot_id: "S01-02",
      scene_id: "S01",
      location_id: "L01",
      character_ids: ["C01", "C02"],
      prop_ids: [],
      shot_size: "近景" as never,
      camera: "缓慢推近两人之间的空白格",
      action: "程禾伸手又停下，麦冬指向修表间方向。",
      dialogue: "麦冬：这一格有人，只是他还没说话。",
      duration_s: 4,
      shot_part: "近景，缓慢推近两人之间的空白格。程禾伸手又停下，麦冬指向修表间方向。情绪克制，保持自然停顿。",
      injected_ids: ["L01", "C01", "C02"],
      final_prompt:
        "[镜头] 近景，缓慢推近两人之间的空白格。程禾伸手又停下，麦冬指向修表间方向。情绪克制，保持自然停顿。\n[场景] 旧候船亭：停航后的木质候船亭，青灰色立柱、朝河面的长凳，墙上保留九宫格旧时刻表，河风从左侧敞口穿过。\n[角色] 程禾：成年女性，齐耳黑发，穿浅灰工装外套、深蓝长裤与白色帆布鞋，左袖口有一枚圆形布补丁。\n[角色] 麦冬：短发孩子，穿姜黄色连帽衫、棕色背带裤与红色运动鞋，额前一绺头发向右翘起。\n[规格] 景别 近景，机位 缓慢推近两人之间的空白格，时长 4 秒",
    },
    {
      shot_id: "S02-01",
      scene_id: "S02",
      location_id: "L02",
      character_ids: ["C01", "C03"],
      prop_ids: [],
      shot_size: "中景" as never,
      camera: "隔着工作台平视两人",
      action: "陆岑轻转怀表发条，程禾在门边静静注视。",
      dialogue: "陆岑：指针还能走，只是慢了半个时辰。",
      duration_s: 5,
      shot_part: "中景，隔着工作台平视两人。陆岑轻转怀表发条，程禾在门边静静注视。暖光落在木工作台上。",
      injected_ids: ["L02", "C01", "C03"],
      final_prompt:
        "[镜头] 中景，隔着工作台平视两人。陆岑轻转怀表发条，程禾在门边静静注视。暖光落在木工作台上。\n[场景] 社区修表间：不足十平米的小间，陈列整齐的镊子、放大镜和钟表零件，玻璃窗透入傍晚暖光。\n[角色] 程禾：成年女性，齐耳黑发，穿浅灰工装外套、深蓝长裤与白色帆布鞋，左袖口有一枚圆形布补丁。\n[角色] 陆岑：年长男性，银白短发，戴细圆框眼镜，穿墨绿针织背心、米白衬衫与黑色布鞋。\n[规格] 景别 中景，机位 隔着工作台平视两人，时长 5 秒",
    },
  ],
};

export const MOCK_BIBLE: Artifacts["bible"] = {
  characters: [
    {
      id: "C01",
      name: "程禾",
      role: "社区志愿者",
      personality: "利落但克制",
      appearance: "成年女性，齐耳黑发，穿浅灰工装外套、深蓝长裤与白色帆布鞋，左袖口有一枚圆形布补丁。",
      appears_in: ["S01", "S02"],
    },
    {
      id: "C02",
      name: "麦冬",
      role: "提出保留空白格的孩子",
      personality: "敏锐、纯真",
      appearance: "短发孩子，穿姜黄色连帽衫、棕色背带裤与红色运动鞋，额前一绺头发向右翘起。",
      appears_in: ["S01"],
    },
    {
      id: "C03",
      name: "陆岑",
      role: "老修表师",
      personality: "寡言专注",
      appearance: "年长男性，银白短发，戴细圆框眼镜，穿墨绿针织背心、米白衬衫与黑色布鞋。",
      appears_in: ["S02"],
    },
  ],
  locations: [
    {
      id: "L01",
      name: "旧候船亭",
      description: "停航后的木质候船亭，青灰色立柱、朝河面的长凳，墙上保留九宫格旧时刻表，河风从左侧敞口穿过。",
      appears_in: ["S01"],
    },
    {
      id: "L02",
      name: "社区修表间",
      description: "不足十平米的小间，陈列整齐的镊子、放大镜和钟表零件，玻璃窗透入傍晚暖光。",
      appears_in: ["S02"],
    },
  ],
  props: [
    {
      id: "P01",
      name: "蓝色机械计时器",
      description: "掌心大小的蓝色方壳机械计时器，白色圆盘、黑色指针，右侧有一枚银色发条旋钮。",
      appears_in: ["S01"],
    },
  ],
};

export const MOCK_SCRIPT: Artifacts["script"] = {
  scenes: [
    {
      scene_id: "S01",
      heading: "外景·旧候船亭·傍晚",
      summary: "程禾与麦冬整理九宫格时刻表上的磁片留言，决定留下中央空白格。",
      lines: [
        { kind: "action", text: "程禾将最后一张空白磁片递给麦冬。" },
        { kind: "dialogue", character: "麦冬", text: "这一格有人，只是他还没说话。" },
      ],
    },
    {
      scene_id: "S02",
      heading: "内景·社区修表间·傍晚",
      summary: "程禾前往修表间寻找陆岑，核对怀表归还线索。",
      lines: [
        { kind: "action", text: "陆岑取下目镜，吹去表盘细尘。" },
        { kind: "dialogue", character: "陆岑", text: "指针还能走，只是慢了半个时辰。" },
      ],
    },
  ],
};
