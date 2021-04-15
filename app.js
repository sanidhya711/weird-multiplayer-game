const express = require("express");
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

var players = {};
var ping = {};

app.use(express.static("public"));

io.on('connection', socket => {

    socket.on("pong",()=>{
        ping[socket.username].timerEnd = Date.now();
        ping[socket.username].ping = Math.round((ping[socket.username].timerEnd - ping[socket.username].timerStart)/2);
        socket.emit("ping is maru maru",{ping:ping[socket.username].ping});
    });

    socket.on("joined",(data)=>{
        socket.emit("starting positions",players);
        socket.username = data.username;
        ping[socket.username] = {
            timerStart: null,
            timerEnd: null,
            ping: null
        }
        socket.broadcast.emit("new player joined",{username:data.username});
        ping[socket.username].timerStart =  Date.now();
        socket.emit("ping");
        setInterval(() => {
            ping[socket.username].timerStart =  Date.now();
            socket.emit("ping");
        },5000);
    });

    socket.on('tick',(data)=>{
        socket.broadcast.emit("tick",{position:data.position,rotation:data.rotation,username:socket.username});
        players[socket.username] = {
            position:data.position,
            rotation:data.rotation,
            username:socket.username
        }
    });

    socket.on("jump",()=>{
        socket.broadcast.emit("jumped",{username:socket.username});
    });

    socket.on("crouch",()=>{
        socket.broadcast.emit("crouched",{username:socket.username});
    });

    socket.on("stand",()=>{
        socket.broadcast.emit("stood",{username:socket.username});
    });

    socket.on('disconnect',() => {
        socket.broadcast.emit("player disconnected",{username:socket.username});
        delete players[socket.username];
        delete ping[socket.username];
    });

});


app.get("/",(req,res)=>{
    res.sendFile(__dirname+"/index.html");
});

server.listen(process.env.PORT,()=>{
    console.log("server running");
});