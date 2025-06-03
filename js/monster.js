import * as THREE from 'three';

export class Monster {
    constructor(scene, position) {
        this.scene = scene;
        this.position = position;
        this.speed = 0.02;
        this.detectionRange = 5;
        this.health = 100;
        
        // Create monster mesh
        this.geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
        this.material = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
        
        // Add glowing eyes
        this.eyeLight = new THREE.PointLight(0xff0000, 1, 2);
        this.eyeLight.position.set(0, 0.5, 0.25);
        this.mesh.add(this.eyeLight);
    }
    
    update(playerPosition, glowMarkers) {
        // Calculate distance to player
        const distanceToPlayer = this.position.distanceTo(playerPosition);
        
        // Check if player is in detection range
        if (distanceToPlayer < this.detectionRange) {
            // Move towards player
            const direction = new THREE.Vector3().subVectors(playerPosition, this.position).normalize();
            this.position.add(direction.multiplyScalar(this.speed));
        } else {
            // Wander randomly
            this.position.x += (Math.random() - 0.5) * this.speed;
            this.position.z += (Math.random() - 0.5) * this.speed;
        }
        
        // Update mesh position
        this.mesh.position.copy(this.position);
        
        // Check for glow marker proximity
        for (const marker of glowMarkers) {
            const distanceToMarker = this.position.distanceTo(marker.position);
            if (distanceToMarker < 2) {
                // Move away from glow markers
                const direction = new THREE.Vector3().subVectors(this.position, marker.position).normalize();
                this.position.add(direction.multiplyScalar(this.speed * 2));
            }
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.scene.remove(this.mesh);
        this.scene.remove(this.eyeLight);
    }
} 