"use client"

import React, {useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Stage, Layer, Rect, Image, Circle, Star, Text, Wedge, Arc, Line, Ellipse, RegularPolygon, Transformer } from 'react-konva';

//Double Page Enviroments


function BookPage() {
    return (
        <div className="flex items-start flex-row">
            {/*Writing Stage*/}
            <Stage width={700} height={500} style={{background: "#f0f0f0", marginRight: 5 }}>
               <Layer>

                </Layer>
            </Stage>

           {/*Drawing Stage*/}
            <Stage width={700} height={500} style={{background: "#f0f0f0", marginLeft: 5 }}>
                <Layer>

                </Layer>
            </Stage>
        </div>
    );
}

export default BookPage;