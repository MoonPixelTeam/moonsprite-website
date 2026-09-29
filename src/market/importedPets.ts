import type { MarketProduct } from './catalog'

export const importedPets: MarketProduct[] = [
  {
    "id": "pet-dolphin-girl",
    "category": "pets",
    "name": {
      "zh": "海豚娘",
      "en": "Dolphin Girl"
    },
    "tagline": {
      "zh": "81 帧像素动画，陪你一起创作",
      "en": "81 frames of pixel animation"
    },
    "body": {
      "zh": "海豚娘宠物包包含 8 组动画，可安装到软件，也可以在这里预览动作。",
      "en": "Dolphin Girl includes 8 animations. Install the pet in the app or try the animations here."
    },
    "price": 1.25,
    "size": {
      "zh": "1 只宠物 · 8 组动画 · 81 帧",
      "en": "1 pet · 8 animations · 81 frames"
    },
    "formats": [
      ".mspet"
    ],
    "download": "/assets/market/dolphin-girl/pet.mspet",
    "image": "/assets/market/dolphin-girl/idle/00.png",
    "animations": {
      "triggers": [
        {
          "repeat": true,
          "id": "TRIGGER_MUMT9A2B_UGQ0",
          "event": "idle",
          "tool": "",
          "idleSeconds": 5,
          "cooldownMs": 1000
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUMT9NZ6_FPXR",
          "event": "pet.enter",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 1000
        },
        {
          "repeat": true,
          "id": "TRIGGER_MUMTK6HY_DGVQ",
          "event": "animation.started",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 1000
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUMTSRD9_PE34",
          "event": "animation.stopped",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 1000
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUMTZL67_R033",
          "event": "document.saved",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 1000
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUMTZYFD_0OGL",
          "event": "export-complete",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 3000
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUMUGZC4_7CRE",
          "event": "pet.click",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 1000
        }
      ],
      "order": [
        "IDLE",
        "TRIGGER_MUMT9NZ6_FPXR",
        "TRIGGER_MUMT9A2B_UGQ0",
        "TRIGGER_MUMTK6HY_DGVQ",
        "TRIGGER_MUMTSRD9_PE34",
        "TRIGGER_MUMTZYFD_0OGL",
        "TRIGGER_MUMTZL67_R033",
        "TRIGGER_MUMUGZC4_7CRE"
      ],
      "sheets": {
        "IDLE": {
          "dir": "/assets/market/dolphin-girl/idle",
          "frames": 12,
          "frameWidth": 64,
          "frameHeight": 64,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 1200
        },
        "TRIGGER_MUMT9NZ6_FPXR": {
          "dir": "/assets/market/dolphin-girl/trigger_mumt9nz6_fpxr",
          "frames": 6,
          "frameWidth": 64,
          "frameHeight": 64,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 600
        },
        "TRIGGER_MUMT9A2B_UGQ0": {
          "dir": "/assets/market/dolphin-girl/trigger_mumt9a2b_ugq0",
          "frames": 12,
          "frameWidth": 64,
          "frameHeight": 64,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 1200
        },
        "TRIGGER_MUMTK6HY_DGVQ": {
          "dir": "/assets/market/dolphin-girl/trigger_mumtk6hy_dgvq",
          "frames": 6,
          "frameWidth": 64,
          "frameHeight": 64,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 600
        },
        "TRIGGER_MUMTSRD9_PE34": {
          "dir": "/assets/market/dolphin-girl/trigger_mumtsrd9_pe34",
          "frames": 11,
          "frameWidth": 64,
          "frameHeight": 64,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            300
          ],
          "duration": 1300
        },
        "TRIGGER_MUMTZYFD_0OGL": {
          "dir": "/assets/market/dolphin-girl/trigger_mumtzyfd_0ogl",
          "frames": 11,
          "frameWidth": 64,
          "frameHeight": 64,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 1100
        },
        "TRIGGER_MUMTZL67_R033": {
          "dir": "/assets/market/dolphin-girl/trigger_mumtzl67_r033",
          "frames": 11,
          "frameWidth": 64,
          "frameHeight": 64,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 1100
        },
        "TRIGGER_MUMUGZC4_7CRE": {
          "dir": "/assets/market/dolphin-girl/trigger_mumugzc4_7cre",
          "frames": 12,
          "frameWidth": 64,
          "frameHeight": 64,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 1200
        }
      },
      "labels": {
        "IDLE": {
          "zh": "待机",
          "en": "Idle"
        },
        "TRIGGER_MUMT9NZ6_FPXR": {
          "zh": "出场",
          "en": "Entrance"
        },
        "TRIGGER_MUMT9A2B_UGQ0": {
          "zh": "闲置反应",
          "en": "Idle reaction"
        },
        "TRIGGER_MUMTK6HY_DGVQ": {
          "zh": "播放动画",
          "en": "Animation started"
        },
        "TRIGGER_MUMTSRD9_PE34": {
          "zh": "动画停止",
          "en": "Animation stopped"
        },
        "TRIGGER_MUMTZYFD_0OGL": {
          "zh": "导出完成",
          "en": "Export complete"
        },
        "TRIGGER_MUMTZL67_R033": {
          "zh": "保存反应",
          "en": "Save reaction"
        },
        "TRIGGER_MUMUGZC4_7CRE": {
          "zh": "戳一下",
          "en": "Poke"
        }
      },
      "idle": {
        "dir": "/assets/market/dolphin-girl/idle",
        "frames": 12,
        "frameWidth": 64,
        "frameHeight": 64,
        "durations": [
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100,
          100
        ],
        "duration": 1200
      }
    },
    "includes": [
      {
        "zh": "可安装的原始 .mspet 宠物包",
        "en": "Original installable .mspet package"
      }
    ]
  },
  {
    "id": "pet-mooncat",
    "category": "pets",
    "name": {
      "zh": "月猫",
      "en": "Mooncat"
    },
    "tagline": {
      "zh": "74 帧像素动画，陪你一起创作",
      "en": "74 frames of pixel animation"
    },
    "body": {
      "zh": "月猫宠物包包含 11 组动画，可安装到软件，也可以在这里预览动作。",
      "en": "Mooncat includes 11 animations. Install the pet in the app or try the animations here."
    },
    "price": 0,
    "size": {
      "zh": "1 只宠物 · 11 组动画 · 74 帧",
      "en": "1 pet · 11 animations · 74 frames"
    },
    "formats": [
      ".mspet"
    ],
    "download": "/assets/market/mooncat/pet.mspet",
    "image": "/assets/market/mooncat/idle/00.png",
    "animations": {
      "triggers": [
        {
          "repeat": true,
          "id": "TRIGGER_MUFQUEYN_L68B",
          "event": "pet.hover",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUFQUL40_KKD1",
          "event": "history.undo",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        },
        {
          "repeat": true,
          "id": "TRIGGER_MUFQURS2_0W7Y",
          "event": "pet.dragging",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUFQVM0T_FL1K",
          "event": "document.saved",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUFR9D2P_Z4BA",
          "event": "layer.deleted",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUHBJ52C_FYGY",
          "event": "pet.drag-start",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUHBJ84V_GFUG",
          "event": "pet.drag-end",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUHCKGCV_ARUQ",
          "event": "pet.click",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUJSKFQB_0YET",
          "event": "export-complete",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        },
        {
          "repeat": false,
          "id": "TRIGGER_MUJSMB90_VIW1",
          "event": "pet.leave",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 0
        }
      ],
      "order": [
        "TRIGGER_MUJSKFQB_0YET",
        "TRIGGER_MUHCKGCV_ARUQ",
        "TRIGGER_MUHBJ84V_GFUG",
        "TRIGGER_MUHBJ52C_FYGY",
        "TRIGGER_MUFR9D2P_Z4BA",
        "TRIGGER_MUFQVM0T_FL1K",
        "TRIGGER_MUFQURS2_0W7Y",
        "TRIGGER_MUFQUL40_KKD1",
        "TRIGGER_MUFQUEYN_L68B",
        "IDLE",
        "TRIGGER_MUJSMB90_VIW1"
      ],
      "sheets": {
        "TRIGGER_MUJSKFQB_0YET": {
          "dir": "/assets/market/mooncat/trigger_mujskfqb_0yet",
          "frames": 6,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            60,
            100,
            80,
            300,
            80,
            60
          ],
          "duration": 680
        },
        "TRIGGER_MUHCKGCV_ARUQ": {
          "dir": "/assets/market/mooncat/trigger_muhckgcv_aruq",
          "frames": 6,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            60,
            100,
            60,
            200,
            60,
            60
          ],
          "duration": 540
        },
        "TRIGGER_MUHBJ84V_GFUG": {
          "dir": "/assets/market/mooncat/trigger_muhbj84v_gfug",
          "frames": 8,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            50,
            50,
            40,
            50,
            40,
            50,
            50,
            50
          ],
          "duration": 380
        },
        "TRIGGER_MUHBJ52C_FYGY": {
          "dir": "/assets/market/mooncat/trigger_muhbj52c_fygy",
          "frames": 8,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            50,
            50,
            40,
            50,
            40,
            50,
            50,
            50
          ],
          "duration": 380
        },
        "TRIGGER_MUFR9D2P_Z4BA": {
          "dir": "/assets/market/mooncat/trigger_mufr9d2p_z4ba",
          "frames": 5,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            100,
            100,
            100,
            500,
            60
          ],
          "duration": 860
        },
        "TRIGGER_MUFQVM0T_FL1K": {
          "dir": "/assets/market/mooncat/trigger_mufqvm0t_fl1k",
          "frames": 6,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            60,
            100,
            80,
            300,
            80,
            60
          ],
          "duration": 680
        },
        "TRIGGER_MUFQURS2_0W7Y": {
          "dir": "/assets/market/mooncat/trigger_mufqurs2_0w7y",
          "frames": 8,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 800
        },
        "TRIGGER_MUFQUL40_KKD1": {
          "dir": "/assets/market/mooncat/trigger_mufqul40_kkd1",
          "frames": 5,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            100,
            100,
            100,
            500,
            60
          ],
          "duration": 860
        },
        "TRIGGER_MUFQUEYN_L68B": {
          "dir": "/assets/market/mooncat/trigger_mufqueyn_l68b",
          "frames": 6,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            60,
            100,
            100,
            60,
            100,
            100
          ],
          "duration": 520
        },
        "IDLE": {
          "dir": "/assets/market/mooncat/idle",
          "frames": 6,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            60,
            100,
            100,
            60,
            100,
            500
          ],
          "duration": 920
        },
        "TRIGGER_MUJSMB90_VIW1": {
          "dir": "/assets/market/mooncat/trigger_mujsmb90_viw1",
          "frames": 10,
          "frameWidth": 40,
          "frameHeight": 40,
          "durations": [
            60,
            100,
            100,
            60,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 920
        }
      },
      "labels": {
        "TRIGGER_MUJSKFQB_0YET": {
          "zh": "导出完成",
          "en": "Export complete"
        },
        "TRIGGER_MUHCKGCV_ARUQ": {
          "zh": "戳一下",
          "en": "Poke"
        },
        "TRIGGER_MUHBJ84V_GFUG": {
          "zh": "放下",
          "en": "Put down"
        },
        "TRIGGER_MUHBJ52C_FYGY": {
          "zh": "提起",
          "en": "Pick up"
        },
        "TRIGGER_MUFR9D2P_Z4BA": {
          "zh": "删除图层反应",
          "en": "Layer deletion"
        },
        "TRIGGER_MUFQVM0T_FL1K": {
          "zh": "保存反应",
          "en": "Save reaction"
        },
        "TRIGGER_MUFQURS2_0W7Y": {
          "zh": "拖动",
          "en": "Dragging"
        },
        "TRIGGER_MUFQUL40_KKD1": {
          "zh": "撤销反应",
          "en": "Undo reaction"
        },
        "TRIGGER_MUFQUEYN_L68B": {
          "zh": "摸摸",
          "en": "Hover"
        },
        "IDLE": {
          "zh": "待机",
          "en": "Idle"
        },
        "TRIGGER_MUJSMB90_VIW1": {
          "zh": "离开",
          "en": "Leave"
        }
      },
      "idle": {
        "dir": "/assets/market/mooncat/idle",
        "frames": 6,
        "frameWidth": 40,
        "frameHeight": 40,
        "durations": [
          60,
          100,
          100,
          60,
          100,
          500
        ],
        "duration": 920
      }
    },
    "includes": [
      {
        "zh": "可安装的原始 .mspet 宠物包",
        "en": "Original installable .mspet package"
      }
    ]
  },
  {
    "id": "pet-sakuya",
    "category": "pets",
    "name": {
      "zh": "咲夜",
      "en": "Sakuya"
    },
    "tagline": {
      "zh": "51 帧像素动画，陪你一起创作",
      "en": "51 frames of pixel animation"
    },
    "body": {
      "zh": "咲夜宠物包包含 6 组动画，可安装到软件，也可以在这里预览动作。",
      "en": "Sakuya includes 6 animations. Install the pet in the app or try the animations here."
    },
    "price": 0.9722222222222222,
    "size": {
      "zh": "1 只宠物 · 6 组动画 · 51 帧",
      "en": "1 pet · 6 animations · 51 frames"
    },
    "formats": [
      ".mspet"
    ],
    "download": "/assets/market/sakuya/pet.mspet",
    "image": "/assets/market/sakuya/idle/00.png",
    "animations": {
      "triggers": [
        {
          "id": "TRIGGER_MUGV64GO_F0CC",
          "event": "animation.stopped",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 3000
        },
        {
          "id": "TRIGGER_MUGV8QUL_7GEN",
          "event": "history.undo",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 3000
        },
        {
          "id": "TRIGGER_MUGVATRB_SUI4",
          "event": "project.opened",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 3000
        },
        {
          "id": "TRIGGER_MUGVB6X6_H8A0",
          "event": "project.created",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 3000
        },
        {
          "id": "TRIGGER_MUGYVB5Q_F97K",
          "event": "pet.enter",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 1000
        }
      ],
      "order": [
        "TRIGGER_MUGV64GO_F0CC",
        "IDLE",
        "TRIGGER_MUGV8QUL_7GEN",
        "TRIGGER_MUGVATRB_SUI4",
        "TRIGGER_MUGVB6X6_H8A0",
        "TRIGGER_MUGYVB5Q_F97K"
      ],
      "sheets": {
        "TRIGGER_MUGV64GO_F0CC": {
          "dir": "/assets/market/sakuya/trigger_mugv64go_f0cc",
          "frames": 9,
          "frameWidth": 100,
          "frameHeight": 100,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 900
        },
        "IDLE": {
          "dir": "/assets/market/sakuya/idle",
          "frames": 6,
          "frameWidth": 100,
          "frameHeight": 100,
          "durations": [
            1000,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 1500
        },
        "TRIGGER_MUGV8QUL_7GEN": {
          "dir": "/assets/market/sakuya/trigger_mugv8qul_7gen",
          "frames": 11,
          "frameWidth": 100,
          "frameHeight": 100,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 1100
        },
        "TRIGGER_MUGVATRB_SUI4": {
          "dir": "/assets/market/sakuya/trigger_mugvatrb_sui4",
          "frames": 9,
          "frameWidth": 100,
          "frameHeight": 100,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 900
        },
        "TRIGGER_MUGVB6X6_H8A0": {
          "dir": "/assets/market/sakuya/trigger_mugvb6x6_h8a0",
          "frames": 9,
          "frameWidth": 100,
          "frameHeight": 100,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 900
        },
        "TRIGGER_MUGYVB5Q_F97K": {
          "dir": "/assets/market/sakuya/trigger_mugyvb5q_f97k",
          "frames": 7,
          "frameWidth": 100,
          "frameHeight": 100,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            200,
            100
          ],
          "duration": 800
        }
      },
      "labels": {
        "TRIGGER_MUGV64GO_F0CC": {
          "zh": "动画停止",
          "en": "Animation stopped"
        },
        "IDLE": {
          "zh": "待机",
          "en": "Idle"
        },
        "TRIGGER_MUGV8QUL_7GEN": {
          "zh": "撤销反应",
          "en": "Undo reaction"
        },
        "TRIGGER_MUGVATRB_SUI4": {
          "zh": "打开工程",
          "en": "Open project"
        },
        "TRIGGER_MUGVB6X6_H8A0": {
          "zh": "新建工程",
          "en": "New project"
        },
        "TRIGGER_MUGYVB5Q_F97K": {
          "zh": "出场",
          "en": "Entrance"
        }
      },
      "idle": {
        "dir": "/assets/market/sakuya/idle",
        "frames": 6,
        "frameWidth": 100,
        "frameHeight": 100,
        "durations": [
          1000,
          100,
          100,
          100,
          100,
          100
        ],
        "duration": 1500
      }
    },
    "includes": [
      {
        "zh": "可安装的原始 .mspet 宠物包",
        "en": "Original installable .mspet package"
      }
    ]
  },
  {
    "id": "pet-herdboy",
    "category": "pets",
    "name": {
      "zh": "牧童",
      "en": "Herdboy"
    },
    "tagline": {
      "zh": "34 帧像素动画，陪你一起创作",
      "en": "34 frames of pixel animation"
    },
    "body": {
      "zh": "牧童宠物包包含 3 组动画，可安装到软件，也可以在这里预览动作。",
      "en": "Herdboy includes 3 animations. Install the pet in the app or try the animations here."
    },
    "price": 0.6944444444444444,
    "size": {
      "zh": "1 只宠物 · 3 组动画 · 34 帧",
      "en": "1 pet · 3 animations · 34 frames"
    },
    "formats": [
      ".mspet"
    ],
    "download": "/assets/market/herdboy/pet.mspet",
    "image": "/assets/market/herdboy/idle/00.png",
    "animations": {
      "triggers": [
        {
          "id": "TRIGGER_MUMSKU1Q_XA7U",
          "event": "history.undo",
          "tool": "",
          "idleSeconds": 60,
          "cooldownMs": 2000
        }
      ],
      "order": [
        "TRIGGER_MUMSKU1Q_XA7U",
        "SHOW",
        "IDLE"
      ],
      "sheets": {
        "TRIGGER_MUMSKU1Q_XA7U": {
          "dir": "/assets/market/herdboy/trigger_mumsku1q_xa7u",
          "frames": 12,
          "frameWidth": 96,
          "frameHeight": 96,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 1200
        },
        "SHOW": {
          "dir": "/assets/market/herdboy/show",
          "frames": 16,
          "frameWidth": 96,
          "frameHeight": 96,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 1600
        },
        "IDLE": {
          "dir": "/assets/market/herdboy/idle",
          "frames": 6,
          "frameWidth": 96,
          "frameHeight": 96,
          "durations": [
            100,
            100,
            100,
            100,
            100,
            100
          ],
          "duration": 600
        }
      },
      "labels": {
        "TRIGGER_MUMSKU1Q_XA7U": {
          "zh": "撤销反应",
          "en": "Undo reaction"
        },
        "SHOW": {
          "zh": "出场",
          "en": "Entrance"
        },
        "IDLE": {
          "zh": "待机",
          "en": "Idle"
        }
      },
      "idle": {
        "dir": "/assets/market/herdboy/idle",
        "frames": 6,
        "frameWidth": 96,
        "frameHeight": 96,
        "durations": [
          100,
          100,
          100,
          100,
          100,
          100
        ],
        "duration": 600
      }
    },
    "includes": [
      {
        "zh": "可安装的原始 .mspet 宠物包",
        "en": "Original installable .mspet package"
      }
    ]
  }
]
