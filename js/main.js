import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Monster } from './monster.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: false, // Disabled for better performance
            powerPreference: "high-performance",
            stencil: false,
            depth: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio for performance
        this.renderer.shadowMap.enabled = false; // Disabled shadows for better performance
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        document.body.appendChild(this.renderer.domElement);

        // Performance monitoring
        this.stats = {
            fps: 0,
            frameCount: 0,
            lastTime: performance.now(),
            markerCount: 0,
            triangleCount: 0
        };

        // Game state
        this.ammo = 100;
        this.maxAmmo = 100;
        this.health = 100;
        this.maxHealth = 100;
        this.glowMarkers = [];
        this.monsters = [];
        this.scanAngle = 0;
        this.scanSpeed = 0.1;
        this.controls = new PointerLockControls(this.camera, document.body);
        this.isGameStarted = false;
        this.gameStartTime = performance.now();
        this.monstersKilled = 0;
        this.shotsFired = 0;
        this.score = 0;
        
        // Maze configuration for proper centering
        this.mazeSize = 20;
        this.mazeCenterX = 0;
        this.mazeCenterZ = 0;
        
        // Scanning system
        this.isScanning = false;
        this.scanLinePosition = 0;
        this.scanSpeed = 0.15; // Faster scanning
        this.lastScanTime = performance.now();
        this.scanCooldown = 0.3; // Cooldown between scans
        this.lastShotTime = 0;
        
        // Optimized scan area configuration
        this.scanWidth = 0.4;
        this.scanHeight = 0.4;
        this.scanResolution = 200; // Reduced for better performance
        
        // Object pooling for better performance
        this.dotPool = [];
        this.maxDots = 500; // Limit total dots
        this.dotLifetime = 30000; // 30 seconds
        this.initDotPool();
        
        // Create scan line with better visibility
        const scanLineGeometry = new THREE.BufferGeometry();
        const scanLineVertices = new Float32Array([
            -1, 0, 0,
            1, 0, 0
        ]);
        scanLineGeometry.setAttribute('position', new THREE.BufferAttribute(scanLineVertices, 3));
        this.scanLine = new THREE.Line(
            scanLineGeometry,
            new THREE.LineBasicMaterial({ 
                color: 0x00ffff, 
                opacity: 0.8, 
                transparent: true,
                linewidth: 3
            })
        );
        this.scanLine.scale.x = this.scanWidth;
        this.scanLine.visible = false;
        this.scene.add(this.scanLine);
        
        // Setup optimized lighting
        this.ambientLight = new THREE.AmbientLight(0x0a0a0a, 0.1);
        this.scene.add(this.ambientLight);

        // Setup maze
        this.createOptimizedMaze();
        
        // Setup player at exact center of maze
        this.spawnPlayerInCenter();
        
        // Spawn initial monsters at safe distance
        this.spawnMonstersAtDistance(4, 8); // 4 monsters, minimum 8 units away
        
        // Event listeners
        document.getElementById('start-button').addEventListener('click', () => this.startGame());
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Movement state
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isSprinting = false;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.prevTime = performance.now();
        
        // Add movement controls
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Performance optimization: Reduce update frequency for non-critical systems
        this.slowUpdateInterval = 100; // Update every 100ms
        this.lastSlowUpdate = 0;
        
        // Start game loop
        this.animate();
    }

    initDotPool() {
        this.dotGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([0, 0, 0]);
        this.dotGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        // Create multiple materials for different dot types
        this.dotMaterials = {
            wall: new THREE.PointsMaterial({ 
                color: 0x00ff88,
                size: 0.15,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.8
            }),
            floor: new THREE.PointsMaterial({ 
                color: 0x0088ff,
                size: 0.1,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.6
            }),
            ceiling: new THREE.PointsMaterial({ 
                color: 0xff8800,
                size: 0.12,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.7
            })
        };
        
        // Pre-create dot pool
        for (let i = 0; i < this.maxDots; i++) {
            const dot = new THREE.Points(this.dotGeometry, this.dotMaterials.wall);
            dot.visible = false;
            dot.userData = { inUse: false, birthTime: 0, type: 'wall' };
            this.scene.add(dot);
            this.dotPool.push(dot);
        }
    }

    getDotFromPool(type = 'wall') {
        const dot = this.dotPool.find(d => !d.userData.inUse);
        if (dot) {
            dot.userData.inUse = true;
            dot.userData.birthTime = performance.now();
            dot.userData.type = type;
            dot.material = this.dotMaterials[type];
            dot.visible = true;
            return dot;
        }
        
        // If pool is full, reuse oldest dot
        let oldest = this.dotPool[0];
        for (const d of this.dotPool) {
            if (d.userData.inUse && d.userData.birthTime < oldest.userData.birthTime) {
                oldest = d;
            }
        }
        
        oldest.userData.inUse = true;
        oldest.userData.birthTime = performance.now();
        oldest.userData.type = type;
        oldest.material = this.dotMaterials[type];
        oldest.visible = true;
        return oldest;
    }

    returnDotToPool(dot) {
        dot.visible = false;
        dot.userData.inUse = false;
        
        // Remove from glowMarkers array if present
        const index = this.glowMarkers.findIndex(marker => marker.mesh === dot);
        if (index !== -1) {
            this.glowMarkers.splice(index, 1);
        }
    }

    spawnPlayerInCenter() {
        // Calculate exact center of the maze
        const centerX = this.mazeCenterX;
        const centerZ = this.mazeCenterZ;
        const playerHeight = 1.6;
        
        // Set player position at exact center
        this.camera.position.set(centerX, playerHeight, centerZ);
        
        // Add a small light around the player for better visibility
        this.playerLight = new THREE.PointLight(0x444444, 0.3, 3);
        this.playerLight.position.copy(this.camera.position);
        this.scene.add(this.playerLight);
    }

    createOptimizedMaze() {
        // Use instanced rendering for better performance
        const wallGeometry = new THREE.BoxGeometry(1, 2, 1);
        const wallMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x606060,
            transparent: false
        });
        
        // Create floor with better performance
        const floorGeometry = new THREE.PlaneGeometry(this.mazeSize, this.mazeSize);
        const floorMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x2a2a2a,
            transparent: false
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(this.mazeCenterX, -1, this.mazeCenterZ);
        this.scene.add(floor);
        
        // Create ceiling
        const ceilingGeometry = new THREE.PlaneGeometry(this.mazeSize, this.mazeSize);
        const ceilingMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x1a1a1a,
            transparent: false
        });
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(this.mazeCenterX, 3, this.mazeCenterZ);
        this.scene.add(ceiling);
        
        // Create walls more efficiently
        this.walls = [];
        const halfSize = this.mazeSize / 2;
        
        // Outer walls
        for (let i = 0; i < this.mazeSize; i++) {
            const positions = [
                [i - halfSize, 1, -halfSize], // North
                [i - halfSize, 1, halfSize],  // South
                [-halfSize, 1, i - halfSize], // West
                [halfSize, 1, i - halfSize]   // East
            ];
            
            positions.forEach(pos => {
                const wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(pos[0], pos[1], pos[2]);
                this.scene.add(wall);
                this.walls.push(wall);
            });
        }
        
        // Create inner walls with better distribution and ensure center is clear
        const innerWallCount = 15;
        for (let i = 0; i < innerWallCount; i++) {
            let position;
            let attempts = 0;
            do {
                position = [
                    Math.floor(Math.random() * (this.mazeSize - 4)) - halfSize + 2,
                    1,
                    Math.floor(Math.random() * (this.mazeSize - 4)) - halfSize + 2
                ];
                attempts++;
            } while (
                (Math.abs(position[0]) < 3 && Math.abs(position[2]) < 3) && // Keep center clear
                attempts < 10
            );
            
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(position[0], position[1], position[2]);
            this.scene.add(wall);
            this.walls.push(wall);
        }
    }

    spawnMonstersAtDistance(count, minDistance) {
        const playerPos = this.camera.position;
        
        for (let i = 0; i < count; i++) {
            let position;
            let attempts = 0;
            do {
                const angle = Math.random() * Math.PI * 2;
                const distance = minDistance + Math.random() * 5;
                position = new THREE.Vector3(
                    playerPos.x + Math.cos(angle) * distance,
                    0,
                    playerPos.z + Math.sin(angle) * distance
                );
                attempts++;
            } while (
                this.checkWallCollision(position) && attempts < 20
            );
            
            this.monsters.push(new Monster(this.scene, position));
        }
    }

    checkWallCollision(position) {
        for (const wall of this.walls) {
            const distance = position.distanceTo(wall.position);
            if (distance < 1.5) {
                return true;
            }
        }
        return false;
    }

    startGame() {
        this.isGameStarted = true;
        document.getElementById('start-screen').style.display = 'none';
        this.controls.lock();
        this.gameStartTime = performance.now();
    }

    onKeyDown(event) {
        if (!this.isGameStarted) return;
        
        switch (event.code) {
            case 'KeyW': this.moveForward = true; break;
            case 'KeyS': this.moveBackward = true; break;
            case 'KeyA': this.moveLeft = true; break;
            case 'KeyD': this.moveRight = true; break;
            case 'ShiftLeft': this.isSprinting = true; break;
            case 'Space': 
                event.preventDefault();
                this.shootGlowMarker(); 
                break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': this.moveForward = false; break;
            case 'KeyS': this.moveBackward = false; break;
            case 'KeyA': this.moveLeft = false; break;
            case 'KeyD': this.moveRight = false; break;
            case 'ShiftLeft': this.isSprinting = false; break;
        }
    }

    handleKeyDown(event) {
        if (event.code === 'Escape') {
            if (this.controls.isLocked) {
                this.controls.unlock();
            }
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    shootGlowMarker() {
        const now = performance.now();
        if (this.ammo <= 0 || !this.isGameStarted || this.health <= 0 || 
            now - this.lastShotTime < this.scanCooldown * 1000) return;
        
        this.lastShotTime = now;
        this.shotsFired++;
        
        // Reset scan
        this.scanLinePosition = this.scanHeight;
        this.lastScanTime = now;
        this.isScanning = true;
        
        // Update ammo with better regeneration
        this.ammo = Math.max(0, this.ammo - 8);
        this.updateUI();
    }

    updateScanning() {
        if (!this.isScanning) return;

        const now = performance.now();
        const deltaTime = (now - this.lastScanTime) / 1000;
        this.lastScanTime = now;

        // Faster, smoother scan line movement
        const targetPosition = -this.scanHeight;
        this.scanLinePosition = THREE.MathUtils.lerp(this.scanLinePosition, targetPosition, 0.2);

        // Update scan line visualization
        this.scanLine.position.copy(this.camera.position);
        this.scanLine.rotation.copy(this.camera.rotation);
        this.scanLine.translateZ(-1.5);
        this.scanLine.translateY(this.scanLinePosition);
        this.scanLine.visible = true;

        // Perform optimized scan
        if (Math.abs(this.scanLinePosition - targetPosition) > 0.02) {
            this.performOptimizedScan();
        } else {
            this.isScanning = false;
            this.scanLine.visible = false;
        }
    }

    performOptimizedScan() {
        const raycaster = new THREE.Raycaster();
        
        // Reduce scan points for better performance
        for (let i = 0; i < this.scanResolution; i++) {
            const x = (Math.random() * 2 - 1) * this.scanWidth;
            const y = this.scanLinePosition;
            
            raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
            
            // Only check walls and important objects
            const intersects = raycaster.intersectObjects(this.walls.concat(
                this.monsters.map(m => m.mesh)
            ));
            
            if (intersects.length > 0) {
                const hitPoint = intersects[0].point;
                const hitObject = intersects[0].object;
                
                // Check if we hit a monster
                const monster = this.monsters.find(m => m.mesh === hitObject);
                if (monster) {
                    monster.takeDamage(15);
                    this.score += 10;
                    
                    // Knockback effect
                    const knockbackDir = hitPoint.clone().sub(this.camera.position).normalize();
                    monster.position.add(knockbackDir.multiplyScalar(1.0));
                    continue;
                }
                
                // Create wall marker
                const dot = this.getDotFromPool('wall');
                if (dot) {
                    dot.position.copy(hitPoint);
                    
                    // Better size calculation
                    const distance = hitPoint.distanceTo(this.camera.position);
                    const size = Math.max(0.1, Math.min(0.3, 0.2 * (1 - distance / 15)));
                    dot.scale.setScalar(size);
                    
                    this.glowMarkers.push({
                        mesh: dot,
                        creationTime: performance.now()
                    });
                }
            }
        }
    }

    updateUI() {
        // Update basic UI elements
        document.getElementById('ammo-counter').textContent = `Scanner Energy: ${Math.floor(this.ammo)}%`;
        document.getElementById('health-fill').style.width = `${this.health}%`;
        
        // Update performance stats
        if (document.getElementById('fps-counter')) {
            document.getElementById('fps-counter').textContent = this.stats.fps;
        }
        if (document.getElementById('score-counter')) {
            document.getElementById('score-counter').textContent = this.score;
        }
        if (document.getElementById('monster-counter')) {
            document.getElementById('monster-counter').textContent = this.monsters.length;
        }
        if (document.getElementById('marker-count')) {
            document.getElementById('marker-count').textContent = this.glowMarkers.length;
        }
        
        // Update scan indicator
        const scanIndicator = document.getElementById('scan-indicator');
        if (scanIndicator) {
            if (this.isScanning) {
                scanIndicator.classList.add('active');
            } else {
                scanIndicator.classList.remove('active');
            }
        }
        
        // Update compass needle (points to a random direction for now, could point to exit)
        const compassNeedle = document.getElementById('compass-needle');
        if (compassNeedle) {
            const angle = Math.sin(performance.now() * 0.001) * 45; // Subtle movement
            compassNeedle.style.transform = `translate(-50%, -100%) rotate(${angle}deg)`;
        }
        
        // Update status indicators based on game state
        const statusDots = document.querySelectorAll('.status-dot');
        if (statusDots.length >= 2) {
            // Scanner status
            if (this.ammo > 50) {
                statusDots[0].className = 'status-dot status-green';
            } else if (this.ammo > 20) {
                statusDots[0].className = 'status-dot status-yellow';
            } else {
                statusDots[0].className = 'status-dot status-red';
            }
            
            // Monster proximity status
            const playerPos = this.camera.position;
            let closestDistance = Infinity;
            for (const monster of this.monsters) {
                const distance = monster.position.distanceTo(playerPos);
                if (distance < closestDistance) {
                    closestDistance = distance;
                }
            }
            
            if (closestDistance > 10) {
                statusDots[1].className = 'status-dot status-green';
            } else if (closestDistance > 5) {
                statusDots[1].className = 'status-dot status-yellow';
            } else {
                statusDots[1].className = 'status-dot status-red';
            }
        }
    }

    updatePerformanceStats() {
        this.stats.frameCount++;
        const now = performance.now();
        
        if (now - this.stats.lastTime >= 1000) {
            this.stats.fps = Math.round(this.stats.frameCount * 1000 / (now - this.stats.lastTime));
            this.stats.frameCount = 0;
            this.stats.lastTime = now;
            this.stats.markerCount = this.glowMarkers.length;
        }
    }

    cleanupOldMarkers() {
        const now = performance.now();
        for (let i = this.glowMarkers.length - 1; i >= 0; i--) {
            const marker = this.glowMarkers[i];
            if (now - marker.creationTime > this.dotLifetime) {
                this.returnDotToPool(marker.mesh);
                this.glowMarkers.splice(i, 1);
            }
        }
    }

    checkMonsterCollisions() {
        const playerPos = this.camera.position;
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const monster = this.monsters[i];
            const distance = monster.position.distanceTo(playerPos);
            
            if (distance < 1.2) {
                this.health = Math.max(0, this.health - 2);
                this.updateUI();
                
                if (this.health <= 0) {
                    this.showDeathScreen();
                    return;
                }
            }
            
            // Remove dead monsters
            if (monster.health <= 0) {
                monster.die();
                this.monsters.splice(i, 1);
                this.monstersKilled++;
                this.score += 100;
                
                // Spawn new monster if fewer than 3 remain
                if (this.monsters.length < 3) {
                    this.spawnMonstersAtDistance(1, 10);
                }
            }
        }
    }

    updateMovement() {
        if (!this.isGameStarted || this.health <= 0) return;

        const time = performance.now();
        const delta = (time - this.prevTime) / 1000;

        let moveSpeed = 15.0;
        if (this.isSprinting && this.ammo > 10) {
            moveSpeed = 25.0;
            this.ammo -= 5 * delta; // Sprint costs energy
        }

        if (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight) {
            const moveX = (Number(this.moveRight) - Number(this.moveLeft)) * moveSpeed * delta;
            const moveZ = (Number(this.moveForward) - Number(this.moveBackward)) * moveSpeed * delta;

            // Simple collision detection
            const nextPosition = this.camera.position.clone();
            nextPosition.x += moveX;
            nextPosition.z += moveZ;

            if (!this.checkWallCollision(nextPosition)) {
                this.controls.moveRight(moveX);
                this.controls.moveForward(moveZ);
                
                // Update player light position
                if (this.playerLight) {
                    this.playerLight.position.copy(this.camera.position);
                }
            }
        }

        this.prevTime = time;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updatePerformanceStats();
        
        if (this.controls.isLocked && this.isGameStarted && this.health > 0) {
            this.updateMovement();
            
            if (this.isScanning) {
                this.updateScanning();
            }
            
            // Slower updates for performance
            const now = performance.now();
            if (now - this.lastSlowUpdate > this.slowUpdateInterval) {
                // Regenerate ammo faster
                this.ammo = Math.min(this.maxAmmo, this.ammo + 1.5);
                
                // Update monsters less frequently
                for (const monster of this.monsters) {
                    monster.update(this.camera.position, this.glowMarkers);
                }
                
                this.checkMonsterCollisions();
                this.cleanupOldMarkers();
                this.lastSlowUpdate = now;
            }
            
            this.updateUI();
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    showDeathScreen() {
        const deathScreen = document.createElement('div');
        deathScreen.id = 'death-screen';
        deathScreen.innerHTML = `
            <div class="death-content">
                <h2>Mission Failed</h2>
                <p>Time Survived: <span class="stat-highlight">${Math.floor((performance.now() - this.gameStartTime) / 1000)}</span> seconds</p>
                <p>Monsters Eliminated: <span class="stat-highlight">${this.monstersKilled}</span></p>
                <p>Shots Fired: <span class="stat-highlight">${this.shotsFired}</span></p>
                <p>Final Score: <span class="stat-highlight">${this.score}</span></p>
                <button id="restart-button">Restart Mission</button>
            </div>
        `;
        document.body.appendChild(deathScreen);

        document.getElementById('restart-button').addEventListener('click', () => {
            this.restartGame();
        });
    }

    restartGame() {
        // Remove death screen
        const deathScreen = document.getElementById('death-screen');
        if (deathScreen) {
            document.body.removeChild(deathScreen);
        }

        // Reset game state
        this.health = 100;
        this.ammo = 100;
        this.score = 0;
        this.monstersKilled = 0;
        this.shotsFired = 0;
        this.gameStartTime = performance.now();

        // Clear existing monsters
        for (const monster of this.monsters) {
            monster.die();
        }
        this.monsters = [];
        
        // Reset all dots in pool
        this.dotPool.forEach(dot => {
            this.returnDotToPool(dot);
        });
        this.glowMarkers = [];
        
        // Reset scan line
        this.scanLine.visible = false;
        this.isScanning = false;
        
        // Reset player position to center
        this.spawnPlayerInCenter();
        
        // Spawn new monsters at safe distance
        this.spawnMonstersAtDistance(4, 8);
        
        // Update UI
        this.updateUI();
        
        // Lock controls and start game
        this.isGameStarted = true;
        this.controls.lock();
    }
}

// Start the game
const game = new Game();

