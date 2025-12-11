'use client'

import dynamic from 'next/dynamic'
import styles from './page.module.css'

const Scene3D = dynamic(() => import('@/components/Scene3D'), { ssr: false })
const FluidVideo = dynamic(() => import('@/components/FluidVideo'), { ssr: false })
const ImageGallery = dynamic(() => import('@/components/ImageGallery'), { ssr: false })
const PencilScene = dynamic(() => import('@/components/PencilScene'), { ssr: false })

// FluidVideo shader parameters
const fluidVideoParams = {
    velocityDissipation: 0.98,
    pressureIterations: 5,
    splatRadius: 0.003,
    splatForce: 5000,
    displacementScale: 0.1,
    chromaticAberration: 0.05,
}

// ImageGallery shader parameters
const imageGalleryParams = {
    velocityDissipation: 0.98,
    pressureIterations: 5,
    splatRadius: 0.003,
    splatForce: 5000,
    displacementScale: 0.1,
    chromaticAberration: 0.05,
}

const galleryImages = [
    { src: '/uschovna/ASKARINA-69.jpg' },
    { src: '/uschovna/ASKARINA-121.jpg' },
    { src: '/uschovna/ASKARINA-214.jpg' },
    { src: '/uschovna/ASKARINA-325.jpg' },
    { src: '/uschovna/ASKARINA-510.jpg' },
]

export default function TestPage() {
    return (
        <div className={styles.page}>
            <section className={styles.videoSection}>
                <Scene3D className={styles.canvas}>
                    <FluidVideo
                        videoSrc="/uschovna/ASKARINA_WEB_03.mp4"
                        velocityDissipation={fluidVideoParams.velocityDissipation}
                        pressureIterations={fluidVideoParams.pressureIterations}
                        splatRadius={fluidVideoParams.splatRadius}
                        splatForce={fluidVideoParams.splatForce}
                        displacementScale={fluidVideoParams.displacementScale}
                        chromaticAberration={fluidVideoParams.chromaticAberration}
                    />
                </Scene3D>
            </section>

            <section className={styles.bottomSection}>
                <div className={styles.bottomContent}>
                    <p className={styles.tagline}>Handcrafted with care</p>
                </div>
            </section>

            <section className={styles.gallerySection}>
                <ImageGallery
                    images={galleryImages}
                    velocityDissipation={imageGalleryParams.velocityDissipation}
                    pressureIterations={imageGalleryParams.pressureIterations}
                    splatRadius={imageGalleryParams.splatRadius}
                    splatForce={imageGalleryParams.splatForce}
                    displacementScale={imageGalleryParams.displacementScale}
                    chromaticAberration={imageGalleryParams.chromaticAberration}
                />
            </section>

            <section className={styles.pencilSection}>
                <Scene3D className={styles.pencilCanvas}>
                    <PencilScene
                        lineColor="rgba(255, 0, 0, 1)"
                        baseColor="#ffffff"
                        thresholdMin={0.5}
                        thresholdMax={1}
                        distortionScale={1.0}
                        useColor={true}
                        // To load a GLTF model, uncomment the line below:
                        modelUrl="/3d/Orchid Flower/scene.gltf"
                        modelScale={0.1}
                    />
                </Scene3D>
            </section>
        </div>
    )
}
