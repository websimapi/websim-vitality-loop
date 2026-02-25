import * as THREE from 'three';

export const MONSTER_TYPES = {
    GOBLIN: {
        name: 'Goblin',
        hp: 30,
        speed: 5.0,
        dmg: 5,
        scale: 0.7,
        color: 0x44aa44,
        geo: 'box'
    },
    ORC: {
        name: 'Orc',
        hp: 100,
        speed: 2.5,
        dmg: 15,
        scale: 1.2,
        color: 0x226622,
        geo: 'dodeca'
    },
    SKELETON: {
        name: 'Skeleton',
        hp: 50,
        speed: 3.5,
        dmg: 10,
        scale: 0.9,
        color: 0xdddddd,
        geo: 'cylinder'
    },
    BOSS: {
        name: 'Dungeon Lord',
        hp: 500,
        speed: 4.0,
        dmg: 30,
        scale: 2.5,
        color: 0xaa0000,
        geo: 'torus'
    }
};

export class Monster {
    constructor(game, id, x, y, z) {
        this.game = game;
        this.id = id;
        
        // Determine Type from ID (format: "mob_TYPE_x_z_i")
        // Default to ORC if unknown
        this.typeKey = 'ORC';
        if (id.includes('GOBLIN')) this.typeKey = 'GOBLIN';
        else if (id.includes('SKELETON')) this.typeKey = 'SKELETON';
        else if (id.includes('BOSS')) this.typeKey = 'BOSS';
        
        const stats = MONSTER_TYPES[this.typeKey];

        this.hp = stats.hp;
        this.maxHp = stats.hp;
        this.damage = stats.dmg;
        this.speed = stats.speed;
        this.dead = false;
        
        // Mesh
        this.mesh = new THREE.Group();
        this.mesh.position.set(x, y, z);
        
        const matBody = new THREE.MeshStandardMaterial({ color: stats.color, roughness: 0.3 });
        let geoBody;
        
        if (stats.geo === 'box') geoBody = new THREE.BoxGeometry(0.6, 0.8, 0.6);
        else if (stats.geo === 'cylinder') geoBody = new THREE.CylinderGeometry(0.3, 0.3, 1.2);
        else if (stats.geo === 'torus') geoBody = new THREE.TorusKnotGeometry(0.4, 0.15, 64, 8);
        else geoBody = new THREE.DodecahedronGeometry(0.6);

        this.body = new THREE.Mesh(geoBody, matBody);
        this.body.position.y = 1.0 * stats.scale;
        this.body.scale.setScalar(stats.scale);
        this.body.castShadow = true;
        this.mesh.add(this.body);

        // Eyes
        const eyeMat = new THREE.MeshBasicMaterial({color: 0xff0000});
        const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), eyeMat);
        eye1.position.set(0.15 * stats.scale, 1.2 * stats.scale, 0.4 * stats.scale);
        this.body.add(eye1);
        const eye2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), eyeMat);
        eye2.position.set(-0.15 * stats.scale, 1.2 * stats.scale, 0.4 * stats.scale);
        this.body.add(eye2);

        // Health Bar
        const barY = 2.2 * stats.scale;
        const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * stats.scale, 0.15), new THREE.MeshBasicMaterial({color:0x000000}));
        hpBg.position.y = barY;
        this.mesh.add(hpBg);
        
        this.hpBar = new THREE.Mesh(new THREE.PlaneGeometry(1.18 * stats.scale, 0.13), new THREE.MeshBasicMaterial({color:0xff0000}));
        this.hpBar.position.y = barY;
        this.hpBar.position.z = 0.01;
        this.mesh.add(this.hpBar);
        
        this.mesh.lookAt(x + 1, y, z); // Init rotation

        // State
        this.target = null;
        this.attackCooldown = 0;
        this.state = 'IDLE'; // IDLE, CHASE, ATTACK
    }

    update(dt) {
        if (this.dead) return;
        
        // Update HP Bar
        this.hpBar.scale.x = Math.max(0, this.hp / this.maxHp);
        this.hpBar.lookAt(this.game.camera.position);

        // Host Logic for AI
        if (this.game.network.isHost) {
            this.updateAI(dt);
        } else {
            // Client interpolation handled by network updates, 
            // but we can animate locally
            this.body.rotation.x += dt * 2;
            this.body.rotation.y += dt;
        }
    }

    updateAI(dt) {
        // Find nearest player
        let nearestDist = 999;
        let nearest = null;

        // Check local player
        if (this.game.localPlayer && !this.game.localPlayer.stats.dead) {
            const d = this.mesh.position.distanceTo(this.game.localPlayer.mesh.position);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = this.game.localPlayer;
            }
        }
        
        // Check remote players
        this.game.players.forEach(p => {
            const d = this.mesh.position.distanceTo(p.mesh.position);
            if (d < nearestDist) {
                nearestDist = d;
                nearest = p;
            }
        });

        if (nearest && nearestDist < 15) {
            this.state = 'CHASE';
            if (nearestDist < 1.5) {
                this.state = 'ATTACK';
                this.attack(nearest, dt);
            } else {
                // Move towards
                const dir = new THREE.Vector3().subVectors(nearest.mesh.position, this.mesh.position).normalize();
                dir.y = 0;
                this.mesh.position.addScaledVector(dir, this.speed * dt);
                this.mesh.lookAt(nearest.mesh.position.x, this.mesh.position.y, nearest.mesh.position.z);
            }
        } else {
            this.state = 'IDLE';
        }

        // Bob animation
        this.body.position.y = 1.0 + Math.sin(Date.now() * 0.005) * 0.2;
    }

    attack(target, dt) {
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
            return;
        }
        
        // Attack hit
        this.attackCooldown = 1.5;
        
        // Visual Lung
        this.body.position.z += 0.5;
        setTimeout(() => this.body.position.z -= 0.5, 200);

        if (target === this.game.localPlayer) {
            target.takeDamage(this.damage);
        } else {
            this.game.network.sendHit(target.id, this.damage);
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    die() {
        this.dead = true;
        this.mesh.visible = false;
        
        // Spawn Loot (Host Only logic mostly, but we can spawn locally for visual if sync is hard)
        // Ideally Host broadcasts "Monster Died at X,Y,Z, dropped Item ID"
        if (this.game.network.isHost) {
            this.game.spawnLoot(this.mesh.position);
            this.game.network.broadcastMonsterDeath(this.id);
        }
    }
}