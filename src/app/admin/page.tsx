'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import styles from './page.module.css'

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

function AdminContent() {
    const searchParams = useSearchParams()
    const password = searchParams.get('password')
    
    const [config, setConfig] = useState<Config | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [authorized, setAuthorized] = useState(false)
    const [message, setMessage] = useState('')
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

    useEffect(() => {
        if (!password) {
            setLoading(false)
            return
        }

        fetch('/api/config')
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    setMessage('Failed to load config')
                } else {
                    setConfig(data)
                    setAuthorized(true)
                }
            })
            .catch(() => setMessage('Failed to load config'))
            .finally(() => setLoading(false))
    }, [password])

    const saveConfig = useCallback(async () => {
        if (!config || !password) return

        setSaving(true)
        setMessage('')

        try {
            const res = await fetch(`/api/config?password=${encodeURIComponent(password)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })

            if (res.ok) {
                setMessage('Saved successfully!')
            } else if (res.status === 401) {
                setMessage('Invalid password')
                setAuthorized(false)
            } else {
                setMessage('Failed to save')
            }
        } catch {
            setMessage('Failed to save')
        } finally {
            setSaving(false)
        }
    }, [config, password])

    const updateText = (key: keyof Config['texts'], value: string) => {
        if (!config) return
        setConfig({
            ...config,
            texts: { ...config.texts, [key]: value }
        })
    }

    const updateContact = (key: keyof Config['contact'], value: string) => {
        if (!config) return
        setConfig({
            ...config,
            contact: { ...config.contact, [key]: value }
        })
    }

    const toggleVisibility = (index: number) => {
        if (!config) return
        const newImages = [...config.images]
        newImages[index] = { ...newImages[index], visible: !newImages[index].visible }
        setConfig({ ...config, images: newImages })
    }

    const handleDragStart = (index: number) => {
        setDraggedIndex(index)
    }

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === index || !config) return

        const newImages = [...config.images]
        const draggedItem = newImages[draggedIndex]
        newImages.splice(draggedIndex, 1)
        newImages.splice(index, 0, draggedItem)
        
        setConfig({ ...config, images: newImages })
        setDraggedIndex(index)
    }

    const handleDragEnd = () => {
        setDraggedIndex(null)
    }

    const moveImage = (index: number, direction: 'up' | 'down') => {
        if (!config) return
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= config.images.length) return

        const newImages = [...config.images]
        const temp = newImages[index]
        newImages[index] = newImages[newIndex]
        newImages[newIndex] = temp
        setConfig({ ...config, images: newImages })
    }

    if (loading) {
        return <div className={styles.container}><p>Loading...</p></div>
    }

    if (!password || !authorized) {
        return (
            <div className={styles.container}>
                <div className={styles.unauthorized}>
                    <h1>Admin Access Required</h1>
                    <p>Please add <code>?password=YOUR_PASSWORD</code> to the URL</p>
                </div>
            </div>
        )
    }

    if (!config) {
        return <div className={styles.container}><p>Failed to load configuration</p></div>
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1>Admin Panel</h1>
                <div className={styles.actions}>
                    {message && <span className={styles.message}>{message}</span>}
                    <button 
                        onClick={saveConfig} 
                        disabled={saving}
                        className={styles.saveButton}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </header>

            <section className={styles.section}>
                <h2>Hero Texts</h2>
                <div className={styles.form}>
                    <label>
                        Subtitle
                        <input
                            type="text"
                            value={config.texts.subtitle}
                            onChange={(e) => updateText('subtitle', e.target.value)}
                        />
                    </label>
                    <label>
                        Title
                        <input
                            type="text"
                            value={config.texts.title}
                            onChange={(e) => updateText('title', e.target.value)}
                        />
                    </label>
                    <label>
                        Tagline
                        <input
                            type="text"
                            value={config.texts.tagline}
                            onChange={(e) => updateText('tagline', e.target.value)}
                        />
                    </label>
                </div>
            </section>

            <section className={styles.section}>
                <h2>Contact Information</h2>
                <div className={styles.form}>
                    <label>
                        Email
                        <input
                            type="email"
                            value={config.contact.email}
                            onChange={(e) => updateContact('email', e.target.value)}
                        />
                    </label>
                    <label>
                        Phone
                        <input
                            type="tel"
                            value={config.contact.phone}
                            onChange={(e) => updateContact('phone', e.target.value)}
                        />
                    </label>
                    <label>
                        Instagram Handle
                        <input
                            type="text"
                            value={config.contact.instagram}
                            onChange={(e) => updateContact('instagram', e.target.value)}
                        />
                    </label>
                    <label>
                        Instagram URL
                        <input
                            type="url"
                            value={config.contact.instagramUrl}
                            onChange={(e) => updateContact('instagramUrl', e.target.value)}
                        />
                    </label>
                </div>
            </section>

            <section className={styles.section}>
                <h2>Gallery Images</h2>
                <p className={styles.hint}>Drag to reorder, click eye to toggle visibility</p>
                <div className={styles.imageGrid}>
                    {config.images.map((image, index) => (
                        <div
                            key={image.src}
                            className={`${styles.imageCard} ${!image.visible ? styles.hidden : ''} ${draggedIndex === index ? styles.dragging : ''}`}
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                        >
                            <div className={styles.imagePreview}>
                                <Image
                                    src={image.src}
                                    alt={image.alt}
                                    fill
                                    sizes="150px"
                                    style={{ objectFit: 'cover' }}
                                />
                            </div>
                            <div className={styles.imageControls}>
                                <span className={styles.imageIndex}>#{index + 1}</span>
                                <div className={styles.buttons}>
                                    <button
                                        onClick={() => moveImage(index, 'up')}
                                        disabled={index === 0}
                                        title="Move up"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        onClick={() => moveImage(index, 'down')}
                                        disabled={index === config.images.length - 1}
                                        title="Move down"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        onClick={() => toggleVisibility(index)}
                                        className={image.visible ? styles.visible : styles.hiddenBtn}
                                        title={image.visible ? 'Hide image' : 'Show image'}
                                    >
                                        {image.visible ? '👁' : '👁‍🗨'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}

export default function AdminPage() {
    return (
        <Suspense fallback={<div className={styles.container}><p>Loading...</p></div>}>
            <AdminContent />
        </Suspense>
    )
}
