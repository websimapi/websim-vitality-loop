import * as THREE from 'three';
import { World } from './world.js';
import { UIManager } from './ui.js';
import { NetworkManager } from './network.js';
import { InputManager } from './input.js';
import { Player } from './player.js';

class Game {
    constructor() {
        // Init Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);
        this.scene.fog = new THREE.Fog(0x111111, 20, 60);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 20, 20);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Lights
        const amb = new THREE.AmbientLight(0x404040, 2); // Soft white light
        this.scene.add(amb);

        const dir = new THREE.DirectionalLight(0xffffff, 1);
        dir.position.set(50, 50, 50);
        dir.castShadow = true;
        dir.shadow.camera.left = -50;
        dir.shadow.camera.right = 50;
        dir.shadow.camera.top = 50;
        dir.shadow.camera.bottom = -50;
        dir.shadow.mapSize.width = 2048;
        dir.shadow.mapSize.height = 2048;
        this.scene.add(dir);

        // Managers
        this.PlayerClass = Player;
        this.world = new World(this);
        this.ui = new UIManager(this);
        this.network = new NetworkManager(this);
        this.input = new InputManager(this);
        
        this.players = new Map(); // Remote players
        this.localPlayer = null;

        this.clock = new THREE.Clock();
        this.lastBroadcast = 0;

        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    startLocalGame(isHost, id) {
        console.log("Starting Game...", isHost, id);
        
        // Reset scene if needed
        if(this.localPlayer) {
            this.scene.remove(this.localPlayer.mesh);
        }
        this.players.forEach(p => this.scene.remove(p.mesh));
        this.players.clear();

        this.world.generate(0);

        this.localPlayer = new Player(this, true, id);
        this.scene.add(this.localPlayer.mesh);
        
        // Find safe spawn?
        const x = (Math.random() - 0.5) * 10;
        const z = (Math.random() - 0.5) * 10;
        this.localPlayer.mesh.position.set(x, 10, z);
        
        this.ui.showHUD();
        this.ui.updateStats(this.localPlayer.stats);
    }

    updateCamera(target) {
        const offset = new THREE.Vector3(0, 15, 12);
        const desired = target.clone().add(offset);
        this.camera.position.lerp(desired, 0.1);
        this.camera.lookAt(target);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const dt = this.clock.getDelta();

        if (this.localPlayer) {
            this.localPlayer.update(dt);
            
            // Network Broadcast (Throttle to 20hz)
            this.lastBroadcast += dt;
            if (this.lastBroadcast > 0.05) {
                this.lastBroadcast = 0;
                this.network.broadcastState({
                    id: this.localPlayer.id,
                    x: this.localPlayer.mesh.position.x,
                    y: this.localPlayer.mesh.position.y,
                    z: this.localPlayer.mesh.position.z,
                    rot: this.localPlayer.mesh.rotation.y,
                    hp: this.localPlayer.stats.currentHp
                });
            }
        }

        this.players.forEach(p => p.update(dt));
        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Bootstrap
window.game = new Game();