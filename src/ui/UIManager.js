export class UIManager {
    constructor() {
        this.container = document.getElementById('ui-container');
        this.createUIElements();
    }
    
    createUIElements() {
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
            gap: 20px;
        `;
        
        const scanner = this.createStatusIndicator('Scanner Ready', '#00ffff');
        const monster = this.createStatusIndicator('No Monsters Nearby', '#ff0040');
        
        container.appendChild(scanner);
        container.appendChild(monster);
        this.container.appendChild(container);
        
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
        this.container.appendChild(overlay);
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
        text.textContent = 'WASD to move | Mouse to look | Left Click to scan | Shift to sprint';
        this.container.appendChild(text);
        return text;
    }
    
    update(gameState) {
        // Update health bar
        this.healthBar.fill.style.width = `${gameState.playerHealth}%`;
        
        // Update energy bar
        this.energyBar.fill.style.width = `${gameState.playerEnergy}%`;
        
        // Update score
        this.scoreDisplay.textContent = `Score: ${gameState.score}`;
        
        // Update FPS counter
        this.fpsCounter.textContent = `FPS: ${Math.round(gameState.metrics.fps)}`;
        
        // Update performance overlay
        this.performanceOverlay.innerHTML = `
            Markers: ${gameState.metrics.markerCount}<br>
            Render Time: ${gameState.metrics.renderTime.toFixed(2)}ms
        `;
        
        // Update compass
        const direction = this.getCompassDirection(gameState.playerRotation);
        this.compass.textContent = direction;
        
        // Update status indicators
        this.statusIndicators.scanner.textContent = 
            gameState.playerEnergy >= 10 ? 'Scanner Ready' : 'Scanner Recharging';
        this.statusIndicators.monster.textContent = 
            gameState.monsterProximity ? 'Monster Nearby!' : 'No Monsters Nearby';
    }
    
    getCompassDirection(rotation) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round(rotation / (Math.PI / 4)) % 8;
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