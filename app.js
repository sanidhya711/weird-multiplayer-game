const express = require("express");
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

var players = {};

var timerStart,timerEnd,ping;

app.use(express.static("public"));

io.on('connection', socket => {

    setInterval(() => {
        timerStart =  Date.now();
        socket.emit("ping");
    },5000);

    socket.on("pong",()=>{
        timerEnd = Date.now();
        ping = Math.round((timerEnd - timerStart)/2);
        socket.emit("ping is maru maru",{ping:ping});
    });

    socket.on("joined",(data)=>{
        socket.emit("starting positions",players);
        socket.username = data.username;
        socket.broadcast.emit("new player joined",{username:data.username});
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
    });

});


app.get("/",(req,res)=>{
    res.sendFile(__dirname+"/index.html");
});

server.listen(process.env.PORT,()=>{
    console.log("server started on port "+process.env.PORT);
});