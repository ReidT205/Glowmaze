import * as THREE from 'three';

export class AStarPathfinding {
    static findPath(start, goal) {
        // Convert positions to grid coordinates
        const startX = Math.floor(start.x);
        const startZ = Math.floor(start.z);
        const goalX = Math.floor(goal.x);
        const goalZ = Math.floor(goal.z);

        // Initialize open and closed sets
        const openSet = new Set([`${startX},${startZ}`]);
        const closedSet = new Set();
        
        // Initialize cameFrom and gScore maps
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        // Set initial scores
        gScore.set(`${startX},${startZ}`, 0);
        fScore.set(`${startX},${startZ}`, this.heuristic(startX, startZ, goalX, goalZ));

        while (openSet.size > 0) {
            // Find node with lowest fScore
            let current = null;
            let lowestFScore = Infinity;
            for (const node of openSet) {
                const score = fScore.get(node) || Infinity;
                if (score < lowestFScore) {
                    lowestFScore = score;
                    current = node;
                }
            }

            // If we reached the goal, reconstruct and return the path
            const [currentX, currentZ] = current.split(',').map(Number);
            if (currentX === goalX && currentZ === goalZ) {
                return this.reconstructPath(cameFrom, current, start);
            }

            // Move current node from open to closed set
            openSet.delete(current);
            closedSet.add(current);

            // Check neighbors
            const neighbors = this.getNeighbors(currentX, currentZ);
            for (const neighbor of neighbors) {
                const [neighborX, neighborZ] = neighbor;
                const neighborKey = `${neighborX},${neighborZ}`;

                // Skip if neighbor is in closed set
                if (closedSet.has(neighborKey)) continue;

                // Calculate tentative gScore
                const tentativeGScore = (gScore.get(current) || Infinity) + 1;

                // If neighbor is not in open set, add it
                if (!openSet.has(neighborKey)) {
                    openSet.add(neighborKey);
                }
                // If this path to neighbor is worse than previous, skip
                else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
                    continue;
                }

                // This path is the best so far, record it
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this.heuristic(neighborX, neighborZ, goalX, goalZ));
            }
        }

        // No path found
        return [goal];
    }

    static heuristic(x1, z1, x2, z2) {
        // Manhattan distance
        return Math.abs(x1 - x2) + Math.abs(z1 - z2);
    }

    static getNeighbors(x, z) {
        // Get valid neighboring cells (assuming 8-directional movement)
        const neighbors = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dz === 0) continue;
                neighbors.push([x + dx, z + dz]);
            }
        }
        return neighbors;
    }

    static reconstructPath(cameFrom, current, start) {
        const path = [];
        let currentKey = current;
        
        while (cameFrom.has(currentKey)) {
            const [x, z] = currentKey.split(',').map(Number);
            path.unshift(new THREE.Vector3(x + 0.5, 0, z + 0.5));
            currentKey = cameFrom.get(currentKey);
        }
        
        // Add start position
        path.unshift(start);
        
        return path;
    }
}
