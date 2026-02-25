import * as THREE from 'three';
import { Stats } from './stats.js';

export class Player {
    constructor(game, isLocal, id) {
        this.game = game;
        this.isLocal = isLocal;
        this.id = id;
        this.stats = new Stats();
        
        // Group for mesh
        this.mesh = new THREE.Group();
        
        // Visual Body
        const geometry = new THREE.CapsuleGeometry(0.4, 1.6, 4, 8);
        const mat = new THREE.MeshStandardMaterial({ 
            color: isLocal ? 0x00ff00 : 0xffaaaa,
            roughness: 0.7 
        });
        this.body = new THREE.Mesh(geometry, mat);
        this.body.position.y = 0.8;
        this.body.castShadow = true;
        this.body.receiveShadow = true;
        this.mesh.add(this.body);

        // Weapon
        const wGeo = new THREE.BoxGeometry(0.1, 0.1, 1.0);
        const wMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        this.weapon = new THREE.Mesh(wGeo, wMat);
        this.weapon.position.set(0.4, 1.0, 0.4);
        this.weapon.castShadow = true;
        this.mesh.add(this.weapon);

        // State
        this.speed = 8;
        this.isAttacking = false;
        this.attackCooldown = 0;
        this.verticalVelocity = 0;
        this.grounded = false;
    }

    update(dt) {
        if (this.isLocal) {
            this.handleInput(dt);
            this.applyPhysics(dt);
        } else {
            // Remote players are updated via network lerping mostly
            // But we can apply simple gravity if we want smooth movement
        }

        // Animation / Visuals
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
            // Swing animation
            const progress = 1.0 - (this.attackCooldown / 0.4);
            if (progress < 1.0) {
                this.weapon.rotation.x = -Math.PI * Math.sin(progress * Math.PI);
            } else {
                this.weapon.rotation.x = 0;
            }
        }
    }

    handleInput(dt) {
        if (this.stats.currentHp <= 0) return;

        const input = this.game.input.getState();
        
        // Attack
        if (input.attack && this.attackCooldown <= 0) {
            this.performAttack();
        }

        // Movement
        // Camera relative
        const cam = this.game.camera;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
        right.y = 0;
        right.normalize();

        const moveDir = new THREE.Vector3();
        moveDir.addScaledVector(forward, -input.y);
        moveDir.addScaledVector(right, input.x);

        if (moveDir.lengthSq() > 0.01) {
            moveDir.normalize();
            
            // Move
            // Speed affected by Vitality? Maybe later.
            this.mesh.position.addScaledVector(moveDir, this.speed * dt);
            
            // Rotate to face direction
            const angle = Math.atan2(moveDir.x, moveDir.z);
            // Smooth turn
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), angle);
            this.mesh.quaternion.slerp(q, 10 * dt);
        }

        // Update Camera
        this.game.updateCamera(this.mesh.position);
    }

    applyPhysics(dt) {
        // Gravity
        this.verticalVelocity -= 20 * dt;
        this.mesh.position.y += this.verticalVelocity * dt;

        // Floor collision
        const terrainH = this.game.world.getHeightAt(this.mesh.position.x, this.mesh.position.z);
        if (this.mesh.position.y < terrainH) {
            this.mesh.position.y = terrainH;
            this.verticalVelocity = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }
    }

    performAttack() {
        this.attackCooldown = 0.4; // 400ms swing
        
        // Audio
        const sfx = new Audio('/sound_swing.mp3');
        sfx.volume = 0.4;
        sfx.play().catch(e=>{});

        // Hit detection (Simple Box/Distance check)
        // Check all other players
        this.game.players.forEach(remote => {
            const dist = this.mesh.position.distanceTo(remote.mesh.position);
            if (dist < 2.5) { // Range
                // Check angle (in front)
                const toTarget = remote.mesh.position.clone().sub(this.mesh.position).normalize();
                const facing = new THREE.Vector3(0,0,1).applyQuaternion(this.mesh.quaternion);
                if (facing.dot(toTarget) > 0.5) { // ~60 degree cone
                    // Hit!
                    // Calculate Damage based on Seff
                    const damage = 10 * this.stats.sEff;
                    this.game.network.sendHit(remote.id, damage);
                }
            }
        });
    }

    takeDamage(amount) {
        const dead = this.stats.takeDamage(amount);
        this.game.ui.updateStats(this.stats);
        
        // Visual feedback
        const flash = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.body.material = flash;
        setTimeout(() => {
            this.body.material = new THREE.MeshStandardMaterial({ 
                color: this.isLocal ? 0x00ff00 : 0xffaaaa, 
                roughness: 0.7 
            });
        }, 100);

        if (dead) {
            const sfx = new Audio('/sound_death.mp3');
            sfx.play().catch(e=>{});
            this.game.ui.showDeath();
            // Disable movement or hide mesh?
            this.mesh.visible = false;
        } else {
            const sfx = new Audio('/sound_hit.mp3');
            sfx.play().catch(e=>{});
        }
    }
}