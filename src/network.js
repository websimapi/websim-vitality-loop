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
            if (this.isHost) {
                // Generate QR
                QRCode.toDataURL(id, (err, url) => {
                    if (!err) this.game.ui.showQR(url);
                });
            }
        });

        this.peer.on('connection', (conn) => {
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => console.error(err));
    }

    host() {
        this.isHost = true;
        this.init(); // Auto-gen ID
        this.game.startLocalGame(true, 'HOST');
    }

    join(hostId) {
        this.isHost = false;
        this.init(); 
        // Connect to host
        // We need to wait for our own ID before connecting usually, 
        // but PeerJS handles queuing slightly. Safer to wait for 'open' ideally but specific flow here:
        this.peer.on('open', (myId) => {
            const conn = this.peer.connect(hostId);
            this.handleConnection(conn);
            this.game.startLocalGame(false, myId);
        });
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
            
            remote.position.set(pData.x, pData.y, pData.z);
            remote.rotation = pData.rot;
            remote.stats.currentHp = pData.hp; // Visual update
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