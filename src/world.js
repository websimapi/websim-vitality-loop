import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { Monster } from './monster.js';

export class World {
    constructor(game) {
        this.game = game;
        this.chunks = new Map(); // "x,z" -> { mesh, water, props: [] }
        this.chunkSize = 64;
        
        const loader = new THREE.TextureLoader();
        const wallTex = loader.load('./texture_wall.png');
        wallTex.wrapS = THREE.RepeatWrapping;
        wallTex.wrapT = THREE.RepeatWrapping;
        this.matWall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
        this.renderDist = 2; // Radius of chunks to keep loaded
        this.noise2D = createNoise2D(); 
        
        // Textures
        const loader = new THREE.TextureLoader();
        
        const grassTex = loader.load('./texture_grass.png');
        grassTex.wrapS = THREE.RepeatWrapping;
        grassTex.wrapT = THREE.RepeatWrapping;
        grassTex.repeat.set(8, 8); // Higher repeat for details
        
        const stoneTex = loader.load('./texture_stone.png');
        stoneTex.wrapS = THREE.RepeatWrapping;
        stoneTex.wrapT = THREE.RepeatWrapping;
        stoneTex.repeat.set(4, 4);

        const woodTex = loader.load('./texture_wood.png');
        
        this.matGrass = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9, color: 0x55aa55 });
        this.matStone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.8 });
        this.matWood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 });
        this.matWater = new THREE.MeshStandardMaterial({ 
            color: 0x0055aa, 
            transparent: true, 
            opacity: 0.8, 
            roughness: 0.1,
            metalness: 0.6
        });
        
        // Monster Materials
        this.matMonster = new THREE.MeshStandardMaterial({ color: 0x880000, roughness: 0.3 });

        this.objects = []; 
    }

    update(playerPos) {
        const cx = Math.floor(playerPos.x / this.chunkSize);
        const cz = Math.floor(playerPos.z / this.chunkSize);

        const needed = new Set();
        for (let x = cx - this.renderDist; x <= cx + this.renderDist; x++) {
            for (let z = cz - this.renderDist; z <= cz + this.renderDist; z++) {
                const key = `${x},${z}`;
                needed.add(key);
                if (!this.chunks.has(key)) {
                    this.createChunk(x, z);
                }
            }
        }

        for (const [key, chunk] of this.chunks) {
            if (!needed.has(key)) {
                this.unloadChunk(key);
            }
        }
    }

    createChunk(cx, cz) {
        // Higher Res Terrain
        const resolution = 48;
        const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, resolution, resolution);
        geometry.rotateX(-Math.PI / 2);
        geometry.translate(cx * this.chunkSize + this.chunkSize/2, 0, cz * this.chunkSize + this.chunkSize/2);

        const posAttribute = geometry.attributes.position;
        const vertex = new THREE.Vector3();
        let minH = 1000;

        for (let i = 0; i < posAttribute.count; i++) {
            vertex.fromBufferAttribute(posAttribute, i);
            const y = this.calculateHeight(vertex.x, vertex.z);
            posAttribute.setY(i, y);
            if(y < minH) minH = y;
        }

        geometry.computeVertexNormals();
        
        // Choose material based on height?
        // Simple blend is hard with just materials, sticking to grass for now but maybe stone if steep?
        const mesh = new THREE.Mesh(geometry, this.matGrass);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.game.scene.add(mesh);

        // Water
        let waterMesh = null;
        const waterLevel = 4.0;
        if (minH < waterLevel) {
            const wGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize);
            wGeo.rotateX(-Math.PI / 2);
            wGeo.translate(cx * this.chunkSize + this.chunkSize/2, waterLevel, cz * this.chunkSize + this.chunkSize/2);
            waterMesh = new THREE.Mesh(wGeo, this.matWater);
            this.game.scene.add(waterMesh);
        }

        const chunkData = { mesh, water: waterMesh, props: [] };
        this.chunks.set(`${cx},${cz}`, chunkData);
        
        this.populateChunk(chunkData, cx, cz);
    }

    populateChunk(chunk, cx, cz) {
        // RNG
        let seedVal = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453;
        const rng = () => {
            seedVal = Math.sin(seedVal) * 10000;
            return seedVal - Math.floor(seedVal);
        };

        const biome = this.noise2D(cx * 0.05, cz * 0.05); // Large biomes
        
        if (biome > 0.5) {
            // Forest
            this.generateNature(chunk, cx, cz, rng, 30); // Dense
        } else if (biome < -0.5) {
            // Mountains / Ruins
            this.generateRuins(chunk, cx, cz, rng);
            this.generateNature(chunk, cx, cz, rng, 5); // Sparse
        } else {
            // Plains
            this.generateNature(chunk, cx, cz, rng, 10);
            if (rng() > 0.8) this.generateTown(chunk, cx, cz, rng);
        }

        // Monsters everywhere but rare
        if (rng() > 0.4) {
            this.spawnMonster(chunk, cx, cz, rng);
        }
        
        // Dungeon check (Rare)
        if (rng() > 0.9) {
            this.generateDungeonEntrance(chunk, cx, cz, rng);
        }
    }

    spawnMonster(chunk, cx, cz, rng) {
        if (!this.game.network.isHost) return; // Only host spawns logic entities

        const count = 1 + Math.floor(rng() * 4); // Increased spawns
        for(let i=0; i<count; i++) {
            const rx = (rng() - 0.5) * 40;
            const rz = (rng() - 0.5) * 40;
            const wx = cx * this.chunkSize + this.chunkSize/2 + rx;
            const wz = cz * this.chunkSize + this.chunkSize/2 + rz;
            const wy = this.getHeightAt(wx, wz);
            
            if (wy < 4.5) continue;

            // Determine Type based on RNG or Biome
            let type = 'GOBLIN';
            const r = rng();
            if (r > 0.95) type = 'BOSS'; // Rare
            else if (r > 0.7) type = 'ORC';
            else if (r > 0.4) type = 'SKELETON';

            // Create Monster Entity
            const id = `mob_${type}_${cx}_${cz}_${i}`;
            // Check if exists
            if (this.game.monsters.find(m => m.id === id)) continue;

            const m = new Monster(this.game, id, wx, wy, wz);
            this.game.scene.add(m.mesh);
            this.game.monsters.push(m);
            chunk.props.push(m.mesh); 
        }
    }

    generateDungeonEntrance(chunk, cx, cz, rng) {
        const wx = cx * this.chunkSize + this.chunkSize/2;
        const wz = cz * this.chunkSize + this.chunkSize/2;
        const wy = this.getHeightAt(wx, wz);
        
        if (wy < 5) return;

        const group = new THREE.Group();
        group.position.set(wx, wy, wz);
        
        // Ruined Castle / Dungeon Exterior
        const w = 8;
        const h = 6;
        
        // Base Block
        const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), this.matWall);
        base.position.y = h/2;
        base.castShadow = true;
        group.add(base);

        // Turrets
        const turretGeo = new THREE.CylinderGeometry(1, 1, h+2);
        const t1 = new THREE.Mesh(turretGeo, this.matWall);
        t1.position.set(-w/2, h/2+1, -w/2);
        group.add(t1);
        const t2 = new THREE.Mesh(turretGeo, this.matWall);
        t2.position.set(w/2, h/2+1, -w/2);
        group.add(t2);

        // Entrance Arch
        const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 1), new THREE.MeshStandardMaterial({color:0x111111}));
        doorFrame.position.set(0, 2, w/2 + 0.1);
        group.add(doorFrame);
        
        // Black Void
        const voidMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), new THREE.MeshBasicMaterial({color: 0x000000}));
        voidMesh.position.set(0, 1.5, w/2 + 0.6);
        group.add(voidMesh);

        // Torches
        const torchGeo = new THREE.BoxGeometry(0.2, 0.5, 0.2);
        const torchMat = new THREE.MeshBasicMaterial({color: 0xff5500});
        const torch1 = new THREE.Mesh(torchGeo, torchMat);
        torch1.position.set(-2, 3, w/2+0.5);
        group.add(torch1);
        const light1 = new THREE.PointLight(0xff5500, 1, 10);
        light1.position.copy(torch1.position);
        group.add(light1);

        const torch2 = new THREE.Mesh(torchGeo, torchMat);
        torch2.position.set(2, 3, w/2+0.5);
        group.add(torch2);
        const light2 = new THREE.PointLight(0xff5500, 1, 10);
        light2.position.copy(torch2.position);
        group.add(light2);

        this.game.scene.add(group);
        chunk.props.push(group);
        
        // Spawn Dungeon Guardians
        if (this.game.network.isHost) {
            for(let i=0; i<3; i++) {
                const id = `mob_SKELETON_dng_${cx}_${cz}_${i}`;
                if (!this.game.monsters.find(m => m.id === id)) {
                    const gx = wx + (Math.random()-0.5)*10;
                    const gz = wz + 5 + Math.random()*5;
                    const m = new Monster(this.game, id, gx, wy, gz);
                    this.game.scene.add(m.mesh);
                    this.game.monsters.push(m);
                    chunk.props.push(m.mesh);
                }
            }
        }
    }

    generateTown(chunk, cx, cz, rng) {
        const count = 3 + Math.floor(rng() * 4);
        for (let i = 0; i < count; i++) {
            const rx = (rng() - 0.5) * (this.chunkSize - 20);
            const rz = (rng() - 0.5) * (this.chunkSize - 20);
            const wx = cx * this.chunkSize + this.chunkSize/2 + rx;
            const wz = cz * this.chunkSize + this.chunkSize/2 + rz;
            const wy = this.getHeightAt(wx, wz);
            
            if (wy < 5) continue; // Above water

            // Complex House
            const w = 5 + rng() * 3;
            const d = 5 + rng() * 3;
            const h = 4 + rng() * 2;
            
            const house = new THREE.Group();
            house.position.set(wx, wy, wz);

            const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.matWood);
            walls.position.y = h/2;
            walls.castShadow = true;
            walls.receiveShadow = true;
            house.add(walls);

            const roofH = 2.5;
            const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.7, roofH, 4), this.matStone);
            roof.position.y = h + roofH/2;
            roof.rotation.y = Math.PI/4;
            house.add(roof);
            
            // Door
            const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.5), new THREE.MeshStandardMaterial({color:0x221100}));
            door.position.set(0, 1.25, d/2 + 0.05);
            house.add(door);

            this.game.scene.add(house);
            chunk.props.push(house);
        }
    }

    generateRuins(chunk, cx, cz, rng) {
        // Stone Circle or Arches
        const cxWorld = cx * this.chunkSize + this.chunkSize/2;
        const czWorld = cz * this.chunkSize + this.chunkSize/2;
        const cyWorld = this.getHeightAt(cxWorld, czWorld);

        if (cyWorld < 5) return;

        const radius = 8 + rng() * 5;
        const count = 5 + Math.floor(rng()*5);
        
        for(let i=0; i<count; i++) {
            const angle = (i/count) * Math.PI * 2;
            const px = cxWorld + Math.cos(angle) * radius;
            const pz = czWorld + Math.sin(angle) * radius;
            const py = this.getHeightAt(px, pz);

            const h = 4 + rng() * 4;
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.5), this.matStone);
            pillar.position.set(px, py + h/2, pz);
            pillar.rotation.y = rng();
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            
            this.game.scene.add(pillar);
            chunk.props.push(pillar);
        }
    }

    generateNature(chunk, cx, cz, rng, density) {
        for (let i=0; i<density; i++) {
            const rx = (rng() - 0.5) * this.chunkSize;
            const rz = (rng() - 0.5) * this.chunkSize;
            const wx = cx * this.chunkSize + this.chunkSize/2 + rx;
            const wz = cz * this.chunkSize + this.chunkSize/2 + rz;
            const wy = this.getHeightAt(wx, wz);

            if (wy < 4.5) continue; // Water check

            // Tree
            const scale = 0.8 + rng() * 0.8;
            const trunkH = (2 + rng() * 2) * scale;
            
            const tree = new THREE.Group();
            tree.position.set(wx, wy, wz);

            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3*scale, 0.4*scale, trunkH), this.matWood);
            trunk.position.y = trunkH/2;
            trunk.castShadow = true;
            tree.add(trunk);
            
            // Foliage: Stacked cones
            const foliageColor = new THREE.Color().setHSL(0.3 + rng()*0.1, 0.8, 0.4);
            const matFoliage = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.8 });
            
            const levels = 2 + Math.floor(rng() * 2);
            for(let j=0; j<levels; j++) {
                const fh = 2 * scale;
                const fw = (2 - j*0.5) * scale;
                const cone = new THREE.Mesh(new THREE.ConeGeometry(fw, fh, 6), matFoliage);
                cone.position.y = trunkH + (j * fh * 0.6);
                cone.castShadow = true;
                tree.add(cone);
            }

            this.game.scene.add(tree);
            chunk.props.push(tree);
        }
    }

    spawnMonster(chunk, cx, cz, rng) {
        const rx = (rng() - 0.5) * 20;
        const rz = (rng() - 0.5) * 20;
        const wx = cx * this.chunkSize + this.chunkSize/2 + rx;
        const wz = cz * this.chunkSize + this.chunkSize/2 + rz;
        const wy = this.getHeightAt(wx, wz);

        if (wy < 4.5) return;

        // Visual Monster
        const monster = new THREE.Group();
        monster.position.set(wx, wy, wz);
        
        // Body
        const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8), this.matMonster);
        body.position.y = 1.2;
        monster.add(body);
        
        // Legs (Spikes)
        for(let i=0; i<4; i++) {
            const leg = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.5), new THREE.MeshStandardMaterial({color:0x330000}));
            leg.position.y = 0.5;
            leg.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.5;
            leg.rotation.x = (i < 2 ? 1 : -1) * 0.5;
            monster.add(leg);
        }

        this.game.scene.add(monster);
        chunk.props.push(monster);
    }

    unloadChunk(key) {
        const chunk = this.chunks.get(key);
        if (chunk) {
            this.game.scene.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
            
            if (chunk.water) {
                this.game.scene.remove(chunk.water);
                chunk.water.geometry.dispose();
            }

            chunk.props.forEach(p => {
                this.game.scene.remove(p);
            });
            
            // Clean up monsters in this chunk from the main list?
            // If we delete monsters, they respawn when chunk loads. 
            // For now, let's just hide them or let them persist if they walked out?
            // Simple: Remove monsters with ID starting with key
            // Note: In a real game we'd persist them.
            // this.game.monsters = this.game.monsters.filter(m => {
            //     if (m.id.includes(`mob_${key}`)) { // weak check
            //         this.game.scene.remove(m.mesh);
            //         return false;
            //     }
            //     return true;
            // });
        }
        this.chunks.delete(key);
    }

    calculateHeight(x, z) {
        let y = 0;
        // Big Mountains
        y += this.noise2D(x * 0.003, z * 0.003) * 35; 
        // Hills
        y += this.noise2D(x * 0.015, z * 0.015) * 10;
        // Bumps
        y += this.noise2D(x * 0.05, z * 0.05) * 2;
        
        // Water Flattening
        if (y < 4) y = THREE.MathUtils.lerp(y, 3, 0.6);

        return y;
    }

    getHeightAt(x, z) {
        return this.calculateHeight(x, z);
    }
}