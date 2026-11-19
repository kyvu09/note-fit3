# Ghi Chú Fit 3 (Full-Text Notes cho Huawei Watch Fit 3)

Ứng dụng ghi chú dành riêng cho **Huawei Watch Fit 3** (`liteWearable`), được thiết kế để **hiển thị 100% toàn bộ văn bản dù dài đến mấy mà không bao giờ bị ẩn hay cắt mất chữ (`...`)**.

---

## 1. Tại sao app này không bao giờ bị mất/cắt chữ trên Watch Fit 3?

Trên hệ điều hành Lite Wearable (nhân `ACE Lite` + `JerryScript`) của Huawei Watch Fit 3:
1. Mỗi thẻ `<text>` và mỗi dòng `<list-item>` bắt buộc phải khai báo chiều rộng và chiều cao cố định bằng pixel (`px`), không có `height: auto`. Nếu đặt cả đoạn văn dài vào một thẻ `<text>`, phần chữ tràn khung sẽ bị cắt mất hoặc biến thành dấu `...`.
2. Nếu tạo quá nhiều node DOM cùng lúc (hàng nghìn dòng), bộ nhớ RAM `JerryScript` của đồng hồ sẽ bị quá tải.

**Giải pháp trong [text_engine.js](file:///c:/personal_kyvu/CODE/build-app-fit3/entry/src/main/js/MainAbility/common/text_engine.js):**
* **Đo độ rộng từng ký tự tiếng Việt:** Tính toán chính xác độ rộng hiển thị của chữ thường, chữ in hoa rộng (`W`, `M`, `Đ`, `Ư`, `Ơ`), dấu tiếng Việt, chữ số và tự động ngắt dòng an toàn (kể cả chuỗi URL hoặc mã dài không có khoảng trắng).
* **1 Dòng = 1 `<list-item>`:** Cả tiêu đề lẫn nội dung đều được tách sẵn thành từng dòng vừa khít khung `356px` bên trong màn hình `408 × 480 px` của Watch Fit 3, giúp cuộn mượt bằng thao tác vuốt hoặc xoay núm **Crown** mà không một dòng nào bị cắt.
* **Phân trang thông minh & Lưu vị trí đọc (`35 dòng/trang`):** Với ghi chú dài hàng nghìn chữ, ứng dụng tự động chia thành các trang cuộn 35 dòng kèm nút `« Trang trước` / `Trang sau »`, nhảy nhanh `Đầu / -5 / +5 / Cuối`, và tự động nhớ trang đang đọc dở vào bộ nhớ đồng hồ (`@system.storage`).
* **Đổi cỡ chữ & màu nền trực tiếp trên đồng hồ:** Hỗ trợ 3 mức cỡ chữ (`Nhỏ 22px`, `Vừa 26px`, `To 30px` - tự động dàn lại dòng khi đổi cỡ) và 3 giao diện (`Đen AMOLED`, `Vàng Dịu Mắt`, `Xanh Đêm`).

---

## 2. Cách thêm ghi chú dài từ máy tính (Nhanh nhất)

1. Mở thư mục [`notes_txt/`](file:///c:/personal_kyvu/CODE/build-app-fit3/notes_txt) ở gốc project.
2. Tạo hoặc sửa các file `.txt` (lưu chuẩn **UTF-8**):
   * **Dòng đầu tiên:** Tiêu đề ghi chú.
   * **Từ dòng thứ 2 trở đi:** Nội dung ghi chú (dài bao nhiêu tùy ý).
3. Chạy lệnh sau trong PowerShell để tự động nạp tất cả file `.txt` vào app và build ra file `.hap`:
   ```powershell
   .\build-hap.ps1
   ```

*(Ngoài ra, ngay trên mặt đồng hồ bạn cũng có thể bấm **`+ Tạo mới`** hoặc **`+ Viết tiếp`** để ghi chú nhanh bằng bàn phím mini và cụm từ 1 chạm).*

---

## 3. Cách xem Preview, Ký chứng chỉ (Sign) và cài lên Huawei Watch Fit 3

1. **Mở Project trong DevEco Studio 6.1:**
   * Mở **DevEco Studio** -> chọn **Open** -> trỏ tới thư mục `c:\personal_kyvu\CODE\build-app-fit3`.
2. **Xem trước giao diện trên máy tính (Previewer):**
   * Mở file [`index.hml`](file:///c:/personal_kyvu/CODE/build-app-fit3/entry/src/main/js/MainAbility/pages/index/index.hml) hoặc [`reader.hml`](file:///c:/personal_kyvu/CODE/build-app-fit3/entry/src/main/js/MainAbility/pages/reader/reader.hml) -> bấm tab **Previewer** ở cạnh phải của DevEco Studio.
3. **Ký chứng chỉ (Bắt buộc để cài lên đồng hồ thật):**
   * Vào **File -> Project Structure -> Project -> Signing Configs**, đăng nhập tài khoản Huawei Developer và cấu hình chứng chỉ có chứa UDID của chiếc Watch Fit 3 của bạn.
   * Bấm **Build -> Build Hap(s)/APP(s) -> Build Hap(s)**.
   * File `.hap` đã ký sẽ nằm tại: `entry\build\default\outputs\default\entry-default-signed.hap`.
4. **Cài lên Huawei Watch Fit 3:**
   * Cài file [`hmscore-v6/HUAWEI DevEco Assistant.apk`](file:///c:/personal_kyvu/CODE/build-app-fit3/hmscore-v6/HUAWEI%20DevEco%20Assistant.apk) lên điện thoại Android đang kết nối với Watch Fit 3.
   * Chép file `.hap` đã ký vào thư mục `/haps/` trên bộ nhớ trong của điện thoại.
   * Mở **DevEco Assistant** trên điện thoại -> chọn **Apps** -> bấm **Install** để đẩy app sang đồng hồ.
