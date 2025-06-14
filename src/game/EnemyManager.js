import * as THREE from 'three';

export class EnemyManager {
    constructor(scene) {
        this.scene = scene;
        this.enemies = [];
        
        // Enemy properties
        this.enemyProperties = {
            health: 100,
            detectionRange: 5,
            movementSpeed: 0.02,
            damage: 15,
            spawnDistance: 8
        };
        
        // Materials
        this.materials = {
            body: new THREE.MeshBasicMaterial({ color: 0x000000 }),
            eyes: new THREE.MeshBasicMaterial({ color: 0xff0000 })
        };
    }
    
    spawnEnemy(playerPosition) {
        // Calculate random spawn position
        const angle = Math.random() * Math.PI * 2;
        const distance = this.enemyProperties.spawnDistance;
        const position = new THREE.Vector3(
            playerPosition.x + Math.cos(angle) * distance,
            0,
            playerPosition.z + Math.sin(angle) * distance
        );
        
        // Create enemy mesh
        const enemy = this.createEnemyMesh();
        enemy.position.copy(position);
        enemy.userData.health = this.enemyProperties.health;
        enemy.userData.isIlluminated = false;
        
        this.scene.add(enemy);
        this.enemies.push(enemy);
    }
    
    createEnemyMesh() {
        const group = new THREE.Group();
        
        // Body
        const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
        const body = new THREE.Mesh(bodyGeometry, this.materials.body);
        body.position.y = 1;
        group.add(body);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const leftEye = new THREE.Mesh(eyeGeometry, this.materials.eyes);
        const rightEye = new THREE.Mesh(eyeGeometry, this.materials.eyes);
        
        leftEye.position.set(-0.2, 1.2, 0.4);
        rightEye.position.set(0.2, 1.2, 0.4);
        
        group.add(leftEye);
        group.add(rightEye);
        
        return group;
    }
    
    update(deltaTime, player, scanner) {
        const playerPosition = player.getPosition();
        
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            
            // Check if enemy is illuminated
            enemy.userData.isIlluminated = this.checkIllumination(enemy, scanner);
            
            if (!enemy.userData.isIlluminated) {
                // Move towards player if in range
                const distanceToPlayer = enemy.position.distanceTo(playerPosition);
                
                if (distanceToPlayer <= this.enemyProperties.detectionRange) {
                    const direction = new THREE.Vector3()
                        .subVectors(playerPosition, enemy.position)
                        .normalize();
                    
                    enemy.position.add(
                        direction.multiplyScalar(this.enemyProperties.movementSpeed)
                    );
                    
                    // Rotate enemy to face player
                    enemy.lookAt(playerPosition);
                }
                
                // Check for collision with player
                if (distanceToPlayer < 1) {
                    player.takeDamage(this.enemyProperties.damage * deltaTime);
                }
            }
            
            // Remove dead enemies
            if (enemy.userData.health <= 0) {
                this.scene.remove(enemy);
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
        enemy.userData.health -= amount;
        
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
    
    clearEnemies() {
        for (const enemy of this.enemies) {
            this.scene.remove(enemy);
        }
        this.enemies = [];
    }
} 