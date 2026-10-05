class EngineTTS {
  constructor(size) {
    this.size = size;
    this.matrix = Array.from({ length: size }, () => Array(size).fill(null));
    this.items = [];
  }

  build(words) {
    let bestResult = { matrix: [], items: [] };
    
    // Coba susun acak hingga 40 kali untuk mendapatkan kepadatan kata terbaik
    for(let tryCount = 0; tryCount < 40; tryCount++) {
      this.matrix = Array.from({ length: this.size }, () => Array(this.size).fill(null));
      this.items = [];
      
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      shuffled.sort((a, b) => b.syllables.length - a.syllables.length);
      
      if(shuffled.length === 0) break;

      // Kata pertama ditempatkan secara acak di area tengah
      const first = shuffled[0];
      const sRow = Math.floor(this.size / 2) + Math.floor(Math.random() * 2 - 1);
      const sCol = Math.max(0, Math.floor((this.size - first.syllables.length) / 2));
      this.insertWord(first, sRow, sCol, Math.random() > 0.5 ? 'across' : 'down');
      
      // Susun sisa kata
      for(let i = 1; i < shuffled.length; i++) {
        this.attemptIntersect(shuffled[i]);
      }
      
      if(this.items.length > bestResult.items.length) {
        bestResult = { 
          matrix: JSON.parse(JSON.stringify(this.matrix)), 
          items: [...this.items] 
        };
      }
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

// Global Application Controller
let currentFocus = null;
let globalWordBank = [];

async function initApp() {
  try {
    const res = await fetch('./tts.json');
    const data = await res.json();
    globalWordBank = data.wordBank || [];
    
    startNewGame();
    setupEventListeners();
  } catch(err) {
    console.error("Gagal memuat tts.json:", err);
    document.getElementById('crossword-grid').innerHTML = "<p style='color:white;padding:10px;'>Gagal memuat data tts.json.</p>";
  }
}

function startNewGame() {
  // Sembunyikan modal kemenangan jika sedang tampil
  document.getElementById('victory-modal').classList.add('hidden');
  
  // Acak & ambil sampel kata (15-20 kata) dari total 50 kata agar susunan sel selalu baru
  const randomSample = [...globalWordBank].sort(() => Math.random() - 0.5).slice(0, 18);
  
  const engine = new EngineTTS(10);
  const layout = engine.build(randomSample);
  
  drawGrid(layout);
  drawKeyboard(layout);
  currentFocus = null;
}

function drawGrid(layout) {
  const container = document.getElementById('crossword-grid');
  const uiAcross = document.getElementById('clue-list-across');
  const uiDown = document.getElementById('clue-list-down');
  
  container.innerHTML = '';
  uiAcross.innerHTML = '';
  uiDown.innerHTML = '';
  
  const size = layout.matrix.length;
  container.style.gridTemplateColumns = `repeat(${size}, 52px)`;
  
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
        inp.readOnly = true;
        
        inp.addEventListener('focus', () => currentFocus = inp);
        div.appendChild(inp);
      }
      container.appendChild(div);
    }
  }

  sorted.forEach(w => {
    const li = document.createElement('li');
    li.value = w.num;
    li.textContent = `${w.clue} (${w.syllables.length} wanda)`;
    if(w.dir === 'across') uiAcross.appendChild(li);
    else uiDown.appendChild(li);
  });
}

function drawKeyboard(layout) {
  const kb = document.getElementById('keyboard-keys');
  kb.innerHTML = '';
  
  const wandaSet = new Set();
  layout.items.forEach(w => w.syllables.forEach(s => wandaSet.add(s)));
  
  // Tambahan opsi pengacau umum
  ['ꦏ', 'ꦭ', 'ꦩ', 'ꦒ', 'ꦧ', 'ꦠ', 'ꦱ', 'ꦤ'].forEach(d => wandaSet.add(d));
  
  const arrWanda = Array.from(wandaSet).sort(() => Math.random() - 0.5);
  
  arrWanda.forEach(wanda => {
    const btn = document.createElement('button');
    btn.className = 'key-btn';
    btn.textContent = wanda;
    
    btn.onclick = () => {
      if(currentFocus) {
        currentFocus.value = wanda;
        checkCellAnswer(currentFocus);
        autoAdvanceFocus();
        checkGameCompletion();
      }
    };
    kb.appendChild(btn);
  });
}

function checkCellAnswer(input) {
  if(input.value === input.dataset.ans) {
    input.classList.add('correct');
  } else {
    input.classList.remove('correct');
  }
}

function autoAdvanceFocus() {
  const inputs = Array.from(document.querySelectorAll('.cell-input'));
  const idx = inputs.indexOf(currentFocus);
  if(idx !== -1 && idx + 1 < inputs.length) {
    inputs[idx + 1].focus();
  }
}

// Pengecekan Apakah Semua Sel Sudah Terisi Benar
function checkGameCompletion() {
  const inputs = document.querySelectorAll('.cell-input');
  if(inputs.length === 0) return;
  
  let allCorrect = true;
  inputs.forEach(inp => {
    if(inp.value !== inp.dataset.ans) {
      allCorrect = false;
    }
  });

  if(allCorrect) {
    setTimeout(() => {
      document.getElementById('victory-modal').classList.remove('hidden');
    }, 300);
  }
}

function setupEventListeners() {
  document.getElementById('btn-clear').onclick = () => {
    if(currentFocus) {
      currentFocus.value = '';
      currentFocus.classList.remove('correct');
    }
  };
  
  document.getElementById('btn-reload-header').onclick = startNewGame;
  document.getElementById('btn-restart-modal').onclick = startNewGame;
}

document.addEventListener('DOMContentLoaded', initApp);
