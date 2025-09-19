// Seedable RNG for 7-bag and Daily/Weekly modes
class RNG {
    constructor(seed) { this.setSeed(seed); }
    setSeed(seed) {
        let h = 0;
        if (typeof seed === 'string') {
            for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
        } else {
            h = (seed | 0) || (Date.now() | 0);
        }
        this._state = h;
    }
    next() {
        // mulberry32 variant
        let t = this._state += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

// Simple audio manager using Web Audio API for SFX and background music
class SoundManager {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.musicTimer = null;
        this.musicOn = false;
        this.muted = false;
        this.volume = 0.15; // default master volume
    }
    ensureContext() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : this.volume;
            this.master.connect(this.ctx.destination);
        }
    }
    resume() { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume(); }
    suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (!this.master) return;
        if (!this.muted) this.master.gain.value = this.volume;
    }
    setMuted(m) {
        this.muted = !!m;
        if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    }
    toggleMute() { this.setMuted(!this.muted); return this.muted; }
    getVolume() { return this.volume; }
    playTone(freq, duration = 0.12, type = 'sine', volume = 0.5) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(gain).connect(this.master);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }
    playDrop() { this.playTone(220, 0.08, 'square', 0.4); }
    playTick() { this.playTone(660, 0.03, 'triangle', 0.08); }
    playLineClear(lines = 1) {
        if (!this.ctx) return;
        const base = 440;
        for (let i = 0; i < lines; i++) {
            setTimeout(() => this.playTone(base * (1 + i * 0.15), 0.15, 'sawtooth', 0.25), i * 70);
        }
    }
    playLevelUp() {
        if (!this.ctx) return;
        const seq = [523.25, 659.25, 783.99];
        seq.forEach((f, i) => setTimeout(() => this.playTone(f, 0.12, 'square', 0.35), i * 90));
    }
    startMusic() {
        if (!this.ctx || this.musicTimer) return;
        this.musicOn = true;
        let i = 0;
        const notes = [196.0, 246.94, 293.66, 246.94, 220.0, 277.18, 329.63, 277.18];
        this.musicTimer = setInterval(() => {
            if (!this.musicOn) return;
            const f = notes[i % notes.length];
            this.playTone(f, 0.18, 'sine', 0.08);
            i++;
        }, 420);
    }
    stopMusic() {
        this.musicOn = false;
        if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    }
}

class TetrisGame {
    constructor() {
        this.canvas = document.getElementById('gameBoard');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextPiece');
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.holdCanvas = document.getElementById('holdPiece');
        this.holdCtx = this.holdCanvas.getContext('2d');
        
        this.BOARD_WIDTH = 10;
        this.BOARD_HEIGHT = 20;
        this.BLOCK_SIZE = 30;
        
        this.board = [];
        this.currentPiece = null;
        this.nextPiece = null;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.gameRunning = false;
        this.gamePaused = false;
        this.dropTime = 0;
        this.dropInterval = 1000;
        this.holdPiece = null;
        this.holdUsed = false;
        // Line clear animation state
        this.animatingClear = false;
        this.clearingRows = [];
        this.clearAnimationStart = 0;
        this.clearAnimationDuration = 400; // ms
        // Audio
        this.sound = new SoundManager();
        // Modes, RNG and piece bag
        this.mode = 'marathon';
        this.rng = new RNG(Date.now());
        this.bag = [];
        // Timer/state for modes
        this.timerId = null;
        this.startTimeMs = 0;
        this.elapsedMsBase = 0;
        this.remainingMs = 0;
        this.lastTickMs = 0;
        this.timerRunning = false;
        // Best score
        this.bestScore = 0;
        
        this.colors = {
            I: '#00f0f0',
            O: '#f0f000', 
            T: '#a000f0',
            S: '#00f000',
            Z: '#f00000',
            J: '#0000f0',
            L: '#f0a000'
        };
        
        this.pieces = {
            I: [
                [[1,1,1,1]],
                [[1],[1],[1],[1]]
            ],
            O: [
                [[1,1],[1,1]]
            ],
            T: [
                [[0,1,0],[1,1,1]],
                [[1,0],[1,1],[1,0]],
                [[1,1,1],[0,1,0]],
                [[0,1],[1,1],[0,1]]
            ],
            S: [
                [[0,1,1],[1,1,0]],
                [[1,0],[1,1],[0,1]]
            ],
            Z: [
                [[1,1,0],[0,1,1]],
                [[0,1],[1,1],[1,0]]
            ],
            J: [
                [[1,0,0],[1,1,1]],
                [[1,1],[1,0],[1,0]],
                [[1,1,1],[0,0,1]],
                [[0,1],[0,1],[1,1]]
            ],
            L: [
                [[0,0,1],[1,1,1]],
                [[1,0],[1,0],[1,1]],
                [[1,1,1],[1,0,0]],
                [[1,1],[0,1],[0,1]]
            ]
        };
        
        this.init();
    }

    drawHoldPiece() {
        this.holdCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
        if (!this.holdPiece) return;
        const piece = this.pieces[this.holdPiece][0];
        const color = this.colors[this.holdPiece];
        const blockSize = 25;
        const offsetX = (this.holdCanvas.width - piece[0].length * blockSize) / 2;
        const offsetY = (this.holdCanvas.height - piece.length * blockSize) / 2;
        for (let py = 0; py < piece.length; py++) {
            for (let px = 0; px < piece[py].length; px++) {
                if (piece[py][px]) {
                    const pixelX = offsetX + px * blockSize;
                    const pixelY = offsetY + py * blockSize;
                    const g = this.holdCtx.createLinearGradient(pixelX, pixelY, pixelX, pixelY + blockSize);
                    g.addColorStop(0, this.shadeColor(color, 40));
                    g.addColorStop(0.5, color);
                    g.addColorStop(1, this.shadeColor(color, -35));
                    this.holdCtx.fillStyle = g;
                    this.holdCtx.fillRect(pixelX, pixelY, blockSize, blockSize);
                    this.holdCtx.strokeStyle = '#000';
                    this.holdCtx.lineWidth = 1;
                    this.holdCtx.strokeRect(pixelX, pixelY, blockSize, blockSize);
                    this.holdCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    this.holdCtx.fillRect(pixelX + 1, pixelY + 1, blockSize - 2, 2);
                    this.holdCtx.fillRect(pixelX + 1, pixelY + 1, 2, blockSize - 2);
                }
            }
        }
    }

    drawGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(46,137,255,0.35)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= this.BOARD_WIDTH; x++) {
            const px = x * this.BLOCK_SIZE + 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(px, 0);
            this.ctx.lineTo(px, this.BOARD_HEIGHT * this.BLOCK_SIZE);
            this.ctx.stroke();
        }
        for (let y = 0; y <= this.BOARD_HEIGHT; y++) {
            const py = y * this.BLOCK_SIZE + 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(0, py);
            this.ctx.lineTo(this.BOARD_WIDTH * this.BLOCK_SIZE, py);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    shadeColor(hex, percent) {
        const num = parseInt(hex.slice(1), 16);
        let r = (num >> 16) & 0xff;
        let g = (num >> 8) & 0xff;
        let b = num & 0xff;
        r = Math.min(255, Math.max(0, Math.floor(r * (100 + percent) / 100)));
        g = Math.min(255, Math.max(0, Math.floor(g * (100 + percent) / 100)));
        b = Math.min(255, Math.max(0, Math.floor(b * (100 + percent) / 100)));
        const toHex = (v) => v.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    
    // ===== Settings, UI, Modes, Storage =====
    setupOptionsUI() {
        const modeSel = document.getElementById('modeSelect');
        const muteBtn = document.getElementById('muteBtn');
        const vol = document.getElementById('volumeSlider');
        if (modeSel) {
            modeSel.addEventListener('change', () => {
                this.changeMode(modeSel.value);
            });
        }
        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                const muted = this.sound.toggleMute();
                muteBtn.textContent = muted ? 'Unmute' : 'Mute';
                this.saveSettings();
            });
        }
        if (vol) {
            vol.addEventListener('input', () => {
                const v = parseFloat(vol.value);
                this.sound.setVolume(v);
                this.saveSettings();
            });
        }
    }

    loadSettings() {
        try {
            const raw = localStorage.getItem('tetris_settings');
            if (raw) {
                const s = JSON.parse(raw);
                if (typeof s.mode === 'string') this.mode = s.mode;
                if (typeof s.volume === 'number') this.sound.setVolume(s.volume);
                if (typeof s.muted === 'boolean') this.sound.setMuted(s.muted);
                const modeSel = document.getElementById('modeSelect');
                if (modeSel) modeSel.value = this.mode;
                const vol = document.getElementById('volumeSlider');
                if (vol) vol.value = String(this.sound.getVolume());
                const muteBtn = document.getElementById('muteBtn');
                if (muteBtn) muteBtn.textContent = this.sound.muted ? 'Unmute' : 'Mute';
            }
        } catch {}
        this.bestScore = this.loadBestScore(this.mode);
        this.updateBestDisplay();
        this.updateTimerDisplay();
    }

    saveSettings() {
        try {
            localStorage.setItem('tetris_settings', JSON.stringify({
                mode: this.mode,
                volume: this.sound.getVolume(),
                muted: this.sound.muted
            }));
        } catch {}
    }

    changeMode(m) {
        this.mode = m;
        this.saveSettings();
        this.bestScore = this.loadBestScore(this.mode);
        this.updateBestDisplay();
        this.updateTimerDisplay();
        if (this.gameRunning) {
            this.resetGame();
        }
    }

    updateBestDisplay() {
        const el = document.getElementById('bestScore');
        if (el) el.textContent = String(this.bestScore || 0);
    }

    modeKey(mode = this.mode) {
        if (mode === 'daily') return 'daily-' + this.getDailySeed();
        if (mode === 'weekly') return 'weekly-' + this.getWeeklySeed();
        return mode;
    }

    loadBestScore(mode = this.mode) {
        const key = 'tetris_best_' + this.modeKey(mode);
        const v = parseInt(localStorage.getItem(key) || '0');
        return isNaN(v) ? 0 : v;
    }

    saveBestIfNeeded() {
        const key = 'tetris_best_' + this.modeKey(this.mode);
        const current = parseInt(localStorage.getItem(key) || '0');
        if (isNaN(current) || this.score > current) {
            try { localStorage.setItem(key, String(this.score)); } catch {}
            this.bestScore = this.score;
            this.updateBestDisplay();
        }
    }

    // ===== Timer for modes =====
    startTimer() {
        this.stopTimer();
        const ultra = (this.mode === 'ultra120' || this.mode === 'ultra180');
        if (ultra) {
            this.remainingMs = this.mode === 'ultra120' ? 120000 : 180000;
            this.lastTickMs = Date.now();
        } else {
            this.elapsedMsBase = 0;
            this.startTimeMs = Date.now();
        }
        this.timerRunning = true;
        this.timerId = setInterval(() => this.updateTimerTick(), 100);
        this.updateTimerDisplay();
    }

    stopTimer() {
        if (this.timerId) clearInterval(this.timerId);
        this.timerId = null;
        this.timerRunning = false;
    }

    updateTimerTick() {
        if (!this.gameRunning || this.gamePaused) return;
        if (this.mode === 'ultra120' || this.mode === 'ultra180') {
            const now = Date.now();
            const dt = now - this.lastTickMs;
            this.lastTickMs = now;
            this.remainingMs = Math.max(0, this.remainingMs - dt);
            this.updateTimerDisplay();
            if (this.remainingMs <= 0) {
                this.gameOver();
            }
        } else {
            this.updateTimerDisplay();
        }
    }

    updateTimerDisplay() {
        const el = document.getElementById('timer');
        if (!el) return;
        let ms = 0;
        if (this.mode === 'ultra120' || this.mode === 'ultra180') {
            ms = Math.max(0, this.remainingMs);
        } else {
            ms = this.elapsedMsBase + (this.timerRunning ? (Date.now() - this.startTimeMs) : 0);
        }
        el.textContent = this.formatTime(ms);
    }

    formatTime(ms) {
        ms = Math.max(0, Math.floor(ms));
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    }

    // ===== Randomizer 7-bag & Seeds =====
    seedRngForMode() {
        if (this.mode === 'daily') {
            this.rng.setSeed('daily-' + this.getDailySeed());
        } else if (this.mode === 'weekly') {
            this.rng.setSeed('weekly-' + this.getWeeklySeed());
        } else {
            this.rng.setSeed(Date.now());
        }
        this.bag = [];
    }

    getDailySeed() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,'0');
        const day = String(d.getDate()).padStart(2,'0');
        return `${y}${m}${day}`;
    }

    getWeeklySeed() {
        const d = new Date();
        const onejan = new Date(d.getFullYear(),0,1);
        const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay()+1)/7);
        return `${d.getFullYear()}W${week}`;
    }

    refillBag() {
        const types = Object.keys(this.pieces);
        // Fisher–Yates shuffle using seeded rng
        for (let i = types.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng.next() * (i + 1));
            [types[i], types[j]] = [types[j], types[i]];
        }
        this.bag.push(...types);
    }

    drawFromBag() {
        if (this.bag.length === 0) this.refillBag();
        return this.bag.pop();
    }

    // ===== Ghost piece =====
    computeGhostY() {
        if (!this.currentPiece) return null;
        let x = this.currentPiece.x;
        let y = this.currentPiece.y;
        const rot = this.currentPiece.rotation;
        while (!this.checkCollision(x, y + 1, rot)) {
            y++;
        }
        return { x, y, rot };
    }

    drawGhostPiece() {
        const g = this.computeGhostY();
        if (!g) return;
        const piece = this.pieces[this.currentPiece.type][g.rot];
        this.ctx.save();
        this.ctx.globalAlpha = 0.25;
        const color = this.colors[this.currentPiece.type];
        for (let py = 0; py < piece.length; py++) {
            for (let px = 0; px < piece[py].length; px++) {
                if (piece[py][px]) {
                    const gx = g.x + px;
                    const gy = g.y + py;
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(gx * this.BLOCK_SIZE, gy * this.BLOCK_SIZE, this.BLOCK_SIZE, this.BLOCK_SIZE);
                }
            }
        }
        this.ctx.restore();
    }
    
    init() {
        this.initBoard();
        this.setupEventListeners();
        this.setupOptionsUI && this.setupOptionsUI();
        this.loadSettings && this.loadSettings();
        this.updateBestDisplay && this.updateBestDisplay();
        this.updateTimerDisplay && this.updateTimerDisplay();
        this.updateDisplay();
    }
    
    initBoard() {
        this.board = [];
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            this.board[y] = [];
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                this.board[y][x] = 0;
            }
        }
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
    }
    
    handleKeyPress(e) {
        if (!this.gameRunning || this.gamePaused) return;
        
        switch(e.code) {
            case 'ArrowLeft':
                this.movePiece(-1, 0);
                break;
            case 'ArrowRight':
                this.movePiece(1, 0);
                break;
            case 'ArrowDown':
                this.movePiece(0, 1);
                break;
            case 'ArrowUp':
                this.rotatePiece();
                break;
            case 'Space':
                this.hardDrop();
                break;
            case 'KeyP':
                this.togglePause();
                break;
            case 'ShiftLeft':
            case 'ShiftRight':
                this.holdPieceAction();
                break;
        }
        e.preventDefault();
    }
    
    startGame() {
        if (this.gameRunning) return;
        
        this.gameRunning = true;
        this.gamePaused = false;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = 1000;
        this.holdPiece = null;
        this.holdUsed = false;
        
        this.initBoard();
        this.seedRngForMode && this.seedRngForMode();
        // Prepare first next piece from 7-bag
        this.nextPiece = { type: this.drawFromBag(), rotation: 0, x: 0, y: 0 };
        this.spawnPiece();
        this.updateDisplay();
        this.drawHoldPiece();
        
        document.getElementById('gameOverModal').classList.remove('show');
        // init and start audio after user interaction
        this.sound.ensureContext();
        this.sound.resume();
        this.sound.startMusic();
        // timer per mode
        this.startTimer && this.startTimer();
        this.gameLoop();
    }
    
    togglePause() {
        if (!this.gameRunning) return;
        
        this.gamePaused = !this.gamePaused;
        if (this.gamePaused) {
            this.sound.suspend();
            // update elapsed for marathon/zen when pausing
            if (!(this.mode === 'ultra120' || this.mode === 'ultra180')) {
                if (this.timerRunning) this.elapsedMsBase += Date.now() - this.startTimeMs;
            }
        } else {
            this.sound.resume();
            // resume timer anchors
            if (this.mode === 'ultra120' || this.mode === 'ultra180') {
                this.lastTickMs = Date.now();
            } else {
                this.startTimeMs = Date.now();
            }
            this.gameLoop();
        }
    }
    
    resetGame() {
        this.gameRunning = false;
        this.gamePaused = false;
        this.score = 0;
        this.level = 1;
        this.lines = 0;
        this.dropInterval = 1000;
        
        this.initBoard();
        this.currentPiece = null;
        this.nextPiece = null;
        this.holdPiece = null;
        this.holdUsed = false;
        
        this.updateDisplay();
        this.draw();
        this.drawNextPiece();
        this.drawHoldPiece();
        
        document.getElementById('gameOverModal').classList.remove('show');
        this.sound.stopMusic();
        this.stopTimer && this.stopTimer();
        this.elapsedMsBase = 0;
        this.remainingMs = 0;
        this.updateTimerDisplay && this.updateTimerDisplay();
    }
    
    restartGame() {
        this.resetGame();
        this.startGame();
    }
    
    spawnPiece() {
        if (!this.nextPiece) {
            this.nextPiece = { type: this.drawFromBag(), rotation: 0, x: 0, y: 0 };
        }
        this.currentPiece = {
            type: this.nextPiece.type,
            rotation: 0,
            x: Math.floor(this.BOARD_WIDTH / 2) - 1,
            y: 0
        };
        // prepare next from bag
        this.nextPiece = { type: this.drawFromBag(), rotation: 0, x: 0, y: 0 };
        
        if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.rotation)) {
            if (this.mode === 'zen') {
                // không thua: làm sạch board và tiếp tục
                this.initBoard();
            } else {
                this.gameOver();
            }
        }
        this.holdUsed = false;
        this.drawNextPiece();
    }
    
    checkCollision(x, y, rotation) {
        const piece = this.pieces[this.currentPiece.type][rotation];
        
        for (let py = 0; py < piece.length; py++) {
            for (let px = 0; px < piece[py].length; px++) {
                if (piece[py][px]) {
                    const newX = x + px;
                    const newY = y + py;
                    
                    if (newX < 0 || newX >= this.BOARD_WIDTH || 
                        newY >= this.BOARD_HEIGHT || 
                        (newY >= 0 && this.board[newY][newX])) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    movePiece(dx, dy) {
        const newX = this.currentPiece.x + dx;
        const newY = this.currentPiece.y + dy;
        
        if (!this.checkCollision(newX, newY, this.currentPiece.rotation)) {
            this.currentPiece.x = newX;
            this.currentPiece.y = newY;
            this.draw();
            return true;
        }
        
        if (dy > 0) {
            this.placePiece();
        }
        return false;
    }
    
    rotatePiece() {
        const newRotation = (this.currentPiece.rotation + 1) % this.pieces[this.currentPiece.type].length;
        
        if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y, newRotation)) {
            this.currentPiece.rotation = newRotation;
            this.draw();
        }
    }
    
    hardDrop() {
        while (this.movePiece(0, 1)) {
            this.score += 2;
        }
        this.updateDisplay();
    }
    
    placePiece() {
        const piece = this.pieces[this.currentPiece.type][this.currentPiece.rotation];
        
        for (let py = 0; py < piece.length; py++) {
            for (let px = 0; px < piece[py].length; px++) {
                if (piece[py][px]) {
                    const x = this.currentPiece.x + px;
                    const y = this.currentPiece.y + py;
                    
                    if (y >= 0) {
                        this.board[y][x] = this.currentPiece.type;
                    }
                }
            }
        }
        // play drop sound
        this.sound.playDrop();
        // Check full lines and animate
        const rows = this.findFullLines();
        if (rows.length) {
            this.startLineClearAnimation(rows);
        } else {
            this.spawnPiece();
        }
        
        this.draw();
    }

    // Giữ/đổi khối (HOLD). Chỉ được dùng một lần cho mỗi lần sinh khối.
    holdPieceAction() {
        if (!this.gameRunning || this.gamePaused || !this.currentPiece) return;
        if (this.holdUsed) return;
        const spawnX = Math.floor(this.BOARD_WIDTH / 2) - 1;
        const spawnY = 0;

        if (this.holdPiece === null) {
            // Lần đầu giữ: đưa current vào hold, lấy next ra chơi
            this.holdPiece = this.currentPiece.type;
            const candidate = { type: this.nextPiece.type, rotation: 0, x: spawnX, y: spawnY };
            if (this.checkCollision(candidate.x, candidate.y, candidate.rotation)) return;
            this.currentPiece = candidate;
            this.nextPiece = { type: this.drawFromBag(), rotation: 0, x: 0, y: 0 };
        } else {
            // Đổi current với hold
            const newType = this.holdPiece;
            const candidate = { type: newType, rotation: 0, x: spawnX, y: spawnY };
            if (this.checkCollision(candidate.x, candidate.y, candidate.rotation)) return;
            this.holdPiece = this.currentPiece.type;
            this.currentPiece = candidate;
        }
        this.holdUsed = true;
        this.drawHoldPiece();
        this.drawNextPiece();
        this.draw();
    }
    
    canSwapPiece() {
        // Kiểm tra xem có thể thay đổi khối không
        return this.nextPiece && 
               !this.checkCollision(
                   Math.floor(this.BOARD_WIDTH / 2) - 1, 
                   0, 
                   this.nextPiece.rotation
               );
    }
    
    swapPiece() {
        // Thay đổi khối hiện tại với khối tiếp theo
        const temp = this.currentPiece;
        this.currentPiece = {
            type: this.nextPiece.type,
            rotation: 0,
            x: Math.floor(this.BOARD_WIDTH / 2) - 1,
            y: 0
        };
        
        const pieceTypes = Object.keys(this.pieces);
        const nextRandomType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
        this.nextPiece = {
            type: nextRandomType,
            rotation: 0,
            x: 0,
            y: 0
        };
        
        this.drawNextPiece();
    }
    
    // Find full lines without mutating board
    findFullLines() {
        const rows = [];
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            if (this.board[y].every(cell => cell !== 0)) rows.push(y);
        }
        return rows;
    }
    startLineClearAnimation(rows) {
        this.animatingClear = true;
        this.clearingRows = rows;
        this.clearAnimationStart = Date.now();
        this.draw();
        // play sfx
        this.sound.playLineClear(rows.length);
    }
    applyLineClear() {
        const rows = this.clearingRows.slice().sort((a,b)=>a-b);
        let linesCleared = rows.length;
        for (let i = 0; i < linesCleared; i++) {
            const y = rows[i] - i; // because we remove progressively
            this.board.splice(y, 1);
            this.board.unshift(new Array(this.BOARD_WIDTH).fill(0));
        }
        const prevLevel = this.level;
        this.lines += linesCleared;
        this.score += linesCleared * 100 * this.level;
        if (linesCleared === 4) this.score += 400 * this.level; // Tetris bonus
        this.level = Math.floor(this.lines / 10) + 1;
        this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
        if (this.level > prevLevel) this.sound.playLevelUp();
        this.updateDisplay();
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.drawBoard();
        this.drawGhostPiece && this.drawGhostPiece();
        this.drawCurrentPiece();
    }
    
    drawBoard() {
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                if (this.board[y][x]) {
                    this.drawBlock(x, y, this.colors[this.board[y][x]]);
                    // Highlight clearing rows
                    if (this.animatingClear && this.clearingRows.includes(y)) {
                        const progress = Math.min(1, (Date.now() - this.clearAnimationStart) / this.clearAnimationDuration);
                        const alpha = 0.8 * Math.sin(progress * Math.PI);
                        this.ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
                        this.ctx.fillRect(x * this.BLOCK_SIZE, y * this.BLOCK_SIZE, this.BLOCK_SIZE, this.BLOCK_SIZE);
                    }
                }
            }
        }
    }
    
    drawCurrentPiece() {
        if (!this.currentPiece) return;
        
        const piece = this.pieces[this.currentPiece.type][this.currentPiece.rotation];
        const color = this.colors[this.currentPiece.type];
        
        for (let py = 0; py < piece.length; py++) {
            for (let px = 0; px < piece[py].length; px++) {
                if (piece[py][px]) {
                    this.drawBlock(
                        this.currentPiece.x + px,
                        this.currentPiece.y + py,
                        color
                    );
                }
            }
        }
    }
    
    drawBlock(x, y, color) {
        const pixelX = x * this.BLOCK_SIZE;
        const pixelY = y * this.BLOCK_SIZE;
        const g = this.ctx.createLinearGradient(pixelX, pixelY, pixelX, pixelY + this.BLOCK_SIZE);
        g.addColorStop(0, this.shadeColor(color, 40));
        g.addColorStop(0.5, color);
        g.addColorStop(1, this.shadeColor(color, -35));
        this.ctx.fillStyle = g;
        this.ctx.fillRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
        this.ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(pixelX, pixelY, this.BLOCK_SIZE, this.BLOCK_SIZE);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.fillRect(pixelX + 2, pixelY + 2, this.BLOCK_SIZE - 4, 3);
        this.ctx.fillRect(pixelX + 2, pixelY + 2, 3, this.BLOCK_SIZE - 4);
    }
    
    drawNextPiece() {
        this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        if (!this.nextPiece) return;
        
        const piece = this.pieces[this.nextPiece.type][0];
        const color = this.colors[this.nextPiece.type];
        const blockSize = 25;
        
        const offsetX = (this.nextCanvas.width - piece[0].length * blockSize) / 2;
        const offsetY = (this.nextCanvas.height - piece.length * blockSize) / 2;
        
        for (let py = 0; py < piece.length; py++) {
            for (let px = 0; px < piece[py].length; px++) {
                if (piece[py][px]) {
                    const pixelX = offsetX + px * blockSize;
                    const pixelY = offsetY + py * blockSize;
                    
                    const g = this.nextCtx.createLinearGradient(pixelX, pixelY, pixelX, pixelY + blockSize);
                    g.addColorStop(0, this.shadeColor(color, 40));
                    g.addColorStop(0.5, color);
                    g.addColorStop(1, this.shadeColor(color, -35));
                    this.nextCtx.fillStyle = g;
                    this.nextCtx.fillRect(pixelX, pixelY, blockSize, blockSize);
                    
                    this.nextCtx.strokeStyle = '#000';
                    this.nextCtx.lineWidth = 1;
                    this.nextCtx.strokeRect(pixelX, pixelY, blockSize, blockSize);
                    
                    this.nextCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    this.nextCtx.fillRect(pixelX + 1, pixelY + 1, blockSize - 2, 2);
                    this.nextCtx.fillRect(pixelX + 1, pixelY + 1, 2, blockSize - 2);
                }
            }
        }
    }
    
    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        document.getElementById('lines').textContent = this.lines;
    }
    
    gameLoop() {
        if (!this.gameRunning || this.gamePaused) return;
        
        // Handle line clear animation frame
        if (this.animatingClear) {
            const nowA = Date.now();
            if (nowA - this.clearAnimationStart >= this.clearAnimationDuration) {
                this.animatingClear = false;
                this.applyLineClear();
                this.spawnPiece();
            }
            this.draw();
            requestAnimationFrame(() => this.gameLoop());
            return;
        }
        
        const now = Date.now();
        if (now - this.dropTime > this.dropInterval) {
            const moved = this.movePiece(0, 1);
            if (moved) this.sound.playTick();
            this.dropTime = now;
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    gameOver() {
        this.gameRunning = false;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverModal').classList.add('show');
        this.sound.stopMusic();
        this.stopTimer && this.stopTimer();
        this.saveBestIfNeeded && this.saveBestIfNeeded();
    }
}

window.addEventListener('load', () => {
    const game = new TetrisGame();
});