export class GameState {
    constructor() {
        // Game state
        this.isPaused = false;
        this.isGameOver = false;
        this.currentLevel = 1;
        this.score = 0;
        this.currentTheme = 'lab';
        
        // Player state
        this.playerHealth = 100;
        this.playerEnergy = 100;
        this.playerName = '';
        this.playerSkin = 'cyan';
        this.scannerType = 'standard';
        
        // Game settings
        this.settings = {
            musicVolume: 0.5,
            sfxVolume: 0.7,
            sensitivity: 1.0,
            fov: 75
        };
        
        // Performance metrics
        this.metrics = {
            fps: 0,
            markerCount: 0,
            renderTime: 0
        };
    }
    
    reset() {
        this.isPaused = false;
        this.isGameOver = false;
        this.score = 0;
        this.playerHealth = 100;
        this.playerEnergy = 100;
    }
    
    updateMetrics(fps, markerCount, renderTime) {
        this.metrics.fps = fps;
        this.metrics.markerCount = markerCount;
        this.metrics.renderTime = renderTime;
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
    }
} 