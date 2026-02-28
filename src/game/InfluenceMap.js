// Lightweight global influence maps for light/noise, used by AI/pathfinding
export class InfluenceMap {
  static init(size) {
    this.size = size;
    this.light = Array.from({ length: size }, () => Array(size).fill(0));
    this.noise = Array.from({ length: size }, () => Array(size).fill(0));
    this.decayRate = 0.6; // per second decay factor
    this.maxValue = 10; // clamp to avoid runaway numbers
  }

  static inBounds(x, z) {
    return (
      Number.isFinite(x) &&
      Number.isFinite(z) &&
      x >= 0 &&
      z >= 0 &&
      this.size &&
      x < this.size &&
      z < this.size
    );
  }

  // World-space position (x,z) assumed to align to grid cells
  static addLightWorld(pos, intensity = 1, radius = 4) {
    if (!this.size) return;
    const r = Math.max(0.5, radius);
    const minX = Math.max(0, Math.floor(pos.x - r));
    const maxX = Math.min(this.size - 1, Math.floor(pos.x + r));
    const minZ = Math.max(0, Math.floor(pos.z - r));
    const maxZ = Math.min(this.size - 1, Math.floor(pos.z + r));
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const dx = x - pos.x;
        const dz = z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d <= r) {
          const falloff = 1 - d / r; // linear falloff
          this.light[x][z] = Math.min(
            this.maxValue,
            this.light[x][z] + intensity * falloff
          );
        }
      }
    }
  }

  static addNoiseWorld(pos, intensity = 1, radius = 5) {
    if (!this.size) return;
    const r = Math.max(0.5, radius);
    const minX = Math.max(0, Math.floor(pos.x - r));
    const maxX = Math.min(this.size - 1, Math.floor(pos.x + r));
    const minZ = Math.max(0, Math.floor(pos.z - r));
    const maxZ = Math.min(this.size - 1, Math.floor(pos.z + r));
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const dx = x - pos.x;
        const dz = z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d <= r) {
          const falloff = 1 - d / r;
          this.noise[x][z] = Math.min(
            this.maxValue,
            this.noise[x][z] + intensity * falloff
          );
        }
      }
    }
  }

  static sample(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    if (!this.inBounds(ix, iz)) return 0;
    // Weight light more than noise by default
    return (this.light[ix][iz] || 0) + 0.5 * (this.noise[ix][iz] || 0);
  }

  static update(dt) {
    if (!this.size || !this.light) return;
    const k = Math.max(0, Math.min(1, this.decayRate * dt));
    const decay = 1 - k; // linear decay per tick
    for (let x = 0; x < this.size; x++) {
      const rowL = this.light[x];
      const rowN = this.noise[x];
      for (let z = 0; z < this.size; z++) {
        rowL[z] *= decay;
        rowN[z] *= decay;
      }
    }
  }

  static getAggroAround(pos, radius = 6) {
    if (!this.size || !pos) return 0;
    const r = Math.max(1, radius);
    const minX = Math.max(0, Math.floor(pos.x - r));
    const maxX = Math.min(this.size - 1, Math.floor(pos.x + r));
    const minZ = Math.max(0, Math.floor(pos.z - r));
    const maxZ = Math.min(this.size - 1, Math.floor(pos.z + r));
    let sum = 0;
    let count = 0;
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        sum += (this.light[x][z] || 0);
        count++;
      }
    }
    const avg = count ? sum / count : 0;
    // Map to 0-100 range conservatively
    return Math.max(0, Math.min(100, Math.round(avg * 10)));
  }
}
