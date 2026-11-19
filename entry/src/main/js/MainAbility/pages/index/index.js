import router from '@system.router';
import textEngine from '../../common/text_engine.js';
import notesStore from '../../common/notes_store.js';

export default {
  data: {
    fontSizeLevel: 1,
    fontLabel: 'Cỡ: Vừa',
    summaryText: 'Hiển thị 100% không cắt chữ',
    noteCards: []
  },

  onInit() {
    var self = this;
    notesStore.initStore(function(notes, state) {
      self.fontSizeLevel = state.fontSizeLevel;
      self.applyLookAndBuildCards(notes);
    });
  },

  applyLookAndBuildCards(notesList) {
    var notes = notesList || notesStore.getMergedNotes();
    var preset = textEngine.getFontPreset(this.fontSizeLevel);
    this.fontLabel = 'Cỡ: ' + preset.label;
    this.summaryText = notes.length + ' ghi chú • Chạm để đọc';

    var cards = [];
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var titleLines = textEngine.wrapTextToLines(n.title, 13.8);
      var bodyLines = textEngine.wrapTextToLines(n.content, preset.maxBodyUnits);
      var previewLines = textEngine.wrapTextToLines(n.content, 16.4);

      var totalLines = bodyLines.length;
      var totalPages = Math.ceil(totalLines / 35);
      if (totalPages < 1) {
        totalPages = 1;
      }

      var savedPage = notesStore.getBookmark(n.id);
      if (savedPage >= totalPages) {
        savedPage = 0;
      }

      var tLine1 = titleLines.length > 0 ? titleLines[0] : 'Ghi chú';
      var tLine2 = '';
      if (titleLines.length === 2) {
        tLine2 = titleLines[1];
      } else if (titleLines.length > 2) {
        tLine2 = titleLines[1] + ' (+' + (titleLines.length - 2) + ')';
      }

      var pLine1 = previewLines.length > 0 ? previewLines[0] : '';
      var pLine2 = previewLines.length > 1 ? previewLines[1] : '';

      var bookmarkHint = 'Đọc toàn văn (' + totalLines + ' dòng) »';
      if (savedPage > 0) {
        bookmarkHint = 'Đọc tiếp Trang ' + (savedPage + 1) + '/' + totalPages + ' »';
      }

      cards.push({
        id: n.id,
        orderNum: i + 1,
        updatedAt: n.updatedAt || 'Ghi chú',
        statsText: totalLines + ' dòng • ' + totalPages + ' tr',
        titleLine1: tLine1,
        titleLine2: tLine2,
        hasTitleLine2: tLine2.length > 0,
        previewLine1: pLine1,
        previewLine2: pLine2,
        bookmarkHint: bookmarkHint
      });
    }
    this.noteCards = cards;
  },

  openNote(noteId) {
    router.replace({
      uri: 'pages/reader/reader',
      params: {
        noteId: noteId
      }
    });
  },

  goSyncFromPhone() {
    router.replace({
      uri: 'pages/sync/sync'
    });
  },

  cycleFontSize() {
    this.fontSizeLevel = (this.fontSizeLevel + 1) % 3;
    notesStore.saveSettings(this.fontSizeLevel);
    this.applyLookAndBuildCards();
  },

  resetNotes() {
    var self = this;
    notesStore.resetAllNotes(function() {
      self.applyLookAndBuildCards();
    });
  }
};
