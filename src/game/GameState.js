export class GameState {
    constructor() {
        // Game state
        this.isPaused = false;
        this.isGameOver = false;
        this.currentLevel = 1;
        this.score = 0;
        this.currentTheme = 'lab';
        
        // Time tracking
        this.startTime = null;
        this.elapsedTime = 0;
        this.lastUpdateTime = null;
        this.isTimerRunning = false;
        
        // Player state
        this.playerHealth = 100;
        this.playerEnergy = 100;
        this.playerName = 'Your Name';
        this.playerSkin = 'cyan';
        this.scannerType = 'basic';
        
        // Game settings
        this.settings = {
            musicVolume: 0.5,
            sfxVolume: 0.7,
            sensitivity: 1.0,
            fov: 75
        };
        
        // Performance metrics
        this.metrics = {
            fps: 60,
            markerCount: 0,
            renderTime: 0
        };
        
        this.monsterProximity = false;
        this.pausedTime = 0;
        this.isTimerPaused = false;
    }
    
    reset() {
        this.isPaused = false;
        this.isGameOver = false;
        this.score = 0;
        this.playerHealth = 100;
        this.playerEnergy = 100;
        this.startTime = Date.now();
        this.lastUpdateTime = this.startTime;
        this.elapsedTime = 0;
        this.isTimerRunning = true;
    }
    
    updateMetrics(fps, markerCount, renderTime) {
        this.metrics.fps = fps;
        this.metrics.markerCount = markerCount;
        this.metrics.renderTime = renderTime;
        
        // Update elapsed time only if timer is running
        if (this.isTimerRunning && !this.isPaused && !this.isGameOver) {
            const now = Date.now();
            this.elapsedTime += (now - this.lastUpdateTime) / 1000; // Convert to seconds
            this.lastUpdateTime = now;
        }
    }
    
    pauseTimer() {
        this.isTimerRunning = false;
    }
    
    resumeTimer() {
        if (!this.isTimerRunning) {
            this.lastUpdateTime = Date.now();
            this.isTimerRunning = true;
        }
    }
    
    getFormattedTime() {
        const totalSeconds = Math.floor(this.elapsedTime);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    takeDamage(amount) {
        this.playerHealth = Math.max(0, this.playerHealth - amount);
        if (this.playerHealth <= 0) {
            this.isGameOver = true;
        }
    }
    
    useEnergy(amount) {
        if (this.playerEnergy >= amount) {
            this.playerEnergy -= amount;
            return true;
        }
        return false;
    }
    
    regenerateEnergy(amount) {
        this.playerEnergy = Math.min(100, this.playerEnergy + amount);
    }
    
    addScore(points) {
        this.score += points;
    }
    
    setPlayerCustomization(name, skin, scannerType) {
        this.playerName = name;
        this.playerSkin = skin;
        this.scannerType = scannerType;
    }
    
    updateSettings(settings) {
        this.settings = { ...this.settings, ...settings };
    }
    
    update(deltaTime) {
        // Regenerate scanner energy slowly
        this.regenerateEnergy(deltaTime * 5); // 5 units per second
        
        // Regenerate health slowly if not at max
        if (this.playerHealth < 100) {
            this.playerHealth = Math.min(100, this.playerHealth + deltaTime * 2); // 2 health per second
        }
    }
} 