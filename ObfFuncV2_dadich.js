/**
 * ============================================================================
 * TỆP: ObfFuncV2_dadich.js
 * TÊN GỐC: ObfFuncV2.js (Layma.net Bypass - CUTTAY PROMAX v1.1.1 / VNBYPASS)
 * TÁC GIẢ GỐC: DuckXKurumi
 * NGƯỜI DỊCH NGƯỢC & TỐI ƯU HÓA: VANTA
 * 
 * BẢN CẬP NHẬT:
 *   - Sửa triệt để lỗi "Không kết nối được QCaptcha" do gọi máy chủ proxy cũ bị chết.
 *   - Hiển thị trực tiếp widget Captcha (hCaptcha) ra giao diện chính để người dùng tự tay giải.
 *   - Không ẩn các phần tử Captcha gốc của trang (giữ .verify-fields, .h-captcha hiển thị rõ ràng).
 *   - Tự động nhận diện SiteKey chính xác (facd4b6c-53e6-44a2-9b27-b01844a6bd75).
 *   - Cơ chế lắng nghe tự động (Auto-detector): Khi người dùng giải xong Captcha, hệ thống
 *     tự động phát hiện token và nộp mã lên máy chủ ngay lập tức.
 * ============================================================================
 */

// ============================================================================
// PHẦN 1: BỘ NẠP DỮ LIỆU ĐỘNG (DYNAMIC LOADER)
// ============================================================================
(function initializeLoader() {
    'use strict';

    if (typeof GM_xmlhttpRequest !== 'undefined') {
        window.GM_xmlhttpRequest = GM_xmlhttpRequest;
        try {
            if (typeof unsafeWindow !== 'undefined') {
                unsafeWindow.GM_xmlhttpRequest = GM_xmlhttpRequest;
            }
        } catch (e) {
            console.warn('[VNBYPASS Loader] Không thể gắn GM_xmlhttpRequest vào unsafeWindow:', e);
        }
    }

    // Chạy Engine nội bộ đã được deobfuscate hoàn chỉnh
    runVnBypassCore(window, document);
})();


// ============================================================================
// PHẦN 2: BỘ XỬ LÝ LÕI VNBYPASS / CUTTAY PROMAX (DEOBFUSCATED CORE ENGINE)
// ============================================================================
function runVnBypassCore(window, document) {
    'use strict';

    console.log('[VNBYPASS] Đang khởi chạy hệ thống CUTTAY PROMAX Core v2...');

    // ------------------------------------------------------------------------
    // 1. CẤU HÌNH & QUẢN LÝ LOCAL STORAGE
    // ------------------------------------------------------------------------
    const CONFIG = {
        DEFAULT_SITEKEY: 'facd4b6c-53e6-44a2-9b27-b01844a6bd75',
        HCAPTCHA_SCRIPT_URL: 'https://js.hcaptcha.com/1/api.js?render=explicit',
        BACKUP_HCAPTCHA_TOKEN: 'Krprba8mMnrRnL0fCU24uJDqRtZ07ohQ'
    };

    const STORAGE_KEYS = {
        AUTO_CHANGE: 'vnbypass_auto_change',
        BLACKLIST_AUTO_CHANGE: 'vnbypass_blacklist_auto_change',
        AUTO_OPEN_LINK: 'vnbypass_auto_open_link',
        AUTO_SAVE_MANUAL_LINK: 'vnbypass_auto_save_manual_link',
        WAIT_TIME: 'vnbypass_wait_time',
        MANUAL_LINKS: 'vnbypass_manual_links',
        CUSTOM_BLACKLIST: 'vnbypass_custom_blacklist'
    };

    const Settings = {
        get autoChange() { return localStorage.getItem(STORAGE_KEYS.AUTO_CHANGE) !== 'false'; },
        get blacklistAutoChange() { return localStorage.getItem(STORAGE_KEYS.BLACKLIST_AUTO_CHANGE) !== 'false'; },
        get autoOpenLink() { return localStorage.getItem(STORAGE_KEYS.AUTO_OPEN_LINK) === 'true'; },
        get waitTime() { return parseInt(localStorage.getItem(STORAGE_KEYS.WAIT_TIME), 10) || 60; }
    };

    let globalState = {
        hCaptchaWidgetId: null,
        captchaWatcherInterval: null,
        isSubmitting: false,
        sessionToken: null
    };

    // ------------------------------------------------------------------------
    // 2. DỌN DẸP GIAO DIỆN TRANG WEB GỐC (DOM CLEANER)
    // ------------------------------------------------------------------------
    function injectCleanerStyles() {
        if (document.getElementById('vnbypass-clean-style')) return;

        const style = document.createElement('style');
        style.id = 'vnbypass-clean-style';
        style.textContent = `
            /* Ẩn các banner quảng cáo, video và nút giả rác */
            .heading, .box-step-note, .box-step-link, .box-step-title, .box-copy, .box-google,
            .box-video, #videohd, #xuong, .box-linkFB-wrap, .box-btn-copy,
            .box-google-note, #btn-xac-nhan, #btn-baoloi, .box-step-footer, .box-footer, footer,
            .intro, .progress, .warning, aside.warning,
            .videos, .video-grid, .video-item, .responsive-video, .code-image, .search-mock,
            #copyMessage, .browser-link, .decoration {
                display: none !important;
            }

            /* ĐẢM BẢO KHUNG CHỨA CAPTCHA VÀ FORM NHẬP MÃ CỦA TRANG KHÔNG BỊ ẨN */
            .verify-fields, .box-step-getCode, .h-captcha, [data-sitekey],
            #captcha-native-target, #captcha2-native-target, #hcaptcha-target {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }

            /* Khung điều khiển trung tâm VNBYPASS */
            #vnbypass-wrapper {
                display: flex !important;
                width: 100% !important;
                max-width: 660px !important;
                flex-direction: column !important;
                gap: 14px !important;
                margin: 0 auto 20px auto !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }

            main#guide {
                min-height: auto !important;
                margin: 18px auto !important;
                padding-bottom: 24px !important;
            }

            .btn {
                display: inline-flex; align-items: center; justify-content: center;
                padding: 10px 16px; font-size: 14px; font-weight: 700; border-radius: 8px;
                border: none; cursor: pointer; transition: all 0.2s ease; text-decoration: none; box-sizing: border-box;
            }
            .btn-primary { background: #2563eb; color: #fff; }
            .btn-primary:hover { background: #1d4ed8; }
            .btn-success { background: #16a34a; color: #fff; }
            .btn-success:hover { background: #15803d; }
            .btn-danger { background: #dc2626; color: #fff; }
            .btn-danger:hover { background: #b91c1c; }
            .btn-warning { background: #f59e0b; color: #fff; }
            .btn-warning:hover { background: #d97706; }

            /* Khung hiển thị Captcha rõ ràng */
            #vnbypass-captcha-container {
                min-height: 82px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: #f8fafc;
                border: 2px dashed #cbd5e1;
                border-radius: 12px;
                padding: 16px;
                margin-top: 14px;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // ------------------------------------------------------------------------
    // 3. TIỆN ÍCH BÓC TÁCH DỮ LIỆU TỪ TRANG
    // ------------------------------------------------------------------------
    function getTokenId() {
        const el = document.getElementById('tokenId');
        return el ? String(el.textContent).trim() : '';
    }

    function getCampainId() {
        const el = document.getElementById('campainId');
        return el ? String(el.textContent).trim() : '';
    }

    function getTrafficKey() {
        const urlMatch = window.location.href.match(/\/Traffic\/Index\/([A-Za-z0-9_-]+)/i);
        if (urlMatch && urlMatch[1]) return urlMatch[1];

        const html = document.body ? document.body.innerHTML : '';
        const patterns = [
            /(?:var\s+)?traffic_key\s*=\s*['"]([A-Za-z0-9_-]+)['"]/,
            /trafficKey['"\s:=]+['"]?([A-Za-z0-9_-]{6,})['"]?/,
            /data-traffic-key=['"]([^'"]+)['"]/,
            /keytoken=([A-Za-z0-9_-]{6,})/
        ];

        for (const pattern of patterns) {
            const m = html.match(pattern);
            if (m && m[1]) return m[1];
        }
        return '';
    }

    function detectSiteKey() {
        const html = document.body ? document.body.innerHTML : '';
        const patterns = [
            /hCaptchaSiteKey\s*=\s*['"]([^'"]+)['"]/i,
            /data-sitekey\s*=\s*['"]([^'"]+)['"]/i,
            /qCaptchaSiteKey\s*=\s*['"]([^'"]+)['"]/i,
            /(?:captcha|sitekey)\b[^"']*?['"]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})['"]/i
        ];

        for (const pattern of patterns) {
            const m = html.match(pattern);
            if (m && m[1]) return m[1];
        }

        const sitekeyElem = document.querySelector('[data-sitekey]');
        if (sitekeyElem) {
            const val = sitekeyElem.getAttribute('data-sitekey');
            if (val) return val;
        }

        return CONFIG.DEFAULT_SITEKEY;
    }

    // ------------------------------------------------------------------------
    // 4. API GIAO TIẾP VỚI MÁY CHỦ LAYMA (NETWORK LAYER)
    // ------------------------------------------------------------------------
    function requestTrafficSession(keyToken) {
        return new Promise((resolve, reject) => {
            const reqFunc = window.GM_xmlhttpRequest || (typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : null);
            if (!reqFunc) {
                fetch('/api/traffic/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ keyToken: keyToken })
                })
                .then(res => res.json())
                .then(data => resolve(data.sessionToken || data.SessionToken))
                .catch(reject);
                return;
            }

            reqFunc({
                method: 'POST',
                url: '/api/traffic/session',
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ keyToken: keyToken }),
                timeout: 10000,
                onload: (res) => {
                    if (res.status >= 200 && res.status < 300) {
                        try {
                            const json = JSON.parse(res.responseText);
                            const token = json.sessionToken || json.SessionToken;
                            if (token) {
                                sessionStorage.setItem('sessionToken', token);
                                resolve(token);
                            } else {
                                reject(new Error('Phản hồi không chứa sessionToken'));
                            }
                        } catch (e) {
                            reject(new Error('Lỗi giải mã JSON từ /api/traffic/session'));
                        }
                    } else {
                        reject(new Error(`POST /api/traffic/session thất bại (HTTP ${res.status})`));
                    }
                },
                onerror: () => reject(new Error('Lỗi kết nối /api/traffic/session')),
                ontimeout: () => reject(new Error('POST /api/traffic/session timeout'))
            });
        });
    }

    async function executeChangeMission(sessionToken) {
        console.warn('[AUTO-CHANGE] Đang tự động đổi nhiệm vụ...');
        const tokenId = getTokenId();
        if (!tokenId) {
            console.error('[AUTO-CHANGE] Không tìm thấy Token ID trên trang hiện tại!');
            return;
        }

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (sessionToken) headers['X-Traffic-Session'] = sessionToken;

            const res = await fetch('/api/traffic/mission/change', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ Token: tokenId })
            });

            if (res.ok) {
                console.log('[AUTO-CHANGE] Đổi nhiệm vụ thành công. Đang tải lại trang...');
                window.location.reload();
            } else {
                const text = await res.text();
                alert('Lỗi đổi nhiệm vụ: ' + text);
            }
        } catch (e) {
            alert('Không thể kết nối đến máy chủ đổi nhiệm vụ!');
        }
    }

    // ------------------------------------------------------------------------
    // 5. THU THẬP FINGERPRINT VÀ NỘP MÃ (CHECKCODE SUBMITTER)
    // ------------------------------------------------------------------------
    async function collectDeviceFingerprint() {
        let battery = null;
        try {
            if (navigator.getBattery) {
                const b = await Promise.race([
                    navigator.getBattery(),
                    new Promise(r => setTimeout(() => r(null), 1200))
                ]);
                if (b) {
                    battery = {
                        level: typeof b.level === 'number' ? Math.round(b.level * 100) : null,
                        charging: typeof b.charging === 'boolean' ? b.charging : null,
                        chargingTime: Number.isFinite(b.chargingTime) ? b.chargingTime : null,
                        dischargingTime: Number.isFinite(b.dischargingTime) ? b.dischargingTime : null
                    };
                }
            }
        } catch (e) {}

        const orientation = ('DeviceOrientationEvent' in window)
            ? { supported: true, granted: true, available: false }
            : { supported: false };

        return JSON.stringify({
            version: 'v1',
            language: navigator.language || 'vi-VN',
            platform: navigator.platform || 'Linux aarch64',
            browser: 'Chrome',
            browserVersion: '151.0.0.0',
            screen: `${window.screen.width || 1920} x ${window.screen.height || 1080}`,
            colorDepth: (window.screen && window.screen.colorDepth) || 24,
            pixelRatio: window.devicePixelRatio || 1,
            battery: battery,
            orientation: orientation,
            createdAt: new Date().toISOString()
        });
    }

    /**
     * Nộp mã và token xác thực đến backend
     */
    async function submitCodeVerification(token, campaignId, code, captchaToken, sessionToken) {
        if (globalState.isSubmitting) return;
        globalState.isSubmitting = true;

        const statusElem = document.getElementById('vnbypass-status');
        if (statusElem) {
            statusElem.style.color = '#0284c7';
            statusElem.innerHTML = '🚀 Đang nộp mã xác thực lên máy chủ...';
        }

        const fingerprintData = await collectDeviceFingerprint();

        const payload = {
            Code: code || 'layma_auto',
            Token: token,
            CampainId: campaignId,
            UserAgent: navigator.userAgent,
            DeviceScreen: `${window.screen.width} x ${window.screen.height}`,
            FingerprintData: fingerprintData,
            HCaptchaToken: captchaToken || '',
            QCaptchaToken: captchaToken || '',
            CaptchaLaToken: ''
        };

        const headers = { 'Content-Type': 'application/json' };
        if (sessionToken) headers['X-Traffic-Session'] = sessionToken;

        try {
            const res = await fetch('/api/traffic/checkcode', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            console.log('[LAYMA] Kết quả /api/traffic/checkcode:', data);

            if (data && (data.success || data.redirectUrl || data.RedirectUrl)) {
                if (statusElem) {
                    statusElem.style.color = '#059669';
                    statusElem.innerHTML = '🎉 <b>XÁC NHẬN THÀNH CÔNG!</b> Đang chuyển tiếp...';
                }
                const targetUrl = data.redirectUrl || data.RedirectUrl;
                if (targetUrl) {
                    setTimeout(() => { window.location.href = targetUrl; }, 800);
                } else {
                    alert('Nộp mã thành công!');
                }
            } else {
                globalState.isSubmitting = false;
                if (statusElem) {
                    statusElem.style.color = '#dc2626';
                    statusElem.innerHTML = '⚠️ Nộp mã thất bại: ' + (data.message || 'Lỗi không xác định');
                }
                alert('Nộp mã thất bại: ' + (data.message || JSON.stringify(data)));
            }
        } catch (err) {
            globalState.isSubmitting = false;
            console.error('[LAYMA] Lỗi nộp mã:', err);
            if (statusElem) {
                statusElem.style.color = '#dc2626';
                statusElem.innerText = 'Lỗi nộp mã tới máy chủ!';
            }
            alert('Lỗi nộp mã tới máy chủ!');
        }
    }

    // ------------------------------------------------------------------------
    // 6. MODULE HIỂN THỊ CAPTCHA TRỰC TIẾP CHO NGƯỜI DÙNG GIẢI
    // ------------------------------------------------------------------------
    function mountCaptchaWidget(container, onSolved) {
        container.innerHTML = `
            <div style="font-weight:700; font-size:14px; color:#1e293b; margin-bottom:4px;">
                🛡️ XÁC MINH BẢO MẬT
            </div>
            <div style="font-size:12px; color:#64748b; margin-bottom:12px;">
                Vui lòng bấm vào ô bên dưới để hoàn tất giải Captcha:
            </div>
            <div id="active-captcha-box" style="min-height:78px; display:flex; justify-content:center; align-items:center;">
                <span style="font-size:13px; color:#64748b;">Đang tải hộp Captcha...</span>
            </div>
            <div style="display:flex; gap:10px; width:100%; margin-top:14px; justify-content:center;">
                <button type="button" id="btn-manual-captcha-done" class="btn btn-success" style="flex:2;">
                    Tôi Đã Giải Xong - Nộp Mã Ngay
                </button>
                <button type="button" id="btn-captcha-reload" class="btn btn-warning" style="flex:1;">
                    Tải Lại
                </button>
            </div>
        `;

        const statusElem = document.getElementById('vnbypass-status');
        const siteKey = detectSiteKey();
        console.log('[VNBYPASS] Render widget Captcha với siteKey:', siteKey);

        function getSolvedToken() {
            const win = window.unsafeWindow || window;
            if (win.hcaptcha && globalState.hCaptchaWidgetId !== null) {
                try {
                    const resp = win.hcaptcha.getResponse(globalState.hCaptchaWidgetId);
                    if (resp && resp.length > 20) return resp;
                } catch (e) {}
            }

            const textareas = document.querySelectorAll('textarea[name="h-captcha-response"], textarea[name="g-recaptcha-response"], textarea[name="q-captcha-response"], input[name="q-captcha-response"]');
            for (const ta of textareas) {
                if (ta.value && ta.value.trim().length > 20) {
                    return ta.value.trim();
                }
            }
            return null;
        }

        const handleSuccess = (token) => {
            if (globalState.isSubmitting) return;
            if (globalState.captchaWatcherInterval) clearInterval(globalState.captchaWatcherInterval);

            if (statusElem) {
                statusElem.style.color = '#059669';
                statusElem.innerHTML = '🎉 <b>Đã giải xong Captcha!</b> Đang tự động nộp mã...';
            }
            onSolved(token);
        };

        // Lắng nghe tự động theo chu kỳ 400ms
        globalState.captchaWatcherInterval = setInterval(() => {
            const token = getSolvedToken();
            if (token && !globalState.isSubmitting) {
                handleSuccess(token);
            }
        }, 400);

        // Nút bấm nộp thủ công
        document.getElementById('btn-manual-captcha-done').onclick = () => {
            const token = getSolvedToken();
            if (token) {
                handleSuccess(token);
            } else {
                alert('Vui lòng giải xong Captcha trước khi bấm nút này!');
            }
        };

        // Render hCaptcha widget
        const renderHcaptcha = () => {
            const win = window.unsafeWindow || window;
            const target = document.getElementById('active-captcha-box');
            if (!target) return;

            try {
                if (win.hcaptcha && typeof win.hcaptcha.render === 'function') {
                    target.innerHTML = '';
                    globalState.hCaptchaWidgetId = win.hcaptcha.render('active-captcha-box', {
                        sitekey: siteKey,
                        theme: 'light',
                        size: 'normal',
                        callback: (token) => handleSuccess(token),
                        'expired-callback': () => {
                            if (statusElem) statusElem.innerText = 'Captcha đã hết hạn, vui lòng giải lại!';
                        },
                        'error-callback': (err) => {
                            console.error('[VNBYPASS] hCaptcha error callback:', err);
                            target.innerHTML = '<span style="color:#dc2626;font-size:12px;">Lỗi tải Captcha! Vui lòng bấm nút Tải Lại.</span>';
                        }
                    });
                }
            } catch (err) {
                console.error('[VNBYPASS] Lỗi render widget Captcha:', err);
                target.innerHTML = `
                    <div style="color:#dc2626;font-size:12px;">
                        Không thể chèn widget tự động.<br>
                        Vui lòng bấm nút Tải Lại bên dưới.
                    </div>
                `;
            }
        };

        document.getElementById('btn-captcha-reload').onclick = () => {
            const win = window.unsafeWindow || window;
            if (win.hcaptcha && globalState.hCaptchaWidgetId !== null) {
                try { win.hcaptcha.reset(globalState.hCaptchaWidgetId); } catch (e) { renderHcaptcha(); }
            } else {
                renderHcaptcha();
            }
        };

        // Nhúng script hCaptcha nếu chưa có
        const win = window.unsafeWindow || window;
        if (win.hcaptcha && typeof win.hcaptcha.render === 'function') {
            renderHcaptcha();
        } else {
            const script = document.createElement('script');
            script.src = CONFIG.HCAPTCHA_SCRIPT_URL;
            script.async = true;
            script.defer = true;
            script.onload = () => setTimeout(renderHcaptcha, 400);
            document.head.appendChild(script);
        }
    }

    // ------------------------------------------------------------------------
    // 7. KHỞI CHẠY TỔNG HỢP VÀ ĐIỀU KHIỂN
    // ------------------------------------------------------------------------
    async function main() {
        injectCleanerStyles();

        // Tạo khung điều khiển VNBYPASS chèn vào đầu trang
        const wrapper = document.createElement('div');
        wrapper.id = 'vnbypass-wrapper';
        wrapper.innerHTML = `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; box-shadow:0 4px 12px rgba(0,0,0,0.05); text-align:center;">
                <div style="font-weight:800; font-size:16px; color:#1e293b; margin-bottom:4px;">🚀 LAYMA BYPASS - CUTTAY PROMAX</div>
                <div style="font-size:12px; color:#64748b; margin-bottom:12px;">Hệ thống tự động phân tích và vượt nhiệm vụ thông minh</div>
                <div id="vnbypass-status" style="color:#0284c7; font-weight:600; text-align:center;">Đang chuẩn bị xác thực Captcha...</div>
                <div id="vnbypass-captcha-container"></div>
            </div>
        `;

        const guideElem = document.querySelector('main#guide') || document.querySelector('.box-step-wrap') || document.body;
        guideElem.prepend(wrapper);

        const statusElem = document.getElementById('vnbypass-status');
        const captchaContainer = document.getElementById('vnbypass-captcha-container');

        const trafficKey = getTrafficKey();
        const tokenId = getTokenId();
        const campaignId = getCampainId();

        console.log('[VNBYPASS] Thông tin nhiệm vụ:', { trafficKey, tokenId, campaignId });

        if (trafficKey) {
            try {
                globalState.sessionToken = await requestTrafficSession(trafficKey);
                console.log('[VNBYPASS] Đã nhận Traffic Session Token:', globalState.sessionToken);
            } catch (e) {
                console.warn('[VNBYPASS] Không lấy được sessionToken:', e.message);
            }
        }

        statusElem.innerHTML = '👉 <b>Vui lòng giải Captcha bên dưới để tiếp tục:</b>';

        // Hiển thị trực tiếp widget Captcha lên màn hình
        mountCaptchaWidget(captchaContainer, (solvedToken) => {
            submitCodeVerification(tokenId, campaignId, '', solvedToken, globalState.sessionToken);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
}
