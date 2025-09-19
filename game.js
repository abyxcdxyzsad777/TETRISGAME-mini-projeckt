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
    
    init() {
        this.initBoard();
        this.setupEventListeners();
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
        this.spawnPiece();
        this.updateDisplay();
        this.drawHoldPiece();
        
        document.getElementById('gameOverModal').classList.remove('show');
        this.gameLoop();
    }
    
    togglePause() {
        if (!this.gameRunning) return;
        
        this.gamePaused = !this.gamePaused;
        if (!this.gamePaused) {
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
    }
    
    restartGame() {
        this.resetGame();
        this.startGame();
    }
    
    spawnPiece() {
        const pieceTypes = Object.keys(this.pieces);
        const randomType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
        
        if (!this.nextPiece) {
            this.nextPiece = {
                type: randomType,
                rotation: 0,
                x: 0,
                y: 0
            };
        }
        
        this.currentPiece = {
            type: this.nextPiece.type,
            rotation: 0,
            x: Math.floor(this.BOARD_WIDTH / 2) - 1,
            y: 0
        };
        
        const nextRandomType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
        this.nextPiece = {
            type: nextRandomType,
            rotation: 0,
            x: 0,
            y: 0
        };
        
        if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.rotation)) {
            this.gameOver();
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
        
        // Sau khi đặt khối, dọn dòng và sinh khối mới
        this.clearLines();
        this.spawnPiece();
        
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
            const pieceTypes = Object.keys(this.pieces);
            const nextRandomType = pieceTypes[Math.floor(Math.random() * pieceTypes.length)];
            this.nextPiece = { type: nextRandomType, rotation: 0, x: 0, y: 0 };
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
    
    clearLines() {
        let linesCleared = 0;
        
        for (let y = this.BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                this.board.splice(y, 1);
                this.board.unshift(new Array(this.BOARD_WIDTH).fill(0));
                linesCleared++;
                y++;
            }
        }
        
        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.score += linesCleared * 100 * this.level;
            
            if (linesCleared === 4) {
                this.score += 400 * this.level;
            }
            
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 100);
            
            this.updateDisplay();
        }
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid();
        this.drawBoard();
        this.drawCurrentPiece();
    }
    
    drawBoard() {
        for (let y = 0; y < this.BOARD_HEIGHT; y++) {
            for (let x = 0; x < this.BOARD_WIDTH; x++) {
                if (this.board[y][x]) {
                    this.drawBlock(x, y, this.colors[this.board[y][x]]);
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
        
        const now = Date.now();
        if (now - this.dropTime > this.dropInterval) {
            this.movePiece(0, 1);
            this.dropTime = now;
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    gameOver() {
        this.gameRunning = false;
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOverModal').classList.add('show');
    }
}

window.addEventListener('load', () => {
    const game = new TetrisGame();
});