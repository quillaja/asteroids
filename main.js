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
const maxAsteroidSize = 128;

/**
 * @type {PowerUp[]}
 */
let powerUps = [];

/**
 * @type {QuadTree}
 */
let stars = null;
const startCount = 5000;

/**
 * @type {Camera}
 */
let cam;

const worldHalfWidth = 5000;
const worldHalfHeight = 5000;

let sounds = {
    /**
     * @type {p5.SoundFile}
     */
    explosion: null,

    /**
     * @type {p5.SoundFile}
     */
    laser: null,

    /**
     * @type {p5.SoundFile}
     */
    weaponSelect: null,

    /**
     * @type {p5.SoundFile}
     */
    selectError: null,

    /**
     * @type {p5.SoundFile}
     */
    powerUpGet: null,
}

function preload() {

    // TODO: make it so that if sound can't load, keep going (not "fail")
    try {
        loadSound("sound/explosion_short.mp3",
            (s) => { sounds.explosion = s; sounds.explosion.setVolume(0.5); },
            (e) => console.log("explosion: " + e));
        loadSound("sound/laser_short.mp3",
            (s) => { sounds.laser = s; sounds.laser.setVolume(0.5); },
            (e) => console.log("laser: " + e));
        loadSound("sound/change_weapon.mp3",
            (s) => { sounds.weaponSelect = s; sounds.weaponSelect.setVolume(0.5); },
            (e) => console.log("weaponSelect: " + e));
        loadSound("sound/error.mp3",
            (s) => { sounds.selectError = s; sounds.selectError.setVolume(0.5); },
            (e) => console.log("selectError: " + e));
        loadSound("sound/get_powerup.mp3",
            (s) => { sounds.powerUpGet = s; sounds.powerUpGet.setVolume(0.5); },
            (e) => console.log("powerUpGet: " + e));
    } catch (err) {
        console.log("sound loading: " + err);
    }
}

function setup() {
    createCanvas(windowWidth, windowHeight - 10);

    showIntro();

    // can't xss load using file:// protocol
    // use monospace as fallback
    loadFont("PressStart2P.ttf",
        (f) => textFont(f),
        (e) => { textFont("monospace"); console.log("error with 'Press Start 2P': " + e); });

    // make starfield for background
    stars = new QuadTree(
        new Rect(-worldHalfWidth, -worldHalfHeight, worldHalfWidth, worldHalfHeight),
        1, true);
    for (let i = 0; i < startCount; i++) {
        stars.insert(new Point(
            random(-worldHalfWidth, worldHalfWidth),
            random(-worldHalfHeight, worldHalfHeight)));
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight - 10);
    cam.adjustParamsToNewWindow();
}

function showIntro() {
    let intro = document.getElementById("intro-display");
    let button = document.getElementById("intro-close-btn");
    button.onclick = () => {
        intro.hidden = true;
        initialize();
    }

    intro.hidden = false;
    initialize();
    ship.isGod = true; // hackish
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
    cam = new Camera(250);
    asteroids = Asteroid.Generate(1, maxAsteroidSize);
    powerUps = [];
}

function draw() {
    background(5);

    // update positions
    ship.update();
    ship.bullets.forEach(b => b.update());
    asteroids.forEach(a => a.update());
    powerUps.forEach(p => p.update());

    // build quadtree
    // root has region covering the visible screen
    const treeMargin = 0;
    let tree = new QuadTree(new Rect(
        cam.center.x - width / 2 - treeMargin, cam.center.y - height / 2 - treeMargin,
        cam.center.x + width / 2 + treeMargin, cam.center.y + height / 2 + treeMargin), 5);

    for (const a of asteroids) {
        let p = new Point(a.pos.x, a.pos.y);
        p.data = a; // attach asteroid
        tree.insert(p)
    }

    // perform collisions
    // first on asteroid-bullets
    let frags = [];
    let margin = 0;
    let maxCollisionTests = 0;
    for (const b of ship.bullets) {
        // bullet-asteroid collision
        margin = b.radius + maxAsteroidSize;
        let found = tree.query(new Rect(
            b.pos.x - margin, b.pos.y - margin,
            b.pos.x + margin, b.pos.y + margin));
        maxCollisionTests += found.length;
        for (const p of found) {
            let a = p.data; // retrieve asteroid
            if (a.isAlive && b.isAlive /*&& AABB(b, a)*/ && CircleCircle(b, a)) {
                let f = a.applyDamage(b.power);
                frags.push(...f);
                b.applyDamage();
            }
        }
    }

    // ship-asteroid collision
    margin = ship.radius + maxAsteroidSize;
    let found = tree.query(new Rect(
        ship.pos.x - margin, ship.pos.y - margin,
        ship.pos.x + margin, ship.pos.y + margin));
    maxCollisionTests += found.length;
    for (const p of found) {
        let a = p.data;
        if (/*AABB(ship, a) &&*/ CircleCircle(ship, a)) {
            ship.applyDamage(a.radius);
        }
    }

    // ship-powerup collision
    for (const up of powerUps) {
        if (/*AABB(up, ship) &&*/ CircleCircle(up, ship)) {
            up.applyEffect(ship);
        }
    }

    // remove dead
    ship.bullets = ship.bullets.filter(b => b.isAlive);
    powerUps = powerUps.filter(p => p.isAlive);

    let prevLen = asteroids.length;
    asteroids = asteroids.filter(a => a.isAlive);
    ship.score += prevLen - asteroids.length;

    // add new
    asteroids.push(...frags);

    // spawn new large asteroids
    spawnCounter++;
    if (spawnCounter >= spawnAfter) {
        asteroids.push(...Asteroid.Generate(1, maxAsteroidSize));
        spawnCounter = 0;
    }

    // check ship state. restart game if it's dead
    if (!ship.isAlive) {
        initialize(true);
    }

    // draw /////////////////////

    cam.translate(ship.pos);

    // background grid
    // const size = 1000;
    // let grid = createVector(size * floor(cam.center.x / size), size * floor(cam.center.y / size));
    // let linecount = createVector(ceil(width / size / 2), ceil(height / size / 2));
    // stroke(30);
    // for (let x = grid.x - size * linecount.x; x <= grid.x + size * linecount.x; x += size) {
    //     line(x, ship.pos.y + height, x, ship.pos.y - height);
    // }
    // for (let y = grid.y - size * linecount.y; y <= grid.y + size * linecount.y; y += size) {
    //     line(ship.pos.x + width, y, ship.pos.x - width, y);
    // }

    // stars
    stroke(random(128, 255));
    for (const s of stars.query(tree.range)) {
        // stroke(random(150, 255));
        point(s.x, s.y);
    }

    powerUps.forEach(p => p.draw());
    ship.bullets.forEach(b => b.draw());
    // asteroids.forEach((a) => a.draw());
    tree.query(
        new Rect(
            tree.range.x1 - maxAsteroidSize, tree.range.y1 - maxAsteroidSize,
            tree.range.x2 + maxAsteroidSize, tree.range.y2 + maxAsteroidSize))
        .forEach(p => p.data.draw()); // draws only asteroids on visible screen
    ship.draw();
    HUD.draw();

    // show stats if fps drops too low
    if (frameRate() <= 30) {
        console.log(`${minute()}:${second()}-${ceil(frameRate())}fps, ${asteroids.length}a, ${maxCollisionTests}c`);
    }
}

/**
 * Performs Axis Aligned Bounding Box test on 2 objects.
 * @param {Ship|Asteroid|Bullet|PowerUp} a an object
 * @param {Ship|Asteroid|Bullet|PowerUp} b another object
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
 * @param {Ship|Asteroid|Bullet|PowerUp} a an object
 * @param {Ship|Asteroid|Bullet|PowerUp} b another object
 * @returns {boolean} true if the circles collide
 */
function CircleCircle(a, b) {
    let sumR = a.radius + b.radius;
    return p5.Vector.sub(a.pos, b.pos).magSq() <= sumR * sumR;
}

class Camera {
    constructor(edgeBufferWidth) {
        this.bufferWidth = edgeBufferWidth;
        this.center = createVector(0, 0);
        this.halfWidth = (width - 2 * edgeBufferWidth) / 2;
        this.halfHeight = (height - 2 * edgeBufferWidth) / 2;
    }

    adjustParamsToNewWindow() {
        this.halfWidth = (width - 2 * this.bufferWidth) / 2;
        this.halfHeight = (height - 2 * this.bufferWidth) / 2;
    }

    /**
     * keep camera where it belongs
     * @param {p5.Vector} lookAt the location to look at
     */
    translate(lookAt) {
        let dx = 0;
        let dy = 0;

        if (lookAt.x > this.center.x + this.halfWidth) {
            dx = lookAt.x - (this.center.x + this.halfWidth);
        } else if (lookAt.x < this.center.x - this.halfWidth) {
            dx = lookAt.x - (this.center.x - this.halfWidth);
        }

        if (lookAt.y > this.center.y + this.halfHeight) {
            dy = lookAt.y - (this.center.y + this.halfHeight);
        } else if (lookAt.y < this.center.y - this.halfHeight) {
            dy = lookAt.y - (this.center.y - this.halfHeight);
        }

        this.center.x += dx;
        this.center.y += dy;
        this.center.x = constrain(this.center.x, -worldHalfWidth + width / 2, worldHalfWidth - width / 2);
        this.center.y = constrain(this.center.y, -worldHalfHeight + height / 2, worldHalfHeight - height / 2);

        // translate center of screen to camera position.
        translate(width / 2 - this.center.x, height / 2 - this.center.y);
    }
}