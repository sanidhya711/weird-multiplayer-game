import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/PointerLockControls.js';
import { FBXLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/FBXLoader';

const socket = io();
var players = {};
var playerMeshes = [];

var moveSpeed = 0.7;

var scene,camera,renderer,controls,clock,raycaster;

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
    controls = new PointerLockControls(camera,document.body);
    controls.maxPolarAngle = Math.PI/2 + 0.2;
    controls.minPolarAngle = Math.PI/2 - 0.2;
    raycaster = new THREE.Raycaster();
    // raycaster.layers.set(20);
    clock = new THREE.Clock();
}

function addFloor(){
    var floorGeometry = new THREE.PlaneGeometry(1000,1090);
    var floorMaterial = new THREE.MeshBasicMaterial({side:THREE.DoubleSide,color:0xFF00FF});
    var floor = new THREE.Mesh(floorGeometry,floorMaterial);
    floor.rotation.x = Math.PI/2;
    scene.add(floor);
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
    const intersects = raycaster.intersectObjects(playerMeshes,true);
    console.log(intersects);
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
});
window.addEventListener("keyup",function(eve){
    keyboard[eve.key] = false;
});


document.addEventListener("click",()=>{
    controls.lock();
});

class Player{
    constructor(position,rotation){
        this.loader = new FBXLoader();
        this.loader.load("/erika_archer.fbx",(archer)=>{
            this.archer = archer;
            this.archer.scale.setScalar(0.1);
            this.archer.position.copy(position);
            this.archer.position.y = 0;
            this.archer.rotation.copy(rotation);
            scene.add(this.archer);
            playerMeshes.push(this.archer);

            this.animLoader = new FBXLoader();
            this.mixer = new THREE.AnimationMixer(archer);
            //walk
            this.animLoader.load("Standard Walk.fbx",(anim)=>{
                this.walk = this.mixer.clipAction(anim.animations[0]);
            });
            //idle
            this.animLoader.load("idle.fbx",(anim)=>{
                this.idle = this.mixer.clipAction(anim.animations[0]);
                this.idle.play();
            });
        });
    }

    copy(data){
        if(this.archer){
        //     data.position.y = 0;
        //     if(!this.archer.position.equals(data.position)){
        //         if(this.walk && this.idle){
        //             this.idle.crossFadeFrom(this.walk,1);
        //             this.idle.play();
        //         }
                
        //     }else{
        //         if(this.walk && this.idle){
        //             this.walk.crossFadeFrom(this.idle,1);
        //             this.walk.play();
        //         }
        //     }
            this.archer.position.copy(data.position);
            this.archer.rotation.copy(data.rotation);
            this.archer.position.y = 0;
            this.archer.rotateY(Math.PI);
        }
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
    players[data.username] = new Player(new THREE.Vector3(), new THREE.Euler());
});

socket.on('player disconnected',(data)=>{
    players[data.username].remove();
    delete players[data.username];
});

socket.on('tick',(data)=>{
    players[data.username].copy(data);
});

socket.on("starting positions",(data)=>{
    for(const player in data){
        players[data[player].username] = new Player(data[player].position,data[player].rotation);
    }
});

function resize(){
    renderer.setSize(window.innerWidth,window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
}

window.addEventListener("resize",resize);