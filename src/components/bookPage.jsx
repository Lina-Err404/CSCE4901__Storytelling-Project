"use client"

import React, {useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Stage, Layer, Rect, Image, Circle, Star, Text, Wedge, Arc, Line, Ellipse, RegularPolygon, Transformer } from 'react-konva';




function BookPage() {
    return (
        <div className="flex items-center">
        <Stage width={900} height={600} style={{background: "#f0f0f0" }}>
            <Layer>

            </Layer>
        </Stage>
        </div>
    );
}

export default BookPage;