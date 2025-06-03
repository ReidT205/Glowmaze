# GlowMaze

A first-person horror exploration game where you navigate through a dark maze using glowing markers to light your way and fend off dangerous creatures.

## How to Play

1. Click anywhere on the screen to start the game and lock the mouse pointer
2. Use WASD keys to move around
3. Use the mouse to look around
4. Press SPACE to shoot glowing markers that:
   - Illuminate the walls
   - Damage monsters
   - Create safe zones (monsters avoid light)
5. Your glow ammo regenerates slowly over time
6. Avoid contact with monsters to preserve your health
7. Find the exit portal to complete the level

## Game Features

- Dynamic lighting system with permanent glow markers
- Monster AI that:
  - Hunts the player in darkness
  - Avoids illuminated areas
  - Takes damage from glow shots
- Resource management (limited glow ammo)
- Health system
- Randomly generated maze layout
- Responsive controls and smooth movement

## Setup

1. Clone this repository
2. Open `index.html` in a modern web browser
3. Make sure your browser supports WebGL

## Controls

- WASD: Movement
- Mouse: Look around
- Space: Shoot glow markers
- ESC: Unlock mouse pointer

## Technical Details

- Built with Three.js for 3D rendering
- Uses WebGL for graphics
- Implements pointer lock controls for first-person movement
- Features dynamic lighting and collision detection 