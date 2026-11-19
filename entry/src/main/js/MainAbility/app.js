export default {
  data: {
    selectedNoteId: 'note_1',
    fontSizeLevel: 1, // 0: Nhỏ (22px), 1: Vừa (26px), 2: To (30px)
    themeIndex: 0     // 0: Tối AMOLED, 1: Vàng dịu mắt (Sepia), 2: Xanh đêm
  },
  onCreate() {
    console.info('Ghi Chu Fit 3 App onCreate');
  },
  onDestroy() {
    console.info('Ghi Chu Fit 3 App onDestroy');
  }
};
