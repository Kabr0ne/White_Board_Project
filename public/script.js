const socket = io();
const whiteboard = document.getElementById('whiteboard');
const context = whiteboard.getContext('2d');

whiteboard.width = window.innerWidth;
whiteboard.height = window.innerHeight;

//Config Trait
context.lineWidht = 2;
context.lineCap = 'round';
context.strokeStyle = 'blue';

let drawing = false;


//Liste de listener de la souris

    //Clique-Souris
    whiteboard.addEventListener('mousedown', (d) => {
        console.log("début du dessin")
        drawing = true;
        draw(d);
    })

    //Mouvement-Souris
    whiteboard.addEventListener('mousemove', (d) => {
        if (!drawing) {return;}
        const data = {
            x: d.clientX,
            y: d.clientY
        };

        draw(data.x, data.y);
        socket.emit('drawing', data);
    });

    //Relacher-clique-Souris
    whiteboard.addEventListener('mouseup', () => {
        console.log("fin du dessin")
        drawing = false;
        context.beginPath();
    })


function draw(x, y){
    context.lineTo(x, y);
    context.stroke();
    context.beginPath(); //Tracé continu(Path), pas de point à la suite
    context.moveTo(x, y);
}

socket.on('drawing', (data) => {
    draw(data.x, data.y);
})