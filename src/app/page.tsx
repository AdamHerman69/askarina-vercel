import styles from './page.module.css'
import Image from 'next/image'
import { promises as fs } from 'fs'
import path from 'path'

interface GalleryImage {
    src: string
    alt: string
    visible: boolean
}

interface Config {
    texts: {
        subtitle: string
        title: string
        tagline: string
    }
    contact: {
        email: string
        phone: string
        instagram: string
        instagramUrl: string
    }
    images: GalleryImage[]
}

async function getConfig(): Promise<Config> {
    const configPath = path.join(process.cwd(), 'src/data/config.json')
    const data = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(data)
}

export const dynamic = 'force-dynamic'

export default async function Home() {
    const config = await getConfig()
    const visibleImages = config.images.filter(img => img.visible)

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
                    <span className={styles.subtitle}>{config.texts.subtitle}</span>
                    <h1 className={styles.title}>{config.texts.title}</h1>
                    <span className={styles.tagline}>{config.texts.tagline}</span>
                </div>
            </section>

            {/* Contact Section */}
            <section className={styles.contact}>
                <a href={`mailto:${config.contact.email}`} className={styles.contactItem}>{config.contact.email}</a>
                <a href={`tel:${config.contact.phone}`} className={styles.contactItem}>{config.contact.phone}</a>
                <a href={config.contact.instagramUrl} target="_blank" rel="noopener noreferrer" className={styles.contactItem}>{config.contact.instagram}</a>
            </section>

            {/* Image Gallery */}
            <section className={styles.gallery}>
                {visibleImages.map((image, index) => (
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
