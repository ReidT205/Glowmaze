import * as THREE from 'three';

export class Scanner {
    constructor(scene, getPlayerColor, camera, initialType = 'standard') {
        this.scene = scene;
        this.getPlayerColor = getPlayerColor; // function to get current player color
        this.camera = camera;
        
        // --- Scanner type definitions ---
        this.scannerTypes = {
            focused: {
                scanPoints: 40,
                scanWidth: 2.5,
                scanHeight: 1.2,
                scanCost: 7,
                scanCooldown: 0.3
            },
            standard: {
                scanPoints: 75,
                scanWidth: 6,
                scanHeight: 2.5,
                scanCost: 10,
                scanCooldown: 0.5
            },
            wide: {
                scanPoints: 120,
                scanWidth: 12,
                scanHeight: 4.5,
                scanCost: 18,
                scanCooldown: 0.7
            }
        };
        this.scannerTypeOrder = ['focused', 'standard', 'wide'];
        this.currentScannerType = initialType;
        this.applyScannerType(initialType);
        
        // Game-appropriate parameters
        this.maxDots = 100000;    // 4x larger pool for many scans
        this.dotLifetime = Infinity; // Never despawn
        this.lastScanTime = 0;
        
        // Create a dedicated group for dots that will be added to the scene
        this.dotsGroup = new THREE.Group();
        this.scene.add(this.dotsGroup);
        
        // Initialize dot pool and active dots array
        this.dotPool = [];
        this.activeDots = [];
        this.dotGeometry = new THREE.SphereGeometry(0.008, 12, 12); // 4x smaller dot
        this.dotMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            depthTest: true, // Enable depth test so dots are hidden by walls
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        // Pre-populate dot pool
        for (let i = 0; i < this.maxDots; i++) {
            const dot = new THREE.Mesh(this.dotGeometry, this.dotMaterial.clone());
            dot.visible = false;
            dot.userData.lifetime = 0;
            this.dotPool.push(dot);
        }
        
        // Create and setup scan line
        this.scanLine = this.createScanLine();
        this.scene.add(this.scanLine);
        this.isScanning = false;
        this.scanProgress = 0;
        this.pendingDots = [];
    }
    
    createScanLine() {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7
        });
        
        const line = new THREE.Line(geometry, material);
        line.visible = false;
        return line;
    }

    applyScannerType(type) {
        const t = this.scannerTypes[type] || this.scannerTypes['standard'];
        this.scanPoints = t.scanPoints;
        this.scanWidth = t.scanWidth;
        this.scanHeight = t.scanHeight;
        this.scanCost = t.scanCost;
        this.scanCooldown = t.scanCooldown;
        this.currentScannerType = type;
    }

    cycleScannerType(gameState) {
        // Deduct energy for switching (e.g., 15 units)
        const switchCost = 15;
        if (gameState.playerEnergy < switchCost) return false;
        if (!gameState.useEnergy(switchCost)) return false;
        const idx = this.scannerTypeOrder.indexOf(this.currentScannerType);
        const nextIdx = (idx + 1) % this.scannerTypeOrder.length;
        const nextType = this.scannerTypeOrder[nextIdx];
        this.applyScannerType(nextType);
        // Optionally play a sound here
        return true;
    }

    getCurrentScannerType() {
        return this.currentScannerType;
    }
    
    scan(camera, gameState) {
        // Guard: only scan if maze and enemyManager are ready
        if (!window.game || !window.game.enemyManager || !window.game.mazeGenerator || !window.game.mazeGenerator.layout) return;
        const now = performance.now() / 1000;
        if (now - this.lastScanTime < this.scanCooldown) return;
        if (gameState.playerEnergy < this.scanCost) return;
        // Use energy
        if (!gameState.useEnergy(this.scanCost)) return;
        this.lastScanTime = now;
        // Play scanner sound
        if (window.game.soundManager) {
            window.game.soundManager.playScannerSound();
        }
        // Create scan line
        this.createScanLine();
        // --- New: Damage enemies based on dot hits ---
        const enemies = window.game.enemyManager.getEnemies();
        const enemyHits = new Map(); // enemy -> hit count
        // Find all maze geometry (walls, floor, ceiling)
        const mazeObjects = this.scene.children.filter(obj =>
            obj.userData.type === 'wall' || obj.userData.type === 'floor' || obj.userData.type === 'ceiling'
        );
        if (mazeObjects.length === 0) return;
        // Generate random scan points in a cone in front of the camera
        this.pendingDots = [];
        const scanWidth = this.scanWidth;
        const scanHeight = this.scanHeight;
        for (let i = 0; i < this.scanPoints; i++) {
            // Random point in a cone
            const angle = (Math.random() - 0.5) * Math.PI / 3;
            const y = (Math.random() - 0.5) * scanHeight;
            const x = Math.sin(angle) * scanWidth * (Math.random());
            const z = -Math.cos(angle) * (2 + Math.random() * 8);
            const dir = new THREE.Vector3(x, y, z).applyQuaternion(camera.quaternion).normalize();
            const raycaster = new THREE.Raycaster(camera.position, dir, 0.5, 30);
            const mazeHits = raycaster.intersectObjects(mazeObjects, false);
            if (mazeHits.length > 0) {
                const hit = mazeHits[0];
                // Allow dots on floor (normal.y < -0.7), ceiling (normal.y > 0.7), and walls
                this.pendingDots.push({
                    position: hit.point.clone(),
                    normal: hit.face.normal.clone(),
                    y: hit.point.y
                });
                // Check for enemy hit at this dot position
                for (const enemy of enemies) {
                    if (!enemy.mesh || !enemy.position || enemy.properties.health <= 0) continue;
                    // Use a hit radius (0.4)
                    if (hit.point.distanceTo(enemy.position) < 0.4) {
                        enemyHits.set(enemy, (enemyHits.get(enemy) || 0) + 1);
                    }
                }
            }
        }
        // Start scan animation instantly
        this.isScanning = true;
        this.scanProgress = 2.5 / 2; // Instantly at end
        this.scanLine.visible = false;
        // Place all dots immediately
        for (let i = this.pendingDots.length - 1; i >= 0; i--) {
            this.placeDot(this.pendingDots[i].position, this.pendingDots[i].normal);
            this.pendingDots.splice(i, 1);
        }
        // Apply damage to enemies proportional to hits
        let anyHit = false;
        for (const [enemy, hits] of enemyHits.entries()) {
            if (hits > 0) {
                anyHit = true;
                // Each dot does 1 damage
                window.game.enemyManager.damageEnemy(enemy, hits);
            }
        }
        if (anyHit && window.game.soundManager) {
            window.game.soundManager.playMonsterDetectSound();
        }
    }
    
    placeDot(position, normal) {
        // Get dot from pool only (never recycle old dots)
        let dot = this.dotPool.find(d => !d.visible);
        if (!dot) {
            // Pool exhausted: do nothing (no recycling)
            return;
        }
        // Offset dot from surface to avoid z-fighting
        const offset = normal.clone().multiplyScalar(0.01); // Tiny offset
        dot.position.copy(position).add(offset);
        dot.lookAt(position.clone().add(normal));
        // Use player color
        dot.material.color.set(this.getPlayerColor());
        dot.material.opacity = 0.95;
        dot.visible = true;
        dot.userData.lifetime = 0;
        if (!this.scene.children.includes(dot)) {
            this.scene.add(dot); // Add directly to scene for 3D visibility
        }
        this.activeDots.push(dot);
    }
    
    update(deltaTime) {
        // Frustum culling: only show dots in camera view
        const frustum = new THREE.Frustum();
        const camViewProj = new THREE.Matrix4();
        this.camera.updateMatrixWorld();
        this.camera.updateProjectionMatrix();
        camViewProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(camViewProj);
        for (let i = 0; i < this.activeDots.length; i++) {
            const dot = this.activeDots[i];
            dot.visible = frustum.containsPoint(dot.position);
        }
        // Dots never despawn
    }
    
    determineSurface(normal) {
        const up = new THREE.Vector3(0, 1, 0);
        const dot = normal.dot(up);
        
        if (Math.abs(dot) > 0.9) {
            return dot > 0 ? 'ceiling' : 'floor';
        }
        return 'wall';
    }
    
    getColorForSurface(surface) {
        return this.colors[surface] || this.colors.wall;
    }
    
    getDotFromPool() {
        for (const dot of this.dotPool) {
            if (!dot.visible) {
                return dot;
            }
        }
        return null;
    }
    
    recycleDot(dot) {
        dot.visible = false;
        dot.material.opacity = 1.0;
    }
    
    updateScanLine() {
        const positions = new Float32Array(6);
        const scanHeight = 2.5;
        const y = this.scanProgress;
        positions[0] = -3; positions[1] = y; positions[2] = -2;
        positions[3] = 3; positions[4] = y; positions[5] = -2;
        
        this.scanLine.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );
        this.scanLine.geometry.attributes.position.needsUpdate = true;
    }
    
    getActiveDotCount() {
        return this.activeDots.length;
    }

    reset() {
        // Properly clear all scanner state
        this.pendingDots = [];
        this.activeDots = [];
        this.dotPool.forEach(dot => { dot.visible = false; });
        this.lastScanTime = 0;
        this.scanLine.visible = false;
        this.isScanning = false;
        this.scanProgress = 0;
    }
} 