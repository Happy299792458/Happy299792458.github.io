/**
 * Intelligence Test (IQ) Analytical Engine
 * Handles Standard Normal Distribution Calculations and Adaptive Bisection State Machine.
 */

// High precision approximation of the inverse normal CDF (z-score) by Peter John Acklam
function normalCDFInverse(p) {
  if (p <= 0) return -6.0; // clamp to reasonable z-scores
  if (p >= 1) return 6.0;

  // Coefficients in rational approximations
  const a = [
    -3.969683028665376e+01,
     2.209460984245205e+02,
    -2.759285104469687e+02,
     1.383577518672690e+02,
    -3.066479895627348e+01,
     2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,
     1.615858368580409e+02,
    -1.556989798598866e+02,
     6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e+00,
    -2.549732539343734e+00,
     4.374664141464968e+00,
     2.938163982698783e+00
  ];
  const d = [
     7.784695709041462e-03,
     3.224671290700341e-01,
     2.445134137142446e+00,
     3.754408661907416e+00
  ];

  const p_low = 0.02425;
  const p_high = 1 - p_low;
  let q, r;

  if (p < p_low) {
    // Rational approximation for lower tail
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= p_high) {
    // Rational approximation for central region
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    // Rational approximation for upper tail
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

/**
 * Calculates IQ based on percentile using standard Normal Distribution (mean=100, SD=15)
 */
function getIQFromPercentile(p) {
  const z = normalCDFInverse(p);
  return 100 + 15 * z;
}

/**
 * IQ Test State Machine class.
 */
class IQTestEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.L = 0.0;               // Left probability bound
    this.R = 1.0;               // Right probability bound
    this.history = [];          // Array of objects { qIndex, questionValue, answer }
    this.askedQuestions = new Set(); // To prevent duplicate question values
    this.isFinished = false;
    this.finalIQ = null;
    this.finalPercentile = null;
    this.finalZScore = null;
  }

  /**
   * Returns the current question details
   */
  getCurrentQuestion() {
    if (this.isFinished) return null;

    const p = (this.L + this.R) / 2;
    const rawIQ = getIQFromPercentile(p);
    const roundedIQ = Math.round(rawIQ);

    return {
      index: this.history.length + 1,
      targetValue: roundedIQ,
      rawVal: rawIQ,
      zScore: normalCDFInverse(p)
    };
  }

  /**
   * Submits user answer ('yes' or 'no') for the current question
   */
  submitAnswer(answer) {
    if (this.isFinished) return;

    const p = (this.L + this.R) / 2;
    const currentQuestion = this.getCurrentQuestion();
    const roundedIQ = currentQuestion.targetValue;

    // Record history
    this.history.push({
      qIndex: this.history.length + 1,
      questionValue: roundedIQ,
      answer: answer,
      bounds: { L: this.L, R: this.R }
    });

    this.askedQuestions.add(roundedIQ);

    // Apply Bisection Transition
    if (answer === 'yes') {
      this.L = p;
    } else {
      this.R = p;
    }

    // Check if we should stop for the next step
    const stopReason = this.shouldStopTesting();
    if (stopReason) {
      this.finishTest(stopReason);
    }
  }

  /**
   * Evaluates stopping conditions
   */
  shouldStopTesting() {
    const totalQuestions = this.history.length;
    
    // Check if we have continuous combo
    const answers = this.history.map(h => h.answer);
    const allYes = answers.every(ans => ans === 'yes');
    const allNo = answers.every(ans => ans === 'no');
    const isCombo = allYes || allNo;

    // Calculate next potential values
    const p_next = (this.L + this.R) / 2;
    const Q_next = Math.round(getIQFromPercentile(p_next));

    // 1. Resolution Check: If next target value has already been asked, we cannot distinguish further in integer terms.
    if (this.askedQuestions.has(Q_next)) {
      return "RESOLUTION_LIMIT_DUPLICATE";
    }

    // 2. Bound Check: If next question is out of boundaries in integer terms
    const roundedL = Math.round(getIQFromPercentile(this.L > 0 ? this.L : 0.0000001));
    const roundedR = Math.round(getIQFromPercentile(this.R < 1 ? this.R : 0.9999999));
    if (Q_next <= roundedL || Q_next >= roundedR) {
      return "RESOLUTION_LIMIT_BOUNDS";
    }

    // 3. Question Count Limit Check (Default 10)
    if (totalQuestions >= 10) {
      if (!isCombo) {
        return "STANDARD_LIMIT_REACHED";
      }
    }

    // 4. Floating-Point/Math limit to prevent infinite loops at extremes
    if (this.R - this.L < 1e-15) {
      return "MATH_LIMIT_REACHED";
    }

    return null; // Continue testing
  }

  /**
   * Finalizes test and computes statistics
   */
  finishTest(reason) {
    this.isFinished = true;
    
    const p_final = (this.L + this.R) / 2;
    const rawIQ = getIQFromPercentile(p_final);
    
    // Final scores
    this.finalPercentile = p_final;
    this.finalZScore = normalCDFInverse(p_final);
    this.finalIQ = Math.round(rawIQ);
    this.stopReason = reason;
  }

  /**
   * Returns clinical description based on final IQ
   */
  getIQClassification() {
    const iq = this.finalIQ;
    if (iq >= 145) return { label: "超级天才", desc: "恭喜！您的智商在人类中的地位，就好比亚里士多德在力学中的地位，牛顿在波动光学中的地位，拉瓦锡在热力学中的地位。或许您应当成为类人！" };
    if (iq >= 130) return { label: "天才", desc: "您的智商显著高于人群平均水平，具备极其出色的抽象推理、空间逻辑与分析处理能力。" };
    if (iq >= 80)  return { label: "一般人", desc: "您的智力水平处于标准正态分布的核心区间，与全球绝大多数人持平。" };
    if (iq >= 55)  return { label: "弱智", desc: "您的脑力推理表现处于临界阈值，在复杂逻辑推演中可能会遇到一定障碍。" };
    return { label: "超级弱智", desc: "您是怎么看懂题目的？然而，这并不是说您是一个蠢货，因为您仍有别的用武之地！或许您应当去遗传与发育生物学研究所获取一份工作。" };
  }

  /**
   * Returns a description of their percentile rarity
   */
  getRarityStatement() {
    const p = this.finalPercentile;
    if (p >= 0.5) {
      const beatsPercent = (p * 100).toFixed(4);
      const oneInN = Math.round(1 / (1 - p));
      return {
        beats: beatsPercent,
        ratio: `相当于每 ${oneInN} 个人中仅有 1 个人比您更聪明。`
      };
    } else {
      const beatsPercent = (p * 100).toFixed(4);
      const oneInN = Math.round(1 / p);
      return {
        beats: beatsPercent,
        ratio: `相当于每 ${oneInN} 个人中仅有 1 个人比您分数更低。`
      };
    }
  }
}

// Export for module use or attach to window for simple browser script loading
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IQTestEngine, normalCDFInverse, getIQFromPercentile };
} else {
  window.IQTestEngine = IQTestEngine;
  window.normalCDFInverse = normalCDFInverse;
  window.getIQFromPercentile = getIQFromPercentile;
}
