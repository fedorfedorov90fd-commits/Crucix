// dashboard/pwa/install.js
// Логика установки PWA + регистрация SW + push subscriptions

class PWAManager {
  constructor() {
    this.deferredPrompt = null;
    this.installed = false;
    this.swRegistration = null;
    this.subscription = null;

    this._setup();
  }

  _setup() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => this.registerSW());
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallBanner();
    });

    window.addEventListener('appinstalled', () => {
      this.installed = true;
      this.deferredPrompt = null;
      this.hideInstallBanner();
      console.log('[PWA] App installed');
    });

    if (window.matchMedia('(display-mode: standalone)').matches) {
      this.installed = true;
      console.log('[PWA] Running in standalone mode');
    }
  }

  async registerSW() {
    try {
      const registration = await navigator.serviceWorker.register('/pwa/service-worker.js', {
        scope: '/',
      });

      this.swRegistration = registration;
      console.log('[PWA] SW registered:', registration.scope);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.showUpdateBanner();
          }
        });
      });

      return registration;
    } catch (e) {
      console.error('[PWA] SW registration failed:', e);
      return null;
    }
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return { ok: false, reason: 'no_prompt' };
    }

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);

    this.deferredPrompt = null;
    this.hideInstallBanner();

    return { ok: outcome === 'accepted', outcome };
  }

  showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div style="
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #3b82f6, #8b5cf6);
        color: white; padding: 16px 24px; border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3); z-index: 9999;
        display: flex; align-items: center; gap: 16px;
        font-family: -apple-system, sans-serif; max-width: 90%;
      ">
        <div style="flex: 1;">
          <div style="font-weight: 700; margin-bottom: 4px;">Install Crucix</div>
          <div style="font-size: 12px; opacity: 0.9;">Get real-time alerts on your device</div>
        </div>
        <button id="pwa-install-btn" style="
          background: white; color: #3b82f6; border: none;
          padding: 8px 16px; border-radius: 6px; font-weight: 600;
          cursor: pointer; font-size: 13px;
        ">Install</button>
        <button id="pwa-dismiss-btn" style="
          background: transparent; color: white; border: 1px solid rgba(255,255,255,0.3);
          width: 32px; height: 32px; border-radius: 6px; cursor: pointer;
          font-size: 18px; line-height: 1;
        ">x</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').onclick = () => this.promptInstall();
    document.getElementById('pwa-dismiss-btn').onclick = () => this.hideInstallBanner();
  }

  hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
  }

  showUpdateBanner() {
    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = `
      <div style="
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #1e293b; color: white; padding: 12px 20px;
        border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        z-index: 9999; display: flex; gap: 12px; align-items: center;
        font-family: -apple-system, sans-serif; font-size: 14px;
      ">
        <span>New version available</span>
        <button onclick="this.parentElement.parentElement.remove(); location.reload();" style="
          background: #3b82f6; color: white; border: none;
          padding: 6px 12px; border-radius: 6px; cursor: pointer;
        ">Reload</button>
      </div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 30000);
  }

  async requestPushPermission() {
    if (!('Notification' in window)) {
      return { ok: false, reason: 'notifications_not_supported' };
    }

    if (Notification.permission === 'granted') {
      return await this.subscribePush();
    }

    if (Notification.permission === 'denied') {
      return { ok: false, reason: 'permission_denied' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'permission_denied' };
    }

    return await this.subscribePush();
  }

  async subscribePush() {
    if (!this.swRegistration) {
      return { ok: false, reason: 'no_sw' };
    }

    try {
      const vapidPublicKey = await this._getVapidKey();

      if (!vapidPublicKey) {
        return { ok: false, reason: 'no_vapid_key' };
      }

      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this._urlBase64ToUint8Array(vapidPublicKey),
      });

      this.subscription = subscription;

      await this._sendSubscriptionToServer(subscription);

      return { ok: true, subscription };
    } catch (e) {
      console.error('[PWA] Push subscription failed:', e);
      return { ok: false, reason: e.message };
    }
  }

  async unsubscribePush() {
    if (!this.subscription) return { ok: true };

    try {
      await this.subscription.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: this.subscription.endpoint }),
      });
      this.subscription = null;
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.message };
    }
  }

  async _getVapidKey() {
    try {
      const res = await fetch('/api/push/vapid-key');
      if (res.ok) {
        const data = await res.json();
        return data.publicKey;
      }
    } catch (e) {
      // Fallback
    }
    return null;
  }

  async _sendSubscriptionToServer(subscription) {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
    } catch (e) {
      console.error('[PWA] Failed to send subscription:', e);
    }
  }

  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async testNotification() {
    if (!this.swRegistration) return;
    await this.swRegistration.showNotification('Crucix Test', {
      body: 'Push notifications are working!',
      icon: '/pwa/icons/icon-192.png',
      badge: '/pwa/icons/icon-96.png',
      tag: 'test',
    });
  }

  getStatus() {
    return {
      installed: this.installed,
      swRegistered: !!this.swRegistration,
      pushSupported: 'PushManager' in window,
      notificationPermission: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
      subscription: !!this.subscription,
    };
  }
}

window.crucixPWA = new PWAManager();

console.log('[PWA] Manager initialized');

export { PWAManager };
