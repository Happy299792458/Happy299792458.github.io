/**
 * BaDC Personality Test Engine
 */

// Fallback questions in case fetch('questions.json') fails under local CORS policies
const FALLBACK_QUESTIONS = [
  {
    "id": 1,
    "question": "当面对一个完全未知的行业商机时，你的第一反应是：",
    "options": [
      {"text": "感到兴奋，渴望成为第一批入场探索并获取高额回报的人", "type": "A"},
      {"text": "保持警惕，倾向于等待行业模式成熟后再考虑是否跟进", "type": "B"},
      {"text": "寻找历史数据和量化模型，客观评估其成功率和期望值", "type": "C"},
      {"text": "询问身边信任的导师或朋友，听取他们的直观感受和建议", "type": "D"}
    ]
  },
  {
    "id": 2,
    "question": "在团队合作中，如果遇到了关键方向上的冲突，你倾向于：",
    "options": [
      {"text": "迅速发表主张，用个人直觉和感召力说服团队快速推进", "type": "A"},
      {"text": "遵循原定的规章和安全红线，寻找冲突各方最保险的折中点", "type": "B"},
      {"text": "罗列所有分歧点的逻辑利弊，通过论证和公式推导确定最优解", "type": "C"},
      {"text": "花时间安抚大家的情绪，促进深度沟通以达成和谐的共识", "type": "D"}
    ]
  },
  {
    "id": 3,
    "question": "在选择个人的度假目的地时，你更向往哪种行程？",
    "options": [
      {"text": "前往未开发的原始地带，体验极限运动和充满未知的越野探险", "type": "A"},
      {"text": "预订环境熟悉的高品质度假酒店，按部就班地进行疗养和放松", "type": "B"},
      {"text": "规划条理极强的历史文化考察，深入研究目的地的社会演化背景", "type": "C"},
      {"text": "与家人或知己前往温馨静谧的地方，享受高浓度的人际陪伴时光", "type": "D"}
    ]
  },
  {
    "id": 4,
    "question": "假如你意外获得了一笔丰厚的投资奖金，你会首选：",
    "options": [
      {"text": "重仓高波动、高回报潜力的成长型初创项目或前沿虚拟资产", "type": "A"},
      {"text": "买入长期国债、大额存单或购置抗风险能力极强的实体资产", "type": "B"},
      {"text": "运用资产配置理论，根据大盘走势建立宏观量化基金组合", "type": "C"},
      {"text": "改善家庭的生活品质，购置能够增进亲友聚会幸福感的礼品", "type": "D"}
    ]
  },
  {
    "id": 5,
    "question": "面对生活中突如其来的巨变或变故，你的核心应对模式是：",
    "options": [
      {"text": "迅速调整赛道，将危机视为难得的洗牌机会，主动出击寻找蓝海", "type": "A"},
      {"text": "努力收紧战线，防御现有基本盘，把保证自身的安全视作首要任务", "type": "B"},
      {"text": "理智剥离情绪干扰，收集周边情报并制定详尽的A/B/C备份计划", "type": "C"},
      {"text": "寻求亲朋的情感共振与慰藉，与身边的人抱团取暖共同分担焦虑", "type": "D"}
    ]
  }
];

class BaDCEngine {
  constructor() {
    this.questions = [];
    this.currentIndex = 0;
    this.answers = []; // Array of selected option types (e.g. 'A', 'B', 'C', 'D')
    this.isFinished = false;
    this.resultType = null;
  }

  /**
   * Initializes question bank by fetching from JSON or using fallbacks
   */
  async initialize() {
    try {
      const response = await fetch('questions.json');
      if (response.ok) {
        this.questions = await response.json();
        console.log('[BaDC ENGINE] Loaded questions.json successfully.');
      } else {
        this.questions = FALLBACK_QUESTIONS;
        console.warn('[BaDC ENGINE] Failed to load questions.json, loaded fallbacks.');
      }
    } catch (e) {
      this.questions = FALLBACK_QUESTIONS;
      console.log('[BaDC ENGINE] Fetch blocked or file not found. Fallback questions active.', e);
    }
    this.reset();
  }

  reset() {
    this.currentIndex = 0;
    this.answers = [];
    this.isFinished = false;
    this.resultType = null;
  }

  getCurrentQuestion() {
    if (this.isFinished || this.questions.length === 0) return null;
    return this.questions[this.currentIndex];
  }

  submitAnswer(optionType) {
    if (this.isFinished) return;

    this.answers.push(optionType);
    
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
    } else {
      this.finishTest();
    }
  }

  finishTest() {
    this.isFinished = true;
    this.resultType = this.calculateResult();
  }

  calculateResult() {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    this.answers.forEach(type => {
      if (counts[type] !== undefined) {
        counts[type]++;
      }
    });

    // Find the type with the highest count.
    // Tie-breaker order: A, B, C, D
    let maxType = 'A';
    let maxCount = -1;
    ['A', 'B', 'C', 'D'].forEach(type => {
      if (counts[type] > maxCount) {
        maxCount = counts[type];
        maxType = type;
      }
    });

    return maxType;
  }

  getPersonalityProfile() {
    if (!this.isFinished || !this.resultType) return null;

    const profiles = {
      'A': {
        code: 'A者',
        title: '喜欢选A者',
        desc: '你拥有极高的风险耐受度与探索欲。面对未知与变革，你倾向于将其视作自我实现和攫取机会的赛道。你富于直觉，行动迅速，是用热忱与胆识推动边界的开拓先锋。在团队中，你往往扮演创新者与决策带头人的角色。'
      },
      'B': {
        code: 'B者',
        title: '总是选B者',
        desc: '你将稳定、秩序与核心安全视作人生的首要锚点。对于缺乏历史验证的事物，你保持理性的警惕与审慎。你擅长夯实基本盘，在风险来临时筑起坚固的安全防线。在团队中，你是不可或缺的防洪堤坝与流程规范的忠实守护者。'
      },
      'C': {
        code: 'C者',
        title: '很爱选C者',
        desc: '你习惯客观剥离情绪，依靠严密的逻辑推理、海量数据和概率模型来解构世界。你相信证据与事实优于主观感受，并乐于通过深度思考推导出复杂局面的最优解。在团队中，你是冷酷、精准、具备前瞻性规划脑力的核心智囊。'
      },
      'D': {
        code: 'D者',
        title: '经常选D者',
        desc: '你天然关注人与人之间的情感纽带、信任以及团队成员的内心感受。在你看来，没有温度的决策是残缺的。你擅长倾听与化解冲突，乐于通过利他与协作寻求集体和谐。在团队中，你是凝聚力与团队默契的缔造者。'
      }
    };

    const counts = { A: 0, B: 0, C: 0, D: 0 };
    this.answers.forEach(t => counts[t]++);

    // Calculate percentage breakdown for radar-like display
    const total = this.answers.length;
    const percentages = {
      A: ((counts.A / total) * 100).toFixed(0),
      B: ((counts.B / total) * 100).toFixed(0),
      C: ((counts.C / total) * 100).toFixed(0),
      D: ((counts.D / total) * 100).toFixed(0)
    };

    return {
      type: this.resultType,
      profile: profiles[this.resultType],
      percentages: percentages,
      counts: counts
    };
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BaDCEngine };
} else {
  window.BaDCEngine = BaDCEngine;
}
