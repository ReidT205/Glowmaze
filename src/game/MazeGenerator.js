import * as THREE from 'three';

export class MazeGenerator {
    constructor() {
        this.mazeSize = 20;
        this.wallHeight = 2;
        this.floorY = -1;
        this.ceilingY = 3;
        this.layout = null; // Store maze layout for minimap and gameplay
        this.materials = null; // Will be set per theme
    }
    
    generateMaze(scene, theme, level = 1) {
        // Scale maze size with level
        this.mazeSize = 20 + 2 * (level - 1);
        // Set materials based on theme
        this.materials = {
            wall: new THREE.MeshStandardMaterial({
                color: theme?.wall?.color ?? 0x333333,
                roughness: 0.5,
                metalness: 0.3,
                emissive: theme?.wall?.color ?? 0x333333,
                emissiveIntensity: 0.2,
                opacity: 1,
                transparent: false
            }),
            floor: new THREE.MeshStandardMaterial({
                color: theme?.floor?.color ?? 0x0a0a0a,
                roughness: 0.8,
                metalness: 0.1
            }),
            ceiling: new THREE.MeshStandardMaterial({
                color: theme?.ceiling?.color ?? 0x0a0a0a,
                roughness: 0.8,
                metalness: 0.1,
                side: THREE.DoubleSide // Make ceiling visible from both sides
            })
        };
        // Generate maze layout
        const maze = this.generateMazeLayout();
        this.layout = maze;
        // Create floor
        this.createFloor(scene);
        // Create ceiling
        this.createCeiling(scene);
        // Create walls
        this.createWalls(scene, maze);
    }
    
    generateMazeLayout() {
        const size = this.mazeSize;
        const maze = Array(size).fill().map(() => Array(size).fill(1));
        
        // Start with all walls
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                maze[x][z] = 1;
            }
        }
        
        // Generate paths using recursive backtracking
        const startX = Math.floor(size / 2);
        const startZ = Math.floor(size / 2);
        this.carvePath(maze, startX, startZ);
        
        // Ensure center is clear for player spawn
        const center = Math.floor(size / 2);
        for (let x = center - 1; x <= center + 1; x++) {
            for (let z = center - 1; z <= center + 1; z++) {
                maze[x][z] = 0;
            }
        }
        
        return maze;
    }
    
    carvePath(maze, x, z) {
        maze[x][z] = 0;
        
        const directions = [
            [0, 2],  // North
            [2, 0],  // East
            [0, -2], // South
            [-2, 0]  // West
        ];
        
        // Shuffle directions
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }
        
        // Try each direction
        for (const [dx, dz] of directions) {
            const newX = x + dx;
            const newZ = z + dz;
            
            if (this.isValidPosition(newX, newZ) && maze[newX][newZ] === 1) {
                // Carve path
                maze[x + dx/2][z + dz/2] = 0;
                this.carvePath(maze, newX, newZ);
            }
        }
    }
    
    isValidPosition(x, z) {
        return x > 0 && x < this.mazeSize - 1 && z > 0 && z < this.mazeSize - 1;
    }
    
    createFloor(scene) {
        const geometry = new THREE.PlaneGeometry(
            this.mazeSize,
            this.mazeSize
        );
        const floor = new THREE.Mesh(geometry, this.materials.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(
            this.mazeSize / 2 - 0.5,
            this.floorY,
            this.mazeSize / 2 - 0.5
        );
        floor.receiveShadow = true;
        scene.add(floor);
    }
    
    createCeiling(scene) {
        // Increase ceiling size by 4x for better sky visibility
        const ceilingSize = this.mazeSize * 4;
        const geometry = new THREE.PlaneGeometry(
            ceilingSize,
            ceilingSize
        );
        const ceiling = new THREE.Mesh(geometry, this.materials.ceiling);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(
            this.mazeSize / 2 - 0.5,
            this.ceilingY,
            this.mazeSize / 2 - 0.5
        );
        ceiling.receiveShadow = true;
        scene.add(ceiling);
    }
    
    createWalls(scene, maze) {
        const wallGeometry = new THREE.BoxGeometry(1, this.wallHeight, 1);
        
        for (let x = 0; x < this.mazeSize; x++) {
            for (let z = 0; z < this.mazeSize; z++) {
                if (maze[x][z] === 1) {
                    const wall = new THREE.Mesh(wallGeometry, this.materials.wall);
                    wall.position.set(
                        x,
                        this.wallHeight / 2 + this.floorY,
                        z
                    );
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    wall.userData.type = 'wall';
                    scene.add(wall);
                }
            }
        }
    }
    
    getPlayerSpawnPosition() {
        const center = this.mazeSize / 2;
        return new THREE.Vector3(
            center,
            this.floorY + 1.6, // Player height
            center
        );
    }
    
    getMazeLayout() {
        return this.layout;
    }
} 