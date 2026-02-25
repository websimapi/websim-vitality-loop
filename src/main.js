import * as THREE from 'three';
import { World } from './world.js';
import { UIManager } from './ui.js';
import { NetworkManager } from './network.js';
import { InputManager } from './input.js';
import { Player } from './player.js';
import { ITEMS } from './items.js';
import { Monster } from './monster.js';

class Game {
    constructor() {
        // Init Three.js
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.015);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 20, 20);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Lights
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.4); 
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        this.sunLight.position.set(50, 100, 50);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.bias = -0.0005;
        this.sunLight.shadow.camera.left = -60;
        this.sunLight.shadow.camera.right = 60;
        this.sunLight.shadow.camera.top = 60;
        this.sunLight.shadow.camera.bottom = -60;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target);

        // Day/Night State
        this.timeOfDay = 0.2; // Start in morning
        this.dayDuration = 240; // Slower day

        // Managers
        this.PlayerClass = Player;
        this.MonsterClass = Monster; // Exposed for Network
        this.world = new World(this);
        this.ui = new UIManager(this);
        this.network = new NetworkManager(this);
        this.input = new InputManager(this);
        
        this.players = new Map(); // Remote players
        this.monsters = []; // Array of Monster instances
        this.loot = []; // Array of dropped items { mesh, data }
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

        // World generates dynamically now, just clear old chunks if any
        this.world.chunks.forEach(c => this.scene.remove(c.mesh));
        this.world.chunks.clear();

        this.localPlayer = new Player(this, true, id);
        this.scene.add(this.localPlayer.mesh);
        
        // Safe spawn logic: Find a spot above water
        let spawnY = 0;
        let x = 0, z = 0;
        for(let i=0; i<10; i++) {
            x = (Math.random() - 0.5) * 100;
            z = (Math.random() - 0.5) * 100;
            const y = this.world.getHeightAt(x, z);
            if(y > 2.5) {
                spawnY = y + 2;
                break;
            }
        }
        
        this.localPlayer.mesh.position.set(x, spawnY || 10, z);
        
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

        // Day/Night Cycle
        this.timeOfDay += dt / this.dayDuration;
        if (this.timeOfDay > 1) this.timeOfDay = 0;

        const angle = this.timeOfDay * Math.PI * 2;
        // Sun moves in arc
        const r = 50;
        this.sunLight.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 20);
        this.sunLight.lookAt(0,0,0);

        // Colors
        const isNight = this.timeOfDay > 0.5;
        let skyColor = new THREE.Color(0x87CEEB); // Day
        if (this.timeOfDay > 0.45 && this.timeOfDay < 0.55) skyColor.setHex(0xffaa00); // Sunset
        if (isNight) skyColor.setHex(0x111122); // Night

        this.scene.background = skyColor;
        this.scene.fog.color = skyColor;
        this.ambientLight.intensity = isNight ? 0.1 : 0.5;
        this.sunLight.intensity = isNight ? 0.0 : 1.0;

        if (this.localPlayer) {
            this.localPlayer.update(dt);
            this.world.update(this.localPlayer.mesh.position);
            
            // Keep sun shadow camera near player
            this.sunLight.position.add(this.localPlayer.mesh.position);
            this.sunLight.target.position.copy(this.localPlayer.mesh.position);
            this.sunLight.target.updateMatrixWorld();

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
                
                // If Host, broadcast monster states (simplified, just positions maybe?)
                // For this prototype, we'll rely on deterministic(ish) behavior or local sim
                // But let's sync monster positions if possible
                if (this.network.isHost && this.monsters.length > 0) {
                     this.network.broadcastMonsters(this.monsters);
                }
            }
        }
        
        // Update Monsters
        this.monsters.forEach(m => m.update(dt));
        // Rotate Loot
        this.loot.forEach(l => l.mesh.rotation.y += dt);

        this.players.forEach(p => p.update(dt));
        this.renderer.render(this.scene, this.camera);
    }

    spawnLoot(pos, itemKey = null) {
        // Random loot if not specified
        const keys = Object.keys(ITEMS);
        const key = itemKey || keys[Math.floor(Math.random() * keys.length)];
        const itemData = ITEMS[key];

        if (!itemData) return null;

        const group = new THREE.Group();
        group.position.copy(pos);
        group.position.y = 1.0;

        // Visual
        const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const mat = new THREE.MeshStandardMaterial({ color: itemData.color, metalness: 0.8, roughness: 0.2 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = Math.PI/4;
        mesh.rotation.z = Math.PI/4;
        group.add(mesh);

        // Glow
        const glow = new THREE.PointLight(itemData.color, 1, 3);
        group.add(glow);

        this.scene.add(group);
        this.loot.push({ mesh: group, data: itemData });
        return key;
    }

    removeLoot(index) {
        const item = this.loot[index];
        if(item) {
            this.scene.remove(item.mesh);
            this.loot.splice(index, 1);
        }
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Bootstrap
window.game = new Game();