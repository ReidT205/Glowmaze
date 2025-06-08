import * as THREE from 'three';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Player properties
        this.height = 1.6;
        this.radius = 0.3;
        this.normalSpeed = 15;
        this.sprintSpeed = 25;
        this.acceleration = 50;
        this.deceleration = 30;
        
        // Movement state
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canSprint = true;
        
        // Physics
        this.gravity = 20;
        this.jumpForce = 10;
        this.isGrounded = true;
        
        // Initialize player position
        this.camera.position.set(0, this.height, 0);
        
        // Create collision box
        this.collider = new THREE.Box3(
            new THREE.Vector3(-this.radius, 0, -this.radius),
            new THREE.Vector3(this.radius, this.height, this.radius)
        );
    }
    
    update(deltaTime, inputManager) {
        // Update movement state from input
        this.moveForward = inputManager.keys.has('w');
        this.moveBackward = inputManager.keys.has('s');
        this.moveLeft = inputManager.keys.has('a');
        this.moveRight = inputManager.keys.has('d');
        this.canSprint = inputManager.keys.has('shift');
        
        // Calculate movement direction
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();
        
        // Apply movement
        const speed = this.canSprint ? this.sprintSpeed : this.normalSpeed;
        const targetVelocity = this.direction.multiplyScalar(speed);
        
        // Smooth acceleration/deceleration
        this.velocity.x = THREE.MathUtils.lerp(
            this.velocity.x,
            targetVelocity.x,
            deltaTime * this.acceleration
        );
        this.velocity.z = THREE.MathUtils.lerp(
            this.velocity.z,
            targetVelocity.z,
            deltaTime * this.acceleration
        );
        
        // Apply gravity
        if (!this.isGrounded) {
            this.velocity.y -= this.gravity * deltaTime;
        }
        
        // Update position
        const moveX = this.velocity.x * deltaTime;
        const moveZ = this.velocity.z * deltaTime;
        
        // Check collisions before moving
        this.checkCollisions(moveX, moveZ);
        
        // Update collider position
        this.updateCollider();
    }
    
    checkCollisions(moveX, moveZ) {
        // Create temporary collider for collision detection
        const tempCollider = this.collider.clone();
        
        // Check X movement
        tempCollider.min.x += moveX;
        tempCollider.max.x += moveX;
        if (!this.checkColliderCollision(tempCollider)) {
            this.camera.position.x += moveX;
        }
        
        // Check Z movement
        tempCollider.min.x = this.collider.min.x;
        tempCollider.max.x = this.collider.max.x;
        tempCollider.min.z += moveZ;
        tempCollider.max.z += moveZ;
        if (!this.checkColliderCollision(tempCollider)) {
            this.camera.position.z += moveZ;
        }
    }
    
    checkColliderCollision(collider) {
        // Get all wall objects in the scene
        const walls = this.scene.children.filter(
            child => child.userData.type === 'wall'
        );
        
        // Check collision with each wall
        for (const wall of walls) {
            const wallBox = new THREE.Box3().setFromObject(wall);
            if (collider.intersectsBox(wallBox)) {
                return true;
            }
        }
        
        return false;
    }
    
    updateCollider() {
        const position = this.camera.position;
        this.collider.min.set(
            position.x - this.radius,
            position.y - this.height,
            position.z - this.radius
        );
        this.collider.max.set(
            position.x + this.radius,
            position.y,
            position.z + this.radius
        );
    }
    
    getPosition() {
        return this.camera.position.clone();
    }
    
    getDirection() {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        return direction;
    }
} 