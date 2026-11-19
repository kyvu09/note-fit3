/**
 * File này được tạo tự động bởi sync-notes.ps1 từ thư mục notes_txt/
 */
var DEFAULT_NOTES = [
    {
        "id":  "note_1",
        "title":  "Hướng dẫn đọc ghi chú siêu dài trên Watch Fit 3 (Không bao giờ mất chữ)",
        "updatedAt":  "18-11 22:27",
        "content":  "Chào mừng bạn đến với ứng dụng Ghi Chú Full-Text dành riêng cho Huawei Watch Fit 3!\n\n1. TẠI SAO CÁC APP KHÁC BỊ ẨN / CẮT CHỮ?\nTrên hệ điều hành Lite Wearable của đồng hồ Huawei, mỗi khung văn bản \u003ctext\u003e và mỗi dòng \u003clist-item\u003e đều bị giới hạn kích thước khung cố định. Nếu đổ cả một đoạn văn dài vào một khung \u003ctext\u003e, phần chữ tràn ra ngoài sẽ bị cắt cụt hoặc biến thành dấu ba chấm (...).\n\n2. CƠ CHẾ HIỂN THỊ 100% KHÔNG MẤT CHỮ CỦA APP NÀY:\n- Tự động đo độ rộng từng chữ cái tiếng Việt (kể cả chữ in hoa rộng như W, M, Đ, Ư, Ơ và dấu thanh).\n- Tự động tách văn bản dài thành từng dòng vừa khít màn hình 408x480px của Watch Fit 3.\n- Ngay cả một chuỗi ký tự liền nhau không có khoảng trắng như https://developer.huawei.com/consumer/en/doc/lite-wearable-full-text-reader cũng được tự động ngắt dòng an toàn mà không mất một ký tự nào!\n\n3. THAO TÁC KHI ĐỌC TRÊN ĐỒNG HỒ:\n- Vuốt lên/xuống hoặc xoay núm vặn (Crown) của Watch Fit 3 để cuộn đọc từng dòng mượt mà.\n- Bấm nút [A-] / [A+] ở thanh trên cùng để thu nhỏ hoặc phóng to cỡ chữ (Nhỏ 22px, Vừa 26px, To 30px). Khi đổi cỡ chữ, toàn bộ ghi chú sẽ tự động dàn trang lại ngay lập tức!\n- Bấm nút [Màu] để chuyển đổi giữa 3 giao diện: Đen AMOLED tiết kiệm pin, Vàng Dịu Mắt (Sepia) để đọc ban đêm, và Xanh Đêm.\n- Với các văn bản dài hàng nghìn từ, ứng dụng tự động chia thành từng Trang (35 dòng/trang) kèm nút [Trang trước] / [Trang sau] và tự động lưu lại trang bạn đang đọc dở!"
    },
    {
        "id":  "note_2",
        "title":  "Bài kiểm tra văn bản cực dài (Nhiều chương \u0026 đoạn văn liên tục)",
        "updatedAt":  "18-11 22:27",
        "content":  "--- PHẦN 1: KIỂM TRA ĐỘ DÀI KHÔNG GIỚI HẠN ---\nĐây là bài kiểm tra văn bản dài nhiều trang liên tiếp để bạn kiểm chứng trực tiếp trên mặt đồng hồ Huawei Watch Fit 3. Dù nội dung có kéo dài bao nhiêu dòng, bạn luôn có thể cuộn từ dòng đầu tiên đến dòng cuối cùng.\n\n--- PHẦN 2: KIỂM TRA TIẾNG VIỆT ĐẦY ĐỦ DẤU ---\nTrăm năm trong cõi người ta,\nChữ tài chữ mệnh khéo là ghét nhau.\nTrải qua một cuộc bể dâu,\nNhững điều trông thấy mà đau đớn lòng.\nLạ gì bỉ sắc tư phong,\nTrời xanh quen thói má hồng đánh ghen.\nCảo thơm lần giở trước đèn,\nPhong tình cổ lục còn truyền sử xanh.\n\n--- PHẦN 3: DANH SÁCH KIỂM TRA CHI TIẾT ---\n[01] Kiểm tra dòng tiêu đề dài không bị cắt dấu ba chấm.\n[02] Kiểm tra đoạn văn xuôi dài hàng trăm từ liên tục không xuống dòng vẫn tự động tách dòng chuẩn xác.\n[03] Kiểm tra các ký tự đặc biệt: @ # $ % \u0026 * ( ) _ + - = [ ] / ? ! : ; .\n[04] Kiểm tra dãy số dài liên tục: 0123456789012345678901234567890123456789.\n[05] Kiểm tra chuyển đổi cỡ chữ Nhỏ (22px) -\u003e Vừa (26px) -\u003e To (30px) không làm tràn khung ngang.\n[06] Kiểm tra chuyển trang mượt mà từ Trang 1 sang Trang 2, Trang 3 và tự động ghi nhớ vị trí trang đang đọc.\n\n--- PHẦN 4: ĐOẠN KẾT KIỂM TRA ---\nNếu bạn đọc được dòng chữ cuối cùng này kèm mã xác nhận [HOÀN_TẤT_100%_KHÔNG_MẤT_CHỮ], nghĩa là toàn bộ văn bản từ đầu đến cuối đã được hiển thị trọn vẹn tuyệt đối trên đồng hồ của bạn!"
    },
    {
        "id":  "note_3",
        "title":  "Checklist công việc \u0026 lịch trình hằng ngày",
        "updatedAt":  "18-11 22:27",
        "content":  "BUỔI SÁNG:\n- 06:30: Chạy bộ 5km \u0026 theo dõi nhịp tim trên Watch Fit 3.\n- 08:30: Họp sprint đầu tuần, rà soát các đầu việc quan trọng.\n- 10:00: Hoàn thiện tính năng hiển thị ghi chú đầy đủ cho đồng hồ.\n\nBUỔI CHIỀU:\n- 14:00: Kiểm tra bản build file .hap và cài qua DevEco Assistant.\n- 16:30: Tổng hợp tài liệu hướng dẫn sử dụng.\n\nBUỔI TỐI:\n- 20:00: Đọc sách / ôn tập ghi chú ngay trên cổ tay."
    }
];

export default {
  DEFAULT_NOTES: DEFAULT_NOTES
};
