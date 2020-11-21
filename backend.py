#!/usr/bin/env python

import asyncio
import json
import logging
import websockets
import threading

logging.basicConfig()

DRAW = {"shape": "", "ID": "", "color": "", "XStartPosition": 0, "YStartPosition": 0, "XEndPosition": 0,
        "YEndPosition": 0, "title": "", "assignee": "", "description": ""}
DRAG_DROP = {"ID": "", "XStartPosition": 0, "YStartPosition": 0}
DELETE = {"ID": ""}
UPDATE = {"ID": "", "color": "", "title": "", "assignee": "", "description": ""}

USERS = {}

# Dictionary containing information about each drawing on the board
BOARD_STATE = {}

# Backup file path
BACKUP_FILE_PATH = "server-backup/server-backup.json"
# Backup interval in seconds (if 0 no backup is performed)
BACKUP_INTERVAL = 10

def users_event():
    return json.dumps({"type": "users", "count": len(USERS), "usernames": list(USERS.values())})


def draw_event():
    return json.dumps({"type": "draw", **DRAW})


def drag_drop_event():
    return json.dumps({"type": "drag-drop", **DRAG_DROP})


def delete_event():
    return json.dumps({"type": "delete", **DELETE})


def board_state_event():
    return json.dumps({"type": "board-state", "drawings": list(BOARD_STATE.values())})


def update_event():
    return json.dumps({"type": "update", **UPDATE})

async def notify_users():
    if USERS:  # asyncio.wait doesn't accept an empty list
        message = users_event()
        await asyncio.wait([user.send(message) for user in USERS.keys()])


async def notify_draw():
    if USERS:  # asyncio.wait doesn't accept an empty list
        message = draw_event()
        await asyncio.wait([user.send(message) for user in USERS.keys()])


async def notify_drag_drop():
    if USERS:  # asyncio.wait doesn't accept an empty list
        message = drag_drop_event()
        await asyncio.wait([user.send(message) for user in USERS.keys()])


async def notify_delete():
    if USERS:  # asyncio.wait doesn't accept an empty list
        message = delete_event()
        await asyncio.wait([user.send(message) for user in USERS])


async def notify_board_state(user):
    if USERS:  # asyncio.wait doesn't accept an empty list
        message = board_state_event()
        await asyncio.wait(user.send(message))

async def notify_update():
    if USERS:  # asyncio.wait doesn't accept an empty list
        message = update_event()
        await asyncio.wait([user.send(message) for user in USERS])

async def register(websocket):
    # Add websocket with empty string as username
    USERS[websocket] = ""


async def unregister(websocket):
    USERS.pop(websocket)
    await notify_users()

async def counter(websocket, path, ping_interval=None):
    # register(websocket) sends user_event() to websocket
    await register(websocket)
    try:
        async for message in websocket:
            data = json.loads(message)
            print("message action is", data["action"])
            if data["action"] == "user-connect":
                USERS[websocket] = data["username"]
                await notify_users()
                # Send the board state to the client that is connecting
                await websocket.send(board_state_event())
            if data["action"] == "draw":
                DRAW["shape"] = data["shape"]
                DRAW["ID"] = data["ID"]
                DRAW["color"] = data["color"]
                DRAW["XStartPosition"] = data["XStartPosition"]
                DRAW["YStartPosition"] = data["YStartPosition"]
                DRAW["XEndPosition"] = data["XEndPosition"]
                DRAW["YEndPosition"] = data["YEndPosition"]
                DRAW["title"] = data["title"]
                DRAW["assignee"] = data["assignee"]
                DRAW["description"] = data["description"]

                # Add drawing to board state
                BOARD_STATE[data["ID"]] = data
                await notify_draw()
            elif data["action"] == "drag-drop":
                DRAG_DROP["ID"] = data["ID"]
                DRAG_DROP["XStartPosition"] = data["XStartPosition"]
                DRAG_DROP["YStartPosition"] = data["YStartPosition"]

                # Update drawing in board state
                drawing = BOARD_STATE[data["ID"]]
                drawing["XStartPosition"] = data["XStartPosition"]
                drawing["YStartPosition"] = data["YStartPosition"]
                await notify_drag_drop()
            elif data["action"] == "delete":
                DELETE["ID"] = data["ID"]

                # Remove drawing from board state
                BOARD_STATE.pop(data["ID"])
                await notify_delete()
            elif data["action"] == "update":
                UPDATE["ID"] = data["ID"]
                UPDATE["title"] = data["title"]
                UPDATE["assignee"] = data["assignee"]
                UPDATE["description"] = data["description"]
                UPDATE["color"] = data["color"]

                # Update drawing from board state
                drawing = BOARD_STATE[data["ID"]]
                drawing["title"] = data["title"]
                drawing["assignee"] = data["assignee"]
                drawing["description"] = data["description"]
                drawing["color"] = data["color"]
                await notify_update()
            elif data["action"] == "savebackup":
                save_backup_by_user()
            else:
                logging.error("unsupported event: {}", data)
    except (OSError, asyncio.IncompleteReadError, websockets.exceptions.ConnectionClosedError) as e:
        pass
    finally:
        await unregister(websocket)


def load_backup_file():
    # Read backup file
    f = open(BACKUP_FILE_PATH, "r")
    fileContent = f.read()
    print("backup loaded")
    # Convert json file content to dict
    return json.loads(fileContent)


def backup_board_state():
    if BACKUP_INTERVAL > 0:
        threading.Timer(BACKUP_INTERVAL, backup_board_state).start()
        # Opens backup file or create if it doesn't exist
        f = open(BACKUP_FILE_PATH, "w")
        f.write(json.dumps(BOARD_STATE))
        f.close()
        print("backup performed")

#Save backup by user clicking save backup button
def save_backup_by_user():
    if BACKUP_INTERVAL >= 0:
        # Save backup file or create if it doesn't exist
        f = open(BACKUP_FILE_PATH, "w")
        f.write(json.dumps(BOARD_STATE))
        f.close()
        print("backup performed by user")

if __name__ == "__main__":
    BOARD_STATE = load_backup_file()
    backup_board_state()

    start_server = websockets.serve(counter, "localhost", 6789)

    asyncio.get_event_loop().run_until_complete(start_server)
    asyncio.get_event_loop().run_forever()
