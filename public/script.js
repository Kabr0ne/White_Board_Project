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
        drawing = true;
        draw(d);
    })

    //Mouvement-Souris
    whiteboard.addEventListener('mousemove', draw)

    //Relacher-clique-Souris
    whiteboard.addEventListener('mouseup', () => {
        drawing = false;
        context.beginPath();
    })

function DataForDraw(d) {
    if (!drawing) {return;}
    const data = {x: d.clientX, y: d.clientY};

    draw(data.x,data.y);
    socket.emit('drawing', data);

    
}

function draw(x, y){
    context.lineTo(x, y);
    context.stroke();
    context.beginPath(); //Tracé continu(Path), pas de point à la suite
    context.moveTo(x, y);
}