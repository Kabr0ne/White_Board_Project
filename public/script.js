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


let drawing = false;


//Liste de listener

    //Clique-Souris
    whiteboard.addEventListener('mousedown', (d) => {
        if (d.button === 1) { //Clique-Molette active le panning
            isPanning = true;
            lastMousePosition = { x: d.clientX - offSetCamera.x, y: d.clientY - offSetCamera.y };
        }
        if (d.button === 0){
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
        socket.emit('draw-cursor', {line: {
            x: (d.clientX - offSetCamera.x) / scale, 
            y: (d.clientY - offSetCamera.y) / scale,
            id: myUsername
        }});
        
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
                newStroke: false,
                color: context.strokeStyle,
                size: context.lineWidth
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
        updateInformation();
        renderAll();
    });


    //Redimension de la fenêtre
    window.addEventListener('resize', onResize);

    //Mobile Support
    let lastTouchMidPoint = null;
    let lastTouchDistance = 0;

    whiteboard.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            drawing = true;
            const touchPos = getTouchPos(e);
            const colorToSave = (currentTool === 'eraser') ? '#ffffff' : colorInput.value;
            const data = {
                x: (touchPos.x - offSetCamera.x) / scale,
                y: (touchPos.y - offSetCamera.y) / scale,
                newStroke: true,
                color: colorToSave,
                size: parseInt(sizeInput.value)
            };
            window.localHistory.push(data);
            socket.emit('drawing', data);
            renderAll();
        } else if (e.touches.length === 2) {
            drawing = false;
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
            lastTouchMidPoint = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };
        }
    });

    whiteboard.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && drawing) {
            const touchPos = getTouchPos(e);
            socket.emit('draw-cursor', {
                line: {
                    x: (touchPos.x - offSetCamera.x) / scale, 
                    y: (touchPos.y - offSetCamera.y) / scale,
                    id: myUsername
                }});
                
            const colorToSave = (currentTool === 'eraser') ? '#ffffff' : colorInput.value;
            const data = {
                x: (touchPos.x - offSetCamera.x) / scale,
                y: (touchPos.y - offSetCamera.y) / scale,
                newStroke: false,
                color: colorToSave,
                size: parseInt(sizeInput.value)
            };
            window.localHistory.push(data);
            socket.emit('drawing', data);
            renderAll();
        } 
        else if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            
            const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
            const currentMidPoint = {
                x: (touch1.clientX + touch2.clientX) / 2,
                y: (touch1.clientY + touch2.clientY) / 2
            };

            if (lastTouchDistance && lastTouchMidPoint) {
                const zoomAmount = currentDistance / lastTouchDistance;
                const newScale = Math.min(maxScale, Math.max(minScale, scale * zoomAmount));
                const ratio = newScale / scale;

                const dx = currentMidPoint.x - lastTouchMidPoint.x;
                const dy = currentMidPoint.y - lastTouchMidPoint.y;

                offSetCamera.x = currentMidPoint.x - ((currentMidPoint.x - offSetCamera.x) * ratio) + dx;
                offSetCamera.y = currentMidPoint.y - ((currentMidPoint.y - offSetCamera.y) * ratio) + dy;

                scale = newScale;
                updateInformation();
                renderAll();
            }

            lastTouchDistance = currentDistance;
            lastTouchMidPoint = currentMidPoint;
        }
    });

    whiteboard.addEventListener('touchend', () => {
        drawing = false;
        lastTouchDistance = 0;
        lastTouchMidPoint = null;
        context.beginPath();
    });


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
    if(data.clear) {
        window.localHistory = [];
        renderAll();
        return;
    }
    window.localHistory.push(data);
    renderAll();
})

socket.on('init-history', (history) => {
    context.clearRect(0, 0, whiteboard.width, whiteboard.height); //Efface le canvas avant de redessiner l'historique
    window.localHistory = history;
    renderAll();
});

function renderAll() {
    context.fillStyle = "white";
    context.fillRect(0, 0, whiteboard.width, whiteboard.height);
    context.save();
    context.translate(offSetCamera.x, offSetCamera.y);
    context.scale(scale, scale);
    grid();

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


                    context.strokeStyle = point.color || '#000000';
                    context.lineWidth = point.size || 5;
                    context.lineCap = 'round';
                    context.stroke();
                }
            }
        }
    }
    context.restore();
}

function grid(){
    const gridSize = 25;
    const left = -offSetCamera.x / scale;
    const top = -offSetCamera.y / scale;
    const right = (whiteboard.width - offSetCamera.x) / scale;
    const bottom = (whiteboard.height - offSetCamera.y) / scale;

    context.strokeStyle = '#00000039';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = left - (left % gridSize); x < right; x += gridSize) {
        context.moveTo(x, top);
        context.lineTo(x, bottom);
    }
    for (let y = top - (top % gridSize); y < bottom; y += gridSize) {
        context.moveTo(left, y);
        context.lineTo(right, y);
    }
    context.stroke();
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
const eraseAllBtn = document.getElementById('eraseAllBtn');
const resetZoomBtn = document.getElementById('resetZoom');

let currentTool = 'pen'; //Outil par défaut

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

const eraseAll = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.localHistory = [];
        socket.emit('drawing', { clear: true });
        renderAll();
}

eraseAllBtn.addEventListener('click', eraseAll);
eraseAllBtn.addEventListener('touchstart', eraseAll, { passive: false });

resetZoomBtn.addEventListener('click', () => {
    scale = 1;
    offSetCamera = { x: 0, y: 0 };
    updateInformation();
    renderAll();
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

const zoomPourcent = document.getElementById('zoomPourcent');
function updateInformation() {
    const zoomPercentage = Math.round(scale * 100);
    zoomPourcent.textContent = `${zoomPercentage}%`;
}

const clientCompteur = document.getElementById('ClientCompteur');
socket.on('update-client-count', (count) => {
    clientCompteur.textContent = `${count} 👀`;
});


//Mobile Support
function getTouchPos(touchEvent) {
    const rect = whiteboard.getBoundingClientRect();
    return {
        x: touchEvent.touches[0].clientX - rect.left,
        y: touchEvent.touches[0].clientY - rect.top
    };
}

//Cursor management
function getCursorElement(id) {
    let elementid = "cursor-" + id;
    let cursorElement = document.getElementById(elementid);
    if (!cursorElement) {
        cursorElement = document.createElement('div');
        cursorElement.id = elementid;
        cursorElement.className = 'cursor';
        cursorElement.style.pointerEvents = 'none';
        const label = document.createElement('span');
        label.className = 'cursor-label';
        label.innerText = id.substring(0, 5);
        cursorElement.appendChild(label);
        document.body.appendChild(cursorElement);
    }
    return cursorElement;
}

socket.on('draw-cursor', (data) => {
    const cursorElement = getCursorElement(data.id);
    const label = cursorElement.querySelector('.cursor-label');
    if (label) {
        label.innerText = data.username;
    }
    const x = data.line.x * scale + offSetCamera.x;
    const y = data.line.y * scale + offSetCamera.y;
    cursorElement.style.transform = `translate(${x}px, ${y}px)`;
});

socket.on('remove-cursor', (id) => {
    const cursorElement = document.getElementById("cursor-" + id);
    if (cursorElement) {
        cursorElement.remove();
    }
});

//Overlay management
const loginOverlay = document.getElementById('login-overlay');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const passwordInput = document.getElementById('password');
const joinBtn = document.getElementById('joinBtn');
const roomsList = document.getElementById('roomsList');

let myUsername = 'Anonymous';
let currentRoom = null;

roomsList.addEventListener('click', (e) => {
    if (e.target && e.target.tagName === 'LI') {
        const roomName = e.target.innerText;
        if (roomName != "No active room") {
            roomInput.value = roomName;
        }
    }
});

function JoinRoom() {
    const username = usernameInput.value.trim();
    const room = roomInput.value.trim();
    const password = passwordInput.value.trim();

    if(!username || !room) {
        alert("Please enter a username and room name.");
        return;
    }
    myUsername = username;
    currentRoom = room;

    socket.emit('join-room', {
        username: myUsername,
        room: currentRoom,
        password: password
    });
}

joinBtn.addEventListener('click', JoinRoom);

socket.on('room-joined', (data) => {
    if(data.success) {
        loginOverlay.style.display = 'none';
        console.log(`User ${myUsername} joined room: ${data.room}`);
    } else {
        alert(`Failed to join room: ${data.message}`);
    }
});

socket.on('update-room-list', (rooms) => {
    console.log("Received room list:", rooms);
    if(!roomsList) {return;}
    roomsList.innerHTML = '';
    if(rooms.length === 0) {
        roomsList.innerHTML = '<li>No active room</li>';
    } else {
        rooms.forEach(room => {
            const li = document.createElement('li');
            li.textContent = room;
            roomsList.appendChild(li);
        });
    }
});
socket.emit('get-rooms');

//ExportPNG section
const exportBtn = document.getElementById('exportBtn');
exportBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `whiteboard_${currentRoom || 'untitled'}.png`;
    link.href = whiteboard.toDataURL();
    link.click();
});

//Chat section
const chatContainer = document.getElementById('chat-container');
chatContainer.style.display = 'none'; //Disable chat au lancement

const openChatBtn = document.getElementById('open-chat-btn');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat');
const chatMessages = document.getElementById('chat-messages');
const closeChatBtn = document.getElementById('close-chat');

openChatBtn.addEventListener('click', () => {
    chatContainer.style.display = 'flex';
    openChatBtn.style.display = 'none';
});

closeChatBtn.addEventListener('click', () => {
    chatContainer.style.display = 'none';
    openChatBtn.style.display = 'block';
});

function addChatMessage() {
    const message = chatInput.value.trim();
    if(message && currentRoom) {
        socket.emit('send-chat', message);
        chatInput.value = '';
    }
}

sendChatBtn.onclick = addChatMessage;
chatInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') {
        addChatMessage();
    }
});

socket.on('received-chat', (data) => {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${data.id === socket.id ? 'my-message' : ''}`;
    messageElement.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});