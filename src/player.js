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
        
        // Detailed Humanoid Body Construction
        this.bodyGroup = new THREE.Group();
        this.mesh.add(this.bodyGroup);

        // Materials
        const armorColor = isLocal ? 0x222222 : 0x442222;
        const highlightColor = isLocal ? 0x00ff00 : 0xff0000;
        
        const matArmor = new THREE.MeshStandardMaterial({ color: armorColor, roughness: 0.4, metalness: 0.8 });
        const matJoint = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
        const matSkin = new THREE.MeshStandardMaterial({ color: 0xAA8866, roughness: 0.8 });
        const matGlow = new THREE.MeshBasicMaterial({ color: highlightColor });

        // -- Torso --
        this.torso = new THREE.Group();
        this.torso.position.y = 1.0;
        this.bodyGroup.add(this.torso);

        // Chest Plate
        const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.25), matArmor);
        chest.position.y = 0.25;
        chest.castShadow = true;
        this.torso.add(chest);

        // Abdomen (Spine)
        const abdomen = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), matJoint);
        abdomen.position.y = -0.05;
        this.torso.add(abdomen);

        // Hips
        const hips = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.22), matArmor);
        hips.position.y = -0.25;
        this.torso.add(hips);

        // -- Head --
        this.headGroup = new THREE.Group();
        this.headGroup.position.y = 0.5;
        this.torso.add(this.headGroup);

        const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.28), matArmor);
        headMesh.castShadow = true;
        this.headGroup.add(headMesh);
        
        // Visor/Eyes
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), matGlow);
        visor.position.set(0, 0.02, 0.1);
        this.headGroup.add(visor);

        // -- Arms --
        this.lArm = this.createLimb(matArmor, matJoint, true);
        this.lArm.position.set(-0.25, 0.4, 0);
        this.torso.add(this.lArm);

        this.rArm = this.createLimb(matArmor, matJoint, true);
        this.rArm.position.set(0.25, 0.4, 0);
        this.torso.add(this.rArm);

        // -- Legs --
        this.lLeg = this.createLimb(matArmor, matJoint, false);
        this.lLeg.position.set(-0.12, -0.35, 0);
        this.torso.add(this.lLeg);

        this.rLeg = this.createLimb(matArmor, matJoint, false);
        this.rLeg.position.set(0.12, -0.35, 0);
        this.torso.add(this.rLeg);

        // -- Weapon --
        this.weapon = new THREE.Group();
        // Hilt
        const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.25), new THREE.MeshStandardMaterial({color: 0x443322}));
        hilt.rotation.x = Math.PI/2;
        this.weapon.add(hilt);
        // Guard
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.1), new THREE.MeshStandardMaterial({color: 0x888888, metalness: 0.9}));
        guard.position.z = 0.12;
        this.weapon.add(guard);
        // Blade
        const bladeGeo = new THREE.BoxGeometry(0.1, 0.02, 1.2); // Long blade
        const bladeMat = new THREE.MeshStandardMaterial({color: 0xffffff, metalness: 0.9, roughness: 0.2});
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.z = 0.75;
        blade.rotation.y = Math.PI/2;
        blade.castShadow = true;
        this.weapon.add(blade);

        // Attach weapon to right hand (lower arm end)
        // Hand is at y = -0.3 of lower arm
        this.weapon.position.set(0, -0.3, 0.15); 
        this.weapon.rotation.x = -Math.PI/2; // Point forward
        
        // Find Right Arm Lower Segment
        const rLowerArm = this.rArm.children.find(c => c.name === 'lower');
        if (rLowerArm) rLowerArm.add(this.weapon);

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

    createLimb(matArmor, matJoint, isArm) {
        const group = new THREE.Group();
        
        // Shoulder/Hip Joint
        const joint = new THREE.Mesh(new THREE.SphereGeometry(0.09), matJoint);
        group.add(joint);

        // Upper Limb
        const upperLen = isArm ? 0.3 : 0.4;
        const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, upperLen, 0.12), matArmor);
        upper.position.y = -upperLen / 2;
        upper.castShadow = true;
        group.add(upper);

        // Elbow/Knee
        const midJoint = new THREE.Mesh(new THREE.SphereGeometry(0.08), matJoint);
        midJoint.position.y = -upperLen;
        group.add(midJoint);

        // Lower Limb Group (for bending)
        const lowerGroup = new THREE.Group();
        lowerGroup.name = 'lower';
        lowerGroup.position.y = -upperLen;
        group.add(lowerGroup);

        const lowerLen = isArm ? 0.3 : 0.4;
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.1, lowerLen, 0.1), matArmor);
        lower.position.y = -lowerLen / 2;
        lower.castShadow = true;
        lowerGroup.add(lower);

        return group;
    }

    animateBody(dt) {
        // Base Rotation
        this.torso.rotation.y = 0;

        // Attack Animation
        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
            const progress = 1.0 - (this.attackCooldown / 0.4);
            const swing = Math.sin(progress * Math.PI);
            
            // Torso Twist
            this.torso.rotation.y = -Math.PI * 0.2 * swing;
            
            // Swing Arm
            this.rArm.rotation.x = -Math.PI * 0.8 * swing;
            this.rArm.rotation.z = Math.PI * 0.2 * swing;
        } else {
            this.rArm.rotation.x = THREE.MathUtils.lerp(this.rArm.rotation.x, 0, dt * 5);
            this.rArm.rotation.z = THREE.MathUtils.lerp(this.rArm.rotation.z, 0, dt * 5);
        }

        // Walk Cycle
        const dx = this.mesh.position.x - (this.lastX || this.mesh.position.x);
        const dz = this.mesh.position.z - (this.lastZ || this.mesh.position.z);
        const velocity = Math.sqrt(dx*dx + dz*dz) / dt;
        
        this.lastX = this.mesh.position.x;
        this.lastZ = this.mesh.position.z;

        if (velocity > 0.1) {
            const time = Date.now() * 0.015;
            
            this.lLeg.rotation.x = Math.sin(time) * 0.6;
            this.rLeg.rotation.x = Math.sin(time + Math.PI) * 0.6;
            
            // Knee bending
            this.lLeg.children.find(c=>c.name==='lower').rotation.x = Math.max(0, Math.sin(time + Math.PI/2));
            this.rLeg.children.find(c=>c.name==='lower').rotation.x = Math.max(0, Math.sin(time + Math.PI + Math.PI/2));

            // Arms opposite to legs
            this.lArm.rotation.x = Math.sin(time + Math.PI) * 0.4;
            if (this.attackCooldown <= 0) {
                 this.rArm.rotation.x = Math.sin(time) * 0.4;
            }
            
            // Bobbing
            this.bodyGroup.position.y = Math.sin(time * 2) * 0.05;
        } else {
            // Idle
            this.lLeg.rotation.x = THREE.MathUtils.lerp(this.lLeg.rotation.x, 0, dt * 10);
            this.rLeg.rotation.x = THREE.MathUtils.lerp(this.rLeg.rotation.x, 0, dt * 10);
            this.lArm.rotation.x = THREE.MathUtils.lerp(this.lArm.rotation.x, 0, dt * 10);
            this.bodyGroup.position.y = THREE.MathUtils.lerp(this.bodyGroup.position.y, 0, dt * 5);
            
            const kneeL = this.lLeg.children.find(c=>c.name==='lower');
            if(kneeL) kneeL.rotation.x = THREE.MathUtils.lerp(kneeL.rotation.x, 0, dt * 10);
            const kneeR = this.rLeg.children.find(c=>c.name==='lower');
            if(kneeR) kneeR.rotation.x = THREE.MathUtils.lerp(kneeR.rotation.x, 0, dt * 10);
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