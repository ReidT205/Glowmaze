import { THEMES } from '../game/themes.js';

export class MenuManager {
    constructor() {
        this.container = document.getElementById('menu-container');
        this.currentMenu = null;
        this.selectedLevel = 1;
        this.createMenus();
        this.setupMenuFlow();
        this.onStartGame = null;
        this.onPause = null;
        this.onResume = null;
        this.onRestart = null;
        
        // Add menu transition animations
        this.container.style.transition = 'opacity 0.3s ease-in-out';
    }
    
    createMenus() {
        this.startMenu = this.createStartMenu();
        this.levelSelectMenu = this.createLevelSelectMenu();
        this.customizationMenu = this.createCustomizationMenu();
        this.pauseMenu = this.createPauseMenu();
        this.hideAllMenus();
        this.showMenu(this.startMenu);
    }
    
    createStartMenu() {
        const menu = document.createElement('div');
        menu.className = 'menu start-menu';
        
        menu.innerHTML = `
            <div class="menu-content">
                <h1 class="game-title">GlowMaze</h1>
                <div class="game-subtitle">Horror Exploration Game</div>
                
                <div class="menu-description">
                    <p>Navigate through dark mazes, use your scanner to reveal paths, and survive the horrors that lurk in the shadows.</p>
                </div>
                
                <div class="menu-features">
                    <div class="feature">
                        <span class="feature-icon">🎮</span>
                        <span class="feature-text">5 Unique Themed Levels</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">🔍</span>
                        <span class="feature-text">Advanced Scanner System</span>
                    </div>
                    <div class="feature">
                        <span class="feature-icon">👤</span>
                        <span class="feature-text">Customizable Character</span>
                    </div>
                </div>
                
                <div class="button-container">
                    <button class="menu-button danger" data-action="quit">
                        <span class="button-icon">✖</span>
                        Quit
                    </button>
                    <button class="menu-button primary" data-action="start">
                        <span class="button-icon">→</span>
                        Next
                    </button>
                </div>
            </div>
        `;
        
        this.container.appendChild(menu);
        return menu;
    }
    
    createLevelSelectMenu() {
        const menu = document.createElement('div');
        menu.className = 'menu level-select-menu';
        
        const themes = ['lab', 'crypt', 'forest', 'ice', 'void'];
        const levelButtons = Array(5).fill().map((_, i) => {
            const theme = THEMES[themes[i]];
            return `
                <div class="level-card" data-level="${i + 1}">
                    <div class="level-preview" style="background: linear-gradient(45deg, ${theme.wall.color}, ${theme.floor.color})">
                        <div class="level-number">${i + 1}</div>
                    </div>
                    <div class="level-info">
                        <h3>${theme.name}</h3>
                        <div class="level-difficulty">
                            ${'★'.repeat(i + 1)}${'☆'.repeat(5 - i - 1)}
                        </div>
                        <div class="level-description">
                            ${this.getLevelDescription(i + 1)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        menu.innerHTML = `
            <div class="menu-content">
                <h2>Select Your Level</h2>
                <div class="level-grid">
                    ${levelButtons}
                </div>
                <div class="button-container">
                    <button class="menu-button back" data-action="back">
                        <span class="button-icon">←</span>
                        Back
                    </button>
                    <button class="menu-button primary" data-action="start-level" style="display: none;">
                        <span class="button-icon">▶</span>
                        Start Game
                    </button>
                </div>
            </div>
        `;
        
        this.container.appendChild(menu);
        return menu;
    }
    
    createCustomizationMenu() {
        const menu = document.createElement('div');
        menu.className = 'menu customization-menu';
        
        menu.innerHTML = `
            <div class="menu-content">
                <h2>Customize Your Character</h2>
                
                <div class="customization-section">
                    <h3>Character Name</h3>
                    <div class="form-group">
                        <input type="text" id="player-name" maxlength="20" placeholder="Enter your name">
                    </div>
                </div>
                
                <div class="customization-section">
                    <h3>Visual Style</h3>
                    <div class="color-options">
                        <div class="color-option selected" data-color="cyan" style="background: #00ffff"></div>
                        <div class="color-option" data-color="magenta" style="background: #ff00ff"></div>
                        <div class="color-option" data-color="yellow" style="background: #ffff00"></div>
                        <div class="color-option" data-color="green" style="background: #00ff00"></div>
                    </div>
                    <div style="text-align: center; margin-top: 10px; color: #a0a0a0; font-size: 0.9rem;">
                        The selected color will be used for both your player and your scanner dots.
                    </div>
                </div>
                
                <div class="customization-section">
                    <h3>Scanner Configuration</h3>
                    <div class="scanner-options">
                        <div class="scanner-option" data-type="focused">
                            <div class="scanner-icon">🎯</div>
                            <div class="scanner-name">Focused</div>
                            <div class="scanner-description">Longer range, precise scanning</div>
                        </div>
                        <div class="scanner-option" data-type="standard">
                            <div class="scanner-icon">🔍</div>
                            <div class="scanner-name">Standard</div>
                            <div class="scanner-description">Balanced range and energy usage</div>
                        </div>
                        <div class="scanner-option" data-type="wide">
                            <div class="scanner-icon">📡</div>
                            <div class="scanner-name">Wide</div>
                            <div class="scanner-description">Larger area, higher energy cost</div>
                        </div>
                    </div>
                </div>
                
                <div class="button-container">
                    <button class="menu-button back" data-action="back">
                        <span class="button-icon">←</span>
                        Back
                    </button>
                    <button class="menu-button primary" data-action="save-customization">
                        <span class="button-icon">→</span>
                        Next
                    </button>
                </div>
            </div>
        `;
        
        this.container.appendChild(menu);
        return menu;
    }
    
    createPauseMenu() {
        const menu = document.createElement('div');
        menu.className = 'menu pause-menu';
        
        menu.innerHTML = `
            <div class="menu-content">
                <h2>Game Paused</h2>
                
                <div class="pause-stats">
                    <div class="stat">
                        <span class="stat-label">Level</span>
                        <span class="stat-value" id="pause-level">1</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Score</span>
                        <span class="stat-value" id="pause-score">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Time</span>
                        <span class="stat-value" id="pause-time">00:00</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Enemies Defeated</span>
                        <span class="stat-value" id="pause-enemies-killed">0</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Damage Dealt</span>
                        <span class="stat-value" id="pause-damage-dealt">0</span>
                    </div>
                </div>
                
                <div class="button-container">
                    <button class="menu-button danger" data-action="quit">
                        <span class="button-icon">✖</span>
                        Quit Game
                    </button>
                    <button class="menu-button danger" data-action="main-menu">
                        <span class="button-icon">⌂</span>
                        Main Menu
                    </button>
                    <button class="menu-button secondary" data-action="restart">
                        <span class="button-icon">↺</span>
                        Restart Level
                    </button>
                    <button class="menu-button primary" data-action="resume">
                        <span class="button-icon">▶</span>
                        Resume Game
                    </button>
                </div>
            </div>
        `;
        
        this.container.appendChild(menu);
        return menu;
    }
    
    getLevelDescription(level) {
        const descriptions = {
            1: "An abandoned laboratory with flickering lights and mysterious equipment.",
            2: "An ancient crypt filled with shadows and forgotten secrets.",
            3: "A dense forest maze where nature has reclaimed the paths.",
            4: "A frozen cavern with crystalline walls and eerie echoes.",
            5: "A void realm where reality itself seems to bend and twist."
        };
        return descriptions[level] || "A challenging maze awaits...";
    }
    
    setupMenuFlow() {
        // Start Menu
        this.startMenu.querySelector('[data-action="start"]').addEventListener('click', () => {
            this.hideAllMenus();
            this.showMenu(this.customizationMenu);
        });
        
        this.startMenu.querySelector('[data-action="quit"]').addEventListener('click', () => {
            window.close();
        });

        // Customization
        this.customizationMenu.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                this.customizationMenu.querySelectorAll('.color-option').forEach(opt => 
                    opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        this.customizationMenu.querySelectorAll('.scanner-option').forEach(option => {
            option.addEventListener('click', () => {
                this.customizationMenu.querySelectorAll('.scanner-option').forEach(opt => 
                    opt.classList.remove('selected'));
                option.classList.add('selected');
            });
        });
        
        this.customizationMenu.querySelector('[data-action="back"]').addEventListener('click', () => {
            this.hideAllMenus();
            this.showMenu(this.startMenu);
        });
        
        this.customizationMenu.querySelector('[data-action="save-customization"]').addEventListener('click', () => {
            this.hideAllMenus();
            this.showMenu(this.levelSelectMenu);
        });

        // Level Select
        this.levelSelectMenu.querySelectorAll('.level-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectedLevel = parseInt(card.dataset.level);
                // Visually indicate selected level
                this.levelSelectMenu.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                // Show the start game button
                this.levelSelectMenu.querySelector('[data-action="start-level"]').style.display = 'flex';
            });
        });
        
        this.levelSelectMenu.querySelector('[data-action="start-level"]').addEventListener('click', () => {
            if (this.selectedLevel) {
                this.hideAllMenus();
                this.container.classList.add('hidden');
                if (this.onStartGame) {
                    this.onStartGame(this.selectedLevel, this.getCustomizationData());
                }
            }
        });
        
        this.levelSelectMenu.querySelector('[data-action="back"]').addEventListener('click', () => {
            this.hideAllMenus();
            this.showMenu(this.customizationMenu);
        });

        // Pause Menu
        this.pauseMenu.querySelector('[data-action="resume"]').addEventListener('click', () => {
            this.hideAllMenus();
            this.container.classList.add('hidden');
            if (this.onResume) {
                this.onResume();
                window.game.gameState.resumeTimer();
            }
        });
        
        this.pauseMenu.querySelector('[data-action="restart"]').addEventListener('click', () => {
            this.hideAllMenus();
            this.container.classList.add('hidden');
            if (this.onRestart) {
                this.onRestart();
                window.game.gameState.reset(); // This will reset and start the timer
            }
        });
        
        this.pauseMenu.querySelector('[data-action="main-menu"]').addEventListener('click', () => {
            window.location.reload();
        });
        
        this.pauseMenu.querySelector('[data-action="quit"]').addEventListener('click', () => {
            window.close();
        });
    }
    
    showMenu(menu) {
        menu.style.display = 'block';
        this.currentMenu = menu;
        this.container.classList.remove('hidden');
        this.container.style.opacity = '1';

        // Update pause menu stats if showing pause menu
        if (menu === this.pauseMenu && window.game) {
            const gameState = window.game.gameState;
            document.getElementById('pause-level').textContent = gameState.currentLevel;
            document.getElementById('pause-score').textContent = gameState.score;
            document.getElementById('pause-time').textContent = gameState.getFormattedTime();
            document.getElementById('pause-enemies-killed').textContent = window.game.enemyManager.getEnemiesKilled();
            document.getElementById('pause-damage-dealt').textContent = window.game.enemyManager.getTotalDamageDealt();
        }
    }
    
    hideAllMenus() {
        [this.startMenu, this.customizationMenu, this.levelSelectMenu, this.pauseMenu]
            .forEach(menu => menu.style.display = 'none');
        this.currentMenu = null;
    }
    
    hideMenusCompletely() {
        this.hideAllMenus();
        this.container.style.opacity = '0';
        setTimeout(() => {
            this.container.classList.add('hidden');
        }, 300);
    }
    
    getCustomizationData() {
        return {
            name: document.getElementById('player-name').value || 'Player',
            skin: document.querySelector('.color-option.selected')?.dataset.color || 'cyan',
            scannerType: document.querySelector('.scanner-option.selected')?.dataset.type || 'standard'
        };
    }
    
    setCustomizationData(data) {
        document.getElementById('player-name').value = data.name || '';
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.color === data.skin);
        });
        document.querySelectorAll('.scanner-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.type === data.scannerType);
        });
    }
}