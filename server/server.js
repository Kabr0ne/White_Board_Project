const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

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

io.on('connection', (user) => {
    console.log(`Nouvel utilisateur connecté : ${user.id}`);

    user.emit('init-history', drawingHistory); //MAJ Canva avec l'historique des dessins 

    //Broadcast vers tout les users sauf le dessinateur
    user.on('drawing', (data)=> {

        drawingHistory.push(data); //Ajout du dessin à l'historique 
        user.broadcast.emit('drawing', data);
        console.log(drawingHistory)
    })

    //La fonction OnResize demande l'historique
    user.on('resize-canvas', () => {
        user.emit('init-history', drawingHistory);
    })
})

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
})

server.listen(port, '0.0.0.0', () => {
    console.log(`Serveur démarré sur le port ${port}`);
})