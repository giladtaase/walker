/**
 * Maze generation using recursive backtracking (DFS).
 * Each cell has walls: top, right, bottom, left.
 */
class Maze {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = [];
        this.generate();
    }

    generate() {
        // Initialize grid — each cell has all 4 walls
        this.grid = [];
        for (let y = 0; y < this.rows; y++) {
            const row = [];
            for (let x = 0; x < this.cols; x++) {
                row.push({
                    x,
                    y,
                    walls: { top: true, right: true, bottom: true, left: true },
                    visited: false,
                });
            }
            this.grid.push(row);
        }

        // Recursive backtracking from (0, 0)
        const stack = [];
        const start = this.grid[0][0];
        start.visited = true;
        stack.push(start);

        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = this.getUnvisitedNeighbors(current);

            if (neighbors.length === 0) {
                stack.pop();
            } else {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                this.removeWall(current, next);
                next.visited = true;
                stack.push(next);
            }
        }
    }

    getUnvisitedNeighbors(cell) {
        const { x, y } = cell;
        const neighbors = [];

        if (y > 0 && !this.grid[y - 1][x].visited) neighbors.push(this.grid[y - 1][x]);
        if (x < this.cols - 1 && !this.grid[y][x + 1].visited) neighbors.push(this.grid[y][x + 1]);
        if (y < this.rows - 1 && !this.grid[y + 1][x].visited) neighbors.push(this.grid[y + 1][x]);
        if (x > 0 && !this.grid[y][x - 1].visited) neighbors.push(this.grid[y][x - 1]);

        return neighbors;
    }

    removeWall(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;

        if (dx === 1) { a.walls.left = false; b.walls.right = false; }
        if (dx === -1) { a.walls.right = false; b.walls.left = false; }
        if (dy === 1) { a.walls.top = false; b.walls.bottom = false; }
        if (dy === -1) { a.walls.bottom = false; b.walls.top = false; }
    }

    canMove(x, y, direction) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
        const cell = this.grid[y][x];
        return !cell.walls[direction];
    }

    /**
     * BFS solve from (startX, startY) to (endX, endY).
     * Returns the path as an array of {x, y} including start and end.
     */
    solve(startX, startY, endX, endY) {
        const visited = Array.from({ length: this.rows }, () => new Array(this.cols).fill(false));
        const parent = Array.from({ length: this.rows }, () => new Array(this.cols).fill(null));
        const queue = [{ x: startX, y: startY }];
        visited[startY][startX] = true;

        const dirs = [
            { name: 'right', dx: 1, dy: 0 },
            { name: 'left', dx: -1, dy: 0 },
            { name: 'top', dx: 0, dy: -1 },
            { name: 'bottom', dx: 0, dy: 1 },
        ];

        while (queue.length > 0) {
            const curr = queue.shift();
            if (curr.x === endX && curr.y === endY) {
                // Reconstruct path
                const path = [];
                let c = curr;
                while (c) {
                    path.unshift({ x: c.x, y: c.y });
                    c = parent[c.y][c.x];
                }
                return path;
            }

            for (const dir of dirs) {
                if (this.canMove(curr.x, curr.y, dir.name)) {
                    const nx = curr.x + dir.dx;
                    const ny = curr.y + dir.dy;
                    if (!visited[ny][nx]) {
                        visited[ny][nx] = true;
                        parent[ny][nx] = curr;
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
        }
        return []; // No solution (shouldn't happen)
    }

    /**
     * Generate maze and ensure solution length is within target range.
     */
    generateWithTargetLength(minLen, maxLen) {
        for (let attempt = 0; attempt < 50; attempt++) {
            this.generate();
            const path = this.solve(0, 0, this.cols - 1, this.rows - 1);
            if (path.length >= minLen && path.length <= maxLen) {
                return path;
            }
        }
        // Return whatever we got on last attempt
        return this.solve(0, 0, this.cols - 1, this.rows - 1);
    }

    draw(ctx, cellSize, exitX, exitY) {
        const wallColor = '#0f3460';
        const wallWidth = 2;
        const exitColor = '#00d4ff';

        ctx.strokeStyle = wallColor;
        ctx.lineWidth = wallWidth;
        ctx.lineCap = 'round';

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const cell = this.grid[y][x];
                const px = x * cellSize;
                const py = y * cellSize;

                if (cell.walls.top) {
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + cellSize, py);
                    ctx.stroke();
                }
                if (cell.walls.right) {
                    ctx.beginPath();
                    ctx.moveTo(px + cellSize, py);
                    ctx.lineTo(px + cellSize, py + cellSize);
                    ctx.stroke();
                }
                if (cell.walls.bottom) {
                    ctx.beginPath();
                    ctx.moveTo(px, py + cellSize);
                    ctx.lineTo(px + cellSize, py + cellSize);
                    ctx.stroke();
                }
                if (cell.walls.left) {
                    ctx.beginPath();
                    ctx.moveTo(px, py);
                    ctx.lineTo(px, py + cellSize);
                    ctx.stroke();
                }
            }
        }

        // Draw exit marker
        const exPx = exitX * cellSize;
        const exPy = exitY * cellSize;
        ctx.fillStyle = exitColor;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(exPx + 4, exPy + 4, cellSize - 8, cellSize - 8);
        ctx.globalAlpha = 1;

        // Exit star
        ctx.fillStyle = exitColor;
        ctx.font = `${cellSize * 0.6}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', exPx + cellSize / 2, exPy + cellSize / 2);
    }
}
