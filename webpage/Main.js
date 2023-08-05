import * as THREE from "/three/src/Three.js"
import { OrbitControls } from "/three/examples/jsm/controls/OrbitControls.js"
import { OBJLoader } from "/three/examples/jsm/loaders/OBJLoader.js"
function threeVec2vec3(threeVec3) {
    return [threeVec3.x,threeVec3.y,threeVec3.z];
}
function vec3Add(a,b) {
    return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
}

function generateUUID() {
	var a = new Date().getTime();//Timestamp
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var b = Math.random() * 16;//random number between 0 and 16
		b = (a + b)%16 | 0;
		a = Math.floor(a/16);
		return (c === 'x' ? b : (b & 0x3 | 0x8)).toString(16);
	});
}
function setup() {
    setupThree();
    setupWebsocket();
    setupButtons();
}
window.onload = setup;

//#region websocket
var ws;
var turtles = [];
var callbacks = {};
var turtleId;
function setupWebsocket() {
    ws = new WebSocket("ws://mc.campbellsimpson.com:58742");
    ws.onopen = ()=>ws.send(JSON.stringify({"type":"connection","connection":"browser"}));
    ws.onerror = (err)=>console.log("WebSocket error: "+err);
    ws.onmessage = (e)=>{
        var msg = JSON.parse(e.data);
        if (msg.type == "connection") {
            turtles[msg.index]={"name":msg.name,pos:[0,0,0],d:3,worldData:[]};
            if (turtleId==undefined) {
                setScene(msg.index)
            }
        } else if (msg.type == "disconnection") {
            delete turtles[msg.index];
            if (turtleId==msg.index) turtleId=undefined;
        } else if (msg.type == "return") {
            if (callbacks[msg.id]!=null) callbacks[msg.id](msg.return.map((el)=>el.split("|").join(":")));
        }
    }
}

function send(command,callback) {
    const id = generateUUID();
    ws.send(JSON.stringify({"type":"lua","index":turtleId,"id":id,"cmd":command}));
    callbacks[id] = callback;
}
async function sendAsync(command) {
    return new Promise((resolve)=>{
        send(command,resolve);
    });
}
//#endregion websocket

//#region threejs
var scene;
var camera;
var renderer;
var controls;

var defMaterial;
var lineMaterial;
var TurtleMat;
function setupThree() {
    scene = new THREE.Scene();
    const light = new THREE.AmbientLight(0x303030);
    scene.add(light);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth * 0.98, window.innerHeight * 0.98);
    document.body.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);

    defMaterial = new THREE.MeshBasicMaterial({ color: 0xc00030, transparent: true, opacity: 0.5 });
    lineMaterial = new THREE.LineBasicMaterial({ color: 0xa8002a });
    TurtleMat = new THREE.MeshBasicMaterial({ map: new THREE.TextureLoader().load("model/turtle.png") });
    TurtleMat.map.magFilter = THREE.NearestFilter;

    animate();
}
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
async function objLoadAsync(model) {
    var loader = new OBJLoader();
    return new Promise((resolve)=>{
        loader.load(model, resolve);
    });
}
var sceneData;
async function setScene(index) {
    sceneData={turtle:{model:null},worldData:[]};
    scene.clear();

    turtleId=index;
    const object = await objLoadAsync("model/turtle.obj");
    object.scale.set(0.25, 0.25, 0.25);
    object.traverse((child)=>{
        if (child instanceof THREE.Mesh) { child.material = TurtleMat; }
    });
    object.name = "turtle" + index;
    scene.add(object);
    sceneData.turtle.model = object;
    turtle.update();
    turtle.cameraFocus();
}
async function setBlock(pos,blockid,nbt) {
    const [x,y,z] = pos;
    const worldData = turtles[turtleId].worldData;
    if (worldData[x]==null)worldData[x]=[];
    if (worldData[x][y]==null)worldData[x][y]=[];
    if (worldData[x][z]==null)worldData[x]=[];
    var cubeGeometry = new THREE.BoxGeometry();
    cubeGeometry.computeFaceNormals();
    cube = new THREE.Mesh(cubeGeometry, defMaterial);
    
    turtles[turtleId].worldData=worldData();
}
const turtle = window.turtle = {//window.turtle make is accessable from the console
    "get":()=>{ return turtles[turtleId]; },
    "getPos":()=>{ return turtles[turtleId].pos; },
    "getRot":()=>{ return turtles[turtleId].d; },
    "getForward":()=>{ switch(turtles[turtleId].d) {
        case 0: return [0,0, 1]; case 1: return [-1,0,0];
        case 2: return [0,0,-1]; case 3: return [ 1,0,0];
    } },
    "getBack":()=>{ switch(turtles[turtleId].d) {
        case 0: return [0,0,-1]; case 1: return [ 1,0,0];
        case 2: return [0,0, 1]; case 3: return [-1,0,0];
    } },
    "getCameraPos":()=>{ return threeVec2vec3(camera.position); },
    "setPos":(pos)=>{ turtles[turtleId].pos=pos;turtle.updatePos(); },
    "setRot":(d)=>{ turtles[turtleId].d=d;turtle.updateRot(); },
    "cameraFocus":()=>{
        const turtlePos=turtles[turtleId].pos;
        camera.position.set(...vec3Add(turtlePos,[-2.8868,2.8868,2.8868]));
        controls.target.set(...turtlePos); controls.update();
    },
    "updatePos":()=>{ sceneData.turtle.model.position.set(...turtles[turtleId].pos); },
    "updateRot":()=>{ sceneData.turtle.model.rotation.y = -(Math.PI/2)*(turtles[turtleId].d+1); },
    "update":()=>{ turtle.updatePos();turtle.updateRot(); },
    "actions":{
        "turnLeft":async()=>{
            const out = await sendAsync("turtle.turnLeft()");
            if (out[0]=="false") return;
            turtle.setRot((turtle.getRot()+3)%4);
        },
        "turnRight":async()=>{
            const out = await sendAsync("turtle.turnRight()");
            if (out[0]=="false") return;
            turtle.setRot((turtle.getRot()+1)%4);
        },
        "up":async()=>{
            const out = await sendAsync("turtle.up()");
            if (out[0]=="false") return;
            const pos = turtle.getPos();pos[1]++;
            turtle.setPos(pos);
        },
        "down":async()=>{
            const out = await sendAsync("turtle.down()");
            if (out[0]=="false") return;
            const pos = turtle.getPos();pos[1]--;
            turtle.setPos(pos);
        },
        "forward":async()=>{
            const out = await sendAsync("turtle.forward()");
            if (out[0]=="false") return;
            const pos=vec3Add(turtle.getPos(),turtle.getForward())
            turtle.setPos(pos);
        },
        "back":async()=>{
            const out = await sendAsync("turtle.back()");
            if (out[0]=="false") return;
            const pos=vec3Add(turtle.getPos(),turtle.getBack())
            turtle.setPos(pos);
        },
    
        "dig":async()=>{ const out = await sendAsync("turtle.dig()" ); },
        "digUp":async()=>{ const out = await sendAsync("turtle.digUp()"); },
        "digDown":async()=>{ const out = await sendAsync("turtle.digDown()"); },
        "suck":async()=>{ const out = await sendAsync("turtle.suck()" ); },
        "suckUp":async()=>{ const out = await sendAsync("turtle.suckUp()"); },
        "suckDown":async()=>{ const out = await sendAsync("turtle.suckDown()"); },
        "drop":async()=>{ const out = await sendAsync("turtle.drop()" ); },
        "dropUp":async()=>{ const out = await sendAsync("turtle.dropUp()"); },
        "dropDown":async()=>{ const out = await sendAsync("turtle.dropDown()"); },
        "place":async()=>{ const out = await sendAsync("turtle.place()" ); },
        "placeUp":async()=>{ const out = await sendAsync("turtle.placeUp()"); },
        "placeDown":async()=>{ const out = await sendAsync("turtle.placeDown()"); },
        "inspect"    :async()=>{ return turtle.actions.handleInspect(await sendAsync("turtle.inspect()"    )); },
        "inspectUp"  :async()=>{ return turtle.actions.handleInspect(await sendAsync("turtle.inspectUp()"  )); },
        "inspectDown":async()=>{ return turtle.actions.handleInspect(await sendAsync("turtle.inspectDown()")); },
        "handleInspect":(data)=>{if (data[0]=="true"){
            var out = JSON.parse(data[1])
            out.tags=Object.entries(out.tags).map(([key,value])=>((value==true)?key:null)).filter((el)=>el!=null);
            return out;
        }else return null},
        "detect"    :async()=>{ return (await sendAsync("turtle.detect()"    ))[0]; },
        "detectUp"  :async()=>{ return (await sendAsync("turtle.detectUp()"  ))[0]; },
        "detectDown":async()=>{ return (await sendAsync("turtle.detectDown()"))[0]; },
    
        "equipRight":async()=>{ const out = await sendAsync("turtle.equipRight()"); },
        "equipLeft":async()=>{ const out = await sendAsync("turtle.equipLeft()"); }
    }
}
function setupButtons() {
    const entries = Object.entries(turtle.actions);
    for (let i = 0; i < entries.length; i++) {
        const [key,value] = entries[i];
        window[key] = value;
        const element = document.getElementById(key);
        if (element) element.addEventListener("click",value);
    }
}
//#endregion threejs