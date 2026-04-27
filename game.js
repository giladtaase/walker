/**
 * Main game controller — ties maze, robot, and voice together.
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
    const winOverlay = document.getElementById('win-overlay');
    const winStats = document.getElementById('win-stats');
    const nextLevelBtn = document.getElementById('next-level-btn');

    let level = 1;
    let maze, robot, voice;
    let cellSize = 50;
    let exitX, exitY;
    let gameWon = false;
    let movingDirection = null;  // Current continuous movement direction
    let moveInterval = null;     // Interval ID for continuous movement
    const MOVE_STEP_MS = 300;    // Time between steps while moving
    let startTime = null;        // Level start time
    let timerInterval = null;    // Timer update interval
    let elapsedSeconds = 0;

    function getMazeSize(level) {
        return { cols: 8, rows: 8 };
    }

    function initLevel() {
        gameWon = false;
        stopMoving();
        winOverlay.classList.add('hidden');

        const { cols, rows } = getMazeSize(level);

        // Calculate cell size to fit screen
        const maxWidth = Math.min(window.innerWidth - 40, 600);
        const maxHeight = Math.min(window.innerHeight - 300, 600);
        cellSize = Math.floor(Math.min(maxWidth / cols, maxHeight / rows));

        canvas.width = cols * cellSize;
        canvas.height = rows * cellSize;

        maze = new Maze(cols, rows);
        exitX = cols - 1;
        exitY = rows - 1;
        robot = new Robot(0, 0, cellSize);

        levelDisplay.textContent = `שלב: ${level}`;
        startTimer();

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
        // Take first step immediately
        stepRobot(direction);
        // Continue stepping
        moveInterval = setInterval(() => {
            if (!stepRobot(direction)) {
                stopMoving(); // Hit a wall, stop
            }
        }, MOVE_STEP_MS);
    }

    function stepRobot(direction) {
        if (gameWon) { stopMoving(); return false; }

        let newX = robot.x;
        let newY = robot.y;

        if (direction === 'right' && maze.canMove(robot.x, robot.y, 'right')) newX++;
        else if (direction === 'left' && maze.canMove(robot.x, robot.y, 'left')) newX--;
        else if (direction === 'up' && maze.canMove(robot.x, robot.y, 'top')) newY--;
        else if (direction === 'down' && maze.canMove(robot.x, robot.y, 'bottom')) newY++;
        else return false; // Blocked by wall

        robot.moveTo(newX, newY);

        // Check win
        if (newX === exitX && newY === exitY) {
            gameWon = true;
            stopMoving();
            setTimeout(() => showWin(), 400);
        }
        return true;
    }

    function showWin() {
        stopTimer();
        const mins = Math.floor(elapsedSeconds / 60);
        const secs = elapsedSeconds % 60;
        const timeStr = mins > 0 ? `${mins} דקות ו-${secs} שניות` : `${secs} שניות`;
        winStats.textContent = `סיימת את שלב ${level} ב-${timeStr}!`;
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
            micBtn.textContent = '🎤 התחל הקשבה';
            micStatus.textContent = '🎤 מיקרופון כבוי';
            micStatus.className = 'mic-off';
        } else {
            if (voice.start()) {
                micBtn.textContent = '⏹️ עצור הקשבה';
                micStatus.textContent = '🎤 מאזין...';
                micStatus.className = 'mic-on';
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
