export class InputManager {
    constructor() {
        this.keys = new Set();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseDelta = { x: 0, y: 0 };
        this.isPointerLocked = false;
        this.isScanning = false;
        
        // Bind event handlers
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);
        
        // Add event listeners
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('pointerlockchange', this.onPointerLockChange);
    }
    
    onKeyDown(event) {
        this.keys.add(event.key.toLowerCase());
        
        // Handle space for scanning
        if (event.key === ' ' && !this.isScanning) {
            this.isScanning = true;
        }
    }
    
    onKeyUp(event) {
        this.keys.delete(event.key.toLowerCase());
        
        // Reset scanning state when space is released
        if (event.key === ' ') {
            this.isScanning = false;
        }
    }
    
    onMouseMove(event) {
        if (this.isPointerLocked) {
            this.mousePosition.x = event.movementX;
            this.mousePosition.y = event.movementY;
        }
    }
    
    onMouseDown(event) {
        this.mouseButtons.add(event.button);
    }
    
    onMouseUp(event) {
        this.mouseButtons.delete(event.button);
    }
    
    onPointerLockChange() {
        this.isPointerLocked = document.pointerLockElement !== null;
    }
    
    isKeyPressed(key) {
        return this.keys.has(key.toLowerCase());
    }
    
    isMouseButtonPressed(button) {
        return this.mouseButtons.has(button);
    }
    
    getMouseMovement() {
        const movement = { ...this.mousePosition };
        this.mousePosition.x = 0;
        this.mousePosition.y = 0;
        return movement;
    }
    
    requestPointerLock(element) {
        element.requestPointerLock();
    }
    
    exitPointerLock() {
        document.exitPointerLock();
    }
    
    cleanup() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    }
} 