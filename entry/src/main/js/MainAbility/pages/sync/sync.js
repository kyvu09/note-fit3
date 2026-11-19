import router from '@system.router';
import fetch from '@system.fetch';
import brightness from '@system.brightness';
import vibrator from '@system.vibrator';
import notesStore from '../../common/notes_store.js';
import syncConfig from '../../common/sync_config.js';

// Kênh đồng bộ riêng đọc từ sync_config.js (tự động sinh từ file .env khi chạy build-hap.ps1)
var CHANNEL_PREFIX = syncConfig.CHANNEL_PREFIX;
var RELAY_BASE = syncConfig.RELAY_BASE;
// Thời gian nghỉ giữa 2 lượt fetch để LiteOS giải phóng hoàn toàn socket (tránh lỗi -9)
var FETCH_COOLDOWN_MS = 500;

function extractLastNtfyMessage(resData) {
  if (resData === null || resData === undefined) {
    return '';
  }
  if (typeof resData === 'object') {
    if (typeof resData.message === 'string') {
      return resData.message;
    }
    return '';
  }
  var text = String(resData);
  var lines = text.split('\n');
  for (var i = lines.length - 1; i >= 0; i--) {
    var line = lines[i];
    if (!line) {
      continue;
    }
    while (line.length > 0 && (line.charAt(0) === ' ' || line.charAt(0) === '\r' || line.charAt(0) === '\t')) {
      line = line.substring(1);
    }
    while (line.length > 0 && (line.charAt(line.length - 1) === ' ' || line.charAt(line.length - 1) === '\r' || line.charAt(line.length - 1) === '\t')) {
      line = line.substring(0, line.length - 1);
    }
    if (line.length < 2 || line.charAt(0) !== '{') {
      continue;
    }
    try {
      var obj = JSON.parse(line);
      if (obj && obj.event === 'message' && typeof obj.message === 'string') {
        return obj.message;
      }
      if (obj && typeof obj.message === 'string') {
        return obj.message;
      }
    } catch (e) {}
  }
  return '';
}

export default {
  data: {
    statusTitle: 'Sẵn sàng đồng bộ',
    progressText: 'Đang kiểm tra...',
    subStatusText: 'Gửi trên ĐT rồi bấm Tải mới',
    diagNetText: 'Mạng: chờ kết nối',
    diagDetailText: 'Kênh: ' + CHANNEL_PREFIX,
    hasReceivedNote: false,
    receivedNoteId: '',
    receivedShortTitle: '',
    isBusy: false,
    collectedParts: [],
    currentMeta: null,
    pendingTimerId: null,
    isPageAlive: true
  },

  onInit() {
    var self = this;
    this.isPageAlive = true;

    try {
      brightness.setKeepScreenOn({
        keepScreenOn: true
      });
    } catch (e) {}

    notesStore.initStore(function() {
      self.fetchLatestNote();
    });
  },

  scheduleNext(fn, delayMs) {
    var self = this;
    if (this.pendingTimerId !== null) {
      clearTimeout(this.pendingTimerId);
      this.pendingTimerId = null;
    }
    this.pendingTimerId = setTimeout(function() {
      self.pendingTimerId = null;
      if (self.isPageAlive) {
        fn();
      }
    }, delayMs);
  },

  fetchLatestNote() {
    if (this.isBusy) {
      return;
    }
    if (!fetch || typeof fetch.fetch !== 'function') {
      this.statusTitle = 'Thiếu API fetch';
      this.diagNetText = 'fetch = undefined';
      return;
    }

    this.isBusy = true;
    this.statusTitle = 'Đang kết nối ĐT...';
    this.progressText = 'Đang tìm ghi chú mới';
    this.subStatusText = 'Qua Huawei Health (HTTPS)';
    this.diagNetText = 'GET manifest...';

    this.queryRelayManifest('15m', 0);
  },

  queryRelayManifest(sinceWindow, retryCount) {
    var self = this;
    var url = RELAY_BASE + CHANNEL_PREFIX + '_latest/json?poll=1&since=' + sinceWindow;
    var nextAction = null;

    try {
      fetch.fetch({
        url: url,
        method: 'GET',
        responseType: 'text',
        success: function(res) {
          var httpCode = res ? res.code : 0;
          var bodyStr = res && res.data !== undefined && res.data !== null ? String(res.data) : '';
          self.diagNetText = 'Manifest HTTP ' + httpCode + ' (' + bodyStr.length + 'B)';

          var msgStr = extractLastNtfyMessage(res ? res.data : '');
          if (!msgStr || msgStr.length === 0) {
            if (sinceWindow === '15m') {
              self.diagDetailText = '15p trống, thử 12h...';
              nextAction = function() {
                self.queryRelayManifest('all', 0);
              };
              return;
            }
            self.isBusy = false;
            self.statusTitle = 'Chưa có ghi chú mới';
            self.progressText = 'Hãy bấm Gửi trên ĐT';
            self.subStatusText = 'Rồi bấm [↻ Tải mới] tại đây';
            self.diagDetailText = 'Kênh đang trống';
            return;
          }

          var meta = null;
          try {
            meta = JSON.parse(msgStr);
          } catch (e) {}

          if (!meta || !meta.id || !meta.n || meta.n <= 0) {
            self.isBusy = false;
            self.statusTitle = 'Lỗi định dạng meta';
            self.diagDetailText = msgStr.substring(0, 26);
            return;
          }

          self.currentMeta = meta;
          self.collectedParts = [];
          self.subStatusText = meta.t ? String(meta.t) : 'Ghi chú từ ĐT';

          // Tối ưu 1-request: Nếu bài ngắn đã nhúng sẵn nội dung "c" trong manifest -> Lưu ngay lập tức!
          if (typeof meta.c === 'string' && meta.c.length > 0 && meta.n === 1) {
            self.collectedParts.push(meta.c);
            self.diagDetailText = 'Tải nhanh 1 lượt (ID=' + meta.id + ')';
            self.finishDownloadedNote();
            return;
          }

          // Bài nhiều phần: CHỜ complete() + 500ms để LiteOS nhả socket rồi mới fetch phần 0 (tránh lỗi -9!)
          self.statusTitle = 'Đang tải ghi chú...';
          self.progressText = 'Chuẩn bị 0/' + meta.n + ' phần';
          self.diagDetailText = 'ID=' + meta.id + ' (' + meta.n + ' phần)';
          nextAction = function() {
            self.fetchNextRelayPart(0, 0);
          };
        },
        fail: function(data, code) {
          if (retryCount < 2) {
            self.diagNetText = 'Thử lại (' + String(code) + ')...';
            nextAction = function() {
              self.queryRelayManifest(sinceWindow, retryCount + 1);
            };
            return;
          }
          self.isBusy = false;
          self.statusTitle = 'Lỗi kết nối HTTPS';
          self.progressText = 'Mã lỗi: ' + String(code);
          self.subStatusText = 'Kiểm tra Huawei Health & mạng ĐT';
          self.diagNetText = 'Fail: ' + String(code);
          self.diagDetailText = String(data).substring(0, 28);
        },
        complete: function() {
          if (nextAction !== null) {
            self.scheduleNext(nextAction, FETCH_COOLDOWN_MS);
          }
        }
      });
    } catch (ex) {
      self.isBusy = false;
      self.statusTitle = 'Lỗi gọi fetch';
      self.diagNetText = 'Ex: ' + String(ex).substring(0, 24);
    }
  },

  fetchNextRelayPart(partIdx, retryCount) {
    var self = this;
    var meta = this.currentMeta;
    if (!meta || partIdx >= meta.n) {
      this.finishDownloadedNote();
      return;
    }

    var pct = Math.floor((partIdx * 100) / meta.n);
    this.progressText = 'Phần ' + (partIdx + 1) + '/' + meta.n + ' (' + pct + '%)';

    var url = RELAY_BASE + CHANNEL_PREFIX + '_' + meta.id + '_' + partIdx + '/json?poll=1&since=all';
    var nextAction = null;

    try {
      fetch.fetch({
        url: url,
        method: 'GET',
        responseType: 'text',
        success: function(res) {
          var chunkText = extractLastNtfyMessage(res ? res.data : '');
          self.collectedParts.push(chunkText);
          self.diagNetText = 'OK phần ' + (partIdx + 1) + '/' + meta.n;
          if (partIdx + 1 >= meta.n) {
            self.finishDownloadedNote();
          } else {
            nextAction = function() {
              self.fetchNextRelayPart(partIdx + 1, 0);
            };
          }
        },
        fail: function(data, code) {
          // Nếu dính lỗi bận socket (-9) hoặc rớt tạm thời, tự chờ 800ms rồi thử lại tối đa 3 lần!
          if (retryCount < 3) {
            self.diagNetText = 'Thử lại P' + (partIdx + 1) + ' (' + String(code) + ')';
            nextAction = function() {
              self.fetchNextRelayPart(partIdx, retryCount + 1);
            };
            return;
          }
          self.isBusy = false;
          self.statusTitle = 'Lỗi tải phần ' + (partIdx + 1);
          self.progressText = 'Mã lỗi: ' + String(code);
          self.diagNetText = 'PartFail: ' + String(code);
          self.diagDetailText = String(data).substring(0, 28);
        },
        complete: function() {
          if (nextAction !== null) {
            var waitMs = retryCount > 0 ? 850 : FETCH_COOLDOWN_MS;
            self.scheduleNext(nextAction, waitMs);
          }
        }
      });
    } catch (ex) {
      self.isBusy = false;
      self.statusTitle = 'Lỗi ngoại lệ tải phần';
      self.diagDetailText = String(ex).substring(0, 28);
    }
  },

  finishDownloadedNote() {
    this.isBusy = false;
    var meta = this.currentMeta;
    var title = (meta && meta.t) ? String(meta.t) : 'Ghi chú từ Điện thoại';
    var content = this.collectedParts.join('');
    if (!content || content.length === 0) {
      content = title;
    }

    var newId = notesStore.addOrAppendNote(title, content, '', function() {});
    this.receivedNoteId = newId;
    this.receivedShortTitle = title.length > 16 ? (title.substring(0, 16) + '...') : title;
    this.hasReceivedNote = true;
    this.statusTitle = '✓ Đã nhận & lưu 100%!';
    this.progressText = content.length + ' ký tự (' + meta.n + ' phần)';
    this.subStatusText = title;
    this.diagNetText = 'Hoàn tất & đã lưu Flash!';

    try {
      vibrator.vibrate({
        mode: 'short'
      });
    } catch (e) {}
  },

  openReceivedNote() {
    this.cleanupPage();
    router.replace({
      uri: 'pages/reader/reader',
      params: {
        noteId: this.receivedNoteId
      }
    });
  },

  cleanupPage() {
    this.isPageAlive = false;
    if (this.pendingTimerId !== null) {
      clearTimeout(this.pendingTimerId);
      this.pendingTimerId = null;
    }
    try {
      brightness.setKeepScreenOn({
        keepScreenOn: false
      });
    } catch (e) {}
  },

  goBack() {
    this.cleanupPage();
    router.replace({
      uri: 'pages/index/index'
    });
  },

  onDestroy() {
    this.cleanupPage();
  }
};
