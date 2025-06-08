export class InputManager {
    constructor() {
        this.keys = new Set();
        this.mousePosition = { x: 0, y: 0 };
        this.mouseButtons = new Set();
        this.pointerLocked = false;
        
        // Bind methods
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
    }
    
    onKeyUp(event) {
        this.keys.delete(event.key.toLowerCase());
    }
    
    onMouseMove(event) {
        if (this.pointerLocked) {
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
        this.pointerLocked = document.pointerLockElement !== null;
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