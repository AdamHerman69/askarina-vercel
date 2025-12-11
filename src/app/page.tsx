import styles from './page.module.css'
import Image from 'next/image'

const galleryImages = [
    { src: '/uschovna/ASKARINA-1.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-35.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-42.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-64.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-69.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-77.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-91.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-105.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-107.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-115.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-121.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-122.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-124.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-128.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-132.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-152.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-214.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-218.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-230.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-246.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-247.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-274.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-277.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-295.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-298.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-299.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-325.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-361.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-372.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-381.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-414.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-415.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-421.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-474.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-484.jpg', alt: 'Askarina' },
    { src: '/uschovna/ASKARINA-497.jpg', alt: 'Askarina' },
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

            {/* Contact Section */}
            <section className={styles.contact}>
                <a href="mailto:svarckaterin@gmail.com" className={styles.contactItem}>svarckaterin@gmail.com</a>
                <a href="tel:+420777746885" className={styles.contactItem}>+420777746885</a>
                <a href="https://instagram.com/aaaskarinaaa" target="_blank" rel="noopener noreferrer" className={styles.contactItem}>@aaaskarinaaa</a>
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
