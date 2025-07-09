import * as THREE from 'three';
import { AStarPathfinding } from './Pathfinding';

// Enemy states
const EnemyState = {
    IDLE: 'idle',
    PATROL: 'patrol',
    CHASE: 'chase',
    ATTACK: 'attack',
    HIDE: 'hide',
    FLOCK: 'flock'
};

export class Enemy {
    constructor(scene, position, properties = {}) {
        this.scene = scene;
        this.position = position;
        this.type = 'BasicStalker'; // Default type
        this.properties = {
            health: properties.health || 100,
            maxHealth: properties.health || 100,
            detectionRange: properties.detectionRange || 5,
            movementSpeed: properties.movementSpeed || 0.02,
            damage: properties.damage || 1,
            usePathfinding: properties.usePathfinding || false,
            reactsToSound: properties.reactsToSound || false,
            lightSensitive: properties.lightSensitive || true,
            ...properties
        };

        // State machine
        this.state = EnemyState.IDLE;
        this.stateTimer = 0;
        this.targetPosition = null;
        this.path = [];
        this.currentPathIndex = 0;

        // Movement smoothing
        this.velocity = new THREE.Vector3();
        this.targetRotation = 0;
        this.rotationSpeed = 5;

        // Mesh/collider size defaults (override in subclasses)
        this.meshSize = { width: 0.5, height: 1, depth: 0.5 };
        this.meshYOffset = 0.5;

        // Create mesh and collider
        this.createMesh();
        this.createCollider();
        this.lastPathUpdateTime = 0; // For pathfinding cooldown
        this.pathfindingCooldown = 1.0; // seconds (increased from 0.5)
        this.lastKnownPlayerPos = null;
        this.lastRaycastTime = 0; // For raycast cooldown
        this.raycastCooldown = 0.25; // seconds
        this.cachedCanSeePlayer = false;
        this.attackCooldown = 0.7; // seconds between attacks
        this.lastAttackTime = 0;
    }

    createMesh() {
        // Base enemy mesh (to be overridden by specific enemy types)
        const geometry = new THREE.BoxGeometry(this.meshSize.width, this.meshSize.height, this.meshSize.depth);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.meshYOffset;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
        // Create health bar
        this.createHealthBar();
    }

    createCollider() {
        // Collider matches mesh size and position
        this.collider = new THREE.Box3();
        this.updateCollider();
    }

    updateCollider() {
        // Centered on this.position, with mesh size
        const min = new THREE.Vector3(
            this.position.x - this.meshSize.width / 2,
            this.position.y,
            this.position.z - this.meshSize.depth / 2
        );
        const max = new THREE.Vector3(
            this.position.x + this.meshSize.width / 2,
            this.position.y + this.meshSize.height,
            this.position.z + this.meshSize.depth / 2
        );
        this.collider.min.copy(min);
        this.collider.max.copy(max);
    }

    createHealthBar() {
        // Health bar is a thin box above the enemy
        const barGeometry = new THREE.PlaneGeometry(0.7, 0.1);
        this.healthBarMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
        this.healthBar = new THREE.Mesh(barGeometry, this.healthBarMaterial);
        this.healthBar.position.set(0, 0.8, 0); // Above the head
        this.healthBar.renderOrder = 999;
        this.healthBar.frustumCulled = false;
        this.mesh.add(this.healthBar);
        // Add health text (using a canvas texture)
        this.healthTextCanvas = document.createElement('canvas');
        this.healthTextCanvas.width = 128;
        this.healthTextCanvas.height = 32;
        this.healthTextContext = this.healthTextCanvas.getContext('2d');
        this.healthTextTexture = new THREE.CanvasTexture(this.healthTextCanvas);
        this.healthTextMaterial = new THREE.SpriteMaterial({ map: this.healthTextTexture, transparent: true });
        this.healthTextSprite = new THREE.Sprite(this.healthTextMaterial);
        this.healthTextSprite.scale.set(0.7, 0.18, 1);
        this.healthTextSprite.position.set(0, 1.0, 0); // Above the health bar
        this.mesh.add(this.healthTextSprite);
        this.updateHealthText();
    }

    update(deltaTime, playerPosition, scanner, mazeLayout) {
        // Update state timer
        this.stateTimer += deltaTime;
        // Store time for cooldowns
        this._now = performance.now() / 1000;

        // Clamp position to valid numbers (avoid NaN bugs)
        if (isNaN(this.position.x) || isNaN(this.position.z)) {
            this.position.x = 0;
            this.position.z = 0;
        }

        // Check if enemy is illuminated by scanner
        const isIlluminated = this.checkIllumination(scanner);

        // Update state based on conditions
        this.updateState(playerPosition, isIlluminated);

        // Execute current state behavior
        switch (this.state) {
            case EnemyState.IDLE:
                this.updateIdle(deltaTime);
                break;
            case EnemyState.PATROL:
                this.updatePatrol(deltaTime, mazeLayout);
                break;
            case EnemyState.CHASE:
                this.updateChase(deltaTime, playerPosition, mazeLayout);
                break;
            case EnemyState.ATTACK:
                this.updateAttack(deltaTime, playerPosition);
                break;
            case EnemyState.HIDE:
                this.updateHide(deltaTime, playerPosition, mazeLayout);
                break;
            case EnemyState.FLOCK:
                this.updateFlock(deltaTime, playerPosition, mazeLayout);
                break;
        }

        // Update mesh position and rotation
        this.updateMesh(deltaTime);
        // Update health bar
        this.updateHealthBar();
    }

    updateMesh(deltaTime) {
        // Smooth position update
        this.mesh.position.lerp(this.position, deltaTime * 10);

        // Smooth rotation update
        if (this.velocity.length() > 0.01) {
            this.targetRotation = Math.atan2(this.velocity.x, this.velocity.z);
            const currentRotation = this.mesh.rotation.y;
            const rotationDelta = this.targetRotation - currentRotation;
            
            // Normalize rotation delta to [-PI, PI]
            const normalizedDelta = Math.atan2(Math.sin(rotationDelta), Math.cos(rotationDelta));
            
            // Smoothly rotate towards target
            this.mesh.rotation.y += normalizedDelta * deltaTime * this.rotationSpeed;
        }
    }

    updateState(playerPosition, isIlluminated) {
        const distanceToPlayer = this.position.distanceTo(playerPosition);
        const canSeePlayer = this.canSeePlayer(playerPosition);

        // Only change state if not already in that state (avoid repeated transitions)
        if (this.properties.lightSensitive && isIlluminated) {
            if (this.state !== EnemyState.HIDE) {
                this.state = EnemyState.HIDE;
                this.stateTimer = 0;
            }
        } else if (distanceToPlayer < 1.5) {
            if (this.state !== EnemyState.ATTACK) {
                this.state = EnemyState.ATTACK;
                this.stateTimer = 0;
            }
        } else if (canSeePlayer && distanceToPlayer < this.properties.detectionRange) {
            if (this.state !== EnemyState.CHASE) {
                this.state = EnemyState.CHASE;
                this.stateTimer = 0;
            }
        } else if (this.state === EnemyState.IDLE && this.stateTimer > 3) {
            this.state = EnemyState.PATROL;
            this.stateTimer = 0;
        }
    }

    updateIdle(deltaTime) {
        // Reset velocity in idle state
        this.velocity.set(0, 0, 0);
    }

    updatePatrol(deltaTime, mazeLayout) {
        if (!this.targetPosition || this.position.distanceTo(this.targetPosition) < 0.1) {
            // Generate new patrol point
            this.targetPosition = this.generatePatrolPoint(mazeLayout);
        }

        // Move towards target
        this.moveTowards(this.targetPosition, deltaTime, mazeLayout);
    }

    updateChase(deltaTime, playerPosition, mazeLayout) {
        if (this.properties.usePathfinding) {
            this.updatePathfinding(playerPosition, mazeLayout);
        } else {
            this.moveTowards(playerPosition, deltaTime, mazeLayout);
        }
    }

    updateAttack(deltaTime, playerPosition) {
        // Face the player
        const direction = playerPosition.clone().sub(this.position).normalize();
        this.targetRotation = Math.atan2(direction.x, direction.z);
        
        // Move towards player
        this.moveTowards(playerPosition, deltaTime);
        // Attack cooldown logic
        const now = this._now || performance.now() / 1000;
        if (now - this.lastAttackTime > this.attackCooldown) {
            this.lastAttackTime = now;
            this._readyToAttack = true;
        } else {
            this._readyToAttack = false;
        }
    }

    updateHide(deltaTime, playerPosition, mazeLayout) {
        // Find hiding spot away from player
        const awayFromPlayer = this.position.clone().sub(playerPosition).normalize();
        const hidePosition = this.position.clone().add(awayFromPlayer.multiplyScalar(5));
        this.moveTowards(hidePosition, deltaTime, mazeLayout);
    }

    updateFlock(deltaTime, playerPosition, mazeLayout) {
        // Flocking behavior (to be implemented by PackHunter)
    }

    moveTowards(target, deltaTime, mazeLayout) {
        const direction = target.clone().sub(this.position).normalize();
        // Calculate new velocity
        this.velocity.x = direction.x * this.properties.movementSpeed;
        this.velocity.z = direction.z * this.properties.movementSpeed;

        // Predict next position
        const nextPos = this.position.clone();
        nextPos.x += this.velocity.x * deltaTime;
        nextPos.z += this.velocity.z * deltaTime;

        // Create a temp collider for the next position
        const tempMin = new THREE.Vector3(
            nextPos.x - this.meshSize.width / 2,
            nextPos.y,
            nextPos.z - this.meshSize.depth / 2
        );
        const tempMax = new THREE.Vector3(
            nextPos.x + this.meshSize.width / 2,
            nextPos.y + this.meshSize.height,
            nextPos.z + this.meshSize.depth / 2
        );
        const tempCollider = new THREE.Box3(tempMin, tempMax);

        // Check collision with walls (like player)
        let collides = false;
        if (mazeLayout) {
            const walls = this.scene.children.filter(
                child => child.userData && child.userData.type === 'wall'
            );
            for (const wall of walls) {
                const wallBox = new THREE.Box3().setFromObject(wall);
                if (tempCollider.intersectsBox(wallBox)) {
                    collides = true;
                    break;
                }
            }
        }
        if (!collides) {
            // Update position
            this.position.x = nextPos.x;
            this.position.z = nextPos.z;
            this.updateCollider();
        } else {
            // Stop movement if hitting a wall
            this.velocity.set(0, 0, 0);
        }
    }

    updatePathfinding(targetPosition, mazeLayout) {
        // Only recalculate path if cooldown expired or player moved significantly
        const now = this._now || performance.now() / 1000;
        const playerMoved = !this.lastKnownPlayerPos || this.lastKnownPlayerPos.distanceTo(targetPosition) > 1.0;
        const distanceToPlayer = this.position.distanceTo(targetPosition);
        if (distanceToPlayer < 2) {
            // Don't pathfind if too close to player
            return;
        }
        if (
            !this.path.length ||
            this.currentPathIndex >= this.path.length ||
            (now - this.lastPathUpdateTime > this.pathfindingCooldown && playerMoved)
        ) {
            if (now - this.lastPathUpdateTime < 0.5) {
                console.warn('Pathfinding called very frequently for enemy at', this.position, 'target:', targetPosition);
            }
            this.path = AStarPathfinding.findPath(this.position, targetPosition);
            this.currentPathIndex = 0;
            this.lastPathUpdateTime = now;
            this.lastKnownPlayerPos = targetPosition.clone();
        }
        if (this.path.length) {
            const nextPoint = this.path[this.currentPathIndex];
            if (this.position.distanceTo(nextPoint) < 0.1) {
                this.currentPathIndex++;
            } else {
                this.moveTowards(nextPoint, 1, mazeLayout);
            }
        }
    }

    generatePatrolPoint(mazeLayout) {
        if (!mazeLayout) return this.position.clone();

        const size = mazeLayout.length;
        const maxAttempts = 50;
        let attempts = 0;

        while (attempts < maxAttempts) {
            const x = Math.floor(Math.random() * size);
            const z = Math.floor(Math.random() * size);

            if (mazeLayout[x][z] === 0) {
                return new THREE.Vector3(x + 0.5, 0, z + 0.5);
            }
            attempts++;
        }

        return this.position.clone();
    }

    canSeePlayer(playerPosition) {
        // Throttle raycasting for performance
        const now = this._now || performance.now() / 1000;
        const distanceToPlayer = this.position.distanceTo(playerPosition);
        // If very close, assume visible (no raycast needed)
        if (distanceToPlayer < 1.5) {
            this.cachedCanSeePlayer = true;
            return true;
        }
        // Increase raycast cooldown to 0.5s for further optimization
        if (now - this.lastRaycastTime < 0.5 && this._lastRaycastPlayerPos && this._lastRaycastPlayerPos.distanceTo(playerPosition) < 0.5) {
            return this.cachedCanSeePlayer;
        }
        this.lastRaycastTime = now;
        this._lastRaycastPlayerPos = playerPosition.clone();
        // Only raycast against wall objects for visibility
        const direction = playerPosition.clone().sub(this.position).normalize();
        const wallObjects = this.scene.children.filter(obj => obj.userData && obj.userData.type === 'wall');
        const raycaster = new THREE.Raycaster(this.position, direction);
        const intersects = raycaster.intersectObjects(wallObjects, true);
        // If no wall blocks the way, assume visible
        this.cachedCanSeePlayer = intersects.length === 0;
        return this.cachedCanSeePlayer;
    }

    checkIllumination(scanner) {
        if (!scanner || !scanner.activeDots) return false;

        // Check if any scanner dots are near the enemy
        const illuminationRadius = 2;
        for (const dot of scanner.activeDots) {
            if (dot.position.distanceTo(this.position) < illuminationRadius) {
                return true;
            }
        }
        return false;
    }

    takeDamage(amount) {
        this.properties.health -= amount;
        if (this.properties.health <= 0) {
            // Remove health bar and mesh from scene
            if (this.mesh && this.mesh.parent) {
                this.mesh.parent.remove(this.mesh);
            }
            this.mesh = null;
            this.healthBar = null;
            this.healthBarMaterial = null;
            return true;
        }
        return false;
    }

    updateHealthBar() {
        if (!this.healthBar || this.properties.health <= 0) return;
        // Update health bar color and scale
        const healthPercent = Math.max(0, this.properties.health) / this.properties.maxHealth;
        // Color from green (full) to red (empty)
        const r = Math.round(255 * (1 - healthPercent));
        const g = Math.round(255 * healthPercent);
        this.healthBarMaterial.color.setRGB(r / 255, g / 255, 0);
        this.healthBar.scale.x = healthPercent;
        // Always face the camera
        if (window.game && window.game.camera) {
            this.healthBar.lookAt(window.game.camera.position);
            this.healthTextSprite.lookAt(window.game.camera.position);
        }
        this.updateHealthText();
    }

    updateHealthText() {
        if (!this.healthTextContext) return;
        const current = Math.max(0, Math.round(this.properties.health));
        const max = Math.round(this.properties.maxHealth || this.properties.health);
        this.healthTextContext.clearRect(0, 0, this.healthTextCanvas.width, this.healthTextCanvas.height);
        this.healthTextContext.font = 'bold 24px Arial';
        this.healthTextContext.textAlign = 'center';
        this.healthTextContext.textBaseline = 'middle';
        this.healthTextContext.fillStyle = '#fff';
        this.healthTextContext.strokeStyle = '#000';
        this.healthTextContext.lineWidth = 4;
        const text = `${current}/${max}`;
        this.healthTextContext.strokeText(text, this.healthTextCanvas.width / 2, this.healthTextCanvas.height / 2);
        this.healthTextContext.fillText(text, this.healthTextCanvas.width / 2, this.healthTextCanvas.height / 2);
        this.healthTextTexture.needsUpdate = true;
    }
}

// Basic Stalker - Follows player in darkness, avoids scanner light
export class BasicStalker extends Enemy {
    constructor(scene, position, properties) {
        super(scene, position, {
            ...properties,
            lightSensitive: true,
            movementSpeed: properties.movementSpeed || 0.03
        });
        this.meshSize = { width: 0.5, height: 0.8, depth: 0.5 };
        this.meshYOffset = 0.4;
    }

    createMesh() {
        const geometry = new THREE.BoxGeometry(this.meshSize.width, this.meshSize.height, this.meshSize.depth);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.meshYOffset;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
        this.createHealthBar();
    }
}

// Pack Hunter - Moves in groups, tries to flank the player
export class PackHunter extends Enemy {
    constructor(scene, position, properties, otherEnemies) {
        super(scene, position, {
            ...properties,
            lightSensitive: true,
            movementSpeed: properties.movementSpeed || 0.04
        });
        this.type = 'PackHunter';
        this.otherEnemies = otherEnemies;
        this.meshSize = { width: 0.4, height: 0.7, depth: 0.4 };
        this.meshYOffset = 0.35;
    }

    createMesh() {
        const geometry = new THREE.BoxGeometry(this.meshSize.width, this.meshSize.height, this.meshSize.depth);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.meshYOffset;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
        this.createHealthBar();
    }

    updateFlock(deltaTime, playerPosition, mazeLayout) {
        // Flocking behavior using boids algorithm
        const separation = this.calculateSeparation();
        const alignment = this.calculateAlignment();
        const cohesion = this.calculateCohesion();

        // Combine behaviors
        const flockingForce = separation.add(alignment).add(cohesion);
        
        // Apply flocking force while respecting maze walls
        const targetPosition = this.position.clone().add(flockingForce.multiplyScalar(deltaTime));
        this.moveTowards(targetPosition, deltaTime, mazeLayout);
    }

    calculateSeparation() {
        const force = new THREE.Vector3();
        const separationRadius = 2;

        for (const enemy of this.otherEnemies) {
            if (enemy === this) continue;
            const distance = this.position.distanceTo(enemy.position);
            if (distance < separationRadius) {
                const away = this.position.clone().sub(enemy.position).normalize();
                force.add(away.divideScalar(distance));
            }
        }

        return force;
    }

    calculateAlignment() {
        const force = new THREE.Vector3();
        let count = 0;

        for (const enemy of this.otherEnemies) {
            if (enemy === this) continue;
            force.add(enemy.velocity);
            count++;
        }

        return count > 0 ? force.divideScalar(count) : force;
    }

    calculateCohesion() {
        const center = new THREE.Vector3();
        let count = 0;

        for (const enemy of this.otherEnemies) {
            if (enemy === this) continue;
            center.add(enemy.position);
            count++;
        }

        if (count > 0) {
            center.divideScalar(count);
            return center.sub(this.position).normalize();
        }

        return center;
    }
}

// Ambusher - Hides and attacks when player is near
export class Ambusher extends Enemy {
    constructor(scene, position, properties) {
        super(scene, position, {
            ...properties,
            lightSensitive: false,
            movementSpeed: properties.movementSpeed || 0.05
        });
        this.type = 'Ambusher';
        this.ambushRange = 3;
        this.ambushCooldown = 0;
        this.meshSize = { width: 0.3, height: 0.5, depth: 0.3 };
        this.meshYOffset = 0.25;
    }

    createMesh() {
        const geometry = new THREE.BoxGeometry(this.meshSize.width, this.meshSize.height, this.meshSize.depth);
        const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.meshYOffset;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
        this.createHealthBar();
    }

    updateHide(deltaTime, playerPosition, mazeLayout) {
        // Stay hidden until player is close
        const distanceToPlayer = this.position.distanceTo(playerPosition);
        if (distanceToPlayer < this.ambushRange && this.ambushCooldown <= 0) {
            this.state = EnemyState.ATTACK;
            this.ambushCooldown = 5; // 5 second cooldown between ambushes
        }
        this.ambushCooldown -= deltaTime;
    }

    updateAttack(deltaTime, playerPosition) {
        super.updateAttack(deltaTime, playerPosition);
        // Quick attack and retreat
        this.moveTowards(playerPosition, deltaTime * 2);
        if (this.position.distanceTo(playerPosition) < 1) {
            this.state = EnemyState.HIDE;
        }
    }
}

