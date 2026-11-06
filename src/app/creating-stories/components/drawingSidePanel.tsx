"use client"

import Image from 'next/image'
import pencilIcon from '../../../../public/images/pageAssets/pencilIcon.png'
import spraycanIcon from '../../../../public/images/pageAssets/spraycanIcon.png'
import eraserIcon from '../../../../public/images/pageAssets/eraserIcon.png'

//there is definitely a more easier way to write this code oops... my apologizes -Belen
//Prototype of how the panel should be formatted
//Buttons have labels that should be replaced with Icons 

function DrawingSidePanel(){
    return(
      
      <div className="h-18/21 w-60 bg-[#497BC3] flex rounded-l-4xl border-solid border-[#334670] border-3 flex-col pt-3 pl-3 pr-3 mt-10 z-10 absolute inset-y-0 right-0">

        {/*Container with Undo/Redo and Delete All buttons*/}
        <div className="h-1/15 flex justify-between mb-6">
          <div className="w-11 flex-start bg-[#FFC250] rounded-sm border-3 border-black border-solid">undo</div>
          <div className="w-11 flex-start bg-[#FFC250] rounded-sm border-3 border-black border-solid">redo</div>

          <div className="w-22 flex-end bg-[#BBBBBB] ml-8 rounded-sm border-3 border-black border-solid items-center justify-center">delete all</div>
        </div>
            
        {/*Color Palette*/}
        <div className="h-4/9 mb-2 grid grid-cols-4 gap-1">
          <div className="grid grid-rows-5 gap-1">
            <div className="bg-[#FFFFFF] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#FC0000] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#FF8888] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#00F7E2] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#C1E6EE] rounded-sm border-solid border-black border-3"></div>
          </div>
          <div className="grid grid-rows-5 gap-1">
            <div className="bg-[#000000] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#FF7300] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#F1B85D] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#0059FF] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#7B86FC] rounded-sm border-solid border-black border-3"></div>
          </div>
          <div className="grid grid-rows-5 gap-1">
            <div className="bg-[#868686] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#FFF200] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#F9F989] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#8000FF] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#CA8EEA] rounded-sm border-solid border-black border-3"></div>
          </div>
          <div className="grid grid-rows-5 gap-1">
            <div className="bg-[#5C3922] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#0FBA03] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#63F056] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#FF00D5] rounded-sm border-solid border-black border-3"></div>
            <div className="bg-[#F07FB4] rounded-sm border-solid border-black border-3"></div>
          </div>
        </div>

        {/*Color Picker Object*/}
        <div className="h-1/12 flex bg-white mb-4 rounded-lg border-3 border-solid border-black text-black">Color Picker</div>

        {/*Transparency Slider (not built, just a rectangle...my bad -Belen)*/}
        <div className="h-1/15 flex bg-black mb-3 rounded-lg">Transparency Slider</div>

        {/*Container with Fill Bucket and Brush Size Buttons*/}
        <div className="h-1/12 mb-3">
          <div className="h-full flex justify-between mb-6">
            <div className="w-15 flex-start bg-[#AAAAAA] rounded-sm border-3 border-solid border-black">fill bucket</div>

            <div className="w-9 flex-end bg-[#FFC250] rounded-l-sm ml-3 border-3 border-black border-solid">sm</div>
            <div className="w-17 flex-end bg-white border-3 border-black border-solid text-black">size</div>
            <div className="w-9 flex-end bg-[#FFC250] rounded-r-sm border-3 border-black border-solid">lg</div>
          </div>
        </div>

        {/*Brush and Eraser Icons*/}
        <div className="h-1/6 flex flex-row overflow-hidden">
          <Image 
            src={pencilIcon}
            alt="pencil brush"/>

          <Image 
            src={spraycanIcon}
            alt="spray can brush"/>

          <Image 
            src={eraserIcon}
            alt="eraser"/>
        </div>
      </div>
    )
  }

export default DrawingSidePanel;