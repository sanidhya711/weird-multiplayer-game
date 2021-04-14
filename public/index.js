import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/PointerLockControls.js';
import { FBXLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/FBXLoader';

const socket = io();

var players = {};
var playerMeshes = [];

var moveSpeed = 0.7;

var scene,camera,renderer,controls,clock,raycaster;

var fontGlobal,textMaterial,previousText,textMesh;

var jumpAnimationRunning = false, crouched = false;

var keyboard = {
    w:false,
    a:false,
    s:false,
    d:false
}

function init(){
    camera = new THREE.PerspectiveCamera(65,window.innerWidth/window.innerHeight,0.1,10000);
    camera.position.z = 20;
    camera.position.y = 16;
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth,window.innerHeight);
    renderer.setClearColor(0x0000FF);
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000,500,1000);
    controls = new PointerLockControls(camera,document.body);
    controls.maxPolarAngle = Math.PI/2 + 0.2;
    controls.minPolarAngle = Math.PI/2 - 0.2;
    raycaster = new THREE.Raycaster();
    clock = new THREE.Clock();

    const fontLoader = new THREE.FontLoader();
    fontLoader.load('Lato/Lato_Regular.json',function(font){
        fontGlobal = font;
        textMaterial = new THREE.MeshBasicMaterial({side:THREE.DoubleSide,color:'green'});
    });
}

function addFloor(){
    var textureLoader = new THREE.TextureLoader();
    textureLoader.load("/floor.jpg",(floorTexture)=>{
        floorTexture.wrapS = THREE.RepeatWrapping;
        floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(70,70);
        var floorGeometry = new THREE.PlaneGeometry(1000,1000);
        var floorMaterial = new THREE.MeshBasicMaterial({side:THREE.DoubleSide,map:floorTexture});
        var floor = new THREE.Mesh(floorGeometry,floorMaterial);
        floor.rotation.x = Math.PI/2;
        scene.add(floor);
    });
}

function addLights(){
    var light = new THREE.AmbientLight(0xFFFFFF,1);
    scene.add(light);
}

function moveHandler(){
    if(keyboard["w"]){
        controls.moveForward(moveSpeed);
    }
    if(keyboard["a"]){
        controls.moveRight(-1*moveSpeed);
    }
    if(keyboard["s"]){
        controls.moveForward(-1*moveSpeed);
    }
    if(keyboard["d"]){
        controls.moveRight(moveSpeed);
    }
}

function handleRaycaster(){
    const pointer = new THREE.Vector2();
    pointer.x = 0.5 * 2 - 1;
	pointer.y = -1 * 0.5 * 2 + 1;
    raycaster.setFromCamera(pointer,camera);
    const intersects = raycaster.intersectObjects(playerMeshes,true)[0];
    if(intersects && intersects.distance < 50){
        var parent = intersects.object;
        while(parent.parent && !parent.parent.autoUpdate){
            parent = parent.parent;
        }   

        var username = parent.name;
        username = username.toString();

        if(previousText == username){
            textMesh.visible = true;
        }else{
            const textGeometry = new THREE.TextGeometry(username,{
                font: fontGlobal,
                size: 2.5,
                height: 0.125,
            });
            scene.remove(textMesh);
            textMesh = new THREE.Mesh(textGeometry,textMaterial);
            scene.add(textMesh);
        }
        textMesh.position.copy(parent.position);
        textMesh.position.y = 20;
        textMesh.lookAt(camera.position);
        textMesh.translateX(-2.2);
        previousText = username;
    }else{
        if(textMesh){
            textMesh.visible = false;
        }
    }
}

function render(){
    socket.emit("tick",{position:camera.position,rotation:camera.rotation});
    moveHandler();
    handleRaycaster();

    var delta = clock.getDelta();
    for(const player in players){
        players[player].update(delta);
    }

    renderer.render(scene,camera);
    requestAnimationFrame(render);
}

window.addEventListener("keydown",function(eve){
    if(eve.key=="w" || eve.key == "a" || eve.key=="s" || eve.key=="d"){
        keyboard[eve.key] = true;
    }
    if(eve.key == " "){
        if(!jumpAnimationRunning){
            socket.emit("jump");
            jumpAnimationRunning = true;
            setTimeout(() => {
                jumpAnimationRunning = false;
            },2000);
        }
    }
    if(eve.key == "Shift"){
        if(!crouched){
            crouched = true;
            socket.emit("crouch");
        }
    }
});

window.addEventListener("keyup",function(eve){
    if(eve.key=="w" || eve.key == "a" || eve.key=="s" || eve.key=="d"){
        keyboard[eve.key] = false;
    }
    if(eve.key == "Shift"){
        crouched = false;
        socket.emit("stand");
    }
});


document.addEventListener("click",()=>{
    controls.lock();
});

class Player{
    constructor(position,rotation,username){
        this.loader = new FBXLoader();
        this.loader.load("/characters/erika_archer.fbx",(archer)=>{
            this.archer = archer;
            this.archer.scale.setScalar(0.1);
            this.archer.position.copy(position);
            this.archer.position.y = 0;
            this.archer.rotation.copy(rotation);
            scene.add(this.archer);
            playerMeshes.push(this.archer);
            this.archer.name = username;
            this.animLoader = new FBXLoader();
            this.mixer = new THREE.AnimationMixer(archer);
            //walk
            this.animLoader.load("/animations/Standard Walk.fbx",(anim)=>{
                console.log("walk animation loaded");
                this.walk = this.mixer.clipAction(anim.animations[0]);
            });
            //idle
            this.animLoader.load("/animations/idle.fbx",(anim)=>{
                console.log("idle animation loaded");
                this.idle = this.mixer.clipAction(anim.animations[0]);
                this.idle.play();
            });

            this.animLoader.load("/animations/jumping.fbx",(anim)=>{
                console.log("jumping animation loaded");
                this.jump = this.mixer.clipAction(anim.animations[0]);
                this.jump.loop = THREE.LoopOnce;
            });

            this.animLoader.load("/animations/Standing to Crouch.fbx",(anim)=>{
                console.log("crouching animation loaded");
                this.crouch = this.mixer.clipAction(anim.animations[0]);
                this.crouch.loop = THREE.LoopOnce;
                this.crouch.clampWhenFinished = true;
            });

            this.animLoader.load("/animations/Crouch to Standing.fbx",(anim)=>{
                console.log("crouching animation loaded");
                this.stand = this.mixer.clipAction(anim.animations[0]);
                this.stand.loop = THREE.LoopOnce;
                this.stand.clampWhenFinished = true;
            });
        });
    }

    copy(data){
        if(this.archer){
            data.position.y = 0;
            if(!this.archer.position.equals(data.position)){
                if(this.walk && this.idle){
                    this.walk.play()
                    this.idle.stop();
                }
            }else{
                if(this.walk && this.idle){
                    this.walk.stop();
                    this.idle.play();
                }
            }
            this.archer.position.copy(data.position);
            this.archer.rotation.copy(data.rotation);
            this.archer.position.y = 0;
            this.archer.rotateY(Math.PI);
        }
    }

    jumped(){
        this.jump.stop();
        this.jump.play();
    }

    crouched(){
        this.crouch.stop();
        this.crouch.play();
    }

    stood(){
        this.crouch.stop();
        this.stand.stop();
        this.stand.play();
    }

    update(delta){
        if(this.mixer){
            this.mixer.update(delta);
        }
    }

    remove(){
        scene.remove(this.archer);
    }
}

init();
addFloor();
addLights();
render();

socket.on('new player joined',(data)=>{
    players[data.username] = new Player(new THREE.Vector3(), new THREE.Euler(),data.username);
});

socket.on('player disconnected',(data)=>{
    players[data.username].remove();
    delete players[data.username];

    playerMeshes.forEach((playerMesh)=>{
        if(playerMesh.name == data.username){
            var index = playerMeshes.indexOf(playerMesh);
            playerMeshes.splice(index,1);
        }
    });
});

socket.on('tick',(data)=>{
    players[data.username].copy(data);
});

socket.on("starting positions",(data)=>{
    for(const player in data){
        players[data[player].username] = new Player(data[player].position,data[player].rotation,data[player].username);
    }
});

socket.on("jumped",(data)=>{
    players[data.username].jumped();
});

socket.on("crouched",(data)=>{
    players[data.username].crouched();
});

socket.on("stood",(data)=>{
    players[data.username].stood();
});

function resize(){
    renderer.setSize(window.innerWidth,window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
}

window.addEventListener("resize",resize);