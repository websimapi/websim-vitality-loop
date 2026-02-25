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
        
        // Visual Body (Humanoid)
        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        const color = isLocal ? 0x00ff00 : 0xffaaaa;
        const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
        const jointMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

        // Head
        this.head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.35), mat);
        this.head.position.y = 1.65;
        this.head.castShadow = true;
        this.bodyGroup.add(this.head);

        // Torso
        this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), mat);
        this.torso.position.y = 1.15;
        this.torso.castShadow = true;
        this.bodyGroup.add(this.torso);

        // Arms
        this.lArm = new THREE.Group();
        this.lArm.position.set(-0.35, 1.4, 0);
        const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), mat);
        lArmMesh.position.y = -0.3;
        lArmMesh.castShadow = true;
        this.lArm.add(lArmMesh);
        this.bodyGroup.add(this.lArm);

        this.rArm = new THREE.Group();
        this.rArm.position.set(0.35, 1.4, 0);
        const rArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), mat);
        rArmMesh.position.y = -0.3;
        rArmMesh.castShadow = true;
        this.rArm.add(rArmMesh);
        this.bodyGroup.add(this.rArm);

        // Legs
        this.lLeg = new THREE.Group();
        this.lLeg.position.set(-0.15, 0.8, 0);
        const lLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), mat);
        lLegMesh.position.y = -0.4;
        lLegMesh.castShadow = true;
        this.lLeg.add(lLegMesh);
        this.bodyGroup.add(this.lLeg);

        this.rLeg = new THREE.Group();
        this.rLeg.position.set(0.15, 0.8, 0);
        const rLegMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), mat);
        rLegMesh.position.y = -0.4;
        rLegMesh.castShadow = true;
        this.rLeg.add(rLegMesh);
        this.bodyGroup.add(this.rLeg);

        // Weapon (Attached to Right Arm)
        const wGeo = new THREE.BoxGeometry(0.08, 0.8, 0.08); // Sword blade
        const wMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 });
        this.weapon = new THREE.Group();
        
        const blade = new THREE.Mesh(wGeo, wMat);
        blade.position.y = 0.5;
        this.weapon.add(blade);
        
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.1), new THREE.MeshStandardMaterial({color:0x444444}));
        guard.position.y = 0.1;
        this.weapon.add(guard);
        
        this.weapon.position.set(0, -0.5, 0.2);
        this.weapon.rotation.x = Math.PI / 2; // Holding forward
        this.rArm.add(this.weapon);

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
        this.animateBody(dt);
    }

    animateBody(dt) {
        // Attack Animation
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
            const progress = 1.0 - (this.attackCooldown / 0.4);
            // Swing Arm
            this.rArm.rotation.x = -Math.PI/2 + (-Math.PI/2 * Math.sin(progress * Math.PI));
        } else {
            // Idle/Run Arm
            this.rArm.rotation.x = Math.PI * 0.05; // Slightly relaxed
        }

        // Walk Cycle
        const velocityLen = new THREE.Vector2(this.mesh.position.x, this.mesh.position.z)
            .distanceTo(new THREE.Vector2(this.lastX || this.mesh.position.x, this.lastZ || this.mesh.position.z));
        
        this.lastX = this.mesh.position.x;
        this.lastZ = this.mesh.position.z;

        if (velocityLen > 0.01) {
            const time = Date.now() * 0.01;
            this.lLeg.rotation.x = Math.sin(time) * 0.5;
            this.rLeg.rotation.x = Math.sin(time + Math.PI) * 0.5;
            
            // Arms opposite to legs
            this.lArm.rotation.x = Math.sin(time + Math.PI) * 0.3;
            if (this.attackCooldown <= 0) {
                 this.rArm.rotation.x = Math.sin(time) * 0.3;
            }
        } else {
            // Reset limbs
            this.lLeg.rotation.x = THREE.MathUtils.lerp(this.lLeg.rotation.x, 0, dt * 10);
            this.rLeg.rotation.x = THREE.MathUtils.lerp(this.rLeg.rotation.x, 0, dt * 10);
            this.lArm.rotation.x = THREE.MathUtils.lerp(this.lArm.rotation.x, 0, dt * 10);
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