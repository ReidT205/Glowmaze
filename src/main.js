import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { GameState } from './game/GameState';
import { Player } from './game/Player';
import { Scanner } from './game/Scanner';
import { EnemyManager } from './game/EnemyManager';
import { UIManager } from './ui/UIManager';
import { MenuManager } from './ui/MenuManager';
import { MazeGenerator } from './game/MazeGenerator';
import { InputManager } from './game/InputManager';
import { SoundManager } from './audio/SoundManager';
import { THEMES } from './game/themes.js';

class Game {
    constructor() {
        this.gameState = new GameState();
        this.setupScene();
        this.setupLights();
        this.setupControls();
        
        // Initialize managers
        this.inputManager = new InputManager();
        this.mazeGenerator = new MazeGenerator();
        // Store player color (default cyan)
        this.playerColor = 0x00ffff;
        this.player = new Player(this.scene, this.camera);
        this.scanner = new Scanner(this.scene, () => this.playerColor, this.camera);
        this.enemyManager = new EnemyManager(this.scene);
        this.uiManager = new UIManager();
        this.uiManager.setCamera(this.camera);
        this.menuManager = new MenuManager();
        this.soundManager = new SoundManager();
        
        // Bind methods
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.handlePause = this.handlePause.bind(this);
        this.handleResume = this.handleResume.bind(this);
        
        // Track space bar state
        this.isSpacePressed = false;
        this.isMinimapExpanded = false;
        
        // Track if game has been started
        this.gameStarted = false;
        
        // Setup event listeners
        window.addEventListener('resize', this.onWindowResize);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.gameState.isPaused) {
                    this.handlePause();
                } else {
                    this.handleResume();
                }
                return;
            }
            if (e.code === 'Space' && !this.isSpacePressed && !this.gameState.isPaused) {
                this.isSpacePressed = true;
                this.scanner.scan(this.camera, this.gameState);
            }
            // Add minimap expansion key (M)
            if (e.key.toLowerCase() === 'm' && !this.gameState.isPaused) {
                this.uiManager.toggleMinimapSize();
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.isSpacePressed = false;
            }
        });
        window.addEventListener('mousedown', (e) => {
            // No mouse click resume logic
        });
        
        // Menu flow wiring
        this.menuManager.onStartGame = (level, customization) => {
            this.startGame(level, customization);
        };
        this.menuManager.onPause = () => {
            this.gameState.isPaused = true;
        };
        this.menuManager.onResume = () => {
            this.gameState.isPaused = false;
        };
        this.menuManager.onRestart = () => {
            // Restart level with same customization, clear scanner dots, discovered, and enemies
            const customization = {
                name: this.gameState.playerName,
                skin: this.gameState.playerSkin,
                scannerType: this.gameState.scannerType
            };
            // Remove all objects except camera and controls
            this.clearSceneExceptCamera();
            // Regenerate maze and reset player
            this.startGame(this.gameState.currentLevel, customization);
            // Clear all scanner dots
            if (this.scanner) {
                for (const dot of this.scanner.activeDots) {
                    dot.visible = false;
                }
                this.scanner.activeDots = [];
            }
            // Clear discovered state
            if (this.discovered) {
                for (let x = 0; x < this.discovered.length; x++) {
                    for (let z = 0; z < this.discovered[x].length; z++) {
                        this.discovered[x][z] = false;
                    }
                }
            }
            // Clear all enemies
            if (this.enemyManager && typeof this.enemyManager.clearEnemies === 'function') {
                this.enemyManager.clearEnemies();
            }
            // Update UI and minimap immediately
            this.uiManager.update(this.gameState);
            const mazeLayout = this.mazeGenerator.getMazeLayout();
            if (mazeLayout && this.discovered) {
                const playerMazePos = this.getPlayerMazeCoords();
                let colorStr = '#00ffff';
                if (typeof this.playerColor === 'number') {
                    colorStr = '#' + this.playerColor.toString(16).padStart(6, '0');
                }
                this.uiManager.updateMinimap(mazeLayout, this.discovered, playerMazePos, colorStr);
            }
        };
        
        this.discovered = null; // 2D array for minimap
        
        // Start game loop
        this.animate();
        
        // Set initial theme
        this.currentThemeKey = 'lab';
        this.currentTheme = THEMES[this.currentThemeKey];
        
        // Make game instance globally accessible
        window.game = this;
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Add renderer to DOM
        const container = document.getElementById('game-container');
        if (container) {
            container.appendChild(this.renderer.domElement);
        }

        // Increase sky element size by 4x for better immersion and visual impact
        const skyGeometry = new THREE.SphereGeometry(400, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(sky);
    }
    
    setupLights() {
        // Remove old lights
        this.scene.children = this.scene.children.filter(obj =>
            !(obj.isLight)
        );
        // Ambient light for theme
        const theme = this.currentTheme || THEMES.lab;
        const ambientLight = new THREE.AmbientLight(theme.ambientLight.color, theme.ambientLight.intensity);
        this.scene.add(ambientLight);
        // Add a directional light for better maze visibility
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
        dirLight.position.set(10, 20, 10);
        dirLight.target.position.set(10, 0, 10);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048; 
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.camera.left = -20;
        dirLight.shadow.camera.right = 20;
        dirLight.shadow.camera.top = 20;
        dirLight.shadow.camera.bottom = -20;
        this.scene.add(dirLight);
        this.scene.add(dirLight.target);
        // Fog
        this.scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);
    }
    
    setupControls() {
        this.controls = new PointerLockControls(this.camera, document.body);
        this.scene.add(this.controls.getObject());
        
        // Add click-to-start functionality
        document.addEventListener('click', () => {
            if (this.gameStarted && !this.gameState.isPaused && !document.pointerLockElement) {
                this.controls.lock();
            }
        });

        // Handle pointer lock change
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement) {
                // Pointer is locked, game is active
                this.gameState.isPaused = false;
            } else {
                // Pointer is unlocked, pause the game
                this.gameState.isPaused = true;
            }
        });
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    update(deltaTime) {
        this.gameState.update(deltaTime); // Ensure scanner resource bar refills
        if (!this.gameState.isPaused) {
            this.player.update(deltaTime, this.inputManager);
            this.scanner.update(deltaTime);
            this.enemyManager.update(deltaTime, this.player, this.scanner);
            this.uiManager.update(this.gameState);
            // Update discovered cells based on player scan
            this.updateDiscoveredFromScanner();
        }
        // Always update minimap
        const mazeLayout = this.mazeGenerator.getMazeLayout();
        if (mazeLayout && this.discovered) {
            const playerMazePos = this.getPlayerMazeCoords();
            // Convert playerColor to hex string for minimap
            let colorStr = '#00ffff';
            if (typeof this.playerColor === 'number') {
                colorStr = '#' + this.playerColor.toString(16).padStart(6, '0');
            }
            this.uiManager.updateMinimap(mazeLayout, this.discovered, playerMazePos, colorStr);
        }
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        if (!this.clock) this.clock = new THREE.Clock();
        const deltaTime = this.clock.getDelta();

        // --- Performance metrics ---
        // FPS
        const now = performance.now();
        if (!this._lastFpsTime) this._lastFpsTime = now;
        if (!this._frameCount) this._frameCount = 0;
        this._frameCount++;
        let fps = 0;
        if (now - this._lastFpsTime > 250) { // update every 1/4 second
            fps = (this._frameCount * 1000) / (now - this._lastFpsTime);
            this._lastFpsTime = now;
            this._frameCount = 0;
            this._lastFps = fps;
        } else {
            fps = this._lastFps || 60;
        }
        // Marker count
        const markerCount = this.scanner.activeDots.length;
        // Render time
        const renderStart = performance.now();
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);
        const renderTime = performance.now() - renderStart;
        // Update metrics on gameState
        this.gameState.updateMetrics(fps, markerCount, renderTime);
    }
    
    handlePause() {
        this.gameState.isPaused = true;
        this.menuManager.showMenu(this.menuManager.pauseMenu);
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }
    
    handleResume() {
        this.gameState.isPaused = false;
        this.menuManager.hideMenusCompletely();
        if (!document.pointerLockElement) {
            this.controls.lock();
        }
    }
    
    getThemeForLevel(level) {
        const themes = ['lab', 'crypt', 'forest', 'ice', 'void'];
        return THEMES[themes[level - 1]];
    }
    
    startGame(level, customization) {
        // Clear existing scene
        this.clearSceneExceptCamera();
        
        // Reset game state
        this.gameState.reset();
        this.gameState.currentLevel = level;
        
        // Set game as started
        this.gameStarted = true;
        
        // Set theme based on level
        this.currentTheme = this.getThemeForLevel(level);
        this.gameState.currentTheme = Object.keys(THEMES)[level - 1];
        
        // Apply customization
        if (customization) {
            this.gameState.setPlayerCustomization(
                customization.name,
                customization.skin,
                customization.scannerType
            );
            this.playerColor = this.getColorHexFromSkin(customization.skin);
        }
        
        // Setup lights with new theme
        this.setupLights();
        
        // Generate new maze
        this.mazeGenerator.generateMaze(this.scene, this.currentTheme, level);
        
        // Initialize discovered array with only spawn point visible
        const size = this.mazeGenerator.mazeSize;
        this.discovered = Array(size).fill().map(() => Array(size).fill(false));
        const center = Math.floor(size / 2);
        this.discovered[center][center] = 'spawn';
        
        // Set player position
        const spawnPos = this.mazeGenerator.getPlayerSpawnPosition();
        this.camera.position.copy(spawnPos);
        
        // Reset scanner
        this.scanner.reset();
        
        // Reset enemy manager
        this.enemyManager.clearEnemies();
        
        // Start game loop
        this.gameState.isPaused = false;
        this.animate();
        
        // Start ambient music
        this.soundManager.playMusic('ambient');
        
        // Lock pointer controls
        this.controls.lock();
    }
    
    clearSceneExceptCamera() {
        // Remove all objects except camera and controls
        this.scene.children = this.scene.children.filter(obj =>
            obj === this.camera || obj === this.controls.getObject()
        );
    }
    
    updateDiscoveredFromScanner() {
        if (!this.scanner || !this.discovered) return;
        const mazeLayout = this.mazeGenerator.getMazeLayout();
        if (!mazeLayout) return;

        // Get player position and rotation
        const playerPos = this.getPlayerMazeCoords();
        const playerRotation = this.camera.rotation.y;
        
        // Adjust raycasting logic to ensure hallways are only revealed if visible and not blocked by walls
        const rayCount = 180; // Rays in the forward-facing half-circle
        const maxDistance = 15; // View distance

        for (let i = 0; i < rayCount; i++) {
            const angle = playerRotation - Math.PI / 2 + (Math.PI * i) / rayCount; // Forward-facing half-circle
            const rayDirX = Math.cos(angle);
            const rayDirZ = Math.sin(angle);

            let x = playerPos.x;
            let z = playerPos.z;
            let distance = 0;
            let hitWall = false;

            while (distance < maxDistance && !hitWall) {
                const cellX = Math.floor(x);
                const cellZ = Math.floor(z);

                // Check if we're still in bounds
                if (cellX < 0 || cellX >= mazeLayout.length || 
                    cellZ < 0 || cellZ >= mazeLayout.length) break;

                // Only mark cell as discovered if it's a path and visible (not blocked by walls)
                if (mazeLayout[cellX][cellZ] === 0 && this.discovered[cellX][cellZ] !== true) {
                    this.discovered[cellX][cellZ] = true;
                }

                // Stop ray if it hits a wall
                if (mazeLayout[cellX][cellZ] === 1) {
                    hitWall = true;
                }

                // Move along ray
                x += rayDirX * 0.1;
                z += rayDirZ * 0.1;
                distance += 0.1;
            }
        }

        // Also mark cells based on scanner dots
        for (const dot of this.scanner.activeDots) {
            const x = Math.floor(dot.position.x);
            const z = Math.floor(dot.position.z);
            if (mazeLayout[x] && mazeLayout[x][z] !== undefined && mazeLayout[x][z] === 0) {
                this.discovered[x][z] = true;
            }
        }
    }
    
    getPlayerMazeCoords() {
        // Convert player position to maze grid coordinates with perfect alignment
        const pos = this.camera.position;
        return {
            x: Math.floor(pos.x + 0.5), // Add 0.5 to ensure perfect grid alignment
            z: Math.floor(pos.z + 0.5)
        };
    }
    
    getColorHexFromSkin(skin) {
        switch (skin) {
            case 'cyan': return 0x00ffff;
            case 'magenta': return 0xff00ff;
            case 'yellow': return 0xffff00;
            case 'green': return 0x00ff00;
            default: return 0x00ffff;
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
});