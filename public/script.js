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
                x: (d.clientX - offSetCamera.x) / scale,
                y: (d.clientY - offSetCamera.y) / scale,
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
    context.translate(offSetCamera.x, offSetCamera.y);
    context.scale(scale, scale);

    if (window.localHistory.length > 0) {
        for (let i = 0; i < window.localHistory.length; i++) {
            const point = window.localHistory[i];
            
            if (point.newStroke) {
                context.beginPath();
                context.moveTo(point.x, point.y);
            } else {
                const prevPoint = window.localHistory[i-1];
                if (prevPoint) {
                    context.beginPath();
                    context.moveTo(prevPoint.x, prevPoint.y);
                    context.lineTo(point.x, point.y);
                    context.strokeStyle = point.color;
                    context.lineWidth = point.size;
                    context.lineCap = 'round';
                    context.stroke();
                }
            }
        }
    }
    context.restore();
}

//Frontend
const fabToolbar = document.getElementById('fab-toolbar');
const fabTrigger = document.getElementById('fabTrigger');

fabTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (fabToolbar.classList.contains('closed')) {
        fabToolbar.classList.remove('closed');
        fabToolbar.classList.add('open');
    } else {
        fabToolbar.classList.remove('open');
        fabToolbar.classList.add('closed');
    }
});

fabToolbar.addEventListener('mousedown', (e) => e.stopPropagation());

// Boutons
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const colorInput = document.getElementById('colorPicker');
const sizeInput = document.getElementById('sizePicker');

let currentTool = 'pen';

penBtn.addEventListener('click', () => {
    currentTool = 'pen';
    context.strokeStyle = colorInput.value;
    updateUI();
});

eraserBtn.addEventListener('click', () => {
    currentTool = 'eraser';
    context.strokeStyle = '#ffffff';
    updateUI();
});

colorInput.addEventListener('input', (e) => {
    currentTool = 'pen';
    context.strokeStyle = e.target.value;
    updateUI();
});

sizeInput.addEventListener('input', (e) => {
    context.lineWidth = e.target.value;
});

function updateUI() {
    if (currentTool === 'pen') {
        penBtn.classList.add('active');
        eraserBtn.classList.remove('active');
    } else {
        eraserBtn.classList.add('active');
        penBtn.classList.remove('active');
    }
}