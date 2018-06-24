
// doc for callback used in Weapon
/**
 * Callback for generating bullets.
 * @callback powerupEffect
 * @param {Ship} ship the ship
 */

class PowerUp {
    /** @returns {number} a "constant" for the perlin noise offset increment.*/
    static get Offset() { return 0.01; }

    /** @returns {number} a "constant" for any bubble's max speed.*/
    static get MaxSpeed() { return 3; }

    static get Size() { return 25; }
    static get Life() { return 8; } //"seconds"

    /**
     * Makes a powerup
     * @param {p5.Vector} pos position
     * @param {string} badge display 1 character.
     * @param {string} text longer description
     * @param {p5.Color} col color
     * @param {powerupEffect} effect func to perform powerup action on ship
     */
    constructor(pos, badge = "", text = "", col = color(255), effect = undefined) {
        this.pos = pos;
        this.radius = PowerUp.Size;
        this.col = col;
        this.badge = badge;
        this.text = text;

        this._x_noise_offset = random(1000);
        this._y_noise_offset = random(1000);

        this.life = 60 * PowerUp.Life; // frames

        /**
         * @type {powerupEffect}
         */
        this.effect = effect;
    }

    /**
     * @returns {boolean} if powerup is "alive"
     */
    get isAlive() { return this.life > 0; }


    /**
     * applies the effect of the powerup to the ship.
     * @param {Ship} ship the ship
     */
    applyEffect(ship) {
        if (this.isAlive && this.effect != undefined) {
            this.effect(ship);
            this.life = 0; // done
            sounds.powerUpGet.play();
        }
    }

    /** Update's the powerup's position. */
    update() {

        this.life--;

        // calc new position
        this.pos.x += PowerUp.MaxSpeed * (noise(this._x_noise_offset) * 2 - 1);
        this.pos.y += PowerUp.MaxSpeed * (noise(this._y_noise_offset) * 2 - 1);

        // move the noise offset ahead.
        this._x_noise_offset += PowerUp.Offset;
        this._y_noise_offset += PowerUp.Offset;

        // wrap object around edges
        // if (this.x < 0) { this.x = width; }
        // if (this.x > width) { this.x = 0; }
        // if (this.y < 0) { this.y = height; }
        // if (this.y > height) { this.y = 0; }
    }

    /** Draws the powerup to the canvas.*/
    draw() {
        push();
        stroke(255);
        fill(this.col);
        ellipse(this.pos.x, this.pos.y, this.radius * 2);
        textAlign(CENTER, CENTER);
        textSize(20);
        fill(255);
        text(this.badge, this.pos.x, this.pos.y);
        pop();
    }


    /**
     * Spawns a powerup and adds it to the global powerup list.
     * @param {p5.Vector} pos place to spawn powerup
    //  * @returns {PowerUp} the powerup
     */
    static Roll(pos) {
        if (random() <= 0.25) { // 25% chance to get a powerup at all
            let itemRoll = random();
            switch (true) {
                // the probabilities below MUST add to 1 (100%) to be valid

                case itemRoll <= 0.4: // 40% to get shield refill
                    powerUps.push(new PowerUp(pos, "S", "Shield refill", color(255, 0, 0),
                        s => {
                            s.refillShield(1);
                        }));
                    return;

                case itemRoll <= 0.8: // 40% chance to get weapon
                    powerUps.push(new PowerUp(pos, "W", "Weapon", color(0, 255, 0),
                        s => {
                            s.giveWeapon(Arsenal.RandomIndex());
                        }));
                    return;

                case itemRoll < 0.9: // 10% chance to get faster turn speed
                    powerUps.push(new PowerUp(pos, "M", "Turn Speed", color(0, 0, 255),
                        s => {
                            s.turnSpeed *= 1.05;
                            HUD.LongDisplay("5% faster turn speed");
                        }));
                    return;

                case itemRoll <= 1: // 10% chance to get thruster upgrade
                    powerUps.push(new PowerUp(pos, "T", "Thruster", color(0, 0, 255),
                        s => {
                            s.maxSpeed *= 1.05;
                            HUD.LongDisplay("5% faster top speed");
                        }));

                default:
                    return;
            }
        }

    }

}