const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

const wss = new WebSocketServer({ server });
const rooms = new Map();

wss.on('connection', (ws) => {
    let roomId;
    let playerId;

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'join':
                roomId = data.roomId;
                if (!rooms.has(roomId)) {
                    if (!data.isCreator) {
                        ws.send(JSON.stringify({ 
                            type: 'error', 
                            message: 'Room does not exist' 
                        }));
                        return;
                    }
                    rooms.set(roomId, { 
                        players: [], 
                        moves: Array(9).fill(''),
                        currentPlayer: 'X'
                    });
                }
                const room = rooms.get(roomId);
                if (room.players.length >= 2) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
                    return;
                }
                playerId = room.players.length === 0 ? 'X' : 'O';
                room.players.push({ ws, playerId });
                ws.send(JSON.stringify({ 
                    type: 'player', 
                    id: playerId,
                    currentPlayer: room.currentPlayer
                }));
                break;

            case 'move':
                const gameRoom = rooms.get(roomId);
                if (gameRoom) {
                    gameRoom.moves = data.moves;
                    gameRoom.currentPlayer = gameRoom.currentPlayer === 'X' ? 'O' : 'X';
                    gameRoom.players.forEach(player => {
                        player.ws.send(JSON.stringify({ 
                            type: 'update', 
                            moves: data.moves,
                            currentPlayer: gameRoom.currentPlayer
                        }));
                    });
                }
                break;
        }
    });

    ws.on('close', () => {
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.players = room.players.filter(player => player.ws !== ws);
            if (room.players.length === 0) {
                rooms.delete(roomId);
            } else {
                room.players[0].ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Other player disconnected'
                }));
            }
        }
    });
});