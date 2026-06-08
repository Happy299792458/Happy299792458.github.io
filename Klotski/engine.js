class KlotskiEngine {
  constructor() {
    this.size = 4;
    this.mode = 'classic';
    this.cells = [];
    this.emptyR = 3;
    this.emptyC = 3;
    this.startTime = 0;
    this.endTime = 0;
    this.isFinished = false;
    this.isPlaying = false;
    this.moves = 0;
  }

  init(size = 4, mode = 'classic') {
    this.size = parseInt(size);
    this.mode = mode;
    this.isFinished = false;
    this.isPlaying = false;
    this.moves = 0;
    
    this.cells = [];
    let count = 1;
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (r === this.size - 1 && c === this.size - 1) {
          this.cells.push({ id: 0, num: 0, r, c }); 
          this.emptyR = r;
          this.emptyC = c;
        } else {
          this.cells.push({ id: count, num: count, r, c });
          count++;
        }
      }
    }
    
    this.shuffle();
  }

  shuffle() {
    if (this.mode === 'classic') {
      let iterations = this.size * this.size * 100;
      let prevR = -1;
      let prevC = -1;

      for (let i = 0; i < iterations; i++) {
        let neighbors = this.getNeighbors(this.emptyR, this.emptyC);
        let validNeighbors = neighbors.filter(n => !(n.r === prevR && n.c === prevC));
        if (validNeighbors.length === 0) validNeighbors = neighbors;

        let randMove = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
        
        prevR = this.emptyR;
        prevC = this.emptyC;
        
        this.swap(randMove.r, randMove.c);
      }

      while (this.checkWin()) {
        let neighbors = this.getNeighbors(this.emptyR, this.emptyC);
        let randMove = neighbors[Math.floor(Math.random() * neighbors.length)];
        this.swap(randMove.r, randMove.c);
      }
    } else {
      let numbers = [];
      for (let i = 1; i < this.size * this.size; i++) numbers.push(i);
      
      for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
      }
      
      let isSolved = true;
      for (let i = 0; i < numbers.length; i++) {
        if (numbers[i] !== i + 1) {
          isSolved = false;
          break;
        }
      }
      if (isSolved) {
        [numbers[numbers.length-1], numbers[numbers.length-2]] = [numbers[numbers.length-2], numbers[numbers.length-1]];
      }

      let ptr = 0;
      this.cells.forEach(c => {
        if (c.id !== 0) {
          c.num = numbers[ptr++];
        }
      });
    }
  }

  getNeighbors(r, c) {
    let list = [];
    if (r > 0) list.push({ r: r - 1, c });
    if (r < this.size - 1) list.push({ r: r + 1, c });
    if (c > 0) list.push({ r, c: c - 1 });
    if (c < this.size - 1) list.push({ r, c: c + 1 });
    return list;
  }

  swap(r, c) {
    const tile = this.cells.find(cell => cell.r === r && cell.c === c);
    const emptyTile = this.cells.find(cell => cell.id === 0);
    
    tile.r = this.emptyR;
    tile.c = this.emptyC;
    emptyTile.r = r;
    emptyTile.c = c;
    
    this.emptyR = r;
    this.emptyC = c;
  }

  start() {
    this.isPlaying = true;
    this.startTime = performance.now();
  }

  clickCell(id) {
    if (this.mode !== 'classic') return { status: 'ignore' };
    if (!this.isPlaying || this.isFinished || id === 0) return { status: 'ignore' };

    const cell = this.cells.find(c => c.id === id);
    if (!cell) return { status: 'ignore' };

    let moved = false;
    const targetR = cell.r;
    const targetC = cell.c;

    if (targetR === this.emptyR) {
      let dir = Math.sign(this.emptyC - targetC);
      while (this.emptyC !== targetC) {
        this.swap(this.emptyR, this.emptyC - dir);
        moved = true;
      }
    } else if (targetC === this.emptyC) {
      let dir = Math.sign(this.emptyR - targetR);
      while (this.emptyR !== targetR) {
        this.swap(this.emptyR - dir, this.emptyC);
        moved = true;
      }
    }
    
    if (moved) {
      this.moves++;
      
      if (this.checkWin()) {
        this.finish();
        return { status: 'win' };
      }
      return { status: 'moved' };
    }
    return { status: 'invalid' };
  }

  setNumber(r, c, val) {
    if (!this.isPlaying || this.isFinished) return { status: 'ignore' };
    const cell = this.cells.find(cell => cell.r === r && cell.c === c);
    if (!cell || cell.id === 0) return { status: 'ignore' };
    
    cell.num = val;
    this.moves++;
    
    if (this.checkWin()) {
      this.finish();
      return { status: 'win' };
    }
    return { status: 'moved' };
  }

  checkWin() {
    for (let i = 0; i < this.cells.length; i++) {
      let cell = this.cells[i];
      if (cell.id === 0) {
        if (cell.r !== this.size - 1 || cell.c !== this.size - 1) return false;
      } else {
        let targetR = Math.floor((cell.num - 1) / this.size);
        let targetC = (cell.num - 1) % this.size;
        if (cell.r !== targetR || cell.c !== targetC) return false;
      }
    }
    return true;
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
    if (this.size === 3) {
      if (t < 5) return { label: "超神", desc: "极致的手速与规划能力！" };
      if (t < 15) return { label: "极佳", desc: "非常迅速的路径计算。" };
      if (t < 30) return { label: "良好", desc: "熟练掌握了基础解法。" };
      return { label: "一般", desc: "顺利完成，有待提速。" };
    } else if (this.size === 4) {
      if (t < 30) return { label: "超神", desc: "绝对的大师级解谜速度！" };
      if (t < 60) return { label: "极佳", desc: "非常高效的空间规划。" };
      if (t < 120) return { label: "良好", desc: "解题思路清晰连贯。" };
      return { label: "一般", desc: "成功完赛，建议练习速解模式。" };
    } else {
      if (t < 120) return { label: "超神", desc: "惊人的毅力与大脑运算力！" };
      if (t < 300) return { label: "极佳", desc: "出色的统筹与推导能力。" };
      if (t < 600) return { label: "良好", desc: "稳扎稳打，顺利过关。" };
      return { label: "一般", desc: "解开了复杂的谜题，干得漂亮。" };
    }
  }
}
