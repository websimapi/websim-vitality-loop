import nipplejs from 'nipplejs';

export class InputManager {
    constructor(game) {
        this.game = game;
        this.keys = {};
        this.state = { x: 0, y: 0, attack: false };
        
        // Keyboard
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        // Mobile
        this.setupMobile();
        
        // Attack Button (Desktop Click)
        window.addEventListener('mousedown', (e) => {
            // Only if not touching UI
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                this.state.attack = true;
                setTimeout(() => this.state.attack = false, 100);
            }
        });
    }

    setupMobile() {
        // Detect touch
        if ('ontouchstart' in window) {
            document.getElementById('mobile-controls').style.display = 'block';
            
            const manager = nipplejs.create({
                zone: document.getElementById('joystick-zone'),
                mode: 'static',
                position: { left: '60px', bottom: '60px' },
                color: 'white'
            });

            manager.on('move', (evt, data) => {
                if (data.vector) {
                    this.state.x = data.vector.x;
                    this.state.y = -data.vector.y; // Nipple Y is inverted relative to 3D Z usually
                }
            });

            manager.on('end', () => {
                this.state.x = 0;
                this.state.y = 0;
            });

            const btn = document.getElementById('action-btn');
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.state.attack = true;
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.state.attack = false;
            });
        }
    }

    getState() {
        // Merge Keyboard
        let kx = 0;
        let ky = 0;
        if (this.keys['KeyW']) ky -= 1;
        if (this.keys['KeyS']) ky += 1;
        if (this.keys['KeyA']) kx -= 1;
        if (this.keys['KeyD']) kx += 1;
        
        // Normalize keyboard vector
        if (kx !== 0 || ky !== 0) {
            const len = Math.sqrt(kx*kx + ky*ky);
            kx /= len;
            ky /= len;
        }

        // Combine (Prioritize touch if active, else keyboard)
        const x = Math.abs(this.state.x) > 0 ? this.state.x : kx;
        const y = Math.abs(this.state.y) > 0 ? this.state.y : ky;

        return { x, y, attack: this.state.attack };
    }
}