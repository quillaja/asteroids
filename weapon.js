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
     * @param {bulletGenerator} genBullet function to generate bullets given a position and ship's heading
     */
    constructor(name, reloadTime, genBullet) {
        this.name = name;

        this.reloadTime = reloadTime;
        this.reloadRemaining = 0;

        this.generate = genBullet;
    }

    /**
     * Reduce the reload remaining counter.
     * @param {number} num how much to reduce the reloadRemaining counter by
     */
    reduceReload(num = 1) { this.reloadRemaining -= num; }

    /**
     * @returns true if the weapon can fire
     */
    get canFire() { return this.reloadRemaining <= 0; }

    /**
     * Generates bullets, modifies reload remaining times.
     * @param {Ship} ship reference to the ship
     * @returns {Bullet[]} generated bullets
     */
    fire(ship) {
        this.reloadRemaining = this.reloadTime;
        sounds.laser.play();
        return this.generate(ship.pos, ship.dir);
    }
}

/**
 * A list of weapons for the ship to use.
 * @type {Weapon[]} da weapons
 */
let arsenal = [

    new Weapon(
        "Blaster", 12, (p, d) => {
            return [new Bullet(p.copy(), d)];
        }
    ),

    new Weapon(
        "Speed blaster", 5, (p, d) => {
            return [new Bullet(p.copy(), d)];
        }
    ),

    new Weapon(
        "Tri-beam", 21, (p, d) => {
            let bullets = [];
            for (let i = -1; i < 2; i++) {
                let b = new Bullet(p.copy(), d + i * PI / 8);
                b.col = color(0, 255, 0);
                bullets.push(b);
            }
            return bullets;
        }
    ),

    new Weapon(
        "Bertha", 30, (p, d) => {
            let b = new Bullet(p.copy(), d, 5);
            b.radius = 40;
            return [b];
        }
    ),

    new Weapon(
        "Mine", 10, (p, d) => {
            let b = new Bullet(p.copy(), d);
            b.vel.x = 0;
            b.vel.y = 0;
            b.col = color(255, 125, 16);
            return [b];
        }
    ),

    new Weapon(
        "Omni-blaster", 40, (p, d) => {
            let bullets = [];
            for (let i = 0; i < 10; i++) {
                let b = new Bullet(p.copy(), d + i * TWO_PI / 10);
                b.col = color(255, 0, 255);
                bullets.push(b);
            }
            return bullets;
        }
    ),

    new Weapon(
        "Space Grenade", 60, (p, d) => {
            let b = new Bullet(p.copy(), d, 0);
            b.col = color(70);
            b.vel.mult(0.5); // half normal speed
            b.onDeath = () => {
                // console.log("onDeath");
                let blast = new Bullet(b.pos, 0, 1);
                blast.vel.mult(0); // don't move.
                blast.life = 1000;
                // add necessary properties for behavior
                blast.col2 = color(255, 255, 0); // yellow
                blast.timeLeft = 60 * 2; // 2 "sec"
                blast.maxRadius = random(100, 150);
                blast.onUpdate = () => {
                    // console.log("blast onUpdate");
                    if (blast.radius < blast.maxRadius) { blast.radius += 1; }
                    blast.timeLeft--;
                    if (blast.timeLeft <= 0) { blast.applyDamage(blast.life); }
                    [blast.col, blast.col2] = [blast.col2, blast.col];
                };
                // TODO: FIX HACK
                ship.bullets.push(blast);
            };

            return [b];
        }
    ),

    new Weapon(
        "Death Blossom", 60, (p, d) => {
            let b = new Bullet(p.copy(), d);
            b.vel.mult(2);
            b.radius *= 0.5;
            b.col = color(0, 200, 50);
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
                            b3.col = color(200, 0, 200);
                            ship.bullets.push(b3); // TODO: FIX HACK
                        }
                    };
                }
            };
            return [b];
        }
    )
];