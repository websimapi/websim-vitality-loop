export class UIManager {
    constructor(game) {
        this.game = game;
        
        // Lobby Bindings
        document.getElementById('host-btn').onclick = () => {
            this.game.network.host();
            this.hideLobby();
        };
        
        document.getElementById('join-btn').onclick = () => {
            const code = document.getElementById('join-code').value;
            if(code) {
                this.game.network.join(code);
                this.hideLobby();
            }
        };

        document.getElementById('respawn-btn').onclick = () => {
            this.game.localPlayer.stats.resetToPrestige();
            this.game.localPlayer.mesh.rotation.x = 0; // Stand up
            this.game.localPlayer.mesh.rotation.z = 0;
            this.game.localPlayer.position.set(0, 10, 0); // Respawn pos
            document.getElementById('death-screen').style.display = 'none';
        };

        // Inventory
        document.getElementById('inv-toggle-btn').onclick = () => this.toggleInventory();
        document.getElementById('inv-close').onclick = () => this.toggleInventory();
        
        document.getElementById('slot-weapon').onclick = () => this.game.localPlayer.inventory.unequip('weapon');
        document.getElementById('slot-armor').onclick = () => this.game.localPlayer.inventory.unequip('armor');
        
        document.getElementById('pickup-btn').onclick = () => this.game.localPlayer.tryPickup();
    }

    toggleInventory() {
        const el = document.getElementById('inventory-screen');
        if (el.style.display === 'flex') {
            el.style.display = 'none';
        } else {
            el.style.display = 'flex';
            this.refreshInventory();
        }
    }

    refreshInventory() {
        if (!this.game.localPlayer) return;
        const inv = this.game.localPlayer.inventory;
        const grid = document.getElementById('inv-grid');
        grid.innerHTML = '';

        inv.slots.forEach((item, idx) => {
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            if (item) {
                const icon = document.createElement('div');
                icon.className = 'inv-icon';
                icon.style.backgroundColor = '#' + item.color.toString(16).padStart(6, '0');
                slot.appendChild(icon);
                
                slot.onclick = () => inv.useItem(idx);
                slot.onmouseenter = () => {
                    document.getElementById('item-desc').innerText = `${item.name}: ${item.desc}`;
                };
            }
            grid.appendChild(slot);
        });
        
        // Equip slots
        this.updateEquipSlot('slot-weapon', inv.equipment.weapon);
        this.updateEquipSlot('slot-armor', inv.equipment.armor);
    }

    updateEquipSlot(id, item) {
        const el = document.getElementById('slot-weapon').parentElement.querySelector(`#${id}`);
        el.style.borderColor = item ? '#' + item.color.toString(16) : '#666';
        if (item) {
             // Visual indication
        }
    }

    showPickupBtn(show) {
        document.getElementById('pickup-btn').style.display = show ? 'block' : 'none';
    }

    hideLobby() {
        document.getElementById('lobby-screen').style.display = 'none';
    }

    showHUD() {
        document.getElementById('hud').style.display = 'flex';
    }

    showDeath() {
        document.getElementById('death-screen').style.display = 'flex';
    }

    updateStats(stats) {
        const hpPct = (stats.currentHp / stats.maxHp) * 100;
        document.getElementById('hp-bar').style.width = `${hpPct}%`;
        document.getElementById('hp-text').innerText = `${Math.ceil(stats.currentHp)}/${stats.maxHp}`;
        
        document.getElementById('base-lvl').innerText = stats.sBase.toFixed(2);
        document.getElementById('eff-lvl').innerText = stats.sEff.toFixed(2);
        document.getElementById('prestige-lvl').innerText = stats.prestige;
        document.getElementById('lvl-text').innerText = `Lvl ${Math.floor(stats.sBase)}`;
    }

    updateNetworkStatus(msg, id) {
        document.getElementById('status-msg').innerText = msg;
        if(id) document.getElementById('host-id-display').innerText = `ID: ${id}`;
    }

    showQR(url) {
        const div = document.getElementById('qr-display');
        div.style.display = 'block';
        div.innerHTML = `<img src="${url}" width="150" height="150"/>`;
    }
}