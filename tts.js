class EngineTTS {
  constructor(size) {
    this.size = size;
    this.matrix = Array.from({ length: size }, () => Array(size).fill(null));
    this.items = [];
  }

  build(words) {
    let bestResult = { matrix: [], items: [] };
    
    // Coba susun beberapa kali untuk mendapatkan layout terbaik
    for(let tryCount = 0; tryCount < 30; tryCount++) {
      this.matrix = Array.from({ length: this.size }, () => Array(this.size).fill(null));
      this.items = [];
      
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      shuffled.sort((a, b) => b.syllables.length - a.syllables.length);
      
      // Letakkan kata pertama di tengah
      const first = shuffled[0];
      const sRow = Math.floor(this.size / 2);
      const sCol = Math.floor((this.size - first.syllables.length) / 2);
      this.insertWord(first, sRow, sCol, 'across');
      
      // Susun kata sisanya
      for(let i = 1; i < shuffled.length; i++) {
        this.attemptIntersect(shuffled[i]);
      }
      
      if(this.items.length > bestResult.items.length) {
        bestResult = { 
          matrix: JSON.parse(JSON.stringify(this.matrix)), 
          items: [...this.items] 
        };
      }
      if(bestResult.items.length === words.length) break;
    }
    return bestResult;
  }

  attemptIntersect(word) {
    const spots = [];
    for(let r = 0; r < this.size; r++) {
      for(let c = 0; c < this.size; c++) {
        const cell = this.matrix[r][c];
        if(!cell) continue;
        
        word.syllables.forEach((syl, idx) => {
          if(cell.syll === syl) {
            const dir = cell.dir === 'across' ? 'down' : 'across';
            const startR = dir === 'down' ? r - idx : r;
            const startC = dir === 'across' ? c - idx : c;
            
            if(this.isValidFit(word, startR, startC, dir)) {
              spots.push({r: startR, c: startC, dir});
            }
          }
        });
      }
    }
    
    if(spots.length > 0) {
      const pick = spots[Math.floor(Math.random() * spots.length)];
      this.insertWord(word, pick.r, pick.c, pick.dir);
    }
  }

  isValidFit(word, r, c, dir) {
    const len = word.syllables.length;
    if(dir === 'across' && (c < 0 || c + len > this.size || r < 0 || r >= this.size)) return false;
    if(dir === 'down' && (r < 0 || r + len > this.size || c < 0 || c >= this.size)) return false;

    for(let i = 0; i < len; i++) {
      const cr = dir === 'down' ? r + i : r;
      const cc = dir === 'across' ? c + i : c;
      const cell = this.matrix[cr][cc];
      
      if(cell !== null) {
        if(cell.syll !== word.syllables[i]) return false;
      } else {
        if(!this.checkClearance(cr, cc, dir, i === 0, i === len - 1)) return false;
      }
    }
    return true;
  }

  checkClearance(r, c, dir, isStart, isEnd) {
    if(isStart) {
      const pr = dir === 'down' ? r - 1 : r;
      const pc = dir === 'across' ? c - 1 : c;
      if(this.inBound(pr, pc) && this.matrix[pr][pc] !== null) return false;
    }
    if(isEnd) {
      const nr = dir === 'down' ? r + 1 : r;
      const nc = dir === 'across' ? c + 1 : c;
      if(this.inBound(nr, nc) && this.matrix[nr][nc] !== null) return false;
    }
    const sr1 = dir === 'across' ? r - 1 : r;
    const sc1 = dir === 'across' ? c : c - 1;
    const sr2 = dir === 'across' ? r + 1 : r;
    const sc2 = dir === 'across' ? c : c + 1;
    
    if(this.inBound(sr1, sc1) && this.matrix[sr1][sc1] !== null) return false;
    if(this.inBound(sr2, sc2) && this.matrix[sr2][sc2] !== null) return false;
    
    return true;
  }

  inBound(r, c) {
    return r >= 0 && r < this.size && c >= 0 && c < this.size;
  }

  insertWord(word, r, c, dir) {
    word.syllables.forEach((syl, i) => {
      const cr = dir === 'down' ? r + i : r;
      const cc = dir === 'across' ? c + i : c;
      this.matrix[cr][cc] = { syll: syl, id: word.id, dir };
    });
    this.items.push({ ...word, r, c, dir });
  }
}

// GUI Renderer
let currentFocus = null;

async function bootstrapApp() {
  try {
    const res = await fetch('./tts.json');
    const data = await res.json();
    
    const engine = new EngineTTS(data.gridSize || 10);
    const layout = engine.build(data.wordBank);
    
    drawGrid(layout);
    drawKeyboard(layout);
  } catch(err) {
    console.error("Gagal memuat tts.json:", err);
    document.getElementById('crossword-grid').innerHTML = "<p style='color:white;padding:10px;'>Gagal memuat data. Pastikan jalan di server (GitHub Pages).</p>";
  }
}

function drawGrid(layout) {
  const container = document.getElementById('crossword-grid');
  const uiAcross = document.getElementById('clue-list-across');
  const uiDown = document.getElementById('clue-list-down');
  
  const size = layout.matrix.length;
  container.style.gridTemplateColumns = `repeat(${size}, 45px)`;
  
  const sorted = [...layout.items].sort((a,b) => a.r === b.r ? a.c - b.c : a.r - b.r);
  const numDict = {};
  let counter = 1;
  
  sorted.forEach(w => {
    const k = `${w.r}-${w.c}`;
    if(!numDict[k]) numDict[k] = counter++;
    w.num = numDict[k];
  });

  for(let r = 0; r < size; r++) {
    for(let c = 0; c < size; c++) {
      const cellData = layout.matrix[r][c];
      const div = document.createElement('div');
      div.className = 'cell-wrapper';
      
      if(cellData) {
        div.classList.add('active');
        const k = `${r}-${c}`;
        if(numDict[k]) {
          const sp = document.createElement('span');
          sp.className = 'cell-number';
          sp.textContent = numDict[k];
          div.appendChild(sp);
        }
        
        const inp = document.createElement('input');
        inp.className = 'cell-input';
        inp.dataset.ans = cellData.syll;
        inp.readOnly = true; // Supaya pengguna wajib pakai virtual keyboard
        
        inp.addEventListener('focus', () => currentFocus = inp);
        
        div.appendChild(inp);
      }
      container.appendChild(div);
    }
  }

  sorted.forEach(w => {
    const li = document.createElement('li');
    li.value = w.num;
    li.textContent = w.clue;
    if(w.dir === 'across') uiAcross.appendChild(li);
    else uiDown.appendChild(li);
  });
}

function drawKeyboard(layout) {
  const kb = document.getElementById('keyboard-keys');
  const btnClear = document.getElementById('btn-clear');
  
  const wandaSet = new Set();
  layout.items.forEach(w => w.syllables.forEach(s => wandaSet.add(s)));
  
  // Pengacau (Distractor) tambahan agar permainan lebih menantang
  ['ꦏ', 'ꦭ', 'ꦩ', 'ꦒ', 'ꦧ'].forEach(d => wandaSet.add(d));
  
  const arrWanda = Array.from(wandaSet).sort(() => Math.random() - 0.5);
  
  arrWanda.forEach(wanda => {
    const btn = document.createElement('button');
    btn.className = 'key-btn';
    btn.textContent = wanda;
    
    btn.onclick = () => {
      if(currentFocus) {
        currentFocus.value = wanda;
        checkAnswer(currentFocus);
      }
    };
    kb.appendChild(btn);
  });
  
  btnClear.onclick = () => {
    if(currentFocus) {
      currentFocus.value = '';
      currentFocus.classList.remove('correct');
    }
  };
}

function checkAnswer(input) {
  if(input.value === input.dataset.ans) {
    input.classList.add('correct');
  } else {
    input.classList.remove('correct');
  }
}

document.addEventListener('DOMContentLoaded', bootstrapApp);
