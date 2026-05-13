/* =========================================================
   Solari board — split-flap simulator.
   Each cell has two static halves (top/bottom of the current
   character) and two animated flaps, hinged at the middle:

      ┌─────────┐
      │  flap-  │   ← rotates DOWN on bottom hinge (the falling card)
      │   top   │
      ├─────────┤   ← hinge line
      │  flap-  │   ← rotates DOWN from above on top hinge (the arriving card)
      │ bottom  │
      └─────────┘

   To change "A" → "B":
      flap-top shows "A" (falls forward, rotateX 0 → -90)
      flap-bottom shows "B" (drops in from above, rotateX 90 → 0)

   Each cell walks one character at a time through the charset,
   so going A → Z really takes 25 flips. That's how real flap
   boards behave, and it's what gives the cluster its texture.
   ========================================================= */

const CHARSET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·.&-→";

class SolariCell {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'flap-cell';
    this.el.innerHTML =
      '<div class="card top"><div class="glyph"> </div></div>' +
      '<div class="card bottom"><div class="glyph"> </div></div>' +
      '<div class="flap flap-top"><div class="glyph"> </div></div>' +
      '<div class="flap flap-bottom"><div class="glyph"> </div></div>';

    this.cardTop = this.el.querySelector('.card.top .glyph');
    this.cardBot = this.el.querySelector('.card.bottom .glyph');
    this.flapTop = this.el.querySelector('.flap.flap-top .glyph');
    this.flapBot = this.el.querySelector('.flap.flap-bottom .glyph');
    this.currentIdx = 0;
    this._busy = null;
  }

  setImmediate(char) {
    const t = (char || ' ').toUpperCase();
    const idx = CHARSET.indexOf(t);
    this.currentIdx = idx < 0 ? 0 : idx;
    const display = this.currentIdx === 0 ? ' ' : CHARSET[this.currentIdx];
    this.cardTop.textContent = display;
    this.cardBot.textContent = display;
    this.flapTop.textContent = display;
    this.flapBot.textContent = display;
  }

  async flipTo(targetChar) {
    if (this._busy) await this._busy;
    const t = (targetChar || ' ').toUpperCase();
    let targetIdx = CHARSET.indexOf(t);
    if (targetIdx < 0) targetIdx = 0;

    this._busy = (async () => {
      while (this.currentIdx !== targetIdx) {
        const nextIdx = (this.currentIdx + 1) % CHARSET.length;
        await this._oneFlip(CHARSET[this.currentIdx], CHARSET[nextIdx]);
        this.currentIdx = nextIdx;
      }
    })();
    return this._busy;
  }

  _oneFlip(from, to) {
    return new Promise(resolve => {
      const fromC = from === ' ' ? ' ' : from;
      const toC = to === ' ' ? ' ' : to;

      // The flap-top shows the *outgoing* char on its front,
      // the flap-bottom shows the *incoming* char on its front.
      this.flapTop.textContent = fromC;
      this.flapBot.textContent = toC;

      // Wait a frame so the text lands before transition starts.
      requestAnimationFrame(() => {
        this.el.classList.add('flipping');
        setTimeout(() => {
          // Animation finished: commit new char to static halves.
          this.cardTop.textContent = toC;
          this.cardBot.textContent = toC;
          this.flapTop.textContent = toC;
          this.el.classList.remove('flipping');
          // Tiny buffer so consecutive flips don't blur into one another.
          setTimeout(resolve, 6);
        }, 110);
      });
    });
  }
}

class SolariBoard {
  constructor(el, options = {}) {
    this.el = el;
    this.el.classList.add('board');
    if (options.size === 'large') this.el.classList.add('is-large');
    if (options.size === 'small') this.el.classList.add('is-small');
    this.rows = options.rows || 1;
    this.cols = options.cols || 14;
    this.cells = [];
    this._build();
  }

  _build() {
    for (let r = 0; r < this.rows; r++) {
      const row = document.createElement('div');
      row.className = 'board-row';
      const cellsInRow = [];
      for (let c = 0; c < this.cols; c++) {
        const cell = new SolariCell();
        row.appendChild(cell.el);
        cellsInRow.push(cell);
      }
      this.el.appendChild(row);
      this.cells.push(cellsInRow);
    }
  }

  _center(line, width) {
    const s = (line || '').slice(0, width);
    if (s.length >= width) return s;
    const pad = width - s.length;
    const left = Math.floor(pad / 2);
    return ' '.repeat(left) + s + ' '.repeat(pad - left);
  }

  _left(line, width) {
    const s = (line || '').slice(0, width);
    return s + ' '.repeat(Math.max(0, width - s.length));
  }

  setText(lines, options = {}) {
    const arr = Array.isArray(lines) ? lines : [lines];
    const stagger = options.stagger ?? 14;
    const startVariance = options.startVariance ?? 180;
    const align = options.align ?? 'center';
    const promises = [];
    for (let r = 0; r < this.rows; r++) {
      const raw = (arr[r] || '').toUpperCase();
      const padded = align === 'left' ? this._left(raw, this.cols) : this._center(raw, this.cols);
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r][c];
        const target = padded[c] || ' ';
        const delay = c * stagger + r * 90 + Math.random() * startVariance;
        promises.push(new Promise(resolve => {
          setTimeout(() => { cell.flipTo(target).then(resolve); }, delay);
        }));
      }
    }
    return Promise.all(promises);
  }

  setLinesLeft(lines, options = {}) {
    return this.setText(lines, Object.assign({ align: 'left' }, options));
  }

  blank() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.cells[r][c].setImmediate(' ');
      }
    }
  }
}

window.SolariBoard = SolariBoard;
window.SolariCell = SolariCell;
