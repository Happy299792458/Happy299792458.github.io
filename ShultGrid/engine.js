class ShultGridEngine {
  constructor() {
    this.cells = [];
    this.currentNumber = 1;
    this.startTime = 0;
    this.endTime = 0;
    this.isFinished = false;
    this.isPlaying = false;
    this.mode = 'normal';
  }

  init(mode = 'normal') {
    this.mode = mode;
    this.currentNumber = 1;
    this.isFinished = false;
    this.isPlaying = false;
    
    this.cells = Array.from({length: 25}, (_, i) => ({
      id: i,
      num: i + 1,
      displayNum: i + 1,
      r: Math.floor(i / 5),
      c: i % 5,
      zIndex: 1
    }));

    if (this.mode === 'normal' || this.mode === 'easy' || this.mode === 'minimalist') {
      this.shufflePositions();
    } else if (this.mode === 'extreme') {
      this.cells.forEach(cell => cell.displayNum = 1);
      this.shufflePositions();
    } else if (this.mode === 'hard') {
      this.setupSpiral();
    }
  }

  shufflePositions() {
    let coords = [];
    for(let i=0; i<5; i++) {
      for(let j=0; j<5; j++) {
        coords.push({r: i, c: j});
      }
    }
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]];
    }
    this.cells.forEach((cell, i) => {
      cell.r = coords[i].r;
      cell.c = coords[i].c;
    });
  }

  setupSpiral() {
    const path = [
      [0,0], [0,1], [0,2], [0,3], [0,4],
      [1,4], [2,4], [3,4], [4,4],
      [4,3], [4,2], [4,1], [4,0],
      [3,0], [2,0], [1,0],
      [1,1], [1,2], [1,3],
      [2,3], [3,3],
      [3,2], [3,1],
      [2,1],
      [2,2]
    ];
    let flipX = Math.random() > 0.5;
    let flipY = Math.random() > 0.5;
    let swapXY = Math.random() > 0.5;

    let finalPath = path.map(([r, c]) => {
      let nr = r, nc = c;
      if (flipX) nr = 4 - nr;
      if (flipY) nc = 4 - nc;
      if (swapXY) [nr, nc] = [nc, nr];
      return {r: nr, c: nc};
    });

    this.cells.sort((a,b) => a.num - b.num);
    this.cells.forEach((cell, i) => {
      cell.r = finalPath[i].r;
      cell.c = finalPath[i].c;
    });
  }

  start() {
    this.isPlaying = true;
    this.startTime = performance.now();
  }

  clickCell(id) {
    if (!this.isPlaying || this.isFinished) return { status: 'ignore' };

    const cell = this.cells.find(c => c.id === id);
    if (!cell) return { status: 'ignore' };

    let isCorrect = (this.mode === 'extreme') ? true : (cell.num === this.currentNumber);

    if (isCorrect) {
      const clickedR = cell.r;
      const clickedC = cell.c;

      this.currentNumber++;
      
      if (this.currentNumber > 25) {
        this.finish();
        return { status: 'finish' };
      }

      this.cells.forEach(c => c.zIndex = 1);

      if (this.mode === 'extreme') {
        this.cells.forEach(c => c.displayNum = this.currentNumber);
      } else if (this.mode === 'easy') {
        const nextCell = this.cells.find(c => c.num === this.currentNumber);
        if (nextCell) {
          const tempR = nextCell.r;
          const tempC = nextCell.c;
          nextCell.r = clickedR;
          nextCell.c = clickedC;
          cell.r = tempR;
          cell.c = tempC;
          
          nextCell.zIndex = 10;
          cell.zIndex = 10;
        }
      } else if (this.mode === 'minimalist') {
        const nextCell = this.cells.find(c => c.num === this.currentNumber);
        let coords = this.cells.map(c => ({r: c.r, c: c.c}));
        
        let targetIndex = coords.findIndex(c => c.r === clickedR && c.c === clickedC);
        if (targetIndex !== -1) coords.splice(targetIndex, 1);
        
        for (let i = coords.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [coords[i], coords[j]] = [coords[j], coords[i]];
        }
        
        let coordPointer = 0;
        this.cells.forEach(c => {
          if (c.id === nextCell.id) {
            c.r = clickedR;
            c.c = clickedC;
            c.zIndex = 0; 
          } else {
            c.r = coords[coordPointer].r;
            c.c = coords[coordPointer].c;
            c.zIndex = 5; 
            coordPointer++;
          }
        });
      }

      return { status: 'correct' };
    } else {
      return { status: 'wrong' };
    }
  }

  finish() {
    this.endTime = performance.now();
    this.isFinished = true;
    this.isPlaying = false;
  }

  getTimeElapsed() {
    if (this.isFinished) {
      return ((this.endTime - this.startTime) / 1000).toFixed(2);
    } else if (this.isPlaying) {
      return ((performance.now() - this.startTime) / 1000).toFixed(2);
    }
    return "0.00";
  }

  getRating(timeStr) {
    const t = parseFloat(timeStr);
    if (t < 15) return { label: "超神", desc: "您的专注力与视觉搜索速度超越了99%的人群！" };
    if (t < 25) return { label: "极佳", desc: "非常出色的视觉搜索与专注力，反应敏捷。" };
    if (t < 35) return { label: "良好", desc: "处于健康成年人的优秀水平，专注力稳定。" };
    if (t < 50) return { label: "一般", desc: "正常表现，有进一步提升专注力的空间。" };
    return { label: "较弱", desc: "注意力集中程度略显疲惫，建议适当休息后再试。" };
  }
}
