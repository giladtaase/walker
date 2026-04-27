/**
 * Robot rendering and movement with smooth animation.
 */
class Robot {
    constructor(x, y, cellSize) {
        this.x = x;
        this.y = y;
        this.cellSize = cellSize;
        this.animX = x * cellSize + cellSize / 2;
        this.animY = y * cellSize + cellSize / 2;
        this.targetX = this.animX;
        this.targetY = this.animY;
        this.animating = false;
        this.animProgress = 1;
        this.moves = 0;
        this.trail = [{ x, y }];
    }

    moveTo(newX, newY) {
        this.x = newX;
        this.y = newY;
        this.targetX = newX * this.cellSize + this.cellSize / 2;
        this.targetY = newY * this.cellSize + this.cellSize / 2;
        this.animating = true;
        this.animProgress = 0;
        this.moves++;
        this.trail.push({ x: newX, y: newY });
    }

    update() {
        if (!this.animating) return;

        this.animProgress += 0.12;
        if (this.animProgress >= 1) {
            this.animProgress = 1;
            this.animating = false;
        }

        const ease = 1 - Math.pow(1 - this.animProgress, 3); // ease-out cubic
        const startX = (this.trail.length >= 2)
            ? this.trail[this.trail.length - 2].x * this.cellSize + this.cellSize / 2
            : this.animX;
        const startY = (this.trail.length >= 2)
            ? this.trail[this.trail.length - 2].y * this.cellSize + this.cellSize / 2
            : this.animY;

        this.animX = startX + (this.targetX - startX) * ease;
        this.animY = startY + (this.targetY - startY) * ease;
    }

    draw(ctx) {
        const size = this.cellSize * 0.7;
        const x = this.animX;
        const y = this.animY;

        // Body
        ctx.fillStyle = '#4cc9f0';
        ctx.beginPath();
        ctx.roundRect(x - size / 2, y - size / 2, size, size, size * 0.2);
        ctx.fill();

        // Eyes
        const eyeSize = size * 0.15;
        const eyeY = y - size * 0.1;
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(x - size * 0.18, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + size * 0.18, eyeY, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Eye glow
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.arc(x - size * 0.18, eyeY, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + size * 0.18, eyeY, eyeSize * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Antenna
        ctx.strokeStyle = '#4cc9f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y - size / 2);
        ctx.lineTo(x, y - size / 2 - size * 0.25);
        ctx.stroke();
        ctx.fillStyle = '#00d4ff';
        ctx.beginPath();
        ctx.arc(x, y - size / 2 - size * 0.25, 3, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.15, y + size * 0.15);
        ctx.lineTo(x + size * 0.15, y + size * 0.15);
        ctx.stroke();

        // Glow effect
        ctx.shadowColor = '#4cc9f0';
        ctx.shadowBlur = 10;
        ctx.fillStyle = 'transparent';
        ctx.fillRect(x, y, 0, 0);
        ctx.shadowBlur = 0;
    }

    drawTrail(ctx) {
        if (this.trail.length < 2) return;

        ctx.strokeStyle = 'rgba(255, 200, 50, 0.5)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        const first = this.trail[0];
        ctx.moveTo(
            first.x * this.cellSize + this.cellSize / 2,
            first.y * this.cellSize + this.cellSize / 2
        );

        for (let i = 1; i < this.trail.length; i++) {
            const p = this.trail[i];
            ctx.lineTo(
                p.x * this.cellSize + this.cellSize / 2,
                p.y * this.cellSize + this.cellSize / 2
            );
        }
        ctx.stroke();
    }
}
