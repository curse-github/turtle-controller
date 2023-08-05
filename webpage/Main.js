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
    //add keyboard controls
    window.addEventListener("keydown", function(e) {
        switch (e.key) {
            case "w"    : e.preventDefault();turtle.actions.forward  ();return;
            case "a"    : e.preventDefault();turtle.actions.turnLeft ();return;
            case "s"    : e.preventDefault();turtle.actions.back     ();return;
            case "d"    : e.preventDefault();turtle.actions.turnRight();return;
            case " "    : e.preventDefault();turtle.actions.up       ();return;
            case "Shift": e.preventDefault();turtle.actions.down     ();return;
            default: return;
        }
    });
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
    if (turtleId==null){ callback(["false","nil","nil"]);return; }
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
var TurtleMat;
function setupThree() {//initalize threejs scene and materials
    scene = new THREE.Scene();
    const light = new THREE.AmbientLight(0x303030);
    scene.add(light);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth * 0.98, window.innerHeight * 0.98);
    renderer.domElement.id="canvas";
    renderer.domElement.tabindex=1;
    
    document.body.appendChild(renderer.domElement);
    controls = window.controls = new OrbitControls(camera, renderer.domElement);
    controls.enableKeys = false

    defMaterial = new THREE.MeshBasicMaterial({ color: 0xc00030, transparent: true, opacity: 0.5 });
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
const setScene = window.setScene = async function(index) {
    console.log("setScene("+index+");");
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
    Object.entries(turtles[turtleId].worldData).forEach(([x,worldDataX])=>{
        if (worldDataX==null)return;
        Object.entries(worldDataX).forEach(([y,worldDataXY])=>{
            if (worldDataXY==null)return;
            Object.entries(worldDataXY).forEach(([z,block])=>{
                if (block==null) return;
                setBlock([x,y,z],block.name,block.state);
            })
        })
    });
    detect();
}


async function setBlock(pos,name,state) {
    const [x,y,z] = pos;
    const worldData = turtles[turtleId].worldData;
    if (worldData[x]==null)worldData[x]=[];
    if (worldData[x][y]==null)worldData[x][y]=[];
    if (worldData[x][y][z]==null)worldData[x][y][z]={name,state};
    turtles[turtleId].worldData=worldData;
    const worldModels = sceneData.worldData;
    if (worldModels[x]==null)worldModels[x]=[];
    if (worldModels[x][y]==null)worldModels[x][y]=[];
    if (worldModels[x][y][z]!=null) scene.remove(worldModels[x][y][z]);
    var cubeGeometry = new THREE.BoxGeometry();
    var cube = new THREE.Mesh(cubeGeometry, defMaterial);
    cube.position.set(...pos);
    scene.add(cube);
    worldModels[x][y][z]=cube;
    sceneData.worldData=worldModels;
}
async function detect() {
    //detect up and set block if needed
    const upOutput = await turtle.actions.inspectUp();
    if (upOutput!=null) setBlock(vec3Add(turtle.getPos(),[0,1,0]),upOutput.name,upOutput.state);
    //detect down and set block if needed
    const downOutput = await turtle.actions.inspectDown();
    if (downOutput!=null) setBlock(vec3Add(turtle.getPos(),[0,-1,0]),downOutput.name,downOutput.state);
    //detect in each direction and set blocks if needed
    for (let i = 0; i < 4; i++) {
        const output = await turtle.actions.inspect();
        if (output!=null) {
            const pos=vec3Add(turtle.getPos(),turtle.getForward())
            setBlock(pos,output.name,output.state);
        }
        await turtle.actions.turnRight();
    }
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
            turtle.setPos(pos);detect();
        },
        "down":async()=>{
            const out = await sendAsync("turtle.down()");
            if (out[0]=="false") return;
            const pos = turtle.getPos();pos[1]--;
            turtle.setPos(pos);detect();
        },
        "forward":async()=>{
            const out = await sendAsync("turtle.forward()");
            if (out[0]=="false") return;
            const pos=vec3Add(turtle.getPos(),turtle.getForward())
            turtle.setPos(pos);detect();
        },
        "back":async()=>{
            const out = await sendAsync("turtle.back()");
            if (out[0]=="false") return;
            const pos=vec3Add(turtle.getPos(),turtle.getBack())
            turtle.setPos(pos);detect();
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