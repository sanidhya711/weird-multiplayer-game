const express = require("express");
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

var usernames = 1;
var players = {};

app.use(express.static("public"));

io.on('connection', socket => {

    socket.emit("starting positions",players);

    socket.username = usernames;
    usernames++;

    socket.broadcast.emit("new player joined",{username:socket.username});

    socket.on('tick',(data)=>{
        socket.broadcast.emit("tick",{position:data.position,rotation:data.rotation,username:socket.username});
        players[socket.username] = {
            position:data.position,
            rotation:data.rotation,
            username:socket.username
        }
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