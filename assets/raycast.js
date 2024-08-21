"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const EPS = 1e-6;
const SCREEN_FACTOR = 10;
const SCREEN_WIDTH = 16 * SCREEN_FACTOR;
const SCREEN_HEIGHT = 9 * SCREEN_FACTOR;
const NEAR_CLIPPING_PLANE = 0.2;
const FAR_CLIPPING_PLANE = 10.0;
const FOV = Math.PI * 0.5;
const PLAYER_STEP_LEN = 0.5;
const PLAYER_SPEED = 2;
const PLAYER_TURNING_SPEED = 0.75;
const PLAYER_SIZE = 0.5;
//------------------------------------------------------------CLASSES
class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    static zero() {
        return new Vector2(0, 0);
    }
    static scalar(value) {
        return new Vector2(value, value);
    }
    static fromAngle(angle) {
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }
    div(that) {
        return new Vector2(this.x / that.x, this.y / that.y);
    }
    mul(that) {
        return new Vector2(this.x * that.x, this.y * that.y);
    }
    add(that) {
        return new Vector2(this.x + that.x, this.y + that.y);
    }
    sub(that) {
        return new Vector2(this.x - that.x, this.y - that.y);
    }
    distanceTo(that) {
        return that.sub(this).length();
    }
    sqrDistanceTo(that) {
        return that.sub(this).sqrLength();
    }
    sqrLength() {
        return (this.x * this.x) + (this.y * this.y);
    }
    length() {
        return Math.sqrt((this.x * this.x) + (this.y * this.y));
    }
    scale(value) {
        return new Vector2(this.x * value, this.y * value);
    }
    lerp(that, t) {
        return that.sub(this).scale(t).add(this);
    }
    norm() {
        const l = this.length();
        if (l === 0)
            return new Vector2(0, 0);
        return new Vector2(this.x / l, this.y / l);
    }
    rot90() {
        return new Vector2(-this.y, this.x);
    }
    dot(that) {
        return this.x * that.x + this.y * that.y;
    }
    array() {
        return [this.x, this.y];
    }
    map(f) {
        return new Vector2(f(this.x), f(this.y));
    }
}
class Color {
    constructor(r, g, b, a) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    toString() {
        return `rgba(${Math.floor(this.r * 255)}, ${Math.floor(this.g * 255)}, ${Math.floor(this.b * 255)}, ${this.a})`;
    }
    static white() {
        return new Color(1, 1, 1, 1);
    }
    static red() {
        return new Color(1, 0, 0, 1);
    }
    static green() {
        return new Color(0, 1, 0, 1);
    }
    static yellow() {
        return new Color(1, 1, 0, 1);
    }
    static blue() {
        return new Color(0, 0, 1, 1);
    }
    static purple() {
        return new Color(0.5, 0, 0.5, 1);
    }
    static cyan() {
        return new Color(0, 1, 1, 1);
    }
    brightness(factor) {
        return new Color(factor * this.r, factor * this.g, factor * this.b, factor * this.a);
    }
}
class Scene {
    constructor(walls, floor) {
        this.height = walls.length;
        this.width = Number.MIN_VALUE;
        for (let row of walls) {
            this.width = Math.max(this.width, row.length);
        }
        this.walls = [];
        for (let row of walls) {
            this.walls = this.walls.concat(row);
            for (let i = 0; i < this.width - row.length; ++i) {
                this.walls.push(null);
            }
        }
        this.c1 = Color.white();
        this.c2 = Color.red();
        this.floor = floor;
    }
    size() {
        return new Vector2(this.width, this.height);
    }
    contains(p) {
        return 0 <= p.x && p.x < this.width && 0 <= p.y && p.y < this.height;
    }
    isWall(p) {
        let c = this.getWall(p);
        return c !== null && c !== undefined;
    }
    getWall(p) {
        if (!this.contains(p))
            return undefined;
        const fp = p.map(Math.floor);
        return this.walls[(fp.y * this.width) + fp.x];
    }
    getFloor(p) {
        return this.floor;
        // const cell = p.map(Math.floor);
        // if((cell.x + cell.y) % 2 == 0){
        //   return this.c1;
        // }else{
        //   return this.c2;
        // }
    }
}
class Player {
    constructor(position, direction) {
        this.position = position;
        this.direction = direction;
    }
    fovRange(clippingPlane) {
        const l = Math.tan(FOV * 0.5) * clippingPlane;
        const p = this.position.add(Vector2.fromAngle(this.direction).scale(clippingPlane));
        const p1 = p.sub(p.sub(this.position).rot90().norm().scale(l));
        const p2 = p.add(p.sub(this.position).rot90().norm().scale(l));
        return [p1, p2];
    }
}
//------------------------------------------------------------FUNCTIONS
function fillCircle(ctx, center, radius) {
    ctx.beginPath();
    ctx.arc(...center.array(), radius, 0, 2 * Math.PI);
    ctx.fill();
}
function strokeLine(ctx, p1, p2) {
    ctx.beginPath();
    ctx.moveTo(...p1.array());
    ctx.lineTo(...p2.array());
    ctx.stroke();
}
function snap(x, dx) {
    if (dx > 0)
        return Math.ceil(x + Math.sign(dx) * EPS);
    if (dx < 0)
        return Math.floor(x + Math.sign(dx) * EPS);
    return x;
}
function canvasSize(ctx) {
    return new Vector2(ctx.canvas.width, ctx.canvas.height);
}
function distancePointToLine(p1, p2, p3) {
    let dy = p2.y - p1.y;
    let dx = p1.x - p2.x;
    let dm = p2.x * p1.y - p1.x * p2.y;
    return Math.abs(((dy * p3.x) + (dx * p3.y) + dm) / Math.sqrt(dy ** 2 + dx ** 2));
}
function hittingCell(p1, p2) {
    const d = p2.sub(p1);
    return new Vector2(Math.floor(p2.x + Math.sign(d.x) * EPS), Math.floor(p2.y + Math.sign(d.y) * EPS));
}
function isValidPlayerPos(scene, newPosition) {
    const corner = newPosition.sub(Vector2.scalar(PLAYER_SIZE * 0.5));
    for (let y = 0; y < 2; ++y) {
        for (let x = 0; x < 2; ++x) {
            if (scene.isWall(corner.add(new Vector2(x, y).scale(PLAYER_SIZE)))) {
                return false;
            }
        }
    }
    return true;
}
//------------------------------------------------------------RAYSCAST
function rayStep(p1, p2) {
    let next = p2;
    const d = p2.sub(p1);
    if (d.x !== 0) {
        const m = d.y / d.x;
        const c = p1.y - (m * p1.x);
        {
            const x3 = snap(p2.x, d.x);
            const y3 = x3 * m + c;
            next = new Vector2(x3, y3);
        }
        if (m !== 0) {
            const y3 = snap(p2.y, d.y);
            const x3 = (y3 - c) / m;
            const p3t = new Vector2(x3, y3);
            if (p2.sqrDistanceTo(p3t) < p2.sqrDistanceTo(next)) {
                next = p3t;
            }
        }
    }
    else {
        const y3 = snap(p2.y, d.y);
        const x3 = p2.x;
        next = new Vector2(x3, y3);
    }
    return next;
}
function castRay(scene, p1, p2) {
    let start = p1;
    while (start.sqrDistanceTo(p1) < (FAR_CLIPPING_PLANE - 1) * (FAR_CLIPPING_PLANE - 1)) {
        const c = hittingCell(p1, p2);
        if (scene.getWall(c) !== undefined && scene.getWall(c) !== null)
            break;
        const p3 = rayStep(p1, p2);
        p1 = p2;
        p2 = p3;
    }
    return p2;
}
//------------------------------------------------------------IMAGE DATA
function loadImageData(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const image = new Image();
        image.src = url;
        return new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = reject;
        });
    });
}
//------------------------------------------------------------RENDER FUNCTIONS
function renderMinimap(ctx, player, position, size, scene) {
    ctx.save();
    const gridSize = scene.size();
    ctx.translate(...position.array());
    ctx.scale(...size.div(gridSize).array());
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, 0, ...gridSize.array());
    const lineWidth = 0.1;
    ctx.lineWidth = lineWidth;
    for (let y = 0; y < gridSize.y; ++y) {
        for (let x = 0; x < gridSize.x; ++x) {
            const cell = scene.getWall(new Vector2(x, y));
            if (cell instanceof Color) {
                ctx.fillStyle = cell.toString();
                ctx.fillRect(x + lineWidth, y + lineWidth, 1 - lineWidth, 1 - lineWidth);
            }
            else if (cell instanceof HTMLImageElement) {
                ctx.drawImage(cell, x, y, 1, 1);
            }
        }
    }
    ctx.strokeStyle = "#363636";
    for (let x = 0; x <= gridSize.x; ++x) {
        strokeLine(ctx, new Vector2(x, 0), new Vector2(x, gridSize.y));
    }
    for (let y = 0; y <= gridSize.y; ++y) {
        strokeLine(ctx, new Vector2(0, y), new Vector2(gridSize.x, y));
    }
    // player
    ctx.strokeStyle = "red";
    ctx.strokeRect(player.position.x - (PLAYER_SIZE * 0.5), player.position.y - (PLAYER_SIZE * 0.5), PLAYER_SIZE, PLAYER_SIZE);
    const [nearP1, nearP2] = player.fovRange(NEAR_CLIPPING_PLANE);
    const [farP1, farP2] = player.fovRange(FAR_CLIPPING_PLANE);
    ctx.strokeStyle = "yellow";
    const look = Vector2.fromAngle(player.direction);
    const near = player.position.add(look.scale(NEAR_CLIPPING_PLANE));
    const far = player.position.add(look.scale(FAR_CLIPPING_PLANE));
    strokeLine(ctx, near, far);
    ctx.strokeStyle = "red";
    strokeLine(ctx, player.position, farP1);
    strokeLine(ctx, player.position, farP2);
    strokeLine(ctx, farP1, farP2);
    ctx.strokeStyle = "blue";
    strokeLine(ctx, player.position, nearP1);
    strokeLine(ctx, player.position, nearP2);
    strokeLine(ctx, nearP1, nearP2);
    ctx.restore();
}
//
// for(let dx = 0; dx <= factor; ++dx){
//   const p =  p1.lerp(p2,dx/factor);
// }
function renderFloor(ctx, player, scene) {
    ctx.save();
    ctx.scale(ctx.canvas.width / SCREEN_WIDTH, ctx.canvas.height / SCREEN_HEIGHT);
    //3D coordinates of the players eye
    // const playerX =  player.position.x;
    // const playerY =  player.position.y;
    const playerZ = SCREEN_HEIGHT / 2;
    const [p1, p2] = player.fovRange(NEAR_CLIPPING_PLANE);
    // pixelrow
    for (let row = SCREEN_HEIGHT / 2; row < SCREEN_HEIGHT; ++row) {
        // const screenX = p1.x;
        // const screenY = p1.y;
        const screenZ = SCREEN_HEIGHT - row;
        // imagine looking into the screen
        const smolPerpendicualar = playerZ - screenZ;
        const smolBase = p1.sub(player.position).length();
        const hypotenuse = smolBase / smolPerpendicualar * playerZ * (1 / NEAR_CLIPPING_PLANE);
        // imagine pointing a lazer to a point on ground
        const leftFloorLimit = player.position.add(p1.sub(player.position).norm().scale(hypotenuse));
        const rightFloorLimit = player.position.add(p2.sub(player.position).norm().scale(hypotenuse));
        //pixelcol
        for (let col = 0; col < SCREEN_WIDTH; ++col) {
            const floorCoord = leftFloorLimit.lerp(rightFloorLimit, col / SCREEN_WIDTH); // floorCoord is a coordinate on the fllor in the game world
            const tile = scene.getFloor(floorCoord);
            if (tile instanceof HTMLImageElement) {
                const c = floorCoord.map((x) => x - Math.floor(x));
                ctx.drawImage(tile, Math.floor(c.x * tile.width), Math.floor(c.y * tile.height), 1, 1, col, row, 1, 1);
            }
            else if (tile instanceof Color) {
                ctx.fillStyle = tile.toString();
                ctx.fillRect(col, row, 1, 1);
            }
        }
    }
    ctx.restore();
}
function renderWalls(ctx, player, scene) {
    ctx.save();
    ctx.scale(ctx.canvas.width / SCREEN_WIDTH, ctx.canvas.height / SCREEN_HEIGHT);
    const [r1, r2] = player.fovRange(NEAR_CLIPPING_PLANE);
    for (let x = 0; x < SCREEN_WIDTH; ++x) {
        const hitPoint = castRay(scene, player.position, r1.lerp(r2, x / SCREEN_WIDTH));
        const hitCell = hittingCell(player.position, hitPoint);
        const hitCellCoord = scene.getWall(hitCell);
        const hitPointDistance = hitPoint.sub(player.position);
        const playerDirection = Vector2.fromAngle(player.direction);
        const wallLengthRatio = 1 / hitPointDistance.dot(playerDirection);
        if (hitCellCoord instanceof HTMLImageElement) {
            let stripHeight = SCREEN_HEIGHT / hitPointDistance.dot(playerDirection);
            let u = 0;
            const t = hitPoint.sub(hitCell);
            if ((Math.abs(t.x) < EPS || Math.abs(t.x - 1) < EPS) && t.y > 0) {
                u = t.y;
            }
            else {
                u = t.x;
            }
            //texture
            ctx.drawImage(hitCellCoord, Math.floor(u * hitCellCoord.width), 0, 1, hitCellCoord.height, Math.floor(x), Math.floor((SCREEN_HEIGHT - stripHeight) * 0.5), Math.ceil(1), Math.ceil(stripHeight));
            //shading
            ctx.fillStyle = new Color(0, 0, 0, 1 - wallLengthRatio).toString();
            ctx.fillRect(Math.floor(x), Math.floor((SCREEN_HEIGHT - stripHeight) * 0.5), Math.ceil(1), Math.ceil(stripHeight));
        }
        else if (hitCellCoord instanceof Color) {
            let stripHeight = SCREEN_HEIGHT / hitPointDistance.dot(playerDirection);
            ctx.fillStyle = hitCellCoord.brightness(wallLengthRatio).toString();
            ctx.fillRect(Math.floor(x), Math.floor((SCREEN_HEIGHT - stripHeight) * 0.5), Math.ceil(1), Math.ceil(stripHeight));
        }
    }
    ctx.restore();
}
function renderGame(ctx, player, scene) {
    const minimapPosition = Vector2.zero();
    const cellSize = ctx.canvas.width * 0.02;
    const minimapSize = scene.size().scale((cellSize));
    ctx.fillStyle = "hsla(0, 100%, 25%, 1.0)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    //floor
    ctx.fillStyle = "#181818";
    ctx.fillRect(0, ctx.canvas.height * 0.5, ctx.canvas.width, ctx.canvas.height * 0.5);
    renderFloor(ctx, player, scene);
    renderWalls(ctx, player, scene);
    renderMinimap(ctx, player, minimapPosition, minimapSize, scene);
}
//------------------------------------------------------------GAME LOOP
(() => __awaiter(void 0, void 0, void 0, function* () {
    document.body.style.backgroundColor = "#000000";
    const game = document.getElementById("canvas");
    if (game === null)
        throw new Error("No canvas with give id found");
    const factor = 80;
    game.width = 16 * factor;
    game.height = 9 * factor;
    const ctx = game.getContext("2d");
    if (ctx === null)
        throw new Error("2D context is not supported");
    const wall1 = yield loadImageData("assets/walls/wall1_color.png").catch(() => Color.purple());
    const wall2 = yield loadImageData("assets/walls/wall2_color.png").catch(() => Color.purple());
    const wall3 = yield loadImageData("assets/walls/wall3_color.png").catch(() => Color.purple());
    const floor = yield loadImageData("assets/ground/01.png").catch(() => Color.red());
    const scene = new Scene([
        [wall1, null, wall3, wall1, null, null, null, wall1],
        [null, null, null, wall2, null, null, null, wall1],
        [null, wall1, wall1, wall1, null, null, null, wall1],
        [null, null, null, null, null, null, null, wall1],
        [null, null, null, null, null, null, null, wall1],
        [null, null, wall3, wall2, null, null, null, wall1],
        [null, null, null, null, null, null, null, wall1],
        [wall1, null, null, null, null, null, null, wall1],
    ], floor);
    const player = new Player(scene.size().mul(new Vector2(0.63, 0.63)), Math.PI * 1.25);
    let movingForward = false;
    let movingBackward = false;
    let turningLeft = false;
    let turningRight = false;
    let togglePause = false;
    window.addEventListener("keydown", (e) => {
        if (!e.repeat) {
            switch (e.code) {
                case 'KeyW':
                    movingForward = true;
                    break;
                case 'KeyA':
                    turningLeft = true;
                    break;
                case 'KeyS':
                    movingBackward = true;
                    break;
                case 'KeyD':
                    turningRight = true;
                    break;
                case 'KeyP':
                    togglePause = !togglePause;
                    break;
            }
        }
    });
    window.addEventListener("keyup", (e) => {
        if (!e.repeat) {
            switch (e.code) {
                case 'KeyW':
                    movingForward = false;
                    break;
                case 'KeyA':
                    turningLeft = false;
                    break;
                case 'KeyS':
                    movingBackward = false;
                    break;
                case 'KeyD':
                    turningRight = false;
                    break;
            }
        }
    });
    let prevTimestamp = 0;
    const frame = (timestamp) => {
        const deltaTime = (timestamp - prevTimestamp) / 1000;
        prevTimestamp = timestamp;
        let velocity = Vector2.zero();
        let angle = 0.0;
        if (movingForward) {
            velocity = velocity.add(Vector2.fromAngle(player.direction).scale(PLAYER_SPEED));
        }
        if (movingBackward) {
            velocity = velocity.sub(Vector2.fromAngle(player.direction).scale(PLAYER_SPEED));
        }
        if (turningLeft) {
            angle -= Math.PI * PLAYER_TURNING_SPEED;
        }
        if (turningRight) {
            angle += Math.PI * PLAYER_TURNING_SPEED;
        }
        player.direction = player.direction + (angle * deltaTime);
        const newPositionX = player.position.x + velocity.x * deltaTime;
        const newPositionY = player.position.y + velocity.y * deltaTime;
        if (isValidPlayerPos(scene, new Vector2(newPositionX, player.position.y))) {
            player.position.x = newPositionX;
        }
        if (isValidPlayerPos(scene, new Vector2(player.position.x, newPositionY))) {
            player.position.y = newPositionY;
        }
        if (!togglePause) {
            renderGame(ctx, player, scene);
        }
        else {
            console.log("paused");
        }
        window.requestAnimationFrame(frame);
    };
    //inital setter for timestamp
    window.requestAnimationFrame((timestamp) => {
        prevTimestamp = timestamp;
        window.requestAnimationFrame(frame);
    });
}))();
//# sourceMappingURL=index.js.map