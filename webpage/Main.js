/*
TODO:
    custom models for chests,shulkers,signs,and banners
    better controls
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
function xyzTovec3(threeVec3) {
    return [threeVec3.x,threeVec3.y,threeVec3.z];
}
function vec3Add(a,b) {
    return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
}
function vec3Sub(a,b) {
    return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
}
function vec3Div(a,b) {
    return [a[0]/b,a[1]/b,a[2]/b];
}
function vec3Mul(a,b) {
    return [a[0]*b,a[1]*b,a[2]*b];
}
async function objLoadAsync(model) {
    var loader = new OBJLoader();
    return new Promise((resolve)=>{
        loader.load(model, resolve);
    });
}
async function fetchJsonAsync(url) {
    return new Promise((resolve)=>{
        try {
            fetch(url, {}).then(async (response)=>{
                if (response==null||response.ok!=true||response.status==404) {resolve({});return;}
                response.json().then((json)=>{
                    resolve(json);
                }).catch((err)=>{resolve({});});
            }).catch((err)=>{resolve({});});
        } catch (err) {resolve({});return;}
    });
}
async function waitForImage(texture) {
    return new Promise(async (resolve)=>{
        while(true){
            if (texture.image!=null) resolve();
            await new Promise(r => setTimeout(r, 100));
        }
    })
}

//#region minecraft data getters
async function getBlockstate(name) {
    var tmp;
    tmp=name.includes(":")?name.split(":")[1]:name;//removes "minecraft:" from the beginning if needed
    return fetchJsonAsync("/blockstates/"+tmp+".json");
}
var modelCache=window.modelCache={};
async function getModelRecursive(name) {
    var tmp;
    tmp=name.includes(":")?name.split(":")[1]:name;//removes "minecraft:" from the beginning if needed
    if (modelCache[tmp]!=null) return modelCache[tmp];//returns a cached model
    const model = await fetchJsonAsync("/models/"+tmp+".json");
    //model.path=[tmp];
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
        //model.path=[...parentModel.path,...model.path];
    }
    modelCache[tmp]=model;
    return model;
}
var textureCache = {};
async function getMaterial(name) {
    var tmp;
    tmp=name.includes(":")?name.split(":")[1]:name;//removes "minecraft:" from the beginning if needed
    var texture;
    if (textureCache[tmp]!=null) texture=textureCache[tmp];//returns a cached model
    else {
        var textureTmp = await new THREE.TextureLoader().load("/textures/"+tmp+".png");
        textureTmp.magFilter = THREE.NearestFilter;// makes pixels not blurry
        fetchJsonAsync("/textures/"+tmp+".png.mcmeta").then(async(json)=>{
            if (json.animation==null) return;
            const numFrames = textureTmp.image.height/16;
            await waitForImage(textureTmp).then(()=>{
                const frametime=json.animation.frametime||1;
                textureTmp.repeat.y=1/numFrames; var frame=0;
                setInterval(() => {
                    textureTmp.center.y=frame/(numFrames-1);
                    frame=(frame+1)%numFrames;
                }, frametime*50);
            });
        });
        textureCache[tmp]=textureTmp;
        texture=textureTmp;
    }
    var material = await new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest:0.125 });
    material.toneMapped=false;
    return material;
}
async function variantToMesh(variant) {//generates a threejs mesh from a mincraft "variant" object
    if (variant.model==null) return new THREE.Mesh(new THREE.BoxGeometry(), defMaterial);
    const model = await getModelRecursive(variant.model);
    if (model.elements==null||model.elements.length==0) return new THREE.Mesh(new THREE.BoxGeometry(), defMaterial);

    var geometry;
    var groups = [];
    var materials = [null];
    var materialNames = [null];
    var uvs = [];

    const addMaterial = async(name)=>{
        if (materialNames.includes(name)) return materialNames.indexOf(name);
            //load texture and return index.
            var nameTmp = name;
            while(nameTmp.startsWith("#")) {nameTmp=model.textures[nameTmp.replace("#","")];}
            materials.push(await getMaterial(nameTmp));
            materialNames.push(name);
            return materials.length-1;
    }
    for (let i = 0; i < model.elements.length; i++) {
        const element = model.elements[i];
        const newGeometry = new THREE.BoxGeometry(...vec3Div(vec3Sub(element.to,element.from),16));
        if (element.rotation!=null) {
            if (element.rotation.axis=="x") {
                newGeometry.rotateX(element.rotation.angle/180*Math.PI);
                if (rotation.rescale==true) {var multiplier=Math.sin((90+element.rotation.angle)/180*Math.PI)*2;newGeometry.scale(1,multiplier,multiplier);}
            } else if (element.rotation.axis=="y") {
                newGeometry.rotateY(element.rotation.angle/180*Math.PI);var multiplier=Math.sin((90+element.rotation.angle)/180*Math.PI)*2;
                if (rotation.rescale==true) {var multiplier=Math.sin((90+element.rotation.angle)/180*Math.PI)*2;newGeometry.scale(multiplier,1,multiplier);}
            } else if (element.rotation.axis=="z") {
                newGeometry.rotateZ(element.rotation.angle/180*Math.PI);var multiplier=Math.sin((90+element.rotation.angle)/180*Math.PI)*2;
                if (rotation.rescale==true) {var multiplier=Math.sin((90+element.rotation.angle)/180*Math.PI)*2;newGeometry.scale(multiplier,multiplier,1);}
            }
        }
        newGeometry.translate(...vec3Div(vec3Sub(element.from,vec3Sub([8,8,8],vec3Div(vec3Sub(element.to,element.from),2))),16))// ( from-( 8-( ( to-from )/2 ) ) )/16

        const loadOrder = ["east","west","up","down","north","south"];
        for (let j = 0; j < loadOrder.length; j++) {
            const face = element.faces[loadOrder[j]];
            if (face!=null) {
                const index=await addMaterial(face.texture);
                groups.push({start:i*36+j*6 ,count:6,materialIndex:index });
                //get uvs from either position or defined uv
                var uv=face.uv;
                if (uv==null) {//uv is not defined
                    if (j==0||j==1) {uv=[element.from[2],16-element.to  [1],element.to[2],16-element.from[1]];}
                    else if (j==2||j==3) {uv=[element.from[0],   element.from[2],element.to[0],   element.to  [2]];}
                    else if (j==4||j==5) {uv=[element.from[0],16-element.to  [1],element.to[0],16-element.from[1]];}
                }
                uv=[uv[0],16-uv[1], uv[2],16-uv[3]];
                // [0,1, 1,1,  0,0,  1,0]
                uv=[uv[0],uv[1], uv[2],uv[1], uv[0],uv[3], uv[2],uv[3]];
                var rotation=face.rotation||0;// [0,1,  1,1,  0,0,  1,0] -> [0,0,  0,1,  1,0,  1,1] rotate clockwise
                for (let i = 0; i < rotation/90; i++) {
                    uv = [uv[4],uv[5], uv[0],uv[1], uv[6],uv[7], uv[2],uv[3]];
                }
                uvs.push(...uv.map((val)=>val/16));
            } else{ groups.push({start:i*36+j*6 ,count:6,materialIndex:0 });uvs.push( 0,16, 16,16,  0, 0, 16, 0) }
        }
        if (geometry!=null) geometry = BufferGeometryUtils.mergeGeometries([geometry,newGeometry]); else geometry = newGeometry;
    }
    if (geometry==null) return new THREE.Mesh(new THREE.BoxGeometry(), defMaterial);
    geometry.groups = groups;
    geometry.attributes.uv.set(uvs);
    var mesh = new THREE.Mesh(geometry, materials);

    if (variant.x!=null) mesh.rotation.x+=variant.x/180*Math.PI;
    if (variant.y!=null) mesh.rotation.y+=-variant.y/180*Math.PI;
    if (variant.z!=null) mesh.rotation.z+=variant.z/180*Math.PI;
    return mesh;
}
async function getBlockMesh(name,state) {
    var blockstate = await getBlockstate(name);
    if (blockstate.variants!=null) {
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
        if (variant==null||variant.model==null) return [new THREE.Mesh(new THREE.BoxGeometry(), defMaterial)];
        return [await variantToMesh(variant)];
    } else if (blockstate.multipart!=null) {
        //console.log("\""+name+"\"","multipart!");return [new THREE.Mesh(new THREE.BoxGeometry(), defMaterial)];
        var meshes = [];
        for (let i = 0; i < blockstate.multipart.length; i++) {
            const part = blockstate.multipart[i];
            var conditionMet=true;
            if (part.when!=null) {
                try {
                    if (part.when.OR!=null) {
                        var any = false;
                        for (let j = 0; j < part.when.OR.length; j++) {
                            const when = part.when.OR[j];
                            var orConditionMet=true;
                            const whenEntries = Object.entries(when);
                            for (let j = 0; j < whenEntries.length; j++) {
                                const [key,value] = whenEntries[j];
                                if (!value.split("|").includes(state[key])&&!value.split("|").includes(state[key].toString()))orConditionMet=false;
                            }
                            if (orConditionMet) {any=true;break;}
                        }
                        if (!any)conditionMet=false;
                    } else {
                        const whenEntries = Object.entries(part.when);
                        for (let j = 0; j < whenEntries.length; j++) {
                            const [key,value] = whenEntries[j];
                            if (!value.split("|").includes(state[key])&&!value.split("|").includes(state[key].toString()))conditionMet=false;
                        }
                    }
                } catch (error) {
                    console.log(error);
                    console.log(name,part.when,state);
                }
            }
            if (conditionMet) { var variant=part.apply;
                if ((typeof variant)=="object" && Array.isArray(variant)) variant = variant[Math.ceil(Math.random()*variant.length)-1];//pick random variant
                meshes.push(await variantToMesh(variant));
            }
        }
        return meshes;
    }else return [new THREE.Mesh(new THREE.BoxGeometry(), defMaterial)];
}
//#endregion minecraft data getters

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
        const turtleSelect = document.getElementById("turtleSelect");
        var msg = JSON.parse(e.data);
        if (msg.type == "connection") {
            turtles[msg.index]=msg.data;
            turtles[msg.index].busy=false;
            if (turtleId==undefined) setScene(msg.index);
            var option = document.createElement("option");
            option.value=option.innerText=turtles[msg.index].name;
            turtleSelect.appendChild(option);
        } else if (msg.type == "disconnection") {
            const options = turtleSelect.children
            for (let i = 0; i < options.length; i++) {
                const child = options[i];
                if (child.value==turtles[msg.index].name)
                {turtleSelect.removeChild(child);updateScene();break;}
            }
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
async function updateScene() {
    const turtleSelect = document.getElementById("turtleSelect");
    var value = turtleSelect.value;
    for (let i = 0; i < turtles.length; i++) {
        if (turtles[i].name==value) {
            if (!turtle.isBusy())setScene(i);//will only switch to another turtle when one is done being used
            else onNotBusy=()=>{setScene(i);};
            return;
        }
    }
    //none found
    scene.clear();
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
        const meshes = await getBlockMesh(name,state);
        const oldMeshes = worldModels[x][y][z];if (oldMeshes!=null) for (let i = 0; i < oldMeshes.length; i++) { scene.remove(oldMeshes[i]); }
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            mesh.position.set(...pos);
            scene.add(mesh);
        }
        worldData[x][y][z]={name,state};
        worldModels[x][y][z]=meshes;
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
var onNotBusy;
const turtle = window.turtle = {//window.turtle make is accessable from the console
    "get":()=>{ return turtles[turtleId]; },
    "isBusy":()=>{ return turtles[turtleId].busy; },
    "setBusy":(value)=>{ turtles[turtleId].busy=value;if(value==false&&onNotBusy!=null){onNotBusy();onNotBusy=null;} },

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
    "getCameraPos":()=>{ return xyzTovec3(camera.position); },
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
            if (out[0]=="false") {turtle.setBusy(false);return;}
            turtle.setRot((turtle.getRot()+3)%4);
            if (recursive!==true) turtle.setBusy(false);
        },
        "turnRight":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.turnRight()");
            if (out[0]=="false") {turtle.setBusy(false);return;}
            turtle.setRot((turtle.getRot()+1)%4);
            if (recursive!==true) turtle.setBusy(false);
        },
        "up":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.up()");
            if (out[0]=="false") {turtle.setBusy(false);return;}
            const pos = turtle.getPos();pos[1]++;
            turtle.setPos(pos);await detect(true);
            if (recursive!==true) turtle.setBusy(false);
        },
        "down":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.down()");
            if (out[0]=="false") {turtle.setBusy(false);return;}
            const pos = turtle.getPos();pos[1]--;
            turtle.setPos(pos);await detect(true);
            if (recursive!==true) turtle.setBusy(false);
        },
        "forward":async(recursive)=>{
            if (recursive!==true&&turtle.isBusy()) return;
            if (recursive!==true) turtle.setBusy(true);
            const out = await sendAsync("turtle.forward()");
            if (out[0]=="false") {turtle.setBusy(false);return;}
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
    const turtleSelect = document.getElementById("turtleSelect");
    turtleSelect.onchange=updateScene;
}