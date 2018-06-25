
/** for testing only! =) */
function godMode() {
    ship.isGod = true;
    for (let i = 1; i < Arsenal.length; i++) {
        ship.giveWeapon(i);
    }
}

class Ship {
    static get MAX_SPEED() { return 3; } // pixels/frame
    static get SPEED() { return 0.1; } //pixels/frame
    static get TURN_SPEED() { return 0.05; } // about PI/60 radians/frame
    static get WEAPON_SWITCH_TIME() { return 30; } // frames
    static get INVULNERABLE_TIME() { return 100; } // frames
    static get FULL_SHIELD() { return 100; }
    static get SHIELD_REFILL_SCORE() { return 100; }

    /**
     * Creates a ship.
     */
    constructor() {
        this.pos = createVector(0, 0);
        this.vel = createVector(0, 0);
        this.dir = 0;
        this.radius = 6;

        this.col = color(255);

        this.score = 0;

        this.isAlive = true;
        this.maxShields = Ship.FULL_SHIELD;
        this.shields = this.maxShields;

        this.maxSpeed = Ship.MAX_SPEED;
        this.turnSpeed = Ship.TURN_SPEED;

        this.invulnerable = 0;
        this.invulnerableColor = color(255, 255, 0);
        this.isGod = false;

        /**
         * @type {Weapon[]} list of weapons availiable to the ship
         */
        this.weapons = [];
        this.weaponIndex = 0;
        this.giveWeapon(0);
        this.weaponSwitchWait = Ship.WEAPON_SWITCH_TIME;

        /**
         * the ship keeps the list of bullets it fired.
         * @type {Bullet[]}
         */
        this.bullets = [];

    }

    /**
     * True if the ship is in temporary invulnerability mode (after being hit).
     * @returns {boolean} true if invulnerable
     */
    get isInvulnerable() { return this.invulnerable > 0 || this.isGod; }

    /**
     * @returns True if the ship can switch weapons.
     */
    get canSwitchWeapon() { return this.weaponSwitchWait <= 0; }

    /**
     * Gives the ship an instance of the specified weapon, or overwrites an old
     * instance if one is already in weapons[] (therefore renewing the weapon).
     * @param {number} arsenalIndex index of weapon type in the Arsenal
     * @returns {number} the index in weapons[] of the given weapon. -1 if the index is invalid
     */
    giveWeapon(arsenalIndex) {
        let newWeapon = Arsenal.Get(arsenalIndex);
        if (newWeapon == undefined) { return -1; }

        let i = this.weapons.findIndex(w => w.name == newWeapon.name);
        if (i >= 0) {
            this.weapons[i] = newWeapon;
            HUD.LongDisplay("Refilled " + newWeapon.name);
            return i;
        } else {
            this.weapons.push(newWeapon);
            HUD.LongDisplay("Got " + newWeapon.name);
            return this.weapons.length - 1;
        }
    }

    /**
     * @returns {number} percent [0,1] of shield remaining.
     */
    shieldsRemaining() {
        return this.shields / this.maxShields;
    }

    /**
     * sets shield
     * @param {number} percent percent [0,1] of ship's max shield to refill
     */
    refillShield(percent) {
        this.shields = percent * this.maxShields;
        HUD.LongDisplay(`Shield at ${(100 * this.shieldsRemaining()).toFixed(0)}%`);
    }

    /**
     * Reduces ship's shield (life). Controls alive/dead state, as well as 
     * sets temporary invulnerability after being hit.
     * @param {number} dmg the amount of damage
     */
    applyDamage(dmg) {
        if (!this.isInvulnerable) {
            this.shields -= dmg;
            this.invulnerable = Ship.INVULNERABLE_TIME;
            if (this.shields <= 0) {
                this.isAlive = false;
            }
        }
    }

    /**
     * Updates the ship's position, wraps screen. Reads keyboard for controls. 
     * Updates gun reload and invulnerabilty counters.
     */
    update() {

        // alter reload
        this.weapons[this.weaponIndex].reduceReload();
        this.weaponSwitchWait--;
        // alter invulnerability (post hit)
        if (this.isInvulnerable) {
            this.invulnerable--;
        }

        // check keys pressed (up, down?, left, right, space)
        let f = 0;
        let r = 0;
        if (keyIsDown(UP_ARROW)) {
            f += Ship.SPEED;
        }
        // if (keyIsDown(DOWN_ARROW)) {
        //     f -= Ship.SPEED;
        // }
        if (keyIsDown(LEFT_ARROW)) {
            r -= this.turnSpeed;
        }
        if (keyIsDown(RIGHT_ARROW)) {
            r += this.turnSpeed;
        }
        if (keyIsDown(32)) { // SPACE
            // if 'reload' time, ammo, etc ok, fire bullet. else nothing.
            let w = this.weapons[this.weaponIndex];
            if (w.canFire) {
                // fire
                this.bullets.push(...w.fire(this));
                sounds.laser.play();
            } else if (!w.hasAmmo && w.reloadOk) {
                w.reloadRemaining = w.reloadTime; // TODO: HACK. this section works, but needs streamlined
                sounds.selectError.play();
            }
        }
        if (this.canSwitchWeapon) {
            if (keyIsDown(88)) { // X
                this.weaponIndex++;
                if (this.weaponIndex >= this.weapons.length) {
                    this.weaponIndex = 0;
                }
                this.weaponSwitchWait = Ship.WEAPON_SWITCH_TIME;
                sounds.weaponSelect.play();
            }
            if (keyIsDown(90)) { // Z
                this.weaponIndex--;
                if (this.weaponIndex < 0) {
                    this.weaponIndex = this.weapons.length - 1;
                }
                this.weaponSwitchWait = Ship.WEAPON_SWITCH_TIME;
                sounds.weaponSelect.play();
            }
        }

        // apply changes to ship (force, rotation), limit vel
        this.dir += r; // change ship direction
        this.vel.add(p5.Vector.fromAngle(this.dir, f));
        this.vel.limit(this.maxSpeed);
        this.vel.mult(0.995); //tiny bit of dampening
        // move ship
        this.pos.add(this.vel);

        // wrap screen
        if (this.pos.x < -worldHalfWidth) { this.pos.x = worldHalfWidth; }
        else if (this.pos.x > worldHalfWidth) { this.pos.x = -worldHalfWidth; }
        if (this.pos.y < -worldHalfHeight) { this.pos.y = worldHalfHeight; }
        else if (this.pos.y > worldHalfHeight) { this.pos.y = -worldHalfHeight; }
    }

    /**
     * Draws the ship to the screen, and also draws the shield and score HUD.
     */
    draw() {
        push();
        noStroke();
        if (this.isInvulnerable) {
            fill(this.invulnerableColor);
        } else {
            fill(this.col);
        }
        translate(this.pos);
        rotate(this.dir);
        triangle(16, 0, -6, 5, -6, -5); // ship body
        fill(80);
        triangle(12, 0, -0, 3, 0, -3); // cockpit

        // ship thrusters
        stroke(color(192, 64, 0));
        strokeWeight(2);
        let jetlen = 0;
        if (keyIsDown(UP_ARROW)) { jetlen = 3; strokeWeight(3); }
        if (keyIsDown(LEFT_ARROW) || jetlen > 0) {
            line(-6, 3, -10 - jetlen, 3); // thruster on "right" side
        }
        if (keyIsDown(RIGHT_ARROW) || jetlen > 0) {
            line(-6, -3, -10 - jetlen, -3); // thruster on "left" side
        }

        // display hit circle
        // noFill();
        // stroke(0, 0, 255);
        // ellipse(0, 0, this.radius * 2);

        pop();
    }
}

class HUD {

    constructor() {
        HUD.longDisplay = "";
        HUD.longDisplayTimer = 0;
    }

    /**
     * 
     * @param {string} text text to display
     */
    static LongDisplay(text) {
        HUD.longDisplay = text;
        HUD.longDisplayTimer = 60 * 4; // 4 "seconds"
    }

    static draw() {
        push();
        // untranslate to "normal" screen coords
        translate(cam.center.x - width / 2, cam.center.y - height / 2);

        fill(255, 0, 0);
        rect(5, 5, 200 * ship.shields / Ship.FULL_SHIELD, 20); // shield fill
        rect(5, 28, 200 * ship.weapons[ship.weaponIndex].ammoRemaining(), 20); // ammo fill
        noFill();
        stroke(255);
        rect(5, 5, 200, 20); // shield outline
        rect(5, 28, 200, 20); // ammo outline

        textAlign(LEFT, TOP);
        textSize(14);
        fill(255);
        text("Shield", 7, 9);
        text(ship.weapons[ship.weaponIndex].name, 7, 31);
        text(`Score: ${ship.score}`, 7, 52);

        text(`Loc: ${ship.pos.x.toFixed(0)}, ${ship.pos.y.toFixed(0)}`, 7, 72);
        let fps = frameRate().toFixed(0);
        if (fps <= 30) { fill('red'); }
        text(`FPS: ${fps}`, 7, 92);

        // lower temporary display
        if (HUD.longDisplayTimer > 0) {
            textAlign(CENTER, TOP);
            textSize(24);
            fill(random(160, 256));
            text(HUD.longDisplay, width / 2, height - 30);
            HUD.longDisplayTimer--;
        }

        pop();
    }

}
