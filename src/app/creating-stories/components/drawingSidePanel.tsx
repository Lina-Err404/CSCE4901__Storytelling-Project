"use client"

import Image from 'next/image'
import pencilIcon from '../../../../public/images/pageAssets/pencilIcon.png'
import spraycanIcon from '../../../../public/images/pageAssets/spraycanIcon.png'
import eraserIcon from '../../../../public/images/pageAssets/eraserIcon.png'

//there is definitely a more easier way to write this code oops... my apologizes -Belen
//Prototype of how the panel should be formatted
//Buttons have labels that should be replaced with Icons 

function DrawingSidePanel() {
  return (

    <div className="absolute top-10 right-0 bottom-16 z-10 flex w-60 flex-col rounded-l-4xl border-3 border-solid border-[#334670] bg-[#497BC3] px-3 pt-3">

      {/*Container with Undo/Redo and Delete All buttons*/}
      <div className="mb-3 flex h-10 shrink-0 items-stretch gap-1">
        <div className="flex items-center justify-center rounded-sm border-3 border-black border-solid bg-[#FFC250] px-2">undo</div>
        <div className="flex items-center justify-center rounded-sm border-3 border-black border-solid bg-[#FFC250] px-2">redo</div>

        <div className="ml-auto flex items-center justify-center whitespace-nowrap rounded-sm border-3 border-black border-solid bg-[#BBBBBB] px-2">delete all</div>
      </div>

      {/*Color Palette*/}
      <div className="mb-2 grid min-h-24 flex-1 grid-cols-4 gap-1">
        <div className="grid min-h-0 grid-rows-5 gap-1">
          <div className="bg-[#FFFFFF] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#FC0000] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#FF8888] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#00F7E2] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#C1E6EE] rounded-sm border-solid border-black border-3"></div>
        </div>
        <div className="grid min-h-0 grid-rows-5 gap-1">
          <div className="bg-[#000000] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#FF7300] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#F1B85D] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#0059FF] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#7B86FC] rounded-sm border-solid border-black border-3"></div>
        </div>
        <div className="grid min-h-0 grid-rows-5 gap-1">
          <div className="bg-[#868686] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#FFF200] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#F9F989] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#8000FF] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#CA8EEA] rounded-sm border-solid border-black border-3"></div>
        </div>
        <div className="grid min-h-0 grid-rows-5 gap-1">
          <div className="bg-[#5C3922] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#0FBA03] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#63F056] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#FF00D5] rounded-sm border-solid border-black border-3"></div>
          <div className="bg-[#F07FB4] rounded-sm border-solid border-black border-3"></div>
        </div>
      </div>

      {/*Color Picker Object*/}
      <div className="mb-3 flex h-11 shrink-0 items-center justify-center rounded-lg border-3 border-solid border-black bg-white text-black">Color Picker</div>

      {/*Transparency Slider (not built, just a rectangle...my bad -Belen)*/}
      <div className="mb-3 flex h-8 shrink-0 items-center justify-center rounded-lg bg-black">Transparency Slider</div>

      {/*Container with Fill Bucket and Brush Size Buttons*/}
      <div className="mb-3 flex h-11 shrink-0 items-stretch gap-1">
        <div className="flex items-center justify-center whitespace-nowrap rounded-sm border-3 border-solid border-black bg-[#AAAAAA] px-2">fill bucket</div>

        <div className="ml-auto flex items-stretch">
          <div className="flex items-center justify-center rounded-l-sm border-3 border-black border-solid bg-[#FFC250] px-2">sm</div>
          <div className="flex items-center justify-center border-3 border-black border-solid bg-white px-2 text-black">size</div>
          <div className="flex items-center justify-center rounded-r-sm border-3 border-black border-solid bg-[#FFC250] px-2">lg</div>
        </div>
      </div>

      {/*Brush and Eraser Icons*/}
      <div className="flex h-28 shrink-0 items-start overflow-hidden">
        <Image
          src={pencilIcon}
          alt="pencil brush"
          className="h-auto w-1/3 min-w-0" />

        <Image
          src={spraycanIcon}
          alt="spray can brush"
          className="h-auto w-1/3 min-w-0" />

        <Image
          src={eraserIcon}
          alt="eraser"
          className="h-auto w-1/3 min-w-0" />
      </div>
    </div>
  )
}

export default DrawingSidePanel;