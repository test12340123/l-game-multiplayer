const express = require('express');
const app = express();
const server = require('http').createServer(app);
const WebSocket = require('ws');

const wss = new WebSocket.Server({ server });

app.use(express.static('./'));

const rooms = {}; // roomId -> [ws, ws]

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            return;
        }

        if (data.type === 'list-rooms') {
            // Return all rooms with player count and status
            const allRooms = Object.keys(rooms).map(r => ({
                roomId: r,
                players: rooms[r].length,
                status: rooms[r].length === 1 ? "Waiting" : (rooms[r].length === 2 ? "Game started" : "Unknown")
            }));
            ws.send(JSON.stringify({ type: 'room-list', rooms: allRooms }));
            return;
        }

        if (data.type === 'join-room') {
            const roomId = data.roomId;
            if (!rooms[roomId]) rooms[roomId] = [];
            if (rooms[roomId].length >= 2) {
                ws.send(JSON.stringify({ type: 'wait', message: 'Room is full!' }));
                return;
            }
            ws.roomId = roomId;
            rooms[roomId].push(ws);

            if (rooms[roomId].length === 1) {
                ws.send(JSON.stringify({ type: 'wait', message: 'Waiting for opponent...' }));
            } else if (rooms[roomId].length === 2) {
                // Start game for both
                rooms[roomId][0].send(JSON.stringify({ type: 'start', gameId: roomId, playerNumber: 1 }));
                rooms[roomId][1].send(JSON.stringify({ type: 'start', gameId: roomId, playerNumber: 2 }));
            }
        } else if (data.moveType) {
            // Relay move to opponent in the same room
            const room = rooms[ws.roomId];
            if (room && room.length === 2) {
                for (const client of room) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'move',
                            ...data
                        }));
                    }
                }
            }
        }
    });

    ws.on('close', function() {
        const roomId = ws.roomId;
        if (roomId && rooms[roomId]) {
            rooms[roomId] = rooms[roomId].filter(client => client !== ws);
            // Notify opponent
            if (rooms[roomId].length === 1) {
                rooms[roomId][0].send(JSON.stringify({ type: 'opponent-disconnected' }));
            }
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
