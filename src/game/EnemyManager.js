import * as THREE from 'three';
import { Enemy, BasicStalker, PackHunter, Ambusher } from './Enemy';
import { AStarPathfinding } from './Pathfinding';

export class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.mazeLayout = null;
        this.enemiesKilled = 0;
        this.totalDamageDealt = 0; // Track total damage dealt
        
        // Enemy properties
        this.enemyProperties = {
            health: 20,
            detectionRange: 5,
            movementSpeed: 0.02,
            damage: 10, // Increased damage
            spawnDistance: 8
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
        // Spawn initial enemies when maze is set, using player position for safe zone
        this.spawnInitialEnemies(playerPosition);
    }

    spawnInitialEnemies(playerPosition = null) {
        if (!this.mazeLayout) return;

        const size = this.mazeLayout.length;
        const enemyCount = Math.min(5, this.spawnSettings.maxEnemies); // Lowered to 5 for smoother start
        // Use center if no playerPosition provided
        const safePos = playerPosition || new THREE.Vector3(size/2, 0, size/2);
        for (let i = 0; i < enemyCount; i++) {
            // Find a random valid position in the maze, not near player (use larger safe zone for initial spawn)
            let position = this.findValidSpawnPosition(safePos, true, 10); // 10 units for initial spawn
            // Fallback: never spawn within 2 units of player
            if (!position) {
                // Try to find any valid path cell at least 2 units away
                for (let x = 0; x < size; x++) {
                    for (let z = 0; z < size; z++) {
                        if (this.mazeLayout[x][z] === 0) {
                            const pos = new THREE.Vector3(x + 0.5, 0, z + 0.5);
                            if (pos.distanceTo(safePos) > 2) {
                                position = pos;
                                break;
                            }
                        }
                    }
                    if (position) break;
                }
                if (!position) {
                    // As a last resort, pick any valid cell (should never happen)
                    for (let x = 0; x < size; x++) {
                        for (let z = 0; z < size; z++) {
                            if (this.mazeLayout[x][z] === 0) {
                                position = new THREE.Vector3(x + 0.5, 0, z + 0.5);
                                console.warn('Enemy forced to spawn close to player:', position, 'player:', safePos);
                                break;
                            }
                        }
                        if (position) break;
                    }
                }
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
            this.spawnEnemy(position, type);
        }
    }
    
    // minDistanceOverride allows us to set a custom minimum distance for special cases
    findValidSpawnPosition(playerPosition, enforceSafeZone = false, minDistanceOverride = null) {
        if (!this.mazeLayout) return null;

        const size = this.mazeLayout.length;
        const maxAttempts = 200;
        let attempts = 0;
        // Use override if provided, else use normal logic
        const minDistance = minDistanceOverride !== null ? minDistanceOverride : (enforceSafeZone ? 7 : this.enemyProperties.spawnDistance);
        // Center 3x3 forbidden zone
        const forbiddenZone = [];
        const center = Math.floor(size / 2);
        for (let x = center - 1; x <= center + 1; x++) {
            for (let z = center - 1; z <= center + 1; z++) {
                forbiddenZone.push(`${x},${z}`);
            }
        }
        while (attempts < maxAttempts) {
            const x = Math.floor(Math.random() * size);
            const z = Math.floor(Math.random() * size);
            if (this.mazeLayout[x][z] === 0) {
                const spawnPos = new THREE.Vector3(x + 0.5, 0, z + 0.5);
                const distanceToPlayer = spawnPos.distanceTo(playerPosition);
                // Not in forbidden zone
                if (!forbiddenZone.includes(`${x},${z}`) && distanceToPlayer > minDistance && distanceToPlayer < this.enemyProperties.spawnDistance * 2) {
                    return spawnPos;
                }
            }
            attempts++;
        }
        // Fallback: try any valid path cell outside forbidden zone
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                if (this.mazeLayout[x][z] === 0) {
                    if (!forbiddenZone.includes(`${x},${z}`)) {
                        const pos = new THREE.Vector3(x + 0.5, 0, z + 0.5);
                        if (!enforceSafeZone || pos.distanceTo(playerPosition) > minDistance) {
                            return pos;
                        }
                    }
                }
            }
        }
        return null;
    }
    
    spawnEnemy(playerPosition, type = 'BasicStalker') {
        // Check if we've reached max enemies
        if (this.enemies.length >= this.spawnSettings.maxEnemies) {
            return;
        }

        // For periodic spawns, enforce a safe zone of at least 7 units
        const position = this.findValidSpawnPosition(playerPosition, true, 7);
        if (!position) return;

        let enemy;
        switch (type) {
            case 'PackHunter':
                // Spawn a pack of hunters
                for (let i = 0; i < this.spawnSettings.packSize; i++) {
                    // Find valid position for each pack member
                    const packPosition = this.findValidSpawnPosition(position, true, 7);
                    if (!packPosition) continue;

                    enemy = new PackHunter(
                        this.scene,
                        packPosition,
                        { ...this.enemyProperties, usePathfinding: true },
                        this.enemies
                    );
                    this.enemies.push(enemy);
                }
                break;
            case 'Ambusher':
                enemy = new Ambusher(
                    this.scene,
                    position,
                    { ...this.enemyProperties, reactsToSound: true }
                );
                this.enemies.push(enemy);
                break;
            default:
                enemy = new BasicStalker(
                    this.scene,
                    position,
                    { ...this.enemyProperties, movementSpeed: 0.03 }
                );
                this.enemies.push(enemy);
        }
    }
    
    spawnEnemyAtCenter() {
        if (!this.mazeLayout) return;
        
        const center = Math.floor(this.mazeLayout.length / 2);
        const position = new THREE.Vector3(center + 0.5, 0, center + 0.5);
        
        const enemy = new BasicStalker(
            this.scene,
            position,
            { ...this.enemyProperties, movementSpeed: 0.03 }
        );
        this.enemies.push(enemy);
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
                
                const position = new THREE.Vector3(x + 0.5, 0, z + 0.5);
                const enemy = new BasicStalker(
                    this.scene,
                    position,
                    { ...this.enemyProperties, movementSpeed: 0.03 }
                );
                this.enemies.push(enemy);
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
            
            const position = new THREE.Vector3(x + 0.5, 0, z + 0.5);
            
            // Randomly choose enemy type
            const enemyTypes = ['BasicStalker', 'PackHunter', 'Ambusher'];
            const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
            
            this.spawnEnemy(position, type);
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

        // Update all enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(deltaTime, playerPosition, scanner, this.mazeLayout);

            // Check for player damage
            if (enemy.state === 'attack' && enemy.position.distanceTo(playerPosition) < 1.5 && enemy._readyToAttack) {
                player.takeDamage(enemy.properties.damage);
            }

            // Remove dead enemies
            if (enemy.properties.health <= 0) {
                this.enemiesKilled++;
                if (enemy.mesh) {
                    this.scene.remove(enemy.mesh);
                }
                this.enemies.splice(i, 1);
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
        console.log(`Enemy hit: type=${enemy.type}, before=${before}, damage=${amount}, after=${enemy.properties.health}`);
        // If dead, remove from scene and arrays
        if (enemy.properties.health <= 0) {
            this.enemiesKilled++;
            if (enemy.mesh && enemy.mesh.parent) {
                enemy.mesh.parent.remove(enemy.mesh);
            }
            // Remove from this.enemies
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
            if (enemy.mesh) {
                this.scene.remove(enemy.mesh);
            }
        }
        this.enemies = [];
    }
    
    getEnemiesKilled() {
        return this.enemiesKilled;
    }
    getTotalDamageDealt() {
        return this.totalDamageDealt;
    }
}