const express = require("express");
const socket = require("socket.io");
const http = require("http");

const app = express();
const PORT = 3000 || process.env.PORT;
const server = http.createServer(app);

// Set static folder
app.use(express.static("public"));

// Socket setup
const io = socket(server);

// Players array for legacy mode
let users = [];

// Room management
const rooms = new Map();
const images = ["../images/red_piece.png", "../images/blue_piece.png", "../images/yellow_piece.png", "../images/green_piece.png"];

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on("connection", (socket) => {
  console.log("Made socket connection", socket.id);

  // Legacy join for direct online play (without rooms)
  socket.on("join", (data) => {
    users.push(data);
    io.sockets.emit("join", data);
  });

  socket.on("joined", () => {
    socket.emit("joined", users);
  });

  // Room-based functionality
  socket.on("createRoom", (data) => {
    const roomCode = generateRoomCode();
    const room = {
      code: roomCode,
      host: socket.id,
      players: [{
        id: 0,
        name: data.name,
        pos: 0,
        img: images[0],
        socketId: socket.id
      }],
      gameStarted: false
    };
    
    rooms.set(roomCode, room);
    socket.join(roomCode);
    
    socket.emit("roomCreated", {
      roomCode: roomCode,
      players: room.players
    });
  });

  socket.on("joinRoom", (data) => {
    const room = rooms.get(data.roomCode);
    
    if (!room) {
      socket.emit("roomError", { message: "Room not found!" });
      return;
    }
    
    if (room.gameStarted) {
      socket.emit("roomError", { message: "Game already started!" });
      return;
    }
    
    if (room.players.length >= 4) {
      socket.emit("roomError", { message: "Room is full!" });
      return;
    }
    
    const player = {
      id: room.players.length,
      name: data.name,
      pos: 0,
      img: images[room.players.length],
      socketId: socket.id
    };
    
    room.players.push(player);
    socket.join(data.roomCode);
    
    socket.emit("roomJoined", {
      roomCode: data.roomCode,
      players: room.players
    });
    
    // Notify all players in room about the update
    io.to(data.roomCode).emit("roomPlayerUpdate", {
      players: room.players
    });
  });

  socket.on("startGame", (data) => {
    const room = rooms.get(data.roomCode);
    
    if (!room || room.host !== socket.id) {
      socket.emit("roomError", { message: "Only host can start the game!" });
      return;
    }
    
    if (room.players.length < 2) {
      socket.emit("roomError", { message: "Need at least 2 players to start!" });
      return;
    }
    
    room.gameStarted = true;
    
    // Assign current player (first player goes first)
    const currentPlayerId = 0;
    
    io.to(data.roomCode).emit("gameStarted", {
      players: room.players,
      currentPlayerId: currentPlayerId
    });
  });

  socket.on("rollDice", (data) => {
    if (data.roomCode) {
      // Room-based game
      const room = rooms.get(data.roomCode);
      if (room) {
        const player = room.players.find(p => p.id === data.id);
        if (player) {
          player.pos = data.pos;
          const turn = data.num != 6 ? (data.id + 1) % room.players.length : data.id;
          io.to(data.roomCode).emit("rollDice", data, turn);
        }
      }
    } else {
      // Legacy mode
      users[data.id].pos = data.pos;
      const turn = data.num != 6 ? (data.id + 1) % users.length : data.id;
      io.sockets.emit("rollDice", data, turn);
    }
  });

  socket.on("restart", (data) => {
    if (data && data.roomCode) {
      // Room-based restart
      const room = rooms.get(data.roomCode);
      if (room && room.host === socket.id) {
        rooms.delete(data.roomCode);
        io.to(data.roomCode).emit("restart");
      }
    } else {
      // Legacy restart
      users = [];
      io.sockets.emit("restart");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected", socket.id);
    
    // Remove from legacy users
    users = users.filter(user => user.socketId !== socket.id);
    
    // Handle room disconnections
    for (let [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        
        // If room is empty, delete it
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        } else {
          // If host left, assign new host
          if (room.host === socket.id && room.players.length > 0) {
            room.host = room.players[0].socketId;
          }
          
          // Reassign player IDs and images
          room.players.forEach((player, index) => {
            player.id = index;
            player.img = images[index];
          });
          
          // Notify remaining players
          io.to(roomCode).emit("roomPlayerUpdate", {
            players: room.players
          });
        }
        break;
      }
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
