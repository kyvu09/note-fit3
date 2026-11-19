import router from '@system.router';
import textEngine from '../../common/text_engine.js';
import notesStore from '../../common/notes_store.js';

var LINES_PER_PAGE = 35;

export default {
  data: {
    noteId: 'note_1',
    fontSizeLevel: 1,
    isSmallFont: false,
    isMidFont: true,
    isLargeFont: false,
    noteTitle: '',
    noteContent: '',
    titleLines: [],
    allBodyLines: [],
    pageLines: [],
    currentPage: 0,
    totalPages: 1,
    hasMultiplePages: false,
    pageInfoText: '',
    pageShortText: '1 / 1',
    endOfPageText: '',
    confirmDelete: false,
    deleteBtnText: 'Xóa ghi chú'
  },

  onInit() {
    var self = this;
    notesStore.initStore(function(notes, state) {
      self.fontSizeLevel = state.fontSizeLevel;
      var targetNote = notesStore.getNoteById(self.noteId);
      if (!targetNote && notes.length > 0) {
        targetNote = notes[0];
      }
      if (targetNote) {
        self.noteId = targetNote.id;
        self.noteTitle = targetNote.title;
        self.noteContent = targetNote.content;
        self.currentPage = notesStore.getBookmark(self.noteId);
      } else {
        self.noteTitle = 'Không tìm thấy ghi chú';
        self.noteContent = 'Danh sách ghi chú hiện đang trống.';
        self.currentPage = 0;
      }
      self.rebuildLayout(false);
    });
  },

  rebuildLayout(keepRelativeLine) {
    var oldTopLineIndex = this.currentPage * LINES_PER_PAGE;
    var preset = textEngine.getFontPreset(this.fontSizeLevel);

    this.isSmallFont = this.fontSizeLevel === 0;
    this.isMidFont = this.fontSizeLevel === 1;
    this.isLargeFont = this.fontSizeLevel === 2;

    this.titleLines = textEngine.wrapTextToLines(this.noteTitle, preset.maxTitleUnits);
    this.allBodyLines = textEngine.wrapTextToLines(this.noteContent, preset.maxBodyUnits);

    var totalLines = this.allBodyLines.length;
    var pages = Math.ceil(totalLines / LINES_PER_PAGE);
    if (pages < 1) {
      pages = 1;
    }
    this.totalPages = pages;
    this.hasMultiplePages = pages > 1;

    if (keepRelativeLine) {
      this.currentPage = Math.floor(oldTopLineIndex / LINES_PER_PAGE);
    }
    if (this.currentPage >= this.totalPages) {
      this.currentPage = this.totalPages - 1;
    }
    if (this.currentPage < 0) {
      this.currentPage = 0;
    }

    this.updateCurrentPageSlice(preset);
  },

  updateCurrentPageSlice(fontPreset) {
    var preset = fontPreset || textEngine.getFontPreset(this.fontSizeLevel);
    var totalLines = this.allBodyLines.length;
    var startLine = this.currentPage * LINES_PER_PAGE;
    var endLine = startLine + LINES_PER_PAGE;
    if (endLine > totalLines) {
      endLine = totalLines;
    }

    var slice = [];
    for (var i = startLine; i < endLine; i++) {
      slice.push(this.allBodyLines[i]);
    }
    if (slice.length === 0) {
      slice.push(' ');
    }
    this.pageLines = slice;

    var displayPage = this.currentPage + 1;
    this.pageShortText = displayPage + ' / ' + this.totalPages;
    this.pageInfoText =
      'Tr.' + displayPage + '/' + this.totalPages +
      ' • Dòng ' + (startLine + 1) + '-' + endLine + '/' + totalLines +
      ' • ' + preset.label;

    if (displayPage < this.totalPages) {
      this.endOfPageText = '--- Hết trang ' + displayPage + '/' + this.totalPages + ' (Bấm Trang sau) ---';
    } else {
      this.endOfPageText = '--- Đã hiển thị 100% (' + totalLines + '/' + totalLines + ' dòng) ---';
    }

    notesStore.saveBookmark(this.noteId, this.currentPage);
  },

  smallerFont() {
    if (this.fontSizeLevel > 0) {
      this.fontSizeLevel = this.fontSizeLevel - 1;
    } else {
      this.fontSizeLevel = 0;
    }
    notesStore.saveSettings(this.fontSizeLevel);
    this.rebuildLayout(true);
  },

  largerFont() {
    if (this.fontSizeLevel < 2) {
      this.fontSizeLevel = this.fontSizeLevel + 1;
    } else {
      this.fontSizeLevel = 2;
    }
    notesStore.saveSettings(this.fontSizeLevel);
    this.rebuildLayout(true);
  },

  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage = this.currentPage - 1;
      this.updateCurrentPageSlice();
    }
  },

  nextPage() {
    if (this.currentPage + 1 < this.totalPages) {
      this.currentPage = this.currentPage + 1;
      this.updateCurrentPageSlice();
    }
  },

  firstPage() {
    if (this.currentPage !== 0) {
      this.currentPage = 0;
      this.updateCurrentPageSlice();
    }
  },

  lastPage() {
    var last = this.totalPages - 1;
    if (last >= 0 && this.currentPage !== last) {
      this.currentPage = last;
      this.updateCurrentPageSlice();
    }
  },

  jumpBack5() {
    var target = this.currentPage - 5;
    if (target < 0) {
      target = 0;
    }
    this.currentPage = target;
    this.updateCurrentPageSlice();
  },

  jumpForward5() {
    var target = this.currentPage + 5;
    if (target >= this.totalPages) {
      target = this.totalPages - 1;
    }
    this.currentPage = target;
    this.updateCurrentPageSlice();
  },

  handleDeleteTap() {
    if (!this.confirmDelete) {
      this.confirmDelete = true;
      this.deleteBtnText = 'Chạm lại để xóa';
      return;
    }
    notesStore.deleteNoteById(this.noteId, function() {
      router.replace({
        uri: 'pages/index/index'
      });
    });
  },

  goBack() {
    router.replace({
      uri: 'pages/index/index'
    });
  }
};
