import backend
import asyncio

def test_users_event():
    actual = backend.users_event()
    expected = '{"type": "users", "count": 0, "usernames": []}'
    assert actual == expected

def test_draw_event():
    actual = backend.draw_event()
    expected = '{"type": "draw", "shape": "", "ID": "", "color": "", "XStartPosition": 0, "YStartPosition": 0, ' \
               '"XEndPosition": 0, "YEndPosition": 0, "title": "", "assignee": "", "description": ""}'
    assert actual == expected

def test_drag_drop_event():
    actual = backend.drag_drop_event()
    expected = '{"type": "drag-drop", "ID": "", "XStartPosition": 0, "YStartPosition": 0}'
    assert actual == expected

def test_delete_event():
    actual = backend.delete_event()
    expected = '{"type": "delete", "ID": ""}'
    assert actual == expected

def test_board_state_event():
    actual = backend.board_state_event()
    expected = '{"type": "board-state", "drawings": []}'
    assert actual == expected

def test_register():
    try:
      asyncio.run(backend.register(1))

      ''' AttributeError is from not passing in correct parameter for another function, but we're not worried about
    testing that function here '''
    except AttributeError:
      pass
    assert len(backend.USERS) == 1

def test_unregister():
    backend.USERS[1] = ""
    try:
      asyncio.run(backend.unregister(1))

      ''' AttributeError is from not passing in correct parameter for another function, but we're not worried about that
    testing that function here '''
    except AttributeError:
      pass
    assert len(backend.USERS) == 0

def test_backup_board_state():
    backend.BOARD_STATE = {}
    backend.board_state_event()
    actual = backend.load_backup_file()
    expected = {}
    assert actual == expected

def test_update_event():
    actual = backend.update_event()
    expected = '{"type": "update", "ID": "", "color": "", "title": "", "assignee": "", "description": ""}'
    assert actual == expected

if __name__ == "__main__":
    test_users_event()
    test_draw_event()
    test_drag_drop_event()
    test_delete_event()
    test_board_state_event()
    test_register()
    test_unregister()
    test_backup_board_state()