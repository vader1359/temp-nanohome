// Mock product-detail data, faithfully mirroring the Figma design.
// Vietnamese copy as in the design.

export type Color = { name: string; hex: string };

// 14 color swatches (order + hex from Figma section 1).
export const COLORS: Color[] = [
  { name: "Đen", hex: "#111111" },
  { name: "Anthracite", hex: "#62616E" },
  { name: "Xám vừa", hex: "#84818A" },
  { name: "Xám nhạt", hex: "#ABABAB" },
  { name: "Trắng tinh", hex: "#E8E8E8" },
  { name: "Nâu", hex: "#4D2D1E" },
  { name: "Be", hex: "#B39480" },
  { name: "Xanh thép", hex: "#374067" },
  { name: "Xanh hoa long", hex: "#3C69AD" },
  { name: "Xanh ô liu", hex: "#676F57" },
  { name: "Xanh lá", hex: "#3BB552" },
  { name: "Vàng", hex: "#FCD240" },
  { name: "Cam", hex: "#ED9042" },
  { name: "Đỏ ruby", hex: "#C23B4F" },
];

export const img = (name: string) => `/images/product/${name}`;

export const product = {
  brand: "Cassina",
  // Figma literally shows LC3 in the title and LC2 in the breadcrumb.
  title: "Fauteuil Grand Confort, petit modèle (LC3)",
  breadcrumbTitle: "Fauteuil Grand Confort, petit modèle (LC2)",
  category: "Ghế, Ghế Sofas",
  onSale: true,
  oldPrice: "10,000,000 vnđ",
  newPrice: "8,000,000 vnđ",
  discount: "-20%",
  colors: COLORS,
  gallery: [
    img("hero-lc2.jpg"),
    img("gallery-1.jpg"),
    img("gallery-2.jpg"),
    img("related-1-lc2-petit.jpg"),
    img("related-2-lc3-grand.jpg"),
  ],
};

const brandWordmark = (name: string) => name;

export type RelatedProduct = {
  name: string;
  brand: string;
  category: string;
  price: string;
  image: string;
  available: boolean;
  tags?: string[];
};

// Section 3 — Sản phẩm cùng bộ (same LC collection, all Cassina).
export const relatedSet: RelatedProduct[] = [
  {
    name: "Fauteuil Grand Confort, petit modèle (LC2)",
    brand: brandWordmark("CASSINA"),
    category: "Ghế sofa",
    price: "10,000,000 vnđ",
    image: img("related-1-lc2-petit.jpg"),
    available: true,
    tags: ["New", "Best seller"],
  },
  {
    name: "Fauteuil Grand Confort, grand modèle (LC3)",
    brand: brandWordmark("CASSINA"),
    category: "Ghế sofa",
    price: "10,000,000 vnđ",
    image: img("related-2-lc3-grand.jpg"),
    available: true,
    tags: ["New"],
  },
  {
    name: "LC4 Chaise Longue",
    brand: brandWordmark("CASSINA"),
    category: "Ghế thư giãn",
    price: "10,000,000 vnđ",
    image: img("related-3-lc4-chaise.jpg"),
    available: true,
    tags: ["Iconic"],
  },
  {
    name: "LC1 Sling Chair",
    brand: brandWordmark("CASSINA"),
    category: "Ghế thư giãn",
    price: "9,800,000 vnđ",
    image: img("hero-lc2.jpg"),
    available: true,
    tags: ["New"],
  },
];

// Section 4 — Ảnh sản phẩm gallery.
export const galleryImages: string[] = [
  img("gallery-1.jpg"),
  img("gallery-2.jpg"),
  img("hero-lc2.jpg"),
  img("related-1-lc2-petit.jpg"),
  img("related-2-lc3-grand.jpg"),
];

// Section 2 — specs.
export type SpecItem = { label: string; value: string; link?: string };
export const specColumns: SpecItem[][] = [
  [
    { label: "Tên sản phẩm", value: "3 Fauteuil Grand Confort, grand modèle, deux places (LC2)" },
    { label: "Thương hiệu", value: "Cassina", link: "Khám phá" },
    { label: "Bộ sưu tập", value: "LC", link: "Khám phá" },
    { label: "Nhà thiết kế / Năm", value: "Le Corbusier, Pierre Jeanneret, Charlotte Perriand — 1928" },
    { label: "Loại sản phẩm", value: "Ghế, Sofas" },
    { label: "Xuất xứ", value: "Sản xuất tại Ý" },
  ],
  [
    { label: "Kích thước", value: "W 1680 × D 730 × H 620 mm\nChiều cao ngồi: 400 mm" },
    {
      label: "Vật liệu, kết cấu",
      value:
        "Khung thép mạ chrome; đệm polyurethane đúc nguyên khối; bọc da Cassina cao cấp, mút đa mật độ đàn hồi.",
    },
    { label: "Hoàn thiện khung", value: "Chrome bóng / sơn: đen mờ, xám" },
    { label: "Phiên bản liên quan", value: "LC2 Durable · LC2 Outdoor" },
  ],
];

export const specTabs = ["Thông số", "Giới thiệu", "Nhà thiết kế"];

// Section 5 — Quyền lợi của khách hàng.
export type Benefit = { title: string; description: string; icon: string };
export const benefits: Benefit[] = [
  {
    icon: "truck",
    title: "Giao hàng & lắp đặt tận nơi",
    description: "Đội ngũ kỹ thuật lắp đặt chuẩn hãng tại nhà; hỗ trợ lịch hẹn linh hoạt.",
  },
  {
    icon: "support",
    title: "Hỗ trợ tận tâm",
    description: "Chuyên viên tư vấn luôn sẵn sàng, từ chọn sản phẩm đến chăm sóc sau bán.",
  },
  {
    icon: "payment",
    title: "Thanh toán bảo mật",
    description: "Hệ thống thanh toán an toàn, bảo vệ thông tin và nhiều phương thức tiện lợi.",
  },
  {
    icon: "warranty",
    title: "Bảo hành sản phẩm",
    description: "Có vấn đề xảy ra? nanoHome hỗ trợ bảo hành sản phẩm tận tâm cho bạn.",
  },
];

// Section 6 — Sản phẩm dành cho bạn.
export const recommended: RelatedProduct[] = [
  {
    name: "EAMES ELEPHANT",
    brand: brandWordmark("CASSINA"),
    category: "Ghế, Ghế Sofa",
    price: "10,000,000 vnđ",
    image: img("recommended-1-eames.jpg"),
    available: true,
  },
  {
    name: "Camaleonda",
    brand: brandWordmark("B&B ITALIA"),
    category: "Ghế, Ghế Sofa",
    price: "12,500,000 vnđ",
    image: img("hero-lc2.jpg"), // placeholder — original figma asset unavailable
    available: true,
  },
  {
    name: "Chair Febo",
    brand: brandWordmark("MAXALTO"),
    category: "Ghế, Ghế Sofa",
    price: "11,800,000 vnđ",
    image: img("recommended-3-febo.jpg"),
    available: true,
  },
  {
    name: "LC4 Chaise Longue",
    brand: brandWordmark("CASSINA"),
    category: "Ghế thư giãn",
    price: "10,000,000 vnđ",
    image: img("related-3-lc4-chaise.jpg"),
    available: true,
  },
];

export const breadcrumbs = ["Trang chủ", "Sản phẩm"];