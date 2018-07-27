// Implements a quad tree for region querying.
//
// last edited: 2018-06-02

/**
 * @typedef IPoint
 * @property {number} x
 * @property {number} y 
 */

/**
 * @typedef IRect
 * @property {Rect} rect
 */

/**
 * A rectangle defined by its lower (in magnitude) and higher (in magnitude) 
 * corners. Also implements point and rectangle collision.
 */
class Rect {
    /**
     * Constructs a Rect.
     * @param {number} x1 the x coord of the lower corner
     * @param {number} y1 the y coord of the lower corner
     * @param {number} x2 the x coord of the higher corner
     * @param {number} y2 the y coord of the higher corner
     */
    constructor(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }

    /**
     * The center of the Rect.
     * @returns a 2 item array of the center point, `[x, y]` 
     */
    get Center() { return [this.x1 + (0.5 * this.x2 - this.x1), this.y1 + (0.5 * this.y2 - this.y1)]; }
    /** The width of the Rect */
    get Width() { return this.x2 - this.x1; }
    /** The height of the Rect. */
    get Height() { return this.y2 - this.y1; }
    /** The Area of the Rect. */
    get Area() { return this.Width * this.Height; }

    /** 
     * Returns true if this rect contains the point at (x,y).
     * @param {number} x the x coord to check
     * @param {number} y the y coord to check
    */
    containsPoint(x, y) {
        return this.x1 <= x && x < this.x2 && this.y1 <= y && y < this.y2;
    }

    /**
     * True if other is completely contained within this Rect.
     * @param {Rect} other the other rectangle
     */
    containsRect(other) {
        return this.x1 <= other.x1 && this.y1 <= other.y1 && this.x2 >= other.x2 && this.y2 >= other.y2;
    }

    /**
     * Returns true if the 'other' rect intersects with this one.
     * @param {Rect} other the other Rect
     */
    intersects(other) {
        return !(this.x1 > other.x2 || this.x2 < other.x1) &&
            !(this.y1 > other.y2 || this.y2 < other.y1);
    }

    /** Draws a rect to the screen. */
    draw() {
        rect(this.x1, this.y1, this.Width, this.Height);
    }
}

/** A very simple 2D point. */
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

/**
 * A quad-tree whose nodes can contain an arbitrary number of points. If 'toLeaves'
 * is set to 'true', only the leaves of the tree will contain points (intermediate 
 * nodes will have a capacity of 0).
 */
class PointQuadTree {
    /**
     * Constructs a new QuadTree.
     * @param {Rect} range the area that is covered by this quadtree(node)
     * @param {number} capacity the interger number of how many items each node 
     * can contain before splitting
     * @param {boolean} toLeaves if true, items are pushed to leaves when the 
     * node splits.
     */
    constructor(range, capacity = 1, toLeaves = false) {
        this.range = range;
        this.capacity = capacity;
        if (this.capacity < 1) { this.capacity = 1; }
        this.points = [];

        // 4 quadrants L = lower side, H = higher side.
        this.LL = null;
        this.LH = null;
        this.HL = null;
        this.HH = null;

        this._isSplit = false;
        this._pushToLeaves = toLeaves;
    }

    /**
     * Inserts a Point into the tree. Returns true/false if the point was inserted.
     * @param {IPoint} point any object that has numeric properties 'x' and 'y'
     */
    insert(point) {
        if (!this.range.containsPoint(point.x, point.y)) {
            return false;
        }

        if (this.points.length < this.capacity) {
            this.points.push(point);
        } else {
            if (!this.isSplit()) {
                this.split();
            }
            this.LL.insert(point);
            this.LH.insert(point);
            this.HL.insert(point);
            this.HH.insert(point);
        }

        return true;
    }

    /**
     * Returns true if this node has been split, false otherwise.
     */
    isSplit() { return this._isSplit; }

    /**
     * Splits this node into 4 children. pushes points from this node down to 
     * children if the tree is configured to do so.
     */
    split() {
        let w = this.range.Width / 2;
        let h = this.range.Height / 2;
        this.LL = new PointQuadTree(
            new Rect(this.range.x1, this.range.y1, this.range.x1 + w, this.range.y1 + h),
            this.capacity,
            this._pushToLeaves);
        this.LH = new PointQuadTree(
            new Rect(this.range.x1 + w, this.range.y1, this.range.x2, this.range.y1 + h),
            this.capacity,
            this._pushToLeaves);
        this.HL = new PointQuadTree(
            new Rect(this.range.x1, this.range.y1 + h, this.range.x1 + w, this.range.y2),
            this.capacity,
            this._pushToLeaves);
        this.HH = new PointQuadTree(
            new Rect(this.range.x1 + w, this.range.y1 + h, this.range.x2, this.range.y2),
            this.capacity,
            this._pushToLeaves);

        this._isSplit = true;

        // if the quadtree is set to push all points down to the leaves,
        // then this will re-insert the points currently contained in this node.
        // because capacity is set to 0, the re-inserted points will go to the 
        // new children, as will any newly inserted future points.
        if (this._pushToLeaves) {
            this.capacity = 0;
            while (this.points.length > 0) {
                let p = this.points.pop();
                this.insert(p);
            }
        }
    }

    /**
     * Returns all points contained in the 'range' Rect. If 'found' is specified,
     * the points will be appended to that array. Returns a reference to the 
     * found array.
     * @param {Rect} range rectangular area to search
     * @param {IPoint[]} found a list of already found items
     * @returns {IPoint[]} a list of found Points
     */
    query(range, found = []) {
        if (!this.range.intersects(range)) {
            return found;
        }

        for (const p of this.points) {
            if (range.containsPoint(p.x, p.y)) {
                found.push(p);
            }
        }

        if (this.isSplit()) {
            this.LL.query(range, found);
            this.LH.query(range, found);
            this.HL.query(range, found);
            this.HH.query(range, found);
        }

        return found;
    }

    /**
     * draws the quad tree (its regions) to the screen.
     */
    draw() {
        this.range.draw();
        if (this.isSplit()) {
            this.LL.draw();
            this.LH.draw();
            this.HL.draw();
            this.HH.draw();
        }
    }
}

/**
 * A quad-tree whose nodes can contain an arbitrary number of rectangles.
 */
class RectQuadTree {
    /**
     * Constructs a new RectQuadTree.
     * @param {Rect} range the area that is covered by this quadtree(node)
     */
    constructor(range) {
        this.range = range;
        this.objs = [];

        // 4 quadrants L = lower side, H = higher side.
        this.LL = null;
        this.LH = null;
        this.HL = null;
        this.HH = null;

        this._isSplit = false;
    }

    /**
     * Inserts a Rect into the tree. Returns true/false if the point was inserted.
     * @param {IRect} obj any object that has the property 'rect' which gets a Rect
     */
    insert(obj) {
        // 1. check if this contains the incoming rect
        if (!this.range.containsRect(obj.rect)) {
            return false;
        }

        // 2. if so, check against children and attempt insertion in them.
        //  2.1 split node if not already done.
        if (!this.isSplit()) {
            this.split();
        }

        let inserted =
            this.LL.insert(obj) ||
            this.LH.insert(obj) ||
            this.HL.insert(obj) ||
            this.HH.insert(obj);

        // 3. if child insertion fails, keep incoming rect in current node's list of items
        if (!inserted) {
            this.objs.push(obj);
        }

        return true;
    }

    /**
     * Returns true if this node has been split, false otherwise.
     */
    isSplit() { return this._isSplit; }

    /**
     * Splits this node into 4 children.
     */
    split() {
        let w = this.range.Width / 2;
        let h = this.range.Height / 2;
        this.LL = new RectQuadTree(
            new Rect(this.range.x1, this.range.y1, this.range.x1 + w, this.range.y1 + h));
        this.LH = new RectQuadTree(
            new Rect(this.range.x1 + w, this.range.y1, this.range.x2, this.range.y1 + h));
        this.HL = new RectQuadTree(
            new Rect(this.range.x1, this.range.y1 + h, this.range.x1 + w, this.range.y2));
        this.HH = new RectQuadTree(
            new Rect(this.range.x1 + w, this.range.y1 + h, this.range.x2, this.range.y2));

        this._isSplit = true;
    }

    /**
     * Returns all objects that intersect with the 'range' Rect. If 'found' is specified,
     * the objects will be appended to that array. Returns a reference to the 
     * found array.
     * @param {Rect} range rectangular area to search
     * @param {IRect[]} found a list of already found items
     * @returns {IRect[]} a list of found objects
     */
    query(range, found = []) {
        // TODO: add parameter to this method switch between
        // test for intersection and test for containment

        // 1. check if this node intersects with the query range
        if (!this.range.intersects(range)) {
            return found;
        }

        // 2. Two posibilities:
        // 1) the current node is completely contained within the query range,
        // which means that ALL of its objects and all of its children's objs
        // are added to found
        // 2) the current node is not completely contained, so each object in 
        // the node must be checked against the query range
        //
        // this means that the tree will generally run with less performance
        // when most of the nodes are larger than the query range.
        if (range.containsRect(this.range)) {
            found.push(...this.objs);
        } else {

            // test for intersection, not containment
            for (const o of this.objs) {
                if (range.intersects(o.rect)) {
                    found.push(o);
                }
            }
        }

        // 3. check children
        if (this.isSplit()) {
            this.LL.query(range, found);
            this.LH.query(range, found);
            this.HL.query(range, found);
            this.HH.query(range, found);
        }

        return found;
    }

    /**
     * draws the quad tree (its regions) to the screen.
     */
    draw() {
        this.range.draw();
        if (this.isSplit()) {
            this.LL.draw();
            this.LH.draw();
            this.HL.draw();
            this.HH.draw();
        }
    }
}