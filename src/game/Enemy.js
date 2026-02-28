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
        this.type = 'BasicStalker'; // Default type

        const {
            meshSize,
            meshYOffset,
            groundY,
            ...enemyProps
        } = properties || {};

        const defaultSize = { width: 0.5, height: 1, depth: 0.5 };
        this.meshSize = {
            width: meshSize?.width ?? defaultSize.width,
            height: meshSize?.height ?? defaultSize.height,
            depth: meshSize?.depth ?? defaultSize.depth
        };

        this.groundY = Number.isFinite(groundY) ? groundY : -1;
        this.meshYOffset = meshYOffset ?? (this.groundY + this.meshSize.height / 2);

        const basePosition = (position && typeof position.clone === 'function')
            ? position.clone()
            : new THREE.Vector3(
                position?.x || 0,
                position?.y || 0,
                position?.z || 0
            );
        basePosition.y = this.groundY;
        this.position = basePosition;

        this.properties = {
            health: enemyProps.health || 100,
            maxHealth: enemyProps.health || 100,
            detectionRange: enemyProps.detectionRange || 5,
            movementSpeed: enemyProps.movementSpeed ?? 1.8,
            damage: enemyProps.damage || 1,
            attackRange: enemyProps.attackRange ?? 1.5,
            usePathfinding: enemyProps.usePathfinding ?? true,
            reactsToSound: enemyProps.reactsToSound || false,
            lightSensitive: enemyProps.lightSensitive ?? true,
            canPhaseWalls: enemyProps.canPhaseWalls ?? false,
            ...enemyProps
        };
        if (!this.properties.maxHealth) {
            this.properties.maxHealth = this.properties.health;
        }

        this.wallBoxes = null;

        // State machine
        this.state = EnemyState.PATROL;
        this.stateTimer = 0;
        this.targetPosition = null;
        this.path = [];
        this.currentPathIndex = 0;

        // Movement smoothing
        this.velocity = new THREE.Vector3();
        this.targetRotation = 0;
        this.rotationSpeed = 5;

        // Reusable helpers to avoid allocations in hot paths
        this._raycaster = new THREE.Raycaster();
        this._raycaster.near = 0.1;
        this._raycastBaseRange = Math.max(3, (this.properties.detectionRange || 6) * 1.5);
        this._raycaster.far = this._raycastBaseRange;
        this._directionHelper = new THREE.Vector3();
        this._nextPosition = new THREE.Vector3(this.position.x, this.groundY, this.position.z);
        this._tempTarget = new THREE.Vector3();
        this._colliderMin = new THREE.Vector3();
        this._colliderMax = new THREE.Vector3();
        this._sweptCollider = new THREE.Box3();
        this._lastRaycastPlayerPos = new THREE.Vector3(Number.POSITIVE_INFINITY, this.groundY, Number.POSITIVE_INFINITY);
        this._chaseTarget = new THREE.Vector3();

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
        this._readyToAttack = false;

        // Stun handling
        this.stunnedUntil = 0;
        this._stunnedVisual = false;
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

    _refreshRaycastRange() {
        if (!this._raycaster) return;
        const detectRange = this.properties?.detectionRange || 6;
        this._raycastBaseRange = Math.max(3, detectRange * 1.5);
        this._raycaster.far = this._raycastBaseRange;
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
        // Omit per-enemy canvas text to prevent GPU uploads and main-thread stalls
        this.healthTextCanvas = null;
        this.healthTextContext = null;
        this.healthTextTexture = null;
        this.healthTextMaterial = null;
        this.healthTextSprite = null;
        this._lastHealthDisplay = undefined;
    }

    update(deltaTime, playerPosition, scanner, mazeLayout) {
        // Update state timer
        this.stateTimer += deltaTime;
        // Store time for cooldowns
        this._now = performance.now() / 1000;

        if (playerPosition) {
            this._chaseTarget.copy(playerPosition);
        }

        // Handle stun: freeze movement/AI but still update visuals
        if (this._now < this.stunnedUntil) {
            this.velocity.set(0, 0, 0);
            if (!this._stunnedVisual) this.setStunnedVisual(true);
            // Keep facing player lightly
            this._directionHelper.copy(playerPosition).sub(this.position);
            const lenSq = this._directionHelper.lengthSq();
            if (lenSq > 1e-6) {
                this._directionHelper.multiplyScalar(1 / Math.sqrt(lenSq));
                this.targetRotation = Math.atan2(this._directionHelper.x, this._directionHelper.z);
            }
            this.updateMesh(deltaTime);
            this.updateHealthBar();
            return;
        } else if (this._stunnedVisual) {
            this.setStunnedVisual(false);
        }

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
        // Smooth position update with clamp to avoid jitter at high FPS
        const lerpAlpha = Math.min(1, deltaTime * 14);
        this.mesh.position.lerp(this.position, lerpAlpha);
        this.mesh.position.y = this.meshYOffset;

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
        this.canSeePlayer(playerPosition);

        // Only change state if not already in that state (avoid repeated transitions)
        const attackRange = this.properties.attackRange ?? 1.5;

        if (distanceToPlayer <= attackRange) {
            if (this.state !== EnemyState.ATTACK) {
                this.state = EnemyState.ATTACK;
                this.stateTimer = 0;
            }
            return;
        }

        if (this.state !== EnemyState.CHASE) {
            this.state = EnemyState.CHASE;
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

    applyStun(seconds = 2) {
        const now = this._now || performance.now() / 1000;
        this.stunnedUntil = Math.max(this.stunnedUntil, now + seconds);
    }

    setStunnedVisual(on) {
        this._stunnedVisual = on;
        if (!this.mesh) return;
        const material = this.mesh.material;
        if (!material) return;
        if (on) {
            material.color.set(0xaa00ff);
            material.opacity = 0.9;
            material.transparent = true;
        } else {
            material.opacity = 1.0;
            material.transparent = false;
            // Reset color per type
            if (this.type === 'PackHunter') material.color.set(0x00ff00);
            else if (this.type === 'Ambusher') material.color.set(0x0000ff);
            else material.color.set(0xff0000);
        }
    }

    updateChase(deltaTime, playerPosition, mazeLayout) {
        const target = playerPosition || this._chaseTarget;
        if (!target) return;

        let movedWithPath = false;
        const usePath = this.properties.usePathfinding && this.properties.canPhaseWalls === false;
        if (usePath) {
            movedWithPath = this.updatePathfinding(target, mazeLayout, deltaTime);
        }

        if (!movedWithPath) {
            this.moveTowards(target, deltaTime, mazeLayout);
        }
    }

    updateAttack(deltaTime, playerPosition) {
        // Face the player
        this._directionHelper.copy(playerPosition).sub(this.position);
        const dirLenSq = this._directionHelper.lengthSq();
        if (dirLenSq > 1e-6) {
            this._directionHelper.multiplyScalar(1 / Math.sqrt(dirLenSq));
            this.targetRotation = Math.atan2(this._directionHelper.x, this._directionHelper.z);
        }
        
        // Move towards player
        this.moveTowards(playerPosition, deltaTime);
        // Attack cooldown logic
        const now = this._now || performance.now() / 1000;
        const attackRange = this.properties.attackRange ?? 1.5;
        const inRange = this.position.distanceTo(playerPosition) <= attackRange;
        this._readyToAttack = inRange && (now - this.lastAttackTime >= this.attackCooldown);
    }

    updateHide(deltaTime, playerPosition, mazeLayout) {
        // Find hiding spot away from player
        this._tempTarget.copy(this.position).sub(playerPosition);
        const lenSq = this._tempTarget.lengthSq();
        if (lenSq > 1e-6) {
            this._tempTarget.multiplyScalar(1 / Math.sqrt(lenSq));
        } else {
            this._tempTarget.set(0, 0, 0);
        }
        this._tempTarget.multiplyScalar(5).add(this.position);
        this.moveTowards(this._tempTarget, deltaTime, mazeLayout);
    }

    updateFlock(deltaTime, playerPosition, mazeLayout) {
        // Flocking behavior (to be implemented by PackHunter)
    }

    moveTowards(target, deltaTime, mazeLayout) {
        this._directionHelper.copy(target).sub(this.position);
        const distanceSq = this._directionHelper.lengthSq();
        if (distanceSq < 1e-6) {
            this.velocity.set(0, 0, 0);
            return;
        }
        const invLen = 1 / Math.sqrt(distanceSq);
        this._directionHelper.multiplyScalar(invLen);

        const canPhase = this.properties.canPhaseWalls !== false;

        // Calculate new velocity
        this.velocity.x = this._directionHelper.x * this.properties.movementSpeed;
        this.velocity.z = this._directionHelper.z * this.properties.movementSpeed;

        // Predict next position
        this._nextPosition.copy(this.position);
        this._nextPosition.x += this.velocity.x * deltaTime;
        this._nextPosition.z += this.velocity.z * deltaTime;

        if (mazeLayout && mazeLayout.length) {
            const clampMin = 0.1;
            const clampMax = Math.max(clampMin, mazeLayout.length - 0.1);
            this._nextPosition.x = THREE.MathUtils.clamp(this._nextPosition.x, clampMin, clampMax);
            this._nextPosition.z = THREE.MathUtils.clamp(this._nextPosition.z, clampMin, clampMax);
        }

        // Create a temp collider for the next position
        this._colliderMin.set(
            this._nextPosition.x - this.meshSize.width / 2,
            this._nextPosition.y,
            this._nextPosition.z - this.meshSize.depth / 2
        );
        this._colliderMax.set(
            this._nextPosition.x + this.meshSize.width / 2,
            this._nextPosition.y + this.meshSize.height,
            this._nextPosition.z + this.meshSize.depth / 2
        );
        this._sweptCollider.set(this._colliderMin, this._colliderMax);

        let collides = false;
        if (!canPhase) {
            // Lazy compute wall boxes if we do not have them yet
            if ((!this.wallBoxes || !this.wallBoxes.length) && this.wallObjects && this.wallObjects.length) {
                this.wallBoxes = this.wallObjects.map(obj => new THREE.Box3().setFromObject(obj));
            }

            const wallBoxes = this.wallBoxes;
            if (wallBoxes && wallBoxes.length) {
                for (const wallBox of wallBoxes) {
                    if (this._sweptCollider.intersectsBox(wallBox)) {
                        collides = true;
                        break;
                    }
                }
            } else if (mazeLayout) {
                const gx = Math.floor(this._nextPosition.x);
                const gz = Math.floor(this._nextPosition.z);
                if (
                    gx >= 0 && gz >= 0 &&
                    gx < mazeLayout.length &&
                    gz < mazeLayout.length &&
                    mazeLayout[gx][gz] === 1
                ) {
                    collides = true;
                }
            }
        }

        if (!collides) {
            this.position.x = this._nextPosition.x;
            this.position.z = this._nextPosition.z;
            this.position.y = this.groundY;
            this.updateCollider();
        } else {
            this.velocity.set(0, 0, 0);
        }
    }

    updatePathfinding(targetPosition, mazeLayout, deltaTime = 1) {
        if (!targetPosition) return false;
        // Only recalculate path if cooldown expired or player moved significantly
        const now = this._now || performance.now() / 1000;
        const playerMoved = !this.lastKnownPlayerPos || this.lastKnownPlayerPos.distanceTo(targetPosition) > 0.5;
        const distanceToPlayer = this.position.distanceTo(targetPosition);
        if (
            !this.path.length ||
            this.currentPathIndex >= this.path.length ||
            (playerMoved || (now - this.lastPathUpdateTime > this.pathfindingCooldown))
        ) {
            // Suppress noisy pathfinding warning to avoid console-induced frame drops
            this.path = AStarPathfinding.findPath(this.position, targetPosition);
            this.currentPathIndex = 0;
            this.lastPathUpdateTime = now;
            this.lastKnownPlayerPos = targetPosition.clone();
        }
        let moved = false;
        while (this.path.length && this.currentPathIndex < this.path.length) {
            const nextPoint = this.path[this.currentPathIndex];
            if (!nextPoint) break;
            if (this.position.distanceTo(nextPoint) < 0.1) {
                this.currentPathIndex++;
                continue;
            }
            this.moveTowards(nextPoint, deltaTime, mazeLayout);
            moved = true;
            break;
        }
        if (!moved && distanceToPlayer > 0.05) {
            this.moveTowards(targetPosition, deltaTime, mazeLayout);
            moved = true;
        }
        return moved;
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
                return new THREE.Vector3(x, this.groundY, z);
            }
            attempts++;
        }

        return this.position.clone();
    }

    canSeePlayer(playerPosition) {
        if (this.properties.canPhaseWalls !== false) {
            this.cachedCanSeePlayer = true;
            return true;
        }

        const now = this._now || performance.now() / 1000;
        const dx = playerPosition.x - this.position.x;
        const dz = playerPosition.z - this.position.z;
        const distanceSq = dx * dx + dz * dz;

        // If the player is extremely close, skip raycasting entirely
        if (distanceSq < 2.25) {
            this.cachedCanSeePlayer = true;
            return true;
        }

        // Respect cooldown unless the player moved significantly
        if (now - this.lastRaycastTime < 0.5) {
            const last = this._lastRaycastPlayerPos;
            const ddx = playerPosition.x - last.x;
            const ddz = playerPosition.z - last.z;
            if ((ddx * ddx + ddz * ddz) < 0.25) {
                return this.cachedCanSeePlayer;
            }
        }

        this.lastRaycastTime = now;
        this._lastRaycastPlayerPos.copy(playerPosition);

        // Guarantee we have wall references cached
        if (!this.wallObjects || !this.wallObjects.length) {
            this.wallObjects = this.scene.children.filter(obj => obj.userData && obj.userData.type === 'wall');
        }
        if ((!this.wallBoxes || !this.wallBoxes.length) && this.wallObjects && this.wallObjects.length) {
            this.wallBoxes = this.wallObjects.map(obj => new THREE.Box3().setFromObject(obj));
        }

        // Prepare raycaster
        this._directionHelper.set(dx, (playerPosition.y || 0) - this.position.y, dz);
        const distance = Math.sqrt(distanceSq);
        if (distance < 1e-3) {
            this.cachedCanSeePlayer = true;
            return true;
        }
        this._directionHelper.multiplyScalar(1 / distance);
        this._refreshRaycastRange();
        this._raycaster.set(this.position, this._directionHelper);
        this._raycaster.far = Math.max(distance + 0.25, this._raycastBaseRange);

        const intersects = this.wallObjects && this.wallObjects.length
            ? this._raycaster.intersectObjects(this.wallObjects, true)
            : [];
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
            if (this.healthTextSprite) this.healthTextSprite.lookAt(window.game.camera.position);
        }
        // Only update text sprite if enabled and health changed (text disabled by default)
        if (this.healthTextContext) {
            const currentInt = Math.max(0, Math.round(this.properties.health));
            if (currentInt !== this._lastHealthDisplay) {
                this.updateHealthText();
                this._lastHealthDisplay = currentInt;
            }
        }
    }

    updateHealthText() {
        if (!this.healthTextContext) return; // disabled
        const current = Math.max(0, Math.round(this.properties.health));
        const max = Math.round(this.properties.maxHealth || this.properties.health);
        this.healthTextContext.clearRect(0, 0, this.healthTextCanvas.width, this.healthTextCanvas.height);
        this.healthTextContext.font = 'bold 24px Arial';
        this.healthTextContext.textAlign = 'center';
        this.healthTextContext.textBaseline = 'middle';
        this.healthTextContext.fillStyle = '#fff';
        // Keep it light: single fill pass only
        const text = `${current}/${max}`;
        this.healthTextContext.fillText(text, this.healthTextCanvas.width / 2, this.healthTextCanvas.height / 2);
        this.healthTextTexture.needsUpdate = true;
    }

    // Reuse support: reset and reactivate an existing enemy instance
    revive(position, properties = {}) {
        const {
            meshSize,
            meshYOffset,
            groundY,
            ...enemyProps
        } = properties || {};

        if (Number.isFinite(groundY)) {
            this.groundY = groundY;
        }

        if (meshSize) {
            this.meshSize.width = meshSize.width ?? this.meshSize.width;
            this.meshSize.height = meshSize.height ?? this.meshSize.height;
            this.meshSize.depth = meshSize.depth ?? this.meshSize.depth;
        }

        this.meshYOffset = meshYOffset ?? (this.groundY + this.meshSize.height / 2);

        this.position.copy(position);
        this.position.y = this.groundY;
        this._nextPosition.copy(this.position);

        if (this.mesh) {
            this.mesh.position.copy(this.position);
            this.mesh.position.y = this.meshYOffset;
            this.mesh.visible = true;
            if (this.healthBar) this.healthBar.visible = true;
            if (this.healthTextSprite) this.healthTextSprite.visible = true;
            this.scene.add(this.mesh);
        }
        // Reset state
        this.state = EnemyState.PATROL;
        this.stateTimer = 0;
        this.targetPosition = null;
        this.path = [];
        this.currentPathIndex = 0;
        this.velocity.set(0,0,0);
        this.targetRotation = 0;
        this.lastKnownPlayerPos = null;
        this.lastPathUpdateTime = 0;
        this.lastRaycastTime = 0;
        this.cachedCanSeePlayer = false;
        this.lastAttackTime = 0;
        this.stunnedUntil = 0;
        this._stunnedVisual = false;
        this.setStunnedVisual(false);
        this._lastRaycastPlayerPos.set(Number.POSITIVE_INFINITY, this.groundY, Number.POSITIVE_INFINITY);
        // Refresh properties
        this.properties = { ...this.properties, ...enemyProps };
        this.properties.maxHealth = enemyProps.maxHealth || enemyProps.health || this.properties.maxHealth || this.properties.health;
        this.properties.health = enemyProps.health || this.properties.maxHealth;
        this._refreshRaycastRange();
        this.updateCollider();
        this.updateHealthBar();
    }

    // Hide and detach from scene without disposing resources
    deactivate() {
        if (this.mesh) {
            this.mesh.visible = false;
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
        }
        if (this.healthBar) this.healthBar.visible = false;
        if (this.healthTextSprite) this.healthTextSprite.visible = false;
    }

    // Final cleanup: dispose GPU resources
    destroy() {
        if (this.mesh) {
            if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material) this.mesh.material.dispose();
            this.mesh = null;
        }
        if (this.healthBar) {
            if (this.healthBar.geometry) this.healthBar.geometry.dispose();
            if (this.healthBarMaterial) this.healthBarMaterial.dispose();
            this.healthBar = null;
            this.healthBarMaterial = null;
        }
        if (this.healthTextTexture) this.healthTextTexture.dispose();
        if (this.healthTextMaterial) this.healthTextMaterial.dispose();
        this.healthTextCanvas = null;
        this.healthTextContext = null;
        this.healthTextTexture = null;
        this.healthTextMaterial = null;
        this.healthTextSprite = null;
    }
}

// Basic Stalker - Follows player in darkness, avoids scanner light
export class BasicStalker extends Enemy {
    constructor(scene, position, properties = {}) {
        super(scene, position, {
            ...properties,
            lightSensitive: true,
            movementSpeed: properties?.movementSpeed ?? 1.8,
            usePathfinding: true,
            meshSize: { width: 0.5, height: 0.8, depth: 0.5 }
        });
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
    constructor(scene, position, properties = {}, otherEnemies) {
        super(scene, position, {
            ...properties,
            lightSensitive: true,
            movementSpeed: properties?.movementSpeed ?? 2.4,
            meshSize: { width: 0.4, height: 0.7, depth: 0.4 }
        });
        this.type = 'PackHunter';
        this.otherEnemies = otherEnemies;
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
    constructor(scene, position, properties = {}) {
        super(scene, position, {
            ...properties,
            lightSensitive: false,
            movementSpeed: properties?.movementSpeed ?? 3,
            meshSize: { width: 0.3, height: 0.5, depth: 0.3 }
        });
        this.type = 'Ambusher';
        this.ambushRange = 3;
        this.ambushCooldown = 0;
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
