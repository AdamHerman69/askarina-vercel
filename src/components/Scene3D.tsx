'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense, ReactNode } from 'react'

interface Scene3DProps {
    children: ReactNode
    className?: string
    style?: React.CSSProperties
}

export default function Scene3D({ children, className, style }: Scene3DProps) {
    return (
        <Canvas
            className={className}
            style={style}
            gl={{ 
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
            }}
            dpr={[1, 2]}
        >
            <Suspense fallback={null}>
                {children}
            </Suspense>
        </Canvas>
    )
}
