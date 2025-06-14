import * as THREE from 'three';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        
        // Player properties
        this.height = 0.2; // Lowered further so user can't see over walls
        this.radius = 0.3;
        this.normalSpeed = 8; // Reduced from 15
        this.sprintSpeed = 15; // Reduced from 25
        this.acceleration = 40; // Reduced from 50
        this.deceleration = 25; // Reduced from 30
        
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

        // Rotation tracking
        this.rotation = 0; // Initial rotation (facing forward)
        this.targetRotation = 0; // Target rotation for smooth turning
        this.rotationSpeed = 5; // Rotation speed multiplier
    }
    
    update(deltaTime, inputManager) {
        // Always keep camera at correct height
        this.camera.position.y = this.height;
        
        // Update movement state from input
        this.moveForward = inputManager.keys.has('w');
        this.moveBackward = inputManager.keys.has('s');
        this.moveLeft = inputManager.keys.has('a');
        this.moveRight = inputManager.keys.has('d');
        this.canSprint = inputManager.keys.has('shift');
        
        // Get camera direction
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        
        // Calculate movement direction relative to camera
        this.direction.set(0, 0, 0);
        
        if (this.moveForward) {
            this.direction.add(cameraDirection);
        }
        if (this.moveBackward) {
            this.direction.sub(cameraDirection);
        }
        if (this.moveLeft) {
            this.direction.add(new THREE.Vector3(-cameraDirection.z, 0, -cameraDirection.x));
        }
        if (this.moveRight) {
            this.direction.add(new THREE.Vector3(cameraDirection.z, 0, cameraDirection.x));
        }
        
        // Normalize direction if moving
        if (this.direction.length() > 0) {
            this.direction.normalize();
        }
        
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
        
        // Update rotation - store raw camera rotation without any modifications
        this.rotation = this.camera.rotation.y;
        
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

    getRotation() {
        return this.rotation;
    }

    getRotationDelta() {
        return this.rotation - this.targetRotation;
    }
} 