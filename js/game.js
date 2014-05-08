"use strict";

// initialise game when font has loaded
// https://github.com/typekit/webfontloader
WebFont.load({
    google: { families: [ 'Source+Sans+Pro:300:latin' ]},
    active: initGame,
    fontinactive: initGame,
    timeout: 3000  // timeouts after 3 secs
});

    // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    // http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
     
    // requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
     
    // MIT license
     
    (function() {
        var lastTime = 0;
        var vendors = ['ms', 'moz', 'webkit', 'o'];
        for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
            window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
            window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] 
                                       || window[vendors[x]+'CancelRequestAnimationFrame'];
        }
     
        if (!window.requestAnimationFrame)
            window.requestAnimationFrame = function(callback, element) {
                var currTime = new Date().getTime();
                var timeToCall = Math.max(0, 16 - (currTime - lastTime));
                var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
                  timeToCall);
                lastTime = currTime + timeToCall;
                return id;
            };
     
        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = function(id) {
                clearTimeout(id);
            };
    }());

// constants:
var _COLOURS = ["rgb(210,50,0)","rgb(255,120,40)","rgb(220,220,00)","rgb(150,60,250)","rgb(0,120,140)","rgb(20,160,200)","rgb(20,200,60)"], // block colours
    _BGCOLOUR = "rgb(50,60,60)",    // bg of playing area
    _GLAZECOLOUR = "rgba(250,250,255,0.7)",
    _FLASHCOLOUR = "rgb(243,245,255)",  // colour for flashing of filled line when being removed
    _PADDING = 2,               // padding on middle column (the game grid)
    _MARGIN = 30,               // top and bottom margin
    _BLOCKSIZE = 26,            // size of blocks
    _BLOCKSTROKE = 1,           // size of block border
    _STROKECOLOUR = "rgb(243,245,255)",     // colour of block border
    _GRIDX = 10,                // width of playing area as mulitple of _BLOCKSIZE
    _GRIDY = 18,
    _COLUMNWIDTH = _BLOCKSIZE * _GRIDX + _BLOCKSTROKE,  // actual width of playing area
    _SPEEDSTART = 320,          // speed of the blocks at the start of a new game
    _SPEEDCHANGE = 20,          // speed increase per level
    _SPEEDMAX = 110,            // max speed of blocks    
    _TURBOSPEED = 50,           // speed of the block when turbo is activated
    _STARTX = Math.floor(_GRIDX/2) - 1,     // horizontal starting position of the blocks
    _SCOREPERLINE = 100,        // points awarded for filling a line
    _SCORELEVELBONUS = 10,      // score multiplier for levels
    _FONT = "'Source Sans Pro' Helvetica sans-serif",
    _FONTCOLOUR = "black";

var game = {
        canvas: document.getElementById('canvas'),
        c: document.getElementById('canvas').getContext('2d'),
        playing: false
    },
    grid;

// setup game object

game.start = function(startLevel){
    
    this.level = startLevel || 1;
    this.numLines = 0;
    this.score = 0;

    this.lastDrop = +new Date();
    this.timeToNext = _SPEEDSTART - (_SPEEDCHANGE * (this.level-1));
    if (this.timeToNext < _SPEEDMAX) {this.timeToNext = _SPEEDMAX;}

    this.current = new Block(Math.floor(Math.random()*7));
    this.next = new Block(Math.floor(Math.random()*7));

    this.turbo = false;
    this.nextMove = "";

    this.playing = true;
    this.paused = false;

    this.animatingLines = 0;

    grid.empty();

    this.c.clearRect(0, 0,this.canvas.width, this.canvas.height);

    grid.draw();
    this.drawChrome();
    this.animID = window.requestAnimationFrame(function(){
                                game.mainLoop();
                            });
};

game.drawChrome = function(){
    var c = this.c,
        canvas = this.canvas,
        next = this.next,
        nextBoxWidth = _BLOCKSIZE * 5 + _BLOCKSTROKE,
        nextBoxHeight = _BLOCKSIZE * 4 + _BLOCKSTROKE,
        nextBoxX = Math.floor(canvas.width - _COLUMNWIDTH/2 - nextBoxWidth/2),
        nextBoxY = Math.floor((canvas.height - nextBoxHeight)/2);

    // draw next block
    c.fillStyle = _BGCOLOUR;
    c.fillRect(nextBoxX, nextBoxY, nextBoxWidth, nextBoxHeight);

    c.strokeStyle = _STROKECOLOUR;
    c.lineWidth = _BLOCKSTROKE;

    c.save();

    c.translate(nextBoxX + _BLOCKSTROKE/2, nextBoxY + _BLOCKSTROKE/2);

    for (var k=0, l=next.parts.length; k<l; k++) {
        c.fillStyle = next.colour;
        c.fillRect((next.parts[k].x - next.x + next.xOffset + 1)*_BLOCKSIZE, (next.parts[k].y - next.y + next.yOffset + 1)*_BLOCKSIZE, _BLOCKSIZE, _BLOCKSIZE);
        c.strokeRect((next.parts[k].x - next.x + next.xOffset + 1)*_BLOCKSIZE, (next.parts[k].y - next.y + next.yOffset + 1)*_BLOCKSIZE, _BLOCKSIZE, _BLOCKSIZE);
    }

    c.restore();

    // display text
    this.c.clearRect(0, 0, _COLUMNWIDTH, this.canvas.height);

    c.font = "25px " + _FONT;
    c.textAlign = "start";
    c.textBaseline = "middle";
    c.fillStyle = _FONTCOLOUR;

    c.fillText("Level", _COLUMNWIDTH/3, this.canvas.height/3);
    c.fillText("Score", _COLUMNWIDTH/3, this.canvas.height/3 + 90);
    c.fillText("Lines", _COLUMNWIDTH/3, this.canvas.height/3 + 180);

    c.textAlign = "end";

    c.fillText(this.level, 2*_COLUMNWIDTH/3, this.canvas.height/3 + 30);
    c.fillText(this.score, 2*_COLUMNWIDTH/3, this.canvas.height/3 + 120);
    c.fillText(this.numLines, 2*_COLUMNWIDTH/3, this.canvas.height/3 + 210);

};

game.mainLoop = function() {

    if (this.animatingLines) {
        this.animateLineRemoval();
    } else {
        var redraw = false,
            redrawChrome = false,
            timeNow = +new Date(),
            linesRemoved = 0;

        if (this.nextMove) {

            if (this.nextMove === "rotate") {
                if (this.current.canRotate()) {
                    this.current.rotate();
                }
            } else if (this.nextMove === "left") {
                if (this.current.canMoveBy(-1,0)) {
                    this.current.moveBy(-1,0);
                }
            } else if (this.nextMove === "right") {
                if (this.current.canMoveBy(1,0)) {
                    this.current.moveBy(1,0);
                }
            }

            redraw = true;
            this.nextMove = "";
        }

        if (timeNow - this.lastDrop > this.timeToNext || (this.turbo && timeNow - this.lastDrop > _TURBOSPEED)) {

            if (this.current.canMoveBy(0,1)) {
                this.current.moveBy(0,1);
                redraw = true;
            } else {

                if (this.current.isInGrid()) {
                    this.current.addToGrid();

                    grid.updateFilledLines();

                    linesRemoved = grid.filledLines.length;

                    if (linesRemoved) {
                        this.numLines += linesRemoved;
                        this.score += linesRemoved * (_SCOREPERLINE + (this.level-1)*_SCORELEVELBONUS);

                        if (this.numLines >= this.level * 5) {this.levelUp();}

                        redraw = false;
                        redrawChrome = false;

                        this.animatingLines = 1;

                    } else {
                        redrawChrome = true;
                    }
                    
                    this.current = this.next;
                    this.next = new Block(Math.floor(Math.random()*7));

                } else {

                    this.gameOver();
                    redraw = false;
                    redrawChrome = false;
                }
                
            }

            this.lastDrop = +new Date();
            
        }

        if (redraw) {
            grid.draw();
            this.current.draw();
        }
        if (redrawChrome) {this.drawChrome();}
    }

    if (this.playing) {
        this.animID = window.requestAnimationFrame(function(){
                            game.mainLoop();
                        });
    }
};

game.gameOver = function() {

    var c = this.c;

    this.playing = false;

    c.fillStyle = _GLAZECOLOUR;
    c.fillRect(0, 0,this.canvas.width, this.canvas.height);

    c.font = "65px " + _FONT;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = _FONTCOLOUR;

    c.fillText("Game Over", this.canvas.width/2, this.canvas.height/2);

};

game.levelUp = function() {
    
    this.level++;

    this.timeToNext = _SPEEDSTART - (_SPEEDCHANGE * (this.level-1));
    if (this.timeToNext < _SPEEDMAX) {this.timeToNext = _SPEEDMAX;}
};

game.pause = function() {
    window.cancelAnimationFrame(this.animID);
    this.paused = true;

    if (this.animatingLines) {
        grid.draw();
    }

    this.c.fillStyle = _GLAZECOLOUR;
    this.c.fillRect(0, 0,this.canvas.width, this.canvas.height);
};

game.unpause = function() {
    this.paused = false;

    this.lastDrop = +new Date();

    this.turbo = false;
    this.nextMove = "";

    this.c.clearRect(0, 0,this.canvas.width, this.canvas.height);

    grid.draw();
    this.current.draw();
    this.drawChrome();
    this.animID = window.requestAnimationFrame(function(){
                                game.mainLoop();
                            });
};

game.animateLineRemoval = function() {

    var c = this.c,
        lines = grid.filledLines;

    if (this.animatingLines % 7 === 0 || this.animatingLines % 7 === 3) {

        c.strokeStyle = _STROKECOLOUR;
        c.lineWidth = _BLOCKSTROKE;

        c.save();

        c.translate(_PADDING + _COLUMNWIDTH + _BLOCKSTROKE/2, _PADDING + _MARGIN + _BLOCKSTROKE/2);
        
        for (var i=0, l=lines.length; i<l; i++) {
            for (var j=0; j<_GRIDX; j++) {
                c.fillStyle = ((this.animatingLines % 7) ? _FLASHCOLOUR : lines[i].line[j]);
                c.fillRect(j*_BLOCKSIZE, lines[i].lineNum*_BLOCKSIZE, _BLOCKSIZE, _BLOCKSIZE);
                c.strokeRect(j*_BLOCKSIZE, lines[i].lineNum*_BLOCKSIZE, _BLOCKSIZE, _BLOCKSIZE);
            }
        }

        c.restore();

    }

    this.animatingLines++;

    if (this.animatingLines > 24) {
        this.animatingLines = 0;
        grid.deleteFilledLines();
        grid.draw();
        game.drawChrome();
    }
};

// setup grid object

grid = (function(x,y){
            var grid = new Array(x);

            for (var i=0; i<x; i++) {
                grid[i] = new Array(x);
                for (var j=0; j<y; j++) {
                    grid[i][j] = "";
                }
            }

            return grid;
        })(_GRIDX,_GRIDY);

grid.filledLines = [];

grid.empty = function() {
    for (var i=0; i<_GRIDY; i++) {
        this.clearLine(i);
    }
};

grid.clearLine = function(lineNum) {
    for (var i = 0; i<_GRIDX; i++) {
        this[i][lineNum] = "";
    }
};

grid.updateFilledLines = function() {

    // checks if any of the lines are filled

    var lineFilled = true;

    this.filledLines.length = 0;

    for (var i=0; i<_GRIDY; i++) {
        lineFilled = true;
        for (var j=0; j<_GRIDX; j++) {
            if (!this[j][i]) {
                lineFilled = false;
                break;
            };
        }
        if (lineFilled) {
            this.filledLines.push({
                lineNum: i,
                line: new Array(_GRIDX)
            });
            for (var k=0; k<_GRIDX; k++) {
                this.filledLines[this.filledLines.length - 1].line[k] = this[k][i];
            }
        }
    }
};

grid.deleteFilledLines = function() {

    for (var i=0, l=this.filledLines.length; i<l; i++) {
        for (var j = this.filledLines[i].lineNum; j>0; j--) {
            for (var k = 0; k<_GRIDX; k++) {
                this[k][j] = this[k][j-1];
            }
            this.clearLine(0);
        }
    }

    this.filledLines.length = 0;
};

grid.draw = function() {
    var c = game.c;

    c.save();

    c.clearRect(_COLUMNWIDTH, _MARGIN, _COLUMNWIDTH + _PADDING * 2, canvas.height - 2*_MARGIN);

    c.fillStyle = _BGCOLOUR;

    c.fillRect(_COLUMNWIDTH, _MARGIN, _COLUMNWIDTH + _PADDING * 2, canvas.height - 2*_MARGIN);

    c.strokeStyle = _STROKECOLOUR;
    c.lineWidth = _BLOCKSTROKE;

    c.translate(_PADDING + _COLUMNWIDTH + _BLOCKSTROKE/2, _PADDING + _MARGIN + _BLOCKSTROKE/2);

    // draw stationary/already-positioned blocks
    for (var i=0; i<_GRIDY; i++) {
        for (var j=0; j<_GRIDX; j++) {
            if (grid[j][i]) {
                c.fillStyle = grid[j][i];
                c.fillRect(j*_BLOCKSIZE, i*_BLOCKSIZE, _BLOCKSIZE, _BLOCKSIZE);
                c.strokeRect(j*_BLOCKSIZE, i*_BLOCKSIZE, _BLOCKSIZE, _BLOCKSIZE);
            }
        }
    }

    c.restore();
};

// Define Block object type

function Block(type) {
    this.x = _STARTX;
    this.y = 0;
    this.colour = _COLOURS[type];
    this.type = type;

    // defined shapes such that their hinge point is at (0,0)
    switch(type) {
        case 0:    // square
            this.parts = [{x:0,y:0},{x:1,y:0},{x:0,y:-1},{x:1,y:-1}];
            this.y = -1;
            this.xOffset = 0.5;
            this.yOffset = 1;
            break;
        case 1:    // line
            this.parts = [{x:-1,y:0},{x:0,y:0},{x:1,y:0},{x:2,y:0}];
            this.y = -1;
            this.xOffset = 0.5;
            this.yOffset = 0.5;
            break;
        case 2:    // t shape
            this.parts = [{x:-1,y:0},{x:0,y:0},{x:1,y:0},{x:0,y:-1}];
            this.y = -1;
            this.xOffset = 1;
            this.yOffset = 1;
            break;
        case 3:    // L shape
            this.parts = [{x:-1,y:1},{x:-1,y:0},{x:0,y:0},{x:1,y:0}];
            this.y = -2;
            this.xOffset = 1;
            this.yOffset = 0;
            break;
        case 4:    // backwards L shape
            this.parts = [{x:-1,y:0},{x:0,y:0},{x:1,y:0},{x:1,y:1}];
            this.y = -2;
            this.xOffset = 1;
            this.yOffset = 0;
            break;
        case 5:    // z type shape
            this.parts = [{x:-1,y:1},{x:0,y:1},{x:0,y:0},{x:1,y:0}];
            this.y = -2;
            this.xOffset = 1;
            this.yOffset = 0;
            break;
        case 6:    // backwards z type shape
            this.parts = [{x:-1,y:0},{x:0,y:0},{x:0,y:1},{x:1,y:1}];
            this.y = -2;
            this.xOffset = 1;
            this.yOffset = 0;
            break;
    }

    // position shapes in right place:
    for (var i=0, l=this.parts.length; i<l; i++) {
        this.parts[i].x = this.parts[i].x + this.x;
        this.parts[i].y = this.parts[i].y + this.y;
    }
};

Block.prototype.getRotatedPoints = function() {

    // calculates the position of the block if rotated

    if (this.type === 0) {return this.parts;} // square doesn't rotate

    var rotated = [];
    for (var i=0, l=this.parts.length; i<l; i++) {
        rotated.push({
            x: (this.y - this.parts[i].y) + this.x,
            y: (this.parts[i].x - this.x) + this.y
        });
    }
    return rotated;
};

Block.prototype.getMovePoints = function(dx,dy) {

    // calculates the position of the block if translated by (dx,dy)

    var moved = [];
    for (var i=0, l=this.parts.length; i<l; i++) {
        moved.push({
            x: this.parts[i].x + dx,
            y: this.parts[i].y + dy
        });
    }
    return moved;
};

Block.prototype.canMoveBy = function(dx,dy) {

    // checks to see if it's possible for the block to move by (dx,dy)

    var futureParts = this.getMovePoints(dx,dy),
        canMove = true;

    for (var i=0, l=futureParts.length; i<l; i++) {
        if (futureParts[i].x < 0 || futureParts[i].x >= _GRIDX) {canMove = false; break;}
        if (futureParts[i].y >= _GRIDY) {canMove = false; break;}
        if (grid[futureParts[i].x] && grid[futureParts[i].x][futureParts[i].y]) {canMove = false; break;}
    }

    return canMove;
};

Block.prototype.canRotate = function() {

    // checks to see if it's possible for the block to be rotated

    var futureParts = this.getRotatedPoints(),
        canMove = true;

    for (var i=0, l=futureParts.length; i<l; i++) {
        if (futureParts[i].x < 0 || futureParts[i].x >= _GRIDX) {canMove = false; break;}
        if (futureParts[i].y >= _GRIDY) {canMove = false; break;}
        if (grid[futureParts[i].x] && grid[futureParts[i].x][futureParts[i].y]) {canMove = false; break;}
    }

    return canMove;
};

Block.prototype.moveBy = function(dx,dy) {
    this.parts = this.getMovePoints(dx,dy);
    this.x = this.x + dx;
    this.y = this.y + dy;
};

Block.prototype.rotate = function() {
    this.parts = this.getRotatedPoints();
};

Block.prototype.addToGrid = function() {
    for (var i=0, l=this.parts.length; i<l; i++) {
        if (this.parts[i].x >= 0 && this.parts[i].x < _GRIDX && this.parts[i].y >= 0 && this.parts[i].y < _GRIDY) {
            grid[this.parts[i].x][this.parts[i].y] = this.colour;
        }
    }    
};

Block.prototype.isInGrid = function() {

    for (var i=0, l=this.parts.length; i<l; i++) {
        if (this.parts[i].y < 0) {
            return false;
        }
    }

    return true;
};

Block.prototype.draw = function() {
    var c = game.c;

    c.save();

    c.strokeStyle = _STROKECOLOUR;
    c.lineWidth = _BLOCKSTROKE;

    c.translate(_PADDING + _COLUMNWIDTH + _BLOCKSTROKE/2, _PADDING + _MARGIN + _BLOCKSTROKE/2);

    // draw moving block
    for (var k=0, l=this.parts.length; k<l; k++) {
        if (this.parts[k].x >= 0 && this.parts[k].y >= 0 && this.parts[k].x < _GRIDX && this.parts[k].y < _GRIDY) {
            c.fillStyle = this.colour;
            c.fillRect(this.parts[k].x*_BLOCKSIZE, this.parts[k].y*_BLOCKSIZE, _BLOCKSIZE, _BLOCKSIZE);
            c.strokeRect(this.parts[k].x*_BLOCKSIZE, this.parts[k].y*_BLOCKSIZE, _BLOCKSIZE, _BLOCKSIZE);
        }
    }

    c.restore();
};

// this is how the width and height of the canvas element is determined, but just put it directly in the CSS
// game.canvas.width = _COLUMNWIDTH * 3 + _PADDING * 2;
// game.canvas.height = _BLOCKSIZE * _GRIDY + _BLOCKSTROKE  + _PADDING * 2 + _MARGIN * 2;

// centre canvas element vertically:
(function(){
    var container = document.getElementById('wrapper'),
        height = container.getBoundingClientRect().height;

    function verticalCentre() {
        var margin = (document.body.getBoundingClientRect().height - height)/2;

        if (margin > 0) {
            container.style.marginTop = margin + "px";
        } else {
            container.style.marginTop = "0px";
        }

    }

    verticalCentre();

    window.addEventListener('resize',verticalCentre,false);
})();

function initGame() {

    console.log('starting game');

    // event handlers:
    document.body.addEventListener('keydown',function(e) {

        switch (e.which) {
            case 32:    // space
                e.preventDefault();
                if (!game.playing) {
                    document.getElementById('title').className = "";
                    game.start();
                } else {
                    if (game.paused) {
                        game.unpause();
                    } else {
                        game.pause();
                    }
                }
                break;
            case 37:    // left - moves current block left
                e.preventDefault();
                game.nextMove = "left";
                break;
            case 38:    // up - rotates the current block
                e.preventDefault();
                game.nextMove = "rotate";
                break;
            case 39:    // right - moves current block right
                e.preventDefault();
                game.nextMove = "right";
                break;
            case 40:    // down - activates 'turbo' speed
                e.preventDefault();
                game.turbo = true;
                break;
        }
    },false);

    document.body.addEventListener('keyup',function(e) {

        switch (e.which) {
            case 40:    // down - deactivates 'turbo' speed
                e.preventDefault();
                game.turbo = false;
                break;
        }
    },false);

    // display starting msg
    game.c.font = "33px " + _FONT;
    game.c.textAlign = "center";
    game.c.textBaseline = "middle";
    game.c.fillStyle = _FONTCOLOUR;

    game.c.fillText("SPACE to start", game.canvas.width/2, game.canvas.height/2);
}