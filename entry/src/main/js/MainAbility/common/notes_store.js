import storage from '@system.storage';
import file from '@system.file';
import notesData from './notes_data.js';

var KEY_SETTINGS = 'fit3_notes_settings_v1';
var KEY_BOOKMARKS = 'fit3_notes_bookmarks_v1';
var KEY_CUSTOM_NOTES_BACKUP = 'fit3_custom_notes_v1';
var CUSTOM_NOTES_FILE_URI = 'internal://app/custom_notes_v2.json';

var memoryCache = {
  loaded: false,
  customNotes: [],
  deletedIds: [],
  fontSizeLevel: 1,
  bookmarks: {}
};

function cloneNote(n) {
  return {
    id: String(n.id || ''),
    title: String(n.title || 'Ghi chú'),
    updatedAt: String(n.updatedAt || 'Mới'),
    content: String(n.content || ''),
    isCustom: Boolean(n.isCustom)
  };
}

function getMergedNotes() {
  var list = [];
  var i;
  for (i = 0; i < memoryCache.customNotes.length; i++) {
    var cn = memoryCache.customNotes[i];
    if (memoryCache.deletedIds.indexOf(cn.id) === -1) {
      list.push(cloneNote(cn));
    }
  }
  var defaults = notesData.DEFAULT_NOTES || [];
  for (i = 0; i < defaults.length; i++) {
    var dn = defaults[i];
    if (memoryCache.deletedIds.indexOf(dn.id) === -1) {
      list.push(cloneNote(dn));
    }
  }
  return list;
}

function applyParsedCustomData(text, callback) {
  if (!text) {
    return false;
  }
  try {
    var parsed = JSON.parse(text);
    if (parsed) {
      if (Array.isArray(parsed.customNotes)) {
        memoryCache.customNotes = parsed.customNotes;
      }
      if (Array.isArray(parsed.deletedIds)) {
        memoryCache.deletedIds = parsed.deletedIds;
      }
      if (callback) {
        callback(getMergedNotes(), memoryCache);
      }
      return true;
    }
  } catch (e) {}
  return false;
}

function initStore(callback) {
  if (callback) {
    callback(getMergedNotes(), memoryCache);
  }
  if (memoryCache.loaded) {
    return;
  }
  memoryCache.loaded = true;

  try {
    storage.get({
      key: KEY_SETTINGS,
      default: '',
      success: function(data) {
        if (data) {
          try {
            var parsed = JSON.parse(data);
            if (parsed && parsed.fontSizeLevel !== undefined) {
              memoryCache.fontSizeLevel = Number(parsed.fontSizeLevel);
              if (callback) {
                callback(getMergedNotes(), memoryCache);
              }
            }
          } catch (e) {}
        }
      }
    });

    storage.get({
      key: KEY_BOOKMARKS,
      default: '',
      success: function(data) {
        if (data) {
          try {
            var parsed = JSON.parse(data);
            if (parsed) {
              memoryCache.bookmarks = parsed;
              if (callback) {
                callback(getMergedNotes(), memoryCache);
              }
            }
          } catch (e) {}
        }
      }
    });
  } catch (err) {}

  // Ưu tiên đọc file flash internal://app/custom_notes_v2.json (lưu được ghi chú dài hàng chục KB)
  try {
    file.readText({
      uri: CUSTOM_NOTES_FILE_URI,
      success: function(res) {
        if (res && res.text) {
          applyParsedCustomData(res.text, callback);
        }
      },
      fail: function() {
        try {
          storage.get({
            key: KEY_CUSTOM_NOTES_BACKUP,
            default: '',
            success: function(data) {
              if (data) {
                applyParsedCustomData(data, callback);
              }
            }
          });
        } catch (e2) {}
      }
    });
  } catch (err2) {
    try {
      storage.get({
        key: KEY_CUSTOM_NOTES_BACKUP,
        default: '',
        success: function(data) {
          if (data) {
            applyParsedCustomData(data, callback);
          }
        }
      });
    } catch (e3) {}
  }
}

function saveSettings(fontSizeLevel) {
  memoryCache.fontSizeLevel = Number(fontSizeLevel);
  try {
    storage.set({
      key: KEY_SETTINGS,
      value: JSON.stringify({
        fontSizeLevel: memoryCache.fontSizeLevel
      })
    });
  } catch (e) {}
}

function saveBookmark(noteId, pageIndex) {
  if (!noteId) {
    return;
  }
  memoryCache.bookmarks[noteId] = Number(pageIndex) || 0;
  try {
    storage.set({
      key: KEY_BOOKMARKS,
      value: JSON.stringify(memoryCache.bookmarks)
    });
  } catch (e) {}
}

function getBookmark(noteId) {
  if (!noteId || memoryCache.bookmarks[noteId] === undefined) {
    return 0;
  }
  return Number(memoryCache.bookmarks[noteId]) || 0;
}

function persistCustomNotes(callback) {
  var payload = JSON.stringify({
    customNotes: memoryCache.customNotes,
    deletedIds: memoryCache.deletedIds
  });
  var called = false;
  function done() {
    if (!called) {
      called = true;
      if (callback) {
        callback();
      }
    }
  }

  try {
    storage.set({
      key: KEY_CUSTOM_NOTES_BACKUP,
      value: payload
    });
  } catch (e) {}

  try {
    file.writeText({
      uri: CUSTOM_NOTES_FILE_URI,
      text: payload,
      complete: function() {
        done();
      }
    });
  } catch (e2) {
    done();
  }
  // Đảm bảo callback luôn được gọi ngay cả trên PC Previewer
  done();
}

function addOrAppendNote(title, content, appendToId, callback) {
  var createdId = '';
  if (appendToId) {
    var i;
    var foundCustom = false;
    for (i = 0; i < memoryCache.customNotes.length; i++) {
      if (memoryCache.customNotes[i].id === appendToId) {
        memoryCache.customNotes[i].content += '\n' + content;
        memoryCache.customNotes[i].updatedAt = 'Đã sửa';
        createdId = appendToId;
        foundCustom = true;
        break;
      }
    }
    if (!foundCustom) {
      var all = getMergedNotes();
      for (i = 0; i < all.length; i++) {
        if (all[i].id === appendToId) {
          var copy = cloneNote(all[i]);
          copy.content = copy.content + '\n' + content;
          copy.updatedAt = 'Đã sửa';
          copy.isCustom = true;
          memoryCache.deletedIds.push(appendToId);
          copy.id = 'custom_' + new Date().getTime();
          createdId = copy.id;
          memoryCache.customNotes.unshift(copy);
          break;
        }
      }
    }
  } else {
    createdId = 'phone_' + new Date().getTime();
    var newNote = {
      id: createdId,
      title: title || 'Ghi chú từ ĐT',
      updatedAt: 'Từ Điện thoại',
      content: content || '',
      isCustom: true
    };
    memoryCache.customNotes.unshift(newNote);
  }
  persistCustomNotes(function() {
    if (callback) {
      callback(createdId);
    }
  });
  return createdId;
}

function deleteNoteById(noteId, callback) {
  if (!noteId) {
    if (callback) {
      callback();
    }
    return;
  }
  var nextCustom = [];
  for (var i = 0; i < memoryCache.customNotes.length; i++) {
    if (memoryCache.customNotes[i].id !== noteId) {
      nextCustom.push(memoryCache.customNotes[i]);
    }
  }
  memoryCache.customNotes = nextCustom;
  if (memoryCache.deletedIds.indexOf(noteId) === -1) {
    memoryCache.deletedIds.push(noteId);
  }
  persistCustomNotes(callback);
}

function resetAllNotes(callback) {
  memoryCache.customNotes = [];
  memoryCache.deletedIds = [];
  memoryCache.bookmarks = {};
  try {
    storage.delete({ key: KEY_BOOKMARKS });
    storage.delete({ key: KEY_CUSTOM_NOTES_BACKUP });
  } catch (e) {}
  try {
    file.delete({ uri: CUSTOM_NOTES_FILE_URI });
  } catch (e2) {}
  if (callback) {
    callback();
  }
}

function getNoteById(noteId) {
  var list = getMergedNotes();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === noteId) {
      return list[i];
    }
  }
  return list.length > 0 ? list[0] : null;
}

export default {
  initStore: initStore,
  getMergedNotes: getMergedNotes,
  getNoteById: getNoteById,
  saveSettings: saveSettings,
  saveBookmark: saveBookmark,
  getBookmark: getBookmark,
  addOrAppendNote: addOrAppendNote,
  deleteNoteById: deleteNoteById,
  resetAllNotes: resetAllNotes,
  getState: function() {
    return memoryCache;
  }
};
