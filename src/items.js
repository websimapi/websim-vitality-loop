export const ITEM_TYPES = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    CONSUMABLE: 'consumable',
    MATERIAL: 'material'
};

export const ITEMS = {
    // CONSUMABLES
    POTION_HP: { 
        id: 'potion_hp', 
        name: 'Blood Vial', 
        type: ITEM_TYPES.CONSUMABLE, 
        color: 0xff0000, 
        icon: '🩸',
        effect: (player) => player.stats.heal(30),
        desc: "Restores 30 Vitality. Essential for survival."
    },
    POTION_MAX: {
        id: 'potion_max',
        name: 'Elixir of Life',
        type: ITEM_TYPES.CONSUMABLE,
        color: 0xff00ff,
        icon: '🧪',
        effect: (player) => { player.stats.heal(100); },
        desc: "Fully restores Vitality."
    },

    // WEAPONS
    SWORD_RUSTY: { 
        id: 'sword_rusty', 
        name: 'Rusty Blade', 
        type: ITEM_TYPES.WEAPON, 
        color: 0x8b4513, 
        icon: '🗡️',
        stats: { dmg: 5 },
        desc: "Rusted and dull. +5 Dmg" 
    },
    SWORD_IRON: { 
        id: 'sword_iron', 
        name: 'Iron Longsword', 
        type: ITEM_TYPES.WEAPON, 
        color: 0xaaaaaa, 
        icon: '⚔️',
        stats: { dmg: 10 },
        desc: "Reliable iron. +10 Dmg" 
    },
    SWORD_STEEL: { 
        id: 'sword_steel', 
        name: 'Steel Claymore', 
        type: ITEM_TYPES.WEAPON, 
        color: 0xcccccc, 
        icon: '⚔️',
        stats: { dmg: 18 },
        desc: "Forged for war. +18 Dmg" 
    },
    AXE_BATTLE: {
        id: 'axe_battle',
        name: 'Berserker Axe',
        type: ITEM_TYPES.WEAPON,
        color: 0x664422,
        icon: '🪓',
        stats: { dmg: 25 },
        desc: "Heavy impacts. +25 Dmg"
    },
    SWORD_MYTHRIL: {
        id: 'sword_mythril',
        name: 'Mythril Blade',
        type: ITEM_TYPES.WEAPON,
        color: 0x00ffff,
        icon: '⚡',
        stats: { dmg: 40 },
        desc: "Light as a feather, sharp as a razor. +40 Dmg"
    },

    // ARMOR
    ARMOR_RAGS: {
        id: 'armor_rags',
        name: 'Beggar Rags',
        type: ITEM_TYPES.ARMOR,
        color: 0x888866,
        icon: '👕',
        stats: { def: 1 },
        desc: "Better than naked. +1 Def"
    },
    ARMOR_LEATHER: { 
        id: 'armor_leather', 
        name: 'Leather Armor', 
        type: ITEM_TYPES.ARMOR, 
        color: 0x5c4033, 
        icon: '🧥',
        stats: { def: 5 },
        desc: "Flexible protection. +5 Def"
    },
    ARMOR_CHAIN: {
        id: 'armor_chain',
        name: 'Chainmail',
        type: ITEM_TYPES.ARMOR,
        color: 0x889999,
        icon: '⛓️',
        stats: { def: 10 },
        desc: "Interlinked steel rings. +10 Def"
    },
    ARMOR_PLATE: { 
        id: 'armor_plate', 
        name: 'Knight Plate', 
        type: ITEM_TYPES.ARMOR, 
        color: 0xeeeeee, 
        icon: '🛡️',
        stats: { def: 20 },
        desc: "Full plate protection. +20 Def"
    },
    ARMOR_DRAGON: {
        id: 'armor_dragon',
        name: 'Dragon Scale',
        type: ITEM_TYPES.ARMOR,
        color: 0xaa0000,
        icon: '🐉',
        stats: { def: 35 },
        desc: "Scales harder than steel. +35 Def"
    },

    // MATERIALS
    GOLD: {
        id: 'gold',
        name: 'Gold Coin',
        type: ITEM_TYPES.MATERIAL,
        color: 0xffd700,
        icon: '💰',
        desc: "Currency of the realm."
    },
    GEM_RUBY: {
        id: 'gem_ruby',
        name: 'Blood Ruby',
        type: ITEM_TYPES.MATERIAL,
        color: 0xff0044,
        icon: '💎',
        desc: "Pulsing with faint heat."
    }
};