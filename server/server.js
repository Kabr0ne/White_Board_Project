const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

io.on('connection', (user) => {
    console.log(`Nouvel utilisateur connecté : ${user.id}`);

    //Broadcast vers tout les users sauf le dessinateur
    user.on('drawing', (data)=> {
        user.broadcast.emit('drawing', data);
    })
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
})

server.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
})