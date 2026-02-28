import * as THREE from 'three';
import { Enemy, BasicStalker, PackHunter, Ambusher } from './Enemy';
import { AStarPathfinding } from './Pathfinding';

export class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.pool = {
            BasicStalker: [],
            PackHunter: [],
            Ambusher: []
        };
        this.mazeLayout = null;
        this.wallBoxes = [];
        this.walkableCells = [];
        this.safeSpawnCells = [];
        this._spawnCursor = 0;
        this._safeSpawnCursor = 0;
        this._neighborCursor = 0;
        this._mazeCenter = null;
        this.enemiesKilled = 0;
        this.totalDamageDealt = 0; // Track total damage dealt
        
        // Shared AI blackboard for simple squad/alert coordination
        this.blackboard = {
            alerts: [], // { position: THREE.Vector3, time: seconds, type: 'sighting'|'light' }
            helpCooldown: 2.0,
            lastAlertTime: 0,
            maxAge: 8.0
        };
        
        // Enemy properties
        this.enemyProperties = {
            health: 20,
            detectionRange: 5,
            movementSpeed: 1.8,
            damage: 10, // Increased damage
            spawnDistance: 8,
            usePathfinding: true
        };
        this.enemySpeed = {
            basic: 1.8,
            pack: 2.4,
            ambusher: 3
        };
        
        // Spawn settings
        this.spawnSettings = {
            maxEnemies: 99999, // No practical limit
            spawnInterval: 15, // Reduced from 30 seconds
            lastSpawnTime: 0,
            packSize: 3,
            ambushChance: 0.3
        };
    }

    setMazeLayout(layout, playerPosition = null) {
        this.mazeLayout = layout;
        // Cache wall objects once to avoid scanning scene every frame per enemy
        this.wallObjects = this.scene.children.filter(obj => obj.userData && obj.userData.type === 'wall');
        this.wallBoxes = this.wallObjects.map(obj => new THREE.Box3().setFromObject(obj));

        const cellData = this._buildWalkableCells(layout);
        this.walkableCells = cellData.walkable;
        this.safeSpawnCells = cellData.safe;
        this._spawnCursor = 0;
        this._safeSpawnCursor = 0;
        this._neighborCursor = 0;

        if (layout && layout.length) {
            const centerIndex = Math.floor(layout.length / 2);
            this._mazeCenter = new THREE.Vector3(centerIndex, 0, centerIndex);
        } else {
            this._mazeCenter = null;
        }

        for (const enemy of this.enemies) {
            if (!enemy) continue;
            enemy.wallObjects = this.wallObjects;
            enemy.wallBoxes = this.wallBoxes;
        }
        if (window?.game?.scanner?.setStaticGeometry) {
            window.game.scanner.setStaticGeometry(this.wallObjects);
        }
        // Spawn initial enemies when maze is set, using player position for safe zone
        this.spawnInitialEnemies(playerPosition);
    }

    spawnInitialEnemies(playerPosition = null) {
        if (!this.mazeLayout) return;

        const size = this.mazeLayout.length;
        const enemyCount = Math.min(5, this.spawnSettings.maxEnemies); // Lowered to 5 for smoother start
        // Use cached maze center if we do not have a player position yet
        const centerIndex = Math.floor(size / 2);
        const safePos = playerPosition || this._mazeCenter || new THREE.Vector3(centerIndex, 0, centerIndex);
        for (let i = 0; i < enemyCount; i++) {
            let position = this.findValidSpawnPosition(safePos, true, 10); // 10 units for initial spawn
            if (!position && this.walkableCells.length) {
                position = this.walkableCells[0].position.clone();
            }
            if (!position) continue;

            // Randomly choose enemy type with weighted distribution
            const rand = Math.random();
            let type;
            if (rand < 0.5) {
                type = 'BasicStalker';
            } else if (rand < 0.8) {
                type = 'PackHunter';
            } else {
                type = 'Ambusher';
            }
            this.spawnEnemy(safePos, type, position);
        }
    }
    
    // minDistanceOverride allows us to set a custom minimum distance for special cases
    findValidSpawnPosition(referencePosition, enforceSafeZone = false, minDistanceOverride = null) {
        const cells = (enforceSafeZone && this.safeSpawnCells.length) ? this.safeSpawnCells : this.walkableCells;
        if (!cells.length) return null;

        const cursorKey = enforceSafeZone ? '_safeSpawnCursor' : '_spawnCursor';
        let cursor = this[cursorKey] || 0;
        const total = cells.length;

        const fallbackRef = this._mazeCenter || (cells[0] ? cells[0].position : null);
        const ref = referencePosition && Number.isFinite(referencePosition.x) && Number.isFinite(referencePosition.z)
            ? referencePosition
            : fallbackRef;
        const refX = ref ? ref.x : 0;
        const refZ = ref ? ref.z : 0;

        const minDistance = minDistanceOverride !== null
            ? minDistanceOverride
            : (enforceSafeZone ? 7 : this.enemyProperties.spawnDistance);
        const minDistanceSq = minDistance * minDistance;
        const maxDistance = (this.enemyProperties.spawnDistance || 8) * 2;
        const maxDistanceSq = maxDistance * maxDistance;

        for (let checked = 0; checked < total; checked++) {
            const entry = cells[cursor];
            cursor = (cursor + 1) % total;
            if (!entry) continue;
            const pos = entry.position;
            const dx = pos.x - refX;
            const dz = pos.z - refZ;
            const distSq = dx * dx + dz * dz;
            if (distSq > minDistanceSq && distSq < maxDistanceSq) {
                this[cursorKey] = cursor;
                return pos.clone();
            }
        }

        this[cursorKey] = cursor;
        const fallback = cells[cursor];
        return fallback ? fallback.position.clone() : null;
    }
    
    spawnEnemy(referencePosition, type = 'BasicStalker', overridePosition = null) {
        const remainingSlots = this.spawnSettings.maxEnemies - this.enemies.length;
        if (remainingSlots <= 0) return;

        const position = overridePosition ? overridePosition.clone() : this.findValidSpawnPosition(referencePosition, true, 7);
        if (!position) return;

        switch (type) {
            case 'PackHunter':
                this._spawnPack(position, remainingSlots);
                break;
            case 'Ambusher':
                this._spawnSingle('Ambusher', position, {
                    ...this.enemyProperties,
                    movementSpeed: this.enemySpeed.ambusher,
                    reactsToSound: true
                });
                break;
            default:
                this._spawnSingle('BasicStalker', position, {
                    ...this.enemyProperties,
                    movementSpeed: this.enemySpeed.basic
                });
        }
    }
    
    spawnEnemyAtCenter() {
        if (!this.mazeLayout) return;
        
        const center = Math.floor(this.mazeLayout.length / 2);
        const position = new THREE.Vector3(center, 0, center);
        this.spawnEnemy(this._mazeCenter || position, 'BasicStalker', position);
    }
    
    spawnEnemyNextToPlayer(playerPosition) {
        if (!this.mazeLayout) return;

        // Find valid adjacent position
        const playerX = Math.floor(playerPosition.x);
        const playerZ = Math.floor(playerPosition.z);
        
        // Check adjacent cells
        const directions = [
            [1, 0], [-1, 0], [0, 1], [0, -1]
        ];
        
        for (const [dx, dz] of directions) {
            const x = playerX + dx;
            const z = playerZ + dz;
            
            if (x >= 0 && x < this.mazeLayout.length && 
                z >= 0 && z < this.mazeLayout.length && 
                this.mazeLayout[x][z] === 0) {
                
                const position = new THREE.Vector3(x, 0, z);
                this.spawnEnemy(playerPosition, 'BasicStalker', position);
                return;
            }
        }
    }
    
    spawnEnemyInFrontOfPlayer(player) {
        if (!this.mazeLayout) return;

        // Get player position and direction
        const playerPos = player.getPosition();
        const direction = player.getDirection ? player.getDirection() : new THREE.Vector3(1, 0, 0);
        
        // Try to find valid position in front of player
        const playerX = Math.floor(playerPos.x);
        const playerZ = Math.floor(playerPos.z);
        
        // Convert direction to grid movement
        const dx = Math.round(direction.x);
        const dz = Math.round(direction.z);
        
        const x = playerX + dx;
        const z = playerZ + dz;
        
        if (x >= 0 && x < this.mazeLayout.length && 
            z >= 0 && z < this.mazeLayout.length && 
            this.mazeLayout[x][z] === 0) {
            
            const position = new THREE.Vector3(x, 0, z);

            // Randomly choose enemy type
            const enemyTypes = ['BasicStalker', 'PackHunter', 'Ambusher'];
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            
            this.spawnEnemy(playerPos, type, position);
        }
    }
    
    update(deltaTime, player, scanner) {
        const playerPosition = player.getPosition();
        const currentTime = performance.now() / 1000;

        // Check for periodic spawning
        if (currentTime - this.spawnSettings.lastSpawnTime > this.spawnSettings.spawnInterval) {
            // Randomly choose enemy type with weighted distribution
            const rand = Math.random();
            let type;
            if (rand < 0.5) {
                type = 'BasicStalker';
            } else if (rand < 0.8) {
                type = 'PackHunter';
            } else {
                type = 'Ambusher';
            }
            this.spawnEnemy(playerPosition, type);
            this.spawnSettings.lastSpawnTime = currentTime;
        }

        // Prune stale alerts
        this.blackboard.alerts = this.blackboard.alerts.filter(a => (currentTime - a.time) < this.blackboard.maxAge);

        // Update all enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];

            // Early prune: skip and remove dead enemies before any interactions
            if (!enemy || enemy.properties.health <= 0) {
                if (enemy) this._recycleEnemy(enemy);
                this.enemies.splice(i, 1);
                continue;
            }

            enemy.update(deltaTime, playerPosition, scanner, this.mazeLayout);

            // Check for player damage (live enemies only)
            const attackRange = enemy.properties?.attackRange ?? 1.5;
            if (enemy.state === 'attack' && enemy.position.distanceTo(playerPosition) <= attackRange && enemy._readyToAttack) {
                player.takeDamage(enemy.properties.damage);
                enemy._readyToAttack = false;
                enemy.lastAttackTime = currentTime;
            }

            // Call-for-help when an enemy has line-of-sight
            if (enemy.cachedCanSeePlayer && enemy.position.distanceTo(playerPosition) < (enemy.properties.detectionRange || 5)) {
                if ((currentTime - this.blackboard.lastAlertTime) > this.blackboard.helpCooldown) {
                    this.raiseAlert(playerPosition, 'sighting');
                }
            }

            // If there is a recent alert, direct idle/patrol enemies to investigate
            const recentAlert = this.getLatestAlert();
            if (recentAlert) {
                const age = currentTime - recentAlert.time;
                if (age < this.blackboard.maxAge * 0.75) {
                    const shouldInvestigate = (enemy.state === 'idle' || enemy.state === 'patrol');
                    if (shouldInvestigate) {
                        enemy.targetPosition = recentAlert.position.clone();
                        enemy.state = 'chase';
                    }
                }
            }
        }
    }
    
    checkIllumination(enemy, scanner) {
        // Check if any scanner dots are near the enemy
        const enemyPosition = enemy.position;
        const illuminationRadius = 2;
        
        for (const dot of scanner.activeDots) {
            if (dot.position.distanceTo(enemyPosition) < illuminationRadius) {
                return true;
            }
        }
        
        return false;
    }
    
    // --- BEGIN: Refactored enemy damage and death logic ---
    /**
     * Returns only live enemies (health > 0)
     */
    getEnemies() {
        // Filter out dead enemies just in case
        this.enemies = this.enemies.filter(e => e && e.properties.health > 0);
        return this.enemies;
    }

    /**
     * Damages an enemy if it is alive. If it dies, remove it from all arrays and scene.
     * Each call is guaranteed to subtract the correct amount of health.
     */
    damageEnemy(enemy, amount) {
        if (!enemy || enemy.properties.health <= 0) return;
        const before = enemy.properties.health;
        enemy.properties.health -= amount;
        this.totalDamageDealt += amount; // Increment total damage dealt
        // If dead, recycle into pool and remove from active list
        if (enemy.properties.health <= 0) {
            this.enemiesKilled++;
            this._recycleEnemy(enemy);
            // Remove from active list
            this.enemies = this.enemies.filter(e => e !== enemy);
            // Remove from otherEnemies arrays (for PackHunter)
            for (const e of this.enemies) {
                if (e.otherEnemies && Array.isArray(e.otherEnemies)) {
                    e.otherEnemies = e.otherEnemies.filter(o => o !== enemy);
                }
            }
        }
    }
    // --- END: Refactored enemy damage and death logic ---
    
    getEnemyCount() {
        return this.enemies.length;
    }
    
    getEnemyPositions() {
        return this.enemies.map(enemy => ({
            x: Math.floor(enemy.position.x),
            z: Math.floor(enemy.position.z),
            type: enemy.type
        }));
    }
    
    clearEnemies() {
        for (const enemy of this.enemies) {
            this._recycleEnemy(enemy);
        }
        this.enemies = [];
    }
    
    getEnemiesKilled() {
        return this.enemiesKilled;
    }
    getTotalDamageDealt() {
        return this.totalDamageDealt;
    }

    // Blackboard helpers
    raiseAlert(position, type = 'sighting') {
        const currentTime = performance.now() / 1000;
        this.blackboard.lastAlertTime = currentTime;
        this.blackboard.alerts.push({ position: position.clone(), time: currentTime, type });
        if (window?.game?.gameState?.emit) {
            window.game.gameState.emit('EnemyAlerted', { position: position.clone(), type });
        }
    }
    
    // --- Object pooling helpers ---
    _buildWalkableCells(layout) {
        if (!layout || !layout.length) {
            return { walkable: [], safe: [] };
        }
        const walkable = [];
        const safe = [];
        const size = layout.length;
        const center = Math.floor(size / 2);
        const coreMin = center - 1;
        const coreMax = center + 1;
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                if (layout[x][z] !== 0) continue;
                const position = new THREE.Vector3(x, 0, z);
                const cell = { x, z, position };
                walkable.push(cell);
                if (x < coreMin || x > coreMax || z < coreMin || z > coreMax) {
                    safe.push(cell);
                }
            }
        }
        this._shuffleArray(walkable);
        this._shuffleArray(safe);
        return { walkable, safe };
    }

    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    _gatherNearbyPositions(origin, count, radius = 4) {
        const results = [];
        if (!origin || !this.walkableCells.length || count <= 0) {
            return results;
        }
        const radiusSq = radius * radius;
        const total = this.walkableCells.length;
        let idx = this._neighborCursor % total;
        let checked = 0;
        while (checked < total && results.length < count) {
            const cell = this.walkableCells[idx];
            idx = (idx + 1) % total;
            checked++;
            if (!cell) continue;
            const pos = cell.position;
            const dx = pos.x - origin.x;
            const dz = pos.z - origin.z;
            const distSq = dx * dx + dz * dz;
            if (distSq <= 0.25 || distSq > radiusSq) continue;
            if (results.some(existing => Math.abs(existing.x - pos.x) < 0.01 && Math.abs(existing.z - pos.z) < 0.01)) {
                continue;
            }
            results.push(pos.clone());
        }
        this._neighborCursor = idx;
        return results;
    }

    _spawnSingle(type, position, properties) {
        const enemy = this._acquireEnemy(type, position, properties);
        if (!enemy) return null;
        if (type === 'PackHunter') {
            enemy.otherEnemies = this.enemies;
        }
        this.enemies.push(enemy);
        return enemy;
    }

    _spawnPack(position, slotsRemaining) {
        const desiredCount = Math.min(this.spawnSettings.packSize, slotsRemaining);
        if (desiredCount <= 0) return;
        const positions = [position];
        if (desiredCount > 1) {
            const extras = this._gatherNearbyPositions(position, desiredCount - 1, 4);
            for (const extra of extras) {
                positions.push(extra);
            }
        }
        for (const pos of positions) {
            this._spawnSingle('PackHunter', pos, {
                ...this.enemyProperties,
                usePathfinding: true,
                movementSpeed: this.enemySpeed.pack
            });
        }
    }

    _acquireEnemy(type, position, properties) {
        let enemy;
        const poolArr = this.pool[type];
        if (poolArr && poolArr.length > 0) {
            enemy = poolArr.pop();
            enemy.revive(position, properties);
        } else {
            switch (type) {
                case 'PackHunter':
                    enemy = new PackHunter(this.scene, position, properties, this.enemies);
                    break;
                case 'Ambusher':
                    enemy = new Ambusher(this.scene, position, properties);
                    break;
                default:
                    enemy = new BasicStalker(this.scene, position, properties);
            }
        }
        if (enemy) {
            enemy.wallObjects = this.wallObjects;
            enemy.wallBoxes = this.wallBoxes;
        }
        return enemy;
    }

    _recycleEnemy(enemy) {
        if (!enemy) return;
        enemy.deactivate();
        const t = enemy.type || 'BasicStalker';
        if (!this.pool[t]) this.pool[t] = [];
        this.pool[t].push(enemy);
    }

    getLatestAlert() {
        if (!this.blackboard.alerts.length) return null;
        return this.blackboard.alerts[this.blackboard.alerts.length - 1];
    }

    // Rough measure of how spiky things are near the player
    getAggroLevel(playerPosition) {
        if (!playerPosition) return 0;
        // Count nearby hostile states and distance weight
        let score = 0;
        for (const e of this.enemies) {
            const d = e.position.distanceTo(playerPosition);
            const state = (e.state || '').toLowerCase();
            const stateWeight = state === 'attack' ? 2.0 : state === 'chase' ? 1.0 : 0.3;
            const distWeight = Math.max(0, 1 - d / 12);
            score += stateWeight * distWeight;
        }
        // Normalize to 0-100
        return Math.max(0, Math.min(100, Math.round(score * 25)));
    }

    stunEnemiesInRadius(center, radius = 6, duration = 2.5) {
        if (!center) return 0;
        let stunned = 0;
        for (const e of this.enemies) {
            if (e && e.properties.health > 0 && e.position.distanceTo(center) <= radius) {
                if (typeof e.applyStun === 'function') {
                    e.applyStun(duration);
                    stunned++;
                }
            }
        }
        if (stunned > 0 && window?.game?.gameState?.emit) {
            window.game.gameState.emit('Overcharge', { position: center.clone(), count: stunned });
        }
        return stunned;
    }
}
