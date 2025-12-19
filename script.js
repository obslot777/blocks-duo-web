/**
 * ブロックス デュオ - Webアプリ 
 * 整理済みフルコード
 */

// =================================================================
// 1. 定数とデータ定義
// =================================================================
const BOARD_SIZE = 14;

const PLAYER = {
    P1: 1, // 青
    P2: 2  // 橙
};

// 全21種類のピース定義
const ALL_PIECES = [
    { id: "P1", shape: [[0, 0]] },
    { id: "P2", shape: [[0, 0], [1, 0]] },
    { id: "P3_I", shape: [[0, 0], [1, 0], [2, 0]] },
    { id: "P3_L", shape: [[0, 0], [1, 0], [0, 1]] },
    { id: "P4_I", shape: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    { id: "P4_L", shape: [[0, 0], [1, 0], [2, 0], [2, 1]] },
    { id: "P4_T", shape: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    { id: "P4_S", shape: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    { id: "P4_O", shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    { id: "P5_F", shape: [[1, 0], [2, 1], [1, 1], [0, 2], [1, 2]] },
    { id: "P5_I", shape: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
    { id: "P5_L", shape: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1]] },
    { id: "P5_P", shape: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]] },
    { id: "P5_N", shape: [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1]] },
    { id: "P5_T", shape: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]] },
    { id: "P5_U", shape: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
    { id: "P5_V", shape: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]] },
    { id: "P5_W", shape: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]] },
    { id: "P5_X", shape: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]] },
    { id: "P5_Y", shape: [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1]] },
    { id: "P5_Z", shape: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]] }
];

// スタート地点 (ブロックス デュオ公式準拠)
const START_POINTS = {
    [PLAYER.P1]: { x: 4, y: 9 }, 
    [PLAYER.P2]: { x: 9, y: 4 }  
};

// =================================================================
// 2. ゲーム状態
// =================================================================
let gameState = {
    board: Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(0)),
    currentPlayer: PLAYER.P1, 
    piecesAvailable: {
        [PLAYER.P1]: ALL_PIECES.map(p => p.id), 
        [PLAYER.P2]: ALL_PIECES.map(p => p.id)  
    },
    selectedPiece: null // { id, shape, playerId }
};

let currentPreviewCells = []; 
let lastValidPlacement = null; // {startX, startY}
let consecutivePasses = 0; 
let isTouchDragging = false;
let activeTouchPointerId = null;
let lastPointerCell = null; // {x,y} 最後に指したセル座標（セル単位）
const DRAG_THRESHOLD = 8; // ピクセル単位のしきい値
let dragStartPoint = null; // {clientX, clientY}

// =================================================================
// 3. ユーティリティ (操作 & 描画)
// =================================================================

const transformPiece = {
    rotate: (shape) => shape.map(([x, y]) => [-y, x]),
    flip: (shape) => shape.map(([x, y]) => [-x, y]),
    normalize: (shape) => {
        const minX = Math.min(...shape.map(p => p[0]));
        const minY = Math.min(...shape.map(p => p[1]));
        return shape.map(([x, y]) => [x - minX, y - minY]);
    },
    apply: (shape, op) => transformPiece.normalize(op(shape))
};

function createPieceDom(shape, playerId) {
    const maxX = Math.max(...shape.map(p => p[0]));
    const maxY = Math.max(...shape.map(p => p[1]));
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${maxX + 1}, 12px)`;
    grid.style.gridTemplateRows = `repeat(${maxY + 1}, 12px)`;
    grid.style.gap = '1px';

    for (let y = 0; y <= maxY; y++) {
        for (let x = 0; x <= maxX; x++) {
            const cell = document.createElement('div');
            cell.style.width = '12px';
            cell.style.height = '12px';
            if (shape.some(p => p[0] === x && p[1] === y)) {
                cell.classList.add(`player-${playerId}`);
            } else {
                cell.style.backgroundColor = 'transparent';
            }
            grid.appendChild(cell);
        }
    }
    return grid;
}

function getCellCoords(clientX, clientY) {
    const board = document.getElementById('board-container');
    const rect = board.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const x = Math.floor((clientX - rect.left) / (rect.width / BOARD_SIZE));
    const y = Math.floor((clientY - rect.top) / (rect.height / BOARD_SIZE));
    return { x, y };
}

// =================================================================
// 4. 配置ロジック
// =================================================================

function isPlacementValid(board, shape, startX, startY, playerId) {
    let hasCorner = false;
    const isFirst = gameState.piecesAvailable[playerId].length === ALL_PIECES.length;
    const start = START_POINTS[playerId];

    for (const [dx, dy] of shape) {
        const x = startX + dx;
        const y = startY + dy;

        if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE || board[y][x] !== 0) return false;

        // 辺接チェック
        const adj = [[x+1, y], [x-1, y], [x, y+1], [x, y-1]];
        if (adj.some(([ax, ay]) => ax >= 0 && ax < BOARD_SIZE && ay >= 0 && ay < BOARD_SIZE && board[ay][ax] === playerId)) return false;

        // 角接チェック
        const diag = [[x+1, y+1], [x+1, y-1], [x-1, y+1], [x-1, y-1]];
        if (diag.some(([ax, ay]) => ax >= 0 && ax < BOARD_SIZE && ay >= 0 && ay < BOARD_SIZE && board[ay][ax] === playerId)) hasCorner = true;

        if (isFirst && x === start.x && y === start.y) hasCorner = true; // 初手はスタート地点
    }
    return hasCorner;
}

// =================================================================
// 5. UI制御
// =================================================================

function drawBoard() {
    const container = document.getElementById('board-container');
    container.innerHTML = '';
    for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');

            // --- スタートマスの判定を追加 ---
            const startP1 = START_POINTS[PLAYER.P1];
            const startP2 = START_POINTS[PLAYER.P2];

            if (x === startP1.x && y === startP1.y) {
                cell.classList.add('start-p1');
            } else if (x === startP2.x && y === startP2.y) {
                cell.classList.add('start-p2');
            }
            // ----------------------------

            if (gameState.board[y][x] === PLAYER.P1) cell.classList.add('player-1');
            if (gameState.board[y][x] === PLAYER.P2) cell.classList.add('player-2');
            
            container.appendChild(cell);
        }
    }
}

function drawPiecesSelectors() {
    [PLAYER.P1, PLAYER.P2].forEach(pId => {
        const container = document.getElementById(`player${pId}-pieces`);
        container.innerHTML = '';
        ALL_PIECES.filter(p => gameState.piecesAvailable[pId].includes(p.id)).forEach(piece => {
            const div = document.createElement('div');
            div.classList.add('available-piece');
            div.dataset.pieceId = piece.id;
            div.appendChild(createPieceDom(piece.shape, pId));
            container.appendChild(div);
        });
    });
}

function updateGameUI() {
    const curr = gameState.currentPlayer;
    const isP1 = curr === PLAYER.P1;
    
    document.getElementById('p1-turn-indicator').textContent = isP1 ? 'あなたのターン' : '待機中';
    document.getElementById('p2-turn-indicator').textContent = !isP1 ? 'あなたのターン' : '待機中';
    document.getElementById('player1-ui').style.opacity = isP1 ? '1' : '0.4';
    document.getElementById('player2-ui').style.opacity = isP1 ? '0.4' : '1';

    // ボタン制御
    ['p1', 'p2'].forEach(prefix => {
        const active = (prefix === (isP1 ? 'p1' : 'p2'));
        document.getElementById(`${prefix}-rotate-btn`).disabled = !active;
        document.getElementById(`${prefix}-flip-btn`).disabled = !active;
        document.getElementById(`${prefix}-place-btn`).disabled = true;
    });

    updateScores();
}

function updateScores() {
    [PLAYER.P1, PLAYER.P2].forEach(id => {
        const rem = gameState.piecesAvailable[id].reduce((sum, pId) => sum + ALL_PIECES.find(p => p.id === pId).shape.length, 0);
        document.getElementById(`p${id}-score`).textContent = `残マス: ${rem}`;
    });
}

// =================================================================
// 6. ハンドラ
// =================================================================

function handlePieceSelection(e) {
    const el = e.target.closest('.available-piece');
    if (!el) return;
    const pId = parseInt(el.closest('.player-ui').id.match(/\d/)[0]);
    if (pId !== gameState.currentPlayer){
        sounds.error(); // 相手のターンならエラー音
        return;
    } 

    sounds.select(); // 選択音

    const piece = ALL_PIECES.find(p => p.id === el.dataset.pieceId);
    gameState.selectedPiece = { id: piece.id, shape: [...piece.shape], playerId: pId };
    
    document.querySelectorAll('.available-piece').forEach(item => item.classList.remove('selected'));
    el.classList.add('selected');
    clearPreview();
}

function handlePieceTransformation(type) {
    if (!gameState.selectedPiece) return;
    sounds.transform(); // 回転・反転音
    gameState.selectedPiece.shape = transformPiece.apply(gameState.selectedPiece.shape, transformPiece[type]);
    // 優先: 最後に触れたセルで再表示。それがなければ lastValidPlacement を使う
    if (lastPointerCell) {
        updatePiecePreview(lastPointerCell.x, lastPointerCell.y);
    } else if (lastValidPlacement) {
        updatePiecePreview(lastValidPlacement.x, lastValidPlacement.y);
    } else {
        // 選択中のピースはあるがプレビュー位置が未定ならプレビューをクリア
        clearPreview();
    }
}

function clearPreview() {
    currentPreviewCells.forEach(c => c.classList.remove('preview-valid', 'preview-invalid'));
    currentPreviewCells = [];
    lastValidPlacement = null;
    const prefix = gameState.currentPlayer === PLAYER.P1 ? 'p1' : 'p2';
    document.getElementById(`${prefix}-place-btn`).disabled = true;
}

function updatePiecePreview(x, y) {
    if (!gameState.selectedPiece) return;
    clearPreview();
    const valid = isPlacementValid(gameState.board, gameState.selectedPiece.shape, x, y, gameState.currentPlayer);
    if (valid) lastValidPlacement = { x, y };

    const cells = document.getElementById('board-container').children;
    gameState.selectedPiece.shape.forEach(([dx, dy]) => {
        const tx = x + dx, ty = y + dy;
        if (tx >= 0 && tx < BOARD_SIZE && ty >= 0 && ty < BOARD_SIZE) {
            const cell = cells[ty * BOARD_SIZE + tx];
            cell.classList.add(valid ? 'preview-valid' : 'preview-invalid');
            currentPreviewCells.push(cell);
        }
    });
    const prefix = gameState.currentPlayer === PLAYER.P1 ? 'p1' : 'p2';
    document.getElementById(`${prefix}-place-btn`).disabled = !valid;
}

function handlePlacement() {
    if (!lastValidPlacement || !gameState.selectedPiece){
        sounds.error(); // 置けない場所ならエラー音
        return;
    } 

    sounds.place(); // 配置音

    const { x, y } = lastValidPlacement;
    gameState.selectedPiece.shape.forEach(([dx, dy]) => gameState.board[y + dy][x + dx] = gameState.currentPlayer);
    gameState.piecesAvailable[gameState.currentPlayer] = gameState.piecesAvailable[gameState.currentPlayer].filter(id => id !== gameState.selectedPiece.id);
    
    gameState.selectedPiece = null;
    drawBoard();
    drawPiecesSelectors();
    switchTurn();
}

function switchTurn() {
    gameState.currentPlayer = gameState.currentPlayer === PLAYER.P1 ? PLAYER.P2 : PLAYER.P1;
    consecutivePasses = 0; // 簡易版のためパス処理は省略可
    updateGameUI();
    // 終了判定ロジックをここに追加可能
}

// =================================================================
// 7. イベント登録
// =================================================================

function setupEventListeners() {
    // 最初のクリックでAudioContextを有効化
    window.addEventListener('mousedown', () => {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }, { once: true });
    
    document.getElementById('player1-pieces').addEventListener('click', handlePieceSelection);
    document.getElementById('player2-pieces').addEventListener('click', handlePieceSelection);

    ['p1', 'p2'].forEach(p => {
        document.getElementById(`${p}-rotate-btn`).addEventListener('click', () => handlePieceTransformation('rotate'));
        document.getElementById(`${p}-flip-btn`).addEventListener('click', () => handlePieceTransformation('flip'));
        document.getElementById(`${p}-place-btn`).addEventListener('click', handlePlacement);
    });

    const board = document.getElementById('board-container');

    // Pointer events: mouse keeps immediate placement, touch uses drag-preview + confirm
    board.addEventListener('pointermove', (e) => {
        // Mouse pointer moves update preview directly
        if (e.pointerType === 'mouse') {
            const coords = getCellCoords(e.clientX, e.clientY);
            if (coords) {
                lastPointerCell = coords;
                updatePiecePreview(coords.x, coords.y);
            } else {
                lastPointerCell = null;
            }
        }
    });

    // Touch drag handlers using pointer capture so dragging keeps sending events
    function onTouchMove(e) {
        if (e.pointerId !== activeTouchPointerId) return;
        const coords = getCellCoords(e.clientX, e.clientY);
        // 移動量がしきい値を超えたらドラッグとして扱う
        if (dragStartPoint && !isTouchDragging) {
            const dx = e.clientX - dragStartPoint.clientX;
            const dy = e.clientY - dragStartPoint.clientY;
            const distSq = dx * dx + dy * dy;
            if (distSq >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
                isTouchDragging = true;
            }
        }

        if (isTouchDragging) {
            if (coords) {
                lastPointerCell = coords;
                updatePiecePreview(coords.x, coords.y);
            } else {
                lastPointerCell = null;
            }
        }
    }

    function onTouchUp(e) {
        if (e.pointerId !== activeTouchPointerId) return;
        try { board.releasePointerCapture(e.pointerId); } catch (err) {}
        // タップ（短い移動）で離した場合は、その位置でプレビューを1回表示
        if (!isTouchDragging) {
            const coords = getCellCoords(e.clientX, e.clientY);
            if (coords) {
                lastPointerCell = coords;
                updatePiecePreview(coords.x, coords.y);
            }
        }
        isTouchDragging = false;
        activeTouchPointerId = null;
        dragStartPoint = null;
        board.removeEventListener('pointermove', onTouchMove);
        board.removeEventListener('pointerup', onTouchUp);
    }

    board.addEventListener('pointercancel', (e) => {
        if (e.pointerId === activeTouchPointerId) onTouchUp(e);
    });

    // Use non-passive listener so we can call preventDefault() on touchstart
    board.addEventListener('pointerdown', (e) => {
        const coords = getCellCoords(e.clientX, e.clientY);
            if (e.pointerType === 'mouse') {
            // Mouse: click to place immediately if a valid preview exists
            if (coords) {
                lastPointerCell = coords;
            }
            if (coords && lastValidPlacement) handlePlacement();
        } else if (e.pointerType === 'touch') {
            // Touch: record start point and wait until movement exceeds threshold to treat as drag
            e.preventDefault();
            isTouchDragging = false; // まだドラッグ開始していない
            activeTouchPointerId = e.pointerId;
            dragStartPoint = { clientX: e.clientX, clientY: e.clientY };
            try { board.setPointerCapture(e.pointerId); } catch (err) {}
            board.addEventListener('pointermove', onTouchMove);
            board.addEventListener('pointerup', onTouchUp);
            // タップ時にすぐプレビュー表示したければここで一度表示（しない選択も可）
            // ここではタップでも離すまで確定しないので開始位置のプレビューは行わない
        }
    }, { passive: false });

    // キーボード
    window.addEventListener('keydown', (e) => {
        if (!gameState.selectedPiece) return;
        const k = e.key.toLowerCase();
        if (k === 'r') handlePieceTransformation('rotate');
        if (k === 'f') handlePieceTransformation('flip');
        if (k === 'enter' || k === ' ') handlePlacement();
    });
}

// --- 音声生成ユーティリティ ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

/**
 * 指定した周波数と時間で音を鳴らす
 * @param {number} freq 周波数 (Hz)
 * @param {string} type 波形 ('sine', 'square', 'triangle', 'sawtooth')
 * @param {number} duration 時間 (秒)
 * @param {number} volume 音量 (0.0～1.0)
 */
function playTone(freq, type, duration, volume = 0.1) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    // 音の終わりの方にフェードアウトをかけて「プツッ」というノイズを防ぐ
    gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
}

// ゲーム用プリセット音
const sounds = {
    select: () => playTone(600, 'sine', 0.1, 0.1),    // ピース選択（高めのピピッ）
    transform: () => playTone(800, 'sine', 0.05, 0.05), // 回転・反転（軽い音）
    place: () => playTone(400, 'triangle', 0.15, 0.2), // 配置確定（カチッという低めの音）
    error: () => playTone(150, 'sawtooth', 0.2, 0.1)   // 無効な操作（ブッという低い音）
};

function init() {
    drawBoard();
    drawPiecesSelectors();
    setupEventListeners();
    updateGameUI();
}

document.addEventListener('DOMContentLoaded', init);