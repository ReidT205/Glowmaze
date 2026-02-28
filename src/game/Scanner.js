import * as THREE from 'three';
import { InfluenceMap } from './InfluenceMap';

const DEFAULT_SCAN_TYPE = 'standard';
const DOT_LIGHT_INTENSITY = 1.5;
const DOT_LIGHT_RADIUS = 4.5;
const ENEMY_HIT_RADIUS_SQ = 0.16; // 0.4^2
const EPSILON = 1e-6;
const WALL_TYPES = new Set(['wall']);

const createHitRecord = () => ({
    position: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    distance: 0
});

export class Scanner {
    constructor(scene, getPlayerColor, camera, initialType = DEFAULT_SCAN_TYPE) {
        this.scene = scene;
        this.getPlayerColor = getPlayerColor;
        this.camera = camera;

        this.scannerTypes = {
            focused:  { scanPoints: 40,  scanWidth: 2.5, scanHeight: 1.2, scanCost: 7,  scanCooldown: 0.3 },
            standard: { scanPoints: 75,  scanWidth: 6,   scanHeight: 2.5, scanCost: 10, scanCooldown: 0.5 },
            wide:     { scanPoints: 120, scanWidth: 12,  scanHeight: 4.5, scanCost: 18, scanCooldown: 0.7 }
        };
        this.scannerTypeOrder = ['focused', 'standard', 'wide'];
        this.currentScannerType = initialType;
        this.applyScannerType(initialType);

        this.maxDots = 20000;
        this.dotRadius = 0.015;

        this.dotsGroup = new THREE.Group();
        this.dotsGroup.name = 'ScannerDots';
        this.scene.add(this.dotsGroup);

        this._initDotRendering();

        this.recentDotLimit = 800;
        this.recentDots = [];
        this._recentPool = [];

        this.lastScanTime = 0;
        this.isScanning = false;
        this.scanProgress = 0;

        this._rayNear = 0.05;
        this._rayFar = 30;
        this._raycaster = new THREE.Raycaster(undefined, undefined, this._rayNear, this._rayFar);
        this._localDirection = new THREE.Vector3();
        this._worldDirection = new THREE.Vector3();
        this._matrixScratch = new THREE.Matrix4();
        this._identityQuat = new THREE.Quaternion();
        this._scaleOne = new THREE.Vector3(1, 1, 1);
        this._scaleZero = new THREE.Vector3(0, 0, 0);
        this._colorScratch = new THREE.Color();
        this._firstDotScratch = new THREE.Vector3();
        this._tmpVec = new THREE.Vector3();
        this._tmpVec2 = new THREE.Vector3();
        this._normalMatrix = new THREE.Matrix3();

        this._currentDotColor = new THREE.Color(0x00ffff);
        this._hitResult = createHitRecord();
        this._wallHit = createHitRecord();
        this._floorHit = createHitRecord();
        this._ceilingHit = createHitRecord();

        this._enemyRefs = [];
        this._enemyPositions = [];
        this._enemyHits = [];

        this._staticGeometry = [];
        this._sceneStamp = -1;

        this._mazeData = null;
        this._mazeLayoutRef = null;
        this._mazeBoundsMin = new THREE.Vector3();
        this._mazeBoundsMax = new THREE.Vector3();
        this._mazeMarchLimit = 0;
        this._floorY = -1;
        this._ceilingY = 3;

        this.scanLine = this._createScanLine();
        this.scene.add(this.scanLine);
    }

    _initDotRendering() {
        const geometry = new THREE.SphereGeometry(this.dotRadius, 10, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: false,
            opacity: 1,
            depthWrite: false,
            depthTest: true,
            side: THREE.FrontSide,
            blending: THREE.NormalBlending,
            vertexColors: true,
            toneMapped: false
        });
        this.dotMaterial = material;
        this.dotMesh = new THREE.InstancedMesh(geometry, material, this.maxDots);
        this.dotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.dotMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.maxDots * 3), 3);
        this.dotMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.dotMesh.count = 0;
        this.dotMesh.frustumCulled = false;
        this.dotMesh.visible = true;
        this.dotMesh.renderOrder = 5;
        this.dotsGroup.add(this.dotMesh);

        this._dotRecords = new Array(this.maxDots);
        this._freeSlots = [];
        this.activeDots = [];
        for (let i = this.maxDots - 1; i >= 0; i--) {
            this._dotRecords[i] = {
                index: i,
                position: new THREE.Vector3(),
                active: false
            };
            this._freeSlots.push(i);
        }
        this._maxActiveIndex = -1;
    }

    _createScanLine() {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 });
        material.color.copy(this._currentDotColor);
        this._scanLineMaterial = material;
        const line = new THREE.Line(geometry, material);
        line.visible = false;
        return line;
    }

    _normalizeColorInput(value, target = this._colorScratch) {
        const color = target;

        if (value instanceof THREE.Color) {
            color.copy(value);
        } else if (typeof value === 'number' || typeof value === 'string') {
            try {
                color.set(value);
            } catch (err) {
                color.set(0x00ffff);
            }
        } else if (value && typeof value === 'object') {
            const { r, g, b } = value;
            if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
                color.setRGB(r, g, b);
            } else {
                color.set(0x00ffff);
            }
        } else {
            color.set(0x00ffff);
        }

        return color;
    }

    _resolvePlayerColor() {
        const playerColor = this.getPlayerColor ? this.getPlayerColor() : null;
        return this._normalizeColorInput(playerColor);
    }

    _applyColorToActiveDots(color) {
        if (!this.dotMesh || !this.activeDots.length) return;
        for (let i = 0; i < this.activeDots.length; i++) {
            const record = this.activeDots[i];
            if (!record || !record.active) continue;
            this.dotMesh.setColorAt(record.index, color);
        }
        this.dotMesh.instanceColor.needsUpdate = true;
    }

    _updateScanLineColor(color) {
        if (this._scanLineMaterial) {
            this._scanLineMaterial.color.copy(color);
            this._scanLineMaterial.needsUpdate = true;
        }
    }

    _applyResolvedColor(color) {
        if (!color) return;
        if (this._currentDotColor.r !== color.r || this._currentDotColor.g !== color.g || this._currentDotColor.b !== color.b) {
            this._currentDotColor.copy(color);
            this._applyColorToActiveDots(this._currentDotColor);
            this._updateScanLineColor(this._currentDotColor);
            if (this.dotMaterial) {
                this.dotMaterial.color.copy(this._currentDotColor);
                this.dotMaterial.needsUpdate = true;
            }
        }
    }

    setScannerColor(colorValue) {
        const resolved = this._normalizeColorInput(colorValue);
        this._applyResolvedColor(resolved);
    }

    applyScannerType(type) {
        const t = this.scannerTypes[type] || this.scannerTypes[DEFAULT_SCAN_TYPE];
        this.scanPoints = t.scanPoints;
        this.scanWidth = t.scanWidth;
        this.scanHeight = t.scanHeight;
        this.scanCost = t.scanCost;
        this.scanCooldown = t.scanCooldown;
        this.currentScannerType = type;
    }

    cycleScannerType(gameState) {
        const switchCost = 15;
        if (!gameState || gameState.playerEnergy < switchCost) return false;
        if (!gameState.useEnergy(switchCost)) return false;
        const idx = this.scannerTypeOrder.indexOf(this.currentScannerType);
        const nextIdx = (idx + 1) % this.scannerTypeOrder.length;
        const nextType = this.scannerTypeOrder[nextIdx];
        this.applyScannerType(nextType);
        return true;
    }

    getCurrentScannerType() {
        return this.currentScannerType;
    }

    getRecentDots() {
        return this.recentDots;
    }

    getActiveDotCount() {
        return this.activeDots.length;
    }

    setStaticGeometry(objects) {
        if (!Array.isArray(objects)) return;
        this._staticGeometry = objects.filter(obj => obj && WALL_TYPES.has(obj.userData?.type));
        this._sceneStamp = this.scene.children.length;
    }

    _refreshStaticGeometry(force = false) {
        const stamp = this.scene.children.length;
        if (!force && stamp === this._sceneStamp) return;
        this._sceneStamp = stamp;
        this._staticGeometry = this.scene.children.filter(obj => obj && WALL_TYPES.has(obj.userData?.type));
    }

    _ensureMazeData(force = false) {
        const generator = window?.game?.mazeGenerator;
        const layout = generator?.layout || generator?.getMazeLayout?.();
        if (!layout) {
            if (force) {
                this._mazeData = null;
                this._mazeLayoutRef = null;
            }
            return false;
        }
        if (!force && this._mazeLayoutRef === layout) {
            return true;
        }
        const mazeSize = layout.length;
        const floorY = generator?.floorY ?? this._floorY;
        const wallHeight = generator?.wallHeight ?? Math.max(0, (generator?.ceilingY ?? this._ceilingY) - floorY);
        const ceilingY = generator?.ceilingY ?? (floorY + wallHeight);

        this._mazeData = {
            layout,
            mazeSize,
            floorY,
            ceilingY,
            wallHeight
        };
        this._mazeLayoutRef = layout;
        this._mazeBoundsMin.set(-0.5, floorY, -0.5);
        this._mazeBoundsMax.set(mazeSize - 0.5, floorY + wallHeight, mazeSize - 0.5);
        this._mazeMarchLimit = Math.max(mazeSize * 4, 64);
        this._floorY = floorY;
        this._ceilingY = ceilingY;

        this._rayFar = Math.max(30, mazeSize * 1.5);
        this._raycaster.near = this._rayNear;
        this._raycaster.far = this._rayFar;
        return true;
    }

    scan(camera, gameState) {
        if (!window.game || !window.game.enemyManager) return;
        const now = performance.now() / 1000;
        if (now - this.lastScanTime < this.scanCooldown) return;
        if (!gameState || gameState.playerEnergy < this.scanCost) return;
        if (!gameState.useEnergy(this.scanCost)) return;
        this.lastScanTime = now;

        if (window.game.soundManager?.playScannerSound) {
            window.game.soundManager.playScannerSound();
        }

        if (!this.scanLine.parent) {
            this.scene.add(this.scanLine);
        }
        this.scanLine.visible = true;

        this._ensureMazeData(true);
        if (!this._staticGeometry.length) {
            this._refreshStaticGeometry();
        }

        const enemies = (window.game.enemyManager.getEnemies && window.game.enemyManager.getEnemies()) || [];
        const enemyCount = this._prepareEnemyCache(enemies);

        const cameraPos = camera.position;
        const cameraQuat = camera.quaternion;
        const resolvedColor = this._resolvePlayerColor();
        this._applyResolvedColor(resolvedColor);
        const color = this._currentDotColor;

        let placedAny = false;
        let firstDotRecorded = false;
        const firstDot = this._firstDotScratch;

        const hit = this._hitResult;

        for (let i = 0; i < this.scanPoints; i++) {
            const angle = (Math.random() - 0.5) * Math.PI / 3;
            const y = (Math.random() - 0.5) * this.scanHeight;
            const x = Math.sin(angle) * this.scanWidth * Math.random();
            const z = -Math.cos(angle) * (2 + Math.random() * 8);

            this._localDirection.set(x, y, z);
            this._worldDirection.copy(this._localDirection).applyQuaternion(cameraQuat);
            const lenSq = this._worldDirection.lengthSq();
            if (lenSq < EPSILON) continue;
            this._worldDirection.multiplyScalar(1 / Math.sqrt(lenSq));

            if (!this._resolveHit(cameraPos, this._worldDirection, hit)) continue;

            if (this._placeDot(hit.position, hit.normal, color)) {
                placedAny = true;
                if (!firstDotRecorded) {
                    firstDot.copy(hit.position);
                    firstDotRecorded = true;
                }
                this._accumulateEnemyHits(hit.position, enemyCount);
            }
        }

        if (placedAny) {
            this.dotMesh.instanceMatrix.needsUpdate = true;
            this.dotMesh.instanceColor.needsUpdate = true;
        }

        let anyHit = false;
        if (enemyCount > 0 && window.game.enemyManager?.damageEnemy) {
            for (let i = 0; i < enemyCount; i++) {
                const hits = this._enemyHits[i];
                if (hits > 0) {
                    anyHit = true;
                    window.game.enemyManager.damageEnemy(this._enemyRefs[i], hits);
                }
            }
        }

        if (anyHit && window.game.soundManager?.playMonsterDetectSound) {
            window.game.soundManager.playMonsterDetectSound();
        }

        if (firstDotRecorded && window?.game?.gameState?.emit) {
            window.game.gameState.emit('LightPulsed', { position: firstDot.clone() });
        }
    }

    _resolveHit(origin, direction, out) {
        if (this._mazeData && this._mazeData.layout && this._castWithMazeData(origin, direction, out)) {
            return true;
        }
        return this._raycastAgainstGeometry(origin, direction, out);
    }

    _castWithMazeData(origin, direction, out) {
        const bounds = this._intersectBounds(origin, direction);
        let hasHit = false;

        if (bounds && this._marchMazeWalls(origin, direction, bounds.entry, bounds.exit, this._wallHit)) {
            this._assignHit(out, this._wallHit);
            hasHit = true;
        }

        if (this._intersectHorizontalPlane(origin, direction, this._floorY, 1, this._floorHit)) {
            if (!hasHit || this._floorHit.distance < out.distance) {
                this._assignHit(out, this._floorHit);
                hasHit = true;
            }
        }

        if (this._intersectHorizontalPlane(origin, direction, this._ceilingY, -1, this._ceilingHit)) {
            if (!hasHit || this._ceilingHit.distance < out.distance) {
                this._assignHit(out, this._ceilingHit);
                hasHit = true;
            }
        }

        return hasHit;
    }

    _assignHit(target, source) {
        target.position.copy(source.position);
        target.normal.copy(source.normal);
        target.distance = source.distance;
    }

    _intersectBounds(origin, direction) {
        if (!this._mazeData) return null;
        let tmin = -Infinity;
        let tmax = Infinity;
        const min = this._mazeBoundsMin;
        const max = this._mazeBoundsMax;

        for (const axis of ['x', 'y', 'z']) {
            const dir = direction[axis];
            const orig = origin[axis];
            if (Math.abs(dir) < EPSILON) {
                if (orig < min[axis] || orig > max[axis]) {
                    return null;
                }
                continue;
            }
            const inv = 1 / dir;
            let t1 = (min[axis] - orig) * inv;
            let t2 = (max[axis] - orig) * inv;
            if (t1 > t2) {
                const temp = t1;
                t1 = t2;
                t2 = temp;
            }
            tmin = Math.max(tmin, t1);
            tmax = Math.min(tmax, t2);
            if (tmax < tmin) return null;
        }

        return { entry: tmin, exit: tmax };
    }

    _marchMazeWalls(origin, direction, entry, exit, out) {
        const data = this._mazeData;
        if (!data || data.mazeSize === 0) return false;
        const { layout, mazeSize, floorY, wallHeight } = data;

        const dirX = direction.x;
        const dirZ = direction.z;
        if (Math.abs(dirX) < EPSILON && Math.abs(dirZ) < EPSILON) return false;

        const startDistance = Math.max(this._rayNear, entry);
        if (startDistance > exit || startDistance > this._rayFar) return false;

        this._tmpVec.copy(origin).addScaledVector(direction, startDistance);
        let gridX = this._tmpVec.x + 0.5;
        let gridZ = this._tmpVec.z + 0.5;

        let cellX = Math.floor(gridX);
        let cellZ = Math.floor(gridZ);

        if (cellX < 0 || cellX >= mazeSize || cellZ < 0 || cellZ >= mazeSize) {
            return false;
        }

        const deltaDistX = dirX !== 0 ? Math.abs(1 / dirX) : Infinity;
        const deltaDistZ = dirZ !== 0 ? Math.abs(1 / dirZ) : Infinity;

        let stepX = 0;
        let sideDistX = Infinity;
        if (dirX > EPSILON) {
            stepX = 1;
            sideDistX = (cellX + 1 - gridX) * deltaDistX;
        } else if (dirX < -EPSILON) {
            stepX = -1;
            sideDistX = (gridX - cellX) * deltaDistX;
        }

        let stepZ = 0;
        let sideDistZ = Infinity;
        if (dirZ > EPSILON) {
            stepZ = 1;
            sideDistZ = (cellZ + 1 - gridZ) * deltaDistZ;
        } else if (dirZ < -EPSILON) {
            stepZ = -1;
            sideDistZ = (gridZ - cellZ) * deltaDistZ;
        }

        const maxSteps = this._mazeMarchLimit;

        for (let steps = 0; steps < maxSteps; steps++) {
            let travelledFromStart;
            let normalX = 0;
            let normalZ = 0;

            if (sideDistX < sideDistZ) {
                travelledFromStart = sideDistX;
                sideDistX += deltaDistX;
                cellX += stepX;
                normalX = stepX > 0 ? -1 : 1;
            } else {
                travelledFromStart = sideDistZ;
                sideDistZ += deltaDistZ;
                cellZ += stepZ;
                normalZ = stepZ > 0 ? -1 : 1;
            }

            const totalDistance = startDistance + travelledFromStart;
            if (totalDistance > exit || totalDistance > this._rayFar) return false;
            if (totalDistance <= this._rayNear) continue;

            if (cellX < 0 || cellX >= mazeSize || cellZ < 0 || cellZ >= mazeSize) {
                return false;
            }

            const row = layout[cellX];
            if (!row || row[cellZ] !== 1) {
                continue;
            }

            const hitPos = out.position;
            hitPos.set(
                origin.x + direction.x * totalDistance,
                origin.y + direction.y * totalDistance,
                origin.z + direction.z * totalDistance
            );

            if (hitPos.y < floorY - 1e-3 || hitPos.y > floorY + wallHeight + 1e-3) {
                continue;
            }

            if (normalX !== 0) {
                hitPos.x = cellX + 0.5 * normalX;
            } else if (normalZ !== 0) {
                hitPos.z = cellZ + 0.5 * normalZ;
            }

            out.normal.set(normalX, 0, normalZ);
            out.distance = totalDistance;
            return true;
        }

        return false;
    }

    _intersectHorizontalPlane(origin, direction, planeY, normalY, out) {
        const denom = direction.y;
        if (Math.abs(denom) < EPSILON) return false;
        const t = (planeY - origin.y) / denom;
        if (t <= this._rayNear || t >= this._rayFar) return false;
        out.position.set(
            origin.x + direction.x * t,
            planeY,
            origin.z + direction.z * t
        );
        out.normal.set(0, normalY, 0);
        out.distance = t;
        return true;
    }

    _raycastAgainstGeometry(origin, direction, out) {
        this._raycaster.set(origin, direction);
        if (this._staticGeometry.length) {
            const hits = this._raycaster.intersectObjects(this._staticGeometry, false);
            for (let i = 0; i < hits.length; i++) {
                const h = hits[i];
                const obj = h.object;
                if (!obj || obj.userData?.type === 'ceiling') continue;

                out.distance = h.distance;
                out.position.copy(h.point);
                if (h.face) {
                    this._normalMatrix.getNormalMatrix(obj.matrixWorld);
                    out.normal.copy(h.face.normal).applyMatrix3(this._normalMatrix).normalize();
                } else {
                    out.normal.set(0, 1, 0);
                }
                return true;
            }
        }

        let hasHit = false;
        if (this._intersectHorizontalPlane(origin, direction, this._floorY, 1, this._floorHit)) {
            this._assignHit(out, this._floorHit);
            hasHit = true;
        }
        if (this._intersectHorizontalPlane(origin, direction, this._ceilingY, -1, this._ceilingHit)) {
            if (!hasHit || this._ceilingHit.distance < out.distance) {
                this._assignHit(out, this._ceilingHit);
                hasHit = true;
            }
        }
        return hasHit;
    }

    _prepareEnemyCache(enemies) {
        this._enemyRefs.length = 0;
        this._enemyPositions.length = 0;
        this._enemyHits.length = 0;
        if (!enemies || !enemies.length) return 0;
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy || enemy.properties?.health <= 0) continue;
            const pos = enemy.position;
            if (!pos) continue;
            this._enemyRefs.push(enemy);
            this._enemyPositions.push(pos.x, pos.y, pos.z);
            this._enemyHits.push(0);
        }
        return this._enemyRefs.length;
    }

    _accumulateEnemyHits(point, enemyCount) {
        if (enemyCount === 0) return;
        const px = point.x;
        const pz = point.z;
        const positions = this._enemyPositions;
        const hits = this._enemyHits;
        for (let i = 0; i < enemyCount; i++) {
            const base = i * 3;
            const dx = px - positions[base];
            const dz = pz - positions[base + 2];
            if (dx * dx + dz * dz <= ENEMY_HIT_RADIUS_SQ) {
                hits[i] += 1;
            }
        }
    }

    _placeDot(position, normal, color) {
        if (!this._freeSlots.length) return false;
        const slot = this._freeSlots.pop();
        const record = this._dotRecords[slot];
        record.active = true;
        record.position.copy(position).addScaledVector(normal, 0.04);
        this.activeDots.push(record);

        this._matrixScratch.compose(record.position, this._identityQuat, this._scaleOne);
        this.dotMesh.setMatrixAt(slot, this._matrixScratch);
        this.dotMesh.setColorAt(slot, color);
        this.dotMesh.instanceColor.needsUpdate = true;
        this._maxActiveIndex = Math.max(this._maxActiveIndex, slot);
        this.dotMesh.count = this._maxActiveIndex + 1;

        this._recordRecent(record.position);
        InfluenceMap.addLightWorld(record.position, DOT_LIGHT_INTENSITY, DOT_LIGHT_RADIUS);
        return true;
    }

    _recordRecent(position) {
        let vec;
        if (this._recentPool.length) {
            vec = this._recentPool.pop();
        } else {
            vec = new THREE.Vector3();
        }
        vec.copy(position);
        this.recentDots.push(vec);
        if (this.recentDots.length > this.recentDotLimit) {
            const removed = this.recentDots.shift();
            if (removed) this._recentPool.push(removed);
        }
    }

    recycleDot(record) {
        if (!record || !record.active) return;
        record.active = false;
        this._matrixScratch.compose(record.position, this._identityQuat, this._scaleZero);
        this.dotMesh.setMatrixAt(record.index, this._matrixScratch);
        this._freeSlots.push(record.index);
        const idx = this.activeDots.indexOf(record);
        if (idx !== -1) this.activeDots.splice(idx, 1);
        this.dotMesh.instanceMatrix.needsUpdate = true;
    }

    update() {
        return;
    }

    updateScanLine() {
        const positions = new Float32Array(6);
        const y = this.scanProgress;
        positions[0] = -3; positions[1] = y; positions[2] = -2;
        positions[3] =  3; positions[4] = y; positions[5] = -2;
        this.scanLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.scanLine.geometry.attributes.position.needsUpdate = true;
    }

    reset() {
        for (let i = 0; i < this.activeDots.length; i++) {
            const record = this.activeDots[i];
            record.active = false;
            this._matrixScratch.compose(record.position, this._identityQuat, this._scaleZero);
            this.dotMesh.setMatrixAt(record.index, this._matrixScratch);
            this._freeSlots.push(record.index);
        }
        this.activeDots.length = 0;
        this.dotMesh.instanceMatrix.needsUpdate = true;
        this.dotMesh.count = 0;
        this._maxActiveIndex = -1;

        for (const vec of this.recentDots) {
            this._recentPool.push(vec);
        }
        this.recentDots.length = 0;
        this.lastScanTime = 0;
        if (this.scanLine) this.scanLine.visible = false;
        this.isScanning = false;
        this.scanProgress = 0;
    }
}
