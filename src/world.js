import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export class World {
    constructor(game) {
        this.game = game;
        this.chunks = new Map(); // "x,z" -> { mesh, water, props: [] }
        this.chunkSize = 64;
        this.renderDist = 2; // Radius of chunks to keep loaded
        this.noise2D = createNoise2D(); 
        
        // Textures
        const loader = new THREE.TextureLoader();
        
        const grassTex = loader.load('./texture_grass.png');
        grassTex.wrapS = THREE.RepeatWrapping;
        grassTex.wrapT = THREE.RepeatWrapping;
        grassTex.repeat.set(4, 4);
        
        const stoneTex = loader.load('./texture_stone.png');
        stoneTex.wrapS = THREE.RepeatWrapping;
        stoneTex.wrapT = THREE.RepeatWrapping;
        stoneTex.repeat.set(2, 2);

        const woodTex = loader.load('./texture_wood.png');
        
        this.matGrass = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.8 });
        this.matStone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9 });
        this.matWood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.7 });
        this.matWater = new THREE.MeshStandardMaterial({ 
            color: 0x0099ff, 
            transparent: true, 
            opacity: 0.7, 
            roughness: 0.1,
            metalness: 0.5
        });
        
        this.objects = []; // Interactive objects like monsters
    }

    update(playerPos) {
        // Determine current chunk
        const cx = Math.floor(playerPos.x / this.chunkSize);
        const cz = Math.floor(playerPos.z / this.chunkSize);

        // Identify needed chunks
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

        // Unload old chunks
        for (const [key, chunk] of this.chunks) {
            if (!needed.has(key)) {
                this.unloadChunk(key);
            }
        }
    }

    createChunk(cx, cz) {
        // Terrain Geometry
        const resolution = 32;
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
        const mesh = new THREE.Mesh(geometry, this.matGrass);
        mesh.receiveShadow = true;
        mesh.castShadow = true; // Terrain casts shadow on water/self
        this.game.scene.add(mesh);

        // Water Plane
        let waterMesh = null;
        if (minH < 1.5) { // Water level is roughly 1.5
            const wGeo = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize);
            wGeo.rotateX(-Math.PI / 2);
            wGeo.translate(cx * this.chunkSize + this.chunkSize/2, 1.5, cz * this.chunkSize + this.chunkSize/2);
            waterMesh = new THREE.Mesh(wGeo, this.matWater);
            this.game.scene.add(waterMesh);
        }

        const chunkData = { mesh, water: waterMesh, props: [] };
        this.chunks.set(`${cx},${cz}`, chunkData);
        
        // Population
        this.populateChunk(chunkData, cx, cz);
    }

    populateChunk(chunk, cx, cz) {
        // RNG based on chunk coord for stability
        const seed = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453);
        const rng = () => {
            const x = Math.sin(seed + Math.random()) * 10000;
            return x - Math.floor(x);
        };

        // Determine Biome / Feature
        const featureNoise = this.noise2D(cx * 0.1, cz * 0.1);
        
        // 1. Town Generation (Rare, flat areas preferred)
        if (featureNoise > 0.6) {
            this.generateTown(chunk, cx, cz, rng);
        } 
        // 2. Dungeon/Ruins (Rare, rocky)
        else if (featureNoise < -0.6) {
            this.generateRuins(chunk, cx, cz, rng);
        } 
        // 3. Nature (Trees/Rocks)
        else {
            this.generateNature(chunk, cx, cz, rng);
        }

        // 4. Monsters
        if (rng() > 0.7) {
            this.spawnMonster(chunk, cx, cz, rng);
        }
    }

    generateTown(chunk, cx, cz, rng) {
        const count = Math.floor(rng() * 5) + 3;
        for (let i = 0; i < count; i++) {
            const rx = (rng() - 0.5) * (this.chunkSize - 10);
            const rz = (rng() - 0.5) * (this.chunkSize - 10);
            const wx = cx * this.chunkSize + this.chunkSize/2 + rx;
            const wz = cz * this.chunkSize + this.chunkSize/2 + rz;
            const wy = this.getHeightAt(wx, wz);
            
            if (wy < 2) continue; // Don't build in water

            // House
            const w = 4 + rng() * 3;
            const h = 3 + rng() * 2;
            const d = 4 + rng() * 3;
            const house = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.matWood);
            house.position.set(wx, wy + h/2, wz);
            house.castShadow = true;
            house.receiveShadow = true;
            
            // Roof
            const roofH = 1.5;
            const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.8, roofH, 4), this.matStone);
            roof.position.set(0, h/2 + roofH/2, 0);
            roof.rotation.y = Math.PI / 4;
            house.add(roof);

            this.game.scene.add(house);
            chunk.props.push(house);
        }
    }

    generateRuins(chunk, cx, cz, rng) {
        // Pillars
        for (let i=0; i<8; i++) {
            const rx = (rng() - 0.5) * 20;
            const rz = (rng() - 0.5) * 20;
            const wx = cx * this.chunkSize + this.chunkSize/2 + rx;
            const wz = cz * this.chunkSize + this.chunkSize/2 + rz;
            const wy = this.getHeightAt(wx, wz);

            const h = 2 + rng() * 6;
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, h, 1), this.matStone);
            pillar.position.set(wx, wy + h/2, wz);
            pillar.castShadow = true;
            this.game.scene.add(pillar);
            chunk.props.push(pillar);
        }
    }

    generateNature(chunk, cx, cz, rng) {
        const count = Math.floor(rng() * 15) + 5;
        for (let i=0; i<count; i++) {
            const rx = (rng() - 0.5) * this.chunkSize;
            const rz = (rng() - 0.5) * this.chunkSize;
            const wx = cx * this.chunkSize + this.chunkSize/2 + rx;
            const wz = cz * this.chunkSize + this.chunkSize/2 + rz;
            const wy = this.getHeightAt(wx, wz);

            if (wy < 1.8) continue; // Skip water

            // Tree (Trunk + Foliage)
            const trunkH = 1 + rng() * 2;
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, trunkH), this.matWood);
            trunk.position.set(wx, wy + trunkH/2, wz);
            trunk.castShadow = true;
            
            const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + rng()), this.matGrass);
            leaves.position.y = trunkH/2 + 0.5;
            trunk.add(leaves);

            this.game.scene.add(trunk);
            chunk.props.push(trunk);
        }
    }

    spawnMonster(chunk, cx, cz, rng) {
        const rx = (rng() - 0.5) * 20;
        const rz = (rng() - 0.5) * 20;
        const wx = cx * this.chunkSize + this.chunkSize/2 + rx;
        const wz = cz * this.chunkSize + this.chunkSize/2 + rz;
        const wy = this.getHeightAt(wx, wz);

        if (wy < 1.8) return;

        // Simple Monster Mesh
        const geo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
        const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const monster = new THREE.Mesh(geo, mat);
        monster.position.set(wx, wy + 0.9, wz);
        monster.castShadow = true;
        
        this.game.scene.add(monster);
        chunk.props.push(monster);
        
        // TODO: Add AI logic loop for monsters
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
                if(p.geometry) p.geometry.dispose();
            });
        }
        this.chunks.delete(key);
    }

    calculateHeight(x, z) {
        // Multi-octave noise
        let y = 0;
        // Base terrain
        y += this.noise2D(x * 0.005, z * 0.005) * 20; 
        // Details
        y += this.noise2D(x * 0.02, z * 0.02) * 5;
        // Roughness
        y += this.noise2D(x * 0.1, z * 0.1) * 1;
        
        // Flatten valleys for water
        if (y < 2) y = y * 0.5;

        return y;
    }

    getHeightAt(x, z) {
        return this.calculateHeight(x, z);
    }
}