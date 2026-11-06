"use client"

import React, { useState } from 'react'
import Image from 'next/image'
import pencilIcon from '../../../../public/images/pageAssets/pencilIcon.png'
import spraycanIcon from '../../../../public/images/pageAssets/spraycanIcon.png'
import eraserIcon from '../../../../public/images/pageAssets/eraserIcon.png'

const PALETTE_COLORS = [
  '#FFFFFF', '#000000', '#868686', '#5C3922',
  '#FC0000', '#FF7300', '#FFF200', '#0FBA03',
  '#FF8888', '#F1B85D', '#F9F989', '#63F056',
  '#00F7E2', '#0059FF', '#8000FF', '#FF00D5',
  '#C1E6EE', '#7B86FC', '#CA8EEA', '#F07FB4',
]

const BRUSH_SIZES = [4, 7, 10, 13, 16]

function DrawingSidePanel() {
  const [selectedColor, setSelectedColor] = useState('#000000')
  const [selectedTool, setSelectedTool] = useState<'pencil' | 'spray' | 'eraser' | 'fill'>('pencil')
  const [sizeIndex, setSizeIndex] = useState(2)
  const [opacity, setOpacity] = useState(100)

  return (
    <div className="h-18/21 w-60 bg-[#497BC3] flex rounded-l-4xl border-solid border-[#334670] border-3 flex-col pt-4 px-3.5 pb-0 mt-10 z-10 absolute inset-y-0 right-0 shadow-xl select-none overflow-hidden">

      {/* Top Row: Undo / Redo / Delete All — Constrained to w-full with locked font/padding */}
      <div className="w-full flex items-center justify-between gap-1.5 mb-3.5 flex-shrink-0">
        <div className="flex gap-1.5">
          <button
            type="button"
            style={{ fontSize: '12px', lineHeight: '1', padding: '0 10px' }}
            className="h-9 flex items-center justify-center bg-[#FFC250] hover:bg-[#ffb020] active:translate-y-0.5 transition-all cursor-pointer rounded-md border-3 border-black font-bold text-black shadow-[0_2px_0_#000]"
          >
            undo
          </button>
          <button
            type="button"
            style={{ fontSize: '12px', lineHeight: '1', padding: '0 10px' }}
            className="h-9 flex items-center justify-center bg-[#FFC250] hover:bg-[#ffb020] active:translate-y-0.5 transition-all cursor-pointer rounded-md border-3 border-black font-bold text-black shadow-[0_2px_0_#000]"
          >
            redo
          </button>
        </div>

        <button
          type="button"
          style={{ fontSize: '12px', lineHeight: '1', padding: '0 10px' }}
          className="h-9 flex items-center justify-center whitespace-nowrap bg-[#D4D4D8] hover:bg-[#fca5a5] active:translate-y-0.5 transition-all cursor-pointer rounded-md border-3 border-black font-bold text-black shadow-[0_2px_0_#000]"
        >
          delete all
        </button>
      </div>

      {/* Color Palette Grid */}
      <div className="mb-3.5 grid grid-cols-4 gap-2 flex-shrink-0 bg-[#3B66A6] p-2 rounded-xl border-2 border-[#334670]">
        {PALETTE_COLORS.map((color) => {
          const isSelected = selectedColor.toUpperCase() === color.toUpperCase()
          return (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              style={{
                backgroundColor: color,
                backgroundImage:
                  'linear-gradient(145deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 48%, rgba(0,0,0,0.28) 100%)',
                padding: 0,
              }}
              className={`aspect-square rounded-md border-3 border-black cursor-pointer transition-transform hover:scale-105 ${
                isSelected ? 'ring-2 ring-white scale-105 shadow-md' : 'shadow-[0_2px_0_rgba(0,0,0,0.5)]'
              }`}
              aria-label={`Select color ${color}`}
            />
          )
        })}
      </div>

      {/* Color Picker Bar */}
      <label className="h-9 flex items-center justify-between px-3 bg-white hover:bg-gray-50 cursor-pointer mb-3 rounded-lg border-3 border-black text-black font-bold text-xs flex-shrink-0 shadow-[0_2px_0_#000]">
        <span>Color Picker</span>
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => setSelectedColor(e.target.value)}
          className="w-6 h-5 cursor-pointer border border-black rounded bg-transparent"
        />
      </label>

      {/* Transparency Slider */}
      <div className="h-10 flex flex-col justify-center px-3 bg-[#1E293B] mb-3 rounded-lg border-3 border-black text-white font-bold text-[11px] flex-shrink-0 shadow-[0_2px_0_#000]">
        <div className="flex justify-between items-center mb-0.5">
          <span>Transparency</span>
          <span>{opacity}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={100}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full h-1.5 accent-[#FFC250] cursor-pointer"
        />
      </div>

      {/* Fill Bucket & Brush Size Controls */}
      <div className="h-11 mb-2 flex-shrink-0 flex items-stretch justify-between gap-2">
        <button
          type="button"
          onClick={() => setSelectedTool('fill')}
          style={{ fontSize: '11px', lineHeight: '1.15', padding: '2px 10px' }}
          className={`flex flex-col items-center justify-center cursor-pointer rounded-lg border-3 border-black font-bold text-black text-center shadow-[0_2px_0_#000] transition-colors ${
            selectedTool === 'fill' ? 'bg-[#FFC250]' : 'bg-[#D4D4D8] hover:bg-[#e4e4e7]'
          }`}
        >
          <span>fill</span>
          <span>bucket</span>
        </button>

        <div className="flex flex-1 rounded-lg overflow-hidden border-3 border-black shadow-[0_2px_0_#000] bg-white">
          <button
            type="button"
            onClick={() => setSizeIndex((prev) => Math.max(0, prev - 1))}
            disabled={sizeIndex === 0}
            style={{ fontSize: '16px', lineHeight: '1', padding: 0 }}
            className="w-8 flex items-center justify-center bg-[#FFC250] hover:bg-[#ffb020] disabled:opacity-50 cursor-pointer border-r-3 border-black font-bold text-black"
            aria-label="Decrease brush size"
          >
            −
          </button>

          <div className="flex-1 flex items-center justify-center gap-1.5 px-1 bg-white text-black font-bold text-xs">
            <span>Size</span>
            <span
              style={{
                width: `${BRUSH_SIZES[sizeIndex]}px`,
                height: `${BRUSH_SIZES[sizeIndex]}px`,
              }}
              className="rounded-full bg-black inline-block transition-all flex-shrink-0"
            />
          </div>

          <button
            type="button"
            onClick={() => setSizeIndex((prev) => Math.min(BRUSH_SIZES.length - 1, prev + 1))}
            disabled={sizeIndex === BRUSH_SIZES.length - 1}
            style={{ fontSize: '16px', lineHeight: '1', padding: 0 }}
            className="w-8 flex items-center justify-center bg-[#FFC250] hover:bg-[#ffb020] disabled:opacity-50 cursor-pointer border-l-3 border-black font-bold text-black"
            aria-label="Increase brush size"
          >
            +
          </button>
        </div>
      </div>

      {/* Brush and Eraser Icons */}
      <div className="mt-auto pt-3 h-28 flex flex-row items-end justify-around gap-1 overflow-hidden">
        <button
          type="button"
          onClick={() => setSelectedTool('pencil')}
          style={{ padding: 0 }}
          className={`h-full flex items-end justify-center cursor-pointer transition-transform bg-transparent border-0 ${
            selectedTool === 'pencil' ? '-translate-y-1 scale-105' : 'translate-y-1 hover:translate-y-0 opacity-90'
          }`}
        >
          <Image
            src={pencilIcon}
            alt="pencil brush"
            className="object-contain object-bottom h-full w-auto drop-shadow-md"
          />
        </button>

        <button
          type="button"
          onClick={() => setSelectedTool('spray')}
          style={{ padding: 0 }}
          className={`h-full flex items-end justify-center cursor-pointer transition-transform bg-transparent border-0 ${
            selectedTool === 'spray' ? '-translate-y-1 scale-105' : 'translate-y-1 hover:translate-y-0 opacity-90'
          }`}
        >
          <Image
            src={spraycanIcon}
            alt="spray can brush"
            className="object-contain object-bottom h-full w-auto drop-shadow-md"
          />
        </button>

        <button
          type="button"
          onClick={() => setSelectedTool('eraser')}
          style={{ padding: 0 }}
          className={`h-full flex items-end justify-center cursor-pointer transition-transform bg-transparent border-0 ${
            selectedTool === 'eraser' ? '-translate-y-1 scale-105' : 'translate-y-1 hover:translate-y-0 opacity-90'
          }`}
        >
          <Image
            src={eraserIcon}
            alt="eraser"
            className="object-contain object-bottom h-full w-auto drop-shadow-md"
          />
        </button>
      </div>
    </div>
  )
}

export default DrawingSidePanel