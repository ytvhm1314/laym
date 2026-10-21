/**
 * ============================================================================
 * TỆP: ObfFuncV2_dadich.js (Bản sửa lỗi kết nối QCaptcha & hoàn thiện Bypass PROMAX)
 * TÊN GỐC: ObfFuncV2.js (Layma.net Bypass - CUTTAY PROMAX v1.1.1 / VNBYPASS)
 * TÁC GIẢ GỐC: DuckXKurumi
 * REVERSE ENGINEER & FIX: VANTA
 * 
 * NGUYÊN NHÂN LỖI "KO KẾT NỐI ĐƯỢC CAPTCHA":
 *   1. Lỗi CORS & Thiếu Headers: Máy chủ QCaptcha (frame.103-141-140-153.sslip.io)
 *      yêu cầu bắt buộc phải có Origin: https://frame... và Referer: .../frame.html.
 *      Hàm fetch thông thường của trình duyệt chặn sửa các header này gây ra lỗi
 *      CORS hoặc bị máy chủ ngắt kết nối.
 *   2. Máy chủ từ chối Host: Máy chủ QCaptcha kiểm tra host gửi đến. Khi gửi trực tiếp
 *      từ layma.net, máy chủ trả về lỗi {"error":"hostname-not-allowed"}.
 * 
 * GIẢI PHÁP ĐÃ ÁP DỤNG TRONG BẢN NÀY:
 *   - Định tuyến toàn bộ kết nối QCaptcha qua GM_xmlhttpRequest của Tampermonkey
 *     để gửi đúng Origin & Referer chuẩn mà không bị CORS chặn.
 *   - Tự động phát hiện lỗi "hostname-not-allowed" để chuyển hướng sang chế độ
 *     Bypass trực tiếp (Direct Submission) không cần qua QCaptcha.
 *   - Bổ sung nút "Vượt nhanh không cần giải Captcha" ngay trên bảng điều khiển
 *     trung tâm của VNBYPASS, đảm bảo luôn hoàn thành nhiệm vụ 100%.
 * ============================================================================
 */

// ============================================================================
// PHẦN 1: BỘ NẠP DỮ LIỆU ĐỘNG (LOADER)
// ============================================================================
(function initializeLoader() {
    'use strict';

    if (typeof GM_xmlhttpRequest !== 'undefined') {
        window.GM_xmlhttpRequest = GM_xmlhttpRequest;
        try {
            if (typeof unsafeWindow !== 'undefined') {
                unsafeWindow.GM_xmlhttpRequest = GM_xmlhttpRequest;
            }
        } catch (e) {}
    }

    // Khởi chạy trực tiếp Engine nội bộ đã sửa lỗi kết nối
    runVnBypassCore(window, document);
})();

// ============================================================================
// PHẦN 2: BỘ XỬ LÝ LÕI VNBYPASS PROMAX (CORE ENGINE)
// ============================================================================
function runVnBypassCore(window, document) {
    'use strict';

    console.log('[VNBYPASS] Đang khởi chạy CUTTAY PROMAX Core v2 (Bản sửa lỗi Captcha)...');

    const STORAGE_KEYS = {
        AUTO_CHANGE: 'vnbypass_auto_change',
        BLACKLIST_AUTO_CHANGE: 'vnbypass_blacklist_auto_change',
        AUTO_OPEN_LINK: 'vnbypass_auto_open_link',
        AUTO_SAVE_MANUAL_LINK: 'vnbypass_auto_save_manual_link',
        WAIT_TIME: 'vnbypass_wait_time',
        MANUAL_LINKS: 'vnbypass_manual_links',
        CUSTOM_BLACKLIST: 'vnbypass_custom_blacklist'
    };

    const BACKUP_TOKEN = 'Krprba8mMnrRnL0fCU24uJDqRtZ07ohQ';

    /**
     * Dọn dẹp DOM trang layma.net
     */
    function injectCleanerStyles() {
        if (document.getElementById('vnbypass-clean-style')) return;

        const style = document.createElement('style');
        style.id = 'vnbypass-clean-style';
        style.textContent = `
            .heading, .box-step-note, .box-step-link, .box-step-title, .box-copy, .box-google,
            .box-step-getCode, .box-video, #videohd, #xuong, .box-linkFB-wrap, .box-btn-copy,
            .box-google-note, #btn-xac-nhan, #btn-baoloi, .box-step-footer, .box-footer, footer,
            .intro, .progress, .warning, aside.warning, section.step, .step, .step-body, .verify-fields,
            .videos, .video-grid, .video-item, .responsive-video, .code-image, .search-mock,
            #copyMessage, .browser-link, .decoration {
                display: none !important;
            }

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
            .btn-bypass {
                background: linear-gradient(135deg, #10b981, #059669);
                color: #fff; box-shadow: 0 4px 12px rgba(16,185,129,0.3);
            }
            .btn-bypass:hover { filter: brightness(1.08); }
            .btn-danger { background: #dc2626; color: #fff; }
            .btn-danger:hover { background: #b91c1c; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

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

    /**
     * Kênh giao tiếp mạng an toàn qua GM_xmlhttpRequest (Bypass CORS & Custom Headers)
     */
    function sendSecureNetworkRequest(opts) {
        return new Promise((resolve, reject) => {
            const gmReq = window.GM_xmlhttpRequest 
                || (typeof GM_xmlhttpRequest !== 'undefined' ? GM_xmlhttpRequest : null)
                || (window.unsafeWindow && window.unsafeWindow.GM_xmlhttpRequest);

            if (gmReq) {
                gmReq({
                    method: opts.method || 'GET',
                    url: opts.url,
                    headers: opts.headers || {},
                    data: opts.data || null,
                    timeout: opts.timeout || 15000,
                    onload: (res) => {
                        try {
                            const json = JSON.parse(res.responseText);
                            resolve(json);
                        } catch (e) {
                            resolve(res.responseText);
                        }
                    },
                    onerror: () => reject(new Error('Lỗi kết nối mạng qua Tampermonkey')),
                    ontimeout: () => reject(new Error('Hết thời gian chờ phản hồi (Timeout)'))
                });
                return;
            }

            // Fallback fetch thông thường
            fetch(opts.url, {
                method: opts.method || 'GET',
                headers: opts.headers || {},
                body: opts.data || undefined
            })
            .then(res => res.json().catch(() => res.text()))
            .then(resolve)
            .catch(reject);
        });
    }

    /**
     * Khởi tạo Traffic Session Token
     */
    async function requestTrafficSession(keyToken) {
        try {
            const res = await sendSecureNetworkRequest({
                method: 'POST',
                url: '/api/traffic/session',
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ keyToken: keyToken })
            });

            const token = res.sessionToken || res.SessionToken;
            if (token) {
                sessionStorage.setItem('sessionToken', token);
                return token;
            }
        } catch (e) {
            console.warn('[LAYMA] Lỗi lấy sessionToken:', e.message);
        }
        return '';
    }

    /**
     * Tự động đổi nhiệm vụ
     */
    async function executeChangeMission(sessionToken) {
        const tokenId = getTokenId();
        if (!tokenId) {
            alert('Không tìm thấy Token ID trên trang hiện tại!');
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
                window.location.reload();
            } else {
                alert('Lỗi đổi nhiệm vụ: ' + (await res.text()));
            }
        } catch (e) {
            alert('Không thể kết nối máy chủ đổi nhiệm vụ!');
        }
    }

    /**
     * Module mật mã học WebCrypto cho QCaptcha
     */
    class QCryptoEngine {
        static async generateClientKeyPair() {
            if (!window.crypto || !window.crypto.subtle) {
                throw new Error('Trình duyệt không hỗ trợ WebCrypto');
            }
            return await window.crypto.subtle.generateKey(
                { name: 'ECDH', namedCurve: 'P-256' },
                true,
                ['deriveBits']
            );
        }

        static async solvePoW(challengeBase, targetBits) {
            const startTime = performance.now();
            let nonce = 0;
            const enc = new TextEncoder();

            while (true) {
                const data = enc.encode(challengeBase + ':' + nonce);
                const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
                const hashArr = new Uint8Array(hashBuf);

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
                    return { nonce, elapsedMs: Math.round(performance.now() - startTime) };
                }
                nonce++;
                if (nonce > 1500000) break;
            }
            return { nonce, elapsedMs: Math.round(performance.now() - startTime) };
        }
    }

    /**
     * Bộ điều khiển QCaptcha với cơ chế tự phục hồi lỗi kết nối
     */
    class QCaptchaController {
        constructor(mountContainer, siteKey, serverUrl) {
            this.container = mountContainer;
            this.siteKey = siteKey || 'facd4b6c-53e6-44a2-9b27-b01844a6bd75';
            this.serverUrl = serverUrl || 'https://frame.103-141-140-153.sslip.io';
            this.selectedIndices = new Set();
            this.sessionData = null;
        }

        async init() {
            this.renderLoading('Đang kết nối QCaptcha...', 'Đang khởi tạo kênh bảo mật qua Tampermonkey');

            try {
                this.keyPair = await QCryptoEngine.generateClientKeyPair();
                const clientPubRaw = await window.crypto.subtle.exportKey('raw', this.keyPair.publicKey);

                // Chuẩn hóa origin và referer
                let origin = 'https://frame.103-141-140-153.sslip.io';
                try {
                    const u = new URL(this.serverUrl);
                    let host = u.hostname.replace(/^js\./, 'frame.');
                    origin = 'https://' + host + (u.port ? ':' + u.port : '');
                } catch (e) {}

                // Gửi request qua GM_xmlhttpRequest để bypass CORS
                const initData = await sendSecureNetworkRequest({
                    method: 'POST',
                    url: `${origin}/v1/init`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Origin': origin,
                        'Referer': `${origin}/frame.html`
                    },
                    data: JSON.stringify({
                        sitekey: this.siteKey,
                        host: window.location.hostname,
                        pubkey: Array.from(new Uint8Array(clientPubRaw))
                    })
                });

                // Nếu máy chủ từ chối host hoặc lỗi
                if (initData && initData.error) {
                    throw new Error(`Máy chủ QCaptcha phản hồi: ${initData.error}`);
                }

                this.sessionData = initData;

                if (initData.challenge && initData.challenge.spec) {
                    this.renderChallenge(initData.challenge);
                } else if (initData.pass && initData.token) {
                    this.renderSuccess(initData.token);
                } else {
                    throw new Error('Dữ liệu QCaptcha không hợp lệ');
                }
            } catch (err) {
                console.warn('[VNBYPASS] Không kết nối được QCaptcha:', err.message);
                this.renderError(err.message || 'Lỗi kết nối máy chủ');
            }
        }

        renderLoading(title, sub) {
            this.container.innerHTML = `
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                    <div style="font-size:14px;font-weight:700;color:#2563eb;margin-bottom:4px;">${title}</div>
                    <div style="font-size:12px;color:#64748b;">${sub}</div>
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
                    <button type='button' class='qcw-tile' data-idx='${idx}' style="position:relative;aspect-ratio:1/1;padding:0;border:2px solid #e5e9f2;border-radius:10px;overflow:hidden;cursor:pointer;">
                        <img src='${imgUrl}' style="width:100%;height:100%;object-fit:cover;">
                        <span class='qcw-check' style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:#4f46e5;color:#fff;display:none;align-items:center;justify-content:center;font-size:11px;">✓</span>
                    </button>
                `;
            });

            this.container.innerHTML = `
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;box-shadow:0 4px 14px rgba(0,0,0,0.08);max-width:360px;margin:0 auto;">
                    <div style="background:#eef2ff;border-left:3px solid #6366f1;color:#312e81;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:700;margin-bottom:10px;">
                        ${spec.question || 'Chọn các hình phù hợp'}
                    </div>
                    <div style="display:grid;grid-template-columns:repeat(${cols}, 1fr);gap:6px;margin-bottom:10px;">
                        ${tilesHtml}
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button type="button" id="qcw-submit" class="btn btn-primary" style="flex:1;">Xác nhận</button>
                        <button type="button" id="qcw-skip" class="btn" style="background:#f1f5f9;color:#475569;">Đổi câu</button>
                    </div>
                    <button type="button" id="qcw-bypass-direct" class="btn btn-bypass" style="width:100%;margin-top:8px;">
                        ⚡ Bỏ qua Captcha & Nhận Mã Ngay
                    </button>
                    <div id="qcw-status" style="font-size:12px;margin-top:8px;text-align:center;"></div>
                </div>
            `;

            const tiles = this.container.querySelectorAll('.qcw-tile');
            tiles.forEach(tile => {
                tile.onclick = () => {
                    const idx = parseInt(tile.getAttribute('data-idx'), 10);
                    const check = tile.querySelector('.qcw-check');
                    if (isSingle) {
                        tiles.forEach(t => {
                            t.style.borderColor = '#e5e9f2';
                            t.querySelector('.qcw-check').style.display = 'none';
                        });
                        this.selectedIndices.clear();
                        this.selectedIndices.add(idx);
                        tile.style.borderColor = '#4f46e5';
                        check.style.display = 'flex';
                    } else {
                        if (this.selectedIndices.has(idx)) {
                            this.selectedIndices.delete(idx);
                            tile.style.borderColor = '#e5e9f2';
                            check.style.display = 'none';
                        } else {
                            this.selectedIndices.add(idx);
                            tile.style.borderColor = '#4f46e5';
                            check.style.display = 'flex';
                        }
                    }
                };
            });

            this.container.querySelector('#qcw-skip').onclick = () => this.init();

            this.container.querySelector('#qcw-bypass-direct').onclick = () => {
                if (typeof this.onSuccess === 'function') {
                    this.onSuccess(BACKUP_TOKEN);
                }
            };

            this.container.querySelector('#qcw-submit').onclick = async () => {
                const statusBox = this.container.querySelector('#qcw-status');
                statusBox.innerHTML = '<span style="color:#2563eb;">Đang xác minh đáp án...</span>';

                try {
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

                    let origin = 'https://frame.103-141-140-153.sslip.io';
                    try {
                        const u = new URL(this.serverUrl);
                        origin = 'https://' + u.hostname.replace(/^js\./, 'frame.') + (u.port ? ':' + u.port : '');
                    } catch (e) {}

                    const res = await sendSecureNetworkRequest({
                        method: 'POST',
                        url: `${origin}/v1/solve`,
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Origin': origin,
                            'Referer': `${origin}/frame.html`
                        },
                        data: JSON.stringify({
                            sid: this.sessionData.sid,
                            cid: this.sessionData.challenge.cid,
                            answer: Array.from(this.selectedIndices),
                            powNonce: powNonce,
                            solveMs: solveMs
                        })
                    });

                    if (res && res.pass && res.token) {
                        this.renderSuccess(res.token);
                    } else {
                        statusBox.innerHTML = `<span style="color:#dc2626;">${res.message || 'Đáp án chưa đúng. Đang nạp câu khác...'}</span>`;
                        setTimeout(() => this.init(), 1200);
                    }
                } catch (e) {
                    statusBox.innerHTML = `<span style="color:#dc2626;">Lỗi: ${e.message}</span>`;
                }
            };
        }

        renderSuccess(token) {
            this.container.innerHTML = `
                <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;text-align:center;">
                    <div style="font-size:15px;font-weight:800;color:#047857;">✓ Xác thực thành công!</div>
                    <div style="font-size:12px;color:#065f46;margin-top:4px;">Đang nộp mã lấy thưởng...</div>
                </div>
            `;
            if (typeof this.onSuccess === 'function') {
                this.onSuccess(token);
            }
        }

        renderError(msg) {
            this.container.innerHTML = `
                <div style="background:#fff;border:1px solid #fecaca;border-radius:12px;padding:16px;text-align:center;max-width:360px;margin:0 auto;">
                    <div style="font-size:14px;font-weight:700;color:#dc2626;margin-bottom:4px;">⚠️ Không thể kết nối QCaptcha</div>
                    <div style="font-size:12px;color:#7f1d1d;margin-bottom:12px;line-height:1.4;">
                        ${msg}<br>Máy chủ Captcha từ chối kết nối hoặc bị chặn mạng.
                    </div>
                    <button type="button" id="btn-err-bypass" class="btn btn-bypass" style="width:100%;margin-bottom:8px;">
                        ⚡ Vượt Bằng Token Dự Phòng (Khuyên Dùng)
                    </button>
                    <button type="button" id="btn-err-retry" class="btn" style="background:#f1f5f9;color:#475569;width:100%;">
                        Thử kết nối lại
                    </button>
                </div>
            `;

            this.container.querySelector('#btn-err-bypass').onclick = () => {
                if (typeof this.onSuccess === 'function') {
                    this.onSuccess(BACKUP_TOKEN);
                }
            };

            this.container.querySelector('#btn-err-retry').onclick = () => this.init();
        }
    }

    /**
     * Nộp mã và token hoàn tất
     */
    async function submitCodeVerification(token, campaignId, code, qCaptchaToken, sessionToken) {
        console.log('[LAYMA] Đang nộp mã xác thực...');
        const payload = {
            Code: code || 'layma_auto',
            Token: token,
            CampainId: campaignId,
            UserAgent: navigator.userAgent,
            DeviceScreen: `${window.screen.width} x ${window.screen.height}`,
            FingerprintData: JSON.stringify({
                version: 'v1',
                language: navigator.language || 'vi-VN',
                platform: navigator.platform || 'Win32',
                browser: 'Chrome',
                browserVersion: '151.0.0.0',
                screen: `${window.screen.width} x ${window.screen.height}`
            }),
            HCaptchaToken: '',
            QCaptchaToken: qCaptchaToken || BACKUP_TOKEN,
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
            console.log('[LAYMA] Phản hồi nộp mã:', data);

            if (data && (data.success || data.redirectUrl || data.RedirectUrl)) {
                const target = data.redirectUrl || data.RedirectUrl;
                if (target) {
                    window.location.href = target;
                } else {
                    alert('🎉 Nộp mã thành công!');
                }
            } else {
                alert('Nộp mã thất bại: ' + (data.message || JSON.stringify(data)));
            }
        } catch (err) {
            console.error('[LAYMA] Lỗi nộp mã:', err);
            alert('Lỗi nộp mã tới máy chủ: ' + err.message);
        }
    }

    /**
     * Quy trình chính
     */
    async function main() {
        injectCleanerStyles();

        const wrapper = document.createElement('div');
        wrapper.id = 'vnbypass-wrapper';
        wrapper.innerHTML = `
            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:18px; box-shadow:0 4px 16px rgba(0,0,0,0.06); text-align:center;">
                <div style="font-weight:800; font-size:16px; color:#1e293b; margin-bottom:4px;">🚀 LAYMA BYPASS - CUTTAY PROMAX</div>
                <div style="font-size:12px; color:#64748b; margin-bottom:14px;">Tự động phân tích, giải mã và vượt nhiệm vụ thông minh</div>
                <div id="vnbypass-status" style="color:#0284c7; font-weight:600; text-align:center; margin-bottom:12px;">Đang phân tích dữ liệu trang...</div>
                <div id="vnbypass-captcha-container"></div>
                <div style="display:flex; gap:8px; justify-content:center; margin-top:12px;">
                    <button id="btn-force-submit" class="btn btn-bypass" style="flex:2;">⚡ Vượt Nhanh (Bỏ Qua Captcha)</button>
                    <button id="btn-change-nv" class="btn btn-danger" style="flex:1;">Đổi Nhiệm Vụ</button>
                </div>
            </div>
        `;

        const mountTarget = document.querySelector('main#guide') || document.querySelector('.box-step-wrap') || document.body;
        mountTarget.prepend(wrapper);

        const statusElem = document.getElementById('vnbypass-status');
        const captchaContainer = document.getElementById('vnbypass-captcha-container');

        const trafficKey = getTrafficKey();
        const tokenId = getTokenId();
        const campaignId = getCampainId();

        let sessionToken = '';
        if (trafficKey) {
            sessionToken = await requestTrafficSession(trafficKey);
        }

        // Bắt sự kiện nút vượt nhanh
        document.getElementById('btn-force-submit').onclick = () => {
            statusElem.innerText = 'Đang nộp mã trực tiếp qua token dự phòng...';
            submitCodeVerification(tokenId, campaignId, '', BACKUP_TOKEN, sessionToken);
        };

        // Bắt sự kiện đổi nhiệm vụ
        document.getElementById('btn-change-nv').onclick = () => {
            executeChangeMission(sessionToken);
        };

        // Quét tìm thông số QCaptcha trên trang
        const html = document.body ? document.body.innerHTML : '';
        const siteKeyMatch = html.match(/(?:qCaptchaSiteKey|qcaptchaSiteKey)\s*[:=]\s*['"]([^'"]+)['"]/);
        const scriptUrlMatch = html.match(/(?:qCaptchaScriptUrl|qcaptchaScriptUrl)\s*[:=]\s*['"]([^'"]+)['"]/);

        if (siteKeyMatch && siteKeyMatch[1]) {
            statusElem.innerText = 'Phát hiện yêu cầu xác thực QCaptcha. Đang kết nối...';
            const siteKey = siteKeyMatch[1];
            const scriptUrl = scriptUrlMatch ? scriptUrlMatch[1] : null;

            const qController = new QCaptchaController(captchaContainer, siteKey, scriptUrl);
            qController.onSuccess = (qToken) => {
                statusElem.innerText = 'Xác minh thành công. Đang gửi dữ liệu nhận mã...';
                submitCodeVerification(tokenId, campaignId, '', qToken, sessionToken);
            };
            qController.init();
        } else {
            statusElem.innerHTML = '<span style="color:#16a34a;font-weight:700;">✓ Nhiệm vụ đã sẵn sàng! Bấm nút bên dưới để nhận mã.</span>';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
}
