import styles from './page.module.css'
import Image from 'next/image'

const galleryImages = [
    { src: '/uschovna/ASKARINA-69.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-121.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-214.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-325.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-510.jpg', alt: 'Askarina' },
]

export default function Home() {
    return (
        <main className={styles.page}>
            {/* Hero Section with Video */}
            <section className={styles.hero}>
                <video
                    className={styles.video}
                    autoPlay
                    muted
                    loop
                    playsInline
                >
                    <source src="/uschovna/ASKARINA_WEB_03.mp4" type="video/mp4" />
                </video>

                {/* Text Overlay */}
                <div className={styles.overlay}>
                    <span className={styles.subtitle}>Primitive pieces</span>
                    <h1 className={styles.title}>Askarina</h1>
                    <span className={styles.tagline}>attempts for everyone</span>
                </div>
            </section>

            {/* Image Gallery */}
            <section className={styles.gallery}>
                {galleryImages.map((image, index) => (
                    <div key={index} className={styles.imageWrapper}>
                        <Image
                            src={image.src}
                            alt={image.alt}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className={styles.image}
                        />
                    </div>
                ))}
            </section>
        </main>
    )
}
