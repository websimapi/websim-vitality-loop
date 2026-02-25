import * as THREE from 'three';

export class Monster {
    constructor(game, id, x, y, z) {
        this.game = game;
        this.id = id;
        this.hp = 50;
        this.maxHp = 50;
        this.dead = false;
        
        // Mesh
        this.mesh = new THREE.Group();
        this.mesh.position.set(x, y, z);
        
        const matBody = new THREE.MeshStandardMaterial({ color: 0x880000, roughness: 0.3 });
        const geoBody = new THREE.DodecahedronGeometry(0.6);
        this.body = new THREE.Mesh(geoBody, matBody);
        this.body.position.y = 1.0;
        this.body.castShadow = true;
        this.mesh.add(this.body);

        // Health Bar
        const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), new THREE.MeshBasicMaterial({color:0x000000}));
        hpBg.position.y = 2.2;
        this.mesh.add(hpBg);
        
        this.hpBar = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.08), new THREE.MeshBasicMaterial({color:0xff0000}));
        this.hpBar.position.y = 2.2;
        this.hpBar.position.z = 0.01;
        this.mesh.add(this.hpBar);
        
        this.mesh.lookAt(x + 1, y, z); // Init rotation

        // State
        this.target = null;
        this.speed = 3.5;
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
        // Host deals damage directly? Or sends hit? 
        // Host authoritative: Host calculates hit, sends state.
        // Actually, for simplicity, Host tells target they took damage.
        
        if (target === this.game.localPlayer) {
            target.takeDamage(10);
        } else {
            // Remote player hit, we can't force damage easily without complex net code.
            // We'll trust the Host sends a 'HIT' packet to that client.
            this.game.network.sendHit(target.id, 10);
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.hp = 0;
            this.die();
        }
    }

    die(broadcast = true) {
        this.dead = true;
        this.mesh.visible = false;
        
        if (this.game.network.isHost && broadcast) {
            const key = this.game.spawnLoot(this.mesh.position);
            this.game.network.broadcastMonsterDeath(this.id);
            if (key) {
                this.game.network.broadcastLoot(this.mesh.position, key);
            }
        }
    }
}