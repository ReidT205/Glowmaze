import * as THREE from 'three';
import { Enemy, BasicStalker, PackHunter, Ambusher } from './Enemy';
import { AStarPathfinding } from './Pathfinding';

export class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        this.mazeLayout = null;
        this.enemiesKilled = 0;
        
        // Enemy properties
        this.enemyProperties = {
            health: 50,
            detectionRange: 5,
            movementSpeed: 0.02,
            damage: 10, // Increased damage
            spawnDistance: 8
        };
        
        // Spawn settings
        this.spawnSettings = {
            maxEnemies: 15, // Increased from 10
            spawnInterval: 15, // Reduced from 30 seconds
            lastSpawnTime: 0,
            packSize: 3,
            ambushChance: 0.3
        };
    }

    setMazeLayout(layout) {
        this.mazeLayout = layout;
        // Spawn initial enemies when maze is set
        this.spawnInitialEnemies();
    }

    spawnInitialEnemies() {
        if (!this.mazeLayout) return;

        const size = this.mazeLayout.length;
        const enemyCount = Math.min(10, this.spawnSettings.maxEnemies); // Increased from 5

        for (let i = 0; i < enemyCount; i++) {
            // Find a random valid position in the maze
            const position = this.findValidSpawnPosition(new THREE.Vector3(size/2, 0, size/2));
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
    
    findValidSpawnPosition(playerPosition) {
        if (!this.mazeLayout) return null;

        const size = this.mazeLayout.length;
        const maxAttempts = 100; // Increased from 50
        let attempts = 0;

        while (attempts < maxAttempts) {
            // Generate random position within maze bounds
            const x = Math.floor(Math.random() * size);
            const z = Math.floor(Math.random() * size);

            // Check if position is a valid path (0) and not too close to player
            if (this.mazeLayout[x][z] === 0) {
                const spawnPos = new THREE.Vector3(x + 0.5, 0, z + 0.5);
                const distanceToPlayer = spawnPos.distanceTo(playerPosition);
                
                // Ensure minimum distance from player but not too far
                if (distanceToPlayer > this.enemyProperties.spawnDistance && 
                    distanceToPlayer < this.enemyProperties.spawnDistance * 2) {
                    return spawnPos;
                }
            }
            attempts++;
        }

        // If no valid position found, try any valid path position
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                if (this.mazeLayout[x][z] === 0) {
                    return new THREE.Vector3(x + 0.5, 0, z + 0.5);
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

        // Find valid spawn position
        const position = this.findValidSpawnPosition(playerPosition);
        if (!position) return;

        let enemy;
        switch (type) {
            case 'PackHunter':
                // Spawn a pack of hunters
                for (let i = 0; i < this.spawnSettings.packSize; i++) {
                    // Find valid position for each pack member
                    const packPosition = this.findValidSpawnPosition(position);
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
            if (enemy.state === 'attack' && enemy.position.distanceTo(playerPosition) < 1.5) {
                player.takeDamage(enemy.properties.damage * deltaTime);
            }

            // Remove dead enemies
            if (enemy.properties.health <= 0) {
                this.enemiesKilled++;
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
    
    damageEnemy(enemy, amount) {
        enemy.properties.health -= amount;
        
        // Apply knockback
        const knockbackForce = 0.5;
        const randomDirection = new THREE.Vector3(
            Math.random() - 0.5,
            0,
            Math.random() - 0.5
        ).normalize();
        
        enemy.position.add(randomDirection.multiplyScalar(knockbackForce));
    }
    
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
    
    getEnemies() {
        return this.enemies;
    }

    getEnemiesKilled() {
        return this.enemiesKilled;
    }
}