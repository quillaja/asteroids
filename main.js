/**
 * @type {Ship}
 */
let ship;
/**
 * @type {Asteroid[]}
 */
let asteroids = [];

/**
 * @type {number}
 */
let spawnCounter = 0;
const spawnAfter = 180; // frames

/**
 * @type {Camera}
 */
let cam;

const worldHalfWidth = 5000;
const worldHalfHeight = 5000;

let font;

function setup() {
    createCanvas(windowWidth, windowHeight - 10);

    initialize();

    // can't xss load using file:// protocol
    loadFont("PressStart2P.ttf",
        (f) => textFont(f),
        (e) => { textFont("monospace"); console.log("error with 'Press Start 2P': " + e); });
}

function initialize(restart = false) {
    if (restart) {
        const topN = 10;
        let display = document.getElementById("score-display");
        let scoreList = document.getElementById("score-display-list");
        let playerScore = ship.score; // so the score can be captured by the anon funcs below

        document.getElementById("score-close-btn").onclick = () => {
            display.hidden = true;
            let nameInput = document.getElementById("name-input");
            if (nameInput != null) {
                let name = String(nameInput.value).trim();
                scoreList.innerHTML = ""; // remove all the now-obsolete html of the score display
                if (name.length > 0) {
                    getByKey(API_KEY, "scores").then(scores => {
                        scores.push({ "name": name, "score": playerScore });
                        scores = scores.sort((a, b) => b.score - a.score).slice(0, topN);
                        putByKey(API_KEY, "scores", scores)
                            .then(/*v => console.log(v)*/)
                            .catch(e => console.log("didn't write scores: " + e));
                    });
                }
            }
            initialize();
        };

        getByKey(API_KEY, "scores").then((scores) => {

            const ynh = `TEXTBOX${random(100)}`;
            scores.push({ "name": ynh, "score": playerScore });
            let top10 = scores.sort((a, b) => b.score - a.score).slice(0, topN); // asc sort
            let innerhtml = "";
            for (const s of top10) {
                if (s.name == ynh) {
                    innerhtml += `<div class="score"><input id="name-input" class="score-name" type="text" placeholder="Enter your name"><div class="score-number">${s.score}</div></div>`;
                } else {
                    innerhtml += `<div class="score"><div class="score-name">${s.name}</div><div class="score-number">${s.score}</div></div>`;
                }
            }
            scoreList.innerHTML = innerhtml;
            scoreList.hidden = false;
        });

        display.hidden = false;
        document.getElementById("final-score").innerText = ship.score.toString();
    }

    spawnCounter = 0;
    ship = new Ship();
    if (restart) { ship.isGod = true; }
    cam = new Camera(200);
    asteroids = Asteroid.Generate(1);
}

function draw() {
    background(5);

    // update positions
    ship.update();
    ship.bullets.forEach((b) => b.update());
    // asteroids.forEach((a) => a.update());

    // build quadtree
    const treeMargin = 200;
    let tree = new QuadTree(new Rect(
        cam.center.x - width / 2 - treeMargin, cam.center.y - height / 2 - treeMargin,
        cam.center.x + width / 2 + treeMargin, cam.center.y + height / 2 + treeMargin), 5);

    for (const a of asteroids) {
        let p = new Point(a.pos.x, a.pos.y);
        p.data = a; // attach asteroid
        if (tree.insert(p)) {
            a.update();
        }
    }

    // perform collisions
    // first on asteroid-bullets
    let frags = [];
    let maxCollisionTests = 0;
    for (const b of ship.bullets) {
        // bullet-asteroid collision
        let found = tree.query(new Rect(
            b.pos.x - 64, b.pos.y - 64,
            b.pos.x + 64, b.pos.y + 64));
        maxCollisionTests += found.length;
        for (const p of found) {
            let a = p.data; // retrieve asteroid
            if (a.isAlive && b.isAlive && AABB(b, a) && CircleCircle(b, a)) {
                let f = a.applyDamage(b.power);
                frags.push(...f);
                b.isAlive = false;
            }
        }
    }

    // ship-asteroid collision
    let found = tree.query(new Rect(
        ship.pos.x - 64, ship.pos.y - 64,
        ship.pos.x + 64, ship.pos.y + 64));
    maxCollisionTests += found.length;
    for (const p of found) {
        let a = p.data;
        if (AABB(ship, a) && CircleCircle(ship, a)) {
            ship.applyDamage(a.radius);
        }
    }

    // remove dead
    ship.bullets = ship.bullets.filter((b) => b.isAlive);
    let prevLen = asteroids.length;
    asteroids = asteroids.filter((a) => a.isAlive);
    ship.score += prevLen - asteroids.length;
    // add new
    asteroids.push(...frags);

    // spawn new large asteroids
    spawnCounter++;
    if (spawnCounter >= spawnAfter) {
        asteroids.push(...Asteroid.Generate(1));
        spawnCounter = 0;
    }

    // check ship state. restart game if it's dead
    if (!ship.isAlive) {
        initialize(true);
    }

    // draw /////////////////////

    cam.translate(ship);

    // background grid
    const size = 500;
    let grid = createVector(size * floor(cam.center.x / size), size * floor(cam.center.y / size));
    let linecount = createVector(ceil(width / size / 2), ceil(height / size / 2));
    stroke(50);
    for (let x = grid.x - size * linecount.x; x <= grid.x + size * linecount.x; x += size) {
        line(x, ship.pos.y + height, x, ship.pos.y - height);
    }
    for (let y = grid.y - size * linecount.y; y <= grid.y + size * linecount.y; y += size) {
        line(ship.pos.x + width, y, ship.pos.x - width, y);
    }
    // console.log(linecount);

    ship.bullets.forEach((b) => b.draw());
    asteroids.forEach((a) => a.draw());
    ship.draw();

    // show stats if fps drops too low
    if (frameRate() < 40) {
        console.log(`${ceil(frameRate())}fps ${asteroids.length} asteroids ${maxCollisionTests} max col.`);
    }
}

/**
 * Performs Axis Aligned Bounding Box test on 2 objects.
 * @param {Ship|Asteroid|Bullet} a an object
 * @param {Ship|Asteroid|Bullet} b another object
 * @returns {boolean} true if the AABBs collide
 */
function AABB(a, b) {
    return !( // AABB test
        a.pos.x - a.radius > b.pos.x + b.radius ||
        a.pos.x + a.radius < b.pos.x - b.radius ||
        a.pos.y + a.radius < b.pos.y - b.radius ||
        a.pos.y - a.radius > b.pos.y + b.radius
    );
}

/**
 * Performed a circle-circle collision test.
 * @param {Ship|Asteroid|Bullet} a an object
 * @param {Ship|Asteroid|Bullet} b another object
 * @returns {boolean} true if the circles collide
 */
function CircleCircle(a, b) {
    return b.pos.dist(a.pos) <= a.radius + b.radius;
}

class Camera {
    constructor(edgeBufferWidth) {
        this.bufferWidth = edgeBufferWidth;
        this.center = createVector(0, 0);
        this.halfWidth = (width - 2 * edgeBufferWidth) / 2;
        this.halfHeight = (height - 2 * edgeBufferWidth) / 2;
    }

    /**
     * keep camera where it belongs
     * @param {Ship} ship the ship
     */
    translate(ship) {
        let dx = 0;
        let dy = 0;

        if (ship.pos.x > this.center.x + this.halfWidth) {
            dx = ship.pos.x - (this.center.x + this.halfWidth);
        } else if (ship.pos.x < this.center.x - this.halfWidth) {
            dx = ship.pos.x - (this.center.x - this.halfWidth);
        }

        if (ship.pos.y > this.center.y + this.halfHeight) {
            dy = ship.pos.y - (this.center.y + this.halfHeight);
        } else if (ship.pos.y < this.center.y - this.halfHeight) {
            dy = ship.pos.y - (this.center.y - this.halfHeight);
        }

        this.center.x += dx;
        this.center.y += dy;
        this.center.x = constrain(this.center.x, -worldHalfWidth + width / 2, worldHalfWidth - width / 2);
        this.center.y = constrain(this.center.y, -worldHalfHeight + height / 2, worldHalfHeight - height / 2);

        // translate center of screen to camera position.
        translate(width / 2 - this.center.x, height / 2 - this.center.y);
    }
}