export class MenuManager {
    constructor() {
        this.container = document.getElementById('menu-container');
        this.currentMenu = null;
        this.createMenus();
        this.setupMenuFlow();
        // Callbacks for main.js
        this.onStartGame = null;
        this.onPause = null;
        this.onResume = null;
        this.onRestart = null;
    }
    
    createMenus() {
        this.startMenu = this.createStartMenu();
        this.levelSelectMenu = this.createLevelSelectMenu();
        this.customizationMenu = this.createCustomizationMenu();
        this.pauseMenu = this.createPauseMenu();
        // Only show start menu at first
        this.hideAllMenus();
        this.showMenu(this.startMenu);
    }
    
    setupMenuFlow() {
        // Start Menu
        this.startMenu.querySelector('[data-action="start"]').onclick = () => {
            this.hideAllMenus();
            this.showMenu(this.levelSelectMenu);
        };
        this.startMenu.querySelector('[data-action="customize"]').onclick = () => {
            this.hideAllMenus();
            this.showMenu(this.customizationMenu);
        };
        this.startMenu.querySelector('[data-action="quit"]').onclick = () => {
            window.close();
        };
        // Level Select
        this.levelSelectMenu.querySelectorAll('.level-button').forEach(btn => {
            btn.onclick = () => {
                this.selectedLevel = parseInt(btn.dataset.level);
                this.hideAllMenus();
                this.showMenu(this.customizationMenu);
            };
        });
        this.levelSelectMenu.querySelector('[data-action="back"]').onclick = () => {
            this.hideAllMenus();
            this.showMenu(this.startMenu);
        };
        // Customization
        this.customizationMenu.querySelector('[data-action="back"]').onclick = () => {
            this.hideAllMenus();
            this.showMenu(this.levelSelectMenu);
        };
        // Save the player's name from the customization menu
        this.customizationMenu.querySelector('[data-action="save-customization"]').onclick = () => {
            this.hideAllMenus();
            this.container.classList.add('hidden');
            const playerName = document.getElementById('player-name').value;
            if (this.onStartGame) {
                this.onStartGame(this.selectedLevel, { ...this.getCustomizationData(), name: playerName });
            }
        };
        // Color selection
        this.customizationMenu.querySelectorAll('.color-option').forEach(btn => {
            btn.onclick = () => {
                this.customizationMenu.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            };
        });
        // Pause Menu
        this.pauseMenu.querySelector('[data-action="resume"]').onclick = () => {
            this.hideAllMenus();
            this.container.classList.add('hidden');
            if (this.onResume) this.onResume();
        };
        this.pauseMenu.querySelector('[data-action="restart"]').onclick = () => {
            this.hideAllMenus();
            this.container.classList.add('hidden');
            if (this.onRestart) this.onRestart();
        };
        this.pauseMenu.querySelector('[data-action="main-menu"]').onclick = () => {
            window.location.reload();
        };
        this.pauseMenu.querySelector('[data-action="quit"]').onclick = () => {
            window.close();
        };
    }
    
    createStartMenu() {
        const menu = document.createElement('div');
        menu.className = 'menu start-menu';
        menu.style.cssText = this.getMenuStyles();
        
        menu.innerHTML = `
            <h1 style="${this.getTitleStyles()}">GlowMaze</h1>
            <p style="${this.getDescriptionStyles()}">
                A first-person horror exploration game with unique scanning mechanics.
                Navigate through the dark maze, use your scanner to reveal the path,
                and avoid the monsters that lurk in the shadows.
            </p>
            <div style="${this.getButtonContainerStyles()}">
                <button class="menu-button" data-action="start">Start Game</button>
                <button class="menu-button" data-action="customize">Customize</button>
                <button class="menu-button" data-action="quit">Quit</button>
            </div>
        `;
        
        this.container.appendChild(menu);
        return menu;
    }
    
    createCustomizationMenu() {
        const menu = document.createElement('div');
        menu.className = 'menu customization-menu';
        menu.style.cssText = this.getMenuStyles();
        
        menu.innerHTML = `
            <h2 style="${this.getTitleStyles()}">Customize Character</h2>
            <div style="${this.getFormStyles()}">
                <div class="form-group">
                    <label>Character Name:</label>
                    <input type="text" id="player-name" maxlength="20">
                </div>
                <div class="form-group">
                    <label>Skin Color:</label>
                    <div class="color-options">
                        <button class="color-option" data-color="cyan" style="background: #00ffff"></button>
                        <button class="color-option" data-color="magenta" style="background: #ff00ff"></button>
                        <button class="color-option" data-color="yellow" style="background: #ffff00"></button>
                        <button class="color-option" data-color="green" style="background: #00ff00"></button>
                    </div>
                    <div style="margin-top:8px; color:#bffcff; font-size:0.98em; text-shadow:0 0 6px #00ffff44;">
                        <em>The selected color will be used for both your player and your scanner dots.</em>
                    </div>
                </div>
                <div class="form-group">
                    <label>Scanner Type:</label>
                    <select id="scanner-type">
                        <option value="standard">Standard</option>
                        <option value="wide">Wide</option>
                        <option value="focused">Focused</option>
                    </select>
                </div>
            </div>
            <div style="${this.getButtonContainerStyles()}">
                <button class="menu-button" data-action="back">Back</button>
                <button class="menu-button" data-action="save-customization">Save</button>
            </div>
        `;
        
        this.container.appendChild(menu);
        return menu;
    }
    
    createLevelSelectMenu() {
        const menu = document.createElement('div');
        menu.className = 'menu level-select-menu';
        menu.style.cssText = this.getMenuStyles();
        
        const levelButtons = Array(5).fill().map((_, i) => `
            <button class="level-button" data-level="${i + 1}">
                Level ${i + 1}
            </button>
        `).join('');
        
        menu.innerHTML = `
            <h2 style="${this.getTitleStyles()}">Select Level</h2>
            <div class="level-grid" style="${this.getLevelGridStyles()}">
                ${levelButtons}
            </div>
            <div style="${this.getButtonContainerStyles()}">
                <button class="menu-button" data-action="back">Back</button>
            </div>
        `;
        
        this.container.appendChild(menu);
        return menu;
    }
    
    createPauseMenu() {
        const menu = document.createElement('div');
        menu.className = 'menu pause-menu';
        menu.style.cssText = this.getMenuStyles();
        
        menu.innerHTML = `
            <h2 style="${this.getTitleStyles()}">Paused</h2>
            <div style="${this.getButtonContainerStyles()}">
                <button class="menu-button" data-action="resume">Resume</button>
                <button class="menu-button" data-action="restart">Restart Level</button>
                <button class="menu-button" data-action="main-menu">Main Menu</button>
                <button class="menu-button" data-action="quit">Quit</button>
            </div>
        `;
        
        this.container.appendChild(menu);
        return menu;
    }
    
    getMenuStyles() {
        return `
            background: rgba(0, 0, 0, 0.9);
            padding: 40px;
            border-radius: 10px;
            border: 2px solid #00ffff;
            color: #00ffff;
            text-align: center;
            max-width: 600px;
            width: 90%;
        `;
    }
    
    getTitleStyles() {
        return `
            font-size: 36px;
            margin-bottom: 20px;
            text-shadow: 0 0 10px #00ffff;
        `;
    }
    
    getDescriptionStyles() {
        return `
            font-size: 18px;
            margin-bottom: 30px;
            line-height: 1.5;
        `;
    }
    
    getButtonContainerStyles() {
        return `
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 20px;
        `;
    }
    
    getFormStyles() {
        return `
            display: flex;
            flex-direction: column;
            gap: 20px;
            margin: 20px 0;
            text-align: left;
        `;
    }
    
    getLevelGridStyles() {
        return `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin: 20px 0;
        `;
    }
    
    showMenu(menu) {
        menu.style.display = 'block';
        this.currentMenu = menu;
        this.container.classList.remove('hidden');
    }
    
    hideAllMenus() {
        [this.startMenu, this.customizationMenu, this.levelSelectMenu, this.pauseMenu]
            .forEach(menu => menu.style.display = 'none');
        this.currentMenu = null;
    }
    
    hideMenusCompletely() {
        this.hideAllMenus();
        this.container.classList.add('hidden');
    }
    
    getCustomizationData() {
        return {
            name: document.getElementById('player-name').value,
            skin: document.querySelector('.color-option.selected')?.dataset.color || 'cyan',
            scannerType: document.getElementById('scanner-type').value
        };
    }
    
    setCustomizationData(data) {
        document.getElementById('player-name').value = data.name || '';
        document.querySelectorAll('.color-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.color === data.skin);
        });
        document.getElementById('scanner-type').value = data.scannerType || 'standard';
    }
}