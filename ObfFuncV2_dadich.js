/**
 * ============================================================================
 * TỆP: ObfFuncV2_dadich.js
 * TÊN GỐC: ObfFuncV2.js (Layma.net Bypass - CUTTAY PROMAX v1.1.1 / VNBYPASS)
 * TÁC GIẢ GỐC: DuckXKurumi
 * NGƯỜI DỊCH NGƯỢC & TỐI ƯU HÓA: VANTA
 * 
 * TỔNG QUAN KIẾN TRÚC:
 *   Tệp này gồm 2 thành phần chính:
 *   - PHẦN 1: LOADER (Mã nạp động ban đầu trong ObfFuncV2.js)
 *     Cầu nối GM_xmlhttpRequest giữa Tampermonkey và window/unsafeWindow, sau đó
 *     gửi yêu cầu fetch tới server từ xa để nạp payload phiên bản mới nhất.
 * 
 *   - PHẦN 2: VNBYPASS CORE ENGINE (Payload thực thi hoàn chỉnh sau khi giải mã)
 *     Toàn bộ logic xử lý nghiệp vụ tinh vi của CUTTAY PROMAX:
 *     1. Dọn dẹp DOM (DOM Cleaner): Ẩn toàn bộ quảng cáo, nút giả, video rác,
 *        chỉ để lại khung điều khiển trung tâm #vnbypass-wrapper.
 *     2. Phân tích nhiệm vụ tự động (Mission Analyzer): Tự trích xuất ảnh nhiệm vụ,
 *        từ khóa Google/Facebook, link mục tiêu.
 *     3. Tự động đổi nhiệm vụ hỏng (Auto-Change Blacklist): Nếu nhiệm vụ thuộc
 *        danh sách đen hoặc trang đích bị lỗi, tự động gọi API đổi nhiệm vụ mới.
 *     4. Quản lý phiên lưu lượng (Traffic Session):
 *        - POST /api/traffic/session để lấy SessionToken.
 *        - Quản lý header bảo mật X-Traffic-Session.
 *     5. Bộ giải QCaptcha Native (WebCrypto Engine):
 *        - Trao đổi khóa ECDH đường cong P-256.
 *        - Dẫn xuất khóa HKDF SHA-256 và mã hóa dữ liệu cảm biến bằng AES-GCM.
 *        - Tính toán thuật toán Proof-of-Work (PoW SHA-256 clz32).
 *        - Giao diện lưới ảnh trực quan (qcw-card, qcw-tile) cho phép chọn ô và nộp.
 *     6. Nộp mã code và định danh thiết bị (Fingerprint Submitter):
 *        - Thu thập thông tin pin (Battery API), hướng xoay (Orientation), màn hình.
 *        - Gửi yêu cầu POST /api/traffic/checkcode để nhận kết quả cuối cùng.
 * ============================================================================
 */

// ============================================================================
// PHẦN 1: BỘ NẠP DỮ LIỆU ĐỘNG (DYNAMIC LOADER)
// ============================================================================
(function initializeLoader() {
    'use strict';

    // Cung cấp API GM_xmlhttpRequest từ Tampermonkey vào môi trường trang web
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

    const REMOTE_SCRIPT_URL = 'https://duckxkrmproject.x10.mx/layma.js?t=' + Date.now();

    /**
     * Tải script từ xa (Trong trường hợp chạy trực tiếp từ Userscript)
     */
    function loadRemoteScript() {
        console.log('[VNBYPASS Loader] Đang tải bản cập nhật mới nhất từ máy chủ...');
        fetch(REMOTE_SCRIPT_URL)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                return res.text();
            })
            .then(scriptText => {
                console.log('[VNBYPASS Loader] Tải script thành công. Đang thực thi...');
                // Thực thi script được tải về
                (0, eval)(scriptText);
            })
            .catch(err => {
                console.error('[VNBYPASS Loader] Lỗi khi tải script từ xa:', err);
                console.log('[VNBYPASS Loader] Chuyển hướng sử dụng Core Engine nội bộ (Offline/Local Fallback)...');
                // Nếu không có mạng hoặc máy chủ từ xa sập, chạy engine nội bộ đã giải mã bên dưới
                runVnBypassCore(window, document);
            });
    }

    // Tự động khởi chạy engine nội bộ đã dịch ngược
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
        get waitTime() { return parseInt(localStorage.getItem(STORAGE_KEYS.WAIT_TIME), 10) || 60; },
        get manualLinks() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.MANUAL_LINKS) || '{}'); } catch (e) { return {}; }
        },
        get customBlacklist() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_BLACKLIST) || '[]'); } catch (e) { return []; }
        }
    };

    // ------------------------------------------------------------------------
    // 2. DỌN DẸP GIAO DIỆN TRANG WEB GỐC (DOM CLEANER)
    // ------------------------------------------------------------------------
    function injectCleanerStyles() {
        if (document.getElementById('vnbypass-clean-style')) return;

        const style = document.createElement('style');
        style.id = 'vnbypass-clean-style';
        style.textContent = `
            /* Ẩn triệt để tất cả các khối quảng cáo, video, hướng dẫn rác trên layma.net */
            .heading, .box-step-note, .box-step-link, .box-step-title, .box-copy, .box-google,
            .box-step-getCode, .box-video, #videohd, #xuong, .box-linkFB-wrap, .box-btn-copy,
            .box-google-note, #btn-xac-nhan, #btn-baoloi, .box-step-footer, .box-footer, footer,
            .intro, .progress, .warning, aside.warning, section.step, .step, .step-body, .verify-fields,
            .videos, .video-grid, .video-item, .responsive-video, .code-image, .search-mock,
            #copyMessage, .browser-link, .decoration {
                display: none !important;
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
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    // ------------------------------------------------------------------------
    // 3. TIỆN ÍCH BÓC TÁCH DỮ LIỆU TỪ TRANG HIỆN TẠI
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

    // ------------------------------------------------------------------------
    // 4. API GIAO TIẾP VỚI MÁY CHỦ LAYMA (NETWORK LAYER)
    // ------------------------------------------------------------------------
    /**
     * Gửi yêu cầu khởi tạo phiên làm việc (Traffic Session)
     */
    function requestTrafficSession(keyToken) {
        return new Promise((resolve, reject) => {
            const reqFunc = window.GM_xmlhttpRequest || (typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : null);
            if (!reqFunc) {
                console.warn('[LAYMA] Không tìm thấy GM_xmlhttpRequest, dùng fetch mặc định');
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

    /**
     * Tự động thực hiện đổi nhiệm vụ
     */
    async function executeChangeMission(sessionToken) {
        console.warn('[AUTO-CHANGE] Đang tự động đổi nhiệm vụ...');
        const tokenId = getTokenId();
        if (!tokenId) {
            console.error('[AUTO-CHANGE] Không tìm thấy Token ID trên trang hiện tại!');
            return;
        }

        window.removeEventListener('beforeunload', handleBeforeUnload);

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
                console.error('[AUTO-CHANGE] Lỗi đổi nhiệm vụ từ server:', text);
                alert('Lỗi đổi nhiệm vụ: ' + text);
            }
        } catch (e) {
            console.error('[AUTO-CHANGE] Không thể kết nối đến máy chủ đổi nhiệm vụ:', e);
            alert('Không thể kết nối đến máy chủ đổi nhiệm vụ!');
        }
    }

    function handleBeforeUnload(e) {
        e.preventDefault();
        const msg = 'Hệ thống đang chạy lấy mã, bạn có chắc muốn thoát?';
        e.returnValue = msg;
        return msg;
    }

    // ------------------------------------------------------------------------
    // 5. BỘ GIẢI VÀ XÁC MINH QCAPTCHA TỰ NHIÊN (QCAPTCHA NATIVE WEBCRYPTO ENGINE)
    // ------------------------------------------------------------------------
    /**
     * Bảng CSS phong cách hiện đại cho QCaptcha Widget
     */
    function injectQCaptchaStyles() {
        if (document.getElementById('qc-native-style')) return;

        const style = document.createElement('style');
        style.id = 'qc-native-style';
        style.textContent = `
            .qcw-card {
                background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
                box-shadow: 0 12px 40px rgba(2,6,23,.14), 0 2px 8px rgba(2,6,23,.06);
                width: 100%; max-width: 360px; margin: 0 auto; overflow: hidden;
                font-family: Inter, system-ui, -apple-system, sans-serif;
                animation: qcwIn .3s cubic-bezier(.21,1.02,.55,1) both;
            }
            @keyframes qcwIn { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
            @keyframes qcwSpin { to { transform: rotate(360deg); } }
            @keyframes qcwPop { from { transform: scale(.25); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes qcwDraw { to { stroke-dashoffset: 0; } }
            .qcw-header {
                display: flex; align-items: center; gap: 11px; padding: 13px 16px;
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #a855f7 100%);
            }
            .qcw-header-icon {
                width: 36px; height: 36px; flex: 0 0 auto; border-radius: 11px;
                background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.22);
                display: flex; align-items: center; justify-content: center;
            }
            .qcw-header-title { color: #fff; font-size: 14.5px; font-weight: 800; line-height: 1.25; }
            .qcw-header-sub { color: rgba(255,255,255,.78); font-size: 10.5px; font-weight: 700; text-transform: uppercase; margin-top: 2px; }
            .qcw-header-badge { margin-left: auto; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.25); color: #fff; font-size: 10px; font-weight: 700; border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
            .qcw-body { padding: 14px 16px 16px; }
            .qcw-question { background: #eef2ff; border-left: 3px solid #6366f1; color: #312e81; font-weight: 700; font-size: 14px; line-height: 1.4; padding: 10px 12px; border-radius: 10px; margin-bottom: 7px; }
            .qcw-hint { display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 12px; margin-bottom: 12px; }
            .qcw-grid { display: grid; grid-template-columns: repeat(var(--qc-cols, 3), 1fr); gap: 8px; margin-bottom: 11px; }
            .qcw-tile { position: relative; aspect-ratio: 1/1; padding: 0; border: 2px solid #e5e9f2; border-radius: 12px; background: #f8fafc; cursor: pointer; overflow: hidden; transition: all .15s ease; }
            .qcw-tile:hover { border-color: #a5b4fc; transform: translateY(-2px); box-shadow: 0 8px 16px rgba(79,70,229,.16); }
            .qcw-tile img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
            .qcw-tile .qcw-check { position: absolute; top: 6px; right: 6px; width: 23px; height: 23px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(79,70,229,.45); opacity: 0; transform: scale(.3); transition: all .16s ease; }
            .qcw-tile.is-selected { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(99,102,241,.22); transform: scale(.96); }
            .qcw-tile.is-selected .qcw-check { opacity: 1; transform: scale(1); }
            .qcw-meta { display: flex; align-items: center; margin-bottom: 11px; }
            .qcw-counter { font-size: 11.5px; font-weight: 700; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 999px; padding: 3px 11px; }
            .qcw-counter.is-active { color: #4f46e5; background: #eef2ff; border-color: #c7d2fe; }
            .qcw-actions { display: flex; gap: 8px; }
            .qcw-btn-primary { flex: 1; border: 0; border-radius: 11px; padding: 10px 14px; font-size: 14px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); cursor: pointer; box-shadow: 0 5px 14px rgba(79,70,229,.32); }
            .qcw-btn-ghost { border: 1px solid #e2e8f0; background: #fff; color: #475569; border-radius: 11px; padding: 10px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
            .qcw-status { margin-top: 10px; min-height: 17px; font-size: 12px; color: #64748b; text-align: center; }
            .qcw-status.is-error { color: #dc2626; font-weight: 600; }
            .qcw-status.is-info { color: #4f46e5; font-weight: 600; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    /**
     * Module mật mã học WebCrypto: ECDH P-256 + HKDF SHA-256 + AES-GCM
     */
    class QCryptoEngine {
        static async generateClientKeyPair() {
            if (!window.crypto || !window.crypto.subtle) {
                throw new Error('Trình duyệt không hỗ trợ WebCrypto!');
            }
            return await window.crypto.subtle.generateKey(
                { name: 'ECDH', namedCurve: 'P-256' },
                true,
                ['deriveBits']
            );
        }

        static async deriveEncryptionKey(privateKey, serverPublicKeyRaw) {
            const serverKey = await window.crypto.subtle.importKey(
                'raw',
                serverPublicKeyRaw,
                { name: 'ECDH', namedCurve: 'P-256' },
                false,
                []
            );

            const sharedBits = await window.crypto.subtle.deriveBits(
                { name: 'ECDH', public: serverKey },
                privateKey,
                256
            );

            // HKDF dẫn xuất khóa AES-GCM
            const hkdfKey = await window.crypto.subtle.importKey(
                'raw',
                sharedBits,
                { name: 'HKDF' },
                false,
                ['deriveKey']
            );

            return await window.crypto.subtle.deriveKey(
                {
                    name: 'HKDF',
                    hash: 'SHA-256',
                    salt: new TextEncoder().encode('qcaptcha/v1/signals'),
                    info: new Uint8Array(0)
                },
                hkdfKey,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt']
            );
        }

        static async encryptSignals(aesKey, plaintextData) {
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encodedData = new TextEncoder().encode(JSON.stringify(plaintextData));

            const encryptedBuffer = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                aesKey,
                encodedData
            );

            return {
                iv: Array.from(iv),
                ciphertext: Array.from(new Uint8Array(encryptedBuffer))
            };
        }

        /**
         * Giải thuật Proof-of-Work (PoW SHA-256) tìm nonce thỏa mãn số bit 0 đầu
         */
        static async solvePoW(challengeBase, targetBits) {
            const startTime = performance.now();
            let nonce = 0;
            const enc = new TextEncoder();

            while (true) {
                const data = enc.encode(challengeBase + ':' + nonce);
                const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
                const hashArr = new Uint8Array(hashBuf);

                // Đếm số bit 0 dẫn đầu
                let leadingZeros = 0;
                for (let i = 0; i < hashArr.length; i++) {
                    const byteVal = hashArr[i];
                    if (byteVal === 0) {
                        leadingZeros += 8;
                    } else {
                        leadingZeros += Math.clz32(byteVal) - 24;
                        break;
                    }
                }

                if (leadingZeros >= targetBits) {
                    return {
                        nonce: nonce,
                        elapsedMs: Math.round(performance.now() - startTime)
                    };
                }
                nonce++;
                if (nonce > 2000000) break; // Giới hạn an toàn
            }
            return { nonce: nonce, elapsedMs: Math.round(performance.now() - startTime) };
        }
    }

    /**
     * Lớp điều khiển hiển thị và xác minh QCaptcha
     */
    class QCaptchaController {
        constructor(mountContainer, siteKey, serverUrl) {
            this.container = mountContainer;
            this.siteKey = siteKey;
            this.serverUrl = serverUrl || 'https://frame.103-141-140-153.sslip.io';
            this.selectedIndices = new Set();
            this.sessionData = null;
        }

        async init() {
            injectQCaptchaStyles();
            this.renderLoading('Đang kết nối QCaptcha...', 'Hệ thống đang kiểm tra môi trường trình duyệt');

            try {
                // Tạo cặp khóa ECDH
                this.keyPair = await QCryptoEngine.generateClientKeyPair();
                const clientPubRaw = await window.crypto.subtle.exportKey('raw', this.keyPair.publicKey);

                // Khởi tạo phiên QCaptcha
                const initRes = await fetch(`${this.serverUrl}/v1/init`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sitekey: this.siteKey,
                        host: window.location.hostname,
                        pubkey: Array.from(new Uint8Array(clientPubRaw))
                    })
                });

                if (!initRes.ok) throw new Error('Không thể khởi tạo thử thách QCaptcha');
                const initData = await initRes.json();
                this.sessionData = initData;

                // Nếu có thử thách câu hỏi hình ảnh
                if (initData.challenge && initData.challenge.spec) {
                    this.renderChallenge(initData.challenge);
                } else if (initData.pass && initData.token) {
                    // Vượt qua thụ động không cần bấm
                    this.renderSuccess(initData.token);
                } else {
                    throw new Error('Dữ liệu thử thách không xác định');
                }
            } catch (err) {
                console.error('[LAYMA] QCaptcha init error:', err);
                this.renderError(err.message || 'Lỗi kết nối tới QCaptcha');
            }
        }

        renderLoading(title, sub) {
            this.container.innerHTML = `
                <div class='qcw-card'>
                    <div class='qcw-header'>
                        <div class='qcw-header-icon'>🛡️</div>
                        <div>
                            <div class='qcw-header-title'>Xác minh bảo mật</div>
                            <div class='qcw-header-sub'>QCaptcha</div>
                        </div>
                        <span class='qcw-header-badge'>An toàn</span>
                    </div>
                    <div class='qcw-body'>
                        <div class='qcw-loading'>
                            <div class='qcw-loading-ring'></div>
                            <div class='qcw-loading-text'>${title}</div>
                            <div class='qcw-loading-sub'>${sub}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        renderChallenge(challenge) {
            const spec = challenge.spec;
            const cols = spec.cols || 3;
            const isSingle = spec.single === true;

            let tilesHtml = '';
            spec.assets.forEach((imgUrl, idx) => {
                tilesHtml += `
                    <button type='button' class='qcw-tile' data-idx='${idx}'>
                        <img src='${imgUrl}' alt='Ô ${idx + 1}'>
                        <span class='qcw-check'>✓</span>
                    </button>
                `;
            });

            this.container.innerHTML = `
                <div class='qcw-card'>
                    <div class='qcw-header'>
                        <div class='qcw-header-icon'>🛡️</div>
                        <div>
                            <div class='qcw-header-title'>Xác minh bảo mật</div>
                            <div class='qcw-header-sub'>QCaptcha</div>
                        </div>
                        <span class='qcw-header-badge'>Hình ảnh</span>
                    </div>
                    <div class='qcw-body'>
                        <div class='qcw-question'>${spec.question || 'Vui lòng chọn các hình phù hợp'}</div>
                        <div class='qcw-hint'>
                            <span>${isSingle ? 'Chỉ chọn <b>1 ô duy nhất</b> phù hợp' : 'Chọn <b>tất cả</b> các ô phù hợp'}</span>
                        </div>
                        <div class='qcw-grid' style='--qc-cols:${cols}'>${tilesHtml}</div>
                        <div class='qcw-meta'>
                            <span class='qcw-counter' id='qcw-counter'>Đã chọn: <b>0</b></span>
                        </div>
                        <div class='qcw-actions'>
                            <button type='button' class='qcw-btn qcw-btn-primary' id='qcw-submit'>Xác nhận</button>
                            <button type='button' class='qcw-btn qcw-btn-ghost' id='qcw-skip'>Đổi câu</button>
                        </div>
                        <div class='qcw-status' id='qcw-status'></div>
                    </div>
                </div>
            `;

            this.bindEvents(isSingle);
        }

        bindEvents(isSingle) {
            const tiles = this.container.querySelectorAll('.qcw-tile');
            const counter = this.container.querySelector('#qcw-counter');
            const btnSubmit = this.container.querySelector('#qcw-submit');
            const btnSkip = this.container.querySelector('#qcw-skip');
            const statusBox = this.container.querySelector('#qcw-status');

            tiles.forEach(tile => {
                tile.onclick = () => {
                    const idx = parseInt(tile.getAttribute('data-idx'), 10);
                    if (isSingle) {
                        tiles.forEach(t => t.classList.remove('is-selected'));
                        this.selectedIndices.clear();
                        this.selectedIndices.add(idx);
                        tile.classList.add('is-selected');
                    } else {
                        if (this.selectedIndices.has(idx)) {
                            this.selectedIndices.delete(idx);
                            tile.classList.remove('is-selected');
                        } else {
                            this.selectedIndices.add(idx);
                            tile.classList.add('is-selected');
                        }
                    }
                    counter.innerHTML = `Đã chọn: <b>${this.selectedIndices.size}</b>`;
                    counter.classList.toggle('is-active', this.selectedIndices.size > 0);
                };
            });

            btnSkip.onclick = () => {
                statusBox.className = 'qcw-status is-info';
                statusBox.innerText = 'Đang đổi câu hỏi khác...';
                this.init();
            };

            btnSubmit.onclick = async () => {
                if (this.selectedIndices.size === 0) {
                    statusBox.className = 'qcw-status is-error';
                    statusBox.innerText = 'Vui lòng chọn ít nhất một ô!';
                    return;
                }

                btnSubmit.disabled = true;
                statusBox.className = 'qcw-status is-info';
                statusBox.innerHTML = "<span class='qcw-spinner'></span> <span>Đang kiểm tra đáp án...</span>";

                try {
                    // Tính PoW nếu server yêu cầu
                    let powNonce = 0;
                    let solveMs = 0;
                    if (this.sessionData.challenge && this.sessionData.challenge.pow) {
                        const powRes = await QCryptoEngine.solvePoW(
                            this.sessionData.challenge.pow.challenge,
                            this.sessionData.challenge.pow.bits || 12
                        );
                        powNonce = powRes.nonce;
                        solveMs = powRes.elapsedMs;
                    }

                    const res = await fetch(`${this.serverUrl}/v1/solve`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sid: this.sessionData.sid,
                            cid: this.sessionData.challenge.cid,
                            answer: Array.from(this.selectedIndices),
                            powNonce: powNonce,
                            solveMs: solveMs
                        })
                    });

                    const result = await res.json();
                    if (result && result.pass && result.token) {
                        this.renderSuccess(result.token);
                    } else {
                        statusBox.className = 'qcw-status is-error';
                        statusBox.innerText = result.message || 'Đáp án chưa chính xác! Đang nạp câu hỏi mới...';
                        setTimeout(() => this.init(), 1200);
                    }
                } catch (e) {
                    statusBox.className = 'qcw-status is-error';
                    statusBox.innerText = 'Lỗi xác thực: ' + e.message;
                    btnSubmit.disabled = false;
                }
            };
        }

        renderSuccess(token) {
            this.container.innerHTML = `
                <div class='qcw-card'>
                    <div class='qcw-body'>
                        <div class='qcw-success'>
                            <div class='qcw-success-ring'>
                                <svg class='qcw-success-check' width='26' height='26' viewBox='0 0 24 24'><polyline points='20 6 9 17 4 12'></polyline></svg>
                            </div>
                            <div class='qcw-success-text'>Xác thực thành công!</div>
                            <div class='qcw-success-sub'>Đang xử lý nộp mã, vui lòng đợi...</div>
                        </div>
                    </div>
                </div>
            `;
            if (typeof this.onSuccess === 'function') {
                this.onSuccess(token);
            }
        }

        renderError(msg) {
            this.container.innerHTML = `
                <div class='qcw-card'>
                    <div class='qcw-body'>
                        <div class='qcw-error'>
                            <div class='qcw-error-icon'>⚠️</div>
                            <div class='qcw-error-text'>Không kết nối được QCaptcha</div>
                            <div class='qcw-error-sub'>${msg}</div>
                            <button type='button' class='qcw-btn qcw-btn-primary' id='qcw-retry'>Thử lại</button>
                        </div>
                    </div>
                </div>
            `;
            const retry = this.container.querySelector('#qcw-retry');
            if (retry) retry.onclick = () => this.init();
        }
    }

    // ------------------------------------------------------------------------
    // 6. THU THẬP FINGERPRINT VÀ NỘP MÃ (CHECKCODE SUBMITTER)
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
    async function submitCodeVerification(token, campaignId, code, qCaptchaToken, sessionToken) {
        console.log('[LAYMA] Đang chuẩn bị nộp mã...');
        const fingerprintData = await collectDeviceFingerprint();

        const payload = {
            Code: code || 'layma_auto',
            Token: token,
            CampainId: campaignId,
            UserAgent: navigator.userAgent,
            DeviceScreen: `${window.screen.width} x ${window.screen.height}`,
            FingerprintData: fingerprintData,
            HCaptchaToken: '',
            QCaptchaToken: qCaptchaToken || '',
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
                const targetUrl = data.redirectUrl || data.RedirectUrl;
                if (targetUrl) {
                    window.location.href = targetUrl;
                } else {
                    alert('Nộp mã thành công!');
                }
            } else {
                alert('Nộp mã thất bại: ' + (data.message || JSON.stringify(data)));
            }
        } catch (err) {
            console.error('[LAYMA] Lỗi nộp mã:', err);
            alert('Lỗi nộp mã tới máy chủ!');
        }
    }

    // ------------------------------------------------------------------------
    // 7. KHỞI CHẠY TỔNG HỢP VÀ PHÂN TÍCH NHIỆM VỤ
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
                <div id="vnbypass-status" style="color:#0284c7; font-weight:600; text-align:center;">Đang phân tích nhiệm vụ...</div>
                <div id="vnbypass-captcha-container" style="margin-top:14px;"></div>
            </div>
        `;

        const guideElem = document.querySelector('main#guide') || document.querySelector('.box-step-wrap') || document.body;
        guideElem.prepend(wrapper);

        const statusElem = document.getElementById('vnbypass-status');
        const captchaContainer = document.getElementById('vnbypass-captcha-container');

        const trafficKey = getTrafficKey();
        const tokenId = getTokenId();
        const campaignId = getCampainId();

        console.log('[VNBYPASS] Thông tin trang:', { trafficKey, tokenId, campaignId });

        let sessionToken = null;
        if (trafficKey) {
            try {
                sessionToken = await requestTrafficSession(trafficKey);
                console.log('[VNBYPASS] Đã nhận Traffic Session Token:', sessionToken);
            } catch (e) {
                console.warn('[VNBYPASS] Không lấy được sessionToken:', e.message);
            }
        }

        // Kiểm tra xem trang có yêu cầu QCaptcha không
        const html = document.body ? document.body.innerHTML : '';
        const siteKeyMatch = html.match(/(?:qCaptchaSiteKey|qcaptchaSiteKey)\s*[:=]\s*['"]([^'"]+)['"]/);
        const scriptUrlMatch = html.match(/(?:qCaptchaScriptUrl|qcaptchaScriptUrl)\s*[:=]\s*['"]([^'"]+)['"]/);

        if (siteKeyMatch && siteKeyMatch[1]) {
            statusElem.innerText = 'Phát hiện QCaptcha. Đang nạp module giải mã...';
            const siteKey = siteKeyMatch[1];
            const scriptUrl = scriptUrlMatch ? scriptUrlMatch[1] : null;

            const qController = new QCaptchaController(captchaContainer, siteKey, scriptUrl);
            qController.onSuccess = (qToken) => {
                statusElem.innerText = 'Đã giải xong Captcha. Đang nộp mã...';
                submitCodeVerification(tokenId, campaignId, '', qToken, sessionToken);
            };
            qController.init();
        } else {
            statusElem.innerHTML = `
                <div style="color:#16a34a; font-weight:bold; margin-bottom:8px;">Nhiệm vụ sẵn sàng</div>
                <div style="display:flex; gap:8px; justify-content:center;">
                    <button id="btn-manual-submit" class="btn btn-primary">Nộp Mã Ngay</button>
                    <button id="btn-manual-change" class="btn btn-danger">Đổi Nhiệm Vụ</button>
                </div>
            `;
            document.getElementById('btn-manual-submit').onclick = () => {
                submitCodeVerification(tokenId, campaignId, '', '', sessionToken);
            };
            document.getElementById('btn-manual-change').onclick = () => {
                executeChangeMission(sessionToken);
            };
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
}
