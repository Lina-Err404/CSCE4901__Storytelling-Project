"use client"

//there is definitely a more easier way to write this code oops... my apologizes -Belen
//Prototype of how the panel should be formatted
//Buttons have labels that should be replaced with Icons 

function StampSidePanel() {
  return (

    <div className="absolute top-10 bottom-16 left-0 z-10 flex w-70 flex-col rounded-r-4xl border-3 border-solid border-[#334670] bg-[#497BC3] p-3 pt-5">

      {/*Container with Stamps and Shapes buttons*/}
      <div className="mb-4 grid h-12 shrink-0 grid-cols-2 divide-x-2 divide-solid divide-[#D85728] rounded-2xl border-3 border-solid border-black bg-[#FFC250]">
        <div className="flex items-center justify-center">shapes</div>
        <div className="flex items-center justify-center">stamps</div>
      </div>

      {/*Container with Previous/Next buttons and Title for the current stamp/shape folder being viewed*/}
      <div className="mb-4 flex shrink-0 items-center justify-between gap-2">
        <div className="flex">prev</div>
        <div className="flex min-w-0 flex-1 justify-center truncate rounded-sm border-3 border-solid border-black bg-[#AAAAAA] p-3">current stamps</div>
        <div className="flex">next</div>
      </div>

      {/*Temporary grid of how the images should be arranged and should be scrollable*/}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-black p-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="aspect-square rounded-sm border-3 border-solid border-white bg-[#DDDDDD]"></div>
          <div className="aspect-square rounded-sm border-3 border-solid border-white bg-[#DDDDDD]"></div>
          <div className="aspect-square rounded-sm border-3 border-solid border-white bg-[#DDDDDD]"></div>
          <div className="aspect-square rounded-sm border-3 border-solid border-white bg-[#DDDDDD]"></div>
          <div className="aspect-square rounded-sm border-3 border-solid border-white bg-[#DDDDDD]"></div>
          <div className="aspect-square rounded-sm border-3 border-solid border-white bg-[#DDDDDD]"></div>
          <div className="aspect-square rounded-sm border-3 border-solid border-white bg-[#DDDDDD]"></div>
          <div className="aspect-square rounded-sm border-3 border-solid border-white bg-[#DDDDDD]"></div>
        </div>
      </div>
    </div>
  )
}
export default StampSidePanel;