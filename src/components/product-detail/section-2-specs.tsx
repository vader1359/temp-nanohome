"use client";

import { useState } from "react";
import { specColumns, specTabs } from "./mock-data";

export function Section2Specs() {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <section className="flex flex-col items-center gap-12 bg-[#F5F3F0] px-4 py-12 sm:px-8 md:py-20 lg:min-h-[780px]">
      {/* Title */}
      <h2 className="text-center text-[32px] font-medium text-[#666]">
        Thông tin chi tiết
      </h2>

      {/* Tabs */}
      <div className="flex justify-center gap-[21px]">
        {specTabs.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(i)}
            className={`text-[12px] font-normal transition ${
              activeTab === i ? "text-[#111]" : "text-[#CFC9C0]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Spec cards — 2 columns */}
      {activeTab === 0 && (
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 md:flex-row md:gap-12">
          {specColumns.map((col, ci) => (
            <div key={ci} className="flex flex-1 flex-col gap-4">
              {col.map((spec) => (
                <div
                  key={spec.label}
                  className="flex flex-col gap-1 bg-white px-6 py-3"
                >
                  <span className="text-[14px] font-medium uppercase text-[#111]">
                    {spec.label}
                  </span>
                  <div className="flex items-start gap-2">
                    <span className="whitespace-pre-line text-[14px] font-normal text-[#666]">
                      {spec.value}
                    </span>
                    {spec.link && (
                      <a
                        href="#"
                        className="text-[12px] font-medium text-[#B0946F] hover:underline"
                      >
                        {spec.link}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTab === 1 && (
        <div className="mx-auto w-full max-w-[800px] text-[14px] leading-relaxed text-[#666]">
          <p>
            Fauteuil Grand Confort là một kiệt tác thiết kế signify bản lý tưởng của
            Le Corbusier — một chiếc ghế sofa tách rời khung thép mạ chrome và đệm
            polyurethane đúc nguyên khối. Thiết kế ways tube framework way protusion
            modelled trong năm 1928 alongside partner Pierre Jeanneret và Charlotte
            Perriand, ghế thể hiện concept &ldquo;cushion baskets&rdquo; — những chiếc đệm độc
            lập nằm trong khung thép.
          </p>
        </div>
      )}

      {activeTab === 2 && (
        <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6 text-[14px] text-[#666]">
          <div>
            <h3 className="mb-2 text-[16px] font-medium text-[#111]">Le Corbusier</h3>
            <p>
              Charles-Édouard Jeanneret (1887–1965), biết tới với tên Le Corbusier, là
              kiến trúc sư và nhà thiết kế gốc Thụy Sĩ. Ông là một trong những people
              exemplar chủ nghĩa kiến trúc hiện đại.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-[16px] font-medium text-[#111]">Pierre Jeanneret</h3>
            <p>
              Pierre Jeanneret (1896–1967) là kiến trúc sư Thụy Sĩ, người cộng tác
              xuyên suốt cùng Le Corbusier trong nhiều dự án nổi tiếng.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-[16px] font-medium text-[#111]">Charlotte Perriand</h3>
            <p>
              Charlotte Perriand (1903–1999) là nhà thiết kế Pháp, cộng tác viên quan
              trọng của Le Corbusier trong thiết kế nội thất furniture landmark.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}