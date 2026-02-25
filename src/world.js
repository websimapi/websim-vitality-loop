import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export class World {
    constructor(game) {
        this.game = game;
        this.chunks = new Map();
        this.chunkSize = 32;
        this.noise2D = createNoise2D(); // Default seed
        
        // Load textures
        const loader = new THREE.TextureLoader();
        this.matGrass = new THREE.MeshStandardMaterial({ map: loader.load('./texture_grass.png') });
        this.matStone = new THREE.MeshStandardMaterial({ map: loader.load('./texture_stone.png') });
    }

    generate(seed) {
        // Re-seed noise if lib supports it, or just use offset.
        // For simplicity, we just generate a central area.
        this.createChunk(0, 0);
    }

    createChunk(cx, cz) {
        const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, 32, 32);
        geometry.rotateX(-Math.PI / 2);

        const posAttribute = geometry.attributes.position;
        const vertex = new THREE.Vector3();

        for (let i = 0; i < posAttribute.count; i++) {
            vertex.fromBufferAttribute(posAttribute, i);
            
            // Height logic
            const nx = (vertex.x + cx * this.chunkSize) * 0.05;
            const nz = (vertex.z + cz * this.chunkSize) * 0.05;
            
            let y = this.noise2D(nx, nz) * 4;
            // Flatten center
            if (Math.abs(vertex.x) < 5 && Math.abs(vertex.z) < 5) y *= 0.1;

            posAttribute.setY(i, y);
        }

        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, this.matGrass);
        mesh.receiveShadow = true;
        this.game.scene.add(mesh);
        
        // Add props (Trees/Rocks)
        this.populateChunk(mesh, cx, cz);
    }
    
    populateChunk(mesh, cx, cz) {
        // Add random cubes as rocks/trees
        for(let i=0; i<10; i++) {
            const x = (Math.random() - 0.5) * this.chunkSize;
            const z = (Math.random() - 0.5) * this.chunkSize;
            const y = this.getHeightAt(x, z);
            
            const h = Math.random() * 2 + 1;
            const geo = new THREE.BoxGeometry(0.5, h, 0.5);
            const m = new THREE.Mesh(geo, this.matStone);
            m.position.set(x, y + h/2, z);
            m.castShadow = true;
            this.game.scene.add(m);
        }
    }

    getHeightAt(x, z) {
        // Replicate noise logic (Quick dirty way)
        // Ideally we sample the geometry but noise function is stateless
        const nx = x * 0.05;
        const nz = z * 0.05;
        let y = this.noise2D(nx, nz) * 4;
        if (Math.abs(x) < 5 && Math.abs(z) < 5) y *= 0.1;
        return y;
    }
}