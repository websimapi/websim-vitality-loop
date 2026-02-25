export const ITEM_TYPES = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    CONSUMABLE: 'consumable',
    MATERIAL: 'material'
};

export const ITEMS = {
    POTION_HP: { 
        id: 'potion_hp', 
        name: 'Blood Vial', 
        type: ITEM_TYPES.CONSUMABLE, 
        color: 0xff0000,
        effect: (player) => player.stats.heal(30),
        desc: "Restores 30 Vitality."
    },
    SWORD_RUSTY: { 
        id: 'sword_rusty', 
        name: 'Rusty Blade', 
        type: ITEM_TYPES.WEAPON, 
        color: 0x8b4513, 
        stats: { dmg: 5 },
        desc: "Better than nothing. +5 Dmg" 
    },
    SWORD_STEEL: { 
        id: 'sword_steel', 
        name: 'Knight Sword', 
        type: ITEM_TYPES.WEAPON, 
        color: 0xcccccc, 
        stats: { dmg: 12 },
        desc: "Standard issue. +12 Dmg" 
    },
    ARMOR_LEATHER: { 
        id: 'armor_leather', 
        name: 'Tattered Tunic', 
        type: ITEM_TYPES.ARMOR, 
        color: 0x5c4033, 
        stats: { def: 2 },
        desc: "Minor protection. +2 Def"
    },
    ARMOR_PLATE: { 
        id: 'armor_plate', 
        name: 'Iron Breastplate', 
        type: ITEM_TYPES.ARMOR, 
        color: 0x777777, 
        stats: { def: 8 },
        desc: "Solid defense. +8 Def"
    },
    GOLD: {
        id: 'gold',
        name: 'Gold Coin',
        type: ITEM_TYPES.MATERIAL,
        color: 0xffd700,
        desc: "Currency of the realm."
    }
};