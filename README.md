# GlowMaze

A first-person horror exploration game with unique scanning mechanics, built using Three.js and modern web technologies.

## Features

- First-person exploration in a procedurally generated maze
- Unique scanning mechanic that illuminates the environment
- Enemy AI that hunts the player in darkness
- Smooth movement and controls
- Modern UI with performance monitoring
- Customizable player settings
- Atmospheric sound design

## Game Mechanics

### Scanning System
- Vertical scanning line that moves from top to bottom
- Dots illuminate walls and objects
- Different colors for walls (cyan), floor (blue), and ceiling (orange)
- Limited energy system that regenerates over time

### Movement and Controls
- WASD for movement
- Mouse look with pointer lock controls
- Sprint ability
- Smooth acceleration/deceleration
- Collision detection

### Enemy System
- Monsters that hunt in darkness
- Avoid illuminated areas
- Health system and knockback effects
- Glowing red eyes
- Detection and movement mechanics

## Technical Details

### Performance Optimizations
- Object pooling for scan dots
- Chunked processing for scan points
- Optimized materials and geometries
- Frame time monitoring
- Capped pixel ratio and disabled antialiasing

### Visual Style
- Dark, atmospheric environment
- Glowing effects
- Smooth transitions
- Modern, clean UI
- Consistent color scheme

## Setup and Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/glowmaze.git
cd glowmaze
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Controls

- **WASD**: Movement
- **Mouse**: Look around
- **Left Click**: Activate scanner
- **Shift**: Sprint
- **ESC**: Pause menu

## Development

### Project Structure
```
glowmaze/
├── src/
│   ├── game/
│   │   ├── EnemyManager.js
│   │   ├── GameState.js
│   │   ├── InputManager.js
│   │   ├── MazeGenerator.js
│   │   ├── Player.js
│   │   └── Scanner.js
│   ├── ui/
│   │   ├── MenuManager.js
│   │   └── UIManager.js
│   ├── audio/
│   │   └── SoundManager.js
│   └── main.js
├── public/
│   └── sounds/
├── index.html
├── package.json
└── README.md
```

### Dependencies
- Three.js: 3D rendering
- GSAP: Animations
- Vite: Build tool and development server

## Browser Support

The game requires a modern browser with WebGL support. Recommended browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Requirements

- Modern CPU (2+ cores)
- GPU with WebGL support
- 4GB+ RAM
- 60 FPS target on medium settings

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Three.js community for the excellent 3D library
- All contributors and testers
- Inspiration from classic horror games 