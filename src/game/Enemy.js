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

        // Create mesh
        this.createMesh();
    }

    createMesh() {
        // Base enemy mesh (to be overridden by specific enemy types)
        const geometry = new THREE.BoxGeometry(0.5, 3, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 1.5;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }

    update(deltaTime, playerPosition, scanner, mazeLayout) {
        // Update state timer
        this.stateTimer += deltaTime;

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

        // State transition logic
        if (this.properties.lightSensitive && isIlluminated) {
            this.state = EnemyState.HIDE;
        } else if (distanceToPlayer < 1.5) {
            this.state = EnemyState.ATTACK;
        } else if (canSeePlayer && distanceToPlayer < this.properties.detectionRange) {
            this.state = EnemyState.CHASE;
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

        // Check if next position is valid
        const nextX = Math.floor(this.position.x + this.velocity.x * deltaTime);
        const nextZ = Math.floor(this.position.z + this.velocity.z * deltaTime);

        if (mazeLayout && 
            nextX >= 0 && nextX < mazeLayout.length && 
            nextZ >= 0 && nextZ < mazeLayout.length && 
            mazeLayout[nextX][nextZ] === 0) {
            // Update position
            this.position.x += this.velocity.x * deltaTime;
            this.position.z += this.velocity.z * deltaTime;
        } else {
            // Stop movement if hitting a wall
            this.velocity.set(0, 0, 0);
        }
    }

    updatePathfinding(targetPosition, mazeLayout) {
        if (!this.path.length || this.currentPathIndex >= this.path.length) {
            // Calculate new path
            this.path = AStarPathfinding.findPath(this.position, targetPosition);
            this.currentPathIndex = 0;
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
        // Raycast to check if player is visible
        const direction = playerPosition.clone().sub(this.position).normalize();
        const raycaster = new THREE.Raycaster(this.position, direction);
        const intersects = raycaster.intersectObjects(this.scene.children, true);

        // Check if first intersection is the player
        return intersects.length > 0 && intersects[0].distance < this.properties.detectionRange;
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
        return this.properties.health <= 0;
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
    }

    createMesh() {
        const geometry = new THREE.BoxGeometry(0.5, 3, 0.5);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 1.5;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
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
    }

    createMesh() {
        const geometry = new THREE.BoxGeometry(0.4, 2.4, 0.4);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 1.2;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
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
    }

    createMesh() {
        const geometry = new THREE.BoxGeometry(0.3, 1.8, 0.3);
        const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = 0.9;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
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

