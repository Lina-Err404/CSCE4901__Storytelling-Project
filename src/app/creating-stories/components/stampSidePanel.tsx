"use client"

import React, { useState } from 'react'

// Organized by category matching your folder structure
const STAMP_FOLDERS = {
  background: [
    'Untitled48_20240711082655.png',
    'Untitled48_20240711120258.png',
    'Untitled90_20260213150211.png',
    'Untitled96_20260325145211.png',
    'Untitled103_20260424135732.png',
    'Untitled103_20260424135815.png',
    'Untitled116.png',
  ],
  character: [
    '20220728_125054.png',
    'Untitled47_20240711030917.png',
    'Untitled47_20240711031924.png',
    'Untitled92_20260320204339.png',
    'Untitled95_20260320204611.png',
    'Untitled128_20261017210110.png',
  ],
  props: [
    'Untitled48_20240711083849.png',
    'Untitled48_20240711102837.png',
    'Untitled48_20240711102842.png',
    'Untitled48_20240711102844.png',
    'Untitled48_20240713232210.png',
    'Untitled96_20260326001950.png',
    'Untitled96_20260402132903.png',
  ],
}

const CATEGORY_KEYS = Object.keys(STAMP_FOLDERS) as (keyof typeof STAMP_FOLDERS)[]

function StampSidePanel() {
  const [activeTab, setActiveTab] = useState<'shapes' | 'stamps'>('stamps')
  const [categoryIndex, setCategoryIndex] = useState(0)

  const currentCategory = CATEGORY_KEYS[categoryIndex]
  const currentStickers = STAMP_FOLDERS[currentCategory] || []

  const handlePrev = () => {
    setCategoryIndex((prev) => (prev - 1 + CATEGORY_KEYS.length) % CATEGORY_KEYS.length)
  }

  const handleNext = () => {
    setCategoryIndex((prev) => (prev + 1) % CATEGORY_KEYS.length)
  }

  return (
    <div className="h-18/21 w-68 bg-[#497BC3] flex rounded-r-4xl border-solid border-[#334670] border-3 flex-col p-3.5 pt-4 mt-10 z-10 absolute inset-y-0 left-0 shadow-xl select-none">

      {/* Shapes / Stamps Segmented Toggle */}
      <div className="h-11 bg-[#D4D4D8] grid grid-cols-2 divide-x-3 divide-solid divide-black mb-4 rounded-xl border-3 border-black border-solid flex-shrink-0 overflow-hidden shadow-[0_2px_0_#000]">
        <button
          type="button"
          onClick={() => setActiveTab('shapes')}
          className={`flex items-center justify-center cursor-pointer font-bold text-sm text-black transition-colors ${
            activeTab === 'shapes' ? 'bg-[#FFC250]' : 'bg-[#E4E4E7] hover:bg-[#F4F4F5]'
          }`}
        >
          shapes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stamps')}
          className={`flex items-center justify-center cursor-pointer font-bold text-sm text-black transition-colors ${
            activeTab === 'stamps' ? 'bg-[#FFC250]' : 'bg-[#E4E4E7] hover:bg-[#F4F4F5]'
          }`}
        >
          stamps
        </button>
      </div>

      {/* Category Switcher (Prev / Current Folder / Next) */}
      <div className="h-10 flex justify-between items-center gap-1.5 mb-4 flex-shrink-0">
        <button
          type="button"
          onClick={handlePrev}
          style={{ fontSize: '12px', lineHeight: '1', padding: '0 8px' }}
          className="h-full flex items-center justify-center bg-[#FFC250] hover:bg-[#ffb020] active:translate-y-0.5 cursor-pointer rounded-md border-3 border-black font-bold text-black shadow-[0_2px_0_#000]"
        >
          ◀
        </button>
        <div className="flex-1 h-full flex items-center justify-center bg-white px-2 rounded-md border-solid border-3 border-black text-xs font-bold text-black uppercase tracking-wide shadow-[0_2px_0_#000] truncate">
          {activeTab === 'shapes' ? 'basic shapes' : currentCategory}
        </div>
        <button
          type="button"
          onClick={handleNext}
          style={{ fontSize: '12px', lineHeight: '1', padding: '0 8px' }}
          className="h-full flex items-center justify-center bg-[#FFC250] hover:bg-[#ffb020] active:translate-y-0.5 cursor-pointer rounded-md border-3 border-black font-bold text-black shadow-[0_2px_0_#000]"
        >
          ▶
        </button>
      </div>

      {/* Scrollable Grid dynamically mapping the folder files */}
      <div className="flex-1 bg-[#1E293B] rounded-2xl border-3 border-black p-3 overflow-y-auto shadow-inner">
        {activeTab === 'shapes' ? (
          <div className="text-center text-white text-xs font-bold pt-10">Basic Shapes coming soon!</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 h-max">
            {currentStickers.map((filename, index) => (
              <button
                key={index}
                type="button"
                style={{
                  backgroundImage:
                    'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.12) 100%)',
                }}
                className="bg-[#E2E8F0] rounded-lg border-solid border-black border-3 aspect-square flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 cursor-pointer transition-all shadow-[0_2px_0_#000] overflow-hidden p-1.5"
                onClick={() => console.log(`Selected stamp: /images/${currentCategory}/${filename}`)}
              >
                <img
                  src={`/images/${currentCategory}/${filename}`}
                  alt={`${currentCategory} stamp ${index + 1}`}
                  className="max-w-full max-h-full object-contain drop-shadow-sm pointer-events-none"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default StampSidePanel