class Colors {
    static Reset     :string = "\x1b[0m";
    static Bright    :string = "\x1b[1m";
    static Underscore:string = "\x1b[4m";
    static Reverse   :string = "\x1b[7m";
    //static Dim       :string = "\x1b[2m";//does not work at all
    //static Blink     :string = "\x1b[5m";//does not work at all
    //static Hidden    :string = "\x1b[8m";//does not work at all
    static R  :string = "\x1b[0m";
    static B  :string = "\x1b[1m";
    static U  :string = "\x1b[4m";
    static Rev:string = "\x1b[7m";

    static FgBlack  :string = "\x1b[30m";
    static FgRed    :string = "\x1b[31m";
    static FgGreen  :string = "\x1b[32m";
    static FgYellow :string = "\x1b[33m";//does not work on powershell somehow
    static FgBlue   :string = "\x1b[34m";
    static FgMagenta:string = "\x1b[35m";
    static FgCyan   :string = "\x1b[36m";
    static FgWhite  :string = "\x1b[37m";
    static FgGray   :string = "\x1b[90m";
    static Fbla:string = "\x1b[30m";
    static Fr  :string = "\x1b[31m";
    static Fgre:string = "\x1b[32m";
    static Fy  :string = "\x1b[33m";//does not work on powershell somehow
    static Fblu:string = "\x1b[34m";
    static Fm  :string = "\x1b[35m";
    static Fc  :string = "\x1b[36m";
    static Fw  :string = "\x1b[37m";
    static Fgra:string = "\x1b[90m";

    static BgBlack  :string = "\x1b[40m" ;
    static BgRed    :string = "\x1b[41m" ;
    static BgGreen  :string = "\x1b[42m" ;
    static BgYellow :string = "\x1b[43m" ;
    static BgBlue   :string = "\x1b[44m" ;
    static BgMagenta:string = "\x1b[45m" ;
    static BgCyan   :string = "\x1b[46m" ;
    static BgWhite  :string = "\x1b[47m" ;
    static BgGray   :string = "\x1b[100m";
    static Bbla:string = "\x1b[40m" ;
    static Br  :string = "\x1b[41m" ;
    static Bgre:string = "\x1b[42m" ;
    static By  :string = "\x1b[43m" ;
    static Bblu:string = "\x1b[44m" ;
    static Bm  :string = "\x1b[45m" ;
    static Bc  :string = "\x1b[46m" ;
    static Bw  :string = "\x1b[47m" ;
    static Bgra:string = "\x1b[100m";
}
import * as http from "http"
import * as WebSocket from "ws";
const express = require("express");
import * as fs from "fs";

console.clear();


const turtlePort:number = 58742;// lua getter and websocket server are on the same port
let server = http.createServer();
// web server for just getting the lua code
var fileGetter = express();
fileGetter.get("/get.lua"             ,(req:any,res:any)=>res.sendFile(__dirname+"/lua/get.lua"             ,"utf8"));
fileGetter.get("/json.lua"            ,(req:any,res:any)=>res.sendFile(__dirname+"/lua/json.lua"            ,"utf8"));
fileGetter.get("/websocketControl.lua",(req:any,res:any)=>res.sendFile(__dirname+"/lua/websocketControl.lua","utf8"));
fileGetter.get("/startup.lua"         ,(req:any,res:any)=>res.sendFile(__dirname+"/lua/startup.lua"         ,"utf8"));
server.on('request', fileGetter);

// websocket server for the tutles to connect to
const ws = new WebSocket.Server({server});
type block = {name:string,state:{[key:string]:any}};
var turtles:{socket:WebSocket,data:{name:string,pos:[number,number,number],d:0|1|2|3,busy:boolean,worldData:{[key:string]:{[key:string]:{[key:string]:block}}}}}[] = [];
var pings:any[] = [];
function send(index:number,cmd:string) {
    if (turtles[index]!=null)turtles[index].socket.send(cmd);
}
var pinging:boolean = false;
function ping() {
    if (pinging==true)return;
    pinging=true;
    for (let i = 0; i < turtles.length; i++) {
        if (turtles[i]!=null) { pings[i]=false;send(i,JSON.stringify({"type":"ping","id":i})); }
    }
    setTimeout(() => {
        for (let i = 0; i < pings.length; i++) {
            if (pings[i]!=true) {
                if(turtles[i]!=null&&turtles[i].socket!=null&&turtles[i].socket.readyState==WebSocket.OPEN) turtles[i].socket.close();
                console.log(Colors.Fgre+"\""+turtles[i].data.name+"\""+Colors.Fgra+" disconnected."+Colors.R);
                if (browserWS) browserWS.send(JSON.stringify({"type":"disconnection","index":i}));
                delete turtles[i];
            }
        }
        pings=[];
        pinging=false;
    }, 250);
}
var browserWS:WebSocket;
ws.on("connection",(websocket:WebSocket)=>{
    websocket.on("close",(code: number, reason: Buffer)=>{
        ping();
    });
    websocket.on("message",(message:WebSocket.RawData)=>{
		var msg:any = JSON.parse(message.toString());
        if (msg.type=="connection") {
            if (msg.connection==null)return;
            if (msg.connection=="turtle") {
                for (let i:number = 0; i < turtles.length+1; i++) {
                    if (turtles[i]==null) {
                        turtles[i]={"socket":websocket,data:{"name":"turtle"+i.toString(),pos:[0,0,0],d:3,busy:false,worldData:{}}};
                        console.log(Colors.Fgre+"\""+turtles[i].data.name+"\""+Colors.Fgra+" connected."+Colors.R);
                        send(i,JSON.stringify({"type":"lua","id":"setNameServer","cmd":"os.setComputerLabel(\""+turtles[i].data.name+"\")"}));
                        if (browserWS!=null) browserWS.send(JSON.stringify({"type":"connection","index":i,"data":turtles[i].data}));
                        break;
                    }
                }
            } else if (msg.connection=="browser") {
                if (browserWS!=null) { browserWS.send(JSON.stringify({"type":"end"}));browserWS.close(); }
                browserWS=websocket;
                for (let i = 0; i < turtles.length; i++) {
                    if (turtles[i]!=null) browserWS.send(JSON.stringify({"type":"connection","index":i,"data":turtles[i].data}));
                }
            }
        } else if (msg.type == "lua") {
			send(msg.index,JSON.stringify(msg));
		} else if (msg.type == "return") {
            if (msg.id=="setNameServer") return;
			if (browserWS!=null) browserWS.send(JSON.stringify(msg));
		} else if (msg.type == "pong") {
            pings[msg.id]=true;
		} else if (msg.type == "save") {
            turtles[msg.index].data = msg.data;
        }
    });
});
server.listen(turtlePort,()=>{
    console.log(Colors.Fgra+"File getter running at: "+Colors.Fgre+"http://localhost:"+turtlePort+Colors.R);
    console.log(Colors.Fgra+"WebSocket is running on "+Colors.Fgre+  "ws://localhost:"+turtlePort+Colors.R);
});


// webserver for the turtle controller
const webServerPort:number = 80;
var app = express();
var pages:{[key:string]:((req:any,res:any,send:(page:string,mime?:string)=>void)=>void)} = {
    //my code
    "/index.html"      :( req:any,res:any,send:(page:string,mime?:string)=>void)=>send("/webpage/index.html","text/html"      ),
    "/index.css"       :( req:any,res:any,send:(page:string,mime?:string)=>void)=>send("/webpage/index.css" ,"text/css"       ),
    "/model/turtle.png":( req:any,res:any,send:(page:string,mime?:string)=>void)=>send("/model/turtle.png"  ,"image/png"      ),
    "/model/turtle.obj":( req:any,res:any,send:(page:string,mime?:string)=>void)=>send("/model/turtle.obj"  ,"model/obj"      ),
    "/favicon.png"     :( req:any,res:any,send:(page:string,mime?:string)=>void)=>send("/favicon.png"       ,"image/png"      ),
    "/Main.js"         :( req:any,res:any,send:(page:string,mime?:string)=>void)=>send("/webpage/Main.js"   ,"text/javascript"),
    //threejs utils
    "/OrbitControls.js"      :( req:any,res:any,send:(page:string,mime?:string)=>void)=>send("/webpage/three/OrbitControls.js"          ,"text/javascript"),
    "/OBJLoader.js"          :( req:any,res:any,send:(page:string,mime?:string)=>void)=>send("/webpage/three/OBJLoader.js"              ,"text/javascript"),
    "/BufferGeometryUtils.js":( req:any,res:any,send:(page:string,mime?:string)=>void)=>send("/webpage/three/BufferGeometryUtils.js"    ,"text/javascript")
}
Object.keys(pages).forEach((key) => {
    // for each page send the req,res, and "send" function which either sends
    // the file at the path of the key from the "pages" object or the argument passed in
    app.get(key, (req:any, res:any)=>{
        pages[key](req,res,(page:string,mime?:string)=>{ res.contentType(mime||"text/html");res.sendFile(__dirname+(page!=null?page:key),"utf8"); });
    });
});
app.get("/",(req:any,res:any)=>{ res.redirect("/index.html"); });
app.use("/three/src"     ,express.static(__dirname+"/node_modules/three/src/"  ));
app.use("/UI"            ,express.static(__dirname+"/UI/"                      ));
app.use("/blockstates"   ,(req:any,res:any)=>{
    const pathname:string = req._parsedUrl.pathname.replace("/blockstates/","");
    //will serve file from either "/minecraft/blockstates" or "/minecraft/blockstates/custom"
    if (fs.existsSync(__dirname+"/minecraft/blockstates/"+pathname)) res.sendFile(__dirname+"/minecraft/blockstates/"+pathname);
    else if (fs.existsSync(__dirname+"/minecraft/blockstates/custom/"+pathname)) res.sendFile(__dirname+"/minecraft/blockstates/custom/"+pathname);
    else {res.status(404)}
});
app.use("/models/block"  ,express.static(__dirname+"/minecraft/models/block/"  ));
app.use("/textures/block",express.static(__dirname+"/minecraft/textures/block/"));
app.listen(webServerPort,()=>{ console.log(Colors.Fgra+"Web server is running at: "+Colors.Fgre+"http://localhost:"+webServerPort+Colors.R); });