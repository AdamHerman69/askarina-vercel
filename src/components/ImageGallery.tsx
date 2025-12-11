'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import styles from './ImageGallery.module.css'

const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false })
const FluidImage = dynamic(() => import('./FluidImage'), { ssr: false })

interface GalleryImage {
    src: string
    alt?: string
}

interface ImageGalleryProps {
    images: GalleryImage[]
    velocityDissipation?: number
    pressureIterations?: number
    splatRadius?: number
    splatForce?: number
    displacementScale?: number
    chromaticAberration?: number
}

function GalleryItem({ 
    image, 
    velocityDissipation,
    pressureIterations,
    splatRadius,
    splatForce,
    displacementScale, 
    chromaticAberration 
}: { 
    image: GalleryImage
    velocityDissipation: number
    pressureIterations: number
    splatRadius: number
    splatForce: number
    displacementScale: number
    chromaticAberration: number
}) {
    const ref = useRef<HTMLDivElement>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                }
            },
            {
                threshold: 0.15,
                rootMargin: '0px 0px -50px 0px'
            }
        )

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => observer.disconnect()
    }, [])

    return (
        <div 
            ref={ref} 
            className={`${styles.galleryItem} ${isVisible ? styles.visible : ''}`}
        >
            <div className={styles.imageWrapper}>
                <Scene3D className={styles.canvas}>
                    <FluidImage
                        imageSrc={image.src}
                        velocityDissipation={velocityDissipation}
                        pressureIterations={pressureIterations}
                        splatRadius={splatRadius}
                        splatForce={splatForce}
                        displacementScale={displacementScale}
                        chromaticAberration={chromaticAberration}
                    />
                </Scene3D>
            </div>
        </div>
    )
}

export default function ImageGallery({ 
    images,
    velocityDissipation = 0.98,
    pressureIterations = 10,
    splatRadius = 0.003,
    splatForce = 5000,
    displacementScale = 50, 
    chromaticAberration = 0.05 
}: ImageGalleryProps) {
    return (
        <div className={styles.gallery}>
            {images.map((image, index) => (
                <GalleryItem 
                    key={index} 
                    image={image}
                    velocityDissipation={velocityDissipation}
                    pressureIterations={pressureIterations}
                    splatRadius={splatRadius}
                    splatForce={splatForce}
                    displacementScale={displacementScale}
                    chromaticAberration={chromaticAberration}
                />
            ))}
        </div>
    )
}
