"use client";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { ColorSwatches, DarkCTAButton, FavoriteButton, StatusBadge, UnderlineTabs } from "@/components/shared";

const swatches=[{color:"#111"},{color:"#62616e"},{color:"#84818a"},{color:"#ababab"},{color:"#e8e8e8"},{color:"#4d2d1e"},{color:"#b39480"},{color:"#374067"},{color:"#3c69ad"},{color:"#676f57"},{color:"#3bb552"},{color:"#fcd240"},{color:"#ed9042"},{color:"#c23b4f"}];
const products=[
 {image:"/images/p_lc2.png",brand:"Cassina",name:"Fauteuil Grand Confort, petit modèle...",category:"Cassina / Ghế sofa"},
 {image:"/images/p_up2000.png",brand:"B&B ITALIA",name:"Serie Up 2000 Armchair",category:"B&B Italia / Ghế bành"},
 {image:"/images/p_febo.png",brand:"MAXALTO",name:"Febo Chair",category:"Maxalto / Ghế ăn"},
 {image:"/images/p_amoenus.png",brand:"MAXALTO",name:"Amoenus Soft Sofa",category:"Maxalto / Ghế sofa"},
 {image:"/images/feat_egg_main.png",brand:"FRITZ HANSEN",name:"Egg Chair",category:"Fritz Hansen / Ghế thư giãn"},
 {image:"/images/featured-blue-chair.png",brand:"vitra.",name:"Panton Chair Classic",category:"Vitra / Ghế ăn"},
 {image:"/images/feat_husk.png",brand:"vitra.",name:"Eames Lounge Chair",category:"Vitra / Ghế thư giãn"},
 {image:"/images/feat_egg_1.png",brand:"Knoll",name:"Barcelona Chair",category:"Knoll / Ghế lounge"},
];
export function ProductsGrid(){const t=useTranslations("ProductGrid");const [active,setActive]=useState("trending");const tabs=[{key:"trending",label:t("tabTrending")},{key:"bestseller",label:t("tabBestSeller")},{key:"new",label:t("tabNew")}];return <section className="px-6 py-[60px] lg:px-12"><UnderlineTabs tabs={tabs} activeKey={active} onChange={setActive} className="justify-center gap-8 border-b-0 [&_button]:text-lg [&_button]:leading-8 sm:[&_button]:text-2xl" /><div className="mt-10 gap-x-6 gap-y-12 sm:mt-[88px] sm:gap-y-20 lg:gap-y-24 grid sm:grid-cols-2 lg:grid-cols-4">{products.map((p)=><article key={p.name} className="relative"><StatusBadge type="instock" variant="light" label={t("inStock")} className="absolute left-2 top-0 z-10 rounded-none px-1 py-0" /><FavoriteButton variant="outline" className="absolute right-1 top-0 z-10" /><div className="relative aspect-square"><Image src={p.image} alt={p.name} fill className="object-contain p-4" sizes="(min-width:1024px) 25vw, 50vw" /></div><div className="px-4"><p className="text-base font-semibold">{p.brand}</p><h3 className="mt-1 truncate text-base">{p.name}</h3><p className="mt-2 text-xs text-[#666]">{p.category}</p><ColorSwatches colors={swatches} variant="dots" className="mt-2 gap-1.5 [&_span]:h-3 [&_span]:w-3 [&_span]:rounded-sm [&_span]:border-0" /><p className="mt-2 text-[15px] font-semibold">{t("price")}</p></div></article>)}</div><div className="mt-20 text-center"><DarkCTAButton variant="solid" className="h-[52px]">Xem thêm</DarkCTAButton></div></section>}
