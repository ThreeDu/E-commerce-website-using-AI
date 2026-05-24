const { parseDescriptionToSpecsWithMemory, buildProductFilter } = require("./descriptionSearch");

async function runTest() {
  const sessionId = "test-session";
  const description = `Danh mục: Điện thoại > Apple > Iphone

0.0 sao (0 đánh giá)
4 lượt xem
0 lượt mua
36.850.300 đ

37.990.000 đ

Tóm tắt nổi bật
4 điểm
Màn hình khổng lồ, siêu sáng: 6.9" Super Retina XDR với thiết kế Dynamic Island. Tần số quét 120Hz mượt mà và độ sáng đỉnh cao lên tới 3000 nit thách thức mọi điều kiện ánh sáng.
Cụm 3 camera 48MP Đỉnh Cao: Lần đầu tiên cả 3 ống kính (Chính, Góc Siêu Rộng, Tele) đều đạt độ phân giải 48MP. Khả năng zoom quang học 8x, zoom số 40x và quay video 4K Dolby Vision chuyên nghiệp. Camera trước 18MP Center Stage sắc nét.
Hiệu năng vô đối với AI: Sức mạnh từ Chip A19 Pro (6 lõi CPU & 6 lõi GPU) xử lý mượt mà mọi tác vụ AI. Chạy hệ điều hành iOS 26 mới nhất, bộ nhớ 256GB rộng rãi.
Kết nối tương lai: Đi đầu với mạng 5G, Wi-Fi 7, Bluetooth 6 và hỗ trợ SIM kép (tích hợp 2 eSIM).
`;

  const parsed = await parseDescriptionToSpecsWithMemory(description, []);
  console.log("Parsed context:", parsed);

  const filter = buildProductFilter(parsed);
  console.log("Built MongoDB filter:", JSON.stringify(filter, null, 2));

  if (Array.isArray(filter.$and)) {
    console.log("-- Specs regex previews --");
    filter.$and.forEach((cond, idx) => {
      const or = Array.isArray(cond.$or) ? cond.$or : [];
      const descRe = or[0] && or[0].description;
      if (descRe && typeof descRe === "object" && descRe.source) {
        console.log(idx, descRe.toString());
      } else if (descRe && descRe instanceof RegExp) {
        console.log(idx, descRe.toString());
      } else {
        console.log(idx, "(no regex visible for description)");
      }
    });
  }
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
