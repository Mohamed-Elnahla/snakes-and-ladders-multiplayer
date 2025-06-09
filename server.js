const express = require("express");
const socket = require("socket.io");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Set static folder
app.use(express.static("public"));

// Add basic error handling
app.use((err, req, res, next) => {
  console.error('Express error:', err.stack);
  res.status(500).send('Something broke!');
});

// Socket setup
const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

console.log('Server starting up...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', PORT);

// Players array for legacy mode
let users = [];

// Room management
const rooms = new Map();
const images = ["../images/red_piece.png", "../images/blue_piece.png", "../images/yellow_piece.png", "../images/green_piece.png"];

function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (rooms.has(code)); // Ensure uniqueness
  return code;
}

io.on("connection", (socket) => {
  console.log("Made socket connection", socket.id);

  // Add error handling for socket events
  socket.on('error', (error) => {
    console.error('Socket error for', socket.id, ':', error);
  });

  // Legacy join for direct online play (without rooms)
  socket.on("join", (data) => {
    users.push(data);
    io.sockets.emit("join", data);
  });

  socket.on("joined", () => {
    socket.emit("joined", users);
  });  // Room-based functionality
  socket.on("createRoom", (data) => {
    try {
      console.log("Creating room for player:", data.name);
      
      if (!data || !data.name || typeof data.name !== 'string' || data.name.trim() === '') {
        socket.emit("roomError", { message: "Invalid player name!" });
        return;
      }
      
      const roomCode = generateRoomCode();
      const room = {
        code: roomCode,
        host: socket.id,
        players: [{
          id: 0,
          name: data.name.trim(),
          pos: 0,
          img: images[0],
          socketId: socket.id
        }],
        gameStarted: false
      };
      
      rooms.set(roomCode, room);
      socket.join(roomCode);
      
      console.log("Room created:", roomCode, "Total rooms:", rooms.size);
      
      socket.emit("roomCreated", {
        roomCode: roomCode,
        players: room.players
      });
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("roomError", { message: "Failed to create room. Please try again." });
    }
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
    
    // Initialize current turn (first player goes first)
    room.currentTurn = 0;
    
    io.to(data.roomCode).emit("gameStarted", {
      players: room.players,
      currentPlayerId: 0
    });
  });  socket.on("rollDice", (data) => {
    if (data.roomCode) {
      // Room-based game
      const room = rooms.get(data.roomCode);
      if (room && room.gameStarted) {
        const player = room.players.find(p => p.id === data.id);
        if (player) {
          // Validate it's actually this player's turn
          if (room.currentTurn !== data.id) {
            socket.emit("roomError", { message: "It's not your turn!" });
            return;
          }
          
          // Update player position on server
          player.pos = data.pos;
          
          // Check if this player won
          let winner = null;
          if (player.pos >= 99) {
            winner = player;
            // Game is over, don't calculate next turn
          }
          
          // Calculate next turn only if no winner
          let nextTurn = room.currentTurn;
          if (!winner) {
            nextTurn = data.num !== 6 ? (data.id + 1) % room.players.length : data.id;
            room.currentTurn = nextTurn;
          }
          
          // Broadcast to all players in room with updated game state
          io.to(data.roomCode).emit("rollDice", {
            ...data,
            players: room.players, // Include updated player positions
            winner: winner
          }, nextTurn);
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Server ready to accept connections');
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error('Server error:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
