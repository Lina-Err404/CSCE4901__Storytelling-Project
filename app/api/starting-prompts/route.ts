import { NextRequest, NextResponse } from "next/server";



//this gets the teachers custom starting prompt
export async function POST(request: NextRequest) {

try {
  const body = await request.json();



  //this is to reject prompts that arent formatted right
  
  if(!body || typeof body !== "object" || Array.isArray(body)) {

  return NextResponse.json(
    { error: "Invalid request." },

    {status: 400 } // means request isnt valid
  );
  }



  
  //this is to reject non text or blank prompts when custom wasnt selected
  const promptType = body.promptType;

  const promptText = body.promptText;

  if( promptType === "custom" && ( typeof promptText !== "string" || !promptText.trim())) {

  return NextResponse.json(

    { error: "Please enter a starting prompt." },

    { status: 400 } //means request isnt valid

    );

  }


  

  //saving the prompt to the lobby when connected
  // it just returns an error because the prompt isnt saved as of now

  return NextResponse.json(

    { error: "Starting prompt saved when it gets connected." },

    {status: 501 } //not implemented yet

  );
} catch {

  return NextResponse.json(

    { error: "Invalid request. "},
    { status: 400 }
  );
  }
}
