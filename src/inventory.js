import { ITEMS, ITEM_TYPES } from './items.js';

export class Inventory {
    constructor(player) {
        this.player = player;
        this.size = 20;
        this.slots = new Array(this.size).fill(null);
        this.equipment = {
            weapon: null,
            armor: null
        };
        
        // Starter Gear
        this.addItem(ITEMS.POTION_HP);
    }

    addItem(itemTemplate) {
        // Simple stack logic could go here, but for now unique slots
        const emptyIdx = this.slots.findIndex(s => s === null);
        if (emptyIdx !== -1) {
            this.slots[emptyIdx] = { ...itemTemplate }; // Clone
            this.player.game.ui.refreshInventory();
            return true;
        }
        return false;
    }

    useItem(index) {
        const item = this.slots[index];
        if (!item) return;

        if (item.type === ITEM_TYPES.CONSUMABLE) {
            if (item.effect) item.effect(this.player);
            this.slots[index] = null;
        } else if (item.type === ITEM_TYPES.WEAPON) {
            // Swap
            const old = this.equipment.weapon;
            this.equipment.weapon = item;
            this.slots[index] = old;
            this.player.updateEquipmentVisuals();
        } else if (item.type === ITEM_TYPES.ARMOR) {
            // Swap
            const old = this.equipment.armor;
            this.equipment.armor = item;
            this.slots[index] = old;
            this.player.updateEquipmentVisuals();
        }
        
        this.player.game.ui.refreshInventory();
    }

    unequip(slotName) {
        const item = this.equipment[slotName];
        if (item) {
            if (this.addItem(item)) {
                this.equipment[slotName] = null;
                this.player.updateEquipmentVisuals();
                this.player.game.ui.refreshInventory();
            }
        }
    }
    
    getDamageBonus() {
        return this.equipment.weapon ? this.equipment.weapon.stats.dmg : 0;
    }
    
    getDefenseBonus() {
        return this.equipment.armor ? this.equipment.armor.stats.def : 0;
    }
}