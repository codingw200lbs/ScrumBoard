var users = document.querySelector('.users');
var background = document.getElementById('background');
var trash = document.getElementById('trash');
// Create the websocket, note the IP and port number are both needed
var websocket = new WebSocket("ws://127.0.0.1:6789/");
// Indicates which shape to draw
var drawShape = null;
var dragging = false;
var held = null;
// Global ID of mouse down interval
var mousedownID = -1;

// Select/Manage Item modal
var itemModal = document.getElementById("itemModal");
// Gets the <span> element that closes the modal
var closeModal = document.getElementsByClassName("close")[0];

// Dictionary containing information about circle and square drawing.
// Used when select/manage item
var boardItems = {};

websocket.onopen = function() {
    var username = null;
    while (username == null || username == "") {
        username = window.prompt('Please insert your name:');
    }
    websocket.send(JSON.stringify({
        action: 'user-connect',
        username: username,
    }));
};

function mousedown(event) {
	event.preventDefault();  //stops a bug with trash can icon.
    // For handling drag and drop events

    if (event.which == 3) return; // Prevent right clicks

    if (!event.target.id.startsWith("background")) {
        if (mousedownID == -1) { // // Prevent multiple loops!
			dragging = true;
			held = event.target.id;
            mousedownID = setInterval(function() { whileMouseDownDragAndDrop(event); }, 50 /*execute every 50ms*/);
        }
    }

    // For handling drawing events
    if (drawShape !== null) {
        if (mousedownID == -1) { // Prevent multiple loops!
            // Each drawing has a random (hopefully unique) ID (i.e. 'circle-1234')
            const drawID = drawShape + "-" + Math.floor((Math.random() * 9999) + 1);
            mousedownID = setInterval(function() { whileMouseDownDraw(event, drawID); }, 50 /*execute every 50ms*/);
        }
    }
}

function whileMouseDownDragAndDrop(event) {
    if(event.target.id === 'trash-img' || event.target.id === 'user-state') {
        return;
    }
    websocket.send(JSON.stringify({
        action: 'drag-drop',
        ID: event.target.id,
        XStartPosition: mouseXPosition,
        YStartPosition: mouseYPosition,
    }));
}

trash.onmouseup = function (event) {
	if(dragging && held !== 'trash-img' && held !== 'user-state') {
		websocket.send(JSON.stringify({action: 'delete', ID: held}));
	}
};

function delete_item(id) {
	dragging = false;
	held = null;
	id.remove();
}

function whileMouseDownDraw(event, drawID) {
    let xStartPosition, yStartPosition, xEndPosition, yEndPosition;
    // Set the correct start and end positions depending on the position of the mouse
    if (event.clientX > mouseXPosition && event.clientY > mouseYPosition) {
        xStartPosition = mouseXPosition;
        yStartPosition = mouseYPosition;
        xEndPosition = event.clientX - mouseXPosition;
        yEndPosition = event.clientY - mouseYPosition;
    } else if (event.clientX > mouseXPosition) {
        xStartPosition = mouseXPosition;
        yStartPosition = event.clientY;
        xEndPosition = event.clientX - mouseXPosition;
        yEndPosition = mouseYPosition - event.clientY;
    } else if (event.clientY > mouseYPosition) {
        xStartPosition = event.clientX;
        yStartPosition = mouseYPosition;
        xEndPosition = mouseXPosition - event.clientX;
        yEndPosition = event.clientY - mouseYPosition
    } else {
        xStartPosition = event.clientX;
        yStartPosition = event.clientY;
        xEndPosition = mouseXPosition - event.clientX;
        yEndPosition = mouseYPosition - event.clientY;
    }
	color = document.getElementById("color_select").value;
    websocket.send(JSON.stringify({
        action: 'draw',
        shape: drawShape,
        ID: drawID,
		color: color,
        XStartPosition: xStartPosition,
        YStartPosition: yStartPosition,
        XEndPosition: xEndPosition,
        YEndPosition: yEndPosition,
        title: "",
        assignee: "",
        description: "",
    }));
}

function mouseup(event) {
    if(mousedownID!=-1) {  // Only stop if exists
		dragging = false;
		held = null;
        clearInterval(mousedownID);
        mousedownID=-1;
    }
}

var mouseXPosition;
var mouseYPosition;
// Set the position of the mouse.
// Which is used by the #whileMouseDown method to get the position of the mouse
function mousemove(event, drawID) {
    mouseXPosition = event.clientX;
    mouseYPosition = event.clientY;
}

// Right-click event handler, for select/manage items
background.addEventListener('contextmenu', function(event) {
    // Prevent the right-click context menu from popping up
    event.preventDefault();

    targetId = event.target.id;
    if (targetId.startsWith("circle") || targetId.startsWith("square")) {
        handleSelectItem(targetId);
    }
}, false);


// Assign events
background.addEventListener("mousedown", mousedown);
background.addEventListener("mouseup", mouseup);
background.addEventListener("mousemove", mousemove);


//The websocket message handler, this code executes whenever we get a message from the server.
websocket.onmessage =  function (event) {
    data = JSON.parse(event.data);
    if (!(data)){   //To get around a bug.
		return;
	}
    switch (data.type) {
        case 'board-state':
            drawings = data.drawings;
            drawings.forEach(handleDrawShape);
            break;
		case 'delete':
			if (document.getElementById(data.ID)) {
				var dragAndDropElement = document.getElementById(data.ID);
				delete_item(dragAndDropElement);
                delete boardItems[data.ID];
			}
            break;
        case 'users':
            users.style.background = "white";
            if(data.count) {   //To get around a bug that kept happening.
                users.textContent = (data.count.toString() + " user" + (data.count == 1 ? "" : "s online"));
                addUsernames(data.usernames);
            }
            break;
        case 'draw':
            handleDrawShape(data);
            break;
        case 'drag-drop':
			if (document.getElementById(data.ID)) {
				var dragAndDropElement = document.getElementById(data.ID);
				dragAndDropElement.style.left = (data.XStartPosition+1) + "px";  // Offset needed for reliable deleting of squares.
				dragAndDropElement.style.top = (data.YStartPosition+1) + "px";
			}
			break;
        case 'update':
            if (!document.getElementById(data.ID)) {
                break;
            }
            boardItems[data.ID] = {
                title: data.title,
                assignee: data.assignee,
                description: data.description,
                color: data.color,
            };

            var element = document.getElementById(data.ID);
            element.style.border = data.color;
            element.innerHTML = data.title;


            break;
        default:
            console.error("unsupported event", data);
    }
};

//This function executes when the websocket transitions to the CLOSED
//event. Normally this only happens when the server process terminates.
websocket.onclose = function (event) {
    users.textContent = "Server Disconnected";
    users.style.background = "#ff00ff";
    users.style.fontSize = "2.5em";
};

function drawButtonClick(button_id) {
    let buttonElement = document.getElementById(button_id);

    // Unselect all buttons
    document.getElementById('square-button').style.border = null;
    document.getElementById('circle-button').style.border = null;
    document.getElementById('vertical-line-button').style.border = null;
    document.getElementById('horizontal-line-button').style.border = null;


    if (drawShape !== null && buttonElement.id.replace("-button", "") === drawShape) {
        drawShape = null;
    } else {
        // Select the button that has been pressed
        drawShape = buttonElement.id.replace("-button", "");
        buttonElement.style.border = "2px solid black";
    }
}

function handleDrawShape(data) {
    var drawElement;
    // If the element doesn't exist a new div element is created
    if (document.getElementById(data.ID)) {
        drawElement = document.getElementById(data.ID);
    } else {
        drawElement = document.createElement("div");
        drawElement.id = data.ID;
        drawElement.className = data.shape;
        drawElement.style.border = data.color;
        background.append(drawElement);
    }
    drawElement.style.left = data.XStartPosition + "px";
    drawElement.style.top = data.YStartPosition + "px";
    drawElement.style.width = data.XEndPosition + "px";
    drawElement.style.height = data.YEndPosition + "px";

    // Different class has different properties
    if (drawElement.className == "horizontal-line") {
        drawElement.style.height = "0px";
    } else if (drawElement.className == "vertical-line") {
        drawElement.style.width = "0px";
    } else if (drawElement.className == "square" || drawElement.className == "circle") {

        drawElement.innerHTML = data.title;
        if (data.title !== "" || data.assignee !== "" || data.description !== "") {
            boardItems[data.ID] = {
                title: data.title,
                assignee: data.assignee,
                description: data.description,
                color: data.color,
            };
        }
    }
}

function addUsernames(usernames) {
    var userList = document.getElementById('users');

    // Clear userlist
    userList.innerHTML = '';
    // Add new usernames to userlist
    usernames.forEach(addUsername);

    function addUsername(username) {
        var userEntry = document.createElement('li');
        userEntry.appendChild(document.createTextNode(username));
        userList.appendChild(userEntry);
    }
}

var updateItemTargetId;
function handleSelectItem(targetId) {
    updateItemTargetId = targetId;

    // Clear textAreas
    document.getElementById('itemTitle').value = "";
    document.getElementById('itemAssignee').value = "";
    document.getElementById('itemDescription').value = "";

    // Set selected color
    var color = document.getElementById(targetId).style.border;
    document.getElementById(color).selected = "true";

    var selectedItem = boardItems[targetId];
    if (selectedItem !== undefined) {
        document.getElementById('itemTitle').value = selectedItem.title;
        document.getElementById('itemAssignee').value = selectedItem.assignee;
        document.getElementById('itemDescription').value = selectedItem.description;
    }
    itemModal.style.display = "block";
}

function handleUpdateItem() {
    // Close the item modal
    itemModal.style.display = "none";

    websocket.send(JSON.stringify({
        action: 'update',
        ID: updateItemTargetId,
        title: document.getElementById('itemTitle').value,
        assignee: document.getElementById('itemAssignee').value,
        description: document.getElementById('itemDescription').value,
        color: document.getElementById('modal_color_select').value,
    }));
}

function handleModalDeleteItem() {
    websocket.send(JSON.stringify({action: 'delete', ID: updateItemTargetId}));
    itemModal.style.display = "none";
}

// When the user presses enter inside item modal, send update
itemModal.onkeydown = function(event) {
    if (event.key === "Enter") {
        handleUpdateItem();
    }
};

// Close the item modal
closeModal.onclick = function() {
    itemModal.style.display = "none";
};

// When the user clicks anywhere outside of the item modal, close it
window.onclick = function(event) {
    if (event.target == itemModal) {
        itemModal.style.display = "none";
    }
};

// Close the item modal when escape key is pressed
document.onkeydown = function(event) {
    if (event.key === "Escape") {
        itemModal.style.display = "none";
    }
};

//save backup by the user clicking the save backup button
function saveBackupByUser() {
    websocket.send(JSON.stringify({action: 'savebackup'}));

    downloadElement = document.createElement('a');
    downloadElement.href = "server-backup/server-backup.json";
    downloadElement.download = "board-backup-" + new Date().toLocaleDateString();
    downloadElement.click();
}

//save backup by the user clicking the save backup button
function loadBackupFile() {
    var input = document.createElement('input');
    input.type = 'file';

    // Adding an onchange event to the newly created input would allow us to do
    // stuff once the user has selected the file.
    input.onchange = e => {
        var file = e.target.files[0];
        handleUploadedFile(file);
    };
    input.click();
}

function handleUploadedFile(file) {
    if (file === undefined || file.type !== 'application/json') {
        // Error box
        window.alert("Please upload a json file");
        return;
    }

    // Read file
    var reader = new FileReader();
    reader.readAsText(file,'UTF-8');

    // here we tell the reader what to do when it's done reading...
    reader.onload = readerEvent => {
        var content = readerEvent.target.result; // this is the content!
        drawings = JSON.parse(content);
        console.log(drawings);

        Object.keys(drawings).forEach(function(drawID) {
            drawing = drawings[drawID];
            websocket.send(JSON.stringify({
                action: 'draw',
                shape: drawing.shape,
                ID: drawing.ID,
                color: drawing.color,
                XStartPosition: drawing.XStartPosition,
                YStartPosition: drawing.YStartPosition,
                XEndPosition: drawing.XEndPosition,
                YEndPosition: drawing.YEndPosition,
                title: drawing.title,
                assignee: drawing.assignee,
                description: drawing.description,
            }));
        });
    };
}