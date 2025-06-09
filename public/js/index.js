// Making Connection
const socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000
});

// Add connection debugging
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  // Show connection status
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    statusElement.textContent = 'Connected';
    statusElement.style.color = 'green';
  }
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from server. Reason:', reason);
  // Show disconnection status
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    statusElement.textContent = 'Disconnected';
    statusElement.style.color = 'red';
  }
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Show connection error
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    statusElement.textContent = 'Connection Error';
    statusElement.style.color = 'orange';
  }
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnecting', (attemptNumber) => {
  console.log('Reconnection attempt', attemptNumber);
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    statusElement.textContent = `Reconnecting... (${attemptNumber})`;
    statusElement.style.color = 'orange';
  }
});

let players = []; // All players in the game
let currentPlayer; // Player object for individual players
let gameMode = null; // 'same-device' or 'online'
let currentTurn = 0; // For same device mode
let roomCode = null;
let isHost = false;

// Modal elements
const modalOverlay = document.getElementById('modal-overlay');
const modeSelection = document.getElementById('mode-selection');
const sameDeviceSetup = document.getElementById('same-device-setup');
const onlineOptions = document.getElementById('online-options');
const createRoom = document.getElementById('create-room');
const joinRoom = document.getElementById('join-room');
const gameInterface = document.getElementById('game-interface');

// Initialize modal system
window.addEventListener('load', () => {
  showModal('mode-selection');
});

function showModal(modalId) {
  // Hide all modal contents
  document.querySelectorAll('.modal-content').forEach(content => {
    content.style.display = 'none';
  });
  
  // Show specific modal content
  document.getElementById(modalId).style.display = 'block';
  modalOverlay.style.display = 'flex';
}

function hideModal() {
  modalOverlay.style.display = 'none';
  gameInterface.hidden = false;
}

// Mode selection handlers
document.getElementById('same-device-btn').addEventListener('click', () => {
  gameMode = 'same-device';
  showModal('same-device-setup');
});

document.getElementById('online-btn').addEventListener('click', () => {
  gameMode = 'online';
  showModal('online-options');
  socket.emit("joined");
});

// Same device setup handlers
let sameDevicePlayers = [];

document.getElementById('add-player-btn').addEventListener('click', () => {
  const nameInput = document.getElementById('player-name-input');
  const name = nameInput.value.trim();
  
  if (name && sameDevicePlayers.length < 4) {
    sameDevicePlayers.push({
      name: name,
      pos: 0,
      img: images[sameDevicePlayers.length]
    });
    
    updateSameDevicePlayersList();
    nameInput.value = '';
    
    // Enable start button if at least 2 players
    document.getElementById('start-same-device-btn').disabled = sameDevicePlayers.length < 2;
  }
});

function updateSameDevicePlayersList() {
  const playersList = document.getElementById('players-ul');
  playersList.innerHTML = '';
  
  sameDevicePlayers.forEach((player, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${player.name}</span>
      <button class="remove-player" onclick="removeSameDevicePlayer(${index})">Remove</button>
    `;
    playersList.appendChild(li);
  });
}

function removeSameDevicePlayer(index) {
  sameDevicePlayers.splice(index, 1);
  // Reassign images
  sameDevicePlayers.forEach((player, i) => {
    player.img = images[i];
  });
  updateSameDevicePlayersList();
  document.getElementById('start-same-device-btn').disabled = sameDevicePlayers.length < 2;
}

// Global function for removing players (needed for onclick handler)
window.removeSameDevicePlayer = removeSameDevicePlayer;

document.getElementById('start-same-device-btn').addEventListener('click', () => {
  // Shuffle players randomly
  for (let i = sameDevicePlayers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sameDevicePlayers[i], sameDevicePlayers[j]] = [sameDevicePlayers[j], sameDevicePlayers[i]];
  }
  
  // Reassign images and IDs after shuffling
  sameDevicePlayers.forEach((player, index) => {
    player.id = index;
    player.img = images[index];
  });
  
  players = sameDevicePlayers.map(p => new Player(p.id, p.name, p.pos, p.img));
  currentTurn = 0;
  
  hideModal();
  initializeSameDeviceGame();
});

function initializeSameDeviceGame() {
  setupCanvas();
  
  // Hide online-specific elements
  document.getElementById('name').style.display = 'none';
  document.getElementById('start-btn').style.display = 'none';
  document.getElementById('players-box').querySelector('h3').textContent = 'Players:';
  
  // Show game elements
  document.getElementById('roll-button').hidden = false;
  
  // Update current player display
  document.getElementById('current-player').innerHTML = `<p>It's ${players[currentTurn].name}'s turn</p>`;
  
  // Update players table
  updatePlayersTable();
  drawPins();
}

function setupCanvas() {
  initializeCanvas();
}

function updatePlayersTable() {
  const table = document.getElementById('players-table');
  table.innerHTML = '';
  
  players.forEach((player, index) => {
    const isCurrentPlayer = (gameMode === 'same-device' && index === currentTurn);
    const row = table.insertRow();
    row.innerHTML = `
      <td style="${isCurrentPlayer ? 'font-weight: bold; color: #ffe593;' : ''}">${player.name}</td>
      <td><img src="${player.img}" height="40" width="30"></td>
    `;
  });
}

// Back button handlers
document.getElementById('back-from-same-device-btn').addEventListener('click', () => {
  sameDevicePlayers = [];
  updateSameDevicePlayersList();
  document.getElementById('start-same-device-btn').disabled = true;
  showModal('mode-selection');
});

document.getElementById('back-from-online-btn').addEventListener('click', () => {
  showModal('mode-selection');
});

// Online game handlers
document.getElementById('create-room-btn').addEventListener('click', () => {
  showModal('create-room');
});

document.getElementById('join-room-btn').addEventListener('click', () => {
  showModal('join-room');
});

document.getElementById('create-room-confirm-btn').addEventListener('click', () => {
  const hostName = document.getElementById('host-name-input').value.trim();
  if (hostName) {
    console.log('Creating room for:', hostName);
    isHost = true;
    socket.emit('createRoom', { name: hostName });
  } else {
    alert('Please enter your name');
  }
});

document.getElementById('join-room-confirm-btn').addEventListener('click', () => {
  const joinName = document.getElementById('join-name-input').value.trim();
  const roomCodeInput = document.getElementById('room-code-input').value.trim();
  
  if (joinName && roomCodeInput) {
    socket.emit('joinRoom', { name: joinName, roomCode: roomCodeInput });
  }
});

document.getElementById('start-online-game-btn').addEventListener('click', () => {
  socket.emit('startGame', { roomCode });
});

// Back buttons for room creation/joining
document.getElementById('back-from-create-btn').addEventListener('click', () => {
  showModal('online-options');
});

document.getElementById('back-from-join-btn').addEventListener('click', () => {
  showModal('online-options');
});

let canvas;
let ctx;
let side, offsetX, offsetY;

// Initialize canvas after the game interface is shown
function initializeCanvas() {
  canvas = document.getElementById("canvas");
  if (canvas) {
    canvas.width = document.documentElement.clientHeight * 0.9;
    canvas.height = document.documentElement.clientHeight * 0.9;
    ctx = canvas.getContext("2d");
    
    // Calculate board dimensions
    side = canvas.width / 10;
    offsetX = side / 2;
    offsetY = side / 2 + 20;
  }
}

const redPieceImg = "../images/red_piece.png";
const bluePieceImg = "../images/blue_piece.png";
const yellowPieceImg = "../images/yellow_piece.png";
const greenPieceImg = "../images/green_piece.png";

const images = [redPieceImg, bluePieceImg, yellowPieceImg, greenPieceImg];

const ladders = [
  [2, 23],
  [4, 68],
  [6, 45],
  [20, 59],
  [30, 96],
  [52, 72],
  [57, 96],
  [71, 92],
];

const snakes = [
  [98, 40],
  [84, 58],
  [87, 49],
  [73, 15],
  [56, 8],
  [50, 5],
  [43, 17],
];

class Player {
  constructor(id, name, pos, img) {
    this.id = id;
    this.name = name;
    this.pos = pos;
    this.img = img;
    this.isAnimating = false;
    this.animationPos = pos; // Current visual position during animation
    this.isStepMoving = false; // True during step-by-step movement, false during ladder/snake
  }
  // Calculate x,y coordinates for a given position
  getCoordinates(position) {
    let xPos =
      Math.floor(position / 10) % 2 == 0
        ? (position % 10) * side - 15 + offsetX
        : canvas.width - ((position % 10) * side + offsetX + 15);
    let yPos = canvas.height - (Math.floor(position / 10) * side + offsetY);
    
    // Offset players slightly if multiple players are on the same square
    const playersOnSameSquare = players.filter(p => 
      Math.floor(p.animationPos) === Math.floor(position) && p.id !== this.id
    );
    
    if (playersOnSameSquare.length > 0) {
      const offset = (this.id % 4) * 8; // Spread players by 8 pixels
      xPos += offset - 12; // Center the spread
    }
    
    return { x: xPos, y: yPos };
  }
  draw() {
    const coords = this.getCoordinates(this.animationPos);
    let image = new Image();
    image.src = this.img;
    
    // Add a subtle bounce effect only during step movement
    let bounceOffset = 0;
    if (this.isAnimating && this.isStepMoving) {
      bounceOffset = Math.sin(Date.now() * 0.01) * 2; // Small bounce
    }
    
    ctx.drawImage(image, coords.x, coords.y + bounceOffset, 30, 40);
  }// Animate movement step by step
  async animateMovement(steps) {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    const startPos = this.pos;
    const endPos = Math.min(this.pos + steps, 99);
    
    // Disable roll button during animation
    document.getElementById("roll-button").disabled = true;
    
    // Show animation status
    const statusElement = document.getElementById("animation-status");
    if (statusElement) {
      statusElement.style.display = 'block';
      statusElement.textContent = `${this.name} is moving...`;
    }
    
    // Step-by-step movement animation
    for (let i = startPos + 1; i <= endPos; i++) {
      this.animationPos = i;
      drawPins();
      
      // Add step sound feedback (visual feedback via dice highlight)
      this.flashDice();
      
      await this.delay(300); // 300ms per step
    }
    
    this.pos = endPos;
    
    // Check for ladder or snake
    const newPos = this.isLadderOrSnake(this.pos + 1) - 1;
    if (newPos !== this.pos) {
      // Animate ladder/snake movement
      const isLadder = newPos > this.pos;
      if (statusElement) {
        statusElement.textContent = isLadder ? 
          `${this.name} is climbing a ladder! 🪜` : 
          `${this.name} is sliding down a snake! 🐍`;
      }
      await this.animateLadderOrSnake(this.pos, newPos);
      this.pos = newPos;
    }
    
    this.animationPos = this.pos;
    this.isAnimating = false;
    
    // Hide animation status
    if (statusElement) {
      statusElement.style.display = 'none';
    }
    
    // Re-enable roll button
    document.getElementById("roll-button").disabled = false;
    
    drawPins();
  }

  // Visual feedback for movement steps
  flashDice() {
    const diceElement = document.getElementById("dice");
    if (diceElement) {
      diceElement.style.filter = 'brightness(1.5)';
      setTimeout(() => {
        diceElement.style.filter = 'brightness(1)';
      }, 150);
    }
  }
  // Animate ladder climbing or snake sliding
  async animateLadderOrSnake(fromPos, toPos) {
    const isLadder = toPos > fromPos;
    const distance = Math.abs(toPos - fromPos);
    const steps = Math.min(distance, 8); // Maximum 8 animation steps
    const stepDelay = isLadder ? 200 : 120; // Slower for ladders, faster for snakes
    
    // Show climbing/sliding effect with intermediate positions
    for (let i = 1; i <= steps; i++) {
      const progress = i / steps;
      
      // Use easing for more natural movement
      const easedProgress = isLadder ? 
        this.easeOutQuad(progress) : // Slower at the end for ladders
        this.easeInQuad(progress);   // Faster at the end for snakes
      
      const currentPos = fromPos + (toPos - fromPos) * easedProgress;
      this.animationPos = Math.round(currentPos);
      drawPins();
      await this.delay(stepDelay);
    }
    
    this.animationPos = toPos;
    drawPins();
    await this.delay(300); // Brief pause at the end
  }

  // Easing functions for smooth animation
  easeOutQuad(t) {
    return t * (2 - t);
  }

  easeInQuad(t) {
    return t * t;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updatePos(num) {
    // This method is now only used for immediate position updates (like restart)
    if (this.pos + num <= 99) {
      this.pos += num;
      this.pos = this.isLadderOrSnake(this.pos + 1) - 1;
      this.animationPos = this.pos;
    }
  }

  isLadderOrSnake(pos) {
    let newPos = pos;

    for (let i = 0; i < ladders.length; i++) {
      if (ladders[i][0] == pos) {
        newPos = ladders[i][1];
        break;
      }
    }

    for (let i = 0; i < snakes.length; i++) {
      if (snakes[i][0] == pos) {
        newPos = snakes[i][1];
        break;
      }
    }

    return newPos;
  }
}

document.getElementById("start-btn").addEventListener("click", () => {
  const name = document.getElementById("name").value;
  document.getElementById("name").disabled = true;
  document.getElementById("start-btn").hidden = true;
  document.getElementById("roll-button").hidden = false;
  currentPlayer = new Player(players.length, name, 0, images[players.length]);
  document.getElementById(
    "current-player"
  ).innerHTML = `<p>Anyone can roll</p>`;
  socket.emit("join", currentPlayer);
});

document.getElementById("roll-button").addEventListener("click", async () => {
  const num = rollDice();
  
  if (gameMode === 'same-device') {
    // Same device mode
    document.getElementById("dice").src = `./images/dice/dice${num}.png`;
    
    // Animate the current player's movement
    await players[currentTurn].animateMovement(num);
    
    // Check for winner
    if (players[currentTurn].pos == 99) {
      document.getElementById("current-player").innerHTML = `<p>${players[currentTurn].name} has won!</p>`;
      document.getElementById("roll-button").hidden = true;
      document.getElementById("dice").hidden = true;
      document.getElementById("restart-btn").hidden = false;
      return;
    }
    
    // Move to next player (only if didn't roll 6)
    if (num !== 6) {
      currentTurn = (currentTurn + 1) % players.length;
    }
    
    document.getElementById("current-player").innerHTML = `<p>It's ${players[currentTurn].name}'s turn</p>`;
    updatePlayersTable();
  } else {
    // Online mode - animate current player's movement
    await currentPlayer.animateMovement(num);
    socket.emit("rollDice", {
      num: num,
      id: currentPlayer.id,
      pos: currentPlayer.pos,
      roomCode: roomCode
    });
  }
});

function rollDice() {
  const number = Math.ceil(Math.random() * 6);
  return number;
}

function drawPins() {
  if (!ctx || !canvas) {
    setupCanvas();
  }
  
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw players in order (so overlapping is consistent)
    players.forEach((player) => {
      player.draw();
    });
  }
}

// Listen for events
socket.on('roomCreated', (data) => {
  console.log('Room created successfully:', data);
  roomCode = data.roomCode;
  document.getElementById('room-code').textContent = roomCode;
  document.getElementById('room-code-display').style.display = 'block';
  document.getElementById('create-room-confirm-btn').style.display = 'none';
  document.getElementById('host-name-input').disabled = true;
  updateRoomPlayersList(data.players);
});

socket.on('roomJoined', (data) => {
  console.log('Room joined successfully:', data);
  roomCode = data.roomCode;
  document.getElementById('joined-room-code').textContent = roomCode;
  document.getElementById('joined-room-info').style.display = 'block';
  document.getElementById('join-name-input').disabled = true;
  document.getElementById('room-code-input').disabled = true;
  document.getElementById('join-room-confirm-btn').style.display = 'none';
  updateJoinedRoomPlayersList(data.players);
});

socket.on('roomPlayerUpdate', (data) => {
  if (isHost) {
    updateRoomPlayersList(data.players);
    document.getElementById('start-online-game-btn').disabled = data.players.length < 2;
    document.getElementById('start-online-game-btn').style.display = 'block';
  } else {
    updateJoinedRoomPlayersList(data.players);
  }
});

socket.on('gameStarted', (data) => {
  players = data.players.map(p => new Player(p.id, p.name, p.pos, p.img));
  currentPlayer = players.find(p => p.id === data.currentPlayerId);
  hideModal();
  initializeOnlineGame();
});

socket.on('roomError', (error) => {
  console.error('Room error:', error);
  alert(error.message);
});

function updateRoomPlayersList(playersData) {
  const playersList = document.getElementById('room-players-list');
  document.getElementById('room-player-count').textContent = playersData.length;
  
  playersList.innerHTML = '';
  playersData.forEach(player => {
    const playerDiv = document.createElement('div');
    playerDiv.textContent = player.name;
    playerDiv.style.padding = '0.5rem';
    playerDiv.style.backgroundColor = '#4a4555';
    playerDiv.style.margin = '0.25rem 0';
    playerDiv.style.borderRadius = '3px';
    playersList.appendChild(playerDiv);
  });
}

function updateJoinedRoomPlayersList(playersData) {
  const playersList = document.getElementById('joined-room-players-list');
  document.getElementById('joined-room-player-count').textContent = playersData.length;
  
  playersList.innerHTML = '';
  playersData.forEach(player => {
    const playerDiv = document.createElement('div');
    playerDiv.textContent = player.name;
    playerDiv.style.padding = '0.5rem';
    playerDiv.style.backgroundColor = '#4a4555';
    playerDiv.style.margin = '0.25rem 0';
    playerDiv.style.borderRadius = '3px';
    playersList.appendChild(playerDiv);
  });
}

function initializeOnlineGame() {
  setupCanvas();
  
  document.getElementById('players-box').querySelector('h3').textContent = 'Players currently online:';
  document.getElementById('name').style.display = 'none';
  document.getElementById('start-btn').style.display = 'none';
  document.getElementById('roll-button').hidden = false;
  updatePlayersTable();
  drawPins();
}

socket.on("join", (data) => {
  players.push(new Player(players.length, data.name, data.pos, data.img));
  drawPins();
  document.getElementById(
    "players-table"
  ).innerHTML += `<tr><td>${data.name}</td><td><img src=${data.img} height=50 width=40></td></tr>`;
});

socket.on("joined", (data) => {
  if (gameMode === 'online') {
    data.forEach((player, index) => {
      players.push(new Player(index, player.name, player.pos, player.img));
      console.log(player);
      document.getElementById(
        "players-table"
      ).innerHTML += `<tr><td>${player.name}</td><td><img src=${player.img}></td></tr>`;
    });
    drawPins();
  }
});

socket.on("rollDice", async (data, turn) => {
  if (gameMode === 'online') {
    document.getElementById("dice").src = `./images/dice/dice${data.num}.png`;
    
    // Animate the movement for the player who rolled
    await players[data.id].animateMovement(data.num);

    if (turn != currentPlayer.id) {
      document.getElementById("roll-button").hidden = true;
      document.getElementById(
        "current-player"
      ).innerHTML = `<p>It's ${players[turn].name}'s turn</p>`;
    } else {
      document.getElementById("roll-button").hidden = false;
      document.getElementById(
        "current-player"
      ).innerHTML = `<p>It's your turn</p>`;
    }

    let winner;
    for (let i = 0; i < players.length; i++) {
      if (players[i].pos == 99) {
        winner = players[i];
        break;
      }
    }

    if (winner) {
      document.getElementById(
        "current-player"
      ).innerHTML = `<p>${winner.name} has won!</p>`;
      document.getElementById("roll-button").hidden = true;
      document.getElementById("dice").hidden = true;
      document.getElementById("restart-btn").hidden = false;
    }
  }
});

// Logic to restart the game
document.getElementById("restart-btn").addEventListener("click", () => {
  if (gameMode === 'same-device') {
    // Reset same device game
    players.forEach(player => {
      player.pos = 0;
      player.animationPos = 0;
      player.isAnimating = false;
    });
    currentTurn = 0;
    document.getElementById("current-player").innerHTML = `<p>It's ${players[currentTurn].name}'s turn</p>`;
    document.getElementById("roll-button").hidden = false;
    document.getElementById("roll-button").disabled = false;
    document.getElementById("dice").hidden = false;
    document.getElementById("restart-btn").hidden = true;
    updatePlayersTable();
    drawPins();
  } else {
    socket.emit("restart", { roomCode });
  }
});

socket.on("restart", () => {
  if (gameMode === 'online') {
    window.location.reload();
  }
});
