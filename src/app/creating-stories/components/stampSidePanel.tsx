"use client"

import React, { useState } from 'react'
import { SHAPE_LIST, STAMP_DRAG, useStampTools } from './drawingCanvas'

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
  const { color, selected, placeStamp, removeSelected, flipLayer } = useStampTools()

  const currentCategory = CATEGORY_KEYS[categoryIndex]
  const currentStickers = STAMP_FOLDERS[currentCategory] || []

  const handlePrev = () => {
    setCategoryIndex((prev) => (prev - 1 + CATEGORY_KEYS.length) % CATEGORY_KEYS.length)
  }

  const handleNext = () => {
    setCategoryIndex((prev) => (prev + 1) % CATEGORY_KEYS.length)
  }

  // Tiles are dragged onto the page. A click adds the stamp in the middle of the area for accessibility purposes
  const dragStart = (e: React.DragEvent<HTMLElement>, spec: object) => {
    e.dataTransfer.setData(STAMP_DRAG, JSON.stringify(spec))
    e.dataTransfer.effectAllowed = 'copy'
    const preview = e.currentTarget.querySelector('img, svg')
    if (preview) {
      const r = preview.getBoundingClientRect()
      e.dataTransfer.setDragImage(preview, r.width / 2, r.height / 2)
    }
  }

  const keyAdd = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.currentTarget.click()
    }
  }

  return (
    <div className="absolute top-10 bottom-16 left-0 z-10 flex w-68 flex-col rounded-r-4xl border-3 border-solid border-[#334670] bg-[#497BC3] p-3.5 pt-4 shadow-xl select-none">

      {/* Shapes / Stamps Segmented Toggle */}
      <div className="h-11 bg-[#D4D4D8] grid grid-cols-2 divide-x-3 divide-solid divide-black mb-4 rounded-xl border-3 border-black border-solid flex-shrink-0 overflow-hidden shadow-[0_2px_0_#000]">
        <button
          type="button"
          onClick={() => setActiveTab('shapes')}
          className={`flex items-center justify-center cursor-pointer font-bold text-sm text-black transition-colors ${activeTab === 'shapes' ? 'bg-[#FFC250]' : 'bg-[#E4E4E7] hover:bg-[#F4F4F5]'
            }`}
        >
          shapes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stamps')}
          className={`flex items-center justify-center cursor-pointer font-bold text-sm text-black transition-colors ${activeTab === 'stamps' ? 'bg-[#FFC250]' : 'bg-[#E4E4E7] hover:bg-[#F4F4F5]'
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
          disabled={activeTab === 'shapes'}
          style={{ fontSize: '12px', lineHeight: '1', padding: '0 8px' }}
          className="h-full flex items-center justify-center bg-[#FFC250] hover:bg-[#ffb020] active:translate-y-0.5 cursor-pointer rounded-md border-3 border-black font-bold text-black shadow-[0_2px_0_#000] disabled:opacity-50 disabled:cursor-default"
        >
          ◀
        </button>
        <div className="flex-1 h-full flex items-center justify-center bg-white px-2 rounded-md border-solid border-3 border-black text-xs font-bold text-black uppercase tracking-wide shadow-[0_2px_0_#000] truncate">
          {activeTab === 'shapes' ? 'basic shapes' : currentCategory}
        </div>
        <button
          type="button"
          onClick={handleNext}
          disabled={activeTab === 'shapes'}
          style={{ fontSize: '12px', lineHeight: '1', padding: '0 8px' }}
          className="h-full flex items-center justify-center bg-[#FFC250] hover:bg-[#ffb020] active:translate-y-0.5 cursor-pointer rounded-md border-3 border-black font-bold text-black shadow-[0_2px_0_#000] disabled:opacity-50 disabled:cursor-default"
        >
          ▶
        </button>
      </div>

      {/* Scrollable Grid dynamically mapping the folder files */}
      <div className="min-h-0 flex-1 bg-[#1E293B] rounded-2xl border-3 border-black p-3 overflow-y-auto shadow-inner">
        {activeTab === 'shapes' ? (
          <div className="grid grid-cols-2 gap-3 h-max">
            {SHAPE_LIST.map((shape) => (
              <div
                key={shape.id}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) => dragStart(e, { kind: 'shape', shape: shape.id })}
                onKeyDown={keyAdd}
                style={{
                  backgroundImage:
                    'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.12) 100%)',
                }}
                className="bg-[#E2E8F0] rounded-lg border-solid border-black border-3 aspect-square flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 cursor-pointer transition-all shadow-[0_2px_0_#000] overflow-hidden p-1.5"
                onClick={() => placeStamp({ kind: 'shape', shape: shape.id })}
                aria-label={`Add ${shape.label}`}
              >
                {/* preview is the same path the canvas draws, in the color that is currently picked */}
                <svg
                  viewBox="0 0 1 1"
                  preserveAspectRatio="none"
                  style={{ width: '70%', aspectRatio: `1 / ${Math.max(shape.ratio, 0.12)}`, overflow: 'visible' }}
                  className="pointer-events-none"
                >
                  <path d={shape.svgPath} fill={color} />
                </svg>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 h-max">
            {currentStickers.map((filename, index) => (
              <div
                key={index}
                role="button"
                tabIndex={0}
                draggable
                onDragStart={(e) =>
                  dragStart(e, { kind: 'image', src: `/images/${currentCategory}/${filename}`, category: currentCategory })
                }
                onKeyDown={keyAdd}
                style={{
                  backgroundImage:
                    'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.12) 100%)',
                }}
                className="bg-[#E2E8F0] rounded-lg border-solid border-black border-3 aspect-square flex items-center justify-center hover:bg-white hover:scale-105 active:scale-95 cursor-pointer transition-all shadow-[0_2px_0_#000] overflow-hidden p-1.5"
                onClick={() => placeStamp({ kind: 'image', src: `/images/${currentCategory}/${filename}`, category: currentCategory })}
              >
                <img
                  src={`/images/${currentCategory}/${filename}`}
                  alt={`${currentCategory} stamp ${index + 1}`}
                  className="max-w-full max-h-full object-contain drop-shadow-sm pointer-events-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* What can be done with a stamp that was opened for editing (right-click it on the page) */}
      <div className="mt-2 flex flex-shrink-0 items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={flipLayer}
          disabled={!selected}
          title="Show it behind or in front of the drawing"
          style={{ fontSize: '12px', lineHeight: '1', padding: '0 8px' }}
          className="h-9 flex-1 flex items-center justify-center whitespace-nowrap bg-[#D4D4D8] hover:bg-[#e4e4e7] active:translate-y-0.5 transition-all cursor-pointer rounded-md border-3 border-black font-bold text-black shadow-[0_2px_0_#000] disabled:opacity-50 disabled:cursor-default"
        >
          {selected?.back ? 'to front' : 'to back'}
        </button>
        <button
          type="button"
          onClick={removeSelected}
          disabled={!selected}
          style={{ fontSize: '12px', lineHeight: '1', padding: '0 8px' }}
          className="h-9 flex-1 flex items-center justify-center whitespace-nowrap bg-[#D4D4D8] hover:bg-[#fca5a5] active:translate-y-0.5 transition-all cursor-pointer rounded-md border-3 border-black font-bold text-black shadow-[0_2px_0_#000] disabled:opacity-50 disabled:cursor-default"
        >
          delete
        </button>
      </div>
    </div>
  )
}

export default StampSidePanel