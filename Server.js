"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Colors = /** @class */ (function () {
    function Colors() {
    }
    Colors.Reset = "\x1b[0m";
    Colors.Bright = "\x1b[1m";
    Colors.Underscore = "\x1b[4m";
    Colors.Reverse = "\x1b[7m";
    //static Dim       :string = "\x1b[2m";//does not work at all
    //static Blink     :string = "\x1b[5m";//does not work at all
    //static Hidden    :string = "\x1b[8m";//does not work at all
    Colors.R = "\x1b[0m";
    Colors.B = "\x1b[1m";
    Colors.U = "\x1b[4m";
    Colors.Rev = "\x1b[7m";
    Colors.FgBlack = "\x1b[30m";
    Colors.FgRed = "\x1b[31m";
    Colors.FgGreen = "\x1b[32m";
    Colors.FgYellow = "\x1b[33m"; //does not work on powershell somehow
    Colors.FgBlue = "\x1b[34m";
    Colors.FgMagenta = "\x1b[35m";
    Colors.FgCyan = "\x1b[36m";
    Colors.FgWhite = "\x1b[37m";
    Colors.FgGray = "\x1b[90m";
    Colors.Fbla = "\x1b[30m";
    Colors.Fr = "\x1b[31m";
    Colors.Fgre = "\x1b[32m";
    Colors.Fy = "\x1b[33m"; //does not work on powershell somehow
    Colors.Fblu = "\x1b[34m";
    Colors.Fm = "\x1b[35m";
    Colors.Fc = "\x1b[36m";
    Colors.Fw = "\x1b[37m";
    Colors.Fgra = "\x1b[90m";
    Colors.BgBlack = "\x1b[40m";
    Colors.BgRed = "\x1b[41m";
    Colors.BgGreen = "\x1b[42m";
    Colors.BgYellow = "\x1b[43m";
    Colors.BgBlue = "\x1b[44m";
    Colors.BgMagenta = "\x1b[45m";
    Colors.BgCyan = "\x1b[46m";
    Colors.BgWhite = "\x1b[47m";
    Colors.BgGray = "\x1b[100m";
    Colors.Bbla = "\x1b[40m";
    Colors.Br = "\x1b[41m";
    Colors.Bgre = "\x1b[42m";
    Colors.By = "\x1b[43m";
    Colors.Bblu = "\x1b[44m";
    Colors.Bm = "\x1b[45m";
    Colors.Bc = "\x1b[46m";
    Colors.Bw = "\x1b[47m";
    Colors.Bgra = "\x1b[100m";
    return Colors;
}());
var http = require("http");
var WebSocket = require("ws");
var express = require("express");
console.clear();
var turtlePort = 58742; // lua getter and websocket server are on the same port
var server = http.createServer();
// web server for just getting the lua code
var fileGetter = express();
fileGetter.get("/get.lua", function (req, res) { return res.sendFile(__dirname + "/lua/get.lua", "utf8"); });
fileGetter.get("/json.lua", function (req, res) { return res.sendFile(__dirname + "/lua/json.lua", "utf8"); });
fileGetter.get("/websocketControl.lua", function (req, res) { return res.sendFile(__dirname + "/lua/websocketControl.lua", "utf8"); });
fileGetter.get("/startup.lua", function (req, res) { return res.sendFile(__dirname + "/lua/startup.lua", "utf8"); });
server.on('request', fileGetter);
// websocket server for the tutles to connect to
var ws = new WebSocket.Server({ server: server });
var turtles = [];
var pings = [];
function send(index, cmd) {
    if (turtles[index] != null)
        turtles[index].socket.send(cmd);
}
var pinging = false;
function ping() {
    if (pinging == true)
        return;
    pinging = true;
    for (var i = 0; i < turtles.length; i++) {
        if (turtles[i] != null) {
            pings[i] = false;
            send(i, JSON.stringify({ "type": "ping", "id": i }));
        }
    }
    setTimeout(function () {
        for (var i = 0; i < pings.length; i++) {
            if (pings[i] != true) {
                if (turtles[i].socket != null)
                    turtles[i].socket.close();
                console.log("\"" + turtles[i].name + "\" disconnected.");
                if (browserWS)
                    browserWS.send(JSON.stringify({ type: "disconnection", name: turtles[i].name }));
                delete turtles[i];
            }
        }
        pings = [];
        pinging = false;
    }, 250);
}
var browserWS;
ws.on("connection", function (websocket) {
    websocket.on("close", function (code, reason) {
        ping();
    });
    websocket.on("message", function (message) {
        var msg = JSON.parse(message.toString());
        if (msg.type == "connection") {
            if (msg.connection == null)
                return;
            if (msg.connection == "turtle") {
                for (var i = 0; i < turtles.length + 1; i++) {
                    if (turtles[i] == null) {
                        turtles[i] = { "socket": websocket, "name": "turtle" + i.toString() };
                        console.log("\"turtle" + i.toString() + "\" connected.");
                        if (browserWS)
                            browserWS.send(JSON.stringify({ type: "connection", name: "turtle" + i.toString() }));
                        break;
                    }
                }
            }
            else if (msg.connection == "browser") {
                browserWS = websocket;
            }
        }
        else if (msg.type == "lua") {
            send(msg.index, JSON.stringify(msg));
        }
        else if (msg.type == "return") {
            browserWS.send(JSON.stringify(msg));
        }
        else if (msg.type == "pong") {
            pings[msg.id] = true;
        }
    });
});
server.listen(turtlePort, function () {
    console.log(Colors.Fgra + "File getter running at: " + Colors.Fgre + "http://localhost:" + turtlePort + Colors.R);
    console.log(Colors.Fgra + "WebSocket is running on " + Colors.Fgre + "ws://localhost:" + turtlePort + Colors.R);
});
// webserver for the turtle controller
var webServerPort = 80;
var app = express();
var pages = {
    "/index.html": function (req, res, send) { return send("/webpage/index.html"); },
    "/Main.js": function (req, res, send) { return send("/webpage/Main.js"); },
};
Object.keys(pages).forEach(function (key) {
    // for each page send the req,res, and "send" function which either sends
    // the file at the path of the key from the "pages" object or the argument passed in
    app.get(key, function (req, res) {
        pages[key](req, res, function (page) { res.sendFile(__dirname + (page != null ? page : key), "utf8"); });
    });
});
app.get("*", function (req, res) { res.redirect("/index.html"); });
app.listen(webServerPort, function () { console.log(Colors.Fgra + "Web server is running at: " + Colors.Fgre + "http://localhost:" + webServerPort + Colors.R); });
