export class UIManager {
    constructor() {
        this.container = document.getElementById('ui-container');
        this.camera = null;
        this.createUIElements();
    }
    
    setCamera(camera) {
        this.camera = camera;
    }
    
    createUIElements() {
        // Create minimap container
        this.minimapContainer = document.createElement('div');
        this.minimapContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 200px;
            height: 200px;
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid #00ffff;
            border-radius: 10px;
            box-shadow: 0 0 16px #00ffff99;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: all 0.3s ease;
            z-index: 1100;
        `;
        this.container.appendChild(this.minimapContainer);

        // Create minimap canvas
        this.minimapCanvas = document.createElement('canvas');
        this.minimapCanvas.width = 200;
        this.minimapCanvas.height = 200;
        this.minimapCanvas.style.cssText = `
            margin: auto;
            display: block;
            width: 100%;
            height: 100%;
        `;
        this.minimapContainer.appendChild(this.minimapCanvas);

        // Health bar
        this.healthBar = this.createHealthBar();
        
        // Energy bar
        this.energyBar = this.createEnergyBar();
        
        // Score display
        this.scoreDisplay = this.createScoreDisplay();
        
        // FPS counter
        this.fpsCounter = this.createFPSCounter();
        
        // Compass
        this.compass = this.createCompass();
        
        // Status indicators
        this.statusIndicators = this.createStatusIndicators();
        
        // Crosshair
        this.crosshair = this.createCrosshair();
        
        // Performance overlay
        this.performanceOverlay = this.createPerformanceOverlay();
        
        // Tutorial text
        this.tutorialText = this.createTutorialText();
    }
    
    createHealthBar() {
        const container = document.createElement('div');
        container.className = 'health-bar';
        container.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            width: 200px;
            height: 20px;
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid #00ffff;
            border-radius: 10px;
            overflow: hidden;
        `;
        
        const fill = document.createElement('div');
        fill.className = 'health-fill';
        fill.style.cssText = `
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #ff0040, #ff8000);
            transition: width 0.3s ease;
        `;
        
        container.appendChild(fill);
        this.container.appendChild(container);
        return { container, fill };
    }
    
    createEnergyBar() {
        const container = document.createElement('div');
        container.className = 'energy-bar';
        container.style.cssText = `
            position: absolute;
            bottom: 50px;
            left: 20px;
            width: 200px;
            height: 20px;
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid #00ffff;
            border-radius: 10px;
            overflow: hidden;
        `;
        
        const fill = document.createElement('div');
        fill.className = 'energy-fill';
        fill.style.cssText = `
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #00ffff, #0080ff);
            transition: width 0.3s ease;
        `;
        
        container.appendChild(fill);
        this.container.appendChild(container);
        return { container, fill };
    }
    
    createScoreDisplay() {
        const display = document.createElement('div');
        display.className = 'score-display';
        display.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 24px;
            color: #00ffff;
            text-shadow: 0 0 10px #00ffff;
        `;
        display.textContent = 'Score: 0';
        this.container.appendChild(display);
        return display;
    }
    
    createFPSCounter() {
        const counter = document.createElement('div');
        counter.className = 'fps-counter';
        counter.style.cssText = `
            position: absolute;
            top: 20px;
            left: 20px;
            font-size: 16px;
            color: #00ffff;
        `;
        counter.textContent = 'FPS: 60';
        this.container.appendChild(counter);
        return counter;
    }
    
    createCompass() {
        const compass = document.createElement('div');
        compass.className = 'compass';
        compass.style.cssText = `
            position: absolute;
            top: 50px;
            left: 50%;
            transform: translateX(-50%);
            width: 200px;
            height: 40px;
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid #00ffff;
            border-radius: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #00ffff;
            font-size: 18px;
        `;
        compass.textContent = 'N';
        this.container.appendChild(compass);
        return compass;
    }
    
    createStatusIndicators() {
        const container = document.createElement('div');
        container.className = 'status-indicators';
        container.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
        `;
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.gap = '20px';
        const scanner = this.createStatusIndicator('Scanner Ready', '#00ffff');
        const monster = this.createStatusIndicator('No Monsters Nearby', '#ff0040');
        row.appendChild(scanner);
        row.appendChild(monster);
        container.appendChild(row);
        // Player name box (no margin-top, default 'Your Name')
        if (this.playerNameBox && this.playerNameBox.parentElement) {
            this.playerNameBox.parentElement.removeChild(this.playerNameBox);
        }
        const nameBox = document.createElement('div');
        nameBox.className = 'player-name-box';
        nameBox.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            background: transparent;
            color: #00ffff;
            font-size: 1.1em;
            font-weight: 700;
            letter-spacing: 1px;
            min-width: 120px;
            text-align: center;
            height: auto;
            padding: 10px;
            margin: 0;
        `;
        nameBox.textContent = 'Your Name';
        container.appendChild(nameBox);
        this.container.appendChild(container);
        // Store for later
        this.playerNameBox = nameBox;
        return { scanner, monster };
    }
    
    createStatusIndicator(text, color) {
        const indicator = document.createElement('div');
        indicator.style.cssText = `
            padding: 5px 10px;
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid ${color};
            border-radius: 5px;
            color: ${color};
            font-size: 14px;
        `;
        indicator.textContent = text;
        return indicator;
    }
    
    createCrosshair() {
        const crosshair = document.createElement('div');
        crosshair.className = 'crosshair';
        crosshair.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 20px;
            height: 20px;
            border: 2px solid #00ffff;
            border-radius: 50%;
            pointer-events: none;
        `;
        this.container.appendChild(crosshair);
        return crosshair;
    }
    
    createPerformanceOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'performance-overlay';
        overlay.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.5);
            padding: 10px;
            border: 2px solid #00ffff;
            border-radius: 5px;
            color: #00ffff;
            font-size: 14px;
        `;
        // Add canvas for animated graphs
        const graphCanvas = document.createElement('canvas');
        graphCanvas.width = 180;
        graphCanvas.height = 60;
        graphCanvas.style.display = 'block';
        overlay.appendChild(graphCanvas);
        // Add text for live values
        const textDiv = document.createElement('div');
        textDiv.style.marginTop = '6px';
        overlay.appendChild(textDiv);
        this.container.appendChild(overlay);
        // Store for later
        this.performanceGraph = graphCanvas;
        this.performanceText = textDiv;
        // History arrays for graphs
        this.fpsHistory = Array(100).fill(60);
        this.markerHistory = Array(100).fill(0);
        this.renderTimeHistory = Array(100).fill(16);
        return overlay;
    }
    
    createTutorialText() {
        const text = document.createElement('div');
        text.className = 'tutorial-text';
        text.style.cssText = `
            position: absolute;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.5);
            padding: 10px 20px;
            border: 2px solid #00ffff;
            border-radius: 5px;
            color: #00ffff;
            font-size: 16px;
            text-align: center;
        `;
        text.textContent = 'WASD to move | Mouse to look | SPACE to scan | Shift to sprint';
        this.container.appendChild(text);
        return text;
    }
    
    updateMinimap(mazeLayout, discovered, playerPos, playerColor = '#00ffff') {
        if (!this.minimapCanvas || !mazeLayout || !this.camera) return;
        
        const ctx = this.minimapCanvas.getContext('2d');
        const cellSize = this.minimapCanvas.width / mazeLayout.length;
        
        // Clear canvas with black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
        
        // Draw maze walls and paths
        for (let x = 0; x < mazeLayout.length; x++) {
            for (let z = 0; z < mazeLayout.length; z++) {
                const cellX = x * cellSize;
                const cellZ = z * cellSize;
                
                if (mazeLayout[x][z] === 1 && discovered[x][z]) {
                    // Wall (only if discovered)
                    ctx.fillStyle = '#333333';
                    ctx.fillRect(cellX, cellZ, cellSize, cellSize);
                } else if (discovered[x][z]) {
                    // Discovered path
                    if (discovered[x][z] === 'spawn') {
                        // Spawn point
                        ctx.fillStyle = '#00ff00';
                        ctx.fillRect(cellX, cellZ, cellSize, cellSize);
                    } else {
                        // Regular discovered path
                        ctx.fillStyle = '#666666';
                        ctx.fillRect(cellX, cellZ, cellSize, cellSize);
                    }
                }
            }
        }
        
        // Draw player position
        const playerX = playerPos.x * cellSize;
        const playerZ = playerPos.z * cellSize;
        
        // Draw player dot
        ctx.beginPath();
        ctx.arc(playerX + cellSize/2, playerZ + cellSize/2, cellSize/3, 0, Math.PI * 2);
        ctx.fillStyle = playerColor;
        ctx.fill();
        
        // Calculate the centerline angle of the FOV cone on the canvas
        const centerlineCanvasAngle = Math.PI / 2 - this.camera.rotation.y;

        // FOV properties
        const fovAngle = Math.PI / 3; // 60 degrees FOV
        const fovRadius = cellSize * 15; // Match maxDistance from Game class

        // Save context state
        ctx.save();

        // Translate to player position (center of the cone)
        ctx.translate(playerX + cellSize / 2, playerZ + cellSize / 2);

        // Draw FOV cone using absolute angles
        ctx.beginPath();
        ctx.moveTo(0, 0); // Start from the player's center
        const startAngle = centerlineCanvasAngle - fovAngle / 2;
        const endAngle = centerlineCanvasAngle + fovAngle / 2;
        ctx.arc(0, 0, fovRadius, startAngle, endAngle);
        ctx.closePath(); // Creates the cone shape by connecting to moveTo point

        // Create gradient for FOV cone
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, fovRadius);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fill();

        // Restore context state
        ctx.restore();
    }
    
    toggleMinimapSize() {
        this.isMinimapExpanded = !this.isMinimapExpanded;
        if (this.isMinimapExpanded) {
            this.minimapContainer.style.width = '320px';
            this.minimapContainer.style.height = '320px';
            this.minimapCanvas.width = 320;
            this.minimapCanvas.height = 320;
        } else {
            this.minimapContainer.style.width = '200px';
            this.minimapContainer.style.height = '200px';
            this.minimapCanvas.width = 200;
            this.minimapCanvas.height = 200;
        }
    }
    
    update(gameState) {
        // Update health bar
        if (this.healthBar.fill.style.width !== `${gameState.playerHealth}%`) {
            this.healthBar.fill.style.width = `${gameState.playerHealth}%`;
        }
        // Update energy bar
        if (this.energyBar.fill.style.width !== `${gameState.playerEnergy}%`) {
            this.energyBar.fill.style.width = `${gameState.playerEnergy}%`;
        }
        // Update score
        if (this.scoreDisplay.textContent !== `Score: ${gameState.score}`) {
            this.scoreDisplay.textContent = `Score: ${gameState.score}`;
        }
        // Update FPS counter
        this.fpsCounter.textContent = `FPS: ${Math.round(gameState.metrics.fps)}`;
        // Color-coded performance overlay text
        this.performanceText.innerHTML =
            `<span style='color:#ff00ff'>Markers: ${gameState.metrics.markerCount}</span><br>` +
            `<span style='color:#ffff00'>Render Time: ${gameState.metrics.renderTime.toFixed(2)}ms</span><br>` +
            `<span style='color:#00ffff'>FPS: ${Math.round(gameState.metrics.fps)}</span>`;
        // Update graph histories
        this.fpsHistory.push(gameState.metrics.fps);
        this.fpsHistory.shift();
        this.markerHistory.push(gameState.metrics.markerCount);
        this.markerHistory.shift();
        this.renderTimeHistory.push(gameState.metrics.renderTime);
        this.renderTimeHistory.shift();
        // --- Dynamic graph scaling ---
        // Find max values in history
        const maxFps = Math.max(...this.fpsHistory, 120);
        const maxMarkers = Math.max(...this.markerHistory, 20000);
        const maxRender = Math.max(...this.renderTimeHistory, 50);
        // Set dynamic scales
        let fpsScale = 120;
        let markerScale = 20000;
        let renderScale = 50;
        if (maxFps > 120) fpsScale = Math.ceil(maxFps / 10) * 10;
        if (maxMarkers > 20000) markerScale = Math.ceil(maxMarkers / 1000) * 1000;
        if (maxRender > 50) renderScale = Math.ceil(maxRender / 10) * 10;
        // Draw animated graphs
        const ctx = this.performanceGraph.getContext('2d');
        ctx.clearRect(0, 0, this.performanceGraph.width, this.performanceGraph.height);
        // Draw zero y-axis line (gray)
        ctx.save();
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, this.performanceGraph.height);
        ctx.lineTo(this.performanceGraph.width, this.performanceGraph.height);
        ctx.stroke();
        ctx.restore();
        // FPS graph (cyan)
        ctx.beginPath();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        for (let i = 0; i < this.fpsHistory.length; i++) {
            const x = (i / (this.fpsHistory.length - 1)) * this.performanceGraph.width;
            const y = this.performanceGraph.height - (this.fpsHistory[i] / fpsScale) * this.performanceGraph.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Marker count graph (magenta)
        ctx.beginPath();
        ctx.strokeStyle = '#ff00ff';
        for (let i = 0; i < this.markerHistory.length; i++) {
            const x = (i / (this.markerHistory.length - 1)) * this.performanceGraph.width;
            const y = this.performanceGraph.height - (this.markerHistory[i] / markerScale) * this.performanceGraph.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // Render time graph (yellow)
        ctx.beginPath();
        ctx.strokeStyle = '#ffff00';
        for (let i = 0; i < this.renderTimeHistory.length; i++) {
            const x = (i / (this.renderTimeHistory.length - 1)) * this.performanceGraph.width;
            const y = this.performanceGraph.height - (this.renderTimeHistory[i] / renderScale) * this.performanceGraph.height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        // Update compass
        const direction = this.getCompassDirection(gameState.playerRotation);
        this.compass.textContent = direction;
        
        // Update status indicators
        this.statusIndicators.scanner.textContent = 
            gameState.playerEnergy >= 10 ? 'Scanner Ready' : 'Scanner Recharging';
        this.statusIndicators.monster.textContent = 
            gameState.monsterProximity ? 'Monster Nearby!' : 'No Monsters Nearby';
        // Update the player name box to reflect the current player name
        if (this.playerNameBox) {
            this.playerNameBox.textContent = gameState.playerName || 'Your Name';
        }
    }
    
    getCompassDirection(rotation) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        // Normalize rotation to be in the range [0, 2*PI)
        const twoPi = 2 * Math.PI;
        const normalizedRotation = (rotation % twoPi + twoPi) % twoPi;
        
        // Convert to an index from 0 to 7
        // Each segment is PI/4 radians (45 degrees)
        // Add PI/8 to center the segments around the directions (e.g., N is -PI/8 to PI/8 around 0)
        const index = Math.floor((normalizedRotation + Math.PI / 8) / (Math.PI / 4)) % 8;
        return directions[index];
    }
    
    showGameOver() {
        const gameOver = document.createElement('div');
        gameOver.className = 'game-over';
        gameOver.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 20px;
            border: 2px solid #ff0040;
            border-radius: 10px;
            color: #ff0040;
            font-size: 32px;
            text-align: center;
        `;
        gameOver.textContent = 'GAME OVER';
        this.container.appendChild(gameOver);
    }
    
    hideTutorial() {
        this.tutorialText.style.display = 'none';
    }
}