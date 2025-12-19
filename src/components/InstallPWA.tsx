import React, { useEffect, useState } from 'react'

export function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false)

  useEffect(() => {
    // Проверка iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const ios = /iphone|ipad|ipod/.test(userAgent)
    setIsIos(ios)

    // Проверка, запущено ли приложение как PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true
    setIsInStandaloneMode(standalone)

    // Обработчик beforeinstallprompt для Chromium
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt')
        } else {
          console.log('User dismissed the install prompt')
        }
        setDeferredPrompt(null)
        setShowInstall(false)
      })
    }
  }

  // Если уже в режиме standalone, не показываем ничего
  if (isInStandaloneMode) return null

  // Для iOS показываем инструкцию
  if (isIos) {
    return (
      <div style={{position: 'fixed', bottom: 0, width: '100%', background: '#4B6CB7', color: 'white', padding: '10px', textAlign: 'center', zIndex: 1000}}>
        Для установки приложения нажмите <strong>Поделиться → На экран «Домой»</strong>
      </div>
    )
  }

  // Для Chromium показываем кнопку установки
  if (showInstall) {
    return (
      <button
        style={{position: 'fixed', bottom: 20, right: 20, padding: '10px 20px', background: '#4B6CB7', color: 'white', border: 'none', borderRadius: '5px', zIndex: 1000}}
        onClick={handleInstallClick}
      >
        Установить приложение
      </button>
    )
  }

  return null
}