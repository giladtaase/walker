/**
 * Main game controller — ties maze, robot, and voice together.
 * 5-player relay mode: each kid navigates ~20% of the solution path.
 */
(function () {
    const canvas = document.getElementById('maze-canvas');
    const ctx = canvas.getContext('2d');
    const micBtn = document.getElementById('mic-btn');
    const micStatus = document.getElementById('mic-status');
    const newMazeBtn = document.getElementById('new-maze-btn');
    const lastCommandEl = document.getElementById('last-command');
    const levelDisplay = document.getElementById('level-display');
    const movesDisplay = document.getElementById('moves-display');
    const playerDisplay = document.getElementById('player-display');
    const playerDotsEl = document.getElementById('player-dots');
    const winOverlay = document.getElementById('win-overlay');
    const winStats = document.getElementById('win-stats');
    const nextLevelBtn = document.getElementById('next-level-btn');
    const switchOverlay = document.getElementById('switch-overlay');
    const switchNext = document.getElementById('switch-next');

    const TOTAL_PLAYERS = 5;
    const MOVE_STEP_MS = 300;
    // Target solution length range for 8x8 maze (consistent difficulty)
    const MIN_SOLUTION = 20;
    const MAX_SOLUTION = 35;

    let level = 1;
    let maze, robot, voice;
    let cellSize = 50;
    let exitX, exitY;
    let gameWon = false;
    let movingDirection = null;
    let moveInterval = null;
    let startTime = null;
    let timerInterval = null;
    let elapsedSeconds = 0;

    // Relay state
    let currentPlayer = 0;       // 0-indexed
    let solutionPath = [];       // Optimal path from BFS
    let switchCheckpoints = [];  // Solution path indices where player switches happen
    let furthestOnPath = 0;      // Furthest solution index the robot has reached
    let switchPending = false;   // Waiting for switch overlay to dismiss

    // Ding sound using Web Audio API
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playDing() {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
    }

    function getMazeSize() {
        return { cols: 8, rows: 8 };
    }

    function buildPlayerDots() {
        playerDotsEl.innerHTML = '';
        for (let i = 0; i < TOTAL_PLAYERS; i++) {
            const dot = document.createElement('div');
            dot.className = 'player-dot' + (i === 0 ? ' active' : '');
            dot.textContent = i + 1;
            dot.id = `dot-${i}`;
            playerDotsEl.appendChild(dot);
        }
    }

    function updatePlayerUI() {
        playerDisplay.textContent = `🧑 שחקן ${currentPlayer + 1}/${TOTAL_PLAYERS}`;
        for (let i = 0; i < TOTAL_PLAYERS; i++) {
            const dot = document.getElementById(`dot-${i}`);
            dot.className = 'player-dot';
            if (i < currentPlayer) dot.classList.add('done');
            if (i === currentPlayer) dot.classList.add('active');
        }
    }

    function initLevel() {
        gameWon = false;
        switchPending = false;
        stopMoving();
        winOverlay.classList.add('hidden');
        switchOverlay.classList.add('hidden');

        // Stop listening and timer
        if (voice && voice.isListening) {
            voice.stop();
        }
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        micBtn.textContent = '🎤 התחל';
        micStatus.textContent = '🎤 מיקרופון כבוי';
        micStatus.className = 'mic-off';

        const { cols, rows } = getMazeSize();

        const maxWidth = Math.min(window.innerWidth - 40, 600);
        const maxHeight = Math.min(window.innerHeight - 300, 600);
        cellSize = Math.floor(Math.min(maxWidth / cols, maxHeight / rows));

        canvas.width = cols * cellSize;
        canvas.height = rows * cellSize;

        maze = new Maze(cols, rows);
        exitX = cols - 1;
        exitY = rows - 1;

        // Generate maze with consistent solution length
        solutionPath = maze.generateWithTargetLength(MIN_SOLUTION, MAX_SOLUTION);
        stepsPerPlayer = Math.ceil(solutionPath.length / TOTAL_PLAYERS);

        robot = new Robot(0, 0, cellSize);
        currentPlayer = 0;
        furthestOnPath = 0;
        startTime = null;
        elapsedSeconds = 0;

        // Calculate switch checkpoints at 20%, 40%, 60%, 80% of solution
        switchCheckpoints = [];
        for (let i = 1; i < TOTAL_PLAYERS; i++) {
            switchCheckpoints.push(Math.floor(solutionPath.length * i / TOTAL_PLAYERS));
        }

        levelDisplay.textContent = `שלב: ${level}`;
        buildPlayerDots();
        updatePlayerUI();
        updateTimerDisplay();
        render();
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        startTime = Date.now();
        elapsedSeconds = 0;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            updateTimerDisplay();
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    }

    function updateTimerDisplay() {
        const mins = Math.floor(elapsedSeconds / 60);
        const secs = elapsedSeconds % 60;
        movesDisplay.textContent = `⏱️ ${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function stopMoving() {
        movingDirection = null;
        if (moveInterval) {
            clearInterval(moveInterval);
            moveInterval = null;
        }
    }

    function startMoving(direction) {
        stopMoving();
        movingDirection = direction;
        stepRobot(direction);
        moveInterval = setInterval(() => {
            if (!stepRobot(direction)) {
                stopMoving();
            }
        }, MOVE_STEP_MS);
    }

    function switchToNextPlayer() {
        stopMoving();
        playDing();

        if (currentPlayer < TOTAL_PLAYERS - 1) {
            currentPlayer++;
            updatePlayerUI();
            switchNext.textContent = `שחקן ${currentPlayer + 1} — תורך!`;
            switchOverlay.classList.remove('hidden');

            // Auto-dismiss after 2 seconds
            setTimeout(() => {
                switchOverlay.classList.add('hidden');
            }, 2000);
        }
    }

    function stepRobot(direction) {
        if (gameWon) { stopMoving(); return false; }

        let newX = robot.x;
        let newY = robot.y;

        if (direction === 'right' && maze.canMove(robot.x, robot.y, 'right')) newX++;
        else if (direction === 'left' && maze.canMove(robot.x, robot.y, 'left')) newX--;
        else if (direction === 'up' && maze.canMove(robot.x, robot.y, 'top')) newY--;
        else if (direction === 'down' && maze.canMove(robot.x, robot.y, 'bottom')) newY++;
        else return false;

        robot.moveTo(newX, newY);

        // Track progress: only advance if robot reached the next cell on the solution path
        const nextOnPath = furthestOnPath + 1;
        if (nextOnPath < solutionPath.length &&
            solutionPath[nextOnPath].x === newX &&
            solutionPath[nextOnPath].y === newY) {
            furthestOnPath = nextOnPath;
        }

        // Check win
        if (newX === exitX && newY === exitY) {
            gameWon = true;
            stopMoving();
            setTimeout(() => showWin(), 400);
            return true;
        }

        // Check if current player reached their checkpoint on the solution path
        if (currentPlayer < TOTAL_PLAYERS - 1 &&
            furthestOnPath >= switchCheckpoints[currentPlayer]) {
            switchToNextPlayer();
            return false;
        }

        return true;
    }

    function showWin() {
        stopTimer();
        // Mark all remaining dots as done
        for (let i = 0; i < TOTAL_PLAYERS; i++) {
            const dot = document.getElementById(`dot-${i}`);
            dot.className = 'player-dot done';
        }
        const mins = Math.floor(elapsedSeconds / 60);
        const secs = elapsedSeconds % 60;
        const timeStr = mins > 0 ? `${mins} דקות ו-${secs} שניות` : `${secs} שניות`;
        winStats.textContent = `כל הקבוצה סיימה את שלב ${level} ב-${timeStr}!`;
        winOverlay.classList.remove('hidden');
    }

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw start cell
        ctx.fillStyle = 'rgba(76, 201, 240, 0.1)';
        ctx.fillRect(2, 2, cellSize - 4, cellSize - 4);

        maze.draw(ctx, cellSize, exitX, exitY);
        robot.drawTrail(ctx);
        robot.update();
        robot.draw(ctx);

        requestAnimationFrame(render);
    }

    // Voice commands
    function handleVoiceCommand(direction, transcript) {
        if (direction) {
            const dirNames = {
                right: 'ימינה ➡️',
                left: '⬅️ שמאלה',
                up: '⬆️ למעלה',
                down: '⬇️ למטה',
                stop: '⏹️ עצור!'
            };
            lastCommandEl.textContent = dirNames[direction];
            lastCommandEl.classList.add('heard');
            setTimeout(() => lastCommandEl.classList.remove('heard'), 500);

            if (direction === 'stop') {
                stopMoving();
            } else {
                startMoving(direction);
            }
        } else {
            lastCommandEl.textContent = `🤔 "${transcript}" - לא הבנתי`;
        }
    }

    voice = new VoiceController(handleVoiceCommand);

    // Mic button
    micBtn.addEventListener('click', () => {
        if (voice.isListening) {
            voice.stop();
            micBtn.textContent = '🎤 התחל';
            micStatus.textContent = '🎤 מיקרופון כבוי';
            micStatus.className = 'mic-off';
            // Pause timer (don't reset)
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        } else {
            if (voice.start()) {
                micBtn.textContent = '⏹️ עצור';
                micStatus.textContent = '🎤 מאזין...';
                micStatus.className = 'mic-on';
                // Start or resume timer
                if (!startTime) {
                    startTimer();
                } else {
                    // Resume: adjust startTime to account for paused duration
                    startTime = Date.now() - elapsedSeconds * 1000;
                    timerInterval = setInterval(() => {
                        elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                        updateTimerDisplay();
                    }, 1000);
                }
            }
        }
    });

    // Keyboard controls — hold key to move, release to stop
    document.addEventListener('keydown', (e) => {
        const keyMap = {
            ArrowRight: 'right',
            ArrowLeft: 'left',
            ArrowUp: 'up',
            ArrowDown: 'down',
        };
        const direction = keyMap[e.key];
        if (direction) {
            e.preventDefault();
            if (movingDirection !== direction) {
                startMoving(direction);
            }
        }
        if (e.key === ' ' || e.key === 'Escape') {
            e.preventDefault();
            stopMoving();
        }
    });

    document.addEventListener('keyup', (e) => {
        const keyMap = {
            ArrowRight: 'right',
            ArrowLeft: 'left',
            ArrowUp: 'up',
            ArrowDown: 'down',
        };
        const direction = keyMap[e.key];
        if (direction && movingDirection === direction) {
            stopMoving();
        }
    });

    // New maze button
    newMazeBtn.addEventListener('click', () => {
        initLevel();
    });

    // Next level button
    nextLevelBtn.addEventListener('click', () => {
        level++;
        initLevel();
    });

    // Start
    initLevel();
})();
