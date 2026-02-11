const socket = io();
const whiteboard = document.getElementById('whiteboard');
const context = whiteboard.getContext('2d');


//Infinite Canva
let offSetCamera = { x: 0, y: 0};
let isPanning = false;
let lastMousePosition = { x: 0, y: 0 };

//Zoom
let scale = 1;
const zoomSensitivity = 0.001;
const minScale = 0.1;
const maxScale = 6;

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
                x: (d.clientX - offSetCamera.x) / scale,
                y: (d.clientY - offSetCamera.y) / scale,
                newStroke: true,
                color: context.strokeStyle,
                size: context.lineWidth
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

            const CoorWorldX = (d.clientX - offSetCamera.x) / scale;
            const CoorWorldY = (d.clientY - offSetCamera.y) / scale;

            const lastpoint = window.localHistory[window.localHistory.length - 1];
            if(lastpoint){
                const distance = Math.hypot(CoorWorldX - lastpoint.x, CoorWorldY - lastpoint.y);
                if(distance < 3){return;}; //distance minimale pour dessiner
            } 
            const data = {
                x: (d.clientX - offSetCamera.x) / scale,
                y: (d.clientY - offSetCamera.y) / scale,
                newStroke: false,
                color: context.strokeStyle,
                size: context.lineWidth
            };
            window.localHistory.push(data);
            socket.emit('drawing', data);

            //Evite la surcharge du serveur (pas de renderAll())
            if (lastpoint) {
                context.save();
                context.translate(offSetCamera.x, offSetCamera.y);
                context.scale(scale, scale);
                
                context.beginPath();
                context.moveTo(lastPoint.x, lastPoint.y);
                context.lineTo(worldX, worldY);
                
                // On s'assure d'utiliser le style actuel
                context.strokeStyle = data.color;
                context.lineWidth = data.size;
                context.lineCap = 'round';
                
                context.stroke();
                context.restore();
        }
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

    //Scroll_in, Scroll_out
    whiteboard.addEventListener('wheel', (d) => {
        const mouseLocation = { x: d.clientX, y: d.clientY};
        const zoomAmount = 1 - d.deltaY * zoomSensitivity;
        const newScale = Math.min(maxScale, Math.max(minScale, scale * zoomAmount));

        //Zoom vers le curseur
        const ratio = newScale / scale;
        offSetCamera.x = mouseLocation.x - ((mouseLocation.x - offSetCamera.x) * ratio);
        offSetCamera.y = mouseLocation.y - ((mouseLocation.y - offSetCamera.y) * ratio);

        scale = newScale;
        renderAll();
    });


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
    context.scale(scale, scale);
    
    //Style du trait
    style1();

    if(!window.localHistory || window.localHistory.length === 0){
            context.restore();
            return;
    };

    let currentPoint = window.localHistory[0];
    context.beginPath();
    context.moveTo(currentPoint.x, currentPoint.y);

    for (let i = 1; i < window.localHistory.length; i++) {
        const p = window.localHistory[i];
        const lineChanged = (p.color && p.color !== currentPoint.color) || (p.size && p.size !== currentPoint.size);

        if (lineChanged || p.newStroke) {
            context.stroke();

            context.beginPath();
            context.moveTo(p.x, p.y);

            if (lineChanged) {
                if (p.color) context.strokeStyle = p.color;
                if (p.size) context.lineWidth = p.size;
            }
        } else {
            context.lineTo(p.x, p.y);
        }
        currentPoint = p;

    }
    context.stroke();
    context.restore();
}
