const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { disconnect } = require('cluster');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));


/*
    Stockage de l'historique des dessins dans un tableau
    Peut causer des problèmes de performances -> Stocké dans la RAM
*/
const drawingHistory = []; 

const roomsData = {};
let connectedUsers = 0;

io.on('connection', (user) => {
    console.log(`Nouvel utilisateur connecté : ${user.id}`);
    connectedUsers++;
    io.emit('update-client-count', connectedUsers);
    
    user.emit('update-room-list', Object.keys(roomsData));
    user.on('get-rooms', () => {
        user.emit('update-room-list', Object.keys(roomsData));
    });

    user.on('join-room', (data) => {
        const {username, room, password} = data;

        if(!roomsData[room]) {
            roomsData[room] = {
                history: [],
                password: password || null
            };
            user.emit('update-room-list', Object.keys(roomsData));
        }

        if(roomsData[room].password && roomsData[room].password !== password) {
            user.emit('room-joined', { success: false, message: 'Mot de passe incorrect' });
            return;
        }

        user.join(room);
        user.currentRoom = room;
        user.username = username;

        user.emit('init-history', roomsData[room].history);
        user.emit('room-joined', { success: true, room: room });
    })
            

    //Broadcast vers tout les users sauf le dessinateur
    user.on('drawing', (data)=> {

        const room = user.currentRoom;
        if (!room || !roomsData[room]) return;

        if(data.clear) {
            roomsData[room].history = [];
            io.to(room).emit('drawing', {clear: true});
        }
        else {
            roomsData[room].history.push(data);
            user.to(room).emit('drawing', data);
        }
    })

    //La fonction OnResize demande l'historique
    user.on('resize-canvas', () => {
        const room = user.currentRoom;
        if(room && roomsData[room]) {
            user.emit('init-history', roomsData[room].history);
        }
    })

    user.on('draw-cursor', (data) => {
        const room = user.currentRoom;
        if(room) {
            user.to(room).emit('draw-cursor', {
                line: data.line,
                id: user.id,
                username: user.username
            });
        }
        
    })
    user.on('disconnect', () => {
        io.emit('remove-cursor', user.id);
        connectedUsers--;
        io.emit('update-client-count', connectedUsers);

        const room = user.currentRoom;
        if(room) {
            const clients = io.sockets.adapter.rooms.get(room);
            if(!clients || clients.size === 0) {
                delete roomsData[room];
                io.emit('update-room-list', Object.keys(roomsData));
            }
        }
    })
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
})

server.listen(port, '0.0.0.0', () => {
    console.log(`Serveur démarré sur le port ${port}`);
})