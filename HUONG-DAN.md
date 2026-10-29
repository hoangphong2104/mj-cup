# M&J CUP — trang tính điểm pickleball

| Ai | Link |
| --- | --- |
| Người chơi, khách xem | `https://hoangphong2104.github.io/mj-cup/` |
| BTC nhập điểm (HanhVMN, MC) | `https://hoangphong2104.github.io/mj-cup/#admin` |

Chưa điền Supabase vào `config.js` thì trang chạy **chế độ thử**: dữ liệu chỉ nằm trên trình duyệt đang mở, không đồng bộ sang máy khác. Để điện thoại người chơi thấy tỉ số trực tiếp, cần làm một lần các bước dưới đây (khoảng 10 phút, gói miễn phí là đủ).

## Cài Supabase (một lần)

1. Vào <https://supabase.com/dashboard> → **New project** → tên `mj-cup`, đặt mật khẩu database (lưu lại, ít khi dùng) → Create.
   Nên tạo dự án riêng. Nếu dùng chung dự án có sẵn, kiểm tra trước là chưa có bảng nào tên `cup` hoặc `cup_secret`.
2. **SQL Editor → New query** → dán toàn bộ file [`supabase.sql`](supabase.sql) → **Run**.
   File này tạo bảng lưu giải, bật cập nhật trực tiếp, và đặt quyền: ai cũng *xem* được, chỉ người có mật khẩu BTC mới *ghi* được.
   Chạy lại nhiều lần không sao (khi tải bản mới của file này về thì chạy lại).
3. Đặt mật khẩu BTC: **SQL Editor → New query**, thay `MẬT_KHẨU` bằng mật khẩu muốn dùng rồi **Run**:
   ```sql
   insert into public.cup_secret (id, pw_hash)
   values (1, extensions.crypt('MẬT_KHẨU', extensions.gen_salt('bf')))
   on conflict (id) do update set pw_hash = excluded.pw_hash;
   ```
   Máy chủ chỉ lưu bản mã hoá. Muốn đổi mật khẩu thì chạy lại lệnh với mật khẩu mới; các máy đang mở trang BTC sẽ phải nhập lại.
   Mật khẩu phân biệt chữ hoa, chữ thường. **Đừng ghi mật khẩu vào file nào trong thư mục này**, vì thư mục sẽ được đưa công khai lên GitHub.
4. **Project Settings → API Keys**: sao chép khoá **Publishable** (hoặc **anon public** ở tab Legacy). URL là `https://<Project ID>.supabase.co` (Project ID ở **Settings → General**). Dán vào [`config.js`](config.js):
   ```js
   window.MJ_SUPABASE = {
     url: 'https://abcdxyz.supabase.co',
     anonKey: 'sb_publishable_...',
   };
   ```
   Khoá này được phép công khai: quyền ghi do mật khẩu BTC kiểm soát. **Không** dán khoá `secret` / `service_role`.
5. Đưa trang lên mạng bằng GitHub Pages: tạo repo `mj-cup` trên GitHub, đẩy toàn bộ thư mục này lên nhánh `main` (giữ file `.nojekyll`),
   rồi vào **Settings → Pages → Deploy from a branch → `main` / `(root)` → Save**. Chờ 1–2 phút.
   Đặt repo ở tài khoản khác thì đổi `hoangphong2104` trong các link ở đây cho đúng.
6. Mở link BTC → nhập mật khẩu → (lần đầu) bấm **Khởi tạo M&J CUP**. Xong, gửi link người xem vào nhóm.

> **Lưu ý gói miễn phí:** Supabase tạm dừng dự án sau 7 ngày không ai dùng. **Hôm trước ngày thi đấu**, mở dashboard xem dự án có đang **Paused** không; nếu có, bấm **Restore** (mất vài phút).

## Ngày thi đấu

- **Chấm điểm:** mở link BTC (hoặc bấm **Đăng nhập BTC** ở cuối trang người xem), nhập mật khẩu một lần — máy sẽ nhớ. Chạm vào trận → chọn số sân → chạm vào ô của cặp ghi điểm để +1, bấm `−1` nếu bấm nhầm.
  Trận tự chuyển sang “Đang đấu” khi có điểm đầu tiên. Đủ 11 điểm thì ô chấm khoá lại, bấm **Chốt kết quả**.
- **Giao bóng (không bắt buộc):** ô vàng giữa hai cặp hiện cách gọi điểm, ví dụ `6 – 4 – 1` (điểm bên giao – điểm bên nhận – người giao).
  Bên giao thua pha bóng thì bấm **Mất giao**: người 1 → người 2 → đổi giao sang cặp kia. Đầu trận bên giao trước chỉ có người số 2 (`0 – 0 – 2`).
  Sai thì chọn lại tay bằng **Bên giao ▲ Trên / ▼ Dưới** và **Người 1 / 2**. Chạm +1 vẫn được bất kể ai đang giao.
  Người xem thấy biểu tượng bóng **giao 1/2** cạnh cặp đang giao.
- **Nhiều sân cùng lúc:** HanhVMN và MC mở hai trận khác nhau trên hai máy. Hai người cùng chấm một trận cũng không mất điểm.
- **Nhập kết quả sau trận / sửa tỉ số sai:** trong trận → **Nhập tỉ số cuối**. Trận đã chốt muốn chấm tiếp → **Mở lại để sửa**.
- **Vòng 8 đội, bán kết, chung kết** tự điền cặp đấu khi đủ kết quả vòng trước. Khi trận đã bắt đầu, cặp đấu được giữ cố định.
- **Bằng điểm:** nếu hai cặp bằng mọi chỉ số, bảng xếp hạng hiện dấu `=`. BTC bấm nút **▲** (chỉ có ở trang BTC) để đưa cặp đó lên trên.
- **Đổi tên cặp, luật điểm (11/15/21, cách 2 điểm), số sân:** nút **⚙ Cài đặt** trên thanh BTC.

## Thể thức + lịch đang dùng

- **Lịch:** 2 sân (Sân 33, Sân 3), khởi động 08:00, 18 lượt từ 08:15 đến 11:50. Tab **Lịch đấu** là trang mặc định; người chơi gõ tên vào ô tìm để thấy trận của mình.
  Lịch trễ thì BTC sửa giờ các lượt trong **⚙ Cài đặt → Sân & giờ thi đấu**.
- **Đôi nam (6 cặp, vòng tròn 15 trận, chạm 11):** xếp theo **số trận thắng** → hiệu số → tổng điểm ghi được → BTC quyết định. Hạng 1 gặp hạng 2 ở **Chung kết Đôi nam** (chạm 11).
- **Đôi nam nữ (12 cặp):** Vòng 1 mỗi cặp đánh 2 trận (12 trận, chạm 7), xếp như trên (số trận thắng đứng đầu); 8 cặp đầu vào Vòng 8 đội:
  8.1 = H1 gặp H8 · 8.2 = H4 gặp H5 · 8.3 = H2 gặp H7 · 8.4 = H3 gặp H6. Bán kết 1 = thắng 8.1 gặp thắng 8.2, Bán kết 2 = thắng 8.3 gặp thắng 8.4 (chạm 7). **Chung kết** chạm 11.
- Hai trận chung kết đánh cùng lúc lúc 11:50.

## Thử trên máy

```bash
python3 -m http.server 8766
```

Mở `http://127.0.0.1:8766/` ở một tab và `http://127.0.0.1:8766/#admin` ở tab khác: chấm điểm ở tab BTC, tab người xem cập nhật theo.
