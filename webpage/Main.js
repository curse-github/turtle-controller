/*
TODO:
    switch turtles
    color leaf textures
    procedural rendering
    render mushroom block
*/


import * as THREE from "/three/src/Three.js"
window.THREE=THREE;
import { OrbitControls } from "/OrbitControls.js"
import { OBJLoader } from "/OBJLoader.js"
import * as BufferGeometryUtils from "/BufferGeometryUtils.js"
//#region helpers
function generateUUID() {
	var a = new Date().getTime();//Timestamp
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var b = Math.random() * 16;//random number between 0 and 16
		b = (a + b)%16 | 0;
		a = Math.floor(a/16);
		return (c === 'x' ? b : (b & 0x3 | 0x8)).toString(16);
	});
}
function threeVec2vec3(threeVec3) {
    return [threeVec3.x,threeVec3.y,threeVec3.z];
}
function vec3Add(a,b) {
    return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
}
async function objLoadAsync(model) {
    var loader = new OBJLoader();
    return new Promise((resolve)=>{
        loader.load(model, resolve);
    });
}
async function fetchJsonAsync(url,input) {
    return new Promise((resolve) => {
        fetch(url, {
            headers: {}
        }).then((response) => response.json())
        .then((json)=>{
            resolve(json,input);
        });
    });
}
async function getBlockstate(name) {
    var tmp;
    tmp=name.includes(":")?name.split(":")[1]:name;//removes "minecraft:" from the beginning if needed
    return fetchJsonAsync("/blockstates/"+tmp+".json");
}
async function getModel(name) {
    return fetchJsonAsync("/models/"+name+".json");
}
var modelCache=window.modelCache={};
async function getModelRecursive(name) {
    var tmp;
    tmp=name.includes(":")?name.split(":")[1]:name;//removes "minecraft:" from the beginning if needed
    if (modelCache[tmp]!=null) return modelCache[tmp];//returns a cached model
    const model = await getModel(tmp);
    model.path=[tmp];
    if (model.parent!=null&&model.parent!="builtin/generated") {
        var parentModel = await getModelRecursive(model.parent);
        //element from higher layer replace lower
        if (model.ambientocclusion==null&&parentModel.ambientocclusion!=null)model.ambientocclusion=parentModel.ambientocclusion;
        if (model.elements==null&&parentModel.elements!=null)model.elements=parentModel.elements;
        if (model.display==null&&parentModel.display!=null)model.display=parentModel.display;
        //element from lower layer replace above
        if (parentModel.parent!=null) model.parent=parentModel.parent; else delete model.parent;
        if (parentModel.textures!=null)model.textures={...parentModel.textures,...model.textures};
        if (parentModel.base!=null)model.base=parentModel.base;
        model.path=[...parentModel.path,...model.path];
    }
    modelCache[tmp]=model;
    return model;
}
var textureCache = {};
async function getMaterial(name,rotation,offset) {
    var tmp;
    tmp=name.includes(":")?name.split(":")[1]:name;//removes "minecraft:" from the beginning if needed
    var texture;
    if (textureCache[tmp]!=null) texture=textureCache[tmp].clone();//returns a cached model
    else {
        var textureTmp = new THREE.TextureLoader().load("/textures/"+tmp+".png");
        textureTmp.magFilter = THREE.NearestFilter;// makes pixels not blurry
        textureCache[tmp]=textureTmp;
        texture=textureTmp.clone();
    }
    var material = await new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    material.toneMapped=false;
    if (offset!=null) material.map.offset={x:offset[0],y:offset[1]};
    if (rotation!=null) material.map.rotation=-rotation;
    return material;
}
const SupportedModelTypes = [
    "block/block",
    "block/cube",
    "block/cube_mirrored",
    "block/cube_north_west_mirrored",

    "block/grass_block",
    "block/cube_all",
    "block/cube_mirrored_all",
    "block/cube_north_west_mirrored_all",
    "block/leaves",
    "block/cube_bottom_top",
    "block/cube_column",
    "block/cube_column_mirrored",
    "block/cube_column_horizontal",
    "block/cube_mirrored",
    "block/orientable_with_bottom",
    "block/cube_top",
    "block/mangrove_roots",

    "block/slime_block",
    "block/honey_block",
    "block/crafting_table",
    "block/cartography_table",
    "block/fletching_table",
    "block/smithing_table",
    "block/dried_kelp_block"
]
async function getBlockMesh(name,state) {
    var blockstate = await getBlockstate(name);
    if (blockstate.multipart!=null){console.log("\""+name+"\"","multipart!");return new THREE.Mesh(new THREE.BoxGeometry(), defMaterial);}
    if (blockstate.variants==null)return;
    var variantKey = Object.keys(blockstate.variants)[0];//first key of the variants
    var variant;
    if (Object.keys(blockstate.variants).length>1) {//if there is more than one variant
        //get keys of blockstate, filter only ones used to get variant, sort alphebetically, map each key to its value, and finally join on commas.
        //gives you something like "face=floor,facing=west,powered=false"
        const states=Object.keys(state).filter((key)=>variantKey.includes(key)).sort().map((key)=>key+"="+state[key]).join(",");
        variant=blockstate.variants[states];
    } else {
        variant=blockstate.variants[variantKey];//return only variant
    }
    if ((typeof variant)=="object" && Array.isArray(variant)) variant = variant[Math.ceil(Math.random()*variant.length)-1];//pick random variant
    if (variant==null||variant.model==null) return new THREE.Mesh(new THREE.BoxGeometry(), defMaterial);
    const model = await getModelRecursive(variant.model);
    if (!SupportedModelTypes.includes(model.path[0])) { console.log("unsupported model type: \""+model.path[0]+"\"");console.log(model);return new THREE.Mesh(new THREE.BoxGeometry(), defMaterial); }
    const mySwitch = {//materials list is [left, right, top, bottom, front, back] or [east, west, top, bottom, north, south]
        "block/block":async()=>{
            if (!SupportedModelTypes.includes(model.path[1])) { console.log("unsupported model type: \""+model.path[1]+"\"");console.log(model);return new THREE.Mesh(new THREE.BoxGeometry(), defMaterial); }
            model.path.shift();
            return mySwitch[model.path[0]]();
        },
        "block/cube":()=>mySwitch["block/block"](),
        "block/cube_mirrored":()=>mySwitch["block/cube"](),
        "block/cube_north_west_mirrored":()=>mySwitch["block/cube"](),
        "block/cube_all":async()=>{
            const all = await getMaterial(model.textures.all);
            return new THREE.Mesh(new THREE.BoxGeometry(), [all, all, all, all, all, all]);
        },
        "block/cube_mirrored_all":()=>mySwitch["block/cube_all"](),
        "block/cube_north_west_mirrored_all":()=>mySwitch["block/cube_all"](),
        "block/leaves":()=>mySwitch["block/cube_all"](),
        "block/cube_bottom_top":async()=>{
            const top = await getMaterial(model.textures.top);
            const bottom = await getMaterial(model.textures.bottom);
            const side = await getMaterial(model.textures.side);
            var materials = [side, side, top, bottom, side, side];
            return new THREE.Mesh(new THREE.BoxGeometry(), materials);
        },
        "block/grass_block":()=>mySwitch["block/cube_bottom_top"](),
        "block/cube_column":async()=>{
            const end = await getMaterial(model.textures.end,Math.PI/2,[1,0]);
            const side = await getMaterial(model.textures.side);
            var materials = [side, side, end, end, side, side];
            return new THREE.Mesh(new THREE.BoxGeometry(), materials);
        },
        "block/cube_column_mirrored":()=>mySwitch["block/cube_column"](),
        "block/cube_column_horizontal":async()=>{
            const end = await getMaterial(model.textures.end,Math.PI,[1,1]);
            const side = await getMaterial(model.textures.side,Math.PI/2,[1,0]);
            var materials = [end, end, side, side, side, side];
            var mesh = new THREE.Mesh(new THREE.BoxGeometry(), materials);
            return mesh;
        },
        "block/orientable":async()=>{
            const top = await getMaterial(model.textures.top);
            const bottom = await getMaterial(model.textures.bottom);
            const front = await getMaterial(model.textures.front);
            const side = await getMaterial(model.textures.side);
            var materials = [side, side, top, bottom, front, side];
            var mesh =  new THREE.Mesh(new THREE.BoxGeometry(), materials);
            return mesh;
        },
        "block/orientable_with_bottom":async()=>{
            const top = await getMaterial(model.textures.top);
            const front = await getMaterial(model.textures.front);
            const side = await getMaterial(model.textures.side);
            var materials = [side, side, top, top, front, side];
            return new THREE.Mesh(new THREE.BoxGeometry(), materials);
        },
        "block/cube_top":async()=>{
            const side = await getMaterial(model.textures.side);
            const top = await getMaterial(model.textures.top);
            var materials = [side, side, top, side, side, side];
            return new THREE.Mesh(new THREE.BoxGeometry(), materials);
        },
        "block/mangrove_roots":()=>mySwitch["block/cube_top"](),


        "block/slime_block":async()=>{
            const texture = await getMaterial(model.textures.texture);
            const geometry = BufferGeometryUtils.mergeGeometries([new THREE.BoxGeometry(10/16,10/16,10/16),new THREE.BoxGeometry()]);
            return new THREE.Mesh(geometry,texture);
        },
        "block/honey_block":async()=>{
            const down = await getMaterial(model.textures.down);
            const up = await getMaterial(model.textures.up);
            const side = await getMaterial(model.textures.side);
            const geometry = BufferGeometryUtils.mergeGeometries([new THREE.BoxGeometry(14/16,14/16,14/16),new THREE.BoxGeometry()]);
            geometry.groups = [
                {start:0 ,count:6*6,materialIndex:0 },{start:36,count:12,materialIndex:2 },
                {start:48,count:6,materialIndex:1 },{start:54,count:6,materialIndex:0 },
                {start:60,count:12,materialIndex:2}
            ];
            return new THREE.Mesh(geometry,[down,up,side]);
        },
        "block/crafting_table":async()=>{
            const down = await getMaterial(model.textures.down);
            const side = await getMaterial(model.textures.east);
            const front = await getMaterial(model.textures.north);
            const top = await getMaterial(model.textures.up);
            var materials = [side, front, top, down, front, side];
            return new THREE.Mesh(new THREE.BoxGeometry(), materials);
        },
        "block/cartography_table":async()=>{
            const down = await getMaterial(model.textures.down);
            const side1 = await getMaterial(model.textures.south);
            const side2 = await getMaterial(model.textures.west);
            const side3 = await getMaterial(model.textures.east);
            const top = await getMaterial(model.textures.up);
            var materials = [side3, side2, top, down, side3, side1];
            return new THREE.Mesh(new THREE.BoxGeometry(), materials);
        },
        "block/fletching_table":async()=>{
            const down = await getMaterial(model.textures.down);
            const side = await getMaterial(model.textures.east);
            const front = await getMaterial(model.textures.north);
            const top = await getMaterial(model.textures.up);
            var materials = [side, side, top, down, front, front];
            return new THREE.Mesh(new THREE.BoxGeometry(), materials);
        },
        "block/smithing_table":()=>mySwitch["block/fletching_table"](),// smithing table is identical to fletching table.
        "block/dried_kelp_block":async()=>{
            const up = await getMaterial(model.textures.up);
            const down = await getMaterial(model.textures.down);
            const side = await getMaterial(model.textures.north);
            var materials = [side, side, up, down, side, side];
            return new THREE.Mesh(new THREE.BoxGeometry(), materials);
        },
        "any":async()=>{

        }
    }
    var mesh = await mySwitch[model.path[0]]();
    if (variant.x!=null) mesh.rotation.x+=variant.x/180*Math.PI;
    if (variant.y!=null) mesh.rotation.y+=variant.y/180*Math.PI;
    if (variant.z!=null) mesh.rotation.z+=variant.z/180*Math.PI;
    return mesh;
}
//#endregion helpers

function setup() {
    setupThree();
    setupWebsocket();
    setupButtons();
    //add keyboard controls
    window.addEventListener("keydown", async function(e) {
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
            turtles[msg.index]=msg.data;
            turtles[msg.index].busy=false;
            if (turtleId==undefined) setScene(msg.index)
        } else if (msg.type == "disconnection") {
            delete turtles[msg.index];
            if (turtleId==msg.index) {turtleId=undefined;scene.clear();}
            
        } else if (msg.type == "return") {
            if (callbacks[msg.id]!=null) callbacks[msg.id](msg.return.map((el)=>el.split("|").join(":")));
        } else if (msg.type == "return") {
            scene.clear();
            turtles=[];
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
function saveState() {
    ws.send(JSON.stringify({"type":"save","index":turtleId,data:turtles[turtleId]}));
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
    scene.add(new THREE.AmbientLight(0x404040));
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth * 0.98, window.innerHeight * 0.98);
    renderer.domElement.tabindex=1;
    renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
    
    document.body.appendChild(renderer.domElement);
    controls = new OrbitControls(camera, renderer.domElement);
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
    object.position.set(...turtles[turtleId].pos);
    scene.add(object);
    sceneData.turtle.model = object;
    camera.position.set(...vec3Add(turtle.getPos(),[-2.8868,2.8868,2.8868]));
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
    if (worldData[x]==null)worldData[x]={};
    if (worldData[x][y]==null)worldData[x][y]={};
    const worldModels = sceneData.worldData;
    if (worldModels[x]==null)worldModels[x]=[];
    if (worldModels[x][y]==null)worldModels[x][y]=[];
    if (name!=null&&state!=null) {
        var cube = await getBlockMesh(name,state);
        if (worldModels[x][y][z]!=null) scene.remove(worldModels[x][y][z]);
        cube.position.set(...pos);
        scene.add(cube);
        worldData[x][y][z]={name,state};
        worldModels[x][y][z]=cube;
    } else {
        if (worldModels[x][y][z]!=null) scene.remove(worldModels[x][y][z]);
        worldData[x][y][z]=null;
        worldModels[x][y][z]=null;
    }
    turtles[turtleId].worldData=worldData;
    sceneData.worldData=worldModels;
}
//#endregion threejs

async function detect(recursive) {
    if (recursive!==true&&turtle.isBusy()) return;
    if (recursive!==true) turtle.setBusy(true);
    //detect up and set block if needed
    const upOutput = await turtle.actions.inspectUp();
    if (upOutput!=null) setBlock(vec3Add(turtle.getPos(),[0,1,0]),upOutput.name,upOutput.state);
    //detect down and set block if needed
    const downOutput = await turtle.actions.inspectDown();
    if (downOutput!=null) setBlock(vec3Add(turtle.getPos(),[0,-1,0]),downOutput.name,downOutput.state);
    //detect in each direction and set blocks if needed
    for (let i = 0; i < 4; i++) {
        const output = await turtle.actions.inspect();
        const pos=vec3Add(turtle.getPos(),turtle.getForward())
        if (output!=null) setBlock(pos,output.name,output.state);
        else setBlock(pos,null,null);
        await turtle.actions.turnRight(true);
    }
    saveState();
    if (recursive!==true) turtle.setBusy(false);
}
const turtle = window.turtle = {//window.turtle make is accessable from the console
    "get":()=>{ return turtles[turtleId]; },
    "isBusy":()=>{ return turtles[turtleId].busy; },
    "setBusy":(value)=>{ turtles[turtleId].busy=value; },

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
        controls.target.set(...turtlePos); controls.update();
    },
    "updatePos":()=>{ sceneData.turtle.model.position.set(...turtles[turtleId].pos); },
    "updateRot":()=>{ sceneData.turtle.model.rotation.y = -(Math.PI/2)*(turtles[turtleId].d+1); },
    "update":()=>{ turtle.updatePos();turtle.updateRot(); },
    "actions":{
        "turnLeft":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.turnLeft()");
            if (out[0]=="false") return;
            turtle.setRot((turtle.getRot()+3)%4);
            if (recursive!==true) turtle.setBusy(false);
        },
        "turnRight":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.turnRight()");
            if (out[0]=="false") return;
            turtle.setRot((turtle.getRot()+1)%4);
            if (recursive!==true) turtle.setBusy(false);
        },
        "up":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.up()");
            if (out[0]=="false") return;
            const pos = turtle.getPos();pos[1]++;
            turtle.setPos(pos);await detect(true);
            if (recursive!==true) turtle.setBusy(false);
        },
        "down":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.down()");
            if (out[0]=="false") return;
            const pos = turtle.getPos();pos[1]--;
            turtle.setPos(pos);await detect(true);
            if (recursive!==true) turtle.setBusy(false);
        },
        "forward":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.forward()");
            if (out[0]=="false") return;
            const pos=vec3Add(turtle.getPos(),turtle.getForward())
            turtle.setPos(pos);await detect(true);
            if (recursive!==true) turtle.setBusy(false);
        },
        "back":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.back()");
            if (out[0]=="false") return;
            const pos=vec3Add(turtle.getPos(),turtle.getBack())
            turtle.setPos(pos);await detect(true);
            if (recursive!==true) turtle.setBusy(false);
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
        const element = document.getElementById(key);
        if (element) element.addEventListener("click",value);
    }
}