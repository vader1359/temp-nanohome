"use client";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

const swatches=["#111","#62616e","#84818a","#ababab","#e8e8e8","#4d2d1e","#b39480","#374067","#3c69ad","#676f57","#3bb552","#fcd240","#ed9042","#c23b4f"];
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
export function ProductsGrid(){const t=useTranslations("ProductGrid");const [active,setActive]=useState(0);const tabs=[t("tabTrending"),t("tabBestSeller"),t("tabNew")];return <section className="px-6 py-[60px] lg:px-12"><div className="flex justify-center gap-8">{tabs.map((x,i)=><button key={x} onClick={()=>setActive(i)} className={`text-lg font-medium leading-8 sm:text-2xl ${active===i?"underline underline-offset-4":"text-[#999]"}`}>{x}</button>)}</div><div className="mt-10 gap-x-6 gap-y-12 sm:mt-[88px] sm:gap-y-20 lg:gap-y-24 grid sm:grid-cols-2 lg:grid-cols-4">{products.map((p)=><article key={p.name} className="relative"><span className="absolute left-2 top-0 z-10 bg-[#e9f8ee] px-1 text-xs font-medium text-[#00a63e]">{t("inStock")}</span><button aria-label={`Add ${p.name} to favorites`} className="absolute right-1 top-0 z-10"><Heart className="size-5 stroke-[1.2]" /></button><div className="relative aspect-square"><Image src={p.image} alt={p.name} fill className="object-contain p-4" sizes="(min-width:1024px) 25vw, 50vw" /></div><div className="px-4"><p className="text-base font-semibold">{p.brand}</p><h3 className="mt-1 truncate text-base">{p.name}</h3><p className="mt-2 text-xs text-[#666]">{p.category}</p><div className="mt-2 flex flex-wrap gap-1.5">{swatches.map(c=><span key={c} className="h-3 w-3 rounded-sm" style={{backgroundColor:c}} />)}</div><p className="mt-2 text-[15px] font-semibold">{t("price")}</p></div></article>)}</div><div className="mt-20 text-center"><button className="h-[52px] bg-[#111] px-8 text-sm font-medium uppercase text-white">Xem thêm</button></div></section>}
