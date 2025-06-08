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

class Game {
    constructor() {
        this.gameState = new GameState();
        this.setupScene();
        this.setupLights();
        this.setupControls();
        
        // Initialize managers
        this.inputManager = new InputManager();
        this.mazeGenerator = new MazeGenerator();
        this.player = new Player(this.scene, this.camera);
        this.scanner = new Scanner(this.scene);
        this.enemyManager = new EnemyManager(this.scene);
        this.uiManager = new UIManager();
        this.menuManager = new MenuManager();
        this.soundManager = new SoundManager();
        
        // Bind methods
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        
        // Setup event listeners
        window.addEventListener('resize', this.onWindowResize);
        
        // Start game loop
        this.animate();
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);
        document.getElementById('game-container').appendChild(this.renderer.domElement);
    }
    
    setupLights() {
        // Ambient light for minimal visibility
        const ambientLight = new THREE.AmbientLight(0x111111);
        this.scene.add(ambientLight);
    }
    
    setupControls() {
        this.controls = new PointerLockControls(this.camera, document.body);
        this.scene.add(this.controls.getObject());
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    update(deltaTime) {
        if (!this.gameState.isPaused) {
            this.player.update(deltaTime, this.inputManager);
            this.scanner.update(deltaTime);
            this.enemyManager.update(deltaTime, this.player, this.scanner);
            this.uiManager.update(this.gameState);
        }
    }
    
    animate() {
        requestAnimationFrame(this.animate);
        
        const deltaTime = this.clock ? this.clock.getDelta() : 0;
        if (!this.clock) this.clock = new THREE.Clock();
        
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
}); 