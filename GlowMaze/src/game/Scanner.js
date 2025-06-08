import * as THREE from 'three';

export class Scanner {
    constructor(scene) {
        this.scene = scene;
        
        // Scanner properties
        this.scanPoints = 25;
        this.maxDots = 100;
        this.dotLifetime = 20;
        this.scanCost = 10;
        this.scanCooldown = 0.5;
        this.lastScanTime = 0;
        
        // Colors
        this.colors = {
            wall: new THREE.Color(0x00ffff),    // Cyan
            floor: new THREE.Color(0x0000ff),   // Blue
            ceiling: new THREE.Color(0xff8000)  // Orange
        };
        
        // Dot pool
        this.dotPool = [];
        this.activeDots = [];
        this.initializeDotPool();
        
        // Scanner line
        this.scanLine = this.createScanLine();
        this.scene.add(this.scanLine);
        this.isScanning = false;
        this.scanProgress = 0;
    }
    
    initializeDotPool() {
        const dotGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        
        for (let i = 0; i < this.maxDots; i++) {
            const dot = new THREE.Mesh(
                dotGeometry,
                new THREE.MeshBasicMaterial({
                    color: this.colors.wall,
                    transparent: true,
                    opacity: 0.8
                })
            );
            dot.visible = false;
            dot.userData.lifetime = 0;
            this.scene.add(dot);
            this.dotPool.push(dot);
        }
    }
    
    createScanLine() {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.5
        });
        
        const line = new THREE.Line(geometry, material);
        line.visible = false;
        return line;
    }
    
    update(deltaTime) {
        // Update scan line
        if (this.isScanning) {
            this.scanProgress += deltaTime * 2;
            if (this.scanProgress >= 1) {
                this.isScanning = false;
                this.scanLine.visible = false;
            }
            this.updateScanLine();
        }
        
        // Update dots
        for (let i = this.activeDots.length - 1; i >= 0; i--) {
            const dot = this.activeDots[i];
            dot.userData.lifetime += deltaTime;
            
            // Fade out dots
            const opacity = 1 - (dot.userData.lifetime / this.dotLifetime);
            dot.material.opacity = opacity * 0.8;
            
            // Remove expired dots
            if (dot.userData.lifetime >= this.dotLifetime) {
                this.recycleDot(dot);
                this.activeDots.splice(i, 1);
            }
        }
    }
    
    scan(camera, gameState) {
        const currentTime = performance.now() / 1000;
        if (currentTime - this.lastScanTime < this.scanCooldown) return;
        if (!gameState.useEnergy(this.scanCost)) return;
        
        this.lastScanTime = currentTime;
        this.isScanning = true;
        this.scanProgress = 0;
        this.scanLine.visible = true;
        
        // Calculate scan points
        const points = this.calculateScanPoints(camera);
        
        // Create dots for each point
        for (const point of points) {
            if (this.activeDots.length >= this.maxDots) break;
            
            const dot = this.getDotFromPool();
            if (dot) {
                dot.position.copy(point.position);
                dot.material.color.copy(this.getColorForSurface(point.surface));
                dot.visible = true;
                dot.userData.lifetime = 0;
                this.activeDots.push(dot);
            }
        }
    }
    
    calculateScanPoints(camera) {
        const points = [];
        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3();
        
        // Calculate scan line position
        const scanHeight = -0.5 + this.scanProgress;
        const scanWidth = 1;
        
        for (let i = 0; i < this.scanPoints; i++) {
            const x = (i / (this.scanPoints - 1) - 0.5) * scanWidth;
            
            // Set ray direction
            direction.set(x, scanHeight, -1).normalize();
            raycaster.set(camera.position, direction);
            
            // Cast ray
            const intersects = raycaster.intersectObjects(this.scene.children, true);
            
            if (intersects.length > 0) {
                const intersect = intersects[0];
                points.push({
                    position: intersect.point,
                    surface: this.determineSurface(intersect.face.normal)
                });
            }
        }
        
        return points;
    }
    
    determineSurface(normal) {
        const up = new THREE.Vector3(0, 1, 0);
        const dot = normal.dot(up);
        
        if (Math.abs(dot) > 0.9) {
            return dot > 0 ? 'ceiling' : 'floor';
        }
        return 'wall';
    }
    
    getColorForSurface(surface) {
        return this.colors[surface] || this.colors.wall;
    }
    
    getDotFromPool() {
        for (const dot of this.dotPool) {
            if (!dot.visible) {
                return dot;
            }
        }
        return null;
    }
    
    recycleDot(dot) {
        dot.visible = false;
        dot.material.opacity = 0.8;
    }
    
    updateScanLine() {
        const positions = new Float32Array(6);
        const scanHeight = -0.5 + this.scanProgress;
        
        // Update scan line vertices
        positions[0] = -0.5; positions[1] = scanHeight; positions[2] = -1;
        positions[3] = 0.5; positions[4] = scanHeight; positions[5] = -1;
        
        this.scanLine.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );
        this.scanLine.geometry.attributes.position.needsUpdate = true;
    }
    
    getActiveDotCount() {
        return this.activeDots.length;
    }
} 