const express = require("express");
const path = require("path");
const http = require("http");
const PORT = process.env.PORT || 3000; //Only while deployment we can include port number in env file
const socketio = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// setting static folder as public
app.use(express.static(path.join(__dirname, "public")));

//start server
server.listen(PORT, () => {
  console.log("server running on port " + PORT);
});

// Handling two connections for Player 1 and Player 2
const connections = [null, null];
//Handling socket conn from client
io.on("connection", (socket) => {
  //socket is the actual client that is connected
  let playerIndex = -1;
  for (const i in connections) {
    if (connections[i] === null) {
      playerIndex = i;
      break; // if both are not null then its 3rd Player
    }
  }
  // tell client which player num are they
  socket.emit("player-number", playerIndex); //client will look for this name
  console.log("Player " + playerIndex + " has Connected ");
  //Ignore player 3
  if (playerIndex === -1) return;
  connections[playerIndex] = false; //player is present but not ready
  //Tell what player number connected
  socket.broadcast.emit("player-connection", playerIndex);

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`Player ${playerIndex} disconnected`);
    connections[playerIndex] = null;
    //tell everyone which player disconnected
    socket.broadcast.emit("player-connection", playerIndex);
  });
  
  //On ready
  socket.on("player-ready", () => {
    socket.broadcast.emit('enemy-ready',playerIndex);
    connections[playerIndex] =  true;
  });

  // Check player connections
  socket.on('check-players', () => {
    const players = []
    //creating array to check status of other players. 
    //looping through connections if player is null not connected , if connected its true/false for ready.
    for (const i in connections) {
      connections[i] === null ? players.push({connected: false, ready: false}) : players.push({connected: true, ready: connections[i]})
    }
    //sending back the array through the same socket
    socket.emit('check-players', players);
  })

    // On grab Received
    socket.on('grab', id => {
      console.log(`Cheese Grabbed from ${playerIndex}`, id)
      // Emit the move to the other player
      socket.broadcast.emit('grab', id)
    })
    // on grab Reply
    socket.on('grab-reply', square => {
    console.log(square)
    // Forward the reply to the other player
    socket.broadcast.emit('grab-reply', square)
  })

  // Timeout connection 
  setTimeout(() => {
    connections[playerIndex] = null
    socket.emit('timeout')
    socket.disconnect()
  }, 600000) // 10 minute limit per player
  
});
