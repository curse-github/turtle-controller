function generateUUID() {
	var a = new Date().getTime();//Timestamp
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var b = Math.random() * 16;//random number between 0 and 16
		b = (a + b)%16 | 0;
		a = Math.floor(a/16);
		return (c === 'x' ? b : (b & 0x3 | 0x8)).toString(16);
	});
}

ws = new WebSocket("ws://mc.campbellsimpson.com:58742");
ws.onopen = function () {
    ws.send(JSON.stringify({"type":"connection","connection":"browser"}));
};
ws.onerror = function (error) { console.log("WebSocket error: " + error); };

ws.onmessage = function (event) {
    var msg = JSON.parse(event.data);
    if (msg.type == "connection") {
        console.log(msg);
    } else if (msg.type == "disconnection") {
        console.log(msg);
    } else if (msg.type == "return") {
        if (callbacks[msg.id]!=null) callbacks[msg.id](msg.return);
    }
}
var callbacks = {};
function send(turtle,command,callback) {
    const id = generateUUID();
    ws.send(JSON.stringify({"type":"lua","index":turtle,"id":id,"cmd":command}));
    callbacks[id] = callback;
}

function turnLeft()  { send(0,"turtle.turnLeft()" ,console.log); }
function turnRight() { send(0,"turtle.turnRight()",console.log); }

function up()      { send(0,"turtle.up()"     ,console.log); }
function down()    { send(0,"turtle.down()"   ,console.log); }
function forward() { send(0,"turtle.forward()",console.log); }
function back()    { send(0,"turtle.back()"   ,console.log); }

function dig()     { send(0,"turtle.dig()"    ,console.log); }
function digUp()   { send(0,"turtle.digUp()"  ,console.log); }
function digDown() { send(0,"turtle.digDown()",console.log); }
function suck()     { send(0,"turtle.suck()"    ,console.log); }
function suckUp()   { send(0,"turtle.suckUp()"  ,console.log); }
function suckDown() { send(0,"turtle.suckDown()",console.log); }
function drop()     { send(0,"turtle.drop()"    ,console.log); }
function dropUp()   { send(0,"turtle.dropUp()"  ,console.log); }
function dropDown() { send(0,"turtle.dropDown()",console.log); }
function place()     { send(0,"turtle.place()"    ,console.log); }
function placeUp()   { send(0,"turtle.placeUp()"  ,console.log); }
function placeDown() { send(0,"turtle.placeDown()",console.log); }
function inspect()     { send(0,"turtle.inspect()"    ,console.log); }
function inspectUp()   { send(0,"turtle.inspectUp()"  ,console.log); }
function inspectDown() { send(0,"turtle.inspectDown()",console.log); }
function detect()     { send(0,"turtle.detect()"    ,console.log); }
function detectUp()   { send(0,"turtle.detectUp()"  ,console.log); }
function detectDown() { send(0,"turtle.detectDown()",console.log); }

function equipRight() { send(0,"turtle.equipRight()",console.log); }
function equipLeft()  { send(0,"turtle.equipLeft()" ,console.log); }