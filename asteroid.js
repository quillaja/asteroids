const asteroidPalette = [
    [78, 59, 35],
    [75, 54, 33],
    [73, 56, 39],
    [73, 50, 33],
    [71, 58, 46],
    [71, 57, 44],
    [70, 63, 56],
    [226, 232, 242], // ice
];

/**
 * @type {Map<number, Asteroid[]>} asteroids for recycling
 */
let roidRecycling = new Map();

class Asteroid {
    static get MAX_SPEED() { return 16; } // pixels/frame
    static get MAX_RADIUS() { return 128; } // pixels

    /**
     * Creates an asteroid
     * @param {p5.Vector} pos screen position
     * @param {number} dir direction as an angle/heading
     * @param {number} radius size of asteroid
     */
    constructor(pos, dir, radius = undefined) {
        this.pos = pos;
        this.vel = p5.Vector.fromAngle(dir, Asteroid.MAX_SPEED / radius + random());

        if (radius == undefined) radius = Asteroid.MAX_RADIUS;
        this.radius = radius;
        this.col = color(...random(asteroidPalette));

        this.life = radius / 16;
        this.isAlive = true;

        /**
         * vertices of asteroid shape
         * @type {p5.Vector[]}
         */
        this.verts = [];
        let n = 10;
        if (this.radius <= 64) {
            n = 8;
        }
        if (this.radius <= 16) {
            n = 6; // lower detail for smaller ones
        }
        for (let i = 0; i < n; i++) {
            let v = p5.Vector.fromAngle(
                i / n * TWO_PI,
                this.radius + random(-0.1 * this.radius, 0.25 * this.radius));
            this.verts.push(v);
        }
    }

    // These properties are for interfacing with the PointQuadTree and RectQuadTree
    get x() { return this.pos.x; }
    get y() { return this.pos.y; }
    get rect() {
        return new Rect(this.pos.x - this.radius, this.pos.y - this.radius,
            this.pos.x + this.radius, this.pos.y + this.radius);
    }

    /**
     * Decreases life of the asteroid by dmg, updates alive/dead state,
     * and spawns new asteroids if dead.
     * @param {number} dmg amount of damage to apply
     * @returns {Asteroid[]} new asteroids, or empty array
     */
    applyDamage(dmg) {
        this.life -= dmg;
        let frags = [];
        if (this.life <= 0) {
            this.isAlive = false;
            // split into 2
            sounds.explosion.play();
            if (this.radius > 8) { // don't want them getting smaller than 8!
                // for (let i = 0; i < 2; i++) {
                //     let f = new Asteroid(
                //         this.pos.copy(),
                //         this.vel.heading() + random(-HALF_PI, HALF_PI),
                //         this.radius / 2
                //         // starting with 128 will produce: 128,64,32,16,8.
                //     );
                //     f.col = this.col;
                //     frags.push(f);
                // }
                frags.push(...Asteroid.Get(this.radius / 2, 2));
                // TODO: Ugh... manual "reset" after calling reset in Get(). 
                frags.forEach(a => {
                    a.pos = this.pos.copy();
                    a.vel = p5.Vector.fromAngle(this.vel.heading() + random(-HALF_PI, HALF_PI), Asteroid.MAX_SPEED / a.radius);
                });
            } else { // size 8 (and under) can have a chance to spawn a powerup
                PowerUp.Roll(this.pos.copy());
            }
        }
        return frags;
    }

    /**
     * Updates the asteroid's position according to its velocity. Wraps screen.
     */
    update() {
        // move
        this.pos.add(this.vel);

        // wrap screen
        const margin = 100;
        if (this.pos.x < -margin - worldHalfWidth) { this.pos.x = worldHalfWidth + margin; }
        else if (this.pos.x > worldHalfWidth + margin) { this.pos.x = -margin - worldHalfWidth; }
        if (this.pos.y < -margin - worldHalfHeight) { this.pos.y = worldHalfHeight + margin; }
        else if (this.pos.y > worldHalfHeight + margin) { this.pos.y = -margin - worldHalfHeight; }
    }

    /**
     * Draws the asteroid on the screen.
     */
    draw() {
        push();
        // noFill();
        fill(this.col); // used when drawing asteroids with triangles.
        stroke(this.col);
        // translate(this.pos); // can't use with begin/endShape()
        beginShape();
        for (let i = 0; i < this.verts.length; i++) {
            vertex(this.verts[i].x + this.pos.x, this.verts[i].y + this.pos.y);
        }
        endShape(CLOSE);

        // display hit circle
        // noFill();
        // stroke(0, 0, 255);
        // ellipse(this.pos.x, this.pos.y, this.radius * 2);

        pop();
    }

    reset() {
        let [loc, heading] = getLocAndDir();
        this.pos.set(loc);
        this.vel.rotate(heading - this.vel.heading());
        this.isAlive = true;
        this.life = this.radius / 16;
    }

    /**
     * Creates new asteroids off screen at a random position around the edge.
     * @param {number} num how many to make
     * @param {number} radius size to make them (if undefined, will use
     * Asteroid's constructor default.)
     * @returns {Asteroid[]} the new asteroids
     */
    static Generate(num = 1, radius = undefined) {
        let roids = [];
        for (; num > 0; num--) {
            let [spawnLoc, reverseHeading] = getLocAndDir();
            roids.push(new Asteroid(spawnLoc, reverseHeading, radius));
        }
        return roids;
    }

    /**
     * Reclaim asteroids fron recycling. Will generate new ones if 
     * there are not enough of the given size available.
     * @param {number} radius size of asteroid(s) to retrieve
     * @param {number} num number to retrieve
     * @returns {Asteroid[]} the roids you're looking for.
     */
    static Get(radius, num) {
        let roids = [];
        if (roidRecycling.has(radius)) {
            let bin = roidRecycling.get(radius);

            if (num <= bin.length) {
                // there are enough in the recycling. take what is needed.
                roids = bin.splice(bin.length - num, num);
                num = 0; // don't need to generate any more
            } else {
                // we're taking them all
                [bin, roids] = [roids, bin]; // swap (empty) roids and bin
                num -= roids.length; // modify num to contain the amout we still need to generate
            }

            // asteroids in roids need "reset"
            roids.forEach(a => a.reset());
        }

        // generate asteroids if 1) there are none 2) the amount available was insufficent
        if (num > 0) {
            roids.push(...Asteroid.Generate(num, radius));
        }
        return roids;

    }

    /**
     * Puts an asteroid into recycling.
     * @param {Asteroid} a the asteroid to recycle.
     */
    static Put(a) {
        if (roidRecycling.has(a.radius)) {
            roidRecycling.get(a.radius).push(a);
        } else {
            roidRecycling.set(a.radius, [a]);
        }
    }
}

/**
 * @returns {[p5.Vector, number]} hi mom
 */
function getLocAndDir() {
    let spawnLoc = p5.Vector.fromAngle(random(0, TWO_PI), dist(0, 0, width / 2, height / 2));
    let reverseHeading = spawnLoc.heading() + PI + random(-PI / 6, PI / 6);
    spawnLoc.mult(1.1).add(cam.center.x, cam.center.y); // lengthen slightly and translate to screen center

    return [spawnLoc, reverseHeading];
}