"use client"

//there is definitely a more easier way to write this code oops... my apologizes -Belen
//Prototype of how the panel should be formatted
//Buttons have labels that should be replaced with Icons 

function StampSidePanel(){
    return(

      <div className="h-18/21 w-70 bg-[#497BC3] flex rounded-r-4xl border-solid border-[#334670] border-3 flex-col p-3 pt-5 mt-10 z-10 absolute inset-y-0 left-0">

        {/*Container with Stamps and Shapes buttons*/}
        <div className="h-1/12 bg-[#FFC250] grid grid-cols-2 divide-x-2 divide-solid divide-[#D85728] mb-6 rounded-2xl border-3 border-black border-solid">
          <div className="flex items-center justify-center">shapes</div>
          <div className="flex items-center justify-center">stamps</div>
        </div>

        {/*Container with Previous/Next buttons and Title for the current stamp/shape folder being viewed*/}
        <div className="h-1/12 flex justify-between items-center mb-6">
          <div className="flex ">prev</div>
          <div className="flex bg-[#AAAAAA] p-4 w-45 rounded-sm border-solid border-3 border-black justify-center text-lg">current stamps</div>
          <div className="flex">next</div>      
        </div>

        {/*Temporary grid of how the images should be arranged and should be scrollable*/}
        <div className="h-6/7 bg-black rounded-2xl items-center justify-center p-2">
          <div className="h-full grid grid-cols-2 gap-2">      
            <div className="bg-[#DDDDDD] rounded-sm border-solid border-white border-3"></div>
            <div className="bg-[#DDDDDD] rounded-sm border-solid border-white border-3"></div>
            <div className="bg-[#DDDDDD] rounded-sm border-solid border-white border-3"></div>
            <div className="bg-[#DDDDDD] rounded-sm border-solid border-white border-3"></div>
            <div className="bg-[#DDDDDD] rounded-sm border-solid border-white border-3"></div>
            <div className="bg-[#DDDDDD] rounded-sm border-solid border-white border-3"></div>
            <div className="bg-[#DDDDDD] rounded-sm border-solid border-white border-3"></div>
            <div className="bg-[#DDDDDD] rounded-sm border-solid border-white border-3"></div>
          </div>
        </div>   
      </div>
    )
  }
export default StampSidePanel;