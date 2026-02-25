export class Stats {
    constructor() {
        this.maxHp = 100;
        this.currentHp = 100;
        
        // Load prestige from local storage
        this.prestige = parseInt(localStorage.getItem('vl_prestige')) || 1;
        
        // Base skill level (starts at prestige)
        this.sBase = this.prestige;
        
        // Effective skill (calculated)
        this.sEff = this.sBase;
    }

    recalc() {
        const hpPercent = this.currentHp / this.maxHp;
        // Formula: Seff = Sbase * Hp
        // We ensure a minimum of 0.1 effectiveness so they can at least move/act weakly
        this.sEff = Math.max(0.1, this.sBase * hpPercent);
    }

    takeDamage(amount) {
        if (this.currentHp <= 0) return true; // Already dead

        this.currentHp -= amount;
        
        // Permanent Loss Mechanic:
        // Lose base skill proportional to damage taken
        // Penalty factor: Higher levels are harder to maintain?
        // Let's say you lose 1% of the damage value from your Base Level.
        // e.g. Take 10 dmg -> lose 0.1 levels.
        const penalty = (amount / this.maxHp) * 0.5 * this.sBase; 
        
        this.sBase = Math.max(this.prestige, this.sBase - penalty);
        
        this.recalc();
        return this.currentHp <= 0;
    }

    heal(amount) {
        this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
        this.recalc();
    }

    gainExp(amount) {
        // Gaining levels increases base
        this.sBase += amount;
        this.recalc();
    }

    resetToPrestige() {
        this.currentHp = this.maxHp;
        this.sBase = this.prestige;
        this.recalc();
    }
    
    // Call this if they survive a long time or achieve something
    increasePrestige() {
        this.prestige++;
        localStorage.setItem('vl_prestige', this.prestige);
    }
}