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
        
        // (Click handlers removed here because they are dynamically assigned in updateEquipSlot now to handle state better)
        
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
            slot.dataset.idx = idx;
            
            // Drag Events
            slot.ondragover = (e) => { e.preventDefault(); slot.classList.add('drag-over'); };
            slot.ondragleave = () => slot.classList.remove('drag-over');
            slot.ondrop = (e) => {
                e.preventDefault();
                slot.classList.remove('drag-over');
                const fromIdx = e.dataTransfer.getData('text/plain');
                if (fromIdx !== '') {
                    inv.moveItem(parseInt(fromIdx), idx);
                }
            };

            if (item) {
                const icon = document.createElement('div');
                icon.className = 'inv-icon';
                icon.style.color = '#' + item.color.toString(16).padStart(6, '0');
                icon.innerText = item.icon || '📦';
                icon.draggable = true;
                
                icon.ondragstart = (e) => {
                    e.dataTransfer.setData('text/plain', idx);
                    document.getElementById('item-desc').innerText = `Dragging ${item.name}...`;
                };
                
                slot.appendChild(icon);
                
                slot.onclick = () => inv.useItem(idx);
                slot.onmouseenter = () => {
                    let stats = "";
                    if (item.stats) {
                        if(item.stats.dmg) stats = `[DMG: ${item.stats.dmg}]`;
                        if(item.stats.def) stats = `[DEF: ${item.stats.def}]`;
                    }
                    document.getElementById('item-desc').innerText = `${item.name} ${stats}\n${item.desc}`;
                    document.getElementById('item-desc').style.color = '#' + item.color.toString(16).padStart(6, '0');
                };
            }
            grid.appendChild(slot);
        });
        
        // Equip slots
        this.updateEquipSlot('slot-weapon', inv.equipment.weapon, 'weapon');
        this.updateEquipSlot('slot-armor', inv.equipment.armor, 'armor');
    }

    updateEquipSlot(domId, item, type) {
        const el = document.getElementById(domId);
        // Clear previous icon if any
        const oldIcon = el.querySelector('.inv-icon');
        if (oldIcon) oldIcon.remove();

        el.style.borderColor = item ? '#' + item.color.toString(16) : '#444';
        
        el.ondragover = (e) => { e.preventDefault(); el.classList.add('drag-over'); };
        el.ondragleave = () => el.classList.remove('drag-over');
        el.ondrop = (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');
            const fromIdx = e.dataTransfer.getData('text/plain');
            if (fromIdx !== '') {
                this.game.localPlayer.inventory.equipItem(parseInt(fromIdx), type);
            }
        };

        if (item) {
            const icon = document.createElement('div');
            icon.className = 'inv-icon';
            icon.style.color = '#' + item.color.toString(16).padStart(6, '0');
            icon.innerText = item.icon || '⚔️';
            icon.onclick = () => this.game.localPlayer.inventory.unequip(type);
            
            // Hover info
            icon.onmouseenter = () => {
                 let stats = "";
                 if(item.stats.dmg) stats = `[DMG: ${item.stats.dmg}]`;
                 if(item.stats.def) stats = `[DEF: ${item.stats.def}]`;
                 document.getElementById('item-desc').innerText = `${item.name} ${stats} (Equipped)`;
            };
            
            el.appendChild(icon);
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