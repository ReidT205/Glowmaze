export class SoundManager {
    constructor() {
        this.sounds = new Map();
        this.music = null;
        this.volume = {
            music: 0.5,
            sfx: 0.7
        };
        
        // Initialize audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Load sounds
        this.loadSounds();
    }
    
    async loadSounds() {
        const soundFiles = {
            // Music
            'ambient': 'sounds/ambient.mp3',
            
            // UI Sounds
            'menu-click': 'sounds/menu-click.mp3',
            'menu-hover': 'sounds/menu-hover.mp3',
            
            // Game Sounds
            'scanner': 'sounds/scanner.mp3',
            'footstep': 'sounds/footstep.mp3',
            'monster-detect': 'sounds/monster-detect.mp3',
            'monster-hurt': 'sounds/monster-hurt.mp3',
            'player-hurt': 'sounds/player-hurt.mp3',
            'game-over': 'sounds/game-over.mp3'
        };
        
        for (const [name, path] of Object.entries(soundFiles)) {
            try {
                const response = await fetch(path);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.sounds.set(name, audioBuffer);
            } catch (error) {
                console.warn(`Failed to load sound: ${name}`, error);
            }
        }
    }
    
    playSound(name, options = {}) {
        const buffer = this.sounds.get(name);
        if (!buffer) return null;
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Apply volume
        gainNode.gain.value = this.volume.sfx * (options.volume || 1);
        
        // Apply options
        if (options.loop) source.loop = true;
        if (options.playbackRate) source.playbackRate.value = options.playbackRate;
        
        // Start playback
        source.start(0);
        
        return source;
    }
    
    playMusic(name, options = {}) {
        // Stop current music if playing
        if (this.music) {
            this.music.stop();
        }
        
        const source = this.playSound(name, {
            ...options,
            loop: true,
            volume: this.volume.music
        });
        
        this.music = source;
        return source;
    }
    
    stopMusic() {
        if (this.music) {
            this.music.stop();
            this.music = null;
        }
    }
    
    setVolume(type, value) {
        this.volume[type] = Math.max(0, Math.min(1, value));
        
        // Update music volume if playing
        if (type === 'music' && this.music) {
            this.music.gain.value = this.volume.music;
        }
    }
    
    playFootstep() {
        // Prevent too many footstep sounds
        if (this.lastFootstep && performance.now() - this.lastFootstep < 300) {
            return;
        }
        
        this.playSound('footstep', {
            volume: 0.3,
            playbackRate: 0.8 + Math.random() * 0.4
        });
        
        this.lastFootstep = performance.now();
    }
    
    playScannerSound() {
        this.playSound('scanner', {
            volume: 0.6,
            playbackRate: 1.2
        });
    }
    
    playMonsterDetectSound() {
        this.playSound('monster-detect', {
            volume: 0.8,
            playbackRate: 0.9 + Math.random() * 0.2
        });
    }
    
    playMonsterHurtSound() {
        this.playSound('monster-hurt', {
            volume: 0.7,
            playbackRate: 1.1
        });
    }
    
    playPlayerHurtSound() {
        this.playSound('player-hurt', {
            volume: 0.8,
            playbackRate: 1
        });
    }
    
    playGameOverSound() {
        this.stopMusic();
        this.playSound('game-over', {
            volume: 1,
            playbackRate: 1
        });
    }
    
    playMenuClickSound() {
        this.playSound('menu-click', {
            volume: 0.5,
            playbackRate: 1
        });
    }
    
    playMenuHoverSound() {
        this.playSound('menu-hover', {
            volume: 0.3,
            playbackRate: 1
        });
    }
    
    resumeAudioContext() {
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    pauseAudioContext() {
        if (this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    }
} 