const socket = io();
const whiteboard = document.getElementById('whiteboard');
const context = whiteboard.getContext('2d');

let offSetCamera = { x: 0, y: 0};
let isPanning = false;
let lastMousePosition = { x: 0, y: 0 };

whiteboard.width = window.innerWidth;
whiteboard.height = window.innerHeight;

window.localHistory = []; //Stockage de l'historique local pour le panning, evite la charge server

//Config Trait
function style1(){
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = 'blue';
}


let drawing = false;


//Liste de listener

    //Clique-Souris
    whiteboard.addEventListener('mousedown', (d) => {
        if (d.button === 1) { //Clique-Molette active le panning
            isPanning = true;
            lastMousePosition = { x: d.clientX - offSetCamera.x, y: d.clientY - offSetCamera.y };
        }
        if (d.button === 0){
            console.log("début du dessin")
            drawing = true;
            const data = {
                x: d.clientX - offSetCamera.x,
                y: d.clientY - offSetCamera.y,
                newStroke: true
            };
            window.localHistory.push(data);
            socket.emit('drawing', data);
            renderAll();
        }
        
    })

    //Mouvement-Souris
    whiteboard.addEventListener('mousemove', (d) => {
        if (isPanning) {
            offSetCamera.x = d.clientX - lastMousePosition.x;
            offSetCamera.y = d.clientY - lastMousePosition.y;
            renderAll();
            return;
        }
        if(drawing){ 
            const data = {
                x: d.clientX - offSetCamera.x,
                y: d.clientY - offSetCamera.y,
                newStroke: false
            };
            window.localHistory.push(data);
            socket.emit('drawing', data);
            renderAll();
        }
    });

    //Relacher-clique-Souris
    whiteboard.addEventListener('mouseup', (d) => {
        if(d.button === 1){ isPanning = false; }
        if(d.button === 0){
            console.log("fin du dessin")
            drawing = false;
            context.beginPath();
        }
    })

    //Redimension de la fenêtre
    window.addEventListener('resize', onResize);


function draw(x, y, isNewStroke){
    if(isNewStroke){
        context.beginPath();//Tracé continu(Path), pas de point à la suite
        context.moveTo(x, y);
    }
    context.lineTo(x, y);
    context.stroke();
}

function onResize() {
    //MAJ des dimensions du canvas
    whiteboard.width = window.innerWidth;
    whiteboard.height = window.innerHeight;
    renderAll();
    socket.emit('resize-canvas');

}

socket.on('drawing', (data) => {
    window.localHistory.push(data);
    renderAll();
})

socket.on('init-history', (history) => {
    context.clearRect(0, 0, whiteboard.width, whiteboard.height); //Efface le canvas avant de redessiner l'historique
    window.localHistory = history;
    renderAll();
});

function renderAll() {
    context.clearRect(0, 0, whiteboard.width, whiteboard.height);
    context.save();
    context.translate(offSetCamera.x, offSetCamera.y);//mouvement caméra
    
    //Style du trait
    style1();

    if(window.localHistory){
        window.localHistory.forEach((data) => {
            draw(data.x, data.y, data.newStroke);
        });
    }
    context.restore();
}
