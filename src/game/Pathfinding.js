import * as THREE from 'three';

export class AStarPathfinding {
    static findPath(start, goal) {
        // Convert positions to grid coordinates
        const startX = Math.floor(start.x);
        const startZ = Math.floor(start.z);
        const goalX = Math.floor(goal.x);
        const goalZ = Math.floor(goal.z);

        const layout = (typeof window !== 'undefined' && window.game && window.game.mazeGenerator && window.game.mazeGenerator.getMazeLayout)
            ? window.game.mazeGenerator.getMazeLayout()
            : null;

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

        // Quick bounds guard
        const inBounds = (x, z) => {
            if (!layout) return true;
            return x >= 0 && z >= 0 && x < layout.length && z < layout.length && layout[x][z] === 0;
        };

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

            if (!current) {
                break;
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
            for (const [neighborX, neighborZ, stepCost] of neighbors) {
                const neighborKey = `${neighborX},${neighborZ}`;

                // Skip invalid or closed
                if (!inBounds(neighborX, neighborZ) || closedSet.has(neighborKey)) continue;

                // Base movement cost (1 for ortho, ~1.4 for diagonal)
                let baseCost = stepCost;
                const tentativeGScore = (gScore.get(current) || Infinity) + baseCost;

                // If neighbor is not in open set, add it
                if (!openSet.has(neighborKey)) {
                    openSet.add(neighborKey);
                } else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
                    // Worse than previously known route
                    continue;
                }

                // This path is the best so far, record it
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(
                    neighborKey,
                    tentativeGScore + this.heuristic(neighborX, neighborZ, goalX, goalZ)
                );
            }
        }

        // No path found: fallback to goal (straight move)
        return [goal];
    }

    static heuristic(x1, z1, x2, z2) {
        // Use octile distance for 8-directional movement
        const dx = Math.abs(x1 - x2);
        const dz = Math.abs(z1 - z2);
        const D = 1;
        const D2 = Math.SQRT2;
        return D * (dx + dz) + (D2 - 2 * D) * Math.min(dx, dz);
    }

    static getNeighbors(x, z) {
        // 8-directional neighbors with per-step cost
        const dirs = [
            [1, 0, 1],
            [-1, 0, 1],
            [0, 1, 1],
            [0, -1, 1],
            [1, 1, Math.SQRT2],
            [1, -1, Math.SQRT2],
            [-1, 1, Math.SQRT2],
            [-1, -1, Math.SQRT2]
        ];
        const res = [];
        for (const [dx, dz, c] of dirs) {
            res.push([x + dx, z + dz, c]);
        }
        return res;
    }

    static reconstructPath(cameFrom, current, start) {
        const path = [];
        let currentKey = current;
        
        while (cameFrom.has(currentKey)) {
            const [x, z] = currentKey.split(',').map(Number);
            path.unshift(new THREE.Vector3(x, 0, z));
            currentKey = cameFrom.get(currentKey);
        }
        
        // Add start position
        path.unshift(start);
        
        return path;
    }
}
