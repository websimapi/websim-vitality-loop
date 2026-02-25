import { Peer } from 'peerjs';
import QRCode from 'qrcode';

export class NetworkManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.connections = []; // List of DataConnections
        this.isHost = false;
    }

    init(id = null) {
        this.peer = new Peer(id);
        
        this.peer.on('open', (id) => {
            console.log('My ID: ' + id);
            this.game.ui.updateNetworkStatus('Connected to Relay', id);
            
            // Update local player ID if we are already in game
            if (this.game.localPlayer) {
                this.game.localPlayer.id = id;
            }

        });

        this.peer.on('connection', (conn) => {
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => console.error(err));
    }

    host() {
        this.isHost = true;
        this.peer = new Peer();
        this.peer.on('open', (id) => {
            console.log('Host initialized:', id);
            this.game.ui.updateNetworkStatus('Hosting', id);
            QRCode.toDataURL(id, (err, url) => {
                if (!err) this.game.ui.showQR(url);
            });
            this.game.startLocalGame(true, id);
        });
        
        this.peer.on('connection', (conn) => this.handleConnection(conn));
        this.peer.on('error', (err) => console.error(err));
    }

    join(hostId) {
        this.isHost = false;
        this.peer = new Peer();
        this.peer.on('open', (myId) => {
            const conn = this.peer.connect(hostId);
            this.handleConnection(conn);
            this.game.startLocalGame(false, myId);
        });
        this.peer.on('connection', (conn) => this.handleConnection(conn));
        this.peer.on('error', (err) => console.error(err));
    }

    handleConnection(conn) {
        this.connections.push(conn);
        
        conn.on('data', (data) => {
            this.processData(data, conn);
        });

        conn.on('open', () => {
            console.log("Connection opened");
            // If I am host, tell them about the world state if needed
        });
    }

    broadcastState(state) {
        const packet = { type: 'STATE', payload: state };
        this.connections.forEach(c => c.send(packet));
    }

    sendHit(targetId, amount) {
        // In pure P2P mesh, we'd send to everyone "I hit X".
        // Here we send to everyone "I hit X", X verifies and takes damage.
        const packet = { type: 'HIT', targetId: targetId, amount: amount };
        this.connections.forEach(c => c.send(packet));
    }

    processData(data, senderConn) {
        if (data.type === 'STATE') {
            const pData = data.payload;
            // Update remote player
            if (pData.id === this.game.localPlayer?.id) return; // Ignore self reflection

            let remote = this.game.players.get(pData.id);
            if (!remote) {
                // New player
                remote = new this.game.PlayerClass(this.game, false, pData.id); // Circular dep fix needed or pass class
                this.game.scene.add(remote.mesh);
                this.game.players.set(pData.id, remote);
            }
            
            // Update mesh position, not the class instance
            if (remote.mesh) {
                remote.mesh.position.set(pData.x, pData.y, pData.z);
                remote.mesh.rotation.y = pData.rot;
            }
            remote.stats.currentHp = pData.hp;
        }

        if (data.type === 'HIT') {
            if (this.game.localPlayer && data.targetId === this.game.localPlayer.id) {
                // I got hit!
                // Security flaw: Trusting client to say "I hit you". 
                // For this jam/prototype, we trust clients.
                this.game.localPlayer.takeDamage(data.amount);
            }
        }
    }
}