# M&J CUP — trang tính điểm pickleball

| Ai | Link |
| --- | --- |
| Người chơi, khách xem | `https://hoangphong2104.github.io/mj-cup/` |
| BTC nhập điểm (HanhVMN, MC) | `https://hoangphong2104.github.io/mj-cup/#admin` |

Chưa cấu hình Firebase thì trang chạy **chế độ thử**: dữ liệu chỉ nằm trên trình duyệt đang mở, không đồng bộ sang máy khác. Để điện thoại người chơi thấy tỉ số trực tiếp, cần làm một lần các bước dưới đây (khoảng 10 phút, miễn phí).

## Cài Firebase (một lần)

1. Vào <https://console.firebase.google.com> → **Add project** → đặt tên `mj-cup` → tắt Google Analytics → Create.
2. **Build → Realtime Database → Create database** → vùng **Singapore (asia-southeast1)** → chọn **Start in locked mode**.
   Sang tab **Rules**, xoá hết, dán nội dung file [`database.rules.json`](database.rules.json) → **Publish**.
   Luật này cho mọi người *xem*, chỉ tài khoản BTC được *ghi*.
3. **Build → Authentication → Get started → Email/Password → Enable → Save.**
   Tab **Users → Add user**: tạo tài khoản cho HanhVMN và cho MC (email + mật khẩu tự đặt).
   Sao chép cột **User UID** của từng người.
4. Cấp quyền BTC: quay lại **Realtime Database → tab Data**, bấm dấu **+** cạnh gốc:
   - Key: `admins` → bấm **+** bên trong nó
   - Key: *UID vừa sao chép*, Value: `true`
   Làm lại cho UID thứ hai. Giá trị phải là `true` (kiểu boolean), không có dấu ngoặc kép.
5. **Project settings (bánh răng) → General → Your apps → biểu tượng `</>`** → đặt tên `mj-cup` → Register.
   Sao chép khối `firebaseConfig` và dán vào [`config.js`](config.js), thay dòng `window.MJ_FIREBASE_CONFIG = null;`.
   Kiểm tra trong đó **có `databaseURL`**. Nếu thiếu, lấy URL ở đầu trang Realtime Database (dạng `https://mj-cup-default-rtdb.asia-southeast1.firebasedatabase.app`).
6. **Authentication → Settings → Authorized domains → Add domain**: `hoangphong2104.github.io`.
7. Đưa trang lên mạng bằng GitHub Pages: tạo repo `mj-cup` trên GitHub, đẩy toàn bộ thư mục này lên nhánh `main` (giữ file `.nojekyll`),
   rồi vào **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**. Chờ 1–2 phút.
   Đặt repo ở tài khoản khác thì đổi `hoangphong2104` trong các link ở đây (và ở bước 6) cho đúng.
8. Mở link BTC → đăng nhập → bấm **Khởi tạo M&J CUP**. Xong, gửi link người xem vào nhóm.

`apiKey` trong `config.js` được phép công khai. Quyền ghi do luật ở bước 2 kiểm soát, không phải do khoá này.

## Ngày thi đấu

- **Chấm điểm:** mở link BTC, chạm vào trận → chọn số sân → chạm vào ô của cặp ghi điểm để +1, bấm `−1` nếu bấm nhầm.
  Trận tự chuyển sang “Đang đấu” khi có điểm đầu tiên. Đủ 11 điểm thì ô chấm khoá lại, bấm **Chốt kết quả**.
- **Nhiều sân cùng lúc:** HanhVMN và MC mở hai trận khác nhau trên hai máy. Hai người cùng chấm một trận cũng không mất điểm.
- **Nhập kết quả sau trận / sửa tỉ số sai:** trong trận → **Nhập tỉ số cuối**. Trận đã chốt muốn chấm tiếp → **Mở lại để sửa**.
- **Vòng 8 đội, bán kết, chung kết** tự điền cặp đấu khi đủ kết quả vòng trước. Khi trận đã bắt đầu, cặp đấu được giữ cố định.
- **Bằng điểm:** nếu hai cặp bằng mọi chỉ số, bảng xếp hạng hiện dấu `=`. BTC bấm nút **▲** (chỉ có ở trang BTC) để đưa cặp đó lên trên.
- **Đổi tên cặp, luật điểm (11/15/21, cách 2 điểm), số sân:** tab **Cài đặt**.

## Luật xếp hạng đang dùng

- **Đôi nam (vòng tròn 5 cặp, 10 trận):** số trận thắng → hiệu số → tổng điểm ghi được → BTC quyết định.
- **Đôi nam nữ Vòng 1:** 5 cặp thắng xếp hạng 1–5, cặp thua xếp hạng 6–10; cùng nhóm xét hiệu số → tổng điểm → BTC quyết định. Hạng 1–8 vào Vòng 8 đội:
  8.1 = H1 gặp H8 · 8.2 = H4 gặp H5 · 8.3 = H2 gặp H7 · 8.4 = H3 gặp H6. Bán kết 1 = thắng 8.1 gặp thắng 8.2, Bán kết 2 = thắng 8.3 gặp thắng 8.4.

## Thử trên máy

```bash
python3 -m http.server 8766
```

Mở `http://127.0.0.1:8766/` ở một tab và `http://127.0.0.1:8766/#admin` ở tab khác: chấm điểm ở tab BTC, tab người xem cập nhật theo.
