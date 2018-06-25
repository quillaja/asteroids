class Bullet {
    static get SPEED() { return 10; }//px/frame

    /**
     * Creates a bullet
     * @param {p5.Vector} pos screen position
     * @param {number} dir heading/direction as an angle (radians)
     */
    constructor(pos, dir, power = 1) {
        this.pos = pos;
        this.vel = p5.Vector.fromAngle(dir, Bullet.SPEED);

        this.radius = 3;
        this.col = color(255, 0, 0);

        this.power = power; // damage power

        this.life = 1;
        this._isAlive = true;

        /**
         * @type {function} called on bullet update
         */
        this.onUpdate = () => { }; // do nothing by default

        /**
         * @type {function} called on bullet death
         */
        this.onDeath = () => { }; // do nothing by default
    }

    /**
     * @returns {boolean} get only. true if bullet is in "alive" state.
     */
    get isAlive() { return this._isAlive; }

    /**
     * subtract from this bullet's "life" or "durability".
     * @param {number} amount amount of damage to apply.
     */
    applyDamage(amount = 1) {
        this.life -= amount;
        if (this.life <= 0) {
            this.onDeath();
            this._isAlive = false;
        }
    }

    /**
     * Updates the bullet's position using velocity. Kills the bullet
     * if it leaves the screen.
     */
    update() {
        // move
        this.pos.add(this.vel);

        // deal with screen edges
        if (this.pos.x < cam.center.x - width / 2 ||
            this.pos.x > cam.center.x + width / 2 ||
            this.pos.y < cam.center.y - height / 2 ||
            this.pos.y > cam.center.y + height / 2) {
            this._isAlive = false;
        }

        this.onUpdate();
    }

    /**
     * Draws the bullet on the screen.
     */
    draw() {
        push();
        noStroke();
        fill(this.col);
        translate(this.pos);
        ellipse(0, 0, this.radius * 2);
        pop();
    }
}

// doc for callback used in Weapon
/**
 * Callback for generating bullets.
 * @callback bulletGenerator
 * @param {p5.Vector} pos position of ship. you should copy() this.
 * @param {number} dir ship's heading
 * @returns {Bullet[]} a list of new Bullets
 */

/**
 * a weapon
 */
class Weapon {

    /**
     * Make a new Weapon
     * @param {string} name name of the weapon
     * @param {number} reloadTime num frames weapon must 'cool down'
     * @param {number} ammoCapacity number of shots this weapon can fire before repletion.
     * @param {bulletGenerator} genBullet function to generate bullets given a position and ship's heading
     */
    constructor(name, reloadTime, ammoCapacity, genBullet) {
        this.name = name;

        this.reloadTime = reloadTime;
        this.reloadRemaining = 0;

        this.ammoCapacity = ammoCapacity;
        this.ammo = ammoCapacity;

        this.generate = genBullet;
    }

    /**
     * Reduce the reload remaining counter.
     * @param {number} num how much to reduce the reloadRemaining counter by
     */
    reduceReload(num = 1) { this.reloadRemaining -= num; }

    /**
     * @returns {boolean} true if the weapon can fire
     */
    get canFire() { return this.reloadRemaining <= 0 && this.ammo > 0; }

    /**
     * @returns {boolean} ammo is not depleted
     */
    get hasAmmo() { return this.ammo > 0; }

    /**
     * @returns {boolean} weapon finished reloading
     */
    get reloadOk() { return this.reloadRemaining <= 0; }

    /**
     * @returns {number} percent ammo left as [0,1]
     */
    ammoRemaining() {
        if (!isFinite(this.ammo)) { return 1; }
        return this.ammo / this.ammoCapacity;
    }

    /**
     * Generates bullets, modifies reload remaining times.
     * @param {Ship} ship reference to the ship
     * @returns {Bullet[]} generated bullets
     */
    fire(ship) {
        this.reloadRemaining = this.reloadTime;
        this.ammo--;
        return this.generate(ship.pos, ship.dir);
    }
}

class Arsenal {

    /**
     * @returns {number} number of weapons in arsenal. last index is length-1.
     */
    static get length() { return 8; }

    /**
     * @returns a random integer in [1, Arsenal.length-1]
     */
    static RandomIndex() {
        return ceil(random(Arsenal.length - 1));
    }

    /**
     * Gets a copy of a weapon instance.
     * @param {number} index 
     * @returns {Weapon} a fresh copy of the weapon at index
     */
    static Get(index) {

        switch (index) {
            case 0:
                return new Weapon(
                    "Blaster", 12, Infinity, (p, d) => {
                        return [new Bullet(p.copy(), d)];
                    }
                );

            case 1:
                return new Weapon(
                    "Speed blaster", 5, 1000, (p, d) => {
                        return [new Bullet(p.copy(), d)];
                    }
                );

            case 2:
                return new Weapon(
                    "Bertha", 30, 200, (p, d) => {
                        let b = new Bullet(p.copy(), d, 10);
                        b.radius = 40;
                        b.col = color(0, 200, 255);
                        return [b];
                    }
                );

            case 3:
                return new Weapon(
                    "Tri-beam", 21, 500, (p, d) => {
                        let bullets = [];
                        for (let i = -1; i < 2; i++) {
                            let b = new Bullet(p.copy(), d + i * PI / 8);
                            b.col = color(0, 0, 255);
                            bullets.push(b);
                        }
                        return bullets;
                    }
                );

            case 4:
                return new Weapon(
                    "Mine", 10, 500, (p, d) => {
                        let b = new Bullet(p.copy(), d);
                        b.vel.x = 0;
                        b.vel.y = 0;
                        b.col = color(255, 125, 16);
                        return [b];
                    }
                );

            case 5:
                return new Weapon(
                    "Omni-blaster", 40, 100, (p, d) => {
                        let bullets = [];
                        for (let i = 0; i < 10; i++) {
                            let b = new Bullet(p.copy(), d + i * TWO_PI / 10);
                            b.col = color(255, 0, 255);
                            bullets.push(b);
                        }
                        return bullets;
                    }
                );

            case 6:
                return new Weapon(
                    "Nova", 60, 10, (p, d) => {
                        let b = new Bullet(p.copy(), d, 0);
                        b.col = color(70);
                        b.vel.mult(0.5); // half normal speed
                        b.onDeath = () => {
                            let blast = new Bullet(b.pos, 0, 1);
                            blast.vel.mult(0); // don't move.
                            blast.life = 1000;
                            // add necessary properties for behavior
                            blast.col2 = color(255, 255, 0); // yellow
                            blast.timeLeft = 60 * 2; // 2 "sec"
                            blast.maxRadius = random(135, 180);
                            blast.radiusInc = blast.maxRadius / blast.timeLeft;
                            blast.onUpdate = () => {
                                blast.radius += blast.radiusInc;
                                blast.timeLeft--;
                                if (blast.timeLeft <= 0) { blast.applyDamage(blast.life); } // kill bullet
                                [blast.col, blast.col2] = [blast.col2, blast.col]; // swap beteen the 2 colors to produce a 'fire' effect
                                blast.col.setAlpha(map(blast.timeLeft, 20, 0, 255, 0));//slow fade of explosion
                            };
                            // TODO: FIX HACK
                            ship.bullets.push(blast);
                        };

                        return [b];
                    }
                );

            case 7:
                return new Weapon(
                    "Death Blossom", 60, 10, (p, d) => {
                        let b = new Bullet(p.copy(), d);
                        b.vel.mult(2);
                        b.radius *= 0.5;
                        b.col = color(0, 255, 50);
                        b.onDeath = () => {
                            for (let i = 0; i < 16; i++) {
                                let b2 = new Bullet(b.pos.copy(), i * TWO_PI / 16);
                                b2.pos.add(b2.vel);
                                b2.vel.mult(0.75);
                                b2.col = color(255, 255, 0);
                                ship.bullets.push(b2); // TODO: FIX HACK
                                b2.onDeath = () => {
                                    for (let i = 0; i < 16; i++) {
                                        let b3 = new Bullet(b2.pos.copy(), i * TWO_PI / 16);
                                        b3.vel.mult(1.2);
                                        b3.pos.add(b3.vel);
                                        b3.radius *= 2;
                                        b3.col = color(150, 0, 150);
                                        ship.bullets.push(b3); // TODO: FIX HACK
                                    }
                                };
                            }
                        };
                        return [b];
                    }
                );

            default:
                return undefined;

        } // end case
    }
}