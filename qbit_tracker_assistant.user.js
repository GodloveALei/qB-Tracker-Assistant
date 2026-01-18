// ==UserScript==
// @name         qBittorrent Tracker Assistant
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  集成功能：1.失效种子自动打标功能（支持自定义逻辑）；2.Tracker地址批量替换（修复并发逻辑Bug）。
// @author       DRH
// --- 在下方修改或添加您的 qBittorrent 访问地址 ---
// @match        http://192.168.*.*:*/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://update.greasyfork.org/scripts/562895/qBittorrent%20Tracker%20Assistant.user.js
// @updateURL    https://update.greasyfork.org/scripts/562895/qBittorrent%20Tracker%20Assistant.meta.js
// ==/UserScript==

(function() {
    'use strict';

    if (window.self !== window.top) return;

    let cachedData = [];
    let isTaskRunning = false;

    const injectUI = () => {
        if (document.getElementById('qbit-api-panel')) return;
        const panel = document.createElement('div');
        panel.id = 'qbit-api-panel';
        panel.style = "position:fixed;top:10px;right:10px;z-index:2147483647;background:#1a1a1a;color:#fff;border:1px solid #00bcd4;padding:15px;border-radius:10px;width:300px;box-shadow:0 4px 25px rgba(0,0,0,0.5);font-family:sans-serif;font-size:13px;";

        panel.innerHTML = `
            <span id="close-api-panel" style="position:absolute;top:8px;right:12px;cursor:pointer;color:#888;font-size:20px;font-weight:bold;line-height:1;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#888'">&times;</span>
            <b style="color:#00bcd4;font-size:16px;">qBittorrent 助手 v2.0</b><br>

            <div id="main-menu" style="margin-top:15px; display:block; text-align:center;">
                <div style="color:#666; font-size:13px; margin-bottom:15px; border-bottom:1px solid #333; padding-bottom:10px;">请点击下方按钮进行功能选择</div>
                <button id="nav-scan-btn" style="width:80%; cursor:pointer; background:#e91e63; color:white; border:none; padding:12px; font-weight:bold; border-radius:6px; margin:0 auto 15px auto; display:block;">🛡️ 1. 扫描失效种子</button>
                <button id="nav-replace-btn" style="width:80%; cursor:pointer; background:#00bcd4; color:black; border:none; padding:12px; font-weight:bold; border-radius:6px; margin:0 auto 15px auto; display:block;">✏️ 2. 批量更改地址</button>
            </div>

            <div id="scan-panel" style="display:none; margin-top:10px;">
                <div style="color:#e91e63; font-weight:bold; font-size:14px; margin-bottom:10px;">🛡️ 扫描失效种子</div>
                <p style="color:#888; font-size:13px; line-height:1.5; font-weight:400; background:#333; padding:8px; border-radius:4px;">·仅检索[做种]状态的种子；<br>·若种子的每条Tracker都符合勾选条件，则会为该种子打上“失效”标签。</p>

                <div style="margin:15px 0; background:#252525; padding:10px; border-radius:4px; border:1px solid #444;">
                    <label style="display:block; margin-bottom:8px; cursor:pointer;">
                        <input type="checkbox" id="check-peers" checked style="vertical-align:middle; margin-right:5px;"> Peers (用户) 等于 -1
                    </label>
                    <label style="display:block; cursor:pointer;">
                        <input type="checkbox" id="check-status" checked style="vertical-align:middle; margin-right:5px;"> 状态为 “未工作”
                    </label>
                </div>

                <div style="display:flex; gap:5px;">
                    <button id="start-scan-btn" style="flex:2;cursor:pointer;background:#e91e63;color:white;border:none;padding:10px;font-weight:bold;border-radius:4px;">开始扫描</button>
                    <button id="stop-scan-btn" style="flex:1;cursor:pointer;background:#555;color:white;border:none;padding:10px;font-weight:bold;border-radius:4px;">停止</button>
                </div>
                <button class="back-to-menu" style="width:100%;margin-top:10px;background:none;border:1px solid #444;color:#888;cursor:pointer;padding:5px;border-radius:4px;">返回主菜单</button>
            </div>

            <div id="replace-panel" style="display:none; margin-top:10px;">
                <div style="color:#00bcd4; font-weight:bold; font-size:14px; margin-bottom:10px;">✏️ 批量更改地址</div>
                <div id="search-section">
                    <div style="margin-bottom:8px;">
                        <label style="color:#888;">1. 搜索文本 (需包含):</label>
                        <input type="text" id="target-text" placeholder="需输入至少8个字符" style="width:100%;margin-top:5px;padding:6px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="color:#888;">2. 排除文本 (选填):</label>
                        <input type="text" id="exclude-text" placeholder="不需要排除请留空" style="width:100%;margin-top:5px;padding:6px;background:#333;border:1px solid #444;color:#fff;border-radius:4px;">
                    </div>
                    <button id="fast-check-btn" style="width:100%;cursor:pointer;background:#00bcd4;color:black;border:none;padding:10px;font-weight:bold;border-radius:4px;">🔍 检索种子</button>
                </div>
                <hr id="divider" style="display:none; border:0; border-top:1px solid #333; margin:15px 0;">
                <div id="modify-section" style="display:none;">
                    <div style="margin-bottom:12px;">
                        <label style="color:#ff9800; font-weight:bold;">3. 替代文本 (替换为):</label>
                        <input type="text" id="replace-text" placeholder="需输入至少8个字符" style="width:100%;margin-top:5px;padding:6px;background:#333;border:1px solid #ff9800;color:#fff;border-radius:4px;">
                    </div>
                    <div style="display:flex; gap:5px;">
                        <button id="replace-btn" style="flex:2;cursor:pointer;background:#ff9800;color:black;border:none;padding:10px;font-weight:bold;border-radius:4px;">🚀 确认替换</button>
                        <button id="restore-btn" style="flex:1;cursor:pointer;background:#555;color:white;border:none;padding:10px;font-weight:bold;border-radius:4px;">还原</button>
                    </div>
                </div>
                <button class="back-to-menu" style="width:100%;margin-top:10px;background:none;border:1px solid #444;color:#888;cursor:pointer;padding:5px;border-radius:4px;">返回主菜单</button>
            </div>

            <div id="api-status" style="font-size:12px;margin-top:10px;color:#aaa;background:#222;padding:8px;border-radius:4px;min-height:45px;white-space:pre-wrap;line-height:1.4;">请选择功能开始操作...</div>
        `;
        document.body.appendChild(panel);

        // --- 事件绑定 ---
        document.getElementById('nav-scan-btn').onclick = () => showPanel('scan-panel');
        document.getElementById('nav-replace-btn').onclick = () => showPanel('replace-panel');
        document.querySelectorAll('.back-to-menu').forEach(btn => {
            btn.onclick = () => { isTaskRunning = false; showPanel('main-menu'); setStatus("已返回主菜单"); };
        });

        document.getElementById('start-scan-btn').onclick = runBrokenSeedScan;
        document.getElementById('stop-scan-btn').onclick = () => { isTaskRunning = false; setStatus("已停止扫描。"); };

        document.getElementById('fast-check-btn').onclick = fastSearch;
        document.getElementById('replace-btn').onclick = () => runModify('replace');
        document.getElementById('restore-btn').onclick = () => runModify('restore');

        document.getElementById('close-api-panel').onclick = () => { isTaskRunning = false; panel.remove(); };
    };

    const showPanel = (id) => {
        ['main-menu', 'scan-panel', 'replace-panel'].forEach(pid => {
            document.getElementById(pid).style.display = (pid === id) ? 'block' : 'none';
        });
        if (id !== 'main-menu') {
            setStatus("");
        }
    };

    const setStatus = (msg) => { document.getElementById('api-status').innerText = msg; };

    // ================= 功能1: 扫描失效做种种子 (高速并发优化版) =================
    async function runBrokenSeedScan() {
        if (isTaskRunning) return;

        const usePeers = document.getElementById('check-peers').checked;
        const useStatus = document.getElementById('check-status').checked;

        if (!usePeers && !useStatus) {
            alert("⚠️ 请至少勾选一个筛选条件！");
            return;
        }

        isTaskRunning = true;
        setStatus("🚀 正在启动高速并发扫描...");

        try {
            const torrents = await (await fetch('/api/v2/torrents/info?filter=seeding')).json();
            let brokenHashes = [];
            let totalCount = torrents.length;
            const chunkSize = 30;

            for (let i = 0; i < totalCount; i += chunkSize) {
                if (!isTaskRunning) break;

                const chunk = torrents.slice(i, i + chunkSize);
                const results = await Promise.all(chunk.map(async (t) => {
                    try {
                        const trResp = await fetch(`/api/v2/torrents/trackers?hash=${t.hash}`);
                        const trackers = await trResp.json();
                        const realTrackers = trackers.filter(tr => tr.url.startsWith('http') || tr.url.startsWith('udp'));

                        if (realTrackers.length > 0) {
                            const allFailed = realTrackers.every(tr => {
                                let matchPeers = usePeers ? (tr.num_peers === -1) : false;
                                // 修正为判定“未工作”
                                let matchStatus = useStatus ? (tr.status === 1 || tr.msg.includes("未工作") || tr.msg.toLowerCase().includes("not working")) : false;
                                return (matchPeers || matchStatus);
                            });
                            return allFailed ? t.hash : null;
                        }
                    } catch(e) { return null; }
                    return null;
                }));

                brokenHashes.push(...results.filter(h => h !== null));
                setStatus(`扫描进度: ${Math.min(i + chunkSize, totalCount)}/${totalCount}\n找到可能失效种子: ${brokenHashes.length}`);
                await new Promise(r => setTimeout(r, 5));
            }

            if (isTaskRunning && brokenHashes.length > 0) {
                setStatus(`正在为 ${brokenHashes.length} 个种子打上“失效”标签...`);
                const formData = new FormData();
                formData.append('hashes', brokenHashes.join('|'));
                formData.append('tags', '失效');
                await fetch('/api/v2/torrents/addTags', { method: 'POST', body: formData });
                setStatus(`🏁 高速扫描完成！\n已为 ${brokenHashes.length} 个失效种子标记了“失效”标签。`);
            } else if (isTaskRunning) {
                setStatus("🏁 扫描完成，未发现符合条件的种子。");
            }
        } catch (e) { setStatus("❌ 出错: " + e.message); }
        isTaskRunning = false;
    }

    // ================= 功能2: 批量替换逻辑 (修复 Bug 版) =================
    async function fastSearch() {
        const target = document.getElementById('target-text').value.trim();
        const exclude = document.getElementById('exclude-text').value.trim();
        if (target.length < 8) { alert("⚠️ 搜索文本需 ≥8 字符！"); return; }
        setStatus("🚀 检索中...");
        cachedData = [];
        document.getElementById('modify-section').style.display = 'none';
        document.getElementById('divider').style.display = 'none';
        try {
            const torrents = await (await fetch('/api/v2/torrents/info')).json();
            const chunkSize = 25;
            for (let i = 0; i < torrents.length; i += chunkSize) {
                const chunk = torrents.slice(i, i + chunkSize);
                const res = await Promise.all(chunk.map(async (t) => {
                    const tr = await (await fetch(`/api/v2/torrents/trackers?hash=${t.hash}`)).json();
                    return { t, tr };
                }));
                for (const item of res) {
                    // urls 是字符串数组
                    const urls = item.tr.map(u => u.url);
                    if (urls.some(u => u.includes(target)) && !(exclude && urls.some(u => u.includes(exclude)))) {
                        // 修复点：item.tr 是对象数组，u 代表对象，必须访问 u.url.includes
                        const hit = item.tr.find(u => u.url.includes(target));
                        cachedData.push({ hash: item.t.hash, name: item.t.name, oldUrl: hit.url });
                    }
                }
                setStatus(`检索进度: ${Math.min(i + chunkSize, torrents.length)}/${torrents.length}\n找到匹配: ${cachedData.length}`);
            }
            if (cachedData.length > 0) {
                document.getElementById('modify-section').style.display = 'block';
                document.getElementById('divider').style.display = 'block';
                setStatus(`✅ 找到 ${cachedData.length} 个匹配种子。`);
            } else { setStatus("ℹ️ 未发现匹配种子。"); }
        } catch (e) { setStatus("❌ 错误: " + e.message); }
    }

    async function runModify(mode) {
        let boxA = document.getElementById('target-text').value.trim();
        let boxB = document.getElementById('replace-text').value.trim();
        if (boxB.length < 8) { alert("⚠️ 替换文本需 ≥8 字符！"); return; }
        if (mode === 'restore') [boxA, boxB] = [boxB, boxA];
        setStatus(`执行中...`);
        let count = 0;
        isTaskRunning = true;
        for (const item of cachedData) {
            if (!isTaskRunning) break;
            const newUrl = item.oldUrl.replace(boxA, boxB);
            const fd = new FormData();
            fd.append('hash', item.hash);
            fd.append('origUrl', item.oldUrl);
            fd.append('newUrl', newUrl);
            await fetch('/api/v2/torrents/editTracker', { method: 'POST', body: fd });
            count++;
            if (count % 5 === 0) setStatus(`处理进度: ${count}/${cachedData.length}`);
            await new Promise(r => setTimeout(r, 50));
        }
        setStatus(`🏁 完成！共处理 ${count} 个种子。`);
        isTaskRunning = false;
    }

    injectUI();
})();
